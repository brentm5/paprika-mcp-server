import { CommandLineParser } from '@rushstack/ts-command-line';
import { McpAction as McpServerAction } from './actions/McpAction.js';
import { UnpackAction } from './actions/UnpackAction.js';

export class PaprikaMcpCommandLine extends CommandLineParser {
  public constructor() {
    super({
      toolFilename: 'paprika-mcp-server',
      toolDescription: 'CLI tool for Paprika Recipe Manager - MCP server and recipe utilities'
    });

    this.addAction(new McpServerAction());
    this.addAction(new UnpackAction());
  }
}
