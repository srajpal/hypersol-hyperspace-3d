import { mkdtempSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, type ChildProcess } from 'node:child_process';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, afterEach } from 'vitest';
import type { TestLog } from '../../apps/browser/src/main/test-hooks';
import type { ShellTestHooks } from '../../apps/browser/src/renderer/main';

// No trailing separator: on Windows a backslash before the closing quote
// of a command-line argument escapes the quote and garbles every argument after it.
export const APP_DIR = resolve(fileURLToPath(new URL('../../apps/browser/', import.meta.url)));
const electronPath = createRequire(join(APP_DIR, 'package.json'))('electron') as unknown as string;

/**
 * Chromium switch for every test run: no host name resolves except this
 * machine, so nothing can leave it, and any other name reports "address
 * not found" at once. A few names point at this machine for the privacy
 * shield checks (milestone 4): a named test site (element hiding skips raw
 * IP addresses), a tracker only the refreshed test lists know, and two
 * well-known ad and tracker hosts, so a request the shield let through
 * would reach the local test server.
 */
export const OFFLINE_RULES =
  '--host-resolver-rules=MAP shop.test 127.0.0.1, MAP refreshed-tracker.test 127.0.0.1, MAP ad.doubleclick.net 127.0.0.1, MAP www.google-analytics.com 127.0.0.1, MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost';

export interface Point {
  x: number;
  y: number;
}

export interface Harness {
  app: ElectronApplication;
  /** The app's process, kept from launch: Playwright's handle goes once the app exits. */
  proc: ChildProcess;
  shell: Page;
  /** console.error output and uncaught errors from the shell and main process. */
  errors: string[];
  close(): Promise<void>;
}

export interface LaunchOptions {
  tilt?: number;
  /** Search address with %s (a local stand-in for DuckDuckGo). */
  searchUrl?: string;
  /**
   * An existing profile folder to use and keep, for checks that restart
   * the app. By default each launch gets a fresh folder that is deleted.
   */
  userDataDir?: string;
  /** Keep running when the last window closes, as on macOS (test mode switch). */
  keepRunning?: boolean;
  /** Download filter lists from this local address, and refresh them on schedule. */
  filtersBase?: string;
  /** A local stand-in for the encrypted DNS resolver's reachability check. */
  dnsProbe?: string;
  /** The start panel's HoloML showroom link goes to this local copy (milestone 16). */
  showroomUrl?: string;
  /** Every HoloML example from local copies under this address (milestone 17). */
  examplesBase?: string;
  /** Save downloads here (test mode switch). */
  downloadsDir?: string;
  /** Act as if the system keychain were missing (test mode switch, milestone 9). */
  noKeychain?: boolean;
  /** How long a "minute" is for sleeping tabs (test mode switch, milestone 10). */
  sleepMinuteMs?: number;
  /** Start Chromium with WebGL switched off, as on a computer that cannot draw the room (milestone 12). */
  noWebGL?: boolean;
  /**
   * Remember the window's size as a normal run does (test mode switch).
   * Without it a test window is 1280 by 800 whatever the profile holds.
   */
  rememberWindow?: boolean;
}

/**
 * Test windows stay in the background (off screen, never taking focus or
 * a taskbar button) so a run does not get in the way (owner request,
 * prompt 24). Set HYPERSOL_TEST_SHOW=1 to watch a run in normal windows.
 */
export const SHOW_WINDOWS = process.env['HYPERSOL_TEST_SHOW'] === '1';

/**
 * Draw in software, as GitHub's Linux machines do (they have no graphics
 * card), on any machine: set HYPERSOL_TEST_SOFTWARE=1. For finding checks
 * that only pass with a graphics card; the frame-rate budgets are then
 * skipped, as there.
 */
export const SOFTWARE = process.env['HYPERSOL_TEST_SOFTWARE'] === '1';

/**
 * The graphics switches every test launch needs (the harness's, and the
 * development-run checks that start Electron themselves). Linux machines
 * without a graphics card (GitHub's) offer only a software GL, which
 * Chromium blocks for WebGL 2, so the room and HoloML scenes cannot start;
 * this lets Chromium draw WebGL with its own software renderer instead.
 * With a graphics card it changes nothing (milestone 12).
 */
export function graphicsSwitches(opts: { noWebGL?: boolean } = {}): string[] {
  if (opts.noWebGL) return ['--test-no-webgl'];
  if (SOFTWARE) return ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  return process.platform === 'linux' ? ['--enable-unsafe-swiftshader'] : [];
}

/**
 * Only the OS basics plus the test switches. The test runner's own
 * variables (NODE_OPTIONS and friends) must not leak into Electron's main
 * process.
 */
function cleanEnv(keepRunning = false): Record<string, string> {
  const keep = [
    'PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'windir', 'TEMP', 'TMP', 'TMPDIR',
    'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME', 'USER', 'LANG',
    // Linux displays: XAUTHORITY lets the app use a display that asks for
    // authorization, as the virtual one in automatic test runs does.
    'DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'XAUTHORITY',
    // Linux keychain: the secret service is reached over the session bus.
    'DBUS_SESSION_BUS_ADDRESS',
  ];
  const env: Record<string, string> = { HYPERSOL_TEST: '1' };
  if (!SHOW_WINDOWS) env['HYPERSOL_TEST_BACKGROUND'] = '1';
  if (keepRunning) env['HYPERSOL_TEST_KEEP_RUNNING'] = '1';
  for (const k of keep) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  return env;
}

/**
 * The apps launched here and not yet closed. Once every one of them has
 * gone, a wait whose question is refused stops at once: a dead app
 * refuses every question, and asking it for the full time only hides
 * what happened.
 */
const launched = new Set<ChildProcess>();

/** How a process ended, or null while it runs. */
function ended(proc: ChildProcess): string | null {
  if (proc.exitCode !== null) return `exit code ${proc.exitCode}`;
  if (proc.signalCode !== null) return `signal ${proc.signalCode}`;
  return null;
}

