// The HoloML viewer for HyperSpace 3D for Android (milestone 24): the
// desktop's own build of it (apps/browser/out/renderer/assets: viewer.js
// and the chunks it imports), copied into the app's assets, where the app
// answers a HoloML page's requests for it (HolomlPage.kt).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const from = join(here, '../browser/out/renderer/assets');
const to = join(here, 'app/build/web-assets/viewer/assets');
if (!existsSync(join(from, 'viewer.js'))) throw new Error('Build the browser first (pnpm build): its viewer is copied from apps/browser/out/renderer/assets.');
rmSync(join(here, 'app/build/web-assets/viewer'), { recursive: true, force: true });
mkdirSync(to, { recursive: true });
for (const file of readdirSync(from).filter((f) => f.endsWith('.js'))) cpSync(join(from, file), join(to, file));
console.log(`viewer copied to ${to}`);
