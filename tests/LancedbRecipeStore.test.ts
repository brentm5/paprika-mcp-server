import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { LancedbRecipeStore } from '../src/stores/LancedbRecipeStore';
import { FileSystemRecipeLoader } from '../src/loaders/FileSystemRecipeLoader';
import { MockRecipeLoader } from '../src/loaders/MockRecipeLoader';
import { Recipe } from '../src/models/recipe.js';

console.error = () => {}; // Suppress error output during tests

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'recipes');
const defaultLoader = new FileSystemRecipeLoader(FIXTURES_DIR);

describe('LancedbRecipeStore', () => {
  let store: LancedbRecipeStore;

  beforeEach(async () => {
    store = new LancedbRecipeStore(defaultLoader);
    await store.load();
  });

  afterEach(() => {
    store.destroy();
  });

  describe('load', () => {
    it('should load all recipes from loader', async () => {
      const count = await store.getCount();
      expect(count).toBe(6);
    });

    it('should handle empty recipe list', async () => {
      const emptyStore = new LancedbRecipeStore(new MockRecipeLoader([]));
      await expect(emptyStore.load()).resolves.not.toThrow();
      expect(await emptyStore.getCount()).toBe(0);
    });
  });

  describe('list', () => {
    it('should return all recipes', async () => {
      const recipes = await store.list();
      expect(recipes).toHaveLength(6);
      expect(recipes[0]).toHaveProperty('uid');
      expect(recipes[0]).toHaveProperty('name');
    });

    it('should return empty array when no recipes loaded', async () => {
      const emptyStore = new LancedbRecipeStore(new MockRecipeLoader([]));
      await emptyStore.load();
      expect(await emptyStore.list()).toEqual([]);
    });
  });

  describe('getByUid', () => {
    it('should retrieve recipe by uid', async () => {
      const recipe = await store.getByUid('03D38552-8562-46F9-BA8E-97D5D27ACE0C');
      expect(recipe).not.toBeNull();
      expect(recipe?.uid).toBe('03D38552-8562-46F9-BA8E-97D5D27ACE0C');
      expect(recipe?.name).toBe('Chicken Soup');
    });

    it('should return null for non-existent uid', async () => {
      expect(await store.getByUid('non-existent-uid')).toBeNull();
    });
  });

  describe('search', () => {
    describe('basic matching', () => {
      it('should match by recipe name', async () => {
        const results = await store.search('Carbonara');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Pasta Carbonara');
      });

      it('should be case-insensitive', async () => {
        const results = await store.search('chocolate');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Chocolate Lava Cake');
      });

      it('should return multiple matches for a shared term', async () => {
        // 'chicken' appears in Chicken Soup (name+ingredients) and Garlic Roasted Chicken (name+ingredients)
        const results = await store.search('chicken');
        const names = results.map(r => r.name);
        expect(names).toContain('Chicken Soup');
        expect(names).toContain('Garlic Roasted Chicken');
      });

      it('should return all soup recipes when searching soup', async () => {
        const results = await store.search('soup');
        const names = results.map(r => r.name);
        expect(names).toContain('Chicken Soup');
        expect(names).toContain('Lentil Vegetable Soup');
      });

      it('should return empty array for a term that matches nothing', async () => {
        expect(await store.search('quinoa')).toEqual([]);
      });

      it('should return all recipes for empty query', async () => {
        expect(await store.search('')).toHaveLength(6);
      });

      it('should return all recipes for whitespace query', async () => {
        expect(await store.search('   ')).toHaveLength(6);
      });
    });

    describe('field-specific searching', () => {
      it('should find a recipe by ingredient', async () => {
        const results = await store.search('pancetta', ['ingredients']);
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Pasta Carbonara');
      });

      it('should find recipes sharing an ingredient', async () => {
        // carrots appear in Chicken Soup and Beef Stew and Lentil Vegetable Soup
        const results = await store.search('carrots', ['ingredients']);
        const names = results.map(r => r.name);
        expect(names).toContain('Chicken Soup');
        expect(names).toContain('Beef Stew');
        expect(names).toContain('Lentil Vegetable Soup');
      });

      it('should find a recipe by category', async () => {
        const results = await store.search('italian', ['categories']);
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Pasta Carbonara');
      });

      it('should find all recipes in a shared category', async () => {
        const results = await store.search('dinner', ['categories']);
        const names = results.map(r => r.name);
        expect(names).toContain('Beef Stew');
        expect(names).toContain('Garlic Roasted Chicken');
        expect(names).toContain('Pasta Carbonara');
        expect(results.length).toBe(3);
      });

      it('should find recipes by description term', async () => {
        const results = await store.search('vegan', ['description']);
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Lentil Vegetable Soup');
      });

      it('should find a recipe by notes term', async () => {
        const results = await store.search('molten', ['notes']);
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Chocolate Lava Cake');
      });

      it('should search categories case-insensitively', async () => {
        const results = await store.search('VEGAN', ['categories']);
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Lentil Vegetable Soup');
      });
    });

    describe('field isolation', () => {
      it('should not match a term that only exists in another field', async () => {
        // 'pancetta' is only in ingredients, not in name
        expect(await store.search('pancetta', ['name'])).toEqual([]);
      });

      it('should not match a notes-only term when searching name', async () => {
        // 'molten' is only in notes of Chocolate Lava Cake
        expect(await store.search('molten', ['name'])).toEqual([]);
      });

      it('should not match a description-only term when searching ingredients', async () => {
        // 'vegan' is only in description of Lentil Vegetable Soup
        expect(await store.search('vegan', ['ingredients'])).toEqual([]);
      });

      it('should not match a category term when searching notes', async () => {
        expect(await store.search('italian', ['notes'])).toEqual([]);
      });
    });
  });

  describe('getCount', () => {
    it('should return correct count', async () => {
      expect(await store.getCount()).toBe(6);
    });

    it('should return 0 for empty store', async () => {
      const emptyStore = new LancedbRecipeStore(new MockRecipeLoader([]));
      await emptyStore.load();
      expect(await emptyStore.getCount()).toBe(0);
    });
  });

  describe('idempotent loading', () => {
    it('should not duplicate recipes on repeated sequential loads', async () => {
      const testStore = new LancedbRecipeStore(defaultLoader);
      await testStore.load();
      await testStore.load();
      await testStore.load();
      expect(await testStore.getCount()).toBe(6);
    });

    it('should not duplicate recipes on concurrent loads', async () => {
      const testStore = new LancedbRecipeStore(defaultLoader);
      await Promise.all([testStore.load(), testStore.load(), testStore.load()]);
      expect(await testStore.getCount()).toBe(6);
    });

    it('should upsert updated fields on reload', async () => {
      const recipes = await defaultLoader.load();
      const updated = recipes.map(r =>
        r.uid === '03D38552-8562-46F9-BA8E-97D5D27ACE0C'
          ? { ...r, name: 'Chicken Noodle Soup' }
          : r
      );
      const testStore = new LancedbRecipeStore(new MockRecipeLoader(updated));
      await testStore.load();

      expect(await testStore.getCount()).toBe(6);
      const recipe = await testStore.getByUid('03D38552-8562-46F9-BA8E-97D5D27ACE0C');
      expect(recipe?.name).toBe('Chicken Noodle Soup');
    });

    it('should append new recipes without removing existing ones', async () => {
      const newRecipe: Recipe = {
        uid: 'AAAAAAAA-0000-0000-0000-000000000001',
        name: 'Tomato Bisque',
        description: 'Creamy roasted tomato soup',
        ingredients: 'tomatoes\ncream\nbasil\ngarlic',
        categories: ['soup', 'vegetarian'],
      };

      const sharedDbPath = path.join(os.tmpdir(), `paprika-test-${randomUUID()}`);

      const firstStore = new LancedbRecipeStore(defaultLoader, sharedDbPath);
      await firstStore.load();
      expect(await firstStore.getCount()).toBe(6);

      const recipes = await defaultLoader.load();
      const secondStore = new LancedbRecipeStore(
        new MockRecipeLoader([...recipes, newRecipe]),
        sharedDbPath
      );
      await secondStore.load();

      expect(await secondStore.getCount()).toBe(7);
      expect(await secondStore.getByUid(newRecipe.uid)).not.toBeNull();
      for (const r of recipes) {
        expect(await secondStore.getByUid(r.uid)).not.toBeNull();
      }
    });
  });
});
