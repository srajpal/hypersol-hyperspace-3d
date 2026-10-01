/**
 * Milestone 20 end-to-end checks (TODO.md): HoloML 0.2's fourth part and
 * the sneaker store. W2 to W5: loading by area, stand-ins, scripts, and
 * the limits. W6 to W10: the sneaker store (a copy in
 * tests/fixtures/holoml/sneaker-store). W1 (the language) is the holoml
 * repository's tests; W11 (the published site) is checked by hand.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  clickUntil,
  focusedTab,
  holdKeyUntil,
  inPage,
  launch,
  pressInPage,
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
} from './harness';

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

type Vec = [number, number, number];
type StandIn = { src: string; state: string; shown: boolean };
type AreaModel = { id: string | null; src: string; state: string; reason: string | null; standIn: StandIn | null };
type Area = { id: string | null; near: number; in: boolean; loaded: boolean; distance: number; models: AreaModel[] };
type Totals = { bytes: number; triangles: number; modelFiles: number };
type Colour = { r: number; g: number; b: number };

const url = (page: string) => server.url(`holoml/${page}`);

function holo<T>(h: Harness, expression: string, page: string): Promise<T> {
  return inPage<T>(h, `window.__holoml ? (${expression}) : undefined`, page);
}

async function ready(h: Harness, page: string, timeoutMs = 20_000): Promise<void> {
  await waitFor(`${page} ready`, () => holo<boolean>(h, 'window.__holoml.ready', page), (r) => r === true, timeoutMs);
}

/** Opens a page in the harness's tab and waits until it is ready (or, with `wait` false, until its viewer runs). */
async function openPage(h: Harness, page: string, wait = true): Promise<void> {
  await shellCall(h, 'showUrl', url(page));
  await waitForPage(h, page, await sceneWait(h, 15_000));
  if (wait) await ready(h, page, await sceneWait(h, 20_000));
  else await waitFor(`${page}'s viewer`, () => holo<number>(h, 'window.__holoml.version === "0.2" ? 1 : 0', page), (v) => v === 1, await sceneWait(h, 15_000));
}

const areas = (h: Harness, page: string) => holo<Area[]>(h, 'window.__holoml.areas()', page);
const area = async (h: Harness, page: string, id: string) => (await areas(h, page)).find((a) => a.id === id)!;
const totals = (h: Harness, page: string) => holo<Totals>(h, 'window.__holoml.totals()', page);
const hits = (path: string) => [...server.hits].filter(([k]) => k.startsWith(path)).reduce((n, [, v]) => n + v, 0);
/** Moves the viewer through the page's scene API (a 0.2 page's own script could do the same). */
const moveTo = (h: Harness, page: string, eye: Vec) => inPage<void>(h, `void (holoml.viewer.position = ${JSON.stringify(eye)})`, page);

/** The page's own pixels as drawn: the average colour in a small square around a point (page pixels). */
function colourAt(h: Harness, page: string, p: Point, half = 3): Promise<Colour> {
  return h.app.evaluate(
    async ({ webContents }, { page, p, half }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop()!;
      const image = await guest.capturePage();
      const { width, height } = image.getSize();
      const scale = width / ((await guest.executeJavaScript('window.innerWidth')) as number);
      const px = image.toBitmap(); // BGRA
      let [r, g, b, n] = [0, 0, 0, 0];
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const [X, Y] = [Math.round(p.x * scale) + dx, Math.round(p.y * scale) + dy];
          if (X < 0 || Y < 0 || X >= width || Y >= height) continue;
          const i = (Y * width + X) * 4;
          b += px[i]!;
          g += px[i + 1]!;
          r += px[i + 2]!;
          n++;
        }
      }
      return { r: r / n, g: g / n, b: b / n };
    },
    { page, p, half },
  );
}

/** The stand-in block's orange, lit and tone mapped (the car is grey, the background dark blue). */
const orange = (c: Colour) => c.r > 150 && c.r - c.b > 90;

