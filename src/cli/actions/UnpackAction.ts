import { CommandLineAction, CommandLineFlagParameter, CommandLineStringParameter } from '@rushstack/ts-command-line';
import * as fs from 'fs';
import { unpackPaprikaRecipes } from '../../unpack/unpackPaprikaRecipes.js';

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

    if (!fs.existsSync(inputFile)) {
      console.error(`Error: Input file not found: ${inputFile}`);
      process.exit(1);
    }

    if (this._verbose.value) {
      console.log(`Unpacking ${inputFile}...`);
      console.log(`Output directory: ${outputDir}`);
    }

    try {
      const result = await unpackPaprikaRecipes(inputFile, outputDir);

      if (this._verbose.value) {
        for (const recipe of result.recipes) {
          console.log(`✓ Converted: ${recipe.uid}.json (${recipe.name})`);
        }
        for (const error of result.errors) {
          console.error(`✗ ${error}`);
        }
      }

      console.log(`\n✓ Unpacking complete!`);
      console.log(`  Processed: ${result.recipes.length} recipes`);
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.length}`);
      }
    } catch (error) {
      console.error('Error unpacking recipes:', error);
      process.exit(1);
    }
  }
}
