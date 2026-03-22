import type { Recipe } from '../../models/recipe.js';
import type { ShortRecipe } from '../../types.js';

/** Map a full Recipe to the summary shape returned by list/search tools. */
export function toShortRecipe(recipe: Recipe): ShortRecipe {
  return {
    uid: recipe.uid,
    name: recipe.name,
    description: recipe.description,
    categories: recipe.categories,
    total_time: recipe.total_time,
    difficulty: recipe.difficulty,
  };
}
