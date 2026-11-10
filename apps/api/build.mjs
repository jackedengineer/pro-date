// Bundles the API and the push worker into self-contained ESM files for the production image.
// Workspace packages export TypeScript sources, so they are compiled into the bundle; the
// runtime image then needs only Node.js and `dist/`, with no node_modules or tsx.
import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { build } from 'esbuild';

const root = import.meta.dirname;
const outdir = join(root, 'dist');

await rm(outdir, { force: true, recursive: true });
await build({
  absWorkingDir: root,
  entryPoints: {
    server: 'src/server.ts',
    'notification-worker': 'src/notifications/notification-worker-main.ts',
    'bundle-smoke': 'src/bundle-smoke.ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outdir,
  outExtension: { '.js': '.mjs' },
  // Run with `node --enable-source-maps` so logged stack frames point at TypeScript sources.
  sourcemap: true,
  sourcesContent: false,
  legalComments: 'none',
  logLevel: 'info',
  // Optional native accelerators that pg and ws load inside try/catch when installed.
  external: ['pg-native', 'bufferutil', 'utf-8-validate'],
  // ES modules have no require, __filename or __dirname, but bundled CommonJS dependencies use
  // them at call time (Cloudinary reads its package.json path from __dirname). Provide all three.
  banner: {
    js: [
      "import { createRequire as __bundleCreateRequire } from 'node:module';",
      "import { fileURLToPath as __bundleFileURLToPath } from 'node:url';",
      "import { dirname as __bundleDirname } from 'node:path';",
      'const require = __bundleCreateRequire(import.meta.url);',
      'const __filename = __bundleFileURLToPath(import.meta.url);',
      'const __dirname = __bundleDirname(__filename);',
    ].join(' '),
  },
});

// Fail the build, and therefore the image, if bundled dependencies break when actually called.
const smoke = join(outdir, 'bundle-smoke.mjs');
const { stdout } = await promisify(execFile)(process.execPath, ['--enable-source-maps', smoke]);
process.stdout.write(stdout);
await rm(smoke);
await rm(`${smoke}.map`);
