import { defineConfig } from 'vitest/config';
import path from 'node:path';
// Separate from vite.config.js so the Base44 dev plugin is not loaded in unit tests.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { include: ['tests/**/*.test.js'], environment: 'node' },
});
