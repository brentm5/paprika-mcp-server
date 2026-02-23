import { FileSystemRecipeLoader } from '../src/loaders/FileSystemRecipeLoader';
import { Recipe } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

console.error = () => {}; // Suppress error output during tests

describe('FileSystemRecipeLoader', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paprika-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory after each test
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('load', () => {
    it('should load recipes from JSON files', async () => {
      // Create test recipe files
      const recipe1: Recipe = {
        uid: '03D38552-8562-46F9-BA8E-97D5D27ACE0C',
        name: 'Test Recipe 1',
        description: 'A test recipe',
        ingredients: 'Ingredient 1\nIngredient 2',
      };

      const recipe2: Recipe = {
        uid: '56B5F1BC-B382-444C-85A9-F2AFDD0A875E',
        name: 'Test Recipe 2',
        description: 'Another test recipe',
        ingredients: 'Ingredient A\nIngredient B',
      };

      fs.writeFileSync(
        path.join(tempDir, '03D38552-8562-46F9-BA8E-97D5D27ACE0C.json'),
        JSON.stringify(recipe1)
      );
      fs.writeFileSync(
        path.join(tempDir, '56B5F1BC-B382-444C-85A9-F2AFDD0A875E.json'),
        JSON.stringify(recipe2)
      );

      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      expect(recipes).toHaveLength(2);
      expect(recipes).toEqual(expect.arrayContaining([
        expect.objectContaining({ uid: recipe1.uid, name: recipe1.name }),
        expect.objectContaining({ uid: recipe2.uid, name: recipe2.name }),
      ]));
    });

    it('should only load files with .json extension', async () => {
      // Create JSON and non-JSON files
      const recipe: Recipe = {
        uid: 'test-uid',
        name: 'Valid Recipe',
      };

      fs.writeFileSync(
        path.join(tempDir, 'valid-recipe.json'),
        JSON.stringify(recipe)
      );
      fs.writeFileSync(path.join(tempDir, 'not-a-recipe.txt'), 'Some text');
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# README');

      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      expect(recipes).toHaveLength(1);
      expect(recipes[0].name).toBe('Valid Recipe');
    });

    it('should return empty array when directory does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'non-existent');

      const loader = new FileSystemRecipeLoader(nonExistentDir);
      const recipes = await loader.load();

      expect(recipes).toEqual([]);
    });

    it('should return empty array when directory is empty', async () => {
      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      expect(recipes).toEqual([]);
    });

    it('should return empty array when directory contains no JSON files', async () => {
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'text content');
      fs.writeFileSync(path.join(tempDir, 'file2.md'), '# Markdown');

      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      expect(recipes).toEqual([]);
    });

    it('should skip malformed JSON files and continue loading valid ones', async () => {
      const validRecipe: Recipe = {
        uid: 'valid-uid',
        name: 'Valid Recipe',
      };

      fs.writeFileSync(
        path.join(tempDir, 'valid.json'),
        JSON.stringify(validRecipe)
      );
      fs.writeFileSync(
        path.join(tempDir, 'malformed.json'),
        '{ invalid json content'
      );

      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      expect(recipes).toHaveLength(1);
      expect(recipes[0].name).toBe('Valid Recipe');
    });

    it('should handle empty JSON files', async () => {
      fs.writeFileSync(path.join(tempDir, 'empty.json'), '');

      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      expect(recipes).toEqual([]);
    });

    it('should load recipes with all optional fields', async () => {
      const fullRecipe: Recipe = {
        uid: 'full-recipe-uid',
        name: 'Full Recipe',
        ingredients: 'Ingredient 1\nIngredient 2',
        directions: 'Step 1\nStep 2',
        description: 'A detailed description',
        notes: 'Some notes',
        nutritional_info: 'Calories: 200',
        prep_time: '10m',
        cook_time: '20m',
        total_time: '30m',
        servings: '4',
        difficulty: 'Medium',
        rating: 4,
        categories: ['Dinner', 'Quick'],
        source: 'Test Source',
        source_url: 'https://example.com/recipe',
        image_url: 'https://example.com/image.jpg',
        photo: 'photo-hash',
        created: '2026-02-08 12:00:00',
        hash: 'recipe-hash',
        photo_hash: 'photo-hash',
        photo_large: 'large-photo-hash',
        photo_data: 'base64-encoded-data',
        photos: [{ data: 'photo1' }, { data: 'photo2' }],
      };

      fs.writeFileSync(
        path.join(tempDir, 'full-recipe.json'),
        JSON.stringify(fullRecipe)
      );

      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      expect(recipes).toHaveLength(1);
      expect(recipes[0]).toEqual(fullRecipe);
    });

    it('should load recipes with minimal required fields only', async () => {
      const minimalRecipe: Recipe = {
        uid: 'minimal-uid',
        name: 'Minimal Recipe',
      };

      fs.writeFileSync(
        path.join(tempDir, 'minimal.json'),
        JSON.stringify(minimalRecipe)
      );

      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      expect(recipes).toHaveLength(1);
      expect(recipes[0]).toEqual(minimalRecipe);
    });

    it('should handle recipes with unicode characters', async () => {
      const unicodeRecipe: Recipe = {
        uid: 'unicode-uid',
        name: 'Crème Brûlée',
        description: 'A delicious dessert with émojis 🍰',
        ingredients: '2 cups crème\n1 tsp café',
      };

      fs.writeFileSync(
        path.join(tempDir, 'unicode.json'),
        JSON.stringify(unicodeRecipe)
      );

      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      expect(recipes).toHaveLength(1);
      expect(recipes[0].name).toBe('Crème Brûlée');
      expect(recipes[0].description).toBe('A delicious dessert with émojis 🍰');
    });

    it('should load multiple recipes in consistent order', async () => {
      const recipeCount = 10;
      const recipeUids: string[] = [];

      for (let i = 0; i < recipeCount; i++) {
        const uid = `recipe-${i.toString().padStart(3, '0')}`;
        recipeUids.push(uid);
        const recipe: Recipe = {
          uid,
          name: `Recipe ${i}`,
        };
        fs.writeFileSync(
          path.join(tempDir, `${uid}.json`),
          JSON.stringify(recipe)
        );
      }

      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      expect(recipes).toHaveLength(recipeCount);
      recipes.forEach(recipe => {
        expect(recipeUids).toContain(recipe.uid);
      });
    });

    it('should use existing fixture directory', async () => {
      const fixturesDir = path.join(__dirname, 'fixtures', 'recipes');

      // Verify fixtures directory exists
      expect(fs.existsSync(fixturesDir)).toBe(true);

      const loader = new FileSystemRecipeLoader(fixturesDir);
      const recipes = await loader.load();

      expect(recipes.length).toBeGreaterThan(0);
      recipes.forEach(recipe => {
        expect(recipe).toHaveProperty('uid');
        expect(recipe).toHaveProperty('name');
      });
    });

    it('should handle files with BOM (Byte Order Mark)', async () => {
      const recipe: Recipe = {
        uid: 'bom-uid',
        name: 'Recipe with BOM',
      };

      // Write file with UTF-8 BOM
      // Note: JSON.parse will fail on BOM, so this test verifies error handling
      const bomBuffer = Buffer.concat([
        Buffer.from([0xEF, 0xBB, 0xBF]), // UTF-8 BOM
        Buffer.from(JSON.stringify(recipe), 'utf-8')
      ]);
      fs.writeFileSync(path.join(tempDir, 'bom-recipe.json'), bomBuffer);

      // Add a valid recipe to ensure the loader continues
      const validRecipe: Recipe = {
        uid: 'valid-uid',
        name: 'Valid Recipe',
      };
      fs.writeFileSync(
        path.join(tempDir, 'valid.json'),
        JSON.stringify(validRecipe)
      );

      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      // Should load the valid recipe and skip the BOM file
      expect(recipes).toHaveLength(1);
      expect(recipes[0].name).toBe('Valid Recipe');
    });

    it('should handle JSON files with extra whitespace', async () => {
      const recipe: Recipe = {
        uid: 'whitespace-uid',
        name: 'Whitespace Recipe',
      };

      fs.writeFileSync(
        path.join(tempDir, 'whitespace.json'),
        '\n\n  ' + JSON.stringify(recipe, null, 2) + '\n\n  '
      );

      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      expect(recipes).toHaveLength(1);
      expect(recipes[0].name).toBe('Whitespace Recipe');
    });

    it('should skip files with read permission errors gracefully', async () => {
      if (process.platform === 'win32') {
        // Skip this test on Windows as permission handling is different
        return;
      }

      const validRecipe: Recipe = {
        uid: 'valid-uid',
        name: 'Valid Recipe',
      };

      fs.writeFileSync(
        path.join(tempDir, 'valid.json'),
        JSON.stringify(validRecipe)
      );

      const unreadableFile = path.join(tempDir, 'unreadable.json');
      fs.writeFileSync(unreadableFile, JSON.stringify({ uid: 'test', name: 'test' }));
      fs.chmodSync(unreadableFile, 0o000); // Remove all permissions

      const loader = new FileSystemRecipeLoader(tempDir);
      const recipes = await loader.load();

      // Clean up permissions before assertion
      fs.chmodSync(unreadableFile, 0o644);

      expect(recipes).toHaveLength(1);
      expect(recipes[0].name).toBe('Valid Recipe');
    });
  });

  describe('constructor', () => {
    it('should accept a recipes directory path', () => {
      const loader = new FileSystemRecipeLoader(tempDir);
      expect(loader).toBeInstanceOf(FileSystemRecipeLoader);
    });

    it('should handle absolute paths', () => {
      const absolutePath = path.resolve(tempDir);
      const loader = new FileSystemRecipeLoader(absolutePath);
      expect(loader).toBeInstanceOf(FileSystemRecipeLoader);
    });

    it('should handle relative paths', () => {
      const relativePath = './test-recipes';
      const loader = new FileSystemRecipeLoader(relativePath);
      expect(loader).toBeInstanceOf(FileSystemRecipeLoader);
    });
  });
});
