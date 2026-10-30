import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { aiPlugin } from './server/ai-plugin';
export default defineConfig(({ mode }) => ({
  plugins: [react(), aiPlugin(mode !== 'integration' && !process.argv.includes('.test-build') && process.env.DOCSYMBI_DISABLE_AI !== '1')], server: { host: 'localhost' },
  preview: { host: 'localhost', port: 4173, strictPort: true },
  ...(mode === 'integration' ? { build: { outDir: '.test-build', rollupOptions: { input: ['index.html', 'tests/harness.html'] } } } : {}),
}));