/** How the app ended, once every app launched here has; null while one runs, or before any was launched. */
function appGone(): string | null {
  if (launched.size === 0) return null;
  const ends = [...launched].map(ended);
  return ends.every((e) => e !== null) ? ends.join(', ') : null;
}

/** Thrown by a wait when the app's process has ended: nothing more can come of waiting. */
export class AppGone extends Error {}

/**
 * Closes an app however it is: asked first, and ended if it has not gone
 * within ten seconds. On Windows the process started is a command shell
 * with the app under it (Playwright starts Electron through one there),
 * and ending that alone would leave the app running: the whole tree goes.
 */
async function closeApp(app: ElectronApplication, proc: ChildProcess): Promise<void> {
  if (ended(proc) !== null) return;
  await Promise.race([app.close(), sleep(10_000)]).catch(() => undefined);
  if (ended(proc) !== null) return;
  if (process.platform === 'win32' && proc.pid !== undefined) {
    try {
      execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // Gone in the meantime.
    }
  } else {
    proc.kill('SIGKILL');
  }
}

/** Launches the built app with a throwaway profile and test hooks on. An empty start address opens a start tab. */
export async function launch(startUrl: string, opts: LaunchOptions = {}): Promise<Harness> {
  const keepProfile = opts.userDataDir !== undefined;
  const userDataDir = opts.userDataDir ?? (await mkdtemp(join(tmpdir(), 'hypersol-e2e-')));
  const args = [APP_DIR, `--start-url=${startUrl}`, `--hypersol-user-data=${userDataDir}`];
  args.push(OFFLINE_RULES);
  if (opts.tilt !== undefined) args.push(`--tilt=${opts.tilt}`);
  if (opts.searchUrl !== undefined) args.push(`--search-url=${opts.searchUrl}`);
  if (opts.filtersBase !== undefined) args.push(`--filters-base=${opts.filtersBase}`);
  if (opts.dnsProbe !== undefined) args.push(`--dns-probe=${opts.dnsProbe}`);
  if (opts.showroomUrl !== undefined) args.push(`--showroom-url=${opts.showroomUrl}`);
  if (opts.examplesBase !== undefined) args.push(`--examples-base=${opts.examplesBase}`);
  if (opts.downloadsDir !== undefined) args.push(`--downloads-dir=${opts.downloadsDir}`);
  if (opts.noKeychain) args.push('--test-no-keychain');
  if (opts.rememberWindow) args.push('--test-remember-window');
  if (opts.sleepMinuteMs !== undefined) args.push(`--test-sleep-minute-ms=${opts.sleepMinuteMs}`);
  args.push(...graphicsSwitches({ noWebGL: opts.noWebGL }));
  // Without a desktop session, Chromium would pick its fixed-key password
  // store, which the app counts as no keychain; the password checks need
  // the real one, so ask for the secret service (GNOME Keyring) by name.
  if (process.platform === 'linux') args.push('--password-store=gnome-libsecret');
  // Launch failures are printed at once as well as thrown: a run stopped
  // early (as GitHub stops one at its time limit) never reaches the
  // summary where thrown errors appear (milestone 12).
  const loud = (e: unknown): never => {
    console.error(`[harness] launch failed: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  };
  const app = await electron
    .launch({
      executablePath: electronPath,
      args,
      env: cleanEnv(opts.keepRunning),
      timeout: 30_000,
    })
    .catch(async (e: unknown) => {
      if (!keepProfile) await removeFolder(userDataDir);
      return loud(e);
    });
  const proc = app.process();
  launched.add(proc);
  // From here on the app is running. If a later step of launching fails,
  // the app is closed before the failure is passed on, so none is left
  // behind to run (and draw) for the rest of the job.
  try {
    const errors: string[] = [];
    const output: string[] = [];
    proc.stderr?.on('data', (d: Buffer) => output.push(d.toString()));
    app.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`main: ${msg.text()}`);
    });
    const shell = await app
      .firstWindow({ timeout: 30_000 })
      .catch((e: unknown) => loud(new Error(`No window appeared: ${String(e)}\nApp output:\n${output.join('')}`)));
    shell.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`shell: ${msg.text()}`);
    });
    shell.on('pageerror', (err) => errors.push(`shell: ${err.message}`));
    await shell
      .waitForFunction(() => (window as unknown as ShellWindow).__hypersolShellTest?.ready === true)
      .catch((e: unknown) => loud(new Error(`The shell never became ready: ${String(e)}\nApp output:\n${output.join('')}`)));
    // The real mouse must not take part: a cursor resting over the test
    // window sends its own pointer events, which move the parallax and the
    // card hover (found 2026-09-25 as the cause of occasional C3 and D4
    // failures). Test input comes in through Chromium and is unaffected.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setIgnoreMouseEvents(true));
    // The window must be showing before input is sent. In the background it
    // never takes focus (test input does not need it); when shown for
    // watching, wait for it to come to the front as a person's would.
    await waitFor(
      'the app window to show',
      () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false),
      (v) => v,
      10_000,
    );
    if (SHOW_WINDOWS) {
      const focused = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isFocused() ?? false);
      try {
        await waitFor('the app window to have focus', focused, (f) => f, 3000);
      } catch (e) {
        if (e instanceof AppGone) throw e;
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.focus());
        await waitFor('the app window to have focus', focused, (f) => f, 7000);
      }
    }
    return {
      app,
      proc,
      shell,
      errors,
      close: async () => {
        try {
          // The app may already have quit on its own (quit checks).
          if (ended(proc) === null) await app.close();
        } finally {
          launched.delete(proc);
        }
        // Electron can hold a file for a moment after closing; a leftover
        // temporary folder is harmless, so cleanup does not fail the run.
        if (!keepProfile) await removeFolder(userDataDir);
      },
    };
  } catch (e) {
    await closeApp(app, proc);
    launched.delete(proc);
    if (!keepProfile) await removeFolder(userDataDir);
    throw e;
  }
}

/** Waits for the app's process to end; returns how long that took, in ms. */
export async function waitForExit(h: Harness, timeoutMs: number): Promise<number> {
  const start = Date.now();
  const proc = h.proc;
  if (proc.exitCode !== null || proc.signalCode !== null) return 0;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`The app was still running after ${timeoutMs} ms`)), timeoutMs);
    proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  return Date.now() - start;
}

/** Deletes a temporary folder, retrying while Electron releases its files. */
export async function removeFolder(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(() => undefined);
}

/** Temporary folders made for a file's checks, deleted when the file is done. */
const folders: string[] = [];

/**
 * A new temporary folder whose name starts with `prefix`, deleted when
 * the file's checks are done. Settings, if given, are saved in it as the
 * app's settings file, for a folder used as a profile.
 */
export function newFolder(prefix: string, settings?: object): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  folders.push(dir);
  if (settings) writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings));
  return dir;
}

/**
 * A new profile folder for checks that restart the app, read its saved
 * files, or start from settings of their own (launch's userDataDir);
 * deleted when the file's checks are done.
 */
export function newProfile(settings?: object): string {
  return newFolder('hypersol-e2e-profile-', settings);
}

// Runs after the file's own afterAll hooks (the last registered runs
// first, and this module is loaded before the file's own code), so the
// apps that used the folders have closed.
afterAll(async () => {
  for (const dir of folders.splice(0)) await removeFolder(dir);
});

/** The parts of the main process's test log that can be read as they are (the others hold functions). */
type LogList = 'attaches' | 'requests' | 'blockedPopups' | 'dataOps' | 'dnsApplied' | 'opened' | 'refusedPermissions' | 'faviconEnds';

/**
 * Reads a part of the log the main process keeps in test runs
 * (apps/browser/src/main/test-hooks.ts, whose types also describe
 * globalThis.__hypersolTest for the checks that read it themselves).
 */
export function mainLog<K extends LogList>(h: Harness, part: K): Promise<TestLog[K]> {
  return h.app.evaluate((_electron, k) => globalThis.__hypersolTest![k], part) as Promise<TestLog[K]>;
}

/**
 * The read-only hooks the shell exposes in test runs, typed by the shell
 * itself (renderer/main.ts builds them and exports their type), so a
 * hook that changes there cannot go unnoticed here.
 */
export type ShellHooks = ShellTestHooks;

/** A tab as the shell's `tabs` hook describes it. */
export type TabInfo = ReturnType<ShellHooks['tabs']>[number];

export type ShellWindow = Window & { __hypersolShellTest: ShellHooks };

type HookFn = { [K in keyof ShellHooks]: ShellHooks[K] extends (...a: never[]) => unknown ? K : never }[keyof ShellHooks];

/** Calls one of the shell's test hooks by name. */
export function shellCall<K extends HookFn>(
  h: Harness,
  name: K,
  ...args: Parameters<ShellHooks[K]>
): Promise<Awaited<ReturnType<ShellHooks[K]>>> {
  return h.shell.evaluate(
    ([name, args]) => {
      const k = (window as unknown as ShellWindow).__hypersolShellTest as unknown as Record<
        string,
        (...a: unknown[]) => unknown
      >;
      return k[name]!(...args);
    },
    [name, args] as [string, unknown[]],
  ) as Promise<Awaited<ReturnType<ShellHooks[K]>>>;
}

/** A web page, by part of its address or by web contents id. */
export type PageRef = string | { id: number };

/** Runs JavaScript inside a web page (a webview guest). An address part picks the newest match. */
export async function inPage<T>(h: Harness, expression: string, page: PageRef = ''): Promise<T> {
  return h.app.evaluate(
    async ({ webContents }, { expression, page }) => {
      const guests = webContents
        .getAllWebContents()
        .filter(
          (w) =>
            w.getType() === 'webview' &&
            (typeof page === 'string' ? w.getURL().includes(page) : w.id === page.id),
        );
      const guest = guests[guests.length - 1];
      if (!guest) throw new Error(`No web page matching ${JSON.stringify(page)}`);
      return guest.executeJavaScript(expression, true);
    },
    { expression, page },
  ) as Promise<T>;
}

/** The focused tab's web page. */
export async function focusedPage(h: Harness): Promise<{ id: number }> {
  const tabId = await shellCall(h, 'focusedTabId');
  const id = await shellCall(h, 'webContentsIdOf', tabId);
  if (id === null) throw new Error('The focused tab has no web page');
  return { id };
}

/** A value for a message: as JSON, cut to a line or two. */
function shown(value: unknown): string {
  let text: string | undefined;
  try {
    text = JSON.stringify(value);
  } catch {
    text = String(value);
  }
  text ??= String(value);
  return text.length > 600 ? `${text.slice(0, 600)}… (${text.length} characters)` : text;
}

/**
 * What the harness did last, for the message of a check that fails: a
 * check stopped at its time limit says only that, and a loop of key
 * presses or clicks leaves no other word of where it was. Each step has
 * when it began (on this process's clock), and how it ended.
 */
interface Step {
  at: number;
  what: string;
  /** How it ended; while it is still going on, null. */
  end: string | null;
}
const steps: Step[] = [];
const STEPS_KEPT = 14;

/** Notes a step of the harness; the returned function notes how it ended. */
function step(what: string): (end: string) => void {
  const s: Step = { at: Date.now(), what, end: null };
  steps.push(s);
  if (steps.length > STEPS_KEPT) steps.shift();
  return (end) => {
    s.end = `${end} after ${Date.now() - s.at} ms`;
  };
}

// A check that failed says what the harness was doing when it ended; a
// step still going on then is what a check stopped at its time limit was
// waiting for. Each check starts with an empty list.
afterEach(({ task }) => {
  if (task.result?.state === 'fail' && steps.length > 0) {
    const now = Date.now();
    const line = (s: Step) => `  ${((s.at - now) / 1000).toFixed(1)} s: ${s.what}: ${s.end ?? 'STILL GOING ON when the check ended'}`;
    const open = steps.filter((s) => s.end === null);
    console.warn(
      `[harness] "${task.name}" failed. The harness's last steps (times from the check's end)${
        open.length > 0 ? `, ${open.length} still going on` : ''
      }:\n${steps.map(line).join('\n')}`,
    );
  }
  steps.length = 0;
});

export async function waitFor<T>(
  what: string,
  probe: () => Promise<T>,
  ok: (value: T) => boolean,
  timeoutMs = 15_000,
): Promise<T> {
  const start = Date.now();
  const done = step(`waiting for ${what}`);
  let last: T | undefined;
  let lastError: unknown;
  let asked = 0;
  while (Date.now() - start < timeoutMs) {
    asked++;
    try {
      last = await probe();
      if (ok(last)) {
        done('came');
        return last;
      }
    } catch (e) {
      if (e instanceof AppGone) {
        done('the app had gone');
        throw e;
      }
      lastError = e;
      // The question was refused and the app's process has ended: no
      // answer will come, so stop now and say so.
      const gone = appGone();
      if (gone) {
        done('the app had gone');
        throw new AppGone(
          `The app's process has ended (${gone}): no answer will come (waiting for ${what}, ${Date.now() - start} ms in; last value ${shown(last)}; last error: ${String(e)})`,
        );
      }
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  done(`timed out, last value ${shown(last)}`);
  throw new Error(
    `Timed out after ${Date.now() - start} ms (asked ${asked} times) waiting for ${what}. Last value: ${JSON.stringify(last)}${
      lastError ? `; last error: ${String(lastError)}` : ''
    }`,
  );
}

