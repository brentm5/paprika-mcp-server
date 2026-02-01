import { z } from "zod";
import { BaseMcpTool, ToolConfig, ToolResult } from "../BaseMcpTool.js";
import { RecipeStore } from "../../RecipeStore.js";
import { RecipesListResponse } from "../../types.js";

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
      description: "Get a list of all recipes from Paprika Recipe Manager",
      inputSchema
    };
  }

  async execute(params: z.infer<typeof inputSchema>, recipeStore: RecipeStore): Promise<ToolResult> {
    const { limit } = params;

    const results = await recipeStore.list();
    const recipes = results.map(r => ({
      uid: r.uid,
      name: r.name,
      description: r.description,
      categories: r.categories,
      total_time: r.total_time,
      difficulty: r.difficulty,
    })).slice(0, limit);

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
