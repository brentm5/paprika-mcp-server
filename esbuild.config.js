import * as esbuild from 'esbuild';
import { builtinModules } from 'node:module';

/**
 * esbuild configuration for bundling the Paprika MCP Server
 *
 * This bundles the entire application into a single .cjs file for easier distribution.
 * We use CommonJS format because the project has "type": "module" in package.json,
 * and .cjs extension ensures Node.js treats it as CommonJS regardless of package.json.
 */
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/index.cjs',
  sourcemap: true,
  external: [
    // Mark all Node.js built-in modules as external (don't bundle them)
    ...builtinModules,
    ...builtinModules.map(m => `node:${m}`),
    // Optional dependencies from unzipper that we don't need
    '@aws-sdk/client-s3',
  ],
  banner: {
    js: '#!/usr/bin/env node\n',
  },
  minify: true,
  treeShaking: true,
  metafile: true,
}).then((result) => {
  console.log('✓ Build complete');
  if (result.metafile) {
    const analysis = esbuild.analyzeMetafileSync(result.metafile, {
      verbose: false,
    });
    console.log(analysis);
  }
}).catch(() => process.exit(1));
