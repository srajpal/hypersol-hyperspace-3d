import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The room's page for HyperSpace 3D for Android (milestone 24), built into
// the app's assets (app/build/web-assets/room), served there from
// Android's own secure address for an app's files.
export default defineConfig({
  root: __dirname,
  base: './',
  build: {
    outDir: resolve(__dirname, 'app/build/web-assets/room'),
    emptyOutDir: true,
    // The page runs in Android's WebView, kept up to date by the Play Store; no older browser needs it.
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
});
