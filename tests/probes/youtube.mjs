// A probe for GitHub issue #133, run by hand: not part of any check run.
// It needs the network (it loads one YouTube video, as the owner asked
// for the issue on 2026-10-21) and the built app (`pnpm build`).
//
//   node tests/probes/youtube.mjs [--empty-lists] [--seconds=60] [url]
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
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const args = process.argv.slice(2);
const emptyLists = args.includes('--empty-lists');
const seconds = Number(args.find((a) => a.startsWith('--seconds='))?.slice(10) ?? 60);
const url = args.find((a) => !a.startsWith('--')) ?? 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
const appDir = join(repo, 'apps', 'browser');
const req = createRequire(join(appDir, 'package.json'));

const profile = mkdtempSync(join(tmpdir(), 'hypersol-youtube-probe-'));
writeFileSync(join(profile, 'settings.json'), JSON.stringify({ layersOnOpen: false, filterRefresh: false }));
if (emptyLists) {
  const { FiltersEngine } = req('@ghostery/adblocker');
  const filters = join(appDir, 'resources', 'filters');
  const scripts = JSON.parse(readFileSync(join(filters, 'starter.json'), 'utf8')).resources.sha256;
  const engine = FiltersEngine.parse('');
  engine.resources = FiltersEngine.deserialize(new Uint8Array(readFileSync(join(filters, 'starter.bin')))).resources;
  mkdirSync(join(profile, 'filters'));
  writeFileSync(join(profile, 'filters', 'engine.bin'), engine.serialize());
  writeFileSync(join(profile, 'filters', 'engine.json'), JSON.stringify({ updatedAt: Date.now(), urls: [], scripts }));
}

const env = {
  ...process.env,
  HYPERSOL_TEST: '1',
  HYPERSOL_TEST_BACKGROUND: '1',
  HYPERSOL_PROBE_SECONDS: String(seconds),
  NODE_OPTIONS: `--import ${pathToFileURL(join(here, 'youtube-watch.mjs')).href}`,
};
const child = spawn(req('electron'), [appDir, `--start-url=${url}`, `--hypersol-user-data=${profile}`], { env });
let out = '';
child.stdout.on('data', (d) => (out += d.toString()));
child.stderr.on('data', (d) => (out += d.toString()));
const limit = setTimeout(() => child.kill(), (seconds + 90) * 1000);
await new Promise((r) => child.on('exit', r));
clearTimeout(limit);
const lines = out.split('\n');
const probe = lines.filter((l) => l.startsWith('PROBE') || (!l.startsWith('PROBE') && out.indexOf('PROBE log:') >= 0 && out.indexOf(l) > out.indexOf('PROBE log:')));
console.log(`probe${emptyLists ? ' (blocker with no rules)' : ''}:`);
console.log(probe.join('\n').slice(0, 6000) || '(the app printed no probe lines)');
const rest = lines.filter((l) => !probe.includes(l)).join('\n').trim();
console.log('main process printed besides:\n' + (rest.slice(0, 4000) || '(nothing)'));
rmSync(profile, { recursive: true, force: true });
