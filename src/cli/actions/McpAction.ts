import { CommandLineAction, CommandLineFlagParameter, CommandLineStringParameter } from '@rushstack/ts-command-line';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RecipeStore } from "../../RecipeStore.js";
import { BaseMcpTool } from "../../mcp/BaseMcpTool.js";
import { SearchRecipesTool } from "../../mcp/tools/SearchRecipesTool.js";
import { ListRecipesTool } from "../../mcp/tools/ListRecipesTool.js";
import { FileSystemRecipeLoader } from "../../loaders/FileSystemRecipeLoader.js";
import * as path from "path";
import * as fs from "fs";
import { GetRecipeTool } from '../../mcp/tools/GetRecipeTool.js';
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
    const recipeStore = new RecipeStore(recipeLoader);
    await recipeStore.load();

    // Create and configure MCP server
    const server = new McpServer({
      name: this._serverName.value!,
      version: "1.0.0"
    });

    // Register tools
    this._registerTools(server, recipeStore);

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
    ];
  }

  private _registerTools(server: McpServer, recipeStore: RecipeStore): void {
    const tools = this._getTools();

    for (const tool of tools) {
      tool.register(server, recipeStore);
    }
  }
}
