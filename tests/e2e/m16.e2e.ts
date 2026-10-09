/**
 * Milestone 16 end-to-end checks S2 to S7 (TODO.md): HoloML's showroom in
 * the browser. The showroom is a byte-for-byte copy from the holoml
 * repository (pnpm holoml:sync), served from 127.0.0.1 like every
 * fixture. S1 (valid pages) is holoml's own unit test; S8 (the published
 * site) is checked by hand, since tests stay on this machine.
 */
import { existsSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { _electron as electron } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIXTURES_DIR, startFixtureServer, type FixtureServer } from './fixture-server';
import {
  clickUntil,
  describeMissedClick,
  focusedTab,
  inPage,
  launch,
  pressInPage,
  pressInShell,
  project,
  sceneStill,
  sceneWait,
  shellCall,
  sleep,
  softwareRenderer,
  waitFor,
  waitForPage,
  type Harness,
  type Point,
  APP_DIR,
  graphicsSwitches,
  holdKeyUntil,
  OFFLINE_RULES,
  removeFolder,
} from './harness';

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

type Vec = [number, number, number];
interface Model {
  src: string;
  state: string;
  materials: Record<string, { color: string }>;
}

const CARS = ['Quellis', 'Pippet', 'Veyl', 'Tallberg', 'Strafe'];
const url = (page: string) => server.url(`holoml/showroom/${page}`);

function holo<T>(h: Harness, expression: string, page: string): Promise<T> {
  return inPage<T>(h, `window.__holoml ? (${expression}) : undefined`, page);
}

async function ready(h: Harness, page: string, timeoutMs = 20_000): Promise<void> {
  await waitFor(`${page} ready`, () => holo<boolean>(h, 'window.__holoml.ready', page), (r) => r === true, timeoutMs);
}

async function open(h: Harness, page: string): Promise<void> {
  await shellCall(h, 'showUrl', url(page));
  await waitForPage(h, page);
  await ready(h, page);
}

const models = (h: Harness, page: string) => holo<Model[]>(h, 'window.__holoml.models()', page);
const paint = async (h: Harness, page: string) => (await models(h, page)).find((m) => m.src.endsWith('.glb'))!.materials['Paint']!.color;
const focused = (h: Harness, page: string) => inPage<string>(h, 'document.activeElement?.textContent ?? ""', page);

/** Presses Tab in the page until the outline item with this text has focus. */
async function tabTo(h: Harness, page: string, text: string): Promise<void> {
  const outline = await holo<string[]>(h, 'window.__holoml.outline()', page);
  const at = outline.findIndex((s) => s.slice(s.indexOf(':') + 1) === text);
  expect(at, `${text} in ${JSON.stringify(outline)}`).toBeGreaterThanOrEqual(0);
  await inPage(h, 'document.activeElement?.blur(), true', page);
  for (let i = 0; i <= at; i++) await pressInPage(h, 'Tab', [], page);
  await waitFor(`${text} in focus`, () => focused(h, page), (t) => t === text);
}

