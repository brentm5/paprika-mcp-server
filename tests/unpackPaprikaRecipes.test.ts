import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { unpackPaprikaRecipes } from '../src/unpack/unpackPaprikaRecipes';

console.error = () => {}; // Suppress error output during tests

const FIXTURES = path.join(__dirname, 'fixtures', 'archive');
const FIXTURE_ARCHIVE = path.join(FIXTURES, 'export.paprikarecipes');
const FIXTURE_MISSING_UID = path.join(FIXTURES, 'missing-uid.paprikarecipes');
const FIXTURE_CORRUPT_ENTRY = path.join(FIXTURES, 'corrupt-entry.paprikarecipes');

describe('unpackPaprikaRecipes', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paprika-unpack-'));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  describe('happy path', () => {
    it('unpacks the fixture archive and writes one JSON file per recipe', async () => {
      const result = await unpackPaprikaRecipes(FIXTURE_ARCHIVE, outputDir);

      expect(result.errors).toHaveLength(0);
      expect(result.recipes).toHaveLength(2);
      expect(fs.readdirSync(outputDir)).toHaveLength(2);
    });

    it('returns uid and name for each unpacked recipe', async () => {
      const result = await unpackPaprikaRecipes(FIXTURE_ARCHIVE, outputDir);

      expect(result.recipes).toEqual(expect.arrayContaining([
        { uid: '03D38552-8562-46F9-BA8E-97D5D27ACE0C', name: 'Recipe 1' },
        { uid: '56B5F1BC-B382-444C-85A9-F2AFDD0A875E', name: 'Recipe 2' },
      ]));
    });

    it('writes files named <uid>.json containing the full recipe', async () => {
      await unpackPaprikaRecipes(FIXTURE_ARCHIVE, outputDir);

      const filePath = path.join(outputDir, '03D38552-8562-46F9-BA8E-97D5D27ACE0C.json');
      expect(fs.existsSync(filePath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(parsed.uid).toBe('03D38552-8562-46F9-BA8E-97D5D27ACE0C');
      expect(parsed.name).toBe('Recipe 1');
    });

    it('creates the output directory when it does not exist', async () => {
      const newDir = path.join(outputDir, 'nested', 'output');

      await unpackPaprikaRecipes(FIXTURE_ARCHIVE, newDir);

      expect(fs.existsSync(newDir)).toBe(true);
      expect(fs.readdirSync(newDir)).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('throws when the input file does not exist', async () => {
      await expect(
        unpackPaprikaRecipes('/nonexistent/path/file.paprikarecipes', outputDir)
      ).rejects.toThrow();
    });

    it('records entries missing a uid in errors and does not write a file for them', async () => {
      const result = await unpackPaprikaRecipes(FIXTURE_MISSING_UID, outputDir);

      expect(result.recipes).toEqual([{ uid: 'AAAAAAAA-0000-0000-0000-000000000001', name: 'Good Recipe' }]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('No UID field found');
      expect(fs.readdirSync(outputDir)).toHaveLength(1);
    });

    it('records corrupt entries in errors and continues processing valid ones', async () => {
      const result = await unpackPaprikaRecipes(FIXTURE_CORRUPT_ENTRY, outputDir);

      expect(result.recipes).toEqual([{ uid: 'AAAAAAAA-0000-0000-0000-000000000002', name: 'Valid Recipe' }]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Corrupt.paprikarecipe');
    });
  });
});
