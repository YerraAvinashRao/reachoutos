/**
 * Server Build Script for Vercel Deployment
 *
 * Bundles server.ts and ALL its dependencies into a single self-contained
 * ESM file at `api/index.js`.
 *
 * Single file = no import tracing issues on Vercel.
 *
 * Run via: node scripts/build-server.mjs
 * Called automatically by: npm run build (after vite build)
 */
import { build } from 'esbuild';
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const apiDir = path.join(root, 'api');
const tmpEntry = path.join(root, 'scripts', '_vercel_entry.ts');

if (!existsSync(apiDir)) {
  mkdirSync(apiDir, { recursive: true });
}

// Inline entry: imports app from server.ts and exports a Vercel handler
writeFileSync(tmpEntry, `
process.env.IS_SERVERLESS = '1';
import 'dotenv/config';
import { app } from '../server';

// Vercel serverless handler — default export
export default function handler(req, res) {
  let targetUrl = req.url || '';
  if (targetUrl.startsWith('/api?') || targetUrl === '/api' || targetUrl === '/api/' || !targetUrl.startsWith('/api/')) {
    try {
      const u = new URL(targetUrl, 'http://localhost');
      const p = u.searchParams.get('__path');
      if (p) {
        u.searchParams.delete('__path');
        const q = u.searchParams.toString();
        targetUrl = '/api/' + p + (q ? '?' + q : '');
      } else {
        const c = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.headers['x-original-url'];
        if (c && c.startsWith('/api') && c !== '/api' && c !== '/api/') {
          targetUrl = c;
        }
      }
    } catch (_) {}
  }
  req.url = targetUrl;
  return app(req, res);
}
`);

console.log('[build-server] Bundling server.ts → api/index.js (single ESM file)...');

try {
  await build({
    entryPoints: [tmpEntry],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    // Single self-contained output file — no separate chunks
    outfile: path.join(apiDir, 'index.js'),
    splitting: false,
    // Keep npm packages external (they exist in node_modules on Vercel)
    packages: 'external',
    sourcemap: false,
    minify: false,
    logLevel: 'info',
  });

  console.log('[build-server] ✓ api/index.js written — single file, no external source imports');
  console.log('[build-server] ✓ Ready for Vercel deployment');
} finally {
  try { unlinkSync(tmpEntry); } catch (_) {}
}
