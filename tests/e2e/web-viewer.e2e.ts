/**
 * The HoloML viewer for ordinary browsers (the promotion plan's step 4,
 * GitHub issue #91): checks WV1 to WV8 (TODO.md, "Issue #91"). The site is
 * built into tests/fixtures/web-viewer/ (site/build.mjs) and served from
 * 127.0.0.1 like every fixture, and a second server stands in for another
 * site. The host page opens in a plain window of the app's Electron:
 * Chromium with none of the browser's preloads, hooks, or sessions (a
 * partition of its own), off every display like the test windows, so the
 * page is what any browser gets. Firefox and Safari are checked by hand.
 * PG1 and PG2 (TODO.md, "holoml #58: the playground") check the viewer's
 * second way in, a page given by the frame's parent, as the playground
 * gives it (tests/fixtures/viewer-parent.html). WL1 to WL8 (TODO.md,
 * "Issue #125") follow links between HoloML pages there.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, parse } from '../../packages/holoml/src/index';
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

/** The preload of WL1 to WL8's windows: the viewer's test hooks, as in the browser's test runs (web-viewer-hooks.cjs). */
const HOOKS = join(FIXTURES_DIR, '../e2e/web-viewer-hooks.cjs');

/**
 * Opens an address in a plain window (no preload, its own partition), off every display, and gives its id; `noWebGL` is the
 * window without WebGL, as the app's tabs are switched off (main/security.ts); `hooks`, a partition of its own with the
 * preload that gives the viewer's test hooks (WL1 to WL8).
 */
