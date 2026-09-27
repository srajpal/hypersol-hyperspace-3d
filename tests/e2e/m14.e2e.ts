/**
 * Milestone 14 end-to-end checks P1 to P11 (TODO.md): HoloML pages in the
 * browser. The pages and models are in tests/fixtures/holoml, served from
 * 127.0.0.1; the viewer's read-only facts are window.__holoml in the page.
 */
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIXTURES_DIR, startFixtureServer, type FixtureServer } from './fixture-server';
import {
  clickAt,
  clickUntil,
  focusedTab,
  inPage,
  launch,
  pressInPage,
  pressInShell,
  project,
  removeFolder,
  shellCall,
  sleep,
  tabs,
  waitFor,
  waitForPage,
  type Harness,
  type Point,
} from './harness';

let server: FixtureServer;
const folders: string[] = [];

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
  for (const f of folders) await removeFolder(f);
});

type Vec = [number, number, number];
interface View {
  mode: string;
  position: Vec;
  target: Vec;
}
interface Model {
  src: string;
  state: string;
  materials: Record<string, { color: string; metalness: number; roughness: number; opacity: number }>;
  animation: { name: string; playing: boolean; time: number } | null;
}

/** The viewer's facts in a HoloML page (an address part picks the page). */
function holo<T>(h: Harness, expression: string, page: string): Promise<T> {
  return inPage<T>(h, `window.__holoml ? (${expression}) : undefined`, page);
}

async function sceneReady(h: Harness, page: string): Promise<void> {
  await waitFor('the scene ready', () => holo<boolean>(h, 'window.__holoml.ready', page), (r) => r === true, 20_000);
}

async function open(h: Harness, url: string, page: string): Promise<void> {
  await shellCall(h, 'showUrl', url);
  await waitForPage(h, page);
  await sceneReady(h, page);
}

const distance = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Where something in the scene is on the screen: by id, or a link by its index. */
async function screenOf(h: Harness, which: string | number, page: string): Promise<Point> {
  const p = await waitFor(`${String(which)} on screen`, () => holo<Point | null>(h, `window.__holoml.point(${JSON.stringify(which)})`, page), (v) => v !== null);
  return project(h, p!.x, p!.y);
}

/** Holds a key in the page for a while (walking needs it held). */
async function holdKey(h: Harness, page: string, keyCode: string, ms: number): Promise<void> {
  const send = (type: 'keyDown' | 'keyUp') =>
    h.app.evaluate(
      ({ webContents }, { page, keyCode, type }) => {
        const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop();
        guest?.sendInputEvent({ type, keyCode });
      },
      { page, keyCode, type },
    );
  await send('keyDown');
  await sleep(ms);
  await send('keyUp');
}

/** Touch input into the page, through the page's own debugger connection. */
async function touchDrag(h: Harness, page: string, from: Point, to: Point, fingers = 1): Promise<void> {
  await h.app.evaluate(
    async ({ webContents }, { page, from, to, fingers }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop()!;
      const dbg = guest.debugger;
      dbg.attach('1.3');
      const pts = (p: { x: number; y: number }) => Array.from({ length: fingers }, (_, i) => ({ x: p.x + i * 40, y: p.y, id: i }));
      try {
        await dbg.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) });
        for (let k = 1; k <= 10; k++) {
          const p = { x: from.x + ((to.x - from.x) * k) / 10, y: from.y + ((to.y - from.y) * k) / 10 };
          await dbg.sendCommand('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(p) });
          await new Promise((r) => setTimeout(r, 16));
        }
        await dbg.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } finally {
        dbg.detach();
      }
    },
    { page, from, to, fingers },
  );
}

