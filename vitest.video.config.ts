import { defineConfig } from 'vitest/config';

// The video and the GIF (the promotion plan's step 6, GitHub issue #93):
// pnpm screenshots:video records the takes with this file, and
// tests/screenshots/video-encode.mjs makes the WebM and the GIF from them.
export default defineConfig({
  test: {
    include: ['tests/screenshots/video.capture.ts'],
    environment: 'node',
    testTimeout: 600_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
