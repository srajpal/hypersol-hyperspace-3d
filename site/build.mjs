// Builds the repository's site for GitHub Pages (the promotion plan's step
// 4, GitHub issue #91) into _site/: the HoloML viewer for ordinary browsers
// at /viewer/, and a short home page (the landing page of step 9, #96,
// fills it). Plain files: no framework, no analytics, nothing fetched from
// other sites by the pages themselves.
//
//   pnpm site:build          (builds the app, then: node site/build.mjs [folder])
//   node site/build.mjs <folder>
//
// The viewer is the app's own build of it (apps/browser/out/renderer/assets:
// viewer.js, the chunks it imports, and the decoders' WebAssembly), copied
// as HyperSpace 3D for Android copies it (apps/android/copy-viewer.mjs),
// with the host page and the KTX2 transcoder's page from site/viewer/.
// The folder is emptied first, so the builder takes only a folder that is
// not there yet, an empty one, or one it made before (it leaves a marker
// file), and never the repository or a folder of its sources.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SOURCE = join(ROOT, 'site');
const ASSETS = join(ROOT, 'apps/browser/out/renderer/assets');
/** The file the builder leaves in a folder it has made, so that it empties only folders of its own. */
export const MARKER = '.hyperspace3d-site';
/** The viewer's entry files; what they import, and the decoders' WebAssembly, follows them. The shell's own bundle, and the decoding frame for lifted models (lift-host.js), stay out. */
const ENTRIES = ['viewer.js', 'ktx2-host.js'];

/** The files the entries reach: each chunk a file imports (`./name-hash.js`), and the WebAssembly it names. */
function reached(assets) {
  const files = new Set(ENTRIES);
  const queue = [...ENTRIES];
  while (queue.length > 0) {
    const file = queue.shift();
    const text = readFileSync(join(assets, file), 'utf8');
    // A chunk is imported as "./name-hash.js"; the decoders' files are named as "name-hash.js" beside the viewer.
    for (const [, name] of text.matchAll(/["'`](?:\.\/)?([\w.-]+\.(?:js|wasm))["'`]/g)) {
      if (!files.has(name) && existsSync(join(assets, name))) {
        files.add(name);
        if (name.endsWith('.js')) queue.push(name);
      }
    }
  }
  return [...files];
}

export function build(folder = join(ROOT, '_site')) {
  const out = resolve(folder);
  for (const entry of ENTRIES) {
    if (!existsSync(join(ASSETS, entry))) throw new Error(`Build the browser first (pnpm build): ${entry} is copied from apps/browser/out/renderer/assets.`);
  }
  const root = resolve(ROOT);
  if (out === root || out === SOURCE || root.startsWith(out.endsWith(sep) ? out : `${out}${sep}`)) {
    throw new Error(`The site cannot be built into ${out}: it holds the repository or its sources.`);
  }
  if (existsSync(out) && readdirSync(out).length > 0 && !existsSync(join(out, MARKER))) {
    throw new Error(`${out} is not empty and was not made by this builder; choose another folder.`);
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'viewer', 'assets'), { recursive: true });
  writeFileSync(join(out, MARKER), 'Made by site/build.mjs of HyperSpace 3D; this folder is emptied on the next build.\n');
  // GitHub Pages would otherwise leave out folders and files that start with an underscore.
  writeFileSync(join(out, '.nojekyll'), '');
  cpSync(join(SOURCE, 'index.html'), join(out, 'index.html'));
  for (const file of readdirSync(join(SOURCE, 'viewer'))) cpSync(join(SOURCE, 'viewer', file), join(out, 'viewer', file));
  let bytes = 0;
  let files = 0;
  for (const file of reached(ASSETS)) {
    cpSync(join(ASSETS, file), join(out, 'viewer', 'assets', file));
    bytes += statSync(join(ASSETS, file)).size;
    files += 1;
  }
  return { out, files, bytes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { out, files, bytes } = build(process.argv[2]);
  console.log(`site built in ${out}: the viewer's ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}
