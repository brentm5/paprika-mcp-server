import { Recipe } from "../types.js";
import { RecipeLoader } from "./RecipeLoader.js";
import * as fs from "fs";
import * as path from "path";

/**
 * Loads recipes from JSON files in a local directory.
 */
export class FileSystemRecipeLoader implements RecipeLoader {
  private recipesDir: string;

  constructor(recipesDir: string) {
    this.recipesDir = recipesDir;
  }

  async load(): Promise<Recipe[]> {
    if (!fs.existsSync(this.recipesDir)) {
      console.error(`Recipes directory not found: ${this.recipesDir}`);
      return [];
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

    return recipes;
  }
}