describe('W2 to W5: loading by area', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
  });
  afterAll(async () => h?.close());

  it('W2 a far group is not fetched at first; walking near loads it; walking away lets it go and its bytes stop counting; a group near the start loads with the page', async () => {
    const PAGE = 'areas.holoml';
    const FAR_BOX = '/holoml/gen/box.gltf?tris=3000&mb=2&n=far';
    const FAR_CAR = '/holoml/gen/late-car.gltf?gate=far-car';
    const NEAR_BOX = '/holoml/gen/box.gltf?tris=2000&mb=1&n=near';
    await openPage(h, PAGE);
    // Ready: the group near the start has loaded with the page; nothing of the far one was asked for.
    let near = await area(h, PAGE, 'near-shelf');
    expect(near).toMatchObject({ in: true, loaded: true });
    expect(near.models[0]).toMatchObject({ id: 'near-box', state: 'loaded' });
    let far = await area(h, PAGE, 'far-shelf');
    expect(far).toMatchObject({ in: false, loaded: false, near: 8 });
    expect(far.models.map((m) => m.state)).toEqual(['waiting', 'waiting']);
    expect(hits(FAR_BOX)).toBe(0);
    expect(hits(FAR_CAR)).toBe(0);
    expect(hits(NEAR_BOX)).toBe(1);
    const atStart = await totals(h, PAGE);
    // The near box's 2,000 triangles and the far car's stand-in's 12.
    expect(atStart.triangles).toBe(2012);

    // Away from the start (29 m): the near group is let go, and its bytes and triangles stop counting.
    await moveTo(h, PAGE, [0, 1.6, -29]);
    near = await waitFor('the near group let go', () => area(h, PAGE, 'near-shelf'), (a) => !a.in && a.models[0]!.state === 'waiting', await sceneWait(h, 5000));
    expect(near.loaded).toBe(false);
    await waitFor('its bytes no longer counted', () => totals(h, PAGE), (t) => t.triangles === 12 && t.bytes < atStart.bytes - 1024 * 1024);
    expect(hits(FAR_BOX)).toBe(0);

    // Walking on towards the far group: within 8 m it loads.
    far = await holdKeyUntil(h, PAGE, 'W', 'the far group within reach', () => area(h, PAGE, 'far-shelf'), (a) => a.in, 8000);
    expect(far.distance).toBeLessThanOrEqual(8);
    await waitFor('the far box loaded', () => area(h, PAGE, 'far-shelf'), (a) => a.models.find((m) => m.id === 'far-box')!.state === 'loaded', await sceneWait(h, 10_000));
    expect(hits(FAR_BOX)).toBe(1);
    // The car is asked for, and held back by the fixture server: the group is not loaded until it arrives.
    expect(hits(FAR_CAR)).toBe(1);
    expect(await area(h, PAGE, 'far-shelf')).toMatchObject({ loaded: false });
    server.release('far-car');
    far = await waitFor('the far group loaded', () => area(h, PAGE, 'far-shelf'), (a) => a.loaded, await sceneWait(h, 10_000));
    expect(far.models.map((m) => m.state)).toEqual(['loaded', 'loaded']);
    const there = await totals(h, PAGE);
    expect(there.triangles).toBeGreaterThan(12 + 3000);

    // Back at the start: the far group is let go (its bytes and triangles too), and the near one loads again.
    await moveTo(h, PAGE, [0, 1.6, 0]);
    far = await waitFor('the far group let go', () => area(h, PAGE, 'far-shelf'), (a) => !a.in && a.models.every((m) => m.state === 'waiting'), await sceneWait(h, 5000));
    await waitFor('the near group loaded again', () => area(h, PAGE, 'near-shelf'), (a) => a.loaded, await sceneWait(h, 10_000));
    expect(hits(NEAR_BOX)).toBe(2);
    expect(await totals(h, PAGE)).toEqual(atStart);
    // Nothing was left out on the way.
    expect(await holo<unknown[]>(h, 'window.__holoml.leftOut()', PAGE)).toEqual([]);
  });

  it('W3 a stand-in shows until its model has loaded, and again once it is let go; it counts against the limits; a click on it is a click on the model', async () => {
    const PAGE = 'stand-in.holoml';
    await openPage(h, PAGE, false);
    type Model = { id: string | null; state: string; standIn: StandIn | null };
    const car = async () => (await holo<Model[]>(h, 'window.__holoml.standIns()', PAGE)).find((m) => m.id === 'car')!;
    // The car is held back by the fixture server; the orange block stands in its place.
    let now = await waitFor('the stand-in shown', car, (m) => m.standIn?.state === 'loaded', await sceneWait(h, 10_000));
    expect(now).toMatchObject({ state: 'loading', standIn: { src: 'models/stand-in.gltf', shown: true } });
    expect(await holo<boolean>(h, 'window.__holoml.ready', PAGE)).toBe(false);
    // The stand-in counts: its 12 triangles and its file's bytes.
    expect(await totals(h, PAGE)).toMatchObject({ triangles: 12, modelFiles: 2 });
    const at = (await holo<Point>(h, 'window.__holoml.point("car")', PAGE))!;
    await waitFor('the page script', () => inPage<boolean>(h, 'Array.isArray(window.clicks)', PAGE), (v) => v);
    await waitFor('the block drawn', () => colourAt(h, PAGE, at), orange, await sceneWait(h, 5000));
    // A click on the block is a click on the car.
    await clickUntil(h, await project(h, at.x, at.y), 'the script hears the click on the car', async () => (await inPage<(string | null)[]>(h, 'window.clicks', PAGE)).includes('car'));

    server.release('stand-in');
    await ready(h, PAGE, await sceneWait(h, 10_000));
    now = await car();
    expect(now).toMatchObject({ state: 'loaded', standIn: { shown: false } });
    await waitFor('the car drawn in its place', () => colourAt(h, PAGE, at), (c) => !orange(c), await sceneWait(h, 5000));
    const scene = await holo<{ models: { src: string; triangles?: number }[] }>(h, 'window.__holoml.scene()', PAGE);
    const carTriangles = scene.models.find((m) => m.src.includes('late-car'))!.triangles!;
    expect((await totals(h, PAGE)).triangles).toBe(12 + carTriangles);

    // Let go (loading by area): the stand-in shows again.
    const AREAS = 'areas.holoml';
    await openPage(h, AREAS);
    const farCar = async () => (await area(h, AREAS, 'far-shelf')).models.find((m) => m.id === 'far-car')!;
    expect(await farCar()).toMatchObject({ state: 'waiting', standIn: { state: 'loaded', shown: true } });
    await moveTo(h, AREAS, [0, 1.6, -36]);
    await waitFor('the car in, the stand-in hidden', farCar, (m) => m.state === 'loaded' && m.standIn?.shown === false, await sceneWait(h, 10_000));
    await moveTo(h, AREAS, [0, 1.6, 0]);
    await waitFor('the car let go, the stand-in shown again', farCar, (m) => m.state === 'waiting' && m.standIn?.shown === true, await sceneWait(h, 5000));
  });

  it("W4 scripts read a group's and a model's `loaded`, and hear the `load` event as a group's models come in and are let go", async () => {
    const PAGE = 'areas.holoml';
    await openPage(h, PAGE);
    type Now = { near: boolean; far: boolean; nearBox: boolean; farCar: boolean; farBox: boolean };
    const loaded = () => inPage<Now>(h, 'window.loadedNow()', PAGE);
    const log = () => inPage<string[]>(h, 'window.loadLog.slice()', PAGE);
    await waitFor('the page script', () => inPage<boolean>(h, 'typeof window.loadedNow === "function"', PAGE), (v) => v);
    expect(await loaded()).toEqual({ near: true, far: false, nearBox: true, farCar: false, farBox: false });
    // The script started after the near group may already have loaded: only what changes from here is checked.
    const before = (await log()).length;
    await moveTo(h, PAGE, [0, 1.6, -36]);
    await waitFor('the far group loaded, as the script hears', log, (l) => l.slice(before).includes('far-shelf:true'), await sceneWait(h, 10_000));
    expect(await loaded()).toEqual({ near: false, far: true, nearBox: false, farCar: true, farBox: true });
    await moveTo(h, PAGE, [0, 1.6, 0]);
    await waitFor('the near group loaded again', log, (l) => l.slice(before).includes('near-shelf:true'), await sceneWait(h, 10_000));
    expect((await log()).slice(before)).toEqual(['near-shelf:false', 'far-shelf:true', 'far-shelf:false', 'near-shelf:true']);
    expect(await loaded()).toEqual({ near: true, far: false, nearBox: true, farCar: false, farBox: false });
    // The page's own screen text shows what the script heard.
    const status = await holo<{ id: string | null; text: string }[]>(h, 'window.__holoml.huds()', PAGE);
    expect(status.find((s) => s.id === 'status')!.text).toContain('far-shelf:false near-shelf:true');
    // `load` is a kind of event scripts may listen for; others are still refused.
    expect(await inPage<string>(h, "(() => { try { holoml.on('unload', () => {}); return 'accepted'; } catch (e) { return e.message; } })()", PAGE)).toMatch(/"load"/);
  });

  it('W5 only loaded groups count: a page whose groups together pass the limits loads each in turn, one waiting for room while another is in', async () => {
    const PAGE = 'areas-limits.holoml';
    await openPage(h, PAGE);
    const LIMIT = 2_000_000;
    const state = async () => Object.fromEntries((await areas(h, PAGE)).map((a) => [a.id, a.models[0]!.state]));
    expect(await state()).toEqual({ a: 'loaded', b: 'waiting', c: 'waiting' });
    expect((await totals(h, PAGE)).triangles).toBe(1_200_000);
    // Near both a and b: b would pass the limit with a loaded, so it waits for room.
    await moveTo(h, PAGE, [8, 1.6, 0]);
    const b = await waitFor('b waiting for room', () => area(h, PAGE, 'b'), (x) => x.in && x.models[0]!.state === 'waiting' && /would pass/.test(x.models[0]!.reason ?? ''), await sceneWait(h, 10_000));
    expect(b.models[0]!.reason).toMatch(/it loads when other groups are let go/);
    expect((await totals(h, PAGE)).triangles).toBeLessThanOrEqual(LIMIT);
    // Past a: it is let go, and b loads.
    await moveTo(h, PAGE, [20, 1.6, 0]);
    await waitFor('b loaded once a was let go', state, (s) => s['a'] === 'waiting' && s['b'] === 'loaded', await sceneWait(h, 10_000));
    expect((await totals(h, PAGE)).triangles).toBe(1_200_000);
    // On to c: b is let go and c loads.
    await moveTo(h, PAGE, [40, 1.6, 0]);
    await waitFor('c loaded once b was let go', state, (s) => s['b'] === 'waiting' && s['c'] === 'loaded', await sceneWait(h, 10_000));
    expect((await totals(h, PAGE)).triangles).toBe(1_200_000);
    // Nothing was left out: each group loaded in its turn.
    expect(await holo<unknown[]>(h, 'window.__holoml.leftOut()', PAGE)).toEqual([]);
  });
});

