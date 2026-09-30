/**
 * Checks for the HoloML viewer's findings of the review of 2026-09-30
 * (prompt 134; fixed for prompt 135): V2 to V10, D12, and drawing in
 * software at half sharpness. The pure parts (counting a model's file,
 * walls, wrapping, numbers, sounds, the limits) are unit tests beside the
 * viewer's code; these check the running app, with the fixture pages
 * tests/fixtures/holoml/review-134-*.holoml and two generated models
 * (fixture-server.ts, /holoml/gen/corrupt.glb and instanced.gltf).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  clickUntil,
  holdKeyUntil,
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
} from './harness';

let server: FixtureServer;
let h: Harness;

beforeAll(async () => {
  server = await startFixtureServer();
  h = await launch(server.url('link-a.html'));
  await waitForPage(h, 'link-a.html');
  await watchConsole(h);
});

afterAll(async () => {
  await h?.close();
  await server?.close();
});

type Vec = [number, number, number];
type AreaModel = { id: string | null; src: string; state: string; reason: string | null };
type Area = { id: string | null; near: number; in: boolean; loaded: boolean; distance: number; models: AreaModel[] };
type Totals = { bytes: number; triangles: number; modelFiles: number; pixels: number; seconds: number };
type Colour = { r: number; g: number; b: number };
type View = { mode: string; position: Vec; target: Vec };
type Walker = { feet: Vec; onGround: boolean; gravity: boolean };
type LeftOut = { what: string; why: string };

const MB = 1024 * 1024;
const TEXT_VIEW = 'hs-toolbar [data-testid="text-view"]';
const STOP = 'hs-toolbar [data-testid="stop"]';
const url = (page: string) => server.url(`holoml/${page}`);

function holo<T>(page: string, expression: string): Promise<T> {
  return inPage<T>(h, `window.__holoml ? (${expression}) : undefined`, page);
}

/** Opens a page in the harness's tab and waits until it is ready. */
async function openPage(page: string): Promise<void> {
  await shellCall(h, 'showUrl', url(page));
  await waitForPage(h, page, await sceneWait(h, 15_000));
  await waitFor(`${page} ready`, () => holo<boolean>(page, 'window.__holoml.ready'), (r) => r === true, await sceneWait(h, 20_000));
}

/** Waits until the page has drawn what it has and its frame count holds; returns the count. */
const still = async (page: string) => sceneStill(h, page, await sceneWait(h, 10_000));
const frames = (page: string) => holo<number>(page, 'window.__holoml.frames');
const totals = (page: string) => holo<Totals>(page, 'window.__holoml.totals()');
const area = async (page: string, id: string) => (await holo<Area[]>(page, 'window.__holoml.areas()')).find((a) => a.id === id)!;
const view = (page: string) => holo<View>(page, 'window.__holoml.view()');
const leftOut = (page: string) => holo<LeftOut[]>(page, 'window.__holoml.leftOut()');
const hits = (path: string) => [...server.hits].filter(([k]) => k.startsWith(path)).reduce((n, [, v]) => n + v, 0);
/** Moves the viewer through the page's scene API (a 0.2 page's own script could do the same). */
const moveTo = (page: string, eye: Vec) => inPage<void>(h, `void (holoml.viewer.position = ${JSON.stringify(eye)})`, page);

/** Keeps what the pages print to their consoles, from now on (in the main process). */
async function watchConsole(h: Harness): Promise<void> {
  await h.app.evaluate(({ app, webContents }) => {
    const g = globalThis as unknown as { __pageConsole?: string[] };
    g.__pageConsole = [];
    const watch = (w: Electron.WebContents) => {
      if (w.getType() !== 'webview' || (w as unknown as { __watched?: boolean }).__watched) return;
      (w as unknown as { __watched?: boolean }).__watched = true;
      w.on('console-message', (e) => g.__pageConsole!.push(e.message));
    };
    webContents.getAllWebContents().forEach(watch);
    app.on('web-contents-created', (_e, w) => watch(w));
  });
}
const consoleText = () => h.app.evaluate(() => ((globalThis as unknown as { __pageConsole?: string[] }).__pageConsole ?? []).join('\n'));

