import { z } from "zod";
import { BaseMcpTool, ToolConfig, ToolResult } from "../BaseMcpTool.js";
import type { IRecipeStore } from "../../stores/IRecipeStore.js";
import type { RecipesListResponse } from "../../types.js";
import { toShortRecipe } from "./shared.js";

const inputSchema = z.object({
  limit: z.number().describe("Number of recipes to return").default(200),
});

export class ListRecipesTool extends BaseMcpTool<typeof inputSchema> {
  get name(): string {
    return "list-recipes";
  }

  get config(): ToolConfig {
    return {
      title: "Get List of Paprika Recipes",
      description: "Get a list of all recipes from Paprika Recipe Manager, returning a summary of each recipe including name, description, categories, total time, and difficulty.",
      inputSchema
    };
  }

  async execute(params: z.infer<typeof inputSchema>, recipeStore: IRecipeStore): Promise<ToolResult> {
    const { limit } = params;

    const results = await recipeStore.list();
    const recipes = results.map(toShortRecipe).slice(0, limit);

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