/** Sends a key down or up to the page. */
function key(h: Harness, page: string, keyCode: string, type: 'keyDown' | 'keyUp'): Promise<void> {
  return h.app.evaluate(
    ({ webContents }, { page, keyCode, type }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop();
      guest?.sendInputEvent({ type, keyCode });
    },
    { page, keyCode, type },
  );
}

/** Presses Enter or Space in the page as a keyboard does: down, the character, and up. */
function press(h: Harness, page: string, which: 'Enter' | 'Space'): Promise<void> {
  return h.app.evaluate(
    ({ webContents }, { page, which }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop()!;
      guest.sendInputEvent({ type: 'keyDown', keyCode: which });
      guest.sendInputEvent({ type: 'char', keyCode: which === 'Enter' ? '\r' : ' ' });
      guest.sendInputEvent({ type: 'keyUp', keyCode: which });
    },
    { page, which },
  );
}

/** The accessibility tree's named nodes, as screen readers get them. */
function axNodes(h: Harness, page: string): Promise<{ role: string; name: string; pressed: string | null }[]> {
  return h.app.evaluate(async ({ webContents }, page) => {
    const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop()!;
    guest.debugger.attach('1.3');
    try {
      const r = (await guest.debugger.sendCommand('Accessibility.getFullAXTree')) as {
        nodes: { ignored: boolean; role?: { value: string }; name?: { value: string }; properties?: { name: string; value: { value: unknown } }[] }[];
      };
      return r.nodes
        .filter((n) => !n.ignored && n.name?.value)
        .map((n) => ({ role: n.role?.value ?? '', name: n.name!.value, pressed: (n.properties?.find((p) => p.name === 'pressed')?.value.value as string | undefined) ?? null }));
    } finally {
      guest.debugger.detach();
    }
  }, page);
}