const PAINTED = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))';

/**
 * Waits until the page's latest paint is on screen: two frames in the
 * page, then two frames in the shell, which composites the page into the
 * window. Input sent before the shell's frames is routed to the shell,
 * not the page (found 2026-09-25; the cause of the intermittent C2 and
 * the lost first right-click in D8). A person cannot click in that
 * window either: nothing new has appeared yet.
 */
async function onScreen(h: Harness, page: PageRef): Promise<void> {
  await inPage(h, PAINTED, page);
  await h.shell.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
}

/**
 * Waits until a page has loaded and its paint is on screen, and any
 * switch animation has finished. Chromium ignores input to a page until
 * its first paint (so does Chrome), and "loaded" can come a moment
 * before that; a person cannot click what has not appeared yet.
 */
export async function waitForPage(h: Harness, page: PageRef, timeoutMs = 15_000): Promise<void> {
  await waitFor(
    `page ${JSON.stringify(page)} to load`,
    () => inPage<string>(h, 'document.readyState', page),
    (s) => s === 'complete',
    timeoutMs,
  );
  await settled(h);
  await onScreen(h, page);
}

/**
 * Starts watching for stalls: long tasks in the shell's page, gaps over
 * 60 ms in the main process's event loop, and a CPU profile of the shell.
 * The returned function stops and describes them, for the message of a
 * responsiveness check that fails (a slow answer on GitHub's machines
 * says where the time went, and in which of the shell's code).
 */