/** The page's own pixels as drawn: the average colour in a small square around a point (page pixels). */
function colourAt(page: string, p: Point, half = 3): Promise<Colour> {
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

describe('review 134: the HoloML viewer', () => {
  it('V2 a page written for a version the viewer does not know is refused, with a card that says which; it is not drawn as an older version', async () => {
    const PAGE = 'review-134-version.holoml';
    await openPage(PAGE);
    expect(await holo(PAGE, 'window.__holoml.error')).toMatchObject({ code: 'unsupported-version', line: 1, column: 9 });
    const card = await inPage<string>(h, `document.querySelector('[data-testid="holoml-error"]').innerText`, PAGE);
    expect(card).toContain('written for another version');
    expect(card).toContain('The page is written in HoloML "0.3", which this browser does not read yet. It reads HoloML 0.1 and 0.2.');
    // Nothing of its scene is built or fetched.
    expect(await inPage<boolean>(h, 'document.querySelector("canvas") === null', PAGE)).toBe(true);
    expect(await holo(PAGE, 'window.__holoml.version')).toBeNull();
    expect(await holo(PAGE, 'window.__holoml.models()')).toEqual([]);
    expect(await inPage<string>(h, 'document.title', PAGE)).toBe('HoloML page of another version');
    // The versions it knows are drawn as before, each as itself.
    await openPage('still.holoml');
    expect(await holo('still.holoml', 'window.__holoml.version')).toBe('0.1');
    await openPage('review-134-gravity.holoml');
    expect(await holo('review-134-gravity.holoml', 'window.__holoml.version')).toBe('0.2');
  });

  it("V3 a model that arrives and cannot be decoded holds nothing of the page's totals, and is not fetched again at each approach; other groups still load", async () => {
    const PAGE = 'review-134-corrupt.holoml';
    const FILE = '/holoml/gen/corrupt.glb';
    await openPage(PAGE);
    // Nothing is near the start: the page holds nothing.
    expect(await totals(PAGE)).toMatchObject({ bytes: 0, triangles: 0, modelFiles: 0, pixels: 0 });
    expect(hits(FILE)).toBe(0);
    for (let approach = 1; approach <= 4; approach++) {
      await moveTo(PAGE, [0, 1.6, -28]);
      const bad = await waitFor(`approach ${approach}: the broken model failed`, () => area(PAGE, 'bad'), (a) => a.in && a.models[0]!.state === 'failed', await sceneWait(h, 10_000));
      expect(bad.models[0]!.reason).toMatch(/could not be loaded/);
      // Its 4 MB arrived, and stopped counting when it could not be decoded.
      expect(await totals(PAGE), `after approach ${approach}`).toMatchObject({ bytes: 0, triangles: 0, modelFiles: 0, pixels: 0 });
      await moveTo(PAGE, [0, 1.6, 0]);
      await waitFor('away again', () => area(PAGE, 'bad'), (a) => !a.in && a.models[0]!.state === 'waiting', await sceneWait(h, 10_000));
    }
    // Fetched once: it would decode no better a second time.
    expect(hits(FILE)).toBe(1);
    // The group beyond it loads as ever.
    await moveTo(PAGE, [0, 1.6, -58]);
    await waitFor('the good group loaded', () => area(PAGE, 'good'), (a) => a.in && a.loaded && a.models[0]!.state === 'loaded', await sceneWait(h, 10_000));
    const there = await totals(PAGE);
    expect(there.triangles).toBe(100);
    expect(there.bytes).toBeGreaterThan(MB);
    expect(there.bytes).toBeLessThan(2 * MB);
  });

  it('V4 the triangles charged are those drawn once the model is decoded, the copies the file itself asks for included; what is let go gives back the same', async () => {
    const PAGE = 'review-134-instanced.holoml';
    await openPage(PAGE);
    type Model = { src: string; state: string; reason?: string; triangles?: number };
    const models = async () => (await holo<{ models: Model[] }>(PAGE, 'window.__holoml.scene()')).models;
    const many = (await models()).find((m) => m.src.includes('copies=50'))!;
    // 100 triangles drawn 50 times.
    expect(many).toMatchObject({ state: 'loaded', triangles: 5000 });
    expect((await totals(PAGE)).triangles).toBe(5000);
    // Drawn as its own copy, which keeps the file's 50 (an instance of it would draw one).
    await still(PAGE);
    const stats = await holo<{ triangles: number; pools: { src: string }[] }>(PAGE, 'window.__holoml.stats()');
    expect(stats.pools.filter((p) => p.src.includes('instanced'))).toEqual([]);
    expect(stats.triangles).toBeGreaterThanOrEqual(5000);
    // 1,000 triangles 3,000 times would pass the page's two million: left out, holding nothing.
    const tooMany = (await models()).find((m) => m.src.includes('copies=3000'))!;
    expect(tooMany.state).toBe('left-out');
    expect(tooMany.reason).toMatch(/3,000,000 triangles would pass the page's 2,000,000/);
    // Let go, the group gives back what it was charged; near again, it is charged the same.
    const loaded = await totals(PAGE);
    await moveTo(PAGE, [0, 1.6, 40]);
    await waitFor('the shelf let go', () => totals(PAGE), (t) => t.triangles === 0 && t.bytes === 0, await sceneWait(h, 10_000));
    await moveTo(PAGE, [0, 1.6, 0]);
    await waitFor('the shelf loaded again', () => area(PAGE, 'shelf'), (a) => a.loaded && a.models[0]!.state === 'loaded', await sceneWait(h, 10_000));
    expect(await totals(PAGE)).toEqual(loaded);
  });

  it('V6 a page with twenty lights that ask for shadows and forty lights in all is still drawn: four cast shadows, thirty-two shine, and the page says what was left out', async () => {
    const PAGE = 'review-134-lights.holoml';
    await openPage(PAGE);
    await still(PAGE);
    const software = await softwareRenderer(h);
    const limits = await holo<{ lights: number; leftOut: number; shadowLights: number; withoutShadows: number }>(PAGE, 'window.__holoml.lightLimits()');
    const out = await leftOut(PAGE);
    const text = await consoleText();
    // Thirty-two lights that shine from a place, of the forty; the ambient light is not one of them.
    expect(limits).toMatchObject({ lights: 32, leftOut: 8 });
    const shown = await holo<{ type: string }[]>(PAGE, 'window.__holoml.lights()');
    expect(shown.filter((l) => l.type !== 'ambient')).toHaveLength(32);
    expect(shown.filter((l) => l.type === 'ambient')).toHaveLength(1);
    expect(out).toContainEqual({ what: '8 lights', why: "past the page's limit of 32 lights" });
    expect(text).toMatch(/a page shows at most 32 lights that shine from a place or a direction; the lights after them were left out/);
    if (software) {
      // Drawn in software a page's shadows are left out altogether (owner, prompt 98, Q5 a).
      expect(limits).toMatchObject({ shadowLights: 0, withoutShadows: 0 });
      console.log(`V6: shadows left out, drawing in software (${software}); the limit on lights that cast them not checked`);
    } else {
      expect(limits).toMatchObject({ shadowLights: 4, withoutShadows: 16 });
      expect(out).toContainEqual({ what: 'the shadows of 16 lights', why: 'at most 4 lights cast shadows on a page' });
      expect(text).toMatch(/at most 4 lights cast shadows on a page; the lights after them shine without shadows/);
      expect(await holo(PAGE, 'window.__holoml.shadows()')).toMatchObject({ lights: 4, models: 2 });
    }
    // Drawn, and not black: the block in the middle is lit.
    const p = (await holo<Point | null>(PAGE, 'window.__holoml.point("block")'))!;
    const c = await colourAt(PAGE, p);
    expect(c.r + c.g + c.b, `the block's colour ${JSON.stringify(c)}`).toBeGreaterThan(90);
    // V10: a light a script removes no longer counts, and the picture its shadows were drawn into is released.
    const textures = async () => (await holo<{ textures: number }>(PAGE, 'window.__holoml.stats()')).textures;
    const held = await textures();
    await inPage(h, `(holoml.remove(holoml.find('lamp')), true)`, PAGE);
    await still(PAGE);
    expect(await holo(PAGE, 'window.__holoml.lightLimits()')).toMatchObject({ lights: 31, shadowLights: software ? 0 : 3 });
    if (!software) expect(await textures(), 'pictures on the graphics card').toBeLessThan(held);
  });

  it('V7 a walker with gravity that stands still draws no frames; it walks when asked, and falls when what it stands on goes', async () => {
    const PAGE = 'review-134-gravity.holoml';
    await openPage(PAGE);
    const walker = () => holo<Walker>(PAGE, 'window.__holoml.walker()');
    const landed = await waitFor('the walker on the blocks', walker, (w) => w.onGround && Math.abs(w.feet[1] - 1) < 0.01, await sceneWait(h, 5000));
    expect(landed.gravity).toBe(true);
    // Settled: the frame count holds (without the fix it never did, and this wait ran out).
    const f0 = await still(PAGE);
    await sleep(1500);
    expect(await frames(PAGE), 'no frames while standing still').toBe(f0);
    // It still walks.
    const z0 = (await view(PAGE)).position[2];
    await holdKeyUntil(h, PAGE, 'W', 'walking forward', () => view(PAGE), (v) => v.position[2] < z0 - 0.3);
    const f1 = await still(PAGE);
    await sleep(1000);
    expect(await frames(PAGE), 'no frames after walking').toBe(f1);
    // The ground is looked at again when something changes: its floor removed, the walker falls to the ground.
    await inPage(h, `(holoml.remove(holoml.find('floor')), true)`, PAGE);
    await waitFor('the walker on the ground', walker, (w) => w.onGround && w.feet[1] === 0, await sceneWait(h, 5000));
    const f2 = await still(PAGE);
    await sleep(1000);
    expect(await frames(PAGE), 'no frames on the ground').toBe(f2);
  });

  it('V8 in the text view the keys scroll the text: the scene behind takes none, holds still, and draws nothing; shown again, it takes them', async () => {
    const PAGE = 'review-134-text.holoml';
    await openPage(PAGE);
    await still(PAGE);
    const before = await view(PAGE);
    await h.shell.click(TEXT_VIEW);
    await waitFor('the text view', () => holo<boolean>(PAGE, 'window.__holoml.textView'), (v) => v === true);
    const f0 = await frames(PAGE);
    const scrolled = () => inPage<number>(h, 'Math.max(document.scrollingElement.scrollTop, document.body.scrollTop)', PAGE);
    expect(await scrolled()).toBe(0);
    // Page Down, the down arrow, and the space bar each scroll the text further.
    let at = 0;
    for (const keyCode of ['PageDown', 'Down', 'Space']) {
      await pressInPage(h, keyCode, [], PAGE);
      at = await waitFor(`${keyCode} scrolling the text`, scrolled, (y) => y > at);
    }
    await pressInPage(h, 'PageUp', [], PAGE);
    await waitFor('Page Up scrolling back', scrolled, (y) => y < at);
    // The scene did not walk, turn, or look down, and drew nothing.
    expect(await view(PAGE)).toEqual(before);
    expect(await frames(PAGE), 'no frames in the text view').toBe(f0);
    // Shown again: drawn again, and Page Down looks down as before.
    await h.shell.click(TEXT_VIEW);
    await waitFor('3D again', () => holo<boolean>(PAGE, 'window.__holoml.textView'), (v) => v === false);
    await waitFor('drawn again', () => frames(PAGE), (n) => n > f0, await sceneWait(h, 5000));
    await holdKeyUntil(h, PAGE, 'PageDown', 'looking down', () => view(PAGE), (v) => v.target[1] < before.target[1] - 0.2);
  });

  it("V10 a page's script cannot give the viewer the browser's commands, nor tell the browser the scene's state: messages on the window are neither", async () => {
    const PAGE = 'review-134-gravity.holoml';
    await openPage(PAGE);
    await still(PAGE);
    // Forged state, as the page's script could post it: the browser must not take the page for loading, or in its text view.
    await inPage(h, `(window.postMessage({ hypersolHolomlBusy: true, hypersolHolomlTextView: true, hypersolHolomlDrawn: true }, '*'), true)`, PAGE);
    // The real thing, after it, there and back: once the shell has heard these, it has heard (and ignored) the forgery.
    await h.shell.click(TEXT_VIEW);
    await waitFor('the button pressed', () => h.shell.locator(TEXT_VIEW).getAttribute('aria-pressed'), (v) => v === 'true');
    await h.shell.click(TEXT_VIEW);
    await waitFor('the button released', () => h.shell.locator(TEXT_VIEW).getAttribute('aria-pressed'), (v) => v === 'false');
    expect(await h.shell.locator(STOP).count(), 'the page is not taken for loading').toBe(0);
    // Behind another tab the page draws nothing; a forged "in front" does not wake it.
    await still(PAGE);
    await pressInShell(h, 'T', ['control']);
    await waitFor('the page behind', () => holo<boolean>(PAGE, 'window.__holoml.behind'), (b) => b === true, await sceneWait(h, 5000));
    // Posted, and then a second message to know the first has been delivered.
    const behind = await inPage<boolean>(
      h,
      `new Promise((resolve) => {
        window.addEventListener('message', function heard(e) {
          if (e.data !== 'review-134-after') return;
          window.removeEventListener('message', heard);
          resolve(window.__holoml.behind);
        });
        window.postMessage({ hypersolHolomlCommand: 'in-front' }, '*');
        window.postMessage('review-134-after', '*');
      })`,
      PAGE,
    );
    expect(behind, 'still behind after a forged "in front"').toBe(true);
    // The browser's own command still arrives: the tab in front again, the page is told.
    await pressInShell(h, 'W', ['control']);
    await waitFor('in front again', () => holo<boolean>(PAGE, 'window.__holoml.behind'), (b) => b === false, await sceneWait(h, 5000));
  });

  it("V10 a script runs though another element on its line has a problem; only its own element's problems leave it out", async () => {
    const PAGE = 'review-134-script.holoml';
    await openPage(PAGE);
    // The line has the meta's problem, reported as ever.
    const problems = await holo<{ code: string; line: number }[]>(PAGE, 'window.__holoml.problems');
    expect(problems).toContainEqual(expect.objectContaining({ code: 'unknown-attribute', line: 4 }));
    await waitFor('the script ran', () => holo<{ id: string | null; text: string }[]>(PAGE, 'window.__holoml.huds()'), (huds) => huds[0]?.text === 'the script ran');
    expect(await consoleText()).not.toMatch(/review-134-script[^\n]*was not run/);
  });

  it('V10 the graphics card reset: once its context is back the scene is drawn again, lit as it was', async () => {
    const PAGE = 'still.holoml';
    await openPage(PAGE);
    const f0 = await still(PAGE);
    const p = (await holo<Point | null>(PAGE, 'window.__holoml.point("car")'))!;
    const before = await colourAt(PAGE, p);
    // Lost, as a driver reset loses it, and given back.
    await inPage(
      h,
      `(() => {
        const canvas = document.querySelector('[data-testid="holoml-canvas"]');
        window.__r134 = { lost: false, restored: false, ext: canvas.getContext('webgl2').getExtension('WEBGL_lose_context') };
        canvas.addEventListener('webglcontextlost', () => (window.__r134.lost = true));
        canvas.addEventListener('webglcontextrestored', () => (window.__r134.restored = true));
        window.__r134.ext.loseContext();
        return true;
      })()`,
      PAGE,
    );
    await waitFor('the context lost', () => inPage<boolean>(h, 'window.__r134.lost', PAGE), (v) => v);
    await inPage(h, '(window.__r134.ext.restoreContext(), true)', PAGE);
    await waitFor('the context back', () => inPage<boolean>(h, 'window.__r134.restored', PAGE), (v) => v);
    await waitFor('drawn again', () => frames(PAGE), (n) => n > f0, await sceneWait(h, 10_000));
    await still(PAGE);
    const after = await colourAt(PAGE, p);
    const apart = Math.hypot(after.r - before.r, after.g - before.g, after.b - before.b);
    expect(apart, `the car before ${JSON.stringify(before)} and after ${JSON.stringify(after)}`).toBeLessThan(30);
  });

  it('V10 a sound from a place with a range under a metre is heard at its volume within it, and not beyond', async () => {
    const PAGE = 'review-134-sound.holoml';
    await openPage(PAGE);
    type Place = { distance: number; gain: number; range: number };
    const sound = async () => (await holo<{ id: string; playing: boolean; place?: Place }[]>(PAGE, 'window.__holoml.sounds()')).find((s) => s.id === 'close')!;
    const ears = () => holo<{ left: number; right: number } | null>(PAGE, 'window.__holoml.soundLevels("close")');
    const [w, hgt] = await inPage<number[]>(h, '[innerWidth, innerHeight]', PAGE);
    // The first click lets the page play sound.
    await clickUntil(h, await project(h, w! / 2, hgt! * 0.8), 'sound allowed', () => holo<boolean>(PAGE, 'window.__holoml.soundsActive'));
    const near = await waitFor('the sound playing, its place worked out', sound, (s) => s.playing && s.place !== undefined, 10_000);
    expect(near.place).toMatchObject({ gain: 1, range: 0.8 });
    expect(near.place!.distance).toBeCloseTo(0.5, 2);
    // Half a metre away, inside its range: heard in both ears (it was silent, though its gain said 1).
    await waitFor('heard', ears, (e) => e !== null && e.left > 0.01 && e.right > 0.01, 10_000);
    // A step back, beyond its range: silent.
    await moveTo(PAGE, [0, 1.6, 1]);
    const far = await waitFor('beyond its range', sound, (s) => s.place !== undefined && s.place.gain === 0);
    expect(far.place!.distance).toBeCloseTo(1.5, 2);
    await waitFor('silent', ears, (e) => e !== null && e.left < 0.001 && e.right < 0.001, 10_000);
  });

  it('V10 what a script hides takes no click and no link and stops no one, drawn as an instance or as its own copy', async () => {
    const PAGE = 'review-134-hidden.holoml';
    await openPage(PAGE);
    await still(PAGE);
    const linkAt = async (id: string) => {
      const p = await holo<Point | null>(PAGE, `window.__holoml.point(${JSON.stringify(id)})`);
      return p ? holo<string | null>(PAGE, `window.__holoml.linkAt(${p.x}, ${p.y})`) : 'out of view';
    };
    // Shown: each is its link. The car is its own copy (it changes a material); the block is an instance.
    expect(await linkAt('car')).toBe(url('second.holoml'));
    expect(await linkAt('block')).toBe(url('second.holoml#top'));
    await inPage(h, `(holoml.find('car').visible = false, holoml.find('block').visible = false, true)`, PAGE);
    await still(PAGE);
    expect(await linkAt('car')).toBeNull();
    expect(await linkAt('block')).toBeNull();
    // A click where the car was reaches the page's script as a click on nothing, and follows no link.
    await inPage(h, `(holoml.on('click', (e) => (window.__r134Clicked = { thing: e.thing ? e.thing.id : null })), true)`, PAGE);
    const car = (await holo<Point | null>(PAGE, 'window.__holoml.point("car")'))!;
    await clickUntil(h, await project(h, car.x, car.y), 'the click heard', () => inPage<boolean>(h, 'window.__r134Clicked !== undefined', PAGE));
    expect(await inPage(h, 'window.__r134Clicked', PAGE)).toEqual({ thing: null });
    expect(await inPage<string>(h, 'location.pathname', PAGE)).toBe('/holoml/review-134-hidden.holoml');

    // The wall (instances, solid) stops the walker while it is shown.
    const z = async () => (await view(PAGE)).position[2];
    await holdKeyUntil(h, PAGE, 'W', 'the walker at the wall', z, (v) => v < 0.9);
    expect(await z()).toBeGreaterThan(0.79);
    // Hidden, it stops no one: the walker goes through where it was.
    await inPage(h, `(holoml.find('wall').visible = false, true)`, PAGE);
    await holdKeyUntil(h, PAGE, 'W', 'the walker past the hidden wall', z, (v) => v < -1);
    // Shown again, it is a wall again: from behind it, the walker cannot come back through.
    await inPage(h, `(holoml.find('wall').visible = true, true)`, PAGE);
    await holdKeyUntil(h, PAGE, 'S', 'the walker at the back of the wall', z, (v) => v > -0.9);
    expect(await z()).toBeLessThan(-0.79);
  });

  it('drawn in software the scene has half the pixels each way and no smoothed edges, and says so once; with a graphics card it is drawn in full; clicks still land', async () => {
    const PAGE = 'still.holoml';
    await openPage(PAGE);
    await still(PAGE);
    const software = await softwareRenderer(h);
    type Drawing = { software: string | null; antialias: boolean; pixelRatio: number; devicePixelRatio: number };
    const drawing = await holo<Drawing>(PAGE, 'window.__holoml.drawing()');
    const canvas = await inPage<{ width: number; css: number; smoothed: boolean }>(
      h,
      `(() => {
        const c = document.querySelector('[data-testid="holoml-canvas"]');
        return { width: c.width, css: c.getBoundingClientRect().width, smoothed: c.getContext('webgl2').getContextAttributes().antialias };
      })()`,
      PAGE,
    );
    const said = (await consoleText()).split('\n').filter((l) => /draws 3D in software.*half its sharpness and without smoothed edges/.test(l));
    if (software) {
      expect(drawing.software).toBe(software);
      expect(drawing).toMatchObject({ antialias: false, pixelRatio: drawing.devicePixelRatio * 0.5 });
      expect(canvas.smoothed).toBe(false);
      expect(Math.abs(canvas.width - canvas.css * drawing.devicePixelRatio * 0.5)).toBeLessThanOrEqual(1);
      expect(said.length).toBeGreaterThan(0);
      console.log(`Drawing in software (${software}): ${canvas.width} pixels across a page of ${canvas.css}`);
    } else {
      expect(drawing).toMatchObject({ software: null, antialias: true, pixelRatio: drawing.devicePixelRatio });
      expect(canvas.smoothed).toBe(true);
      expect(Math.abs(canvas.width - canvas.css * drawing.devicePixelRatio)).toBeLessThanOrEqual(1);
      expect(said).toEqual([]);
    }
    // Not a thing left out: the page's one problem is the model from another site, as ever.
    expect((await leftOut(PAGE)).map((x) => x.what)).toEqual(['http://localhost:1/models/placeholder-car.gltf']);
    // What is sized in page pixels still lines up: a link is under its own point, and a click there follows it.
    const link = (await holo<Point | null>(PAGE, 'window.__holoml.point(0)'))!;
    expect(await holo(PAGE, `window.__holoml.linkAt(${link.x}, ${link.y})`)).toBe(url('second.holoml'));
    await clickUntil(h, await project(h, link.x, link.y), 'the link followed', async () => (await shellCall(h, 'status'))?.url === url('second.holoml'));
  });

  it("D12 the tests' hooks are there only because this is a test run, and a page's script can neither change them nor find the mark", async () => {
    const PAGE = 'review-134-gravity.holoml';
    await openPage(PAGE);
    expect(await inPage<boolean>(h, 'Object.isFrozen(window.__holoml)', PAGE)).toBe(true);
    // The mark the preload put on the viewer's script element was read, and is gone.
    expect(await inPage<number>(h, 'document.querySelectorAll("script[data-hypersol-holoml-test]").length', PAGE)).toBe(0);
    // A page's script cannot put its own answers in their place.
    const forged = await inPage<string>(
      h,
      `(() => {
        try { window.__holoml.scene = () => 'forged'; } catch {}
        try { window.__holoml = { scene: () => 'forged' }; } catch {}
        return typeof window.__holoml.scene();
      })()`,
      PAGE,
    );
    expect(forged).toBe('object');
    // The instrument panel's picking and choosing can come over the private line, as the main process would send
    // them, so that nothing on the window need act: picking on, a thing chosen, picking off.
    const send = (command: string) =>
      h.app.evaluate(
        ({ webContents }, { page, command }) => {
          const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop()!;
          guest.send('hypersol:holoml-command', command);
        },
        { page: PAGE, command },
      );
    const scene = () => holo<{ picking: boolean; selected: number }>(PAGE, 'window.__holoml.scene()');
    expect(await scene()).toMatchObject({ picking: false, selected: -1 });
    await send('pick-on');
    await waitFor('picking on', scene, (s) => s.picking);
    await send('select:2');
    await waitFor('the third thing chosen', scene, (s) => s.selected === 2);
    await send('pick-off');
    await send('select:-1');
    await waitFor('picking off, nothing chosen', scene, (s) => !s.picking && s.selected === -1);
    // Anything else on that channel is dropped by the preload.
    await send('select:2; alert(1)');
    await send('pick-on');
    await waitFor('picking on again', scene, (s) => s.picking);
    expect((await scene()).selected).toBe(-1);
    await send('pick-off');
  });
});