async function openPlain(app: Harness, url: string, noWebGL = false, hooks = false): Promise<number> {
  return app.app.evaluate(
    async ({ BrowserWindow, screen }, { url, noWebGL, preload }) => {
      const right = Math.max(...screen.getAllDisplays().map((d) => d.bounds.x + d.bounds.width));
      const w = new BrowserWindow({
        x: right + 200,
        y: 0,
        width: 1024,
        height: 700,
        show: true,
        focusable: false,
        skipTaskbar: true,
        webPreferences: {
          partition: preload ? 'web-viewer-hooks' : 'web-viewer-check',
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
          webgl: !noWebGL,
          ...(preload ? { preload } : {}),
        },
      });
      // A load that fails is said so (the harness blocks every host but 127.0.0.1).
      await w.loadURL(url).catch((e: unknown) => {
        throw new Error(`The plain window could not load ${url}: ${e instanceof Error ? e.message : String(e)}`);
      });
      return w.id;
    },
    { url, noWebGL, preload: hooks ? HOOKS : null },
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

/** Runs an expression in the viewer's frame of a plain window (the frame whose address asks for its page from its parent). */
async function inViewerFrame<T>(app: Harness, id: number, expression: string): Promise<T> {
  return app.app.evaluate(
    ({ BrowserWindow }, { id, expression }) => {
      const w = BrowserWindow.fromId(id);
      if (!w) throw new Error(`No window ${id}`);
      const frame = w.webContents.mainFrame.framesInSubtree.find((f) => f.url.includes('from=parent'));
      if (!frame) throw new Error('No viewer frame in the window');
      return frame.executeJavaScript(expression, true);
    },
    { id, expression },
  ) as Promise<T>;
}

describe("PG1 and PG2: the viewer takes a page from its parent (holoml #58, the playground)", () => {
  const SHOWROOM = readFileSync(join(FIXTURES_DIR, 'holoml/showroom/index.holoml'), 'utf8');
  const frameState = (id: number) => inViewerFrame<string | undefined>(h, id, 'document.documentElement.dataset.state');
  const frameNote = (id: number) => inViewerFrame<string>(h, id, "document.getElementById('note-title').textContent + ': ' + document.getElementById('note-text').textContent");

  /** A parent page on a server, framing the viewer of this site with ?from=parent, waiting until the viewer listens. */
  async function parentWithViewer(on: FixtureServer): Promise<number> {
    const id = await openPlain(h, on.url('viewer-parent.html'));
    await inPlain(h, id, `frameViewer(${JSON.stringify(`${server.url('web-viewer/viewer/index.html')}?from=parent`)})`);
    await waitFor('the viewer waiting for its page', () => frameNote(id), (t) => t.includes('Waiting for the page'), 20_000);
    return id;
  }

  it("PG1 a page given by the parent on the viewer's own site draws, with its base, and the parent hears how it went", async () => {
    const before = new Map(server.hits);
    const id = await parentWithViewer(server);
    try {
      await waitFor('ready heard', () => inPlain<{ state: string }[]>(h, id, 'heard'), (v) => v.some((m) => m.state === 'ready'));
      await inPlain(h, id, `offer(${JSON.stringify({ holomlPlayground: 1, text: SHOWROOM, base: server.url('holoml/showroom/index.holoml') })})`);
      await waitFor('drawn', () => frameState(id), (s) => s === 'drawn' || s === 'refused', 45_000);
      expect(await frameState(id), await frameNote(id)).toBe('drawn');
      const f = await inViewerFrame<Facts>(h, id, 'window.__holoml.scene()');
      expect(f.error).toBeNull();
      expect(f.problems).toEqual([]);
      expect(f.title).toBe('HoloML showroom');
      expect(f.entryCount).toBeGreaterThan(5);
      const heard = await inPlain<{ state: string; origin: string }[]>(h, id, 'heard');
      expect(heard.map((m) => m.state)).toEqual(['ready', 'drawn']);
      for (const m of heard) expect(m.origin).toBe(new URL(server.url('')).origin);
      // The page's own text is never fetched: only its models, from beside its base.
      const got = hitsSince(server, before).filter((p) => p !== '/form.html' && p !== '/favicon.ico');
      expect(got).not.toContain('/holoml/showroom/index.holoml');
      expect(got.some((p) => p.startsWith('/holoml/showroom/models/'))).toBe(true);
      for (const path of got) expect(path).toMatch(/^\/(viewer-parent\.html|web-viewer\/|holoml\/showroom\/)/);
    } finally {
      await closePlain(h, id);
    }
  });

  it('PG1 a page offered by another site, by another frame, without a base, with a base elsewhere, or over 2 MB is refused, and nothing is fetched for it', async () => {
    const refusedFrom = async (on: FixtureServer, send: string, expected: RegExp) => {
      const before = new Map(server.hits);
      const id = await parentWithViewer(on);
      try {
        await inPlain(h, id, send);
        await waitFor(`refused: ${send.slice(0, 60)}`, () => frameState(id), (s) => s === 'refused', 15_000);
        expect(await frameNote(id)).toMatch(expected);
        const got = hitsSince(server, before).filter((p) => p !== '/form.html' && p !== '/favicon.ico');
        for (const path of got) expect(path, 'nothing fetched for a refused page').toMatch(/^\/(viewer-parent\.html|web-viewer\/viewer\/(index\.html|host\.js))/);
      } finally {
        await closePlain(h, id);
      }
    };
    const base = server.url('holoml/showroom/index.holoml');
    // A parent of another site: the viewer's "ready" goes to its own origin only, so that parent never hears it; what it sends anyway is refused.
    await refusedFrom(other, `offer(${JSON.stringify({ holomlPlayground: 1, text: SHOWROOM, base })})`, /offered by another site/);
    await refusedFrom(server, `offerFromSibling(${JSON.stringify({ holomlPlayground: 1, text: SHOWROOM, base })})`, /a frame other than/);
    await refusedFrom(server, `offer(${JSON.stringify({ holomlPlayground: 1, text: SHOWROOM })})`, /without its text or its address/);
    await refusedFrom(server, `offer(${JSON.stringify({ holomlPlayground: 1, text: SHOWROOM, base: other.url('holoml/showroom/index.holoml') })})`, /must be on this site/);
    await refusedFrom(server, `offer(${JSON.stringify({ holomlPlayground: 1, text: SHOWROOM, base: 'http://shop.test/room.holoml' })})`, /must be on this site/);
    await refusedFrom(server, `offer({ holomlPlayground: 1, text: 'x'.repeat(2 * 1024 * 1024 + 1), base: ${JSON.stringify(base)} })`, /larger than 2 MB/);
  });

  it('PG1 the address alone, with no page framing it, says where its page comes from', async () => {
    const id = await openPlain(h, `${server.url('web-viewer/viewer/index.html')}?from=parent`);
    try {
      await waitFor('refused', () => state(id), (s) => s === 'refused', 15_000);
      expect(await noteText(id)).toMatch(/takes its page from the page that frames it/);
    } finally {
      await closePlain(h, id);
    }
  });
});

/**
 * PG3 to PG8 (holoml #58): HoloML's playground, from the holoml folder
 * beside this repository (as the documentation's screenshots are made),
 * built with its examples into tests/fixtures/pg/holoml/ beside this
 * site's build in tests/fixtures/pg/hypersol-hyperspace-3d/, so the two
 * share one origin as they do on srajpal.github.io. Without that folder
 * (GitHub's machines check out this repository alone) the checks are
 * skipped, and say so.
 */
const HOLOML_DIR = join(FIXTURES_DIR, '../../../holoml');
const HAS_HOLOML = existsSync(join(HOLOML_DIR, 'site/playground/playground.js'));
if (!HAS_HOLOML) console.log(`PG3 to PG8 skipped: no holoml folder with the playground beside this repository (${HOLOML_DIR}).`);

describe.skipIf(!HAS_HOLOML)('PG3 to PG8: the playground (holoml #58)', () => {
  const PG_DIR = join(FIXTURES_DIR, 'pg');
  const playground = (query = '') => `${server.url('pg/holoml/playground/index.html')}${query}`;
  const frameState = (id: number) => inViewerFrame<string | undefined>(h, id, 'document.documentElement.dataset.state').catch(() => undefined);
  const count = (id: number) => inPlain<string>(h, id, "document.getElementById('pg-count').textContent");
  const problems = (id: number) => inPlain<{ line: number; column: number; text: string }[]>(h, id, "[...document.querySelectorAll('#pg-problems .pg-problem')].map((b) => ({ line: Number(b.dataset.line), column: Number(b.dataset.column), text: b.textContent }))");
  /** Puts a text in the editor, as typing would (an input event). */
  const type = (id: number, value: string) => inPlain(h, id, `(() => { const t = document.getElementById('pg-text'); t.value = ${JSON.stringify(value)}; t.dispatchEvent(new Event('input')); })()`);
  const editorText = (id: number) => inPlain<string>(h, id, "document.getElementById('pg-text').value");
  /** Marks the viewer frame's current page, so that a new draw (the frame loaded again) can be told from the last. */
  const mark = (id: number) => inViewerFrame(h, id, 'window.__pgMark = true');
  const marked = (id: number) => inViewerFrame<boolean>(h, id, 'window.__pgMark === true').catch(() => false);

  async function drawnAgain(id: number, what: string, ms = 60_000): Promise<number> {
    const t0 = Date.now();
    await waitFor(`${what}: drawn again`, async () => ((await marked(id)) ? 'old' : await frameState(id)), (s) => s === 'drawn' || s === 'refused', ms);
    expect(await frameState(id), what).toBe('drawn');
    return Date.now() - t0;
  }

  beforeAll(() => {
    rmSync(PG_DIR, { recursive: true, force: true });
    execFileSync(process.execPath, [join(FIXTURES_DIR, '../../site/build.mjs'), join(PG_DIR, 'hypersol-hyperspace-3d')], { stdio: 'inherit' });
    execFileSync(process.execPath, [join(HOLOML_DIR, 'site/build.mjs'), join(PG_DIR, 'holoml')], { stdio: 'inherit', cwd: HOLOML_DIR });
  }, 180_000);

  afterAll(() => {
    rmSync(PG_DIR, { recursive: true, force: true });
  });

  it('PG3 lists the one syntax mistake, or every problem, as the checker does, and a problem puts the caret at its place', async () => {
    const id = await openPlain(h, playground());
    try {
      await waitFor('the first page', () => count(id), (t) => t === 'No problems.', 20_000);
      const first = await editorText(id);
      const broken = first.replace('<head>', '<head>\n    <title>Not closed');
      await type(id, broken);
      await waitFor('the syntax mistake', () => count(id), (t) => t.startsWith('A mistake in the syntax'), 10_000);
      const syntax = await problems(id);
      let thrown: { position?: { line: number; column: number }; code?: string } = {};
      try {
        parse(broken);
      } catch (e) {
        thrown = e as typeof thrown;
      }
      expect(syntax).toHaveLength(1);
      expect([syntax[0]!.line, syntax[0]!.column]).toEqual([thrown.position!.line, thrown.position!.column]);
      expect(syntax[0]!.text).toContain(thrown.code!);

      const wrong = first.replace('<light type="ambient"', '<light type="glow"').replace('scale="1.8"', 'scale="big"');
      await type(id, wrong);
      await waitFor('the problems', () => count(id), (t) => /^\d+ problems\.$/.test(t), 10_000);
      const listed = await problems(id);
      const expected = check(parse(wrong));
      expect(listed.map((p) => [p.line, p.column])).toEqual(expected.map((p) => [p.line, p.column]));
      for (const [i, p] of expected.entries()) expect(listed[i]!.text).toContain(p.code);
      // The problem's line is marked beside the text.
      expect(await inPlain<string[]>(h, id, "[...document.querySelectorAll('#pg-lines .pg-marked')].map((s) => s.textContent.trim())")).toEqual([...new Set(expected.map((p) => String(p.line)))]);
      // A click on the second problem puts the caret at its line and column.
      await inPlain(h, id, "document.querySelectorAll('#pg-problems .pg-problem')[1].click()");
      const at = await inPlain<number>(h, id, 'document.getElementById(\'pg-text\').selectionStart');
      const lines = wrong.split('\n');
      const offset = lines.slice(0, expected[1]!.line - 1).reduce((n, l) => n + l.length + 1, 0) + expected[1]!.column - 1;
      expect(at).toBe(offset);
      expect(await inPlain<string>(h, id, 'document.activeElement.id')).toBe('pg-text');
    } finally {
      await closePlain(h, id);
    }
  });

  it('PG4 draws the first page, again after an edit and by Ctrl+Enter, keeps the last scene through a problem, and the switch stops drawing as you type', async () => {
    const id = await openPlain(h, playground());
    try {
      await waitFor('the first page drawn', () => frameState(id), (s) => s === 'drawn', 60_000);
      const first = await editorText(id);
      await mark(id);
      await type(id, first.replace('#c0182a', '#2a6fc0'));
      const ms = await drawnAgain(id, 'after the colour changed');
      console.log(`PG4: the first page drawn again ${ms} ms after the edit (the pause is 1 s)`);
      expect(await inViewerFrame<string>(h, id, "document.querySelector('body > pre')?.textContent ?? ''").catch(() => '')).toBe('');
      // A problem: the scene stays, marked, and is not drawn again.
      await mark(id);
      await type(id, first.replace('<light type="ambient"', '<light type="glow"'));
      await waitFor('the problem', () => count(id), (t) => t === '1 problem.', 10_000);
      expect(await inPlain<boolean>(h, id, "document.querySelector('.pg-scene').classList.contains('pg-stale')")).toBe(true);
      expect(await inPlain<string>(h, id, "document.getElementById('pg-note').textContent")).toMatch(/last version without one/);
      // Drawing as you type off: a good edit is checked but not drawn; Ctrl+Enter draws it.
      await inPlain(h, id, "document.getElementById('pg-live').click()");
      await type(id, first.replace('#c0182a', '#3aa56f'));
      await waitFor('checked', () => count(id), (t) => t === 'No problems.', 10_000);
      // A draw would come 1 s after this check; look 2 s after, once the checker has answered.
      await new Promise((r) => setTimeout(r, 2000));
      expect(await marked(id), 'not drawn with the switch off').toBe(true);
      await inPlain(h, id, "document.getElementById('pg-text').focus()");
      await keyInPlain(h, id, 'Enter', ['control']);
      await drawnAgain(id, 'by Ctrl+Enter');
    } finally {
      await closePlain(h, id);
    }
  });

  it('PG5 each example loads as a preset and draws with its files; a changed text is not replaced without asking', async () => {
    const examples = await (async () => {
      const id = await openPlain(h, playground());
      try {
        return await inPlain<string[]>(h, id, "[...document.querySelectorAll('#pg-preset option')].map((o) => o.value).filter((v) => v !== 'first')");
      } finally {
        await closePlain(h, id);
      }
    })();
    expect(examples.sort()).toEqual(['aquarium', 'blockworld', 'harbour-loft', 'showroom', 'sneaker-store', 'sofa-studio', 'words']);
    for (const name of examples) {
      const before = new Map(server.hits);
      const id = await openPlain(h, playground(`?preset=${name}`));
      try {
        await waitFor(`${name} drawn`, () => frameState(id), (s) => s === 'drawn' || s === 'refused', 120_000);
        expect(await frameState(id), name).toBe('drawn');
        expect(await editorText(id), name).toBe(readFileSync(join(HOLOML_DIR, 'examples', name, 'index.holoml'), 'utf8'));
        const got = hitsSince(server, before);
        if (name !== 'words') expect(got.some((p) => p.startsWith(`/pg/holoml/${name}/`) && !p.endsWith('/index.holoml')), `${name}'s own files`).toBe(true);
        if (name === 'harbour-loft') {
          expect(got).toContain('/pg/holoml/harbour-loft/loft.js');
          expect(await inViewerFrame<string>(h, id, "document.getElementById('notice').textContent")).toBe('');
        }
      } finally {
        await closePlain(h, id);
      }
    }
    const id = await openPlain(h, playground());
    try {
      await waitFor('the first page', () => count(id), (t) => t === 'No problems.', 20_000);
      await type(id, `${await editorText(id)}\n<!-- mine -->`);
      await inPlain(h, id, "window.confirm = (m) => { window.__asked = m; return false; }; const s = document.getElementById('pg-preset'); s.value = 'showroom'; s.dispatchEvent(new Event('change'))");
      expect(await inPlain<string>(h, id, 'window.__asked')).toMatch(/Replace your changes/);
      expect(await editorText(id)).toContain('<!-- mine -->');
      expect(await inPlain<string>(h, id, "document.getElementById('pg-preset').value")).toBe('first');
    } finally {
      await closePlain(h, id);
    }
  });

  it('PG6 sends nothing anywhere: every request is to the site, and none carries the text', async () => {
    const before = new Map(server.hits);
    const otherBefore = new Map(other.hits);
    const id = await openPlain(h, playground());
    try {
      await waitFor('the first page drawn', () => frameState(id), (s) => s === 'drawn', 60_000);
      await mark(id);
      await type(id, (await editorText(id)).replace('The Quellis', 'Zq9-secret-words'));
      await drawnAgain(id, 'after an edit');
      const got = hitsSince(server, before).filter((p) => p !== '/form.html' && p !== '/favicon.ico');
      expect(got.length).toBeGreaterThan(3);
      for (const path of got) {
        expect(path, 'only the two sites').toMatch(/^\/pg\/(holoml|hypersol-hyperspace-3d)\//);
        expect(path).not.toContain('Zq9');
      }
      expect(hitsSince(other, otherBefore)).toEqual([]);
    } finally {
      await closePlain(h, id);
    }
  });

  it('PG7 the keyboard: Tab leaves the text, Ctrl+] and Ctrl+[ indent and outdent, Enter on a problem goes to it', async () => {
    const id = await openPlain(h, playground());
    try {
      await waitFor('the first page', () => count(id), (t) => t === 'No problems.', 20_000);
      await inPlain(h, id, "(() => { const t = document.getElementById('pg-text'); t.focus(); t.setSelectionRange(0, 0); })()");
      const before = await editorText(id);
      await keyInPlain(h, id, ']', ['control']);
      await waitFor('indented', () => editorText(id), (t) => t === `  ${before}`, 5_000);
      await keyInPlain(h, id, '[', ['control']);
      await waitFor('outdented', () => editorText(id), (t) => t === before, 5_000);
      await keyInPlain(h, id, 'Tab');
      await waitFor('Tab leaves the text', () => inPlain<string>(h, id, 'document.activeElement.id'), (v) => v !== 'pg-text', 5_000);
      expect(await editorText(id), 'Tab typed nothing').toBe(before);
      // A problem, reached and chosen from the keyboard.
      await type(id, before.replace('scale="1.8"', 'scale="big"'));
      await waitFor('the problem', () => count(id), (t) => t === '1 problem.', 10_000);
      await inPlain(h, id, "document.querySelector('#pg-problems .pg-problem').focus()");
      // A button acts on Enter with the typed character, as a real key press brings it (HANDOFF.md, m19's press).
      await h.app.evaluate(({ BrowserWindow }, { id }) => {
        const wc = BrowserWindow.fromId(id)!.webContents;
        wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
        wc.sendInputEvent({ type: 'char', keyCode: '\r' });
        wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
      }, { id });
      await waitFor('back in the text', () => inPlain<string>(h, id, 'document.activeElement.id'), (v) => v === 'pg-text', 5_000);
      expect(await inPlain<string>(h, id, "document.getElementById('pg-count').getAttribute('role')")).toBe('status');
    } finally {
      await closePlain(h, id);
    }
  });

  it('PG8 without WebGL 2: the problems work, and the scene says it cannot be drawn here', async () => {
    const id = await openPlain(h, playground(), true);
    try {
      await waitFor('the first page', () => count(id), (t) => t === 'No problems.', 20_000);
      expect(await inPlain<string>(h, id, "document.getElementById('pg-note').textContent")).toMatch(/cannot draw 3D scenes/);
      expect(await inPlain<number>(h, id, "document.querySelectorAll('#pg-frame iframe').length")).toBe(0);
      expect(await inPlain<boolean>(h, id, "document.getElementById('pg-run').disabled")).toBe(true);
      await type(id, (await editorText(id)).replace('scale="1.8"', 'scale="big"'));
      await waitFor('the problem', () => count(id), (t) => t === '1 problem.', 10_000);
    } finally {
      await closePlain(h, id);
    }
  });
});

/** The address the plain window shows. */
const urlOf = (id: number) => h.app.evaluate(({ BrowserWindow }, { id }) => BrowserWindow.fromId(id)!.webContents.getURL(), { id });
/** The page the host shows by its address (its `?page=`), or null. */
const pageOf = (url: string) => new URL(url).searchParams.get('page');

/**
 * What the plain windows download, and the windows a page asks to open,
 * recorded in the main process: nothing is saved, and no window opens (so
 * nothing comes onto the display during a run).
 */
async function recordLeaving(id: number): Promise<void> {
  await h.app.evaluate(
    ({ BrowserWindow, session }, { id }) => {
      const g = globalThis as { __wlDownloads?: string[]; __wlOpened?: string[] };
      if (!g.__wlDownloads) {
        g.__wlDownloads = [];
        session.fromPartition('web-viewer-hooks').on('will-download', (e, item) => {
          g.__wlDownloads!.push(item.getURL());
          e.preventDefault();
        });
      }
      g.__wlOpened ??= [];
      BrowserWindow.fromId(id)!.webContents.setWindowOpenHandler(({ url }) => {
        g.__wlOpened!.push(url);
        return { action: 'deny' };
      });
    },
    { id },
  );
}
const downloads = () => h.app.evaluate(() => [...((globalThis as { __wlDownloads?: string[] }).__wlDownloads ?? [])]);
const opened = () => h.app.evaluate(() => [...((globalThis as { __wlOpened?: string[] }).__wlOpened ?? [])]);

/** Where the scene's link to an address ending so is on the window (or the thing `thing` inside it), checked to be that link. */
async function linkPoint(id: number, ending: string, thing?: string): Promise<{ x: number; y: number; href: string }> {
  const links = await inPlain<string[]>(h, id, 'window.__holoml.links()');
  const i = links.findIndex((l) => l.endsWith(ending));
  expect(i, `a link to …${ending} among ${links.join(', ')}`).toBeGreaterThanOrEqual(0);
  const p = (await waitFor(`the link to …${ending} in view`, () => inPlain<{ x: number; y: number } | null>(h, id, `window.__holoml.point(${thing === undefined ? i : JSON.stringify(thing)})`), (v) => v !== null))!;
  expect(await inPlain<string | null>(h, id, `window.__holoml.linkAt(${p.x}, ${p.y})`), 'the link at its own centre').toBe(links[i]);
  return { x: p.x, y: p.y, href: links[i]! };
}

/** A left click (Ctrl+click with `control`) in the plain window, again until `done` (a click can be lost while the window draws its first frames). */
async function clickLinkUntil(id: number, p: { x: number; y: number }, what: string, done: () => Promise<boolean>, modifiers: 'control'[] = []): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    await h.app.evaluate(
      ({ BrowserWindow }, { id, x, y, modifiers }) => {
        const wc = BrowserWindow.fromId(id)!.webContents;
        wc.sendInputEvent({ type: 'mouseMove', x, y, modifiers });
        wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1, modifiers });
        wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1, modifiers });
      },
      { id, x: Math.round(p.x), y: Math.round(p.y), modifiers },
    );
    try {
      await waitFor(`${what} (click ${attempt} of 3)`, done, (v) => v, attempt < 3 ? 5000 : 20_000);
      return;
    } catch (e) {
      if (attempt >= 3) throw new Error(`${e instanceof Error ? e.message : String(e)}; the window shows ${await describePlain(h, id)}; downloads: ${JSON.stringify(await downloads())}`);
    }
  }
}