export async function watchStalls(h: Harness): Promise<() => Promise<string>> {
  const cdp = await h.shell.context().newCDPSession(h.shell);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
  await h.shell.evaluate(() => {
    const w = window as unknown as { __stalls?: { at: number; ms: number }[]; __stallWatch?: PerformanceObserver };
    w.__stallWatch?.disconnect();
    w.__stalls = [];
    w.__stallWatch = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__stalls!.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) });
    });
    w.__stallWatch.observe({ type: 'longtask' });
  });
  await h.app.evaluate(() => {
    const g = globalThis as unknown as { __gaps?: { at: number; ms: number }[]; __gapTimer?: ReturnType<typeof setInterval> };
    if (g.__gapTimer) clearInterval(g.__gapTimer);
    g.__gaps = [];
    let last = performance.now();
    g.__gapTimer = setInterval(() => {
      const now = performance.now();
      if (now - last > 60) g.__gaps!.push({ at: Math.round(last), ms: Math.round(now - last) });
      last = now;
    }, 10);
  });
  return async () => {
    const shell = await h.shell.evaluate(() => {
      const w = window as unknown as { __stalls?: { at: number; ms: number }[]; __stallWatch?: PerformanceObserver };
      w.__stallWatch?.disconnect();
      return w.__stalls ?? [];
    });
    const main = await h.app.evaluate(() => {
      const g = globalThis as unknown as { __gaps?: { at: number; ms: number }[]; __gapTimer?: ReturnType<typeof setInterval> };
      if (g.__gapTimer) clearInterval(g.__gapTimer);
      return g.__gaps ?? [];
    });
    const list = (xs: { at: number; ms: number }[]) => (xs.length ? xs.map((x) => `${x.ms} ms at ${x.at}`).join(', ') : 'none');
    // The shell's busiest code while watched: self time by function, idle left out.
    let busiest = 'no profile';
    try {
      const { profile } = await cdp.send('Profiler.stop');
      const self = new Map<number, number>();
      profile.samples?.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas?.[i] ?? 0)));
      const byName = new Map<string, number>();
      for (const n of profile.nodes) {
        const name = n.callFrame.functionName || '(anonymous)';
        if (name === '(idle)') continue;
        const key = `${name} ${n.callFrame.url.split('/').pop() ?? ''}:${n.callFrame.lineNumber}`;
        byName.set(key, (byName.get(key) ?? 0) + (self.get(n.id) ?? 0) / 1000);
      }
      busiest = [...byName.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k, ms]) => `${Math.round(ms)} ms ${k}`)
        .join(', ');
      await cdp.detach();
    } catch (e) {
      busiest = `no profile (${String(e)})`;
    }
    return `long tasks in the shell: ${list(shell)}; main process gaps over 60 ms: ${list(main)}; the shell's busiest code: ${busiest}`;
  };
}

/**
 * Holds a key down in a web page until what it does shows, then lets it
 * go: walking and turning in a HoloML scene go frame by frame, and drawn
 * in software frames come slowly, so a fixed hold can be over before the
 * scene has moved. Waits `sceneWait` long.
 */