describe('P1, P2, P3, P5, P7, P10: a still scene', () => {
  let h: Harness;
  const PAGE = 'still.holoml';
  beforeAll(async () => {
    h = await launch(server.url('holoml/still.holoml'));
    await waitForPage(h, PAGE);
    await sceneReady(h, PAGE);
  });
  afterAll(async () => h?.close());

  it('P1 shows the scene across the window; the tab has its title and address', async () => {
    const tab = await focusedTab(h);
    expect(tab.url).toBe(server.url('holoml/still.holoml'));
    await waitFor('the title', async () => (await focusedTab(h)).title, (t) => t === 'HoloML still scene');
    expect(await shellCall(h, 'holoml')).toEqual({ fill: true, shown: true });
    const layout = await shellCall(h, 'layout');
    expect(layout.rotationY).toBe(0); // flat, not tilted
    expect(await inPage<boolean>(h, 'Boolean(document.querySelector("[data-testid=holoml-canvas]"))', PAGE)).toBe(true);
    expect(await holo(h, 'window.__holoml.error', PAGE)).toBeNull();
    // The page's own text is not shown, and zoom and the layers view are off for a scene.
    expect(await inPage<number>(h, 'document.querySelectorAll("body > pre").length', PAGE)).toBe(0);
    const toolbar = await h.shell.locator('hs-toolbar [data-testid="layers"]').isDisabled();
    expect(toolbar).toBe(true);
  });

  it('P2 places the models and changes their materials', async () => {
    const models = await holo<Model[]>(h, 'window.__holoml.models()', PAGE);
    const car = models[0]!;
    expect(car.state).toBe('loaded');
    expect(car.materials['Paint']).toEqual({ color: '#c0182a', metalness: 0.7, roughness: 0.3, opacity: 1 });
    expect(car.materials['Glass']!.opacity).toBeCloseTo(0.35, 5);
    expect(models[1]!.materials['Paint']!.color).not.toBe('#c0182a'); // the other car keeps its own paint
    const stand = await holo<{ position: Vec; rotation: Vec; scale: Vec }>(h, 'window.__holoml.object("stand")', PAGE);
    expect(stand.position).toEqual([4, 0, -1]);
    expect(stand.rotation[1]).toBeCloseTo(45, 5);
    expect(stand.scale).toEqual([0.5, 0.5, 0.5]);
    const turned = await holo<{ rotation: Vec }>(h, 'window.__holoml.object("car")', PAGE);
    expect(turned.rotation[1]).toBeCloseTo(30, 5);
  });

  it('P5 labels carry their text (findable in the page), and the lights are the page\'s own', async () => {
    expect(await holo<string[]>(h, 'window.__holoml.labels()', PAGE)).toEqual(['More cars', 'The red car']);
    expect(await inPage<string>(h, 'document.getElementById("holoml-labels").textContent', PAGE)).toContain('The red car');
    const lights = await holo<{ type: string; intensity: number; default: boolean }[]>(h, 'window.__holoml.lights()', PAGE);
    expect(lights.filter((l) => !l.default).map((l) => l.type).sort()).toEqual(['ambient', 'directional', 'point', 'spot']);
    expect(lights.some((l) => l.default)).toBe(false);
  });

  it('P7 refuses a model from another site, and the page reaches neither Node nor the browser', async () => {
    const models = await holo<Model[]>(h, 'window.__holoml.models()', PAGE);
    expect(models.find((m) => m.src.startsWith('http://localhost'))!.state).toBe('refused');
    // The page's content policy enforces the same, whatever the viewer does.
    const other = await inPage<string>(h, 'fetch("http://localhost:1/x").then(() => "fetched", (e) => "refused: " + e.name)', PAGE);
    expect(other).toMatch(/^refused/);
    const own = await inPage<number>(h, 'fetch("models/placeholder-car.gltf").then((r) => r.status)', PAGE);
    expect(own).toBe(200);
    expect(await inPage<string>(h, '[typeof require, typeof process, typeof window.hypersol].join()', PAGE)).toBe('undefined,undefined,undefined');
  });

  it('P10 an idle scene draws nothing', async () => {
    await sleep(500);
    const before = await holo<number>(h, 'window.__holoml.frames', PAGE);
    await sleep(1500);
    expect(await holo<number>(h, 'window.__holoml.frames', PAGE)).toBe(before);
  });

  it('P3 orbit: the keyboard, a drag, the wheel, and touch move the view around its point', async () => {
    const start = (await holo<View>(h, 'window.__holoml.view()', PAGE))!;
    expect(start.mode).toBe('orbit');
    expect(start.position.map((v) => Math.round(v * 100) / 100)).toEqual([0, 1.6, 7]);
    expect(start.target).toEqual([0, 0.8, 0]);
    const radius = distance(start.position, start.target);
    // Keyboard: a click on empty space gives the page the keys.
    const empty = await project(h, 20, 20);
    await clickAt(h, empty);
    for (let i = 0; i < 6; i++) await pressInPage(h, 'Left', [], PAGE);
    const turned = await waitFor('turned by keys', () => holo<View>(h, 'window.__holoml.view()', PAGE), (v) => v.position[0] !== start.position[0]);
    expect(distance(turned.position, turned.target)).toBeCloseTo(radius, 3);
    await pressInPage(h, 'Plus', [], PAGE);
    const closer = await waitFor('closer', () => holo<View>(h, 'window.__holoml.view()', PAGE), (v) => distance(v.position, v.target) < radius - 0.1);
    expect(distance(closer.position, closer.target)).toBeLessThan(radius);
    // A mouse drag goes around; the wheel comes closer.
    const a = await project(h, 300, 300);
    const b = await project(h, 450, 300);
    await h.shell.mouse.move(a.x, a.y);
    await h.shell.mouse.down();
    await h.shell.mouse.move(b.x, b.y, { steps: 8 });
    await h.shell.mouse.up();
    const dragged = await holo<View>(h, 'window.__holoml.view()', PAGE);
    expect(dragged.position[0]).not.toBeCloseTo(closer.position[0], 2);
    await h.shell.mouse.wheel(0, -400);
    await waitFor('wheel', () => holo<View>(h, 'window.__holoml.view()', PAGE), (v) => distance(v.position, v.target) < distance(dragged.position, dragged.target) - 0.05);
    // Touch: one finger goes around.
    const before = await holo<View>(h, 'window.__holoml.view()', PAGE);
    await touchDrag(h, PAGE, { x: 300, y: 300 }, { x: 420, y: 300 });
    await waitFor('touch', () => holo<View>(h, 'window.__holoml.view()', PAGE), (v) => Math.abs(v.position[0] - before.position[0]) > 0.01);
  });
});

