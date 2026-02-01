import { Recipe } from "./types.js";
import * as fs from "fs";
import * as path from "path";
import { createRxDatabase, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

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
  private recipesDir: string;
  private db: RecipeDatabase | null = null;
  private collection: RecipeCollection | null = null;
  private initialized = false;

  constructor(recipesDir: string) {
    this.recipesDir = recipesDir;
  }

  private async initializeDatabase(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.db = await createRxDatabase<RecipeDatabase>({
      name: 'recipesdb',
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

      if (!fs.existsSync(this.recipesDir)) {
        console.error(`Recipes directory not found: ${this.recipesDir}`);
        return;
      }

      const files = fs.readdirSync(this.recipesDir);
      const jsonFiles = files.filter(file => file.endsWith(".json"));

      const recipes: Recipe[] = [];
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.recipesDir, file);
          const fileContent = fs.readFileSync(filePath, "utf-8");
          const recipe: Recipe = JSON.parse(fileContent);
          recipes.push(recipe);
        } catch (error) {
          console.error(`Error loading recipe ${file}:`, error);
        }
      }

      // Bulk insert recipes into RxDB
      if (recipes.length > 0 && this.collection) {
        try {
          const results = await this.collection.bulkInsert(recipes);
          if (results.error.length > 0) {
            console.error(`Failed to insert ${results.error.length} recipes during bulk insert.`);
            results.error.forEach(error => {
              console.error(`  * UID ${error.documentId} - Status ${error.status}`);
              if (error.status === 422) {
                const validationErrors = (error as any).validationErrors;
                if (Array.isArray(validationErrors)) {
                  validationErrors.forEach((ve: any) => {
                    console.error(`     * ${ve.instancePath}: ${ve.message}`);
                  });
                }
              }
            });
          }
        } catch (error: any) {
          // Handle bulk insert errors - log details about which recipes failed
          console.error("Error during bulk insert:");
          if (error.validationErrors) {
            console.error("Validation errors:", JSON.stringify(error.validationErrors, null, 2));
          }
          if (error.writeErrors) {
            console.error(`Failed to insert ${error.writeErrors.length} recipes`);
            error.writeErrors.forEach((writeError: any, index: number) => {
              console.error(`  [${index}] UID: ${writeError.documentInDb?.uid || 'unknown'}, Error:`, writeError.message);
            });
          } else {
            console.error(error);
          }
        }
      }

      const count = await this.collection?.count().exec();
      console.error(`Loaded ${count ?? 0} recipes from ${this.recipesDir}`);
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
}