export async function holdKeyUntil<T>(h: Harness, page: string, keyCode: string, what: string, read: () => Promise<T>, done: (v: T) => boolean, timeoutMs = 3000): Promise<T> {
  const send = (type: 'keyDown' | 'keyUp') =>
    h.app.evaluate(
      ({ webContents }, { page, keyCode, type }) => {
        const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop();
        guest?.sendInputEvent({ type, keyCode });
      },
      { page, keyCode, type },
    );
  await send('keyDown');
  try {
    return (await waitFor(`${what} (holding ${keyCode} down in ${page})`, read, done, await sceneWait(h, timeoutMs)))!;
  } finally {
    await send('keyUp');
  }
}

/** Waits until the page has drawn at least `count` more frames (a HoloML page's __holoml.frames). */
export async function framesDrawn(h: Harness, page: PageRef, count = 2, timeoutMs = 20_000): Promise<void> {
  const start = await inPage<number>(h, 'window.__holoml.frames', page);
  await waitFor(`${count} more frames`, () => inPage<number>(h, 'window.__holoml.frames', page), (n) => n >= start + count, timeoutMs);
}

/**
 * Waits until a HoloML scene is still, and returns its frame count: it
 * has drawn, no shaders are compiling, and the count holds. A scene draws
 * only when something changes, and new materials' shaders compile without
 * holding up the page, the scene drawn once they are ready (milestone 21),
 * so a page compiling is not yet idle. Checks that an idle page draws
 * nothing start from here.
 */
export async function sceneStill(h: Harness, page: PageRef, timeoutMs = 20_000): Promise<number> {
  let last = -1;
  return waitFor(
    'the scene drawn and still',
    async () => {
      const { frames, compiling } = await inPage<{ frames: number; compiling: boolean }>(
        h,
        '({ frames: window.__holoml.frames, compiling: window.__holoml.compiling === true })',
        page,
      );
      const still = frames > 0 && frames === last && !compiling;
      last = frames;
      await sleep(300);
      return still ? frames : -1;
    },
    (n) => n >= 0,
    timeoutMs,
  );
}

/**
 * How long to wait for something a HoloML scene does over time (a walker
 * landing, a turn): drawing in software, as on GitHub's machines, frames
 * come slowly and a walker's time runs slower than the clock (a frame
 * moves it at most 100 ms), so waits there are six times as long.
 */
export async function sceneWait(h: Harness, ms: number): Promise<number> {
  return (await softwareRenderer(h)) ? ms * 6 : ms;
}

/** Waits until any switch animation has finished. */
export function settled(h: Harness): Promise<boolean> {
  return waitFor('switch animation to finish', () => shellCall(h, 'animating'), (a) => !a);
}

/**
 * Waits until the room is still, and returns its frame count: no switch
 * animation, every loaded page's picture on its card, and no frame drawn
 * for a second and a half. The room draws only while something changes
 * (a page flying to its card, a spinner on a loading card, the camera
 * following the pointer), and once more when a card gets its picture,
 * which is taken 400 ms after the page has loaded and takes as long as
 * the machine needs. Checks that an idle room draws nothing start from
 * here, as a HoloML scene's start from sceneStill; their own measuring
 * time follows, and a room that kept drawing would never get this far.
 */
export async function roomStill(h: Harness, timeoutMs = 20_000): Promise<number> {
  const QUIET_MS = 1500;
  let last = -1;
  let since = Date.now();
  return waitFor(
    `the room still (no switch animation, a picture on every loaded page's card, no frame drawn for ${QUIET_MS} ms)`,
    async () => {
      const [animating, frames, all] = [await shellCall(h, 'animating'), await shellCall(h, 'frames'), await tabs(h)];
      if (frames !== last) {
        last = frames;
        since = Date.now();
      }
      const pictured = all.every((t) => t.state !== 'loaded' || t.asleep || t.hasSnapshot);
      return !animating && pictured && Date.now() - since >= QUIET_MS ? frames : -1;
    },
    (n) => n >= 0,
    timeoutMs,
  );
}

/**
 * Waits until the app has dealt with everything a page had sent it up to
 * now, and the shell and the page have what the app sent them because of
 * it. For checks that something does NOT happen: a sleep proves nothing
 * on a slow machine, where the thing may simply not have happened yet.
 *
 * Messages between a page and the app, and between the app and the
 * shell, keep their order. So: the page's own waiting timers run (the
 * list of saved sign-ins is asked for on a timer set by the click), and
 * the page answers the app, after whatever it had sent before; then the
 * shell answers the app, after whatever the app had sent it before; then
 * the page answers once more, after the app's replies to it.
 */
export async function caughtUp(h: Harness, page: PageRef): Promise<void> {
  const done = step(`the app catching up with page ${JSON.stringify(page)}`);
  await inPage(h, 'new Promise((r) => setTimeout(() => r(true), 0))', page);
  await h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.executeJavaScript('true'));
  await inPage(h, 'true', page);
  done('caught up');
}

export function project(h: Harness, u: number, v: number): Promise<Point> {
  return shellCall(h, 'projectPagePoint', u, v);
}

/** Centre of an element inside the web page, in page pixels. */
export function pageCentre(h: Harness, selector: string, page: PageRef = ''): Promise<Point> {
  return inPage<Point>(
    h,
    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
    page,
  );
}

/** Screen point of an element inside the web page, through the 3D tilt. */
export async function screenPointOf(h: Harness, selector: string, page: PageRef = ''): Promise<Point> {
  const c = await pageCentre(h, selector, page);
  return project(h, c.x, c.y);
}

/**
 * Clicks at a screen point the way a person does: the pointer arrives and
 * rests for a frame, then the button goes down. Playwright's own click
 * moves and presses in the same instant; right after a page appears,
 * moves, or resizes, that first instant's events can be routed to the
 * shell instead of the page (found 2026-09-25, TODO.md C2). A pointer
 * that has already arrived is routed correctly.
 */
export async function clickAt(h: Harness, p: Point, options: { button?: 'left' | 'right' } = {}): Promise<void> {
  const done = step(`a ${options.button === 'right' ? 'right-' : ''}click at ${Math.round(p.x)},${Math.round(p.y)}`);
  await h.shell.mouse.move(p.x, p.y);
  await h.shell.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  await h.shell.mouse.click(p.x, p.y, options);
  done('sent');
}

