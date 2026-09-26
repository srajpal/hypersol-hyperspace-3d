import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

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
  renderer: {},
});
