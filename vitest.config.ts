import { defineConfig } from 'vitest/config';

// Unit tests: *.test.ts next to the code in each package and in the app.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    environment: 'node',
    // Vitest's own 5 s is too short for the tests that start a worker
    // thread or derive keys on GitHub's Windows machines, where
    // storage.test.ts and vault.test.ts each ran over it once.
    testTimeout: 20_000,
  },
});
