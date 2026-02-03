import { Recipe } from "../types.js";

/**
 * Interface for loading recipes from different backends.
 * Implementations can load from file system, HTTP endpoints, databases, etc.
 */
export interface RecipeLoader {
  /**
   * Load recipes from the backend.
   * @returns Array of recipes loaded from the backend
   * @throws Error if loading fails
   */
  load(): Promise<Recipe[]>;
}
