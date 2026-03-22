import { z } from "zod";
import { BaseMcpTool, ToolConfig, ToolResult } from "../BaseMcpTool.js";
import type { IRecipeStore } from "../../stores/IRecipeStore.js";

const inputSchema = z.object({});

type CategoryCount = {
  category: string;
  count: number;
};

export class ListCategoriesTool extends BaseMcpTool<typeof inputSchema> {
  get name(): string {
    return "list-categories";
  }

  get config(): ToolConfig {
    return {
      title: "List Recipe Categories",
      description: "Get a list of all recipe categories and the number of recipes in each category.",
      inputSchema
    };
  }

  async execute(_params: z.infer<typeof inputSchema>, recipeStore: IRecipeStore): Promise<ToolResult> {
    const recipes = await recipeStore.list();

    const categoryCounts = new Map<string, number>();
    for (const recipe of recipes) {
      for (const category of recipe.categories ?? []) {
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      }
    }

    const categories: CategoryCount[] = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category));

    const structuredContent = { categories, count: categories.length };

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
