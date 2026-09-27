import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChildProcess } from 'node:child_process';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';

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
  /** Save downloads here (test mode switch). */
  downloadsDir?: string;
  /** Act as if the system keychain were missing (test mode switch, milestone 9). */
  noKeychain?: boolean;
  /** How long a "minute" is for sleeping tabs (test mode switch, milestone 10). */
  sleepMinuteMs?: number;
  /** Start Chromium with WebGL switched off, as on a computer that cannot draw the room (milestone 12). */
  noWebGL?: boolean;
}

/**
 * Test windows stay in the background (off screen, never taking focus or
 * a taskbar button) so a run does not get in the way (owner request,
 * prompt 24). Set HYPERSOL_TEST_SHOW=1 to watch a run in normal windows.
 */
export const SHOW_WINDOWS = process.env['HYPERSOL_TEST_SHOW'] === '1';

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

/** Launches the built app with a throwaway profile and test hooks on. An empty start address opens a start tab. */
export async function launch(startUrl: string, opts: LaunchOptions = {}): Promise<Harness> {
  const keepProfile = opts.userDataDir !== undefined;
  const userDataDir = opts.userDataDir ?? (await mkdtemp(join(tmpdir(), 'hypersol-e2e-')));
  const args = [APP_DIR, `--start-url=${startUrl}`, `--hypersol-user-data=${userDataDir}`, OFFLINE_RULES];
  if (opts.tilt !== undefined) args.push(`--tilt=${opts.tilt}`);
  if (opts.searchUrl !== undefined) args.push(`--search-url=${opts.searchUrl}`);
  if (opts.filtersBase !== undefined) args.push(`--filters-base=${opts.filtersBase}`);
  if (opts.dnsProbe !== undefined) args.push(`--dns-probe=${opts.dnsProbe}`);
  if (opts.downloadsDir !== undefined) args.push(`--downloads-dir=${opts.downloadsDir}`);
  if (opts.noKeychain) args.push('--test-no-keychain');
  if (opts.sleepMinuteMs !== undefined) args.push(`--test-sleep-minute-ms=${opts.sleepMinuteMs}`);
  // Linux machines without a graphics card (GitHub's test machines) offer
  // only a software GL, which Chromium blocks for WebGL 2, so the room
  // cannot start. This lets Chromium draw WebGL with its own software
  // renderer instead; with a graphics card it changes nothing (milestone 12).
  if (opts.noWebGL) args.push('--test-no-webgl');
  else if (process.platform === 'linux') args.push('--enable-unsafe-swiftshader');
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
    .catch(loud);
  const errors: string[] = [];
  const output: string[] = [];
  const proc = app.process();
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
    } catch {
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
      // The app may already have quit on its own (quit checks).
      if (proc.exitCode === null && proc.signalCode === null) await app.close();
      // Electron can hold a file for a moment after closing; a leftover
      // temporary folder is harmless, so cleanup does not fail the run.
      if (!keepProfile) await removeFolder(userDataDir);
    },
  };
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

/** The read-only hooks the shell exposes in test runs (renderer/main.ts). */
export interface ShellHooks {
  ready: boolean;
  openPanel(): 'library' | 'settings' | 'downloads' | null;
  ignorePrepareClose(): void;
  frames(): number;
  drawsRoom(): boolean;
  holoml(): { fill: boolean; shown: boolean };
  showUrl(url: string): void;
  layout(): { panelWidth: number; panelHeight: number; cameraZ: number; viewportWidth: number; viewportHeight: number; rotationY: number };
  cameraOffset(): Point;
  parallaxPaused(): boolean;
  pointerLog(): { x: number; y: number; target: string; overPage: boolean }[];
  projectPagePoint(u: number, v: number): Point;
  panelQuad(): Point[];
  sceneColors(): Record<string, string>;
  status(): { state: string; url: string; title?: string; message?: string } | null;
  tabs(): TabInfo[];
  focusedTabId(): number;
  cardPoint(key: number | 'plus', part: 'body' | 'close' | 'audio'): Point | null;
  rail(): { scroll: number; maxScroll: number; fits: number };
  railVisible(): boolean;
  animating(): boolean;
  webContentsIdOf(tabId: number): number | null;
  shield(): { count: number; disabled: boolean; open: boolean };
  layersOf(tabId: number): boolean;
  theme(): string;
  zoom(): { factor: number; label: number };
  find(): { open: boolean; matches: number; active: number };
  prints(): number;
  prompts(): {
    permission: { id: number; webContentsId: number; origin: string; kinds: string[] } | null;
    offer: { id: number; origin: string; username: string; update: boolean; insecure: boolean; problem?: string } | null;
  };
  accessOf(tabId: number): string[];
  closedCount(): number;
  sleepNow(): number;
  economy(): { on: boolean; pixelRatio: number; devicePixelRatio: number; frames: number };
  tabDisplay(): { scale: number; display: string; revealed: boolean; railVisible: boolean; strip: boolean };
  view(): { direction: number; margin: number; parallax: number };
  showSetting(id: string): Promise<boolean>;
  notice(): { text: string; kind: string; actions: { id: string; label: string }[] } | null;
  sitePanel(): { open: boolean; site: { origin: string; private: boolean; states: Record<string, string>; given: string[] } | null };
  downloads(): { id: number; filename: string; path: string; received: number; total: number; state: string }[];
  instruments(): {
    open: boolean;
    polling: boolean;
    parts: { readouts: boolean; gauges: boolean; console: boolean; network: boolean };
    page: { url: string; secure: boolean; loadMs: number; requests: number; bytes: number; blocked: number; failed: number; cert: { issuer: string; verification: string } | null; memoryKB: number } | null;
    net: number;
    console: string[];
    gauges: { tabs: number; fps: number; filtersAge: string; dns: string; clock: string; uptime: string };
  };
  tilt(): number;
  layers(): { on: boolean; images: { x: number; y: number; width: number; height: number; src: string; alt: string; kind: string }[] };
}

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  state: string;
  focused: boolean;
  hasSnapshot: boolean;
  hasFavicon: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  private: boolean;
  audible: boolean;
  muted: boolean;
  asleep: boolean;
}

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

