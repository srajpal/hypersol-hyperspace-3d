import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { VIEWER_DEPS } from './viewer-deps.mjs';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          // History searches and writes, off the main thread (milestone 10, GitHub issue #4).
          'history-worker': resolve(__dirname, 'src/main/storage/history-worker.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          // Bridge for the 3D shell.
          shell: resolve(__dirname, 'src/preload/shell.ts'),
          // Trusted preload for every web page (a stub until milestone 5).
          page: resolve(__dirname, 'src/preload/page.ts'),
        },
      },
    },
  },
  renderer: {
    // The viewer's imports, prepared at start in development runs (viewer-deps.mjs).
    optimizeDeps: { include: VIEWER_DEPS },
    build: {
      rollupOptions: {
        input: {
          // The 3D shell.
          index: resolve(__dirname, 'src/renderer/index.html'),
          // The HoloML viewer (milestone 14): served to HoloML pages as
          // hypersol-viewer://app/assets/viewer.js (main/holoml.ts).
          viewer: resolve(__dirname, 'src/viewer/main.ts'),
        },
        output: {
          entryFileNames: (chunk) => (chunk.name === 'viewer' ? 'assets/viewer.js' : 'assets/[name]-[hash].js'),
        },
      },
    },
  },
});
