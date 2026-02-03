import { Recipe } from "./types.js";
import { randomUUID } from "crypto";
import { createRxDatabase, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { RecipeLoader } from "./loaders/RecipeLoader.js";

// RxDB schema for Recipe collection
const recipeSchema = {
  version: 0,
  primaryKey: 'uid',
  type: 'object' as const,
  properties: {
    uid: { type: 'string' as const, maxLength: 100 },
    name: { type: 'string' as const, maxLength: 500 },
    ingredients: { type: 'string' as const },
    directions: { type: 'string' as const },
    description: { type: 'string' as const },
    notes: { type: 'string' as const },
    nutritional_info: { type: 'string' as const },
    prep_time: { type: 'string' as const },
    cook_time: { type: 'string' as const },
    total_time: { type: 'string' as const },
    servings: { type: 'string' as const },
    difficulty: { type: 'string' as const },
    rating: { type: 'number' as const },
    categories: {
      type: 'array' as const,
      items: { type: 'string' as const }
    },
    source: { type: 'string' as const },
    source_url: { type: 'string' as const },
    image_url: { type: ['string', 'null'] as const },
    photo: { type: ['string', 'null'] as const },
    created: { type: 'string' as const },
    hash: { type: 'string' as const },
    photo_hash: { type: ['string', 'null'] as const },
    photo_large: { type: ['string', 'null'] as const },
    photo_data: { type: ['string', 'null'] as const },
    photos: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          data: { type: 'string' as const }
        },
        required: ['data']
      }
    }
  },
  required: ['uid', 'name'],
  indexes: ['name']
};

type RecipeCollection = RxCollection<Recipe>;

type RecipeDatabase = RxDatabase<{
  recipes: RecipeCollection;
}>;

export class RecipeStore {
  private loader: RecipeLoader;
  private db: RecipeDatabase | null = null;
  private collection: RecipeCollection | null = null;
  private initialized = false;
  private dbName: string;

  constructor(loader: RecipeLoader) {
    this.loader = loader;
    this.dbName = `recipesdb-${randomUUID()}`;
  }

  private async initializeDatabase(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.db = await createRxDatabase<RecipeDatabase>({
      name: this.dbName,
      storage: wrappedValidateAjvStorage({
        storage: getRxStorageMemory()
      }),
    });

    await this.db.addCollections({
      recipes: {
        schema: recipeSchema
      }
    });

    this.collection = this.db.recipes;
    this.initialized = true;
  }

  async load(): Promise<void> {
    try {
      // Initialize database on first load
      await this.initializeDatabase();

      // Load recipes from the configured loader
      const recipes = await this.loader.load();

      // Bulk insert recipes into RxDB, filtering out ones that already exist
      if (recipes.length > 0 && this.collection) {
        // Check which recipes already exist
        const existingUids = new Set<string>();
        const allDocs = await this.collection.find().exec();
        allDocs.forEach(doc => existingUids.add(doc.uid));

        // Only insert recipes that don't already exist
        const newRecipes = recipes.filter(recipe => !existingUids.has(recipe.uid));

        if (newRecipes.length > 0) {
          try {
            const results = await this.collection.bulkInsert(newRecipes);
            if (results.error.length > 0) {
              console.error(`Failed to insert ${results.error.length} recipes during bulk insert.`);
              results.error.forEach(error => {
                console.error(`  * UID ${error.documentId} - Status ${error.status}`);
                if (error.status === 422) {
                  const validationErrors = (error as { validationErrors?: Array<{ instancePath?: string; message?: string }> }).validationErrors;
                  if (Array.isArray(validationErrors)) {
                    validationErrors.forEach((ve) => {
                      console.error(`     * ${ve.instancePath}: ${ve.message}`);
                    });
                  }
                }
              });
            }
          } catch (error: unknown) {
            // Handle bulk insert errors - log details about which recipes failed
            console.error("Error during bulk insert:");
            const bulkError = error as {
              validationErrors?: unknown;
              writeErrors?: Array<{ documentInDb?: { uid?: string }; message?: string }>
            };
            if (bulkError.validationErrors) {
              console.error("Validation errors:", JSON.stringify(bulkError.validationErrors, null, 2));
            }
            if (bulkError.writeErrors) {
              console.error(`Failed to insert ${bulkError.writeErrors.length} recipes`);
              bulkError.writeErrors.forEach((writeError, index: number) => {
                console.error(`  [${index}] UID: ${writeError.documentInDb?.uid || 'unknown'}, Error:`, writeError.message);
              });
            } else {
              console.error(error);
            }
          }
        }
      }

      const count = await this.collection?.count().exec();
      const loaderType = typeof this.loader;
      console.error(`Loaded ${count ?? 0} recipes from ${loaderType}`);
    } catch (error) {
      console.error("Error loading recipes:", error);
    }
  }

  async list(): Promise<Recipe[]> {
    if (!this.collection) {
      return [];
    }

    const allDocs = await this.collection.find().exec();
    return allDocs.map(doc => doc.toJSON() as Recipe);
  }

  async getByUid(uid: string): Promise<Recipe | null> {
    if (!this.collection) {
      return null;
    }

    const doc = await this.collection.findOne({ selector: { uid } }).exec();
    return doc ? doc.toJSON() as Recipe : null;
  }

  async search(query: string, fields?: string[]): Promise<Recipe[]> {
    if (!this.collection) {
      return [];
    }

    // If query is empty, return all recipes
    if (!query || query.trim() === '') {
      const allDocs = await this.collection.find().exec();
      return allDocs.map(doc => doc.toJSON() as Recipe);
    }

    // Default to searching only name, description, ingredients, and notes
    const searchFields = fields || ['name', 'description', 'ingredients', 'notes'];

    // RxDB doesn't support complex OR queries well, so we'll use client-side filtering
    // TODO: Improve the searching to be much more resilient
    const allDocs = await this.collection.find().exec();
    const queryLower = query.toLowerCase();

    const matchedDocs = allDocs.filter(doc => {
      const recipe = doc.toJSON() as Recipe;

      return searchFields.some(field => {
        const fieldValue = recipe[field as keyof Recipe];
        if (typeof fieldValue === 'string') {
          return fieldValue.toLowerCase().includes(queryLower);
        }
        return false;
      });
    });

    return matchedDocs.map(doc => doc.toJSON() as Recipe);
  }

  get count(): number {
    // Return 0 if collection not initialized, actual count requires async
    return 0;
  }

  async getCount(): Promise<number> {
    if (!this.collection) {
      return 0;
    }
    return await this.collection.count().exec();
  }

  async destroy(): Promise<void> {
    if (this.db) {
      await this.db.remove();
      this.db = null;
      this.collection = null;
      this.initialized = false;
    }
  }
}