interface Fade {
  opacity: number;
  arriving: boolean;
  log: { to: number }[];
}

/** The page arrived through the fade: dark at once, clear again once drawn. */
async function fadedIn(id: number): Promise<void> {
  const f = (await waitFor('the fade in', () => inPlain<Fade | null>(h, id, 'window.__holoml.fade()'), (v) => v !== null && !v.arriving && v.opacity === 0 && v.log.length >= 2))!;
  expect(f.log[0]!.to, 'dark at first').toBe(1);
  expect(f.log.at(-1)!.to, 'then clear').toBe(0);
}

describe('WL1 to WL8: links between HoloML pages (issue #125)', () => {
  const SHOWROOM = () => server.url('holoml/showroom/index.holoml');
  const QUELLIS = () => server.url('holoml/showroom/quellis.holoml');
  const HOST = () => server.url('web-viewer/viewer/index.html');
  const title = (id: number) => inPlain<string>(h, id, "document.getElementById('title').textContent");

  it('WL1 a click on a link to another HoloML page opens it in the viewer, through the fade, and nothing is downloaded; WL3 Back and Forward', async () => {
    const id = await openPlain(h, host(SHOWROOM()), false, true);
    try {
      await recordLeaving(id);
      await drawn(id, 'the showroom');
      const p = await linkPoint(id, '/showroom/quellis.holoml');
      await clickLinkUntil(id, p, 'the Quellis', async () => pageOf(await urlOf(id)) === QUELLIS());
      const url = new URL(await urlOf(id));
      expect(`${url.origin}${url.pathname}`).toBe(HOST());
      const f = await drawn(id, 'the Quellis');
      expect(f.title).toBe('Quellis in red · HoloML showroom');
      expect(await title(id)).toBe('Quellis in red · HoloML showroom');
      await fadedIn(id);
      expect(await downloads()).toEqual([]);
      // WL3: Back returns to the showroom, and Forward to the Quellis.
      await inPlain(h, id, 'history.back()');
      await waitFor('back to the showroom', async () => pageOf(await urlOf(id)), (v) => v === SHOWROOM());
      expect((await drawn(id, 'the showroom again')).title).toBe('HoloML showroom');
      await inPlain(h, id, 'history.forward()');
      await waitFor('forward to the Quellis', async () => pageOf(await urlOf(id)), (v) => v === QUELLIS());
      expect((await drawn(id, 'the Quellis again')).title).toBe('Quellis in red · HoloML showroom');
      expect(await downloads()).toEqual([]);
    } finally {
      await closePlain(h, id);
    }
  });

  it("WL2 the outline's links lead where the scene's do, in the text view too, and Enter on one follows it", async () => {
    const id = await openPlain(h, host(SHOWROOM()), false, true);
    try {
      await recordLeaving(id);
      await drawn(id, 'the showroom');
      const hrefs = await inPlain<string[]>(h, id, "[...document.querySelectorAll('#holoml-outline a')].map((a) => a.href)");
      expect(hrefs.length).toBe(6);
      for (const href of hrefs) {
        const url = new URL(href);
        expect(`${url.origin}${url.pathname}`, href).toBe(HOST());
        expect(pageOf(href), href).toMatch(/\/holoml\/showroom\/[a-z]+\.holoml$/);
      }
      // The text view shows the same links.
      await keyInPlain(h, id, 'V', ['control', 'shift']);
      await waitFor('the text view', () => inPlain<boolean>(h, id, "document.body.classList.contains('holoml-text-view')"), (v) => v === true);
      expect(await inPlain<string[]>(h, id, "[...document.querySelectorAll('#holoml-outline a')].filter((a) => a.getClientRects().length > 0).map((a) => a.href)")).toEqual(hrefs);
      await keyInPlain(h, id, 'V', ['control', 'shift']);
      await waitFor('3D again', () => inPlain<boolean>(h, id, "document.body.classList.contains('holoml-text-view')"), (v) => v === false);
      await inPlain(h, id, "document.querySelector('#holoml-outline a[href*=\"quellis.holoml\"]').focus()");
      expect(await inPlain<string>(h, id, 'document.activeElement?.textContent ?? ""')).toMatch(/Quellis/);
      await keyInPlain(h, id, 'Return');
      await waitFor('the Quellis by Enter', async () => pageOf(await urlOf(id)), (v) => v === QUELLIS());
      expect((await drawn(id, 'the Quellis')).title).toBe('Quellis in red · HoloML showroom');
      await fadedIn(id);
      expect(await downloads()).toEqual([]);
    } finally {
      await closePlain(h, id);
    }
  });

  it("WL3 a link to a place on another page arrives at that place (Harbour Loft's terrace to the terrace door)", async () => {
    const id = await openPlain(h, host(server.url('holoml/harbour-loft/terrace.holoml')), false, true);
    try {
      await recordLeaving(id);
      await drawn(id, 'the terrace');
      // Facing the stair house's door, as m19's tour does.
      await inPlain(h, id, '(holoml.viewer.position = [-3.6, 1.6, 0.4], holoml.viewer.lookAt([-3.6, 1.1, -1]), true)');
      const p = await linkPoint(id, '/harbour-loft/index.holoml#terrace-door', 'flat-door');
      await clickLinkUntil(id, p, 'the loft', async () => pageOf(await urlOf(id)) === server.url('holoml/harbour-loft/index.holoml#terrace-door'));
      expect((await drawn(id, 'the loft')).title).toBe('Harbour Loft');
      await waitFor('at the terrace door', () => inPlain<{ current: string | null }>(h, id, 'window.__holoml.places()'), (v) => v.current === 'terrace-door');
      expect(new URL(await urlOf(id)).hash).toBe('#terrace-door');
      expect(await downloads()).toEqual([]);
    } finally {
      await closePlain(h, id);
    }
  });

  it('WL4 a link to a place on the page itself moves there without leaving the document, and Back returns', async () => {
    const PLACES = server.url('holoml/places.holoml');
    const id = await openPlain(h, host(PLACES), false, true);
    try {
      await recordLeaving(id);
      await drawn(id, 'the places');
      await inPlain(h, id, 'window.__stayed = true');
      const p = await linkPoint(id, '/places.holoml#kitchen');
      await clickLinkUntil(id, p, 'the kitchen', async () => (await inPlain<{ current: string | null }>(h, id, 'window.__holoml.places()')).current === 'kitchen');
      expect(await inPlain<boolean | undefined>(h, id, 'window.__stayed'), 'the same document').toBe(true);
      const url = new URL(await urlOf(id));
      expect(pageOf(url.href)).toBe(PLACES);
      expect(url.hash).toBe('#kitchen');
      await inPlain(h, id, 'history.back()');
      await waitFor('back in the hall', () => inPlain<{ current: string | null }>(h, id, 'window.__holoml.places()'), (v) => v.current === 'hall');
      expect(await inPlain<boolean | undefined>(h, id, 'window.__stayed')).toBe(true);
      expect(await downloads()).toEqual([]);
    } finally {
      await closePlain(h, id);
    }
  });

  it('WL5 a link to an ordinary page goes to that page (the sofa studio to its cart)', async () => {
    const id = await openPlain(h, host(server.url('holoml/sofa-studio/index.holoml')), false, true);
    try {
      await recordLeaving(id);
      await drawn(id, 'the sofa studio');
      expect(await inPlain<string>(h, id, "document.querySelector('#holoml-outline a[href$=\"cart.html\"]')?.href ?? ''")).toBe(server.url('holoml/sofa-studio/cart.html'));
      const p = await linkPoint(id, '/sofa-studio/cart.html');
      await clickLinkUntil(id, p, 'the cart', async () => (await urlOf(id)) === server.url('holoml/sofa-studio/cart.html'));
    } finally {
      await closePlain(h, id);
    }
  });

  it("WL6 Ctrl+click opens the viewer's address for the page, not the file, and the scene stays", async () => {
    const id = await openPlain(h, host(SHOWROOM()), false, true);
    try {
      await recordLeaving(id);
      await drawn(id, 'the showroom');
      const before = (await opened()).length;
      const p = await linkPoint(id, '/showroom/quellis.holoml');
      await clickLinkUntil(id, p, 'a new window asked for', async () => (await opened()).length > before, ['control']);
      const asked = (await opened()).slice(before);
      expect(asked.length).toBe(1);
      const url = new URL(asked[0]!);
      expect(`${url.origin}${url.pathname}`).toBe(HOST());
      expect(pageOf(url.href)).toBe(QUELLIS());
      expect(pageOf(await urlOf(id))).toBe(SHOWROOM());
    } finally {
      await closePlain(h, id);
    }
  });

  it("WL7 in the playground's frame, a link to another HoloML page opens it in the frame by ?page=", async () => {
    const id = await openPlain(h, server.url('viewer-parent.html'), false, true);
    // Each look into the frame has a time limit: one that meets the frame as it leaves for the next page may never
    // answer (seen on Linux, drawn in software), and a wait asks again rather than hang until the check's own limit.
    const inFrame = <T>(expression: string) =>
      h.app.evaluate(
        ({ BrowserWindow }, { id, expression, viewer }) => {
          const frame = BrowserWindow.fromId(id)!.webContents.mainFrame.framesInSubtree.find((f) => f.url.startsWith(viewer));
          if (!frame) throw new Error('No viewer frame in the window');
          return Promise.race([
            frame.executeJavaScript(expression, true) as Promise<unknown>,
            new Promise((_, reject) => setTimeout(() => reject(new Error('The viewer frame did not answer within 5 s')), 5000)),
          ]);
        },
        { id, expression, viewer: HOST() },
      ) as Promise<T>;
    const frameUrl = () =>
      h.app.evaluate(({ BrowserWindow }, { id, viewer }) => BrowserWindow.fromId(id)!.webContents.mainFrame.framesInSubtree.find((f) => f.url.startsWith(viewer))?.url ?? null, {
        id,
        viewer: HOST(),
      });
    try {
      await recordLeaving(id);
      await inPlain(h, id, `frameViewer(${JSON.stringify(`${HOST()}?from=parent`)})`);
      await waitFor('ready heard', () => inPlain<{ state: string }[]>(h, id, 'heard'), (v) => v.some((m) => m.state === 'ready'), 20_000);
      const text = readFileSync(join(FIXTURES_DIR, 'holoml/showroom/index.holoml'), 'utf8');
      await inPlain(h, id, `offer(${JSON.stringify({ holomlPlayground: 1, text, base: SHOWROOM() })})`);
      await waitFor('drawn in the frame', () => inFrame<string | undefined>('document.documentElement.dataset.state'), (s) => s === 'drawn', 45_000);
      // From the keyboard: the outline's link, focused, and Enter, once the frame is seen to have the keyboard on it.
      await inPlain(h, id, "document.getElementById('viewer').focus()");
      await inFrame("document.querySelector('#holoml-outline a[href*=\"quellis.holoml\"]').focus()");
      await waitFor(
        'the keyboard on the link in the frame',
        () => inFrame<{ frame: boolean; text: string }>("({ frame: document.hasFocus(), text: document.activeElement?.textContent ?? '' })"),
        (v) => v.frame && v.text.includes('Quellis'),
      );
      await keyInPlain(h, id, 'Return');
      // The frame's address as the main process has it: running script in a frame that is leaving can hang (Linux, #126's build).
      await waitFor('the Quellis in the frame', frameUrl, (u) => u !== null && pageOf(u) === QUELLIS());
      await waitFor('the Quellis drawn', () => inFrame<string | undefined>('document.documentElement.dataset.state'), (s) => s === 'drawn', 45_000);
      expect(await inFrame<string>("document.getElementById('title').textContent")).toBe('Quellis in red · HoloML showroom');
      expect(await urlOf(id), 'the parent page stays').toBe(server.url('viewer-parent.html'));
      expect(await downloads()).toEqual([]);
    } finally {
      await closePlain(h, id);
    }
  });

  it("WL8 the shoe opens in the colour its address asks for, as the page's script reads the page's own address", async () => {
    const id = await openPlain(h, host(server.url('holoml/sneaker-store/shoe.holoml?colour=ember')), false, true);
    try {
      await drawn(id, 'the shoe');
      await waitFor('the colour asked for', () => inPlain<{ id: string | null; value: string }[]>(h, id, 'window.__holoml.choices()'), (c) => c.find((x) => x.id === 'colour')?.value === 'ember');
    } finally {
      await closePlain(h, id);
    }
  });
});