/** Emulates (or stops emulating) reduced motion in the tab's page; it lasts across the tab's navigations while on. */
async function reducedMotion(h: Harness, on: boolean): Promise<void> {
  await h.app.evaluate(async ({ webContents }, on) => {
    const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview').pop()!;
    if (on) {
      if (!guest.debugger.isAttached()) guest.debugger.attach('1.3');
      await guest.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    } else if (guest.debugger.isAttached()) {
      await guest.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
      guest.debugger.detach();
    }
  }, on);
}

/**
 * The page's memory, after its garbage is collected: its JavaScript heap
 * and its ArrayBuffers (where models' meshes are kept), and its process's
 * working set (for the log), in bytes.
 */
function pageMemory(h: Harness, page: string): Promise<{ heap: number; buffers: number; workingSet: number }> {
  return h.app.evaluate(async ({ app, webContents }, page) => {
    const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop()!;
    const attached = guest.debugger.isAttached();
    if (!attached) guest.debugger.attach('1.3');
    try {
      await guest.debugger.sendCommand('HeapProfiler.collectGarbage');
      const use = (await guest.debugger.sendCommand('Runtime.getHeapUsage')) as { usedSize: number; backingStorageSize?: number };
      const metric = app.getAppMetrics().find((m) => m.pid === guest.getOSProcessId());
      return { heap: use.usedSize, buffers: use.backingStorageSize ?? 0, workingSet: (metric?.memory.workingSetSize ?? 0) * 1024 };
    } finally {
      if (!attached) guest.debugger.detach();
    }
  }, page);
}

/**
 * Waits until an idle page has drawn what it loaded: a scene draws only
 * when something changes (each arrival asks for a frame), so once no
 * shaders are compiling and the frame count holds still, the last frame
 * shows everything (sceneStill).
 */
async function drawn(h: Harness, page: string): Promise<void> {
  await sceneStill(h, page, await sceneWait(h, 10_000));
}

