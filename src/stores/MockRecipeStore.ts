import type { IRecipeStore } from "./IRecipeStore.js";
import { Recipe } from "../models/recipe.js";

export class MockRecipeStore implements IRecipeStore {
  recipes: Recipe[];

  constructor(recipes: Recipe[] = []) {
    this.recipes = recipes;
  }

  async load(): Promise<void> {}

  async list(): Promise<Recipe[]> {
    return this.recipes;
  }

  async search(query: string, fields?: string[], limit?: number): Promise<Recipe[]> {
    const q = query.toLowerCase();
    const searchFields = fields ?? ['name', 'description', 'ingredients', 'notes'];
    const matched = this.recipes.filter(r =>
      searchFields.some(f => (r[f as keyof Recipe] as string | undefined)?.toLowerCase().includes(q))
    );
    return matched.slice(0, limit);
  }

  async getByUid(uid: string): Promise<Recipe | null> {
    return this.recipes.find(r => r.uid === uid) ?? null;
  }

  async getCount(): Promise<number> {
    return this.recipes.length;
  }

  destroy(): void {}
}
