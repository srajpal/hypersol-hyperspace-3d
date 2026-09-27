import { defineConfig } from 'vitest/config';

// The pictures on the HoloML examples cards (milestone 17): pnpm screenshots:examples.
// From the local copies of the example sites; no network.
export default defineConfig({
  test: {
    include: ['tests/screenshots/examples.capture.ts'],
    environment: 'node',
    testTimeout: 180_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