export async function waitFor<T>(
  what: string,
  probe: () => Promise<T>,
  ok: (value: T) => boolean,
  timeoutMs = 15_000,
): Promise<T> {
  const start = Date.now();
  let last: T | undefined;
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      last = await probe();
      if (ok(last)) return last;
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(
    `Timed out waiting for ${what}. Last value: ${JSON.stringify(last)}${
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
export async function waitForPage(h: Harness, page: PageRef): Promise<void> {
  await waitFor(
    `page ${JSON.stringify(page)} to load`,
    () => inPage<string>(h, 'document.readyState', page),
    (s) => s === 'complete',
  );
  await settled(h);
  await onScreen(h, page);
}

/** Waits until any switch animation has finished. */
export function settled(h: Harness): Promise<boolean> {
  return waitFor('switch animation to finish', () => shellCall(h, 'animating'), (a) => !a);
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
  await h.shell.mouse.move(p.x, p.y);
  await h.shell.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  await h.shell.mouse.click(p.x, p.y, options);
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
  await waitFor(
    'a press to reach the resized page',
    async () => {
      if ((await inPage<number>(h, 'window.__hsInputProbe', page)) > 0) return true;
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
}

/** Presses a key, with modifiers, inside a web page (see typeInPage). */
export async function pressInPage(
  h: Harness,
  keyCode: string,
  modifiers: ('control' | 'shift' | 'alt' | 'meta')[] = [],
  page?: PageRef,
): Promise<void> {
  const target = page ?? (await focusedPage(h));
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
  await h.app.evaluate(
    ({ BrowserWindow }, { keyCode, modifiers }) => {
      const wc = BrowserWindow.getAllWindows()[0]!.webContents;
      wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
      wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    },
    { keyCode, modifiers },
  );
}

// ---- Top bar, tabs, and cards -------------------------------------------

export const ADDRESS = 'hs-toolbar [data-testid="address"]';

/** Types into the address bar and presses Enter. */
export async function navigateTo(h: Harness, text: string): Promise<void> {
  await h.shell.fill(ADDRESS, text);
  try {
    await h.shell.press(ADDRESS, 'Enter', { timeout: 10_000 });
  } catch (e) {
    // Rarely seen: the press waits and never happens. Record what still
    // answers, to find the cause.
    const within = <T>(p: Promise<T>) =>
      Promise.race([p.then((v) => JSON.stringify(v)), sleep(3000).then(() => 'no answer in 3 s')]).catch(
        (err: unknown) => `error: ${String(err)}`,
      );
    const shell = await within(h.shell.evaluate(() => [document.readyState, document.activeElement?.tagName ?? '']));
    const main = await within(h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length));
    const pages = await within(Promise.resolve(h.app.windows().map((w) => w.url().slice(0, 60))));
    throw new Error(`${String(e)}\nShell answers: ${shell}\nMain answers: ${main}\nWindows: ${pages}`);
  }
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
  for (let step = 0; (await focusedTab(h)).id !== id; step++) {
    if (step > (await tabs(h)).length) throw new Error(`Ctrl+Tab never reached tab ${id}`);
    const before = (await focusedTab(h)).id;
    await pressInShell(h, 'Tab', ['control']);
    await waitFor('the next tab in front', async () => (await focusedTab(h)).id, (f) => f !== before);
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
  // Hover first, as a person would, so the close button appears.
  await h.shell.mouse.move(p.x, p.y, { steps: 3 });
  await h.shell.mouse.click(p.x, p.y);
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