describe('WV8: the site as built', () => {
  it('holds the home page, the host, the transcoder page, the viewer and its decoders, and not the shell', async () => {
    const { readdirSync, existsSync } = await import('node:fs');
    for (const file of ['index.html', 'style.css', 'pictures/readme.png', 'pictures/logo.png', '.nojekyll', 'viewer/index.html', 'viewer/host.js', 'viewer/ktx2-host.html', 'viewer/assets/viewer.js', 'viewer/assets/ktx2-host.js']) {
      expect(existsSync(join(SITE_DIR, file)), file).toBe(true);
    }
    const assets = readdirSync(join(SITE_DIR, 'viewer/assets'));
    expect(assets.some((f) => f.endsWith('.wasm')), 'the decoders').toBe(true);
    expect(assets).not.toContain('lift-host.js');
    expect(assets.filter((f) => f.startsWith('index-'))).toEqual([]);
    // The landing page (issue #96, LP5) reaches the host, and its download link carries the version.
    const id = await openPlain(h, server.url('web-viewer/index.html'));
    try {
      const home = await inPlain<string>(h, id, "document.querySelector('a[href=\"viewer/\"]')?.textContent ?? ''");
      expect(home).toMatch(/viewer/i);
      const { version } = JSON.parse(readFileSync(join(FIXTURES_DIR, '../../apps/browser/package.json'), 'utf8')) as { version: string };
      expect(await inPlain<string>(h, id, "document.querySelector('a.button')?.textContent ?? ''")).toBe(`Download ${version}`);
      expect(await inPlain<number>(h, id, "document.querySelectorAll('.downloads a').length")).toBe(4);
    } finally {
      await closePlain(h, id);
    }
  });
});