describe('P4: links', () => {
  let h: Harness;
  const PAGE = 'still.holoml';
  beforeAll(async () => {
    h = await launch(server.url('holoml/still.holoml'));
    await waitForPage(h, PAGE);
    await sceneReady(h, PAGE);
  });
  afterAll(async () => h?.close());

  it('a click on a linked model opens its page, Back returns, and a linked label works too', async () => {
    expect(await holo<string[]>(h, 'window.__holoml.links()', PAGE)).toEqual([server.url('holoml/second.holoml'), server.url('holoml/second.holoml#top')]);
    await clickUntil(h, await screenOf(h, 0, PAGE), 'the second page', async () => (await focusedTab(h)).url === server.url('holoml/second.holoml'));
    await sceneReady(h, 'second.holoml');
    await pressInShell(h, 'Left', ['alt']);
    await waitFor('back', async () => (await focusedTab(h)).url, (u) => u === server.url('holoml/still.holoml'));
    await sceneReady(h, PAGE);
    await clickUntil(h, await screenOf(h, 1, PAGE), 'the label link', async () => (await focusedTab(h)).url === server.url('holoml/second.holoml#top'));
  });

  it('Tab reaches a link from the keyboard, and Enter follows it', async () => {
    await pressInShell(h, 'Left', ['alt']);
    await waitFor('back', async () => (await focusedTab(h)).url, (u) => u === server.url('holoml/still.holoml'));
    await sceneReady(h, PAGE);
    await clickAt(h, await project(h, 20, 20));
    await pressInPage(h, 'Tab', [], PAGE);
    await waitFor('a link focused', () => inPage<string>(h, 'document.activeElement?.getAttribute("href") ?? ""', PAGE), (href) => href.endsWith('second.holoml'));
    await pressInPage(h, 'Enter', [], PAGE);
    await waitFor('followed', async () => (await focusedTab(h)).url, (u) => u === server.url('holoml/second.holoml'));
  });
});

