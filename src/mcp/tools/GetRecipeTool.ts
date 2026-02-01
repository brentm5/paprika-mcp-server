import { z } from "zod";
import { BaseMcpTool, ToolConfig, ToolResult } from "../BaseMcpTool.js";
import { RecipeStore } from "../../RecipeStore.js";
import { RecipesListResponse } from "../../types.js";

const inputSchema = z.object({
  uid: z.string().describe("UID for the Recipe to get"),
});

export class GetRecipeTool extends BaseMcpTool<typeof inputSchema> {
  get name(): string {
    return "get-recipe";
  }

  get config(): ToolConfig {
    return {
      title: "Get Paprika Recipe",
      description: "Get a list of all recipes from Paprika Recipe Manager",
      inputSchema,
    };
  }

  async execute(params: z.infer<typeof inputSchema>, recipeStore: RecipeStore): Promise<ToolResult> {
    const { uid } = params;

    const recipe = await recipeStore.getByUid(uid);

    if (!recipe) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: `Recipe with UID ${uid} not found` }, null, 2)
          }
        ],
        isError: true
      };
    }

    const recipes = [{
      uid: recipe.uid,
      name: recipe.name,
      description: recipe.description,
      ingredients: recipe.ingredients,
      directions: recipe.directions,
      notes: recipe.notes,
      nutritional_info: recipe.nutritional_info,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      total_time: recipe.total_time,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      rating: recipe.rating,
      categories: recipe.categories,
      source: recipe.source,
      source_url: recipe.source_url,
    }];

    const structuredContent: RecipesListResponse = {
      recipes,
      count: recipes.length,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(structuredContent, null, 2)
        }
      ],
      structuredContent
    };
  }
}
