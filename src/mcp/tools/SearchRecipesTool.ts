import { z } from "zod";
import { BaseMcpTool, ToolConfig, ToolResult } from "../BaseMcpTool.js";
import { LancedbFTSStore } from "../../stores/LancedbFTSStore.js";
import { RecipesListResponse } from "../../types.js";

const inputSchema = z.object({
  searchQuery: z.string().describe("Search term to use for recipes"),
  fields: z.array(z.enum(['name', 'description', 'ingredients', 'notes', 'categories'])).optional()
    .optional()
    .describe("Fields to search in. Defaults to all searchable fields (name, description, ingredients, notes, categories)"),
  limit: z.number().describe("Maximum number of results to return").default(10),
});

export class SearchRecipesTool extends BaseMcpTool<typeof inputSchema> {
  get name(): string {
    return "search-recipes";
  }

  get config(): ToolConfig {
    return {
      title: "Search for Paprika Recipes",
      description: "Search for recipes from Paprika Recipe Manager by a query string. Searches across name, description, ingredients, notes, and categories by default, or a specified subset of those fields.",
      inputSchema,
    };
  }

  async execute(params: z.infer<typeof inputSchema>, recipeStore: LancedbFTSStore): Promise<ToolResult> {
    const { searchQuery, fields, limit } = params;

    const matchedRecipes = await recipeStore.search(searchQuery, fields);
    const recipes = matchedRecipes.map(r => ({
      uid: r.uid,
      name: r.name,
      description: r.description,
      categories: r.categories,
      total_time: r.total_time,
      difficulty: r.difficulty,
    })).slice(0, limit);

    const structuredContent: RecipesListResponse = {
      recipes: recipes,
      count: matchedRecipes.length,
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
