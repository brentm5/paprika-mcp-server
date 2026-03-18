import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as lancedb from '@lancedb/lancedb';
import { BooleanQuery, MultiMatchQuery, Occur, Operator, PhraseQuery } from '@lancedb/lancedb';
import type { Table, FieldLike } from '@lancedb/lancedb';
import type { Recipe } from '../types.js';
import type { RecipeLoader } from '../loaders/RecipeLoader.js';

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

type RecipeRow = {
  uid: string;
  name: string;
  ingredients: string | null;
  directions: string | null;
  description: string | null;
  notes: string | null;
  nutritional_info: string | null;
  prep_time: string | null;
  cook_time: string | null;
  total_time: string | null;
  servings: string | null;
  difficulty: string | null;
  rating: number | null;
  categories: string | null;
  source: string | null;
  source_url: string | null;
  image_url: string | null;
  photo: string | null;
  created: string | null;
  hash: string | null;
  photo_hash: string | null;
  photo_large: string | null;
  photo_data: string | null;
};

function rowToRecipe(row: RecipeRow): Recipe {
  return {
    uid: row.uid,
    name: row.name,
    ingredients: row.ingredients ?? undefined,
    directions: row.directions ?? undefined,
    description: row.description ?? undefined,
    notes: row.notes ?? undefined,
    nutritional_info: row.nutritional_info ?? undefined,
    prep_time: row.prep_time ?? undefined,
    cook_time: row.cook_time ?? undefined,
    total_time: row.total_time ?? undefined,
    servings: row.servings ?? undefined,
    difficulty: row.difficulty ?? undefined,
    rating: row.rating ?? undefined,
    categories: row.categories ? row.categories.split('\x00').filter(Boolean) : undefined,
    source: row.source ?? undefined,
    source_url: row.source_url ?? undefined,
    image_url: row.image_url ?? undefined,
    photo: row.photo ?? undefined,
    created: row.created ?? undefined,
    hash: row.hash ?? undefined,
    photo_hash: row.photo_hash ?? undefined,
    photo_large: row.photo_large ?? undefined,
    photo_data: row.photo_data ?? undefined,
  };
}

function recipeToRow(recipe: Recipe): RecipeRow {
  return {
    uid: recipe.uid,
    name: recipe.name,
    ingredients: recipe.ingredients ?? null,
    directions: recipe.directions ?? null,
    description: recipe.description ?? null,
    notes: recipe.notes ?? null,
    nutritional_info: recipe.nutritional_info ?? null,
    prep_time: recipe.prep_time ?? null,
    cook_time: recipe.cook_time ?? null,
    total_time: recipe.total_time ?? null,
    servings: recipe.servings ?? null,
    difficulty: recipe.difficulty ?? null,
    rating: recipe.rating ?? null,
    categories: recipe.categories?.map(c => c.replaceAll('\x00', '')).join('\x00') ?? null,
    source: recipe.source ?? null,
    source_url: recipe.source_url ?? null,
    image_url: recipe.image_url ?? null,
    photo: recipe.photo ?? null,
    created: recipe.created ?? null,
    hash: recipe.hash ?? null,
    photo_hash: recipe.photo_hash ?? null,
    photo_large: recipe.photo_large ?? null,
    photo_data: recipe.photo_data ?? null,
  };
}

const TABLE_FIELDS: FieldLike[] = [
  { name: 'uid', type: 'utf8', nullable: false },
  { name: 'name', type: 'utf8', nullable: false },
  { name: 'ingredients', type: 'utf8', nullable: true },
  { name: 'directions', type: 'utf8', nullable: true },
  { name: 'description', type: 'utf8', nullable: true },
  { name: 'notes', type: 'utf8', nullable: true },
  { name: 'nutritional_info', type: 'utf8', nullable: true },
  { name: 'prep_time', type: 'utf8', nullable: true },
  { name: 'cook_time', type: 'utf8', nullable: true },
  { name: 'total_time', type: 'utf8', nullable: true },
  { name: 'servings', type: 'utf8', nullable: true },
  { name: 'difficulty', type: 'utf8', nullable: true },
  { name: 'rating', type: 'float64', nullable: true },
  { name: 'categories', type: 'utf8', nullable: true },
  { name: 'source', type: 'utf8', nullable: true },
  { name: 'source_url', type: 'utf8', nullable: true },
  { name: 'image_url', type: 'utf8', nullable: true },
  { name: 'photo', type: 'utf8', nullable: true },
  { name: 'created', type: 'utf8', nullable: true },
  { name: 'hash', type: 'utf8', nullable: true },
  { name: 'photo_hash', type: 'utf8', nullable: true },
  { name: 'photo_large', type: 'utf8', nullable: true },
  { name: 'photo_data', type: 'utf8', nullable: true },
];

export class LancedbFTSStore {
  private readonly _loader: RecipeLoader;
  private readonly _dbPath: string;
  private _table: Table | null = null;

  constructor(loader: RecipeLoader, dbPath?: string) {
    this._loader = loader;
    this._dbPath = dbPath ?? path.join(os.tmpdir(), `paprika-mcp-${randomUUID()}`);
  }

  private async _getTable(): Promise<Table> {
    if (this._table) return this._table;

    const conn = await lancedb.connect(this._dbPath);
    const tableNames = await conn.tableNames();

    if (tableNames.includes(TABLE_NAME)) {
      this._table = await conn.openTable(TABLE_NAME);
    } else {
      this._table = await conn.createEmptyTable(TABLE_NAME, {
        fields: TABLE_FIELDS,
        metadata: new Map(),
        get names() { return TABLE_FIELDS.map(f => (f as { name: string }).name); },
      });
    }

    return this._table;
  }

  async load(): Promise<void> {
    try {
      const recipes = await this._loader.load();
      if (recipes.length === 0) return;

      const table = await this._getTable();
      const rows = recipes.map(recipeToRow);

      // Upsert all recipes (merge on uid)
      await table
        .mergeInsert('uid')
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute(rows);

      // Build FTS indexes
      for (const column of FTS_COLUMNS) {
        await table.createIndex(column, {
          config: lancedb.Index.fts({ withPosition: true }),
          replace: true,
        });
      }

      const count = await this.getCount();
      console.error(`Loaded ${count} recipes`);
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  }

  async list(): Promise<Recipe[]> {
    const table = await this._getTable();
    const rows = await table.query().toArray() as RecipeRow[];
    return rows.map(rowToRecipe);
  }

  async getByUid(uid: string): Promise<Recipe | null> {
    const table = await this._getTable();
    const escaped = uid.replaceAll("'", "''");
    const rows = await table.query().where(`uid = '${escaped}'`).limit(1).toArray() as RecipeRow[];
    return rows.length > 0 ? rowToRecipe(rows[0]) : null;
  }

  async search(query: string, fields?: string[], limit = 50): Promise<Recipe[]> {
    if (!query || query.trim() === '') {
      return this.list();
    }

    const table = await this._getTable();
    const searchCols = (fields?.filter((f): f is FtsColumn =>
      (FTS_COLUMNS as readonly string[]).includes(f)
    ) ?? [...FTS_COLUMNS]);

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

    return rows.map(rowToRecipe);
  }

  async getCount(): Promise<number> {
    const table = await this._getTable();
    const rows = await table.query().toArray();
    return rows.length;
  }

  destroy(): void {
    this._table = null;
  }
}