describe('W6 to W10: the sneaker store', () => {
  let h: Harness;
  const STORE = 'sneaker-store/index.holoml';
  const SHOE = 'sneaker-store/shoe.holoml';
  const CHECKOUT = 'sneaker-store/checkout.html';
  const COLOURS = ['midnight', 'beach', 'street', 'forest', 'sunset', 'lemon', 'violet', 'sky', 'cloud', 'ember'];
  const NAMES: Record<string, string> = Object.fromEntries(COLOURS.map((c) => [c, c[0]!.toUpperCase() + c.slice(1)]));
  const PRICES: Record<string, number> = { midnight: 120, beach: 120, street: 120, forest: 125, sunset: 125, lemon: 125, violet: 130, sky: 125, cloud: 130, ember: 135 };
  const MB = 1024 * 1024;

  /** The store's bays (its groups that load by area), by colourway. */
  const bays = async () => Object.fromEntries((await areas(h, STORE)).map((a) => [a.models[0]!.id!.split('-')[1]!, a]));
  const places = (page: string) => holo<{ current: string | null }>(h, 'window.__holoml.places()', page);
  const feet = async () => (await holo<{ feet: Vec }>(h, 'window.__holoml.walker()', STORE)).feet;
  const frames = (page: string) => holo<number>(h, 'window.__holoml.frames', page);
  const stand = (at: Vec, look: Vec) => inPage(h, `(holoml.viewer.position = ${JSON.stringify(at)}, holoml.viewer.lookAt(${JSON.stringify(look)}), true)`, STORE);
  const huds = (page: string) => holo<{ id: string | null; text: string }[]>(h, 'window.__holoml.huds()', page);
  const hud = async (page: string, id: string) => (await huds(page)).find((x) => x.id === id)?.text ?? '';
  const choice = async (id: string) => (await holo<{ id: string | null; value: string }[]>(h, 'window.__holoml.choices()', SHOE)).find((c) => c.id === id)!.value;
  /** The shoe page's shoe: the picture on its material (the page's address of one, or "own" for the file's). */
  const shoeMap = async () =>
    (await holo<{ src: string; materials: Record<string, { map: string | null }> }[]>(h, 'window.__holoml.models()', SHOE)).find((m) => m.src === 'models/shoe.glb')?.materials['Shoe']?.map ?? null;
  const pick = (id: string, value: string) =>
    inPage<boolean>(h, `(() => { const i = document.querySelector('[data-id="${id}"] input[value="${value}"]'); i?.click(); return Boolean(i); })()`, SHOE);
  const action = async (trigger: string) =>
    (await holo<{ trigger: string | null; pressed: string | null }[]>(h, 'window.__holoml.actions()', SHOE)).find((a) => a.trigger === trigger)!;
  const flip = async () => (await holo<{ rotation: Vec }>(h, 'window.__holoml.object("flip")', SHOE)).rotation[0];
  const point = async (page: string, id: string) => (await holo<Point | null>(h, `window.__holoml.point(${JSON.stringify(id)})`, page))!;
  const focusedText = (page: string) => inPage<string>(h, 'document.activeElement?.textContent ?? ""', page);
  /** Tab through the page's outline until an item with this text has the keyboard. */
  async function tabTo(page: string, text: string): Promise<void> {
    for (let i = 0; i < 40 && (await focusedText(page)) !== text; i++) await pressInPage(h, 'Tab', [], page);
    expect(await focusedText(page)).toBe(text);
  }
  /** Walks with a key held until the walker stops (the same place while the page drew new frames) or the time is up. */
  async function walkUntilStopped(keyCode: string, maxMs: number): Promise<Vec> {
    await key(h, STORE, keyCode, 'keyDown');
    try {
      const end = Date.now() + maxMs;
      let [last, lastFrames, still] = [await feet(), await frames(STORE), 0];
      while (Date.now() < end && still < 3) {
        await sleep(250);
        const [now, drawnNow] = [await feet(), await frames(STORE)];
        if (drawnNow < lastFrames + 2) continue;
        still = now.every((v, i) => Math.abs(v - last[i]!) <= 0.002) ? still + 1 : 0;
        [last, lastFrames] = [now, drawnNow];
      }
      return last;
    } finally {
      await key(h, STORE, keyCode, 'keyUp');
    }
  }

  /** How long the store took to be ready: timed by W6, and held to the budget by the check after it. */
  let readyMs: number | null = null;

  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
  });
  afterAll(async () => h?.close());

  it('W6 the store: ready with no problems; the shelves by the entrance loaded and the rest as stand-ins; walking down the hall loads each shelf in turn; the counter, the bays, and the walls stop the walker', async () => {
    const t = Date.now();
    await shellCall(h, 'showUrl', url(STORE));
    await waitForPage(h, STORE, await sceneWait(h, 15_000));
    await ready(h, STORE, 60_000);
    // Within 5 seconds is the next check's.
    readyMs = Date.now() - t;
    expect(await holo<unknown[]>(h, 'window.__holoml.problems', STORE)).toEqual([]);
    expect(await holo<unknown[]>(h, 'window.__holoml.leftOut()', STORE)).toEqual([]);
    const first = await bays();
    expect(Object.keys(first).sort()).toEqual([...COLOURS].sort());
    for (const c of COLOURS) {
      const byEntrance = c === 'midnight' || c === 'lemon';
      expect(first[c], c).toMatchObject({ in: byEntrance, loaded: byEntrance });
      expect(first[c]!.models).toHaveLength(6);
      for (const m of first[c]!.models) {
        expect(m, `${c}: ${m.id}`).toMatchObject(byEntrance ? { state: 'loaded', standIn: { state: 'loaded', shown: false } } : { state: 'waiting', standIn: { state: 'loaded', shown: true } });
      }
    }
    await drawn(h, STORE);

    // Walking down the hall (beside the bench, which is in the middle, and clear of the About sign): each shelf loads as the viewer comes near, and those behind are let go.
    await stand([-1.5, 1.6, -1.6], [-1.5, 1.6, -26]);
    const loaded = new Set<string>();
    const letGo = new Set<string>();
    await key(h, STORE, 'W', 'keyDown');
    try {
      await waitFor(
        'every shelf loaded on the way down the hall',
        async () => {
          for (const [c, a] of Object.entries(await bays())) {
            if (a.loaded) loaded.add(c);
            else if (loaded.has(c) && !a.in) letGo.add(c);
          }
          return loaded.size;
        },
        (n) => n === COLOURS.length,
        await sceneWait(h, 40_000),
      );
    } finally {
      await key(h, STORE, 'W', 'keyUp');
    }
    expect([...letGo].sort(), 'let go behind the viewer').toEqual(expect.arrayContaining(['lemon', 'midnight']));
    // On to the counter: it stops the walker (its front at z = -23.45; the walker is 0.6 m wide).
    const atCounter = await walkUntilStopped('W', await sceneWait(h, 8000));
    expect(atCounter[2], `stopped at ${atCounter.join(', ')}`).toBeGreaterThan(-23.2);
    expect(atCounter[2]).toBeLessThan(-22.9);
    // A bay stops the walker (its front 0.46 m from the wall), and the wall between bays.
    await stand([-2, 1.6, -8.5], [-5, 1.6, -8.5]);
    const atBay = await walkUntilStopped('W', await sceneWait(h, 8000));
    expect(atBay[0], `stopped at ${atBay.join(', ')}`).toBeGreaterThan(-4.3);
    expect(atBay[0]).toBeLessThan(-4.1);
    await stand([-2, 1.6, -6.25], [-5, 1.6, -6.25]);
    const atWall = await walkUntilStopped('W', await sceneWait(h, 8000));
    expect(atWall[0], `stopped at ${atWall.join(', ')}`).toBeGreaterThan(-4.75);
    expect(atWall[0]).toBeLessThan(-4.6);
  }, 300_000);

  it('W6 the store is ready within 5 s (with a graphics card)', async (ctx) => {
    expect(readyMs, 'the check before this one timed the store').not.toBeNull();
    // Within 5 s with a graphics card; drawn in software (GitHub's machines), the time is measured and logged,
    // and the check is skipped, not passed.
    const software = await softwareRenderer(h);
    if (software) {
      console.log(`W6: ready in ${readyMs} ms; the 5-second budget not checked: drawing in software (${software})`);
      ctx.skip(`the 5-second budget is for graphics hardware; drawing in software (${software})`);
    }
    console.log(`W6: ready in ${readyMs} ms`);
    expect(readyMs!).toBeLessThan(5000);
  });

  it('W7 a shoe: a click on one opens its page through a fade; every colourway changes it in place; "Turn it over" shows its sole; a size is chosen', async () => {
    await openPage(h, STORE);
    // To the Beach bay, from the page's list of places: its shoes load.
    expect(await inPage<boolean>(h, `(() => { const b = [...document.querySelectorAll('#holoml-outline button')].find((x) => x.textContent === 'Go to: Beach'); b?.click(); return Boolean(b); })()`, STORE)).toBe(true);
    await waitFor('at the Beach bay', () => places(STORE), (p) => p.current === 'beach');
    await waitFor('its shoes loaded', bays, (b) => b['beach']!.loaded, await sceneWait(h, 10_000));
    await drawn(h, STORE);
    await inPage(
      h,
      "(() => { sessionStorage.setItem('fadeMax', '0'); const f = document.getElementById('holoml-fade'); const loop = () => { const o = Number(getComputedStyle(f).opacity); if (o > Number(sessionStorage.getItem('fadeMax'))) sessionStorage.setItem('fadeMax', String(o)); requestAnimationFrame(loop); }; loop(); return true; })()",
      STORE,
    );
    // A click on one of its shoes opens the shoe's page, for that colourway, through a fade.
    const at = await point(STORE, 'shoe-beach-2');
    await clickUntil(h, await project(h, at.x, at.y), "the shoe's page", async () => (await focusedTab(h)).url.includes('shoe.holoml?colour=beach'));
    await waitForPage(h, SHOE);
    expect(Number(await inPage<string | null>(h, "sessionStorage.getItem('fadeMax')", SHOE))).toBeGreaterThan(0.95);
    await ready(h, SHOE, await sceneWait(h, 20_000));
    const arrived = await waitFor('faded in', () => holo<{ opacity: number; arriving: boolean; log: { to: number }[] }>(h, 'window.__holoml.fade()', SHOE), (f) => !f.arriving && f.opacity === 0, await sceneWait(h, 8000));
    expect(arrived.log.map((x) => x.to)).toEqual([1, 0]);
    expect(await choice('colour')).toBe('beach');
    await waitFor('the beach colours on the shoe', shoeMap, (m) => m?.endsWith('/colours/beach.jpg') === true);
    expect(await hud(SHOE, 'price')).toBe('Everyday Runner\nBeach\n$120');

    // Every colourway changes the shoe in place: its file is not asked for again.
    const asked = hits('/holoml/sneaker-store/models/shoe.glb');
    for (const c of COLOURS) {
      expect(await pick('colour', c)).toBe(true);
      await waitFor(`the ${c} colours on the shoe`, shoeMap, (m) => (c === 'midnight' ? m === 'own' : m?.endsWith(`/colours/${c}.jpg`) === true));
      expect(await hud(SHOE, 'price')).toBe(`Everyday Runner\n${NAMES[c]}\n$${PRICES[c]}`);
    }
    expect(hits('/holoml/sneaker-store/models/shoe.glb')).toBe(asked);

    // "Turn it over", clicked in the scene: the shoe turns about its middle, and the sole (white) is where the green knit was.
    expect(await pick('colour', 'forest')).toBe(true);
    await waitFor('forest', shoeMap, (m) => m?.endsWith('/colours/forest.jpg') === true);
    await waitFor('the turntable still', () => holo<{ rotation: Vec }>(h, 'window.__holoml.object("spin")', SHOE), (o) => Math.abs(o.rotation[1] - 405) < 0.01, await sceneWait(h, 15_000));
    // Seen from above, the shoe's middle is its laces and knit; turned over, its white sole.
    const fromAbove = async () => {
      await inPage(h, '(holoml.viewer.position = [0.001, 0.75, 0.001], holoml.viewer.lookAt([0, 0.1, 0]), true)', SHOE);
      await drawn(h, SHOE);
      return colourAt(h, SHOE, await point(SHOE, 'shoe'));
    };
    const asAtFirst = async () => {
      await inPage(h, '(holoml.viewer.position = [0.5, 0.3, 0.5], holoml.viewer.lookAt([0, 0.1, 0]), true)', SHOE);
      await drawn(h, SHOE);
    };
    const top = await fromAbove();
    expect(Math.min(top.r, top.g, top.b), `the top: ${JSON.stringify(top)}`).toBeLessThan(130);
    await asAtFirst();
    const button = await point(SHOE, 'turn-over');
    await clickUntil(h, await project(h, button.x, button.y), 'turned over', async () => (await action('turn-over')).pressed === 'true');
    await waitFor('upside down', flip, (x) => Math.abs(x - 180) < 0.01, await sceneWait(h, 5000));
    const sole = await fromAbove();
    expect(Math.min(sole.r, sole.g, sole.b), `the sole: ${JSON.stringify(sole)}`).toBeGreaterThan(150);
    expect(Math.abs(sole.r - sole.g), `the sole: ${JSON.stringify(sole)}`).toBeLessThan(40);
    await asAtFirst();
    await clickUntil(h, await project(h, button.x, button.y), 'turned back', async () => (await action('turn-over')).pressed === 'false');
    await waitFor('the right way up', flip, (x) => Math.abs(x) < 0.01, await sceneWait(h, 5000));

    // A size, for the cart.
    expect(await choice('size')).toBe('42');
    expect(await pick('size', '44')).toBe(true);
    await waitFor('size 44', () => choice('size'), (v) => v === '44');
  }, 240_000);

  it('W8 the cart: two shoes added; the cart on the screen counts them; the checkout page lists both with their sizes and the total, and its button places nothing', async () => {
    await openPage(h, `${SHOE}?colour=beach`);
    // A cart of this tab's own, empty to begin with.
    await inPage(h, "(sessionStorage.removeItem('sneaker-store-cart'), true)", SHOE);
    await openPage(h, `${SHOE}?colour=beach&again=1`);
    expect(await hud(SHOE, 'cart')).toBe('Cart: empty');
    expect(await pick('size', '44')).toBe(true);
    // "Add to cart", clicked in the scene: the chime (counted as it starts: it lasts 0.7 s), and the cart counts it.
    const chimes = async () => (await holo<{ id: string | null; plays: number }[]>(h, 'window.__holoml.sounds()', SHOE)).find((x) => x.id === 'chime')?.plays ?? 0;
    expect(await chimes()).toBe(0);
    const add = await point(SHOE, 'add');
    await clickUntil(h, await project(h, add.x, add.y), 'in the cart', async () => (await hud(SHOE, 'cart')) === 'Cart: 1 pair · $120');
    await waitFor('the chime', chimes, (n) => n === 1, await sceneWait(h, 3000));
    // Another: Ember, size 41, added from the keyboard.
    expect(await pick('colour', 'ember')).toBe(true);
    expect(await pick('size', '41')).toBe(true);
    await tabTo(SHOE, 'Add to cart');
    await press(h, SHOE, 'Enter');
    await waitFor('two in the cart', () => hud(SHOE, 'cart'), (t) => t === 'Cart: 2 pairs · $255');

    // The checkout page, from the Checkout link in the scene.
    const checkout = (await holo<Point | null>(h, 'window.__holoml.point(0)', SHOE))!;
    await clickUntil(h, await project(h, checkout.x, checkout.y), 'the checkout page', async () => (await focusedTab(h)).url.endsWith(CHECKOUT));
    await waitForPage(h, CHECKOUT);
    type Line = { what: string; size: string; price: string };
    const lines = await waitFor(
      'the cart listed',
      () =>
        inPage<Line[]>(
          h,
          "[...document.querySelectorAll('#items li')].map((li) => ({ what: li.querySelector('.what').textContent, size: li.querySelector('.size').textContent, price: li.querySelector('.price').textContent }))",
          CHECKOUT,
        ),
      (l) => l.length === 2,
    );
    expect(lines).toEqual([
      { what: 'Everyday Runner, Beach', size: 'EU size 44', price: '$120' },
      { what: 'Everyday Runner, Ember', size: 'EU size 41', price: '$135' },
    ]);
    expect(await inPage<string>(h, "document.getElementById('sum').textContent", CHECKOUT)).toBe('$255');
    // No fields to fill in (nothing like card details), and placing the order sends nothing.
    expect(await inPage<number>(h, "document.querySelectorAll('input, textarea, select, form').length", CHECKOUT)).toBe(0);
    const requests = [...server.hits.values()].reduce((n, v) => n + v, 0);
    await inPage(h, "(document.getElementById('place').click(), true)", CHECKOUT);
    expect(await inPage<string>(h, "(() => { const p = document.getElementById('placed'); return p.hidden ? '' : p.textContent.trim(); })()", CHECKOUT)).toBe(
      'This is an example store: nothing was ordered, and nothing was charged.',
    );
    await sleep(500);
    expect([...server.hits.values()].reduce((n, v) => n + v, 0)).toBe(requests);
    // Back in the store, the cart on the screen counts them.
    await openPage(h, STORE);
    await waitFor('the cart in the store', () => hud(STORE, 'cart'), (t) => t === 'Cart: 2 pairs · $255');
  }, 240_000);

  it('W9 for everyone: the whole store from the keyboard; screen readers name its places, shelves, and buttons; the text view reads the shelves; reduced motion', async () => {
    await openPage(h, STORE);
    // Screen readers: a button for each place, and a link for each shelf, named by its colourway and price.
    const tree = await axNodes(h, STORE);
    for (const c of COLOURS) {
      expect(tree.some((n) => n.role === 'button' && n.name === `Go to: ${NAMES[c]}`), c).toBe(true);
      expect(tree.some((n) => n.role === 'link' && n.name === `${NAMES[c]} · $${PRICES[c]}`), c).toBe(true);
    }
    // The keyboard: to the Ember bay (its shoes load), and its shelf's link opens the shoe's page.
    await tabTo(STORE, 'Go to: Ember');
    await press(h, STORE, 'Enter');
    await waitFor('at the Ember bay', () => places(STORE), (p) => p.current === 'ember');
    await waitFor('its shoes loaded', bays, (b) => b['ember']!.loaded, await sceneWait(h, 10_000));
    await tabTo(STORE, 'Ember · $135');
    await press(h, STORE, 'Enter');
    await waitFor("the shoe's page", () => focusedTab(h), (t) => t.url.includes('shoe.holoml?colour=ember'));
    await waitForPage(h, SHOE);
    await ready(h, SHOE, await sceneWait(h, 20_000));
    expect(await choice('colour')).toBe('ember');
    // On the shoe's page: turn it over, and back.
    await tabTo(SHOE, 'Turn it over');
    await press(h, SHOE, 'Enter');
    await waitFor('upside down', flip, (x) => Math.abs(x - 180) < 0.01, await sceneWait(h, 5000));
    await press(h, SHOE, 'Space');
    await waitFor('the right way up', flip, (x) => Math.abs(x) < 0.01, await sceneWait(h, 5000));
    // Screen readers: the page's buttons (a toggle says whether it is on), and the colour and size choices.
    const shoeTree = await axNodes(h, SHOE);
    expect(shoeTree.find((n) => n.role === 'button' && n.name === 'Turn it over')?.pressed).toBe('false');
    expect(shoeTree.some((n) => n.role === 'button' && n.name === 'Add to cart')).toBe(true);
    for (const c of COLOURS) expect(shoeTree.some((n) => n.role === 'radio' && n.name === NAMES[c]), c).toBe(true);
    expect(shoeTree.filter((n) => n.role === 'radio' && /^(3[6-9]|4[0-7])$/.test(n.name))).toHaveLength(12);
    // The colour from the keyboard: past the outline, the chosen colour's radio button, and an arrow key to the next (Ember is last: Midnight).
    for (let i = 0; i < 40 && (await inPage<string | null>(h, "document.activeElement?.type === 'radio' ? document.activeElement.value : null", SHOE)) !== 'ember'; i++) {
      await pressInPage(h, 'Tab', [], SHOE);
    }
    await pressInPage(h, 'Right', [], SHOE);
    await waitFor('midnight, from the keyboard', shoeMap, (m) => m === 'own');
    expect(await choice('colour')).toBe('midnight');
    // The checkout page from the keyboard: back to its link, then its button.
    for (let i = 0; i < 40 && (await focusedText(SHOE)) !== 'Checkout'; i++) await pressInPage(h, 'Tab', ['shift'], SHOE);
    expect(await focusedText(SHOE)).toBe('Checkout');
    await press(h, SHOE, 'Enter');
    await waitForPage(h, CHECKOUT);
    await inPage(h, "(document.getElementById('place').focus(), true)", CHECKOUT);
    await press(h, CHECKOUT, 'Enter');
    await waitFor('placed (nothing)', () => inPage<boolean>(h, "!document.getElementById('placed').hidden", CHECKOUT), (v) => v);

    // The text view reads every shelf's name and price.
    await openPage(h, STORE);
    await pressInPage(h, 'V', ['control', 'shift'], STORE);
    await waitFor('the text view', () => holo<boolean>(h, 'window.__holoml.textView', STORE), (v) => v === true);
    const text = await inPage<string>(h, 'document.body.innerText', STORE);
    for (const c of COLOURS) expect(text).toContain(`${NAMES[c]} · $${PRICES[c]}`);
    await pressInPage(h, 'V', ['control', 'shift'], STORE);
    await waitFor('3D again', () => holo<boolean>(h, 'window.__holoml.textView', STORE), (v) => v === false);

    // Reduced motion: the shoe is still at once (its turn shows its end), and turning it over is a cut.
    await reducedMotion(h, true);
    try {
      await openPage(h, `${SHOE}?colour=sky`);
      expect((await holo<{ rotation: Vec }>(h, 'window.__holoml.object("spin")', SHOE)).rotation[1]).toBeCloseTo(405, 3);
      await tabTo(SHOE, 'Turn it over');
      await press(h, SHOE, 'Enter');
      await waitFor('upside down', flip, (x) => Math.abs(x - 180) < 0.01, await sceneWait(h, 2000));
    } finally {
      await reducedMotion(h, false);
    }
  }, 300_000);

  it("W10 efficient: an idle store draws no frames; the page's memory falls again once far shelves are let go", async () => {
    await openPage(h, STORE);
    await drawn(h, STORE);
    const idle = async (what: string) => {
      await sleep(1000);
      const f0 = await frames(STORE);
      await sleep(2000);
      expect(await frames(STORE), what).toBe(f0);
    };
    await idle('at the entrance');
    const within = (x: Record<string, Area>) => COLOURS.filter((c) => x[c]!.in).sort();
    const settled = (x: Record<string, Area>) => COLOURS.every((c) => !x[c]!.in || x[c]!.loaded);
    // Past the first bays, then halfway down the hall beside the bench: six bays are in (a bay is let go only beyond 11.25 m).
    await moveTo(h, STORE, [0, 1.6, -8.5]);
    await waitFor('six bays by the viewer', bays, (x) => within(x).length === 6 && settled(x), await sceneWait(h, 15_000));
    await moveTo(h, STORE, [2, 1.6, -13]);
    const busyBays = await waitFor('halfway', bays, (x) => within(x).join() === 'beach,cloud,lemon,sky,street,violet' && settled(x), await sceneWait(h, 15_000));
    await drawn(h, STORE);
    await idle('halfway down the hall');
    const [busy, busyTotals] = [await pageMemory(h, STORE), await totals(h, STORE)];
    // Back by the entrance: the three bays now far away are let go (their files, pictures, and memory), and the first comes in again.
    await moveTo(h, STORE, [0, 1.6, -1.6]);
    const calmBays = await waitFor('by the entrance', bays, (x) => within(x).join() === 'beach,lemon,midnight,violet' && settled(x), await sceneWait(h, 15_000));
    await drawn(h, STORE);
    const [calm, calmTotals] = [await pageMemory(h, STORE), await totals(h, STORE)];
    const fewer = within(busyBays).length - within(calmBays).length;
    console.log(
      `W10: halfway (${within(busyBays).join(', ')}), ${(busyTotals.bytes / MB).toFixed(1)} MB counted, heap ${(busy.heap / MB).toFixed(1)} MB, buffers ${(busy.buffers / MB).toFixed(1)} MB, working set ${(busy.workingSet / MB).toFixed(0)} MB; ` +
        `by the entrance (${within(calmBays).join(', ')}), ${(calmTotals.bytes / MB).toFixed(1)} MB counted, heap ${(calm.heap / MB).toFixed(1)} MB, buffers ${(calm.buffers / MB).toFixed(1)} MB, working set ${(calm.workingSet / MB).toFixed(0)} MB`,
    );
    expect(fewer).toBe(2);
    // Each bay's six shoes are 136,200 triangles and a file of about 0.7 MB (its meshes about 0.55 MB in memory).
    expect(calmTotals.triangles).toBe(busyTotals.triangles - fewer * 6 * 22_700);
    expect(calmTotals.bytes).toBeLessThan(busyTotals.bytes - fewer * 0.6 * MB);
    expect(calm.heap + calm.buffers, 'the page memory').toBeLessThan(busy.heap + busy.buffers - fewer * 0.35 * MB);
    await idle('by the entrance');
  }, 240_000);
});
