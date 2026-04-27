import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ['exceljs'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
