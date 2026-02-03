import { RecipeStore } from '../src/RecipeStore';
import { MockRecipeLoader } from '../src/loaders/MockRecipeLoader';
import { Recipe } from '../src/types';

console.error = () => {}; // Suppress error output during tests

// Mock recipe data for testing
const mockRecipes: Recipe[] = [
  {
    uid: '03D38552-8562-46F9-BA8E-97D5D27ACE0C',
    name: 'Recipe 1',
    description: 'Description',
    ingredients: 'Ingredient 1\nIngredient 2',
    notes: 'Notes',
    source: 'source.com'
  },
  {
    uid: '56B5F1BC-B382-444C-85A9-F2AFDD0A875E',
    name: 'Recipe 2',
    description: 'Description',
    ingredients: 'Ingredient 1\nIngredient 2',
    notes: 'Notes',
    source: 'source.com'
  }
];
const defaultLoader = new MockRecipeLoader(mockRecipes);

describe('RecipeStore', () => {
  let store: RecipeStore;

  beforeEach(async () => {
    store = new RecipeStore(defaultLoader);
    await store.load();
  });

  afterEach(async () => {
    // Clean up database after each test
    await store.destroy();
  });

  describe('load', () => {
    it('should load recipes from loader', async () => {
      const count = await store.getCount();
      expect(count).toBe(2);
    });

    it('should handle empty recipe list', async () => {
      const loader = new MockRecipeLoader([]);
      const emptyStore = new RecipeStore(loader);
      await expect(emptyStore.load()).resolves.not.toThrow();
      const count = await emptyStore.getCount();
      expect(count).toBe(0);
    });
  });

  describe('list', () => {
    it('should return all recipes', async () => {
      const recipes = await store.list();
      expect(recipes).toHaveLength(2);
      expect(recipes[0]).toHaveProperty('uid');
      expect(recipes[0]).toHaveProperty('name');
    });

    it('should return empty array when no recipes loaded', async () => {
      const loader = new MockRecipeLoader([]);
      const emptyStore = new RecipeStore(loader);
      await emptyStore.load();
      const recipes = await emptyStore.list();
      expect(recipes).toEqual([]);
    });
  });

  describe('getByUid', () => {
    it('should retrieve recipe by uid', async () => {
      const recipe = await store.getByUid('03D38552-8562-46F9-BA8E-97D5D27ACE0C');
      expect(recipe).not.toBeNull();
      expect(recipe?.uid).toBe('03D38552-8562-46F9-BA8E-97D5D27ACE0C');
      expect(recipe?.name).toBe('Recipe 1');
    });

    it('should return null for non-existent uid', async () => {
      const recipe = await store.getByUid('non-existent-uid');
      expect(recipe).toBeNull();
    });
  });

  describe('search', () => {
    it('should search by name', async () => {
      const results = await store.search('Recipe 1');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Recipe 1');
    });

    it('should search case-insensitively', async () => {
      const results = await store.search('recipe 2');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Recipe 2');
    });

    it('should search by partial name', async () => {
      const results = await store.search('Recipe');
      expect(results).toHaveLength(2);
    });

    it('should search in description field', async () => {
      const results = await store.search('Description');
      expect(results).toHaveLength(2);
    });

    it('should search in ingredients field', async () => {
      const results = await store.search('Ingredient 1');
      expect(results).toHaveLength(2);
    });

    it('should search in notes field', async () => {
      const results = await store.search('Notes');
      expect(results).toHaveLength(2);
    });

    it('should return empty array for non-matching query', async () => {
      const results = await store.search('NonExistentRecipe');
      expect(results).toEqual([]);
    });

    it('should return all recipes for empty query', async () => {
      const results = await store.search('');
      expect(results).toHaveLength(2);
    });

    it('should return all recipes for whitespace query', async () => {
      const results = await store.search('   ');
      expect(results).toHaveLength(2);
    });

    it('should search only in specified fields', async () => {
      // Search for "source" in name field only - should not match
      const results = await store.search('source', ['name']);
      expect(results).toEqual([]);
    });
  });

  describe('getCount', () => {
    it('should return correct count of recipes', async () => {
      const count = await store.getCount();
      expect(count).toBe(2);
    });

    it('should return 0 for empty store', async () => {
      const loader = new MockRecipeLoader([]);
      const emptyStore = new RecipeStore(loader);
      await emptyStore.load();
      const count = await emptyStore.getCount();
      expect(count).toBe(0);
    });
  });

  describe('database initialization', () => {
    it('should initialize database only once', async () => {
      const testStore = new RecipeStore(defaultLoader);

      // Load multiple times
      await testStore.load();
      await testStore.load();
      await testStore.load();

      // Should still have correct count
      const count = await testStore.getCount();
      expect(count).toBe(2);
    });

    it('should handle concurrent loads gracefully', async () => {
      const testStore = new RecipeStore(defaultLoader);

      // Load concurrently
      await Promise.all([
        testStore.load(),
        testStore.load(),
        testStore.load()
      ]);

      const count = await testStore.getCount();
      expect(count).toBe(2);
    });
  });
});
