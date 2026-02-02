import { CommandLineAction, CommandLineFlagParameter, CommandLineStringParameter } from '@rushstack/ts-command-line';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import * as unzipper from 'unzipper';
import * as fs from 'fs';

const gunzipAsync = promisify(gunzip);

interface PaprikaRecipe {
  uid: string;
  name: string;
  [key: string]: unknown;
}

export class UnpackAction extends CommandLineAction {
  private _input!: CommandLineStringParameter;
  private _output!: CommandLineStringParameter;
  private _verbose!: CommandLineFlagParameter;

  public constructor() {
    super({
      actionName: 'unpack',
      summary: 'Unpack Paprika recipes archive',
      documentation: 'Extract .paprikarecipes archive to individual JSON files'
    });

    this._input = this.defineStringParameter({
      parameterLongName: '--input',
      parameterShortName: '-i',
      argumentName: 'FILE',
      description: 'Path to .paprikarecipes file to unpack',
      required: true
    });

    this._output = this.defineStringParameter({
      parameterLongName: '--output',
      parameterShortName: '-o',
      argumentName: 'DIR',
      description: 'Output directory for JSON files',
      required: true
    });

    this._verbose = this.defineFlagParameter({
      parameterLongName: '--verbose',
      parameterShortName: '-v',
      description: 'Enable verbose logging output'
    });
  }

  protected async onExecuteAsync(): Promise<void> {
    const inputFile = this._input.value!;
    const outputDir = this._output.value!;

    // Validate input file exists
    if (!fs.existsSync(inputFile)) {
      console.error(`Error: Input file not found: ${inputFile}`);
      process.exit(1);
    }

    if (this._verbose.value) {
      console.log(`Unpacking ${inputFile}...`);
      console.log(`Output directory: ${outputDir}`);
    }

    // Create output directory if it doesn't exist
    await mkdir(outputDir, { recursive: true });

    try {
      let processedCount = 0;
      let errorCount = 0;

      // Extract .paprikarecipes (zip file) and process each .paprikarecipe file
      const directory = await unzipper.Open.file(inputFile);

      for (const file of directory.files) {
        if (file.type === 'File' && file.path.endsWith('.paprikarecipe')) {
          try {
            // Extract the .paprikarecipe file content
            const compressedData = await file.buffer();

            // Gunzip to get JSON
            const decompressedData = await gunzipAsync(compressedData);
            const recipe: PaprikaRecipe = JSON.parse(decompressedData.toString('utf-8'));

            if (!recipe.uid) {
              console.error(`⚠️  Skipping ${file.path}: No UID field found`);
              errorCount++;
              continue;
            }

            // Write to output directory as <UID>.json
            const outputPath = join(outputDir, `${recipe.uid}.json`);
            await writeFile(outputPath, JSON.stringify(recipe, null, 2), 'utf-8');

            if (this._verbose.value) {
              console.log(`✓ Converted: ${file.path}`);
              console.log(`  → ${recipe.uid}.json (${recipe.name})`);
            }

            processedCount++;
          } catch (error) {
            console.error(`✗ Error processing ${file.path}:`, error);
            errorCount++;
          }
        }
      }

      console.log(`\n✓ Unpacking complete!`);
      console.log(`  Processed: ${processedCount} recipes`);
      if (errorCount > 0) {
        console.log(`  Errors: ${errorCount}`);
      }
    } catch (error) {
      console.error('Error unpacking recipes:', error);
      process.exit(1);
    }
  }
}
