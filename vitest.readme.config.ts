import { defineConfig } from 'vitest/config';

// The README's screenshot, of real sites (owner, prompt 68):
// pnpm screenshots:readme. The only run that uses the network.
export default defineConfig({
  test: {
    include: ['tests/screenshots/readme.online.ts'],
    environment: 'node',
    testTimeout: 180_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
