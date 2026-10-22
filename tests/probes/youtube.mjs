// A probe for GitHub issue #133, run by hand: not part of any check run.
// It needs the network (it loads one YouTube video, as the owner asked
// for the issue on 2026-10-21) and the built app (`pnpm build`).
//
//   node tests/probes/youtube.mjs [--empty-lists] [--seconds=60] [--profile=<folder>] [--show] [url]
//
// It starts the built app as a person would, with no automation (Playwright
// sets navigator.webdriver, and YouTube then stops every video after about
// 40 seconds, in a bare Electron window too), in a throwaway profile and
// off screen as the checks do. youtube-watch.mjs, loaded into the app's
// main process, prints the video's time every 2 s, how often it went back
// (a restart), YouTube's player state and any message it shows, and the
// page's console errors; this prints those, and anything the main process
// printed besides (listener warnings, unhandled rejections).
// --empty-lists: the blocker with no rules at all (the app's page scripts
// still included), to tell the blocker's part from the rest.
// --profile=<folder>: this profile, kept after the run, in place of a throwaway one (under the ignored
// userData/ folder, for example userData/youtube-probe). A fresh profile can meet Google's "unusual traffic"
// check in place of the video (the owner's Mac, 2026-10-21); a person passes it once with --show, and the
// probe's runs after keep its cookie. --empty-lists sets the profile's saved lists aside for its run and
// puts them back after.
// --show: the app in a normal window with the profile, and no watching, until the person quits it.
// --no-test-mode: watched as usual, but the app out of test mode (no HYPERSOL_TEST), so in a normal window on
// screen as a person runs it, with the filter lists refreshed as a dev run does.
// --dev: the app as `pnpm dev` runs it (electron-vite dev, the shell from Vite's server), in place of the built
// app; it builds the main process into out/ as a dev run does, so `pnpm build` again before a run without it.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const args = process.argv.slice(2);
const emptyLists = args.includes('--empty-lists');
const show = args.includes('--show');
const noTestMode = args.includes('--no-test-mode');
const dev = args.includes('--dev');
const kept = args.find((a) => a.startsWith('--profile='))?.slice(10);
const seconds = Number(args.find((a) => a.startsWith('--seconds='))?.slice(10) ?? 60);
const url = args.find((a) => !a.startsWith('--')) ?? 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
const appDir = join(repo, 'apps', 'browser');
const req = createRequire(join(appDir, 'package.json'));

const profile = kept ? resolve(kept) : mkdtempSync(join(tmpdir(), 'hypersol-youtube-probe-'));
mkdirSync(profile, { recursive: true });
if (!existsSync(join(profile, 'settings.json'))) {
  writeFileSync(join(profile, 'settings.json'), JSON.stringify({ layersOnOpen: false, filterRefresh: false }));
}
const savedLists = join(profile, 'filters');
const setAside = join(profile, 'filters.probe-set-aside');
if (kept && emptyLists && existsSync(savedLists)) renameSync(savedLists, setAside);
if (emptyLists && !show) {
  const { FiltersEngine } = req('@ghostery/adblocker');
  const filters = join(appDir, 'resources', 'filters');
  const scripts = JSON.parse(readFileSync(join(filters, 'starter.json'), 'utf8')).resources.sha256;
  const engine = FiltersEngine.parse('');
  engine.resources = FiltersEngine.deserialize(new Uint8Array(readFileSync(join(filters, 'starter.bin')))).resources;
  mkdirSync(join(profile, 'filters'));
  writeFileSync(join(profile, 'filters', 'engine.bin'), engine.serialize());
  writeFileSync(join(profile, 'filters', 'engine.json'), JSON.stringify({ updatedAt: Date.now(), urls: [], scripts }));
}

const env = show
  ? { ...process.env, HYPERSOL_TEST: '1' }
  : {
      ...process.env,
      ...(noTestMode ? {} : { HYPERSOL_TEST: '1', HYPERSOL_TEST_BACKGROUND: '1' }),
      HYPERSOL_PROBE_SECONDS: String(seconds),
      NODE_OPTIONS: `--import ${pathToFileURL(join(here, 'youtube-watch.mjs')).href}`,
    };
const appArgs = [`--start-url=${url}`, `--hypersol-user-data=${profile}`];
const child = dev
  ? spawn(process.execPath, [join(appDir, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'dev', '--', ...appArgs], { env, cwd: appDir })
  : spawn(req('electron'), [appDir, ...appArgs], { env });
let out = '';
child.stdout.on('data', (d) => (out += d.toString()));
child.stderr.on('data', (d) => (out += d.toString()));
if (show) console.log(`The app is open with the profile ${profile}; quit it when done.`);
const limit = show ? undefined : setTimeout(() => child.kill(), (seconds + 90) * 1000);
await new Promise((r) => child.on('exit', r));
clearTimeout(limit);
if (kept && emptyLists) {
  rmSync(savedLists, { recursive: true, force: true });
  if (existsSync(setAside)) renameSync(setAside, savedLists);
}
if (show) process.exit(0);
const lines = out.split('\n');
const probe = lines.filter((l) => l.startsWith('PROBE') || (!l.startsWith('PROBE') && out.indexOf('PROBE log:') >= 0 && out.indexOf(l) > out.indexOf('PROBE log:')));
console.log(`probe${emptyLists ? ' (blocker with no rules)' : ''}${noTestMode ? ' (no test mode)' : ''}${dev ? ' (dev run)' : ''}:`);
console.log(probe.join('\n').slice(0, 6000) || '(the app printed no probe lines)');
const rest = lines.filter((l) => !probe.includes(l)).join('\n').trim();
console.log('main process printed besides:\n' + (rest.slice(0, 4000) || '(nothing)'));
if (!kept) rmSync(profile, { recursive: true, force: true });
