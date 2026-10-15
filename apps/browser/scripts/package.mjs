// Packages the built browser as a portable zip for this system and
// processor (GitHub issue #92, the promotion plan's step 5; the owner,
// 2026-10-15: a portable zip, no installer, nothing signed, the profile
// where the app keeps it today). CONTRIBUTING.md, "Making your own
// build", says what a package needs; this is that, done:
//
//   pnpm package                 (pnpm build, then node apps/browser/scripts/package.mjs)
//   node apps/browser/scripts/package.mjs [--no-zip]
//
// 1. A staging folder, release/stage/, with only what the app needs at
//    run time: package.json (name, product name, version, main), out/
//    (the main process, the preloads, the shell, the viewer; every
//    package is bundled in), one package in node_modules (the shield's
//    page script, which the blocker reaches by name), resources/ (the
//    filter lists and the icons), and LICENSE, NOTICE, and THIRD-PARTY.md.
// 2. @electron/packager on it: the app as plain files (no asar: the main
//    process finds its preloads, the shell, the viewer, and its worker
//    threads by paths beside itself, and the shield reads the lists as
//    files), the icon set, and Electron's own binary for this system
//    downloaded by the packager (cached).
// 3. The folder zipped as HyperSpace3D-<version>-<system>-<processor>.zip
//    in release/, with its SHA-256 beside it.
import { packager } from '@electron/packager';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const APP = resolve(here, '..');
const ROOT = resolve(APP, '../..');
const RELEASE = join(ROOT, 'release');
const STAGE = join(RELEASE, 'stage');
const PRODUCT = 'HyperSpace 3D';
/** The binary's name, without a space, so paths stay plain. */
const EXECUTABLE = 'HyperSpace3D';
const SYSTEMS = { win32: 'windows', linux: 'linux', darwin: 'macos' };

const own = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8'));
const electronVersion = JSON.parse(readFileSync(join(APP, 'node_modules/electron/package.json'), 'utf8')).version;
const platform = process.platform;
const arch = process.arch;
const system = SYSTEMS[platform];
if (!system) throw new Error(`No package for ${platform}`);
if (!existsSync(join(APP, 'out/main/index.js'))) throw new Error('Build the browser first (pnpm build).');

// 1. The staging folder.
rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
writeFileSync(
  join(STAGE, 'package.json'),
  JSON.stringify(
    {
      name: 'hyperspace-3d',
      productName: PRODUCT,
      version: own.version,
      description: own.description,
      license: own.license,
      author: own.author,
      homepage: own.homepage,
      main: 'out/main/index.js',
    },
    null,
    2,
  ),
);
cpSync(join(APP, 'out'), join(STAGE, 'out'), { recursive: true });
cpSync(join(APP, 'resources'), join(STAGE, 'resources'), { recursive: true });
for (const file of ['LICENSE', 'NOTICE', 'THIRD-PARTY.md']) cpSync(join(ROOT, file), join(STAGE, file));
// One package is reached by name at run time: the shield's page script
// (@ghostery/adblocker-electron-preload), whose file the blocker resolves
// to register it as a preload. It and what it depends on go into the
// staging folder's node_modules, copied from pnpm's store (the symlinks
// followed), without their own node_modules or sources.
const resolveFrom = createRequire(join(APP, 'package.json'));
const copied = new Set();
function copyPackage(name, from = resolveFrom) {
  if (copied.has(name)) return;
  copied.add(name);
  const manifest = from.resolve(`${name}/package.json`);
  const dir = dirname(manifest);
  const meta = JSON.parse(readFileSync(manifest, 'utf8'));
  const to = join(STAGE, 'node_modules', name);
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'src' || entry.endsWith('.map')) continue;
    cpSync(join(dir, entry), join(to, entry), { recursive: true, dereference: true, filter: (p) => !p.endsWith('.map') });
  }
  for (const dep of Object.keys(meta.dependencies ?? {})) copyPackage(dep, createRequire(join(dir, 'package.json')));
}
copyPackage('@ghostery/adblocker-electron-preload');
console.log(`packages copied for run time: ${[...copied].join(', ')}`);

// 2. The packager.
const icon = join(APP, 'resources/icons', platform === 'win32' ? 'icon.ico' : platform === 'darwin' ? 'icon.icns' : 'icon.png');
const [dir] = await packager({
  dir: STAGE,
  out: RELEASE,
  name: PRODUCT,
  executableName: EXECUTABLE,
  appVersion: own.version,
  appCopyright: 'Copyright 2026 The HyperSpace 3D Authors',
  electronVersion,
  platform,
  arch,
  icon: existsSync(icon) ? icon : undefined,
  // Plain files, no asar: the main process reaches its preloads, the shell, and the viewer by paths beside
  // itself (join(__dirname, '../preload/...')), and its worker threads and the filter lists must be files;
  // an asar with only those folders unpacked breaks the paths (found by the smoke check, 2026-10-15).
  asar: false,
  overwrite: true,
  prune: false,
  // The packaged app says nothing of where it was built.
  extraResource: [],
  appBundleId: 'io.github.srajpal.hyperspace3d',
  appCategoryType: 'public.app-category.productivity',
  win32metadata: { CompanyName: 'The HyperSpace 3D Authors', ProductName: PRODUCT, FileDescription: PRODUCT, InternalName: EXECUTABLE },
});
// The licence files beside the app, as Apache 2.0 asks (and the lists' GPL text is inside, under resources/filters).
for (const file of ['LICENSE', 'NOTICE', 'THIRD-PARTY.md']) cpSync(join(ROOT, file), join(dir, file));
console.log(`packaged in ${dir}`);

// 3. The zip and its checksum.
if (!process.argv.includes('--no-zip')) {
  const zipName = `HyperSpace3D-${own.version}-${system}-${arch}.zip`;
  const zip = join(RELEASE, zipName);
  rmSync(zip, { force: true });
  if (platform === 'win32') {
    execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${dir}\\*' -DestinationPath '${zip}' -CompressionLevel Optimal`], { stdio: 'inherit' });
  } else if (platform === 'darwin') {
    // ditto keeps the app bundle's attributes and the executable bits.
    execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', dir, zip], { stdio: 'inherit' });
  } else {
    execFileSync('zip', ['-qr', zip, '.'], { cwd: dir, stdio: 'inherit' });
  }
  const hash = createHash('sha256').update(readFileSync(zip)).digest('hex');
  writeFileSync(`${zip}.sha256`, `${hash}  ${zipName}\n`);
  console.log(`zipped as ${zip} (${(readFileSync(zip).length / 1024 / 1024).toFixed(1)} MB), SHA-256 ${hash}`);
}
