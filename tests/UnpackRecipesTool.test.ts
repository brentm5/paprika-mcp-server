import * as path from 'path';
import * as os from 'os';
import { UnpackRecipesTool } from '../src/mcp/tools/UnpackRecipesTool';
import { MockRecipeStore } from '../src/stores/MockRecipeStore';
import { Recipe } from '../src/models/recipe';
import type { UnpackResult } from '../src/unpack/unpackPaprikaRecipes';

console.error = () => {}; // Suppress error output during tests

jest.mock('../src/unpack/unpackPaprikaRecipes');

import { unpackPaprikaRecipes } from '../src/unpack/unpackPaprikaRecipes';
const mockUnpack = unpackPaprikaRecipes as jest.MockedFunction<typeof unpackPaprikaRecipes>;

const FIXTURE_ARCHIVE = path.join(__dirname, 'fixtures', 'archive', 'export.paprikarecipes');
const DEFAULT_RECIPES_DIR = '/some/recipes/dir';

const EMPTY_RESULT: UnpackResult = { recipes: [], errors: [] };

describe('UnpackRecipesTool', () => {
  let tool: UnpackRecipesTool;
  let store: MockRecipeStore;

  beforeEach(() => {
    tool = new UnpackRecipesTool(DEFAULT_RECIPES_DIR);
    store = new MockRecipeStore();
    mockUnpack.mockResolvedValue(EMPTY_RESULT);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('metadata', () => {
    it('has the correct tool name', () => {
      expect(tool.name).toBe('unpack-recipes');
    });

    it('config has a title and inputSchema', () => {
      expect(tool.config.title).toBe('Unpack Recipes');
      expect(tool.config.inputSchema).toBeDefined();
    });
  });

  describe('execute — outputDir resolution', () => {
    it('defaults outputDir to the recipesDir passed to the constructor', async () => {
      await tool.execute({ filePath: FIXTURE_ARCHIVE }, store);

      expect(mockUnpack).toHaveBeenCalledWith(FIXTURE_ARCHIVE, DEFAULT_RECIPES_DIR);
    });

    it('uses the provided outputDir when specified', async () => {
      const customDir = '/custom/output';

      await tool.execute({ filePath: FIXTURE_ARCHIVE, outputDir: customDir }, store);

      expect(mockUnpack).toHaveBeenCalledWith(FIXTURE_ARCHIVE, customDir);
    });
  });

  describe('execute — store refresh', () => {
    it('captures recipe count before and after load in the response', async () => {
      store.recipes = [Recipe.from({ uid: 'uid-1', name: 'Existing Recipe' }), Recipe.from({ uid: 'uid-2', name: 'Another' })];

      const result = await tool.execute({ filePath: FIXTURE_ARCHIVE }, store);

      const response = JSON.parse(result.content[0].text);
      expect(response.store.recipes_before).toBe(2);
      expect(response.store.recipes_after).toBe(2);
    });
  });

  describe('execute — response shape', () => {
    it('includes unpacked recipes and errors from the unpack result', async () => {
      mockUnpack.mockResolvedValue({
        recipes: [{ uid: 'uid-1', name: 'Recipe One' }],
        errors: ['Skipping bad.paprikarecipe: No UID field found'],
      });

      const result = await tool.execute({ filePath: FIXTURE_ARCHIVE }, store);

      const response = JSON.parse(result.content[0].text);
      expect(response.recipes).toEqual([{ uid: 'uid-1', name: 'Recipe One' }]);
      expect(response.errors).toEqual(['Skipping bad.paprikarecipe: No UID field found']);
    });

    it('includes the resolved outputDir in the response', async () => {
      const result = await tool.execute({ filePath: FIXTURE_ARCHIVE, outputDir: '/explicit/dir' }, store);

      const response = JSON.parse(result.content[0].text);
      expect(response.outputDir).toBe('/explicit/dir');
    });

    it('structuredContent matches the parsed text content', async () => {
      mockUnpack.mockResolvedValue({ recipes: [{ uid: 'uid-1', name: 'Test' }], errors: [] });

      const result = await tool.execute({ filePath: FIXTURE_ARCHIVE }, store);

      expect(result.structuredContent).toEqual(JSON.parse(result.content[0].text));
    });
  });

  describe('execute — integration with real archive', () => {
    it('unpacks the fixture archive and updates the store', async () => {
      jest.unmock('../src/unpack/unpackPaprikaRecipes');
      const { unpackPaprikaRecipes: realUnpack } = jest.requireActual('../src/unpack/unpackPaprikaRecipes');
      mockUnpack.mockImplementation(realUnpack);

      const result = await tool.execute(
        { filePath: FIXTURE_ARCHIVE, outputDir: os.tmpdir() },
        store
      );

      const response = JSON.parse(result.content[0].text);
      expect(response.recipes).toHaveLength(2);
      expect(response.errors).toHaveLength(0);
    });
  });
});
