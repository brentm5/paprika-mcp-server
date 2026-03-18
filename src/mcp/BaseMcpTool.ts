import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LancedbFTSStore } from "../stores/LancedbFTSStore.js";

export interface ToolConfig {
  title: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
}

export interface ToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
}

export abstract class BaseMcpTool<TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
  abstract get name(): string;
  abstract get config(): ToolConfig;

  abstract execute(params: z.infer<TSchema>, recipeStore: LancedbFTSStore): Promise<ToolResult>;

  register(server: McpServer, recipeStore: LancedbFTSStore): void {
    server.registerTool(
      this.name,
      this.config,
      async (params: unknown) => this.execute(params as z.infer<TSchema>, recipeStore)
    );
  }
}