/**
 * For failure messages: what the shell has at a screen point (the
 * element, and the page's webview box), and whether a second click there,
 * a second later, reaches the page. Tells a click that went to the wrong
 * element from one that was lost in routing (milestone 12, Linux).
 */
export async function describeMissedClick(h: Harness, p: Point, registered: () => Promise<boolean>): Promise<string> {
  const at = await h.shell.evaluate(([x, y]) => {
    const name = (el: Element | null) =>
      el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''}` : 'nothing';
    let el = document.elementFromPoint(x!, y!);
    const path = [name(el)];
    while (el?.shadowRoot) {
      const inner = el.shadowRoot.elementFromPoint(x!, y!);
      if (!inner || inner === el) break;
      path.push(name(inner));
      el = inner;
    }
    const views = [...document.querySelectorAll('webview')].map((v) => {
      const r = v.getBoundingClientRect();
      return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} ${getComputedStyle(v).transform.slice(0, 60)}`;
    });
    return `shell element at the point: ${path.join(' > ')}; webviews: ${views.join(' | ') || 'none'}`;
  }, [p.x, p.y]);
  await sleep(1000);
  await clickAt(h, p);
  await sleep(1000);
  return `${at}; a second click a second later ${(await registered()) ? 'reached the page' : 'was lost too'}`;
}

/**
 * Clicks at a page point until the click's effect shows (GitHub issue
 * #30). On GitHub's Linux machines a click sent right after a page
 * appears or changes sometimes never reaches it: nothing at all happens,
 * and a second click lands. A lost click has no effect, so clicking again
 * is safe; each retry is logged, so how often it happens stays visible.
 * For checks about what a click does; C2 checks delivery itself.
 */
export async function clickUntil(
  h: Harness,
  p: Point,
  what: string,
  done: () => Promise<boolean>,
  options: { button?: 'left' | 'right' } = {},
  /** More to say in the failure message, if every attempt fails. */
  explain?: () => Promise<string>,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    await clickAt(h, p, options);
    try {
      await waitFor(`${what} (click ${attempt} of 3 at ${Math.round(p.x)},${Math.round(p.y)})`, done, (v) => v, attempt < 3 ? 4000 : 15_000);
      return;
    } catch (e) {
      if (e instanceof AppGone) throw e;
      if (attempt >= 3) throw explain ? new Error(`${String(e)}
${await explain().catch((x: unknown) => `(no details: ${String(x)})`)}`) : e;
      await retried(h, 'clicks');
      console.warn(`[harness] ${what}: the click did not reach the page; clicking again (attempt ${attempt + 1})`);
    }
  }
}

/**
 * Moves the pointer to a screen point until the move's effect shows (a
 * hover), as clickUntil clicks: on GitHub's Linux machines a pointer move
 * can be lost as a click can (issue #30; C6's hover, 2026-09-28). A lost
 * move has no effect, so moving again is safe; between attempts the
 * pointer steps a pixel aside and comes back, so the page gets new moves.
 * Each retry is logged. For checks about what hovering does.
 */
export async function moveUntil(h: Harness, p: Point, what: string, done: () => Promise<boolean>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    await h.shell.mouse.move(p.x, p.y, { steps: 5 });
    try {
      await waitFor(`${what} (pointer move ${attempt} of 3 to ${Math.round(p.x)},${Math.round(p.y)})`, done, (v) => v, attempt < 3 ? 4000 : 15_000);
      return;
    } catch (e) {
      if (e instanceof AppGone || attempt >= 3) throw e;
      await retried(h, 'pointer moves');
      console.warn(`[harness] ${what}: the pointer's move did not reach the page; moving again (attempt ${attempt + 1})`);
      await h.shell.mouse.move(p.x + 1, p.y + 1);
    }
  }
}

/**
 * Input the harness sent again because the first had no effect (GitHub
 * issue #30, not yet explained), counted by kind. Each is logged where it
 * happens; one line at the end of each file gives the count, so a run's
 * log shows how often it happens, in which file, and on which system.
 */
const retries = new Map<string, number>();
/** What the app drew with when input was first sent again: the software renderer's name, or a graphics card. */
let retriedWith: string | null = null;

async function retried(h: Harness, kind: 'clicks' | 'pointer moves' | 'presses after a resize'): Promise<void> {
  retries.set(kind, (retries.get(kind) ?? 0) + 1);
  retriedWith ??= await softwareRenderer(h).then((name) => (name ? `drawing in software (${name})` : 'drawing with a graphics card'), () => null);
}

afterAll(({}, suite) => {
  const total = [...retries.values()].reduce((a, b) => a + b, 0);
  const kinds = [...retries.entries()].map(([kind, n]) => `${kind} ${n}`).join(', ');
  console.log(
    `[harness] ${suite.name}: ${total} input retries${total > 0 ? ` (${kinds})` : ''} on ${process.platform}${retriedWith ? `, ${retriedWith}` : ''}`,
  );
});

/**
 * The WebGL renderer's name when Chromium draws in software (no graphics
 * card, as on GitHub's test machines), else null. Frame-rate budgets are
 * promises about graphics hardware: where this is not null they are
 * measured and logged, and skipped, not passed (owner, prompt 59: C9;
 * prompt 76: G9).
 */
export async function softwareRenderer(h: Harness): Promise<string | null> {
  const name = await h.shell.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  });
  return /swiftshader|llvmpipe|softpipe|basic render|warp/i.test(name) ? name : null;
}

