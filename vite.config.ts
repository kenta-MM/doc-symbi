import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => ({
  plugins: [react()], server: { host: 'localhost' },
  preview: { host: 'localhost', port: 4173, strictPort: true },
  ...(mode === 'integration' ? { build: { outDir: '.test-build', rollupOptions: { input: ['index.html', 'tests/harness.html'] } } } : {}),
}));