describe('S2 to S7: the showroom', () => {
  let h: Harness;
  /** How long the hall took to load whole (S2), and how many frames it drew in a second while its turntable turned (S6): measured by those checks, and held to their budgets by the ones after them. */
  let hallLoadMs: number | null = null;
  let hallFrames: number | null = null;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { showroomUrl: url('index.holoml') });
    await waitForPage(h, 'link-a.html');
  });
  afterAll(async () => h?.close());

  it('the start panel links to the showroom, and the link opens it', async () => {
    await pressInShell(h, 'T', ['control']);
    const link = h.shell.locator('[data-testid="start-showroom"]');
    await link.waitFor({ state: 'visible' });
    expect(await link.getAttribute('data-url')).toBe(url('index.holoml'));
    await link.click();
    await waitFor('the hall', async () => (await focusedTab(h)).url, (u) => u === url('index.holoml'));
    await waitForPage(h, 'index.holoml');
    // The page is drawn where the room placed it, beside the tab rail. Before
    // the fix, focus scrolled the page layer and the page sat 89 pixels left.
    const quad = await shellCall(h, 'panelQuad');
    const left = await h.shell.evaluate(() => Math.max(...[...document.querySelectorAll('webview')].map((v) => (getComputedStyle(v).visibility === 'visible' ? v.getBoundingClientRect().left : -1))));
    expect(Math.abs(left - quad[0]!.x)).toBeLessThan(2);
  });

  it('S2 the hall loads whole, inside the budget of what a page may hold', async () => {
    const PAGE = 'index.holoml';
    const started = Date.now();
    await shellCall(h, 'showUrl', url(`${PAGE}?s2`));
    await waitForPage(h, `${PAGE}?s2`);
    // However long it takes on this machine: within 5 seconds is the next check's.
    await ready(h, `${PAGE}?s2`, 60_000);
    hallLoadMs = Date.now() - started;
    const states = (await models(h, PAGE)).map((m) => m.state);
    expect(states.length).toBe(11); // the hall, five plinths, five cars
    expect(states.every((s) => s === 'loaded'), JSON.stringify(states)).toBe(true);
    expect(await holo<unknown[]>(h, 'window.__holoml.problems', PAGE)).toEqual([]);
    expect(await holo<unknown[]>(h, 'window.__holoml.leftOut()', PAGE)).toEqual([]);
    // What the instrument panel's Scene part shows as the totals.
    const { totals } = await holo<{ totals: { bytes: number; triangles: number } }>(h, 'window.__holoml.scene()', PAGE);
    expect(totals.bytes).toBeGreaterThan(0);
    expect(totals.bytes).toBeLessThan(10 * 1024 * 1024);
    expect(totals.triangles).toBeGreaterThan(5000);
    expect(totals.triangles).toBeLessThan(200_000);
    expect(await holo<string>(h, 'document.title', PAGE)).toBe('HoloML showroom');
  });

  it('S2 the hall loads within 5 seconds (with a graphics card)', async (ctx) => {
    expect(hallLoadMs, 'the check before this one timed the load').not.toBeNull();
    // Within 5 s with a graphics card. Drawn in software (GitHub's machines), the time is measured and
    // logged, and the check is skipped, not passed, as the frame-rate budgets are (owner, prompts 59 and 95).
    const software = await softwareRenderer(h);
    if (software) {
      console.log(`S2: loaded in ${hallLoadMs} ms; the 5-second budget not checked: drawing in software (${software})`);
      ctx.skip(`the 5-second budget is for graphics hardware; drawing in software (${software})`);
    }
    console.log(`S2: loaded in ${hallLoadMs} ms`);
    expect(hallLoadMs!).toBeLessThan(5000);
  });

  it('S4 a car in the hall opens its page; its colours and the way back work', async () => {
    const HALL = 'index.holoml';
    // With the mouse, on the Quellis.
    const quellis = (await holo<string[]>(h, 'window.__holoml.links()', HALL)).indexOf(url('quellis.holoml'));
    expect(quellis).toBeGreaterThanOrEqual(0);
    const p = await waitFor('Quellis on screen', () => holo<Point | null>(h, `window.__holoml.point(${quellis})`, HALL), (v) => v !== null);
    const at = await project(h, p!.x, p!.y);
    const reached = async () => (await focusedTab(h)).url === url('quellis.holoml');
    await clickUntil(h, at, 'the Quellis link', reached, {}, () => describeMissedClick(h, at, reached));
    await ready(h, 'quellis.holoml');
    expect(await paint(h, 'quellis.holoml')).toBe('#c8243a');
    // From the keyboard: another colour.
    await tabTo(h, 'quellis.holoml', 'Ocean blue');
    await pressInPage(h, 'Enter', [], 'quellis.holoml');
    await waitFor('the blue page', async () => (await focusedTab(h)).url, (u) => u === url('quellis-ocean-blue.holoml'));
    await ready(h, 'quellis-ocean-blue.holoml');
    expect(await paint(h, 'quellis-ocean-blue.holoml')).toBe('#2c5fbf');
    expect(await holo<string>(h, 'document.title', 'quellis-ocean-blue.holoml')).toBe('Quellis in ocean blue · HoloML showroom');
    // Back returns; "Back to the hall" goes to the hall.
    await pressInShell(h, 'Left', ['alt']);
    await waitFor('back', async () => (await focusedTab(h)).url, (u) => u === url('quellis.holoml'));
    await ready(h, 'quellis.holoml');
    await tabTo(h, 'quellis.holoml', 'Back to the hall');
    await pressInPage(h, 'Enter', [], 'quellis.holoml');
    await waitFor('the hall', async () => (await focusedTab(h)).url, (u) => u === url('index.holoml'));
  });

  it('S4 every car has its three colours, each with its own paint', async () => {
    const expected: Record<string, string[]> = {
      quellis: ['#c8243a', '#2c5fbf', '#b8bcc6'],
      pippet: ['#3aa56f', '#f2c230', '#e8e8ec'],
      tallberg: ['#f09a3a', '#4a4d57', '#dfe7ee'],
      veyl: ['#3f6fd6', '#8b5cf6', '#1b1c22'],
      strafe: ['#e0472f', '#ff8a1f', '#1fa7a0'],
    };
    for (const [car, colours] of Object.entries(expected)) {
      await open(h, `${car}.holoml`);
      const links = (await holo<string[]>(h, 'window.__holoml.links()', `${car}.holoml`)).filter((l) => l.includes(`/${car}-`));
      expect(links, car).toHaveLength(2);
      expect(await paint(h, `${car}.holoml`)).toBe(colours[0]);
      for (const [i, link] of links.entries()) {
        const page = link.slice(link.lastIndexOf('/') + 1);
        await open(h, page);
        expect((await models(h, page)).every((m) => m.state === 'loaded'), page).toBe(true);
        expect(await paint(h, page), page).toBe(colours[i + 1]);
      }
    }
  }, 120_000);

  it('S3 each car page starts in walk mode, and walking moves at eye height', async () => {
    const PAGE = 'veyl.holoml';
    await open(h, PAGE);
    const before = await holo<{ mode: string; position: Vec }>(h, 'window.__holoml.view()', PAGE);
    expect(before.mode).toBe('walk');
    expect(before.position[1]).toBeCloseTo(1.7, 5);
    // W held until the walker has moved (drawn in software, frames come slowly).
    const moved = (p: Vec) => Math.hypot(p[0] - before.position[0], p[2] - before.position[2]);
    const after = await holdKeyUntil(h, PAGE, 'W', 'walked with W', () => holo<{ position: Vec }>(h, 'window.__holoml.view()', PAGE), (v) => moved(v.position) > 0.3);
    expect(moved(after.position)).toBeGreaterThan(0.3);
    expect(after.position[1]).toBeCloseTo(1.7, 5);
  });

  it('S5 Tab reaches every car by name; the text view lists the cars and links', async () => {
    const PAGE = 'index.holoml';
    await open(h, PAGE);
    const outline = await holo<string[]>(h, 'window.__holoml.outline()', PAGE);
    for (const name of CARS) expect(outline, name).toContain(`a:${name}`);
    expect(outline).toContain('a:About this showroom');
    await tabTo(h, PAGE, 'Tallberg');
    const box = await holo<{ visible: boolean }>(h, 'window.__holoml.highlight()', PAGE);
    expect(box.visible).toBe(true);
    await h.shell.click('hs-toolbar [data-testid="text-view"]');
    await waitFor('the text view', () => holo<boolean>(h, 'window.__holoml.textView', PAGE), (v) => v === true);
    const text = await inPage<string>(h, 'document.getElementById("holoml-outline-nav").innerText', PAGE);
    for (const name of CARS) expect(text).toContain(name);
    expect(text).toContain('A tall seven-seater for the mountains');
    expect(text).toContain('HoloML showroom');
    await h.shell.click('hs-toolbar [data-testid="text-view"]');
    await waitFor('3D again', () => holo<boolean>(h, 'window.__holoml.textView', PAGE), (v) => v === false);
  });

  it('S6 the hall draws while its turntable turns; an idle car page draws nothing', async () => {
    const HALL = 'index.holoml';
    await open(h, HALL);
    const f1 = await holo<number>(h, 'window.__holoml.frames', HALL);
    const r1 = (await holo<{ rotation: Vec }>(h, 'window.__holoml.object("turntable")', HALL))!.rotation[1];
    await sleep(1000);
    // It keeps drawing, on any machine; how many frames a second is the next check's.
    hallFrames = (await holo<number>(h, 'window.__holoml.frames', HALL)) - f1;
    expect(hallFrames).toBeGreaterThan(0);
    expect((await holo<{ rotation: Vec }>(h, 'window.__holoml.object("turntable")', HALL))!.rotation[1]).not.toBe(r1);
    const CAR = 'pippet.holoml';
    await open(h, CAR);
    const f2 = await sceneStill(h, CAR, await sceneWait(h, 10_000));
    await sleep(1500);
    expect(await holo<number>(h, 'window.__holoml.frames', CAR)).toBe(f2);
  });

  it('S6 the hall draws more than 10 frames a second while its turntable turns (with a graphics card)', async (ctx) => {
    expect(hallFrames, 'the check before this one counted the frames').not.toBeNull();
    // With a graphics card, more than 10 frames in the second; drawn in software (GitHub's machines),
    // measured and logged, and the check is skipped, not passed, as C9 and G9 are.
    const software = await softwareRenderer(h);
    if (software) {
      console.log(`S6: ${hallFrames} frames in a second; the frame-rate budget not checked: drawing in software (${software})`);
      ctx.skip(`the frame-rate budget is for graphics hardware; drawing in software (${software})`);
    }
    expect(hallFrames!).toBeGreaterThan(10);
  });

  it('S5 with reduced motion, the turntable stands still', async () => {
    const HALL = 'index.holoml';
    await open(h, HALL);
    await h.app.evaluate(async ({ webContents }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes('index.holoml')).pop()!;
      guest.debugger.attach('1.3');
      await guest.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    });
    try {
      await open(h, `${HALL}?still`);
      const r1 = (await holo<{ rotation: Vec }>(h, 'window.__holoml.object("turntable")', `${HALL}?still`))!.rotation[1];
      await sleep(800);
      expect((await holo<{ rotation: Vec }>(h, 'window.__holoml.object("turntable")', `${HALL}?still`))!.rotation[1]).toBe(r1);
    } finally {
      await h.app.evaluate(({ webContents }) => {
        for (const w of webContents.getAllWebContents()) if (w.getType() === 'webview' && w.debugger.isAttached()) w.debugger.detach();
      });
    }
  });

  it('S7 the about page credits the models, and the credits file is there', async () => {
    const PAGE = 'about.holoml';
    await open(h, PAGE);
    const labels = await holo<string[]>(h, 'window.__holoml.labels()', PAGE);
    expect(labels.some((l) => l.includes("Kenney's Car Kit (kenney.nl, CC0)"))).toBe(true);
    expect(existsSync(join(FIXTURES_DIR, 'holoml/showroom/models/CREDITS.md'))).toBe(true);
    const links = await holo<string[]>(h, 'window.__holoml.links()', PAGE);
    expect(links).toContain('https://github.com/srajpal/holoml/blob/main/SPEC.md');
    expect(links).toContain(url('index.holoml'));
  });
});

