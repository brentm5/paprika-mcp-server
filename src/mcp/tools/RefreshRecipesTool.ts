import { z } from "zod";
import { BaseMcpTool, ToolConfig, ToolResult } from "../BaseMcpTool.js";
import type { IRecipeStore } from "../../stores/IRecipeStore.js";

const inputSchema = z.object({});

export class RefreshRecipesTool extends BaseMcpTool<typeof inputSchema> {
  get name(): string {
    return "refresh-recipes";
  }

  get config(): ToolConfig {
    return {
      title: "Refresh Recipes",
      description: "Reload recipes from the Paprika recipes directory into the database. Use this after adding or updating recipes in Paprika.",
      inputSchema,
    };
  }

  async execute(_params: z.infer<typeof inputSchema>, recipeStore: IRecipeStore): Promise<ToolResult> {
    const countBefore = await recipeStore.getCount();
    await recipeStore.load();
    const countAfter = await recipeStore.getCount();

    const result = { recipes_before: countBefore, recipes_after: countAfter };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        }
      ],
      structuredContent: result,
    };
  }
}
