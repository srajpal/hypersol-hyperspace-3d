import { defineConfig } from 'vitest/config';

// The README's screenshots (owner, prompts 68 and 99): pnpm screenshots:readme.
// Four views served locally (a sample page and HoloML's examples); no network.
export default defineConfig({
  test: {
    include: ['tests/screenshots/readme.capture.ts'],
    environment: 'node',
    testTimeout: 180_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
