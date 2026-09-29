/**
 * Milestone 20 end-to-end checks (TODO.md): HoloML 0.2's fourth part and
 * the sneaker store. W2 to W5: loading by area, stand-ins, scripts, and
 * the limits. W1 (the language) is the holoml repository's tests.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import { clickUntil, holdKeyUntil, inPage, launch, project, sceneWait, shellCall, waitFor, waitForPage, type Harness, type Point } from './harness';

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
