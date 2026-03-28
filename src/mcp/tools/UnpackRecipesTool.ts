import { z } from "zod";
import { BaseMcpTool, ToolConfig, ToolResult } from "../BaseMcpTool.js";
import type { IRecipeStore } from "../../stores/IRecipeStore.js";
import { unpackPaprikaRecipes } from "../../unpack/unpackPaprikaRecipes.js";

const inputSchema = z.object({
  filePath: z.string().describe("Path to the .paprikarecipes archive file to unpack"),
  outputDir: z.string().optional().describe("Directory to write unpacked JSON files to. Defaults to the server's recipes directory."),
});

export class UnpackRecipesTool extends BaseMcpTool<typeof inputSchema> {
  private _recipesDir: string;

  constructor(recipesDir: string) {
    super();
    this._recipesDir = recipesDir;
  }

  get name(): string {
    return "unpack-recipes";
  }

  get config(): ToolConfig {
    return {
      title: "Unpack Recipes",
      description: "Unpack a .paprikarecipes archive file into individual JSON recipe files and refresh the recipe store. The recipes will be immediately available for search and retrieval.",
      inputSchema,
    };
  }

  async execute(params: z.infer<typeof inputSchema>, recipeStore: IRecipeStore): Promise<ToolResult> {
    const outputDir = params.outputDir ?? this._recipesDir;
    const result = await unpackPaprikaRecipes(params.filePath, outputDir);

    const countBefore = await recipeStore.getCount();
    await recipeStore.load();
    const countAfter = await recipeStore.getCount();

    const response = {
      recipes: result.recipes,
      errors: result.errors,
      outputDir,
      store: {
        recipes_before: countBefore,
        recipes_after: countAfter,
      },
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
        },
      ],
      structuredContent: response,
    };
  }
}
