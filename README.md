# Paprika MCP Server

An MCP server that gives AI assistants access to your [Paprika Recipe Manager](https://www.paprikaapp.com/) data.

## Building

```bash
pnpm install
pnpm build
```

## Unpacking Paprika Recipes

Paprika exports recipes as `.paprikarecipes` archive files. Before starting the server, unpack them into individual JSON files:

```bash
./dist/index.js unpack --input recipes.paprikarecipes --output ./recipes
```

| Option | Description |
| ------ | ----------- |
| `--input <file>` | Path to `.paprikarecipes` archive (required) |
| `--output <dir>` | Output directory for extracted JSON files (required) |
| `--verbose` | Enable verbose logging |

## Starting the Server

```bash
./dist/index.js mcp --recipes-dir ./recipes
```

| Option | Description |
| ------ | ----------- |
| `--recipes-dir <path>` | Directory containing recipe JSON files (default: `$PAPRIKA_RECIPES_DIR` or `./.recipes`) |
| `--server-name <name>` | MCP server name (default: `$PAPRIKA_SERVER_NAME` or `"paprika"`) |
| `--verbose` | Enable verbose logging |

## Using with Claude

### Claude Code

Add a `.mcp.json` file to your project root:

```json
{
  "mcpServers": {
    "paprika": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/paprika-mcp-server/dist/index.js",
        "mcp",
        "--recipes-dir",
        "/path/to/your/recipes"
      ]
    }
  }
}
```

## License

Apache 2.0
