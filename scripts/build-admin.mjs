import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { patchSelectors, patchGithub } from './cms-compat.mjs';

// Build the locked CMS and adapters together so they share one Redux store.
import { build } from 'esbuild';
export async function buildAdmin(output) {
  await build({
    entryPoints: [resolve('scripts/cms-entry.jsx')], outfile: resolve(output, 'admin/vendor/cms.js'),
    bundle: true, minify: true, mainFields: ['module', 'browser', 'main'],
    define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' },
    alias: { path: 'path-browserify' },
    loader: { '.css': 'css', '.svg': 'dataurl' },
    plugins: [{ name: 'decap-upload-paths', setup(build) {
      build.onLoad({ filter: /decap-cms-core[\\/]dist[\\/]esm[\\/]reducers[\\/]entries\.js$/ }, args => ({ contents: patchSelectors(readFileSync(args.path, 'utf8')), loader: 'js' }));
      build.onLoad({ filter: /decap-cms-backend-github[\\/]dist[\\/]esm[\\/]implementation\.js$/ }, args => ({ contents: patchGithub(readFileSync(args.path, 'utf8')), loader: 'js' }));
    } }]
  });
}
