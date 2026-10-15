import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['**/*.test.ts'], exclude: ['**/node_modules/**', '**/*.int.test.ts'] } },
      {
        test: {
          name: 'integration',
          include: ['**/*.int.test.ts'],
          exclude: ['**/node_modules/**'],
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
