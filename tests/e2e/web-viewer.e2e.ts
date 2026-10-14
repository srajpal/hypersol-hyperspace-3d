/**
 * The HoloML viewer for ordinary browsers (the promotion plan's step 4,
 * GitHub issue #91): checks WV1 to WV8 (TODO.md, "Issue #91"). The site is
 * built into tests/fixtures/web-viewer/ (site/build.mjs) and served from
 * 127.0.0.1 like every fixture, and a second server stands in for another
 * site. The host page opens in a plain window of the app's Electron:
 * Chromium with none of the browser's preloads, hooks, or sessions (a
 * partition of its own), off every display like the test windows, so the
 * page is what any browser gets. Firefox and Safari are checked by hand.
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIXTURES_DIR, startFixtureServer, type FixtureServer } from './fixture-server';
import { launch, waitFor, type Harness } from './harness';

const SITE_DIR = join(FIXTURES_DIR, 'web-viewer');

let server: FixtureServer;
let other: FixtureServer;
let h: Harness;

beforeAll(async () => {
  // The site as the workflow builds it (site/build.mjs), from the app's build that pnpm test:e2e made.
  execFileSync(process.execPath, [join(FIXTURES_DIR, '../../site/build.mjs'), SITE_DIR], { stdio: 'inherit' });
  server = await startFixtureServer();
  other = await startFixtureServer();
  h = await launch(server.url('form.html'));
}, 120_000);

afterAll(async () => {
  await h?.close();
  await server?.close();
  await other?.close();
  rmSync(SITE_DIR, { recursive: true, force: true });
});

/** The host page on the site, for a page's address (by its file: the fixture server does not map a folder to its index). */
const host = (page: string | null, on: FixtureServer = server) => `${on.url('web-viewer/viewer/index.html')}${page === null ? '' : `?page=${encodeURIComponent(page)}`}`;

/** Opens an address in a plain window (no preload, its own partition), off every display, and gives its id; `noWebGL` is the window without WebGL, as the app's tabs are switched off (main/security.ts). */
async function openPlain(app: Harness, url: string, noWebGL = false): Promise<number> {
  return app.app.evaluate(
    async ({ BrowserWindow, screen }, { url, noWebGL }) => {
      const right = Math.max(...screen.getAllDisplays().map((d) => d.bounds.x + d.bounds.width));
      const w = new BrowserWindow({
        x: right + 200,
        y: 0,
        width: 1024,
        height: 700,
        show: true,
        focusable: false,
        skipTaskbar: true,
        webPreferences: { partition: 'web-viewer-check', sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, webgl: !noWebGL },
      });
      // A load that fails is said so (the harness blocks every host but 127.0.0.1).
      await w.loadURL(url).catch((e: unknown) => {
        throw new Error(`The plain window could not load ${url}: ${e instanceof Error ? e.message : String(e)}`);
      });
      return w.id;
    },
    { url, noWebGL },
  );
}