describe('P3 walk, P5 animation, P10 drawing only while moving', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('holoml/walk.holoml'));
    await waitForPage(h, 'walk.holoml');
    await sceneReady(h, 'walk.holoml');
  });
  afterAll(async () => h?.close());

  it('P3 walk: keys move over the floor at eye height; a drag and touch look around', async () => {
    const PAGE = 'walk.holoml';
    const start = (await holo<View>(h, 'window.__holoml.view()', PAGE))!;
    expect(start.mode).toBe('walk');
    await clickAt(h, await project(h, 20, 20));
    await holdKey(h, PAGE, 'W', 600);
    const walked = await holo<View>(h, 'window.__holoml.view()', PAGE);
    expect(walked.position[2]).toBeLessThan(start.position[2] - 0.3); // forward is toward the car
    expect(walked.position[1]).toBeCloseTo(1.7, 5);
    await holdKey(h, PAGE, 'Right', 400);
    const aside = await holo<View>(h, 'window.__holoml.view()', PAGE);
    expect(aside.position[0]).toBeGreaterThan(walked.position[0] + 0.2);
    const a = await project(h, 300, 300);
    const b = await project(h, 420, 300);
    await h.shell.mouse.move(a.x, a.y);
    await h.shell.mouse.down();
    await h.shell.mouse.move(b.x, b.y, { steps: 8 });
    await h.shell.mouse.up();
    const looked = await holo<View>(h, 'window.__holoml.view()', PAGE);
    expect(looked.position).toEqual(aside.position);
    expect(looked.target[0]).not.toBeCloseTo(aside.target[0], 2);
    await touchDrag(h, PAGE, { x: 300, y: 300 }, { x: 300, y: 380 });
    await waitFor('touch look', () => holo<View>(h, 'window.__holoml.view()', PAGE), (v) => Math.abs(v.target[1] - looked.target[1]) > 0.01);
  });

  it('P5 animate turns and moves things; a model plays its own animation, or holds its first frame', async () => {
    const PAGE = 'animated.holoml';
    await open(h, server.url('holoml/animated.holoml'), PAGE);
    const r1 = (await holo<{ rotation: Vec }>(h, 'window.__holoml.object("turntable")', PAGE))!.rotation[1];
    await sleep(300);
    const r2 = (await holo<{ rotation: Vec }>(h, 'window.__holoml.object("turntable")', PAGE))!.rotation[1];
    expect(r2).not.toBeCloseTo(r1, 1);
    // The label rises once, in 400 ms, and stays at its end.
    await waitFor('risen', async () => (await holo<{ position: Vec }>(h, 'window.__holoml.object("sign")', PAGE))!.position[1], (y) => y === 3, 5000);
    const models = await holo<Model[]>(h, 'window.__holoml.models()', PAGE);
    const spin = models.find((m, i) => i === 1)!;
    const pose = models.find((m, i) => i === 2)!;
    expect(spin.animation).toMatchObject({ name: 'Spin', playing: true });
    expect(pose.animation).toEqual({ name: 'Spin', playing: false, time: 0 });
    await sleep(300);
    const later = await holo<Model[]>(h, 'window.__holoml.models()', PAGE);
    expect(later[1]!.animation!.time).not.toBe(spin.animation!.time);
    // P10: an animated scene keeps drawing.
    const f1 = await holo<number>(h, 'window.__holoml.frames', PAGE);
    await sleep(500);
    expect(await holo<number>(h, 'window.__holoml.frames', PAGE)).toBeGreaterThan(f1 + 5);
  });

  it('P10 a scene whose animation has finished stops drawing', async () => {
    const PAGE = 'still-animated-once.holoml';
    await open(h, server.url('holoml/still-animated-once.holoml'), PAGE);
    await waitFor('finished', async () => (await holo<{ position: Vec }>(h, 'window.__holoml.object("sign")', PAGE))!.position[1], (y) => y === 2, 5000);
    await sleep(300);
    const before = await holo<number>(h, 'window.__holoml.frames', PAGE);
    await sleep(1000);
    expect(await holo<number>(h, 'window.__holoml.frames', PAGE)).toBe(before);
  });
});

