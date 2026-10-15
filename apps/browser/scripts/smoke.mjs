// The smoke check of a packaged app (GitHub issue #92, RL2): Playwright
// starts the app that `pnpm package` made, with no test hooks (they are
// off in a packaged app), waits for its window, and reads its title and
// that the room's canvas is there; then closes it. It proves that the
// packaged app starts on this system, which the end-to-end checks never
// do, as they drive the built sources.
//
//   pnpm package:smoke           (node apps/browser/scripts/smoke.mjs)
//
// The app gets a throwaway profile: its data folder follows the
// system's own variable (APPDATA, XDG_CONFIG_HOME, or HOME), pointed at
// a temporary folder here, so a run never touches this computer's real
// profile (AGENTS.md rule 1). On Linux without a desktop, run it under
// xvfb-run.
import { _electron as electron } from 'playwright';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const RELEASE = resolve(here, '../../../release');
const EXECUTABLE = 'HyperSpace3D';

/** The packaged app's binary for this system, in release/. */
function findApp() {
  const folders = readdirSync(RELEASE).filter((f) => f.startsWith('HyperSpace 3D-') && f.includes(process.platform));
  if (folders.length === 0) throw new Error(`No packaged app in ${RELEASE}: run pnpm package first`);
  const dir = join(RELEASE, folders[0]);
  const binary =
    process.platform === 'win32'
      ? join(dir, `${EXECUTABLE}.exe`)
      : process.platform === 'darwin'
        ? join(dir, 'HyperSpace 3D.app', 'Contents', 'MacOS', EXECUTABLE)
        : join(dir, EXECUTABLE);
  if (!existsSync(binary)) throw new Error(`The packaged app's binary is not at ${binary}`);
  return binary;
}

const binary = findApp();
const profile = mkdtempSync(join(tmpdir(), 'hyperspace3d-smoke-'));
const env = { ...process.env };
if (process.platform === 'win32') env.APPDATA = profile;
else if (process.platform === 'darwin') env.HOME = profile;
else env.XDG_CONFIG_HOME = profile;

let app;
try {
  app = await electron.launch({ executablePath: binary, args: [], env, timeout: 60_000 });
  const window = await app.firstWindow({ timeout: 60_000 });
  const title = await window.title();
  // The room draws on a canvas; the start tab's panel is HTML beside it.
  const room = await window.evaluate(() => new Promise((r) => setTimeout(() => r(!!document.querySelector('canvas')), 2000)));
  console.log(`smoke: ${binary}\n  title: ${JSON.stringify(title)}\n  room canvas: ${room}`);
  if (!/HyperSpace 3D/.test(title)) throw new Error(`The window's title is not the browser's: ${JSON.stringify(title)}`);
  if (!room) throw new Error('The room did not draw: no canvas in the window');
  console.log('smoke: the packaged app starts, with its title and its room');
} finally {
  await app?.close().catch(() => undefined);
  rmSync(profile, { recursive: true, force: true });
}
