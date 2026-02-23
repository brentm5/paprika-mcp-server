# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Paprika MCP Server is a Model Context Protocol (MCP) server that provides access to Paprika Recipe Manager data. It enables AI assistants to search and retrieve recipes stored in Paprika format.

The project has two main functions:

1. **MCP Server**: Runs as an MCP server exposing recipe search/list/get tools via stdio transport
2. **Recipe Unpacker**: Converts `.paprikarecipes` archive files into individual JSON files

## Commands

### Development
```bash
# Install dependencies
pnpm install

# Build the project (bundles into single dist/index.cjs file)
pnpm build

# Build minified production bundle (~56% smaller)
pnpm build:prod

# Run directly in development (without building)
pnpm start

# Lint
pnpm lint

# Lint and auto-fix
pnpm fix
```

### Using the CLI

The CLI has two main commands:

```bash
# Start MCP server
./dist/index.js mcp --recipes-dir <path> [--server-name <name>] [--verbose]

# Unpack .paprikarecipes archive to individual JSON files
./dist/index.js unpack --input <file> --output <dir> [--verbose]
```

Environment variables:

- `PAPRIKA_RECIPES_DIR`: Default recipes directory (defaults to `.recipes` in CWD)
- `PAPRIKA_SERVER_NAME`: Default server name (defaults to "paprika")

## Architecture

### Core Components

**RecipeStore** (`src/RecipeStore.ts`)

- In-memory recipe database using RxDB with memory storage
- Loads recipes from a directory of JSON files on initialization
- Provides `list()`, `search(query, fields?)`, and `getCount()` methods
- Search is client-side filtering (case-insensitive substring matching)
- Uses RxDB schema validation with Ajv

**CLI System** (`src/cli/`)

- Built on `@rushstack/ts-command-line` for robust CLI parsing
- `PaprikaCommandLine`: Main CLI parser that registers actions
- **Actions**:
  - `McpAction`: Starts MCP server, loads recipes, registers tools
  - `UnpackAction`: Extracts `.paprikarecipes` (zip) containing gzipped JSON files

**MCP Tools** (`src/mcp/`)
- `BaseMcpTool<TSchema>`: Generic abstract base class for MCP tool implementations
  - Generic over a Zod schema type so `execute()` params are fully typed
  - Defines `name`, `config`, `execute()`, and `register()` interface
- **Registered Tools**:
  - `SearchRecipesTool`: Searches recipes by query string across specified fields
  - `ListRecipesTool`: Lists all recipes (limited subset of fields, default limit 200)
  - `GetRecipeTool`: Gets a single recipe by UID with full detail

### Data Flow

1. **Server Startup**: `McpAction` initializes `RecipeStore` with recipes directory
2. **Recipe Loading**: `RecipeStore.load()` reads all JSON files and bulk-inserts into RxDB
3. **MCP Server**: Tools are registered with the MCP server instance
4. **Request Handling**: MCP server receives requests via stdio, invokes tool `execute()` methods
5. **Response**: Tools return `ToolResult` with text content and optional structured data

### Recipe Data Format

Recipes are stored as individual JSON files named `<uid>.json`. The `.paprikarecipes` archive is a zip file containing gzipped `.paprikarecipe` files.

Key Recipe fields (see `src/types.ts`):
- Required: `uid`, `name`
- Searchable: `name`, `description`, `ingredients`, `notes`
- Metadata: `categories`, `rating`, `difficulty`, timing fields, source info
- Photos: `photo`, `photo_data`, `photo_large`, `photos[]`

## Key Implementation Details

### RxDB Schema
- Primary key is `uid`
- Index on `name` for performance
- Most fields are strings (even numeric-looking fields like `prep_time`)
- Arrays: `categories`, `photos`

### MCP Tool Registration
Tools self-register by calling `tool.register(server, recipeStore)`. The base class handles the registration logic, passing the recipeStore to the execute method.

### Search Implementation
Search is not index-based - it loads all documents and filters client-side. This works for small-medium recipe collections but may need optimization for large datasets.

## GitHub Actions Workflow Policy

All `uses:` references in `.github/workflows/` **must** be pinned to a full commit SHA (not a mutable tag or branch). Include the tag name as a comment for human readability.

Example:
```yaml
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
```

Current pinned versions (update comment + SHA when bumping):
- `actions/checkout` → `34e114876b0b11c390a56381ad16ebd13914f8d5` # v4.3.1 (ci.yml, release.yml)
- `jdx/mise-action` → `6d1e696aa24c1aa1bcc1adea0212707c71ab78a8` # v3.6.1 (ci.yml, release.yml)
- `changesets/action` → `6a0a831ff30acef54f2c6aa1cbbc1096b066edaf` # v1.7.0 (release.yml)
