import { CommandLineAction, CommandLineFlagParameter, CommandLineStringParameter } from '@rushstack/ts-command-line';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LancedbFTSStore } from "../../stores/LancedbFTSStore.js";
import { BaseMcpTool } from "../../mcp/BaseMcpTool.js";
import { SearchRecipesTool } from "../../mcp/tools/SearchRecipesTool.js";
import { ListRecipesTool } from "../../mcp/tools/ListRecipesTool.js";
import { FileSystemRecipeLoader } from "../../loaders/FileSystemRecipeLoader.js";
import * as path from "path";
import * as fs from "fs";
import { GetRecipeTool } from '../../mcp/tools/GetRecipeTool.js';
import { ListCategoriesTool } from '../../mcp/tools/ListCategoriesTool.js';
export type ShortRecipe = {
  uid: string;
  name: string;
  description?: string;
  categories?: string[];
  total_time?: string;
  difficulty?: string;
}


export class McpAction extends CommandLineAction {
  private _recipesDir!: CommandLineStringParameter;
  private _dbDir!: CommandLineStringParameter;
  private _serverName!: CommandLineStringParameter;
  private _verbose!: CommandLineFlagParameter;

  public constructor() {
    super({
      actionName: 'mcp',
      summary: 'Start the MCP server',
      documentation: 'Start the MCP server and listen for requests on stdio'
    });

    this._recipesDir = this.defineStringParameter({
      parameterLongName: '--recipes-dir',
      parameterShortName: '-r',
      argumentName: 'PATH',
      description: 'Path to directory containing Paprika recipe JSON files',
      environmentVariable: 'PAPRIKA_RECIPES_DIR'
    });

    this._dbDir = this.defineStringParameter({
      parameterLongName: '--db-dir',
      argumentName: 'PATH',
      description: 'Path to directory where the LanceDB recipe database is stored',
      environmentVariable: 'PAPRIKA_DB_DIR'
    });

    this._serverName = this.defineStringParameter({
      parameterLongName: '--server-name',
      argumentName: 'NAME',
      description: 'Name for the MCP server',
      defaultValue: 'paprika',
      environmentVariable: 'PAPRIKA_SERVER_NAME'
    });

    this._verbose = this.defineFlagParameter({
      parameterLongName: '--verbose',
      parameterShortName: '-v',
      description: 'Enable verbose logging output'
    });
  }

  protected async onExecuteAsync(): Promise<void> {
    // Determine recipes directory
    const recipesDir = this._recipesDir.value || this._getDefaultRecipesDir();

    // Validate recipes directory exists
    if (!fs.existsSync(recipesDir)) {
      console.error(`Error: Recipes directory not found: ${recipesDir}`);
      console.error('Please specify a valid directory with --recipes-dir');
      process.exit(1);
    }

    if (this._verbose.value) {
      console.error(`Starting Paprika MCP Server...`);
      console.error(`  Recipes directory: ${recipesDir}`);
      console.error(`  Server name: ${this._serverName.value}`);
    }

    // Create recipe loader and store, then load recipes
    const recipeLoader = new FileSystemRecipeLoader(recipesDir);
    const dbPath = this._dbDir.value ?? path.join(__dirname, '..', 'db');
    const recipeStore = new LancedbFTSStore(recipeLoader, dbPath);
    await recipeStore.load();

    // Create and configure MCP server
    const server = new McpServer({
      name: this._serverName.value!,
      version: "1.0.0"
    });

    // Register tools and prompts
    this._registerTools(server, recipeStore);
    this._registerPrompts(server);

    // Start server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("Paprika MCP Server running on stdio");
  }

  private _getDefaultRecipesDir(): string {
    // Get the .recipes directory relative to current working directory
    return path.join(process.cwd(), '.recipes');
  }

  private _getTools(): BaseMcpTool[] {
    return [
      new SearchRecipesTool(),
      new ListRecipesTool(),
      new GetRecipeTool(),
      new ListCategoriesTool(),
    ];
  }

  private _registerPrompts(server: McpServer): void {
    server.registerPrompt(
      "how-to-use-paprika-tools",
      {
        title: "How to use Paprika recipe tools",
        description: "Explains the recommended workflow for using the Paprika recipe tools effectively",
      },
      () => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You have access to a Paprika Recipe Manager with the following tools. Here is the recommended workflow:

1. **list-categories** — Start here when the user wants to explore recipes or mentions a type of food/meal. Returns all categories with recipe counts. Category names can be passed directly as search queries.

2. **search-recipes** — Use this for any targeted lookup. Pass a category name, ingredient, dish name, or any keyword. Prefer this over list-recipes whenever you have any search criteria.

3. **get-recipe** — Use this to fetch full details (ingredients, directions, notes, nutritional info) for a specific recipe once you have its UID from a search or list result.

4. **list-recipes** — Last resort only. Use when the user explicitly wants to browse everything with no filter. Avoid this when a search query or category is available, as it returns up to 200 results and is less targeted.

**Typical flows:**
- User asks "what can I make for dinner?" → list-categories → search-recipes with a relevant category
- User asks "find me a chicken recipe" → search-recipes with query "chicken"
- User asks "show me the ingredients for that pasta dish" → get-recipe with the UID
- User asks "what categories do you have?" → list-categories`,
            },
          },
        ],
      })
    );
  }

  private _registerTools(server: McpServer, recipeStore: LancedbFTSStore): void {
    const tools = this._getTools();

    for (const tool of tools) {
      tool.register(server, recipeStore);
    }
  }
}