/** What the plain window shows, for a failure's message. */
async function describePlain(app: Harness, id: number): Promise<string> {
  try {
    return await inPlain<string>(app, id, "JSON.stringify({ href: location.href, title: document.title, state: document.documentElement.dataset.state, note: document.getElementById('note')?.innerText.slice(0, 200) })");
  } catch (e) {
    return `not readable: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function inPlain<T>(app: Harness, id: number, expression: string): Promise<T> {
  return app.app.evaluate(
    ({ BrowserWindow }, { id, expression }) => {
      const w = BrowserWindow.fromId(id);
      if (!w) throw new Error(`No window ${id}`);
      return w.webContents.executeJavaScript(expression, true);
    },
    { id, expression },
  ) as Promise<T>;
}

async function closePlain(app: Harness, id: number): Promise<void> {
  await app.app.evaluate(({ BrowserWindow }, { id }) => BrowserWindow.fromId(id)?.destroy(), { id });
}

/** A key pressed in the plain window, as the browser would deliver it. */
async function keyInPlain(app: Harness, id: number, keyCode: string, modifiers: ('control' | 'shift')[] = []): Promise<void> {
  await app.app.evaluate(
    ({ BrowserWindow }, { id, keyCode, modifiers }) => {
      const wc = BrowserWindow.fromId(id)!.webContents;
      wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
      wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    },
    { id, keyCode, modifiers },
  );
}

/** A click on one of the bar's buttons in the plain window, by its id and centre (the centres are read with one fixed expression, so no value is built into code). */
async function clickInPlain(app: Harness, id: number, button: string): Promise<void> {
  const centres = await inPlain<Record<string, { x: number; y: number }>>(
    app,
    id,
    "Object.fromEntries([...document.querySelectorAll('#bar button')].filter((b) => !b.hidden).map((b) => { const r = b.getBoundingClientRect(); return [b.id, { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }]; }))",
  );
  const r = centres[button];
  if (!r) throw new Error(`No button "${button}" to click; the bar shows ${Object.keys(centres).join(', ') || 'none'}`);
  await app.app.evaluate(
    ({ BrowserWindow }, { id, x, y }) => {
      const wc = BrowserWindow.fromId(id)!.webContents;
      wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
      wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    },
    { id, x: r.x, y: r.y },
  );
}

const state = (id: number) => inPlain<string | undefined>(h, id, 'document.documentElement.dataset.state');
const noteText = (id: number) => inPlain<string>(h, id, "document.getElementById('note-title').textContent + ': ' + document.getElementById('note-text').textContent");
const noticeText = (id: number) => inPlain<string>(h, id, "document.getElementById('notice').textContent");

interface Facts {
  title: string;
  entryCount: number;
  problems: unknown[];
  error: unknown;
}
const facts = (id: number) => inPlain<Facts>(h, id, 'window.__holoml.scene()');

/** The requests a server got since a snapshot (paths with their queries). */
function hitsSince(on: FixtureServer, before: Map<string, number>): string[] {
  return [...on.hits].filter(([k, n]) => n > (before.get(k) ?? 0)).map(([k]) => k);
}

async function drawn(id: number, what: string): Promise<Facts> {
  await waitFor(`${what} drawn`, () => state(id), (s) => s === 'drawn' || s === 'refused', 45_000).catch(async (e: unknown) => {
    throw new Error(`${e instanceof Error ? e.message : String(e)}; the window shows ${await describePlain(h, id)}`);
  });
  expect(await state(id), `${what}: ${await describePlain(h, id)}`).toBe('drawn');
  return facts(id);
}

describe('WV1 to WV3: pages of the site, and of another site', () => {
  it('WV1 the showroom draws from the host page, and nothing is fetched beyond the site and the page', async () => {
    const before = new Map(server.hits);
    const id = await openPlain(h, host(server.url('holoml/showroom/index.holoml')));
    try {
      const f = await drawn(id, 'the showroom');
      expect(f.error).toBeNull();
      expect(f.problems).toEqual([]);
      expect(f.entryCount).toBeGreaterThan(5);
      expect(f.title).toBe('HoloML showroom');
      expect(await inPlain<string>(h, id, "document.getElementById('title').textContent")).toBe('HoloML showroom');
      expect(await inPlain<boolean>(h, id, "document.getElementById('bar').hidden")).toBe(false);
      // The browser's own start tab (form.html, and the icon the app fetches for its card) is not the host's doing.
      const got = hitsSince(server, before).filter((p) => p !== '/form.html' && p !== '/favicon.ico');
      expect(got.length).toBeGreaterThan(3);
      for (const path of got) expect(path, 'fetched from the site or the page only').toMatch(/^\/(web-viewer\/|holoml\/showroom\/)/);
      expect([...other.hits.keys()]).toEqual([]);
    } finally {
      await closePlain(h, id);
    }
  });

  it("WV2 a page of the site runs its script, from the page's own address", async () => {
    const id = await openPlain(h, host(server.url('holoml/script-basic.holoml')));
    try {
      await drawn(id, 'the script page');
      await waitFor('the script run', () => inPlain<boolean | undefined>(h, id, 'window.__probe?.ran'), (v) => v === true);
      expect(server.hits.get('/holoml/script-basic.js')).toBe(1);
      expect(await noticeText(id)).toBe('');
    } finally {
      await closePlain(h, id);
    }
  });

  it('WV3 a page of another site shows, without its script, and says so', async () => {
    const id = await openPlain(h, host(other.url('holoml/script-basic.holoml')));
    try {
      const f = await drawn(id, "the other site's page");
      expect(f.title).toBe('HoloML script');
      expect(f.entryCount).toBeGreaterThan(3);
      await waitFor('the notice', () => noticeText(id), (t) => t.includes('not run'));
      expect(await inPlain<unknown>(h, id, 'typeof window.__probe')).toBe('undefined');
      expect(other.hits.get('/holoml/script-basic.holoml')).toBe(1);
      expect(other.hits.get('/holoml/models/placeholder-car.gltf') ?? 0).toBeGreaterThan(0);
      expect(other.hits.has('/holoml/script-basic.js')).toBe(false);
    } finally {
      await closePlain(h, id);
    }
  });
});

describe('WV4: what the host refuses', () => {
  const refused = async (page: string | null, on: FixtureServer, expected: RegExp) => {
    const id = await openPlain(h, host(page, on));
    try {
      await waitFor(`refused: ${page}`, () => state(id), (s) => s === 'refused', 15_000);
      expect(await noteText(id)).toMatch(expected);
      expect(await inPlain<boolean>(h, id, "document.getElementById('note-help').hidden")).toBe(false);
    } finally {
      await closePlain(h, id);
    }
  };

  it('no page, not an address, a site over plain http, and a file', async () => {
    const before = new Map(other.hits);
    await refused(null, server, /No page was given/);
    await refused('not an address', server, /not a web address/);
    await refused('http://shop.test/room.holoml', server, /Only an https address/);
    await refused('file:///C:/rooms/room.holoml', server, /Only an https address/);
    expect(hitsSince(other, before)).toEqual([]);
  });

  it('a page that is not there, and one over 2 MB', async () => {
    await refused(server.url('holoml/not-there.holoml'), server, /answered 404/);
    await refused(server.url('holoml/gen/zeros.bin?bytes=3000000'), server, /larger than 2 MB/);
  });
});

describe('WV5 and WV6: the text view, Stop, and the keyboard', () => {
  it('WV5 Text view and Ctrl+Shift+V switch the text view; Stop and Escape stop a page still loading', async () => {
    const id = await openPlain(h, host(server.url('holoml/slow.holoml')));
    try {
      await waitFor('busy', () => inPlain<string | undefined>(h, id, 'document.documentElement.dataset.busy'), (v) => v === 'true', 30_000);
      expect(await inPlain<boolean>(h, id, "document.getElementById('stop').hidden")).toBe(false);
      await clickInPlain(h, id, 'text-view');
      await waitFor('the text view', () => inPlain<boolean>(h, id, "document.body.classList.contains('holoml-text-view')"), (v) => v === true);
      expect(await inPlain<string>(h, id, "document.getElementById('text-view').getAttribute('aria-pressed')")).toBe('true');
      await keyInPlain(h, id, 'V', ['control', 'shift']);
      await waitFor('3D again', () => inPlain<boolean>(h, id, "document.body.classList.contains('holoml-text-view')"), (v) => v === false);
      await keyInPlain(h, id, 'Escape');
      await waitFor('stopped by Escape', () => inPlain<string | undefined>(h, id, 'document.documentElement.dataset.busy'), (v) => v === 'false', 15_000);
      expect(await inPlain<boolean>(h, id, "document.getElementById('stop').hidden")).toBe(true);
    } finally {
      await closePlain(h, id);
    }
    const again = await openPlain(h, host(server.url('holoml/slow.holoml')));
    try {
      await waitFor('busy again', () => inPlain<string | undefined>(h, again, 'document.documentElement.dataset.busy'), (v) => v === 'true', 30_000);
      await clickInPlain(h, again, 'stop');
      await waitFor('stopped by the button', () => inPlain<string | undefined>(h, again, 'document.documentElement.dataset.busy'), (v) => v === 'false', 15_000);
    } finally {
      await closePlain(h, again);
    }
  });

  it('WV6 compressed models decode, through the transcoder page framed under its own policy', async () => {
    const id = await openPlain(h, host(server.url('holoml/compressed/index.holoml')));
    try {
      const f = await drawn(id, 'the compressed models');
      expect(f.problems).toEqual([]);
      expect(server.hits.get('/web-viewer/viewer/ktx2-host.html')).toBe(1);
      expect(server.hits.get('/holoml/compressed/ktx2-box.ktx2')).toBe(1);
    } finally {
      await closePlain(h, id);
    }
  });
});

describe('WV7: without WebGL 2', () => {
  it("the viewer's card says the page cannot be drawn, and the host's line says why", async () => {
    const id = await openPlain(h, host(server.url('holoml/showroom/index.holoml')), true);
    try {
      await waitFor(
        "the viewer's card",
        () => inPlain<string>(h, id, "document.querySelector('[data-testid=holoml-error]')?.innerText ?? ''"),
        (t) => t.includes("This computer can't draw 3D scenes"),
        30_000,
      ).catch(async (e: unknown) => {
        const body = await inPlain<string>(h, id, 'document.body.innerText.slice(0, 400)').catch(() => '?');
        throw new Error(`${e instanceof Error ? e.message : String(e)}; the window shows ${await describePlain(h, id)}; its text: ${JSON.stringify(body)}`);
      });
      expect(await inPlain<string>(h, id, "document.getElementById('notice').textContent")).toMatch(/no WebGL 2/);
      expect(await inPlain<boolean>(h, id, "document.getElementById('bar').hidden")).toBe(false);
    } finally {
      await closePlain(h, id);
    }
  });
});

describe('WV8: the site as built', () => {
  it('holds the home page, the host, the transcoder page, the viewer and its decoders, and not the shell', async () => {
    const { readdirSync, existsSync } = await import('node:fs');
    for (const file of ['index.html', '.nojekyll', 'viewer/index.html', 'viewer/host.js', 'viewer/ktx2-host.html', 'viewer/assets/viewer.js', 'viewer/assets/ktx2-host.js']) {
      expect(existsSync(join(SITE_DIR, file)), file).toBe(true);
    }
    const assets = readdirSync(join(SITE_DIR, 'viewer/assets'));
    expect(assets.some((f) => f.endsWith('.wasm')), 'the decoders').toBe(true);
    expect(assets).not.toContain('lift-host.js');
    expect(assets.filter((f) => f.startsWith('index-'))).toEqual([]);
    // The home page reaches the host.
    const id = await openPlain(h, server.url('web-viewer/index.html'));
    try {
      const home = await inPlain<string>(h, id, "document.querySelector('a[href=\"viewer/\"]')?.textContent ?? ''");
      expect(home).toMatch(/viewer/i);
    } finally {
      await closePlain(h, id);
    }
  });
});
