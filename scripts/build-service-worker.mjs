import { build } from 'vite';
import { injectManifest } from 'workbox-build';
import { resolve } from 'node:path';
const output = resolve(process.argv[2] ?? 'dist');
await build({ configFile: false, publicDir: false, define: { 'process.env.NODE_ENV': '"production"' }, build: {
  outDir: output, emptyOutDir: false, minify: true,
  lib: { entry: resolve('src/offline/service-worker.ts'), name: 'DocSymbiWorker', formats: ['iife'], fileName: () => 'service-worker.js' },
} });
const result = await injectManifest({ swSrc: resolve(output, 'service-worker.js'), swDest: resolve(output, 'service-worker.js'), globDirectory: output,
  globPatterns: ['**/*.{html,js,css,svg,webmanifest}'], globIgnores: ['service-worker.js'], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
});
console.log(`Precached ${result.count} assets (${result.size} bytes).`);
for (const warning of result.warnings) console.warn(warning);
