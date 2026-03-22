export { Recipe, type Photo, type RecipeData } from './models/recipe.js';
import type { Recipe } from './models/recipe.js';

export type ShortRecipe = {
  uid: string;
  name: string;
  description?: string;
  categories?: string[];
  total_time?: string;
  difficulty?: string;
};

export type RecipesListResponse = {
  recipes: Partial<Recipe>[];
  count: number;
};
