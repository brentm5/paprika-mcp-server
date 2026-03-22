import * as esbuild from 'esbuild';
import { builtinModules } from 'node:module';
import { copy } from 'esbuild-plugin-copy';
import * as fs from 'node:fs';
import * as path from 'node:path';

const { version } = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

/**
 * esbuild configuration for bundling the Paprika MCP Server
 *
 * This bundles the entire application into a single .cjs file for easier distribution.
 * We use CommonJS format because the project has "type": "module" in package.json,
 * and .cjs extension ensures Node.js treats it as CommonJS regardless of package.json.
 *
 * @lancedb/lancedb and apache-arrow (its peer dep) cannot be bundled because lancedb
 * uses native binaries. The copy plugin copies them into dist/node_modules so the
 * runtime can resolve them from alongside dist/index.cjs.
 */

const PNPM_STORE = 'node_modules/.pnpm';
const nativePkgName = `lancedb-${process.platform}-${process.arch}`;

// Read pnpm store once — all package lookups use this list
const pnpmDirs = fs.readdirSync(PNPM_STORE);
const nativePnpmDir = pnpmDirs.find(d => d.startsWith(`@lancedb+${nativePkgName}@`));
if (!nativePnpmDir) {
  console.error(`Native lancedb package not found for ${process.platform}-${process.arch}`);
  process.exit(1);
}
const lancedbPnpmDir = pnpmDirs.find(d => d.startsWith('@lancedb+lancedb@'));
const arrowPnpmDir = pnpmDirs.find(d => d.startsWith('apache-arrow@'));

const lancedbSrc = fs.realpathSync(path.join('node_modules', '@lancedb', 'lancedb'));
const nativeSrc = path.join(PNPM_STORE, nativePnpmDir, 'node_modules', '@lancedb', nativePkgName);

// Collect runtime deps of a pnpm-installed package by resolving its co-located
// node_modules — pnpm places all transitive deps alongside the package in the
// virtual store, so this captures the full closure without manual dep tracing.
function collectDeps(pnpmDir) {
  const nmRoot = path.join(PNPM_STORE, pnpmDir, 'node_modules');
  const deps = [];
  for (const entry of fs.readdirSync(nmRoot)) {
    if (entry.startsWith('.') || entry.startsWith('@lancedb')) continue;
    const full = path.join(nmRoot, entry);
    if (entry.startsWith('@')) {
      for (const child of fs.readdirSync(full)) {
        deps.push({ name: `${entry}/${child}`, src: fs.realpathSync(path.join(full, child)) });
      }
    } else {
      deps.push({ name: entry, src: fs.realpathSync(full) });
    }
  }
  return deps;
}

const runtimeDeps = [
  ...collectDeps(lancedbPnpmDir),
  ...collectDeps(arrowPnpmDir),
].filter((dep, i, all) => all.findIndex(d => d.name === dep.name) === i); // dedupe

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
    // LanceDB has native bindings that cannot be bundled — copied via plugin below
    '@lancedb/lancedb',
    'apache-arrow',
  ],
  plugins: [
    copy({
      resolveFrom: 'cwd',
      assets: [
        {
          // @lancedb/lancedb JS package
          from: [`${lancedbSrc}/**/*`],
          to: ['dist/node_modules/@lancedb/lancedb'],
        },
        {
          // Platform-specific native binding (e.g. lancedb-darwin-arm64)
          from: [`${nativeSrc}/**/*`],
          to: [`dist/node_modules/@lancedb/${nativePkgName}`],
        },
        // Runtime dependencies of @lancedb/lancedb and apache-arrow (peer dep)
        ...runtimeDeps.map(({ name, src }) => ({
          from: [`${src}/**/*`],
          to: [`dist/node_modules/${name}`],
        })),
      ],
      watch: false,
    }),
  ],
  banner: {
    js: '#!/usr/bin/env node\n',
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
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
