import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RecipeStore } from "../RecipeStore.js";

export interface ToolConfig {
  title: string;
  description: string;
  inputSchema: any;
}

export interface ToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  structuredContent?: any;
  isError?: boolean;
  [key: string]: unknown;
}

export abstract class BaseMcpTool<TSchema extends z.ZodObject<any> = z.ZodObject<any>> {
  abstract get name(): string;
  abstract get config(): ToolConfig;

  abstract execute(params: z.infer<TSchema>, recipeStore: RecipeStore): Promise<ToolResult>;

  register(server: McpServer, recipeStore: RecipeStore): void {
    server.registerTool(
      this.name,
      this.config,
      async (params: Record<string, unknown>) => this.execute(params as z.infer<TSchema>, recipeStore)
    );
  }
}