describe('P1 by type or address, P6 mistakes, P11 the default light', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('holoml/by-type'), { userDataDir: undefined });
    await waitForPage(h, 'by-type');
    await sceneReady(h, 'by-type');
  });
  afterAll(async () => h?.close());

  it('P1 a page is known by its media type alone, or by its address alone', async () => {
    expect(await shellCall(h, 'holoml')).toEqual({ fill: true, shown: true });
    await waitFor('title', async () => (await focusedTab(h)).title, (t) => t === 'HoloML still scene');
    await open(h, server.url('holoml/as-text.holoml'), 'as-text.holoml');
    await waitFor('title', async () => (await focusedTab(h)).title, (t) => t === 'Second HoloML page');
    // A page with no light is lit softly.
    const lights = await holo<{ default: boolean }[]>(h, 'window.__holoml.lights()', 'as-text.holoml');
    expect(lights.length).toBeGreaterThan(0);
    expect(lights.every((l) => l.default)).toBe(true);
  });

  it('P6 a syntax error shows its card with the line and column; nothing else is drawn', async () => {
    await shellCall(h, 'showUrl', server.url('holoml/mistake.holoml'));
    await waitForPage(h, 'mistake.holoml');
    await sceneReady(h, 'mistake.holoml');
    expect(await holo(h, 'window.__holoml.error', 'mistake.holoml')).toEqual({
      code: 'unclosed-value',
      message: 'The value of "background" is never closed with "',
      line: 5,
      column: 21,
    });
    const card = await inPage<string>(h, 'document.querySelector("[data-testid=holoml-error]").innerText', 'mistake.holoml');
    expect(card).toContain('Line 5, column 21');
    expect(card).toContain('<scene background="#000>');
  });

  it('P6 problems are listed in the instrument panel\'s console, and the rest of the scene shows', async () => {
    await pressInShell(h, 'I', ['control', 'shift']);
    await waitFor('panel open', () => shellCall(h, 'instruments'), (s) => s.open);
    await open(h, server.url('holoml/problems.holoml'), 'problems.holoml');
    const problems = await holo<{ code: string; line: number }[]>(h, 'window.__holoml.problems', 'problems.holoml');
    expect(problems.map((p) => p.code)).toEqual(['unknown-element', 'unknown-attribute', 'unsafe-link']);
    const s = await waitFor('console', () => shellCall(h, 'instruments'), (x) => x.console.filter((c: string) => c.includes('HoloML: line')).length >= 3);
    expect(s.console.join('\n')).toContain('HoloML: line 6, column 5: <cube> is not a HoloML 0.1 element');
    const models = await holo<Model[]>(h, 'window.__holoml.models()', 'problems.holoml');
    expect(models[0]!.state).toBe('loaded');
    expect(await holo<string[]>(h, 'window.__holoml.labels()', 'problems.holoml')).toEqual(['Still shown', 'Not a link']);
    // P7: the javascript: address is not a link.
    expect(await holo<string[]>(h, 'window.__holoml.links()', 'problems.holoml')).toEqual([]);
  });

  it('P7 the page\'s requests pass through the shield and show in the network list', async () => {
    const s = await waitFor('network', () => shellCall(h, 'instruments'), (x) => x.net > 0);
    expect(s.net).toBeGreaterThan(0);
    const log = await h.app.evaluate(() => (globalThis as unknown as { __hypersolTest: { requests: string[] } }).__hypersolTest.requests);
    expect(log.some((u) => u.endsWith('/holoml/models/placeholder-car.gltf'))).toBe(true);
  });
});

describe('P8: browser features keep the address', () => {
  it('history, bookmarks, reopening a closed tab, restoring after a restart, and private tabs', async () => {
    const profile = mkdtempSync(join(tmpdir(), 'hypersol-e2e-profile-'));
    folders.push(profile);
    writeFileSync(join(profile, 'settings.json'), JSON.stringify({ onStartup: 'last-tabs' }));
    const URL = server.url('holoml/still.holoml');
    let h = await launch(URL, { userDataDir: profile });
    try {
      await waitForPage(h, 'still.holoml');
      await sceneReady(h, 'still.holoml');
      await waitFor('title', async () => (await focusedTab(h)).title, (t) => t === 'HoloML still scene');
      // History and a bookmark.
      const history = await waitFor(
        'history',
        () => h.shell.evaluate(() => (window as unknown as { hypersol: { data(r: object): Promise<{ ok: boolean; value: { url: string; title: string }[] }> } }).hypersol.data({ op: 'history.recent', limit: 10 })),
        (r) => r.ok && r.value.some((e) => e.url === URL && e.title === 'HoloML still scene'),
      );
      expect(history.ok).toBe(true);
      await pressInShell(h, 'D', ['control']);
      await waitFor('bookmarked', () => h.shell.locator('hs-toolbar [data-testid="star"]').getAttribute('aria-pressed'), (v) => v === 'true');
      // Reopen a closed tab: it comes back as a scene.
      await pressInShell(h, 'T', ['control']);
      await waitFor('two tabs', async () => (await tabs(h)).length, (n) => n === 2);
      await shellCall(h, 'showUrl', server.url('holoml/second.holoml'));
      await sceneReady(h, 'second.holoml');
      await pressInShell(h, 'W', ['control']);
      await waitFor('closed', async () => (await tabs(h)).length, (n) => n === 1);
      await pressInShell(h, 'T', ['control', 'shift']);
      await waitFor('reopened', async () => (await focusedTab(h)).url, (u) => u === server.url('holoml/second.holoml'));
      await sceneReady(h, 'second.holoml');
      expect(await shellCall(h, 'holoml')).toEqual({ fill: true, shown: true });
    } finally {
      await h.close();
    }
    // Restored after a restart.
    h = await launch('', { userDataDir: profile });
    try {
      await waitFor('restored', async () => (await tabs(h)).map((t) => t.url).sort(), (u) => u.includes(URL) && u.includes(server.url('holoml/second.holoml')));
      await sceneReady(h, 'second.holoml');
      // A private tab shows scenes too, and keeps no history.
      await pressInShell(h, 'N', ['control', 'shift']);
      await waitFor('private tab', () => focusedTab(h), (t) => t.private);
      await shellCall(h, 'showUrl', server.url('holoml/walk.holoml'));
      await sceneReady(h, 'walk.holoml');
      expect(await shellCall(h, 'holoml')).toEqual({ fill: true, shown: true });
      await sleep(500);
      const recent = await h.shell.evaluate(() => (window as unknown as { hypersol: { data(r: object): Promise<{ value: { url: string }[] }> } }).hypersol.data({ op: 'history.recent', limit: 50 }));
      expect(recent.value.some((e) => e.url.includes('walk.holoml'))).toBe(false);
    } finally {
      await h.close();
    }
  });
});