/** Resizes the window's content area and waits for the page to follow. */
export async function setContentSize(h: Harness, width: number, height: number): Promise<void> {
  // Adjust the outer size until the inside is right: off screen, Electron's
  // setContentSize and the frame size it assumes are unreliable (1280x800
  // came out 1296x839), so correct by the measured difference.
  const inner = () => h.shell.evaluate(() => [window.innerWidth, window.innerHeight]);
  for (let attempt = 0; attempt < 5; attempt++) {
    const [iw, ih] = await inner();
    if (iw === width && ih === height) break;
    const outer = await h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getBounds());
    await h.app.evaluate(
      ({ BrowserWindow }, [w, ht]) => BrowserWindow.getAllWindows()[0]!.setSize(w!, ht!),
      [outer.width + (width - iw!), outer.height + (height - ih!)],
    );
    await waitFor('the window to resize', inner, ([w2, h2]) => w2 !== iw || h2 !== ih, 2000).catch(() => undefined);
  }
  await waitFor(`window ${width}x${height}`, inner, ([w, ht]) => w === width && ht === height);
  // The room lays out again on the resize event, a frame after the size changes.
  const layout = await waitFor(
    'the room to lay out for the new size',
    () => shellCall(h, 'layout'),
    (l) => l.viewportWidth === width && l.viewportHeight === height,
  );
  const page = await focusedPage(h);
  await waitFor(
    'page to match the panel size',
    () => inPage<number[]>(h, '[window.innerWidth, window.innerHeight]', page),
    ([w, ht]) => w === layout.panelWidth && ht === layout.panelHeight,
  );
  // As after a load: wait until the resized page is on screen.
  await onScreen(h, page);
  // On screen is not yet reachable: on GitHub's Linux machines the first
  // click after a resize was lost while one a second later landed, even
  // after pointer moves had reached the page (milestone 12). So press on
  // an empty spot of the page (nothing but the page's background under
  // it) until the page sees the press.
  const spot = await inPage<[number, number] | null>(
    h,
    `(() => {
      const w = innerWidth, h = innerHeight;
      for (const [x, y] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6], [w / 2, h - 6], [w / 2, 6]]) {
        const el = document.elementFromPoint(x, y);
        if (el === document.body || el === document.documentElement) return [x, y];
      }
      return null;
    })()`,
    page,
  );
  if (!spot) return; // no empty spot on this page: nothing safe to press
  await inPage(h, `window.__hsInputProbe = 0; window.__hsProbeFn = () => { window.__hsInputProbe += 1; }; addEventListener('pointerdown', window.__hsProbeFn, true)`, page);
  const at = await project(h, spot[0], spot[1]);
  let presses = 0;
  await waitFor(
    'a press to reach the resized page',
    async () => {
      if ((await inPage<number>(h, 'window.__hsInputProbe', page)) > 0) return true;
      if (presses++ > 0) {
        await retried(h, 'presses after a resize');
        console.warn(`[harness] a press had not reached the resized page after 300 ms; pressing again (attempt ${presses})`);
      }
      await clickAt(h, at);
      await sleep(300);
      return (await inPage<number>(h, 'window.__hsInputProbe', page)) > 0;
    },
    (reached) => reached,
  );
  await inPage(h, `removeEventListener('pointerdown', window.__hsProbeFn, true)`, page);
}

/**
 * Types text into whatever has focus inside the web page.
 *
 * Playwright's keyboard enters at the shell window through the DevTools
 * protocol, and that path does not forward keys into a <webview> (tried
 * 2026-09-24; see TODO.md, C4). A real keyboard does reach the tilted
 * page (owner's manual check, 2026-09-25). So keys are delivered to the
 * page's own view here; the click that focuses the field still goes
 * through the window's real routing and hit-testing.
 */
export async function typeInPage(h: Harness, text: string, page: PageRef = ''): Promise<void> {
  const done = step(`typing ${text.length} characters into page ${JSON.stringify(page)}`);
  await h.app.evaluate(
    ({ webContents }, { text, page }) => {
      const guests = webContents
        .getAllWebContents()
        .filter(
          (w) =>
            w.getType() === 'webview' &&
            (typeof page === 'string' ? w.getURL().includes(page) : w.id === page.id),
        );
      const guest = guests[guests.length - 1];
      if (!guest) throw new Error(`No web page matching ${JSON.stringify(page)}`);
      for (const ch of text) {
        const key = ch === '\n' ? 'Enter' : ch;
        guest.sendInputEvent({ type: 'keyDown', keyCode: key });
        guest.sendInputEvent({ type: 'char', keyCode: ch === '\n' ? '\r' : ch });
        guest.sendInputEvent({ type: 'keyUp', keyCode: key });
      }
    },
    { text, page },
  );
  done('sent');
}

/** Presses a key, with modifiers, inside a web page (see typeInPage). */
export async function pressInPage(
  h: Harness,
  keyCode: string,
  modifiers: ('control' | 'shift' | 'alt' | 'meta')[] = [],
  page?: PageRef,
): Promise<void> {
  const target = page ?? (await focusedPage(h));
  const done = step(`pressing ${[...modifiers, keyCode].join('+')} in page ${JSON.stringify(target)}`);
  await h.app.evaluate(
    ({ webContents }, { keyCode, modifiers, target }) => {
      const guest = webContents
        .getAllWebContents()
        .filter(
          (w) =>
            w.getType() === 'webview' &&
            (typeof target === 'string' ? w.getURL().includes(target) : w.id === target.id),
        )
        .pop();
      if (!guest) throw new Error('No web page to press keys in');
      guest.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
      guest.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    },
    { keyCode, modifiers, target },
  );
  done('sent');
}

/**
 * Presses a key in the shell window through Electron's input path, which
 * is where the main process sees browser shortcuts. Playwright's keyboard
 * reaches the shell's page but skips that path, so it cannot test them.
 */
export async function pressInShell(
  h: Harness,
  keyCode: string,
  modifiers: ('control' | 'shift' | 'alt' | 'meta')[] = [],
): Promise<void> {
  const done = step(`pressing ${[...modifiers, keyCode].join('+')} in the shell`);
  await h.app.evaluate(
    ({ BrowserWindow }, { keyCode, modifiers }) => {
      const wc = BrowserWindow.getAllWindows()[0]!.webContents;
      wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
      wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    },
    { keyCode, modifiers },
  );
  done('sent');
}

// ---- Top bar, tabs, and cards -------------------------------------------

export const ADDRESS = 'hs-toolbar [data-testid="address"]';

