import { Recipe } from "../types.js";
import { RecipeLoader } from "./RecipeLoader.js";

/**
 * Mock recipe loader for testing purposes.
 * Accepts an array of recipes and returns them when load() is called.
 */
export class MockRecipeLoader implements RecipeLoader {
  private recipes: Recipe[];

  constructor(recipes: Recipe[]) {
    this.recipes = recipes;
  }

  async load(): Promise<Recipe[]> {
    return this.recipes;
  }
}