describe('P9: HoloML files on the computer', () => {
  let h: Harness;
  let folder: string;
  beforeAll(async () => {
    folder = mkdtempSync(join(tmpdir(), 'hypersol-holoml-'));
    folders.push(folder);
    const page = join(folder, 'page');
    mkdirSync(join(page, 'models'), { recursive: true });
    for (const f of ['local.holoml', 'second.holoml']) copyFileSync(join(FIXTURES_DIR, 'holoml', f), join(page, f));
    copyFileSync(join(FIXTURES_DIR, 'holoml', 'models', 'placeholder-car.gltf'), join(page, 'models', 'placeholder-car.gltf'));
    // A model beside the opened folder, outside it.
    copyFileSync(join(FIXTURES_DIR, 'holoml', 'models', 'placeholder-car.gltf'), join(folder, 'outside.gltf'));
    h = await launch(server.url('holoml/second.holoml'));
    await waitForPage(h, 'second.holoml');
  });
  afterAll(async () => h?.close());

  const openLocal = (path: string) =>
    h.app.evaluate(async (_e, p) => (globalThis as unknown as { __hypersolTest: { openLocal(p: string): Promise<string | null> } }).__hypersolTest.openLocal(p), path);

  it('opens a file with its models from its folder, and not from outside it', async () => {
    expect(await openLocal(join(folder, 'outside.gltf'))).toBeNull(); // only .holoml files open
    const url = (await openLocal(join(folder, 'page', 'local.holoml')))!;
    expect(url).toMatch(/^hypersol-file:\/\/[0-9a-f]{16}\/local\.holoml$/);
    await open(h, url, 'local.holoml');
    await waitFor('title', async () => (await focusedTab(h)).title, (t) => t === 'HoloML from the computer');
    const models = await holo<Model[]>(h, 'window.__holoml.models()', 'local.holoml');
    expect(models.map((m) => m.state)).toEqual(['loaded', 'failed']);
    // A link to another file in the folder works.
    await clickUntil(h, await screenOf(h, 0, 'local.holoml'), 'next file', async () => (await focusedTab(h)).url === url.replace('local.holoml', 'second.holoml'));
    await sceneReady(h, 'hypersol-file');
  });

  it('a web page cannot reach a local file, and an address from an earlier run asks to open it again', async () => {
    const url = (await openLocal(join(folder, 'page', 'local.holoml')))!;
    await open(h, server.url('holoml/second.holoml'), 'holoml/second.holoml');
    await inPage(h, `location.href = ${JSON.stringify(url)}; true`, 'holoml/second.holoml');
    await sleep(800);
    expect((await focusedTab(h)).url).toBe(server.url('holoml/second.holoml'));
    const made = url.replace(/\/\/[0-9a-f]{16}\//, '//0123456789abcdef/');
    await shellCall(h, 'showUrl', made);
    await waitForPage(h, '0123456789abcdef');
    expect(await inPage<string>(h, 'document.body.innerText', '0123456789abcdef')).toContain('Open it again');
  });
});

describe('P11: without WebGL 2', () => {
  it('a HoloML page says it cannot be shown', async () => {
    const h = await launch(server.url('holoml/still.holoml'), { noWebGL: true });
    try {
      await waitForPage(h, 'still.holoml');
      await sceneReady(h, 'still.holoml');
      expect(await holo<boolean>(h, 'window.__holoml.noWebGL', 'still.holoml')).toBe(true);
      expect(await inPage<string>(h, 'document.querySelector("[data-testid=holoml-error]").innerText', 'still.holoml')).toContain(
        "This computer can't draw 3D scenes",
      );
    } finally {
      await h.close();
    }
  });
});
