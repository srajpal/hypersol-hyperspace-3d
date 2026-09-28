// The HoloML viewer's imports from Three.js's examples, which the shell
// does not use. In development runs (pnpm dev) the renderer's dev server
// serves the viewer too; it must prepare these at start, as it cannot find
// them from the shell's page, and preparing them later reloads the page
// under the viewer (found in milestone 17). electron.vite.config.ts and the
// development-run check (tests/e2e/m16.e2e.ts) use this list.
export const VIEWER_DEPS = [
  'three',
  'three/examples/jsm/loaders/GLTFLoader.js',
  'three/examples/jsm/utils/SkeletonUtils.js',
  'three/examples/jsm/environments/RoomEnvironment.js',
  'three/examples/jsm/controls/OrbitControls.js',
  'three/examples/jsm/loaders/HDRLoader.js',
];
