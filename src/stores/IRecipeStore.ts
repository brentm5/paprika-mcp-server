import { Recipe } from '../models/recipe.js';

export interface IRecipeStore {
  load(): Promise<void>;
  list(): Promise<Recipe[]>;
  search(query: string, fields?: string[], limit?: number): Promise<Recipe[]>;
  getByUid(uid: string): Promise<Recipe | null>;
  getCount(): Promise<number>;
  destroy(): void;
}
