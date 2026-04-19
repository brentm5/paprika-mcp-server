import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as lancedb from '@lancedb/lancedb';
import { BooleanQuery, MultiMatchQuery, Occur, Operator, PhraseQuery } from '@lancedb/lancedb';
import type { Table, FieldLike } from '@lancedb/lancedb';
import { Recipe } from '../models/recipe.js';
import type { RecipeLoader } from '../loaders/RecipeLoader.js';
import type { IRecipeStore } from './IRecipeStore.js';

// LanceDB cannot store arrays or undefined; categories is encoded as a null-byte-delimited string.
type SpecialField = 'uid' | 'name' | 'rating' | 'categories' | 'photos';
type OptionalStringField = keyof {
  [K in keyof Recipe as NonNullable<Required<Recipe>[K]> extends string
    ? K extends SpecialField ? never : K
    : never]: unknown
};

type RecipeRow =
  Pick<Recipe, 'uid' | 'name'>
  & { [K in OptionalStringField]: string | null }
  & { rating: number | null; categories: string | null };

const OPTIONAL_STRING_FIELDS: readonly OptionalStringField[] = [
  'ingredients', 'directions', 'description', 'notes',
  'nutritional_info', 'prep_time', 'cook_time', 'total_time',
  'servings', 'difficulty', 'source', 'source_url',
  'image_url', 'photo', 'created', 'hash',
  'photo_hash', 'photo_large', 'photo_data',
];

function toRow(recipe: Recipe): RecipeRow {
  const row = {
    uid: recipe.uid,
    name: recipe.name,
    rating: recipe.rating ?? null,
    categories: recipe.categories?.map(c => c.replaceAll(CATEGORY_DELIMITER, '')).join(CATEGORY_DELIMITER) ?? null,
  } as RecipeRow;

  for (const field of OPTIONAL_STRING_FIELDS) {
    row[field] = recipe[field] ?? null;
  }

  return row;
}

function fromRow(row: RecipeRow): Recipe {
  const recipe = new Recipe({ uid: row.uid, name: row.name });

  for (const field of OPTIONAL_STRING_FIELDS) {
    const value = row[field];
    if (value != null) recipe[field] = value;
  }

  if (row.rating != null) recipe.rating = row.rating;
  if (row.categories) {
    recipe.categories = row.categories.split(CATEGORY_DELIMITER).filter(Boolean);
  }

  return recipe;
}

const CATEGORY_DELIMITER = '\x00';

const TABLE_NAME = 'recipes';
const FTS_COLUMNS = ['name', 'ingredients', 'description', 'notes', 'categories'] as const;
type FtsColumn = typeof FTS_COLUMNS[number];

const COLUMN_BOOSTS: Record<FtsColumn, number> = {
  name: 4.0,
  ingredients: 2.0,
  description: 1.0,
  notes: 1.0,
  categories: 1.5,
};

const TABLE_FIELDS: FieldLike[] = [
  { name: 'uid', type: 'utf8', nullable: false },
  { name: 'name', type: 'utf8', nullable: false },
  ...OPTIONAL_STRING_FIELDS.map(name => ({ name, type: 'utf8' as const, nullable: true })),
  { name: 'rating', type: 'float64', nullable: true },
  { name: 'categories', type: 'utf8', nullable: true },
];

export class LancedbRecipeStore implements IRecipeStore {
  private readonly _loader: RecipeLoader;
  private readonly _dbPath: string;
  private _tablePromise: Promise<Table> | null = null;
  private _loadPromise: Promise<void> | null = null;

  constructor(loader: RecipeLoader, dbPath?: string) {
    this._loader = loader;
    this._dbPath = dbPath ?? path.join(os.tmpdir(), `paprika-mcp-${randomUUID()}`);
  }

  private _getTable(): Promise<Table> {
    if (!this._tablePromise) {
      this._tablePromise = this._openTable();
    }
    return this._tablePromise;
  }

  private async _openTable(): Promise<Table> {
    console.error(`[paprika] Connecting to LanceDB at: ${this._dbPath}`);
    const conn = await lancedb.connect(this._dbPath);
    console.error(`[paprika] Opening/creating table '${TABLE_NAME}'`);
    return conn.createEmptyTable(TABLE_NAME, {
      fields: TABLE_FIELDS,
      metadata: new Map(),
      get names() { return TABLE_FIELDS.map(f => (f as { name: string }).name); },
    }, { existOk: true });
  }

  load(): Promise<void> {
    if (!this._loadPromise) {
      this._loadPromise = this._doLoad().finally(() => {
        this._loadPromise = null;
      });
    }
    return this._loadPromise;
  }

  private async _doLoad(): Promise<void> {
    try {
      console.error(`[paprika] Loading recipes from loader...`);
      const recipes = await this._loader.load();
      console.error(`[paprika] Loader returned ${recipes.length} recipes`);
      if (recipes.length === 0) return;

      const table = await this._getTable();

      console.error(`[paprika] Writing ${recipes.length} recipes into LanceDB...`);
      await table.add(recipes.map(toRow), { mode: 'overwrite' });
      console.error(`[paprika] Write complete`);

      console.error(`[paprika] Creating FTS indexes...`);
      for (const column of FTS_COLUMNS) {
        console.error(`[paprika]   Indexing column: ${column}`);
        await table.createIndex(column, {
          config: lancedb.Index.fts({ withPosition: true }),
          replace: true,
        });
      }
      console.error(`[paprika] FTS indexes created`);

      console.error(`[paprika] Loaded ${await table.countRows()} recipes`);
    } catch (error) {
      console.error('[paprika] Error loading recipes:', error);
      throw error;
    }
  }

  async list(): Promise<Recipe[]> {
    const table = await this._getTable();
    const rows = await table.query().toArray() as RecipeRow[];
    return rows.map(fromRow);
  }

  async getByUid(uid: string): Promise<Recipe | null> {
    const table = await this._getTable();
    const escaped = uid.replaceAll("'", "''");
    const rows = await table.query().where(`uid = '${escaped}'`).limit(1).toArray() as RecipeRow[];
    return rows.length > 0 ? fromRow(rows[0]) : null;
  }

  async search(query: string, fields?: string[], limit = 50): Promise<Recipe[]> {
    if (!query || query.trim() === '') {
      return this.list();
    }

    const table = await this._getTable();
    const searchCols = fields?.filter((f): f is FtsColumn =>
      (FTS_COLUMNS as readonly string[]).includes(f)
    ) ?? [...FTS_COLUMNS];

    const ftsQuery = new BooleanQuery([
      [Occur.Must, new MultiMatchQuery(query, searchCols, {
        operator: Operator.Or,
        boosts: searchCols.map(col => COLUMN_BOOSTS[col]),
      })],
      ...searchCols.map(col =>
        [Occur.Should, new PhraseQuery(query, col, { slop: 2 })] as [Occur, PhraseQuery]
      ),
    ]);

    const rows = await table
      .search(ftsQuery)
      .limit(limit)
      .toArray() as Array<RecipeRow & { _score: number }>;

    return rows.map(fromRow);
  }

  async getCount(): Promise<number> {
    const table = await this._getTable();
    return table.countRows();
  }

  destroy(): void {
    this._tablePromise = null;
    this._loadPromise = null;
  }
}
