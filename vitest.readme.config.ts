import { defineConfig } from 'vitest/config';

// The README's screenshot (owner, prompt 68): pnpm screenshots:readme.
// HoloML's showroom, served locally (prompt 81, Q5 a); no network.
export default defineConfig({
  test: {
    include: ['tests/screenshots/readme.capture.ts'],
    environment: 'node',
    testTimeout: 180_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
