import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import * as unzipper from 'unzipper';

const gunzipAsync = promisify(gunzip);

interface PaprikaRecipe {
  uid: string;
  name: string;
  [key: string]: unknown;
}

export interface UnpackResult {
  recipes: Array<{ uid: string; name: string }>;
  errors: string[];
}

export async function unpackPaprikaRecipes(inputFile: string, outputDir: string): Promise<UnpackResult> {
  await mkdir(outputDir, { recursive: true });

  const result: UnpackResult = {
    recipes: [],
    errors: [],
  };

  const directory = await unzipper.Open.file(inputFile);

  for (const file of directory.files) {
    if (file.type === 'File' && file.path.endsWith('.paprikarecipe')) {
      try {
        const compressedData = await file.buffer();
        const decompressedData = await gunzipAsync(compressedData);
        const recipe: PaprikaRecipe = JSON.parse(decompressedData.toString('utf-8'));

        if (!recipe.uid) {
          result.errors.push(`Skipping ${file.path}: No UID field found`);
          continue;
        }

        const outputPath = join(outputDir, `${recipe.uid}.json`);
        await writeFile(outputPath, JSON.stringify(recipe, null, 2), 'utf-8');

        result.recipes.push({ uid: recipe.uid, name: recipe.name });
      } catch (error) {
        result.errors.push(`Error processing ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return result;
}