describe('the published showroom', () => {
  it('the start panel links to the showroom on GitHub Pages (opened only by a click)', async () => {
    const h = await launch(server.url('link-a.html'));
    try {
      await waitForPage(h, 'link-a.html');
      await pressInShell(h, 'T', ['control']);
      const link = h.shell.locator('[data-testid="start-showroom"]');
      await link.waitFor({ state: 'visible' });
      expect(await link.getAttribute('data-url')).toBe('https://srajpal.github.io/holoml/showroom/index.holoml');
      expect(await link.innerText()).toContain('HoloML showroom');
    } finally {
      await h.close();
    }
  });
});

describe('HoloML pages in a development run (pnpm dev)', () => {
  // Found after milestone 16 (owner, prompt 82): in pnpm dev the viewer
  // comes from the renderer's dev server, which answered its HTML page for
  // the viewer's address, so every HoloML page stayed blank. Here the dev
  // server is started on its own (Vite, as electron-vite starts it) and
  // the built app is pointed at it, in a throwaway profile, offline.
  it('the showroom and compressed models draw with the viewer served by the dev server', async () => {
    const req = createRequire(join(APP_DIR, 'package.json'));
    // Vite belongs to the browser package (tests do not import it directly).
    type DevServer = { listen(): Promise<unknown>; close(): Promise<void>; resolvedUrls: { local: string[] } | null };
    const vite = (await import(pathToFileURL(req.resolve('vite')).href)) as { createServer(options: object): Promise<DevServer> };
    // As electron.vite.config.ts sets it up: the viewer's imports prepared at start.
    const { VIEWER_DEPS, VIEWER_UNPREPARED } = (await import(pathToFileURL(join(APP_DIR, 'viewer-deps.mjs')).href)) as {
      VIEWER_DEPS: string[];
      VIEWER_UNPREPARED: string[];
    };
    const dev = await vite.createServer({
      root: join(APP_DIR, 'src/renderer'),
      configFile: false,
      logLevel: 'warn',
      optimizeDeps: { include: VIEWER_DEPS, exclude: VIEWER_UNPREPARED },
      server: { port: 0, host: '127.0.0.1' },
    });
    await dev.listen();
    const devUrl = dev.resolvedUrls!.local[0]!.replace(/\/$/, '');
    const profile = mkdtempSync(join(tmpdir(), 'hypersol-e2e-dev-'));
    const env = { ...process.env, HYPERSOL_TEST: '1', HYPERSOL_TEST_BACKGROUND: '1', ELECTRON_RENDERER_URL: devUrl } as Record<string, string>;
    delete env['ELECTRON_RUN_AS_NODE'];
    const app = await electron.launch({
      executablePath: req('electron') as unknown as string,
      args: [APP_DIR, `--start-url=${url('index.holoml')}`, `--hypersol-user-data=${profile}`, OFFLINE_RULES, ...graphicsSwitches()],
      env,
    });
    try {
      await app.firstWindow();
      const scene = () =>
        app.evaluate(async ({ webContents }) => {
          const page = webContents.getAllWebContents().find((w) => w.getType() === 'webview' && w.getURL().includes('index.holoml'));
          return page ? ((await page.executeJavaScript('window.__holoml ? { ready: window.__holoml.ready, models: window.__holoml.models().map((m) => m.state) } : null')) as { ready: boolean; models: string[] } | null) : null;
        });
      const done = await waitFor('the showroom drawn in a development run', scene, (s) => s?.ready === true, 30_000);
      expect(done!.models).toHaveLength(11);
      expect(done!.models.every((m) => m === 'loaded')).toBe(true);
      // Compressed models (milestone 25), whose decoders the dev server serves too: Draco, meshopt, and a KTX2
      // picture. The Draco and KTX2 decoders were not found in a development run (owner, prompt 194).
      const compressed = server.url('holoml/compressed/index.holoml');
      await app.evaluate(({ webContents }, address) => {
        const page = webContents.getAllWebContents().find((w) => w.getType() === 'webview' && w.getURL().includes('index.holoml'))!;
        void page.loadURL(address);
      }, compressed);
      const models = () =>
        app.evaluate(async ({ webContents }) => {
          const page = webContents.getAllWebContents().find((w) => w.getType() === 'webview' && w.getURL().includes('compressed/index.holoml'));
          return page
            ? ((await page.executeJavaScript(
                'window.__holoml ? { ready: window.__holoml.ready, models: window.__holoml.models().map((m) => m.state), pictures: window.__holoml.models().map((m) => Object.values(m.materials).filter((x) => x.map !== null).length) } : null',
              )) as { ready: boolean; models: string[]; pictures: number[] } | null)
            : null;
        });
      const squeezed = await waitFor('the compressed models in a development run', models, (s) => s?.ready === true, 30_000);
      expect(squeezed!.models, JSON.stringify(squeezed)).toEqual(['loaded', 'loaded', 'loaded']);
      // And the KTX2 box has its picture: a model whose picture could not be decoded still loads, without it.
      expect(squeezed!.pictures[2], JSON.stringify(squeezed)).toBeGreaterThan(0);
    } finally {
      await app.close();
      await dev.close();
      await removeFolder(profile);
    }
  }, 90_000);
});