/**
 * Types into the address bar and presses Enter.
 *
 * Filling the box leaves the keyboard in it. Enter then goes in through
 * Electron's input path, as pressInShell sends keys, and the box itself
 * says when the key has reached it: by then the app has started loading.
 *
 * Playwright's own press was used here until 2026-09-30. It comes back
 * only when Chromium has acknowledged the key going down and coming up,
 * and once, on GitHub's Windows machines, it had not come back after 10 s
 * though the key had been pressed and its page had loaded (F5, run
 * 36644065812). Pressing Enter moves the keyboard into the page, and a
 * key coming up there is a known way for that acknowledgement to be lost
 * (renderer/app.ts, focusPageAfterEnter); it could not be made to happen
 * on this computer, so the cause is not proved. Sent this way, nothing
 * waits on the acknowledgement.
 */
export async function navigateTo(h: Harness, text: string): Promise<void> {
  const done = step(`typing ${shown(text)} in the address bar and pressing Enter`);
  await h.shell.fill(ADDRESS, text);
  // Runs before the box's own handler; the answer waits a turn, so that
  // handler (which starts the load) has run by then.
  await h.shell.evaluate(() => {
    const w = window as unknown as { __hsEnterSeen?: Promise<boolean> };
    w.__hsEnterSeen = new Promise((resolve) => {
      const seen = (e: KeyboardEvent) => {
        const at = e.composedPath()[0];
        if (e.key !== 'Enter' || !(at instanceof Element) || at.getAttribute('data-testid') !== 'address') return;
        window.removeEventListener('keydown', seen, true);
        setTimeout(() => resolve(true), 0);
      };
      window.addEventListener('keydown', seen, true);
    });
  });
  await pressInShell(h, 'Enter');
  const within = <T>(p: Promise<T>, ms: number) => Promise.race([p, sleep(ms).then(() => `no answer in ${ms / 1000} s`)]);
  const seen = await within(
    h.shell.evaluate(() => (window as unknown as { __hsEnterSeen: Promise<boolean> }).__hsEnterSeen),
    10_000,
  ).catch((err: unknown) => `error: ${String(err)}`);
  if (seen === true) {
    done('Enter reached the box');
    return;
  }
  // Enter never reached the address box. Record what still answers, and
  // where the keyboard is, to find the cause.
  done(`Enter did not reach the box: ${String(seen)}`);
  const said = <T>(p: Promise<T>) => within(p.then((v) => JSON.stringify(v)), 3000).catch((err: unknown) => `error: ${String(err)}`);
  const shell = await said(
    h.shell.evaluate(() => {
      const a = document.activeElement;
      return [document.readyState, a?.tagName ?? '', a?.shadowRoot?.activeElement?.getAttribute('data-testid') ?? ''];
    }),
  );
  const main = await said(h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length));
  const pages = await said(Promise.resolve(h.app.windows().map((w) => w.url().slice(0, 60))));
  throw new Error(
    `Enter did not reach the address bar within 10 s of typing ${shown(text)} (${String(seen)})\nShell answers: ${shell}\nMain answers: ${main}\nWindows: ${pages}`,
  );
}

export function tabs(h: Harness): Promise<TabInfo[]> {
  return shellCall(h, 'tabs');
}

export async function focusedTab(h: Harness): Promise<TabInfo> {
  const tab = (await tabs(h)).find((t) => t.focused);
  if (!tab) throw new Error('No focused tab');
  return tab;
}

/**
 * Brings a tab to the front with Ctrl+Tab, one confirmed step at a time.
 * Pressing again before the last press has taken effect overshoots on a
 * slow machine (found on GitHub's Linux machines, milestone 12).
 */
export async function cycleToTab(h: Harness, id: number): Promise<void> {
  for (let pressed = 0; (await focusedTab(h)).id !== id; pressed++) {
    const all = await tabs(h);
    if (pressed > all.length) {
      throw new Error(
        `Ctrl+Tab never reached tab ${id} in ${pressed} presses. Tabs: ${all.map((t) => `${t.id}${t.focused ? ' (in front)' : ''}`).join(', ')}`,
      );
    }
    const before = (await focusedTab(h)).id;
    await pressInShell(h, 'Tab', ['control']);
    await waitFor(`the tab after ${before} in front (Ctrl+Tab ${pressed + 1}, on the way to tab ${id})`, async () => (await focusedTab(h)).id, (f) => f !== before);
  }
}

/** Closes the tab in front with Ctrl+W and waits until it is gone. */
export async function closeFocusedTab(h: Harness): Promise<void> {
  const { id } = await focusedTab(h);
  await pressInShell(h, 'W', ['control']);
  await waitFor(`tab ${id} closed`, () => tabs(h), (list) => !list.some((t) => t.id === id));
}

/** Clicks a tab card (or the "+" card), on its body or its close button. */
export async function clickCard(h: Harness, key: number | 'plus', part: 'body' | 'close' | 'audio' = 'body'): Promise<void> {
  // While a page flies to or from its card it can cover the cards; a
  // person waits for the motion to end.
  await settled(h);
  const p = await shellCall(h, 'cardPoint', key, part);
  if (!p) throw new Error(`Card ${key} is not showing`);
  // Noted with its place, so a check that fails after it says where the
  // click went (L3 once failed on GitHub's Linux machines with a new tab
  // in front after a click on a card's speaker; not seen again).
  const done = step(`a click on card ${key}'s ${part} at ${Math.round(p.x)},${Math.round(p.y)}`);
  // Hover first, as a person would, so the close button appears.
  await h.shell.mouse.move(p.x, p.y, { steps: 3 });
  await h.shell.mouse.click(p.x, p.y);
  done('sent');
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Shows the Settings section that holds a control (milestone 11: Settings
 * has sections, one page each), as a person would pick it from the list.
 * Settings must be open.
 */
export async function settingsTo(h: Harness, controlId: string): Promise<void> {
  const found = await shellCall(h, 'showSetting', controlId);
  if (!found) throw new Error(`No setting has the control ${controlId}`);
}
