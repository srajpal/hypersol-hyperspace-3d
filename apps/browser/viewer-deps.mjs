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
  // Milestone 25: compressed models (viewer/decoders.ts).
  'three/examples/jsm/libs/meshopt_decoder.module.js',
];

// The Draco and KTX2 loaders find their decoders beside their own file
// (new URL('../libs/...', import.meta.url)). Prepared with the rest, they
// would be in the dev server's own folder (node_modules/.vite/deps), where
// those files are not, and every compressed model failed to load in a
// development run with a 404 (owner, prompt 194). Left out, the dev server
// serves them from three's own folder, beside their decoders.
export const VIEWER_UNPREPARED = [
  'three/examples/jsm/loaders/DRACOLoader.js',
  'three/examples/jsm/loaders/KTX2Loader.js',
];
