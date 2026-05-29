import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // Default to node; client tests will override to jsdom or use it where needed
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
        perFile: true,
      },
      exclude: [
        'dist/**',
        'tests/**',
        'playground/**',
        'tsup.config.ts',
        'vitest.config.ts',
        'postcss.config.js',
        'tailwind.config.js',
      ],
    },
  },
});
