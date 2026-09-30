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

/** Presses a key in a page as a keyboard does: down, the character it gives, up. */
async function sendKeyWithChar(h: Harness, page: string, keyCode: string, char: string): Promise<void> {
  await h.app.evaluate(
    ({ webContents }, { page, keyCode, char }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop();
      if (!guest) throw new Error('No web page to press keys in');
      guest.sendInputEvent({ type: 'keyDown', keyCode });
      guest.sendInputEvent({ type: 'char', keyCode: char });
      guest.sendInputEvent({ type: 'keyUp', keyCode });
    },
    { page, keyCode, char },
  );
}

describe('review 134: the HoloML viewer', () => {
  it('V2 a page written for a version the viewer does not know, or that names none, is refused, with a card that says so; it is not drawn as an older version', async () => {
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
    // A page that names no version at all is not drawn either: nothing of its scene is built or asked for.
    const NONE = 'review-134-no-version.holoml';
    await openPage(NONE);
    expect(await holo(NONE, 'window.__holoml.error')).toMatchObject({ code: 'unsupported-version', line: 1, column: 1 });
    const none = await inPage<string>(h, `document.querySelector('[data-testid="holoml-error"]').innerText`, NONE);
    expect(none).toContain('does not say its version');
    expect(none).toContain('This browser reads HoloML 0.1 and 0.2.');
    expect(await inPage<boolean>(h, 'document.querySelector("canvas") === null', NONE)).toBe(true);
    expect(await holo(NONE, 'window.__holoml.models()')).toEqual([]);
    expect(await inPage<string>(h, 'document.title', NONE)).toBe('HoloML page without a version');
    expect(hits('/holoml/models/no-version-car.gltf')).toBe(0);
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
    /** Where the text has scrolled to once it has stopped moving (the same place read twice, 150 ms apart). */
    const settledScroll = () =>
      waitFor(
        'the scroll to settle',
        async () => {
          const before = await scrolled();
          await sleep(150);
          const after = await scrolled();
          return after === before ? after : -1;
        },
        (y) => y >= 0,
        5000,
      );
    expect(await scrolled()).toBe(0);
    // Page Down, the down arrow, and the space bar each scroll the text further. The space bar scrolls only
    // while no button has the keyboard (on a button it presses the button, as on any page), so the keyboard
    // is put on the text itself first, as a click on it would; on GitHub's Windows machines a button had it.
    await inPage(h, '(document.activeElement instanceof HTMLElement && document.activeElement.blur(), true)', PAGE);
    let at = 0;
    for (const keyCode of ['PageDown', 'Down', 'Space']) {
      // A keyboard's space bar also gives the page the character (a "char" event, Chromium's keypress),
      // and it is on that, not on the key going down, that a page scrolls; the other two scroll on the
      // key alone. GitHub's Windows machines scrolled on none without it.
      if (keyCode === 'Space') await sendKeyWithChar(h, PAGE, 'Space', ' ');
      else await pressInPage(h, keyCode, [], PAGE);
      at = await waitFor(`${keyCode} scrolling the text (the keyboard on ${await inPage<string>(h, 'document.activeElement?.tagName ?? "nothing"', PAGE)})`, scrolled, (y) => y > at);
      // The scroll is smooth: where it ends is the place the next key scrolls from.
      at = await settledScroll();
    }
    await pressInPage(h, 'PageUp', [], PAGE);
    await waitFor(`Page Up scrolling back from ${at}`, scrolled, (y) => y < at);
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
    // Face to face with it, the wall is what the middle of the view is on (holoml.aim, the crosshair).
    const aimed = () => inPage<string | null>(h, '(() => { const a = holoml.aim(); return a && a.thing ? a.thing.id : null; })()', PAGE);
    expect(await aimed()).toMatch(/^w[1-6]$/);
    // Hidden, it is not aimed at, and stops no one: the walker goes through where it was.
    await inPage(h, `(holoml.find('wall').visible = false, true)`, PAGE);
    expect(await aimed()).toBeNull();
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
    // Nothing on the window acts for the instrument panel any more, in a test run or a normal one (viewer/main.test.ts
    // holds the normal run's window to `scene` alone).
    expect(await inPage<string[]>(h, '[typeof window.__holoml.select, typeof window.__holoml.pick]', PAGE)).toEqual(['undefined', 'undefined']);
    // The instrument panel's picking and choosing come over the private line, as the main process sends them
    // (main/inspect; m15's R9 checks them from the panel itself): picking on, a thing chosen, picking off.
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

/**
 * The viewer does what the third edition of HoloML 0.2's specification
 * says (2026-09-30; the language's own review settled each of these).
 * The scene API's part is also held by unit tests (viewer/api.test.ts),
 * the values' by viewer/values.test.ts, and the extensions' by
 * viewer/budget.test.ts; these check the running app.
 */
describe("review 134: the viewer and the specification's third edition", () => {
  const API = 'review-134-api.holoml';

  it("Sp a thing in a page's module: setting a member its kind does not have is no error and changes nothing; the arrays it gives are frozen; its parent is its group through a link; a sound's place cannot be set to null", async () => {
    await openPage(API);
    type Out = { errors: string[]; after: [string, string, boolean]; parent: string | null; frozen: boolean[]; changed: string; nulled: string; place: Vec; position: Vec };
    // As a page's script runs it: a module's code is strict, where setting a member of a frozen object throws.
    const out = await inPage<Out>(
      h,
      `(() => {
        'use strict';
        const out = { errors: [] };
        const sign = holoml.find('sign');
        for (const name of ['rotation', 'scale', 'intensity', 'nonsense']) {
          try { sign[name] = [0, 90, 0]; } catch (e) { out.errors.push(name + ': ' + e.name); }
        }
        out.after = [typeof sign.rotation, typeof sign.nonsense, Object.keys(sign).includes('nonsense')];
        const car = holoml.find('car');
        out.parent = car.parent ? car.parent.id : null;
        const p = car.position;
        const tone = holoml.find('tone');
        out.frozen = [Object.isFrozen(p), Object.isFrozen(car.rotation), Object.isFrozen(car.scale), Object.isFrozen(holoml.viewer.position), Object.isFrozen(holoml.viewer.direction), Object.isFrozen(tone.position)];
        try { p[0] = 9; out.changed = 'no error'; } catch (e) { out.changed = e.name; }
        try { tone.position = null; out.nulled = 'no error'; } catch (e) { out.nulled = e.name; }
        out.place = tone.position;
        // A member it has is set as ever, with a new array.
        car.position = [0.5, 0, 0];
        out.position = car.position;
        return out;
      })()`,
      API,
    );
    expect(out.errors).toEqual([]);
    expect(out.after).toEqual(['undefined', 'undefined', false]);
    expect(out.parent).toBe('stand');
    expect(out.frozen).toEqual([true, true, true, true, true, true]);
    expect(out.changed).toBe('TypeError');
    expect(out.nulled).toBe('TypeError');
    expect(out.place).toEqual([0, 1, 0]);
    expect(out.position).toEqual([0.5, 0, 0]);
    // The label was not turned by the rotation it does not have.
    expect((await holo<{ rotation: Vec }>(API, 'window.__holoml.object("sign")')).rotation).toEqual([0, 0, 0]);
  });

  it("Sp the frame event's dt is never more than 100, and one frame's usual time, 16, for the first frame and for the first after drawing stopped", async () => {
    await openPage(API);
    await still(API);
    // Six frames heard by a script; the third takes a third of a second, as a slow frame does.
    const six = () =>
      inPage<number[]>(
        h,
        `new Promise((resolve) => {
          const dts = [];
          const stop = holoml.on('frame', (e) => {
            dts.push(e.dt);
            if (dts.length === 3) { const until = performance.now() + 350; while (performance.now() < until); }
            if (dts.length === 6) { stop(); resolve(dts); }
          });
        })`,
        API,
      );
    const first = await six();
    expect(first[0], `the first frame of ${JSON.stringify(first)}`).toBe(16);
    expect(first[3], `the frame after the slow one of ${JSON.stringify(first)}`).toBe(100);
    for (const dt of first) {
      expect(dt).toBeGreaterThan(0);
      expect(dt).toBeLessThanOrEqual(100);
    }
    // Nobody listens any more: drawing stops. The next listener's first frame has nothing to measure from.
    await still(API);
    const again = await six();
    expect(again[0], `the first frame after drawing stopped, of ${JSON.stringify(again)}`).toBe(16);
    expect(Math.max(...again)).toBeLessThanOrEqual(100);
    // The scene's own clock, which the checks of walking measure against, went on by what its frames did.
    await still(API);
    expect(await holo<number>(API, 'window.__holoml.clock')).toBeGreaterThanOrEqual([...first, ...again].reduce((a, b) => a + b, 0));
  });

  it('Sp holoml.add leaves out an animate and a sound that begins on a click, wherever they are in the markup, and the console says why; the rest is added', async () => {
    await openPage(API);
    type Added = { group: (string | null)[]; pair: (string | null)[]; found: Record<string, string | null> };
    const added = await inPage<Added>(
      h,
      `(() => {
        const group = holoml.add('<group id="g"><model id="m" src="models/spinner.gltf" /><animate target="#m" attribute="rotation" to="0 90 0" duration="1s" /><sound id="rung" src="gen/tone.wav" begin="click" trigger="#m" /><label id="kept">Kept</label><sound id="played" src="gen/tone.wav" /></group>');
        const pair = holoml.add('<model id="bell" src="models/spinner.gltf" position="3 0 0" /><sound id="ring" src="gen/tone.wav" begin="click" trigger="#bell" />');
        const found = {};
        for (const id of ['g', 'm', 'kept', 'played', 'rung', 'bell', 'ring']) { const t = holoml.find(id); found[id] = t ? t.kind : null; }
        return { group: group.map((t) => t.id), pair: pair.map((t) => t.id), found };
      })()`,
      API,
    );
    // One thing for each of the markup's own elements that was added.
    expect(added.group).toEqual(['g']);
    expect(added.pair).toEqual(['bell']);
    expect(added.found).toEqual({ g: 'group', m: 'model', kept: 'label', played: 'sound', rung: null, bell: 'model', ring: null });
    // The sounds left out were not built (and not fetched to wait for a click that would never play them); no click action was made.
    const sounds = await holo<{ id: string | null }[]>(API, 'window.__holoml.sounds()');
    expect(sounds.map((s) => s.id).sort()).toEqual(['played', 'tone']);
    expect(await holo<unknown[]>(API, 'window.__holoml.actions()')).toEqual([]);
    const said = (await consoleText()).split('\n').filter((l) => l.startsWith('HoloML: holoml.add:'));
    expect(said.filter((l) => /^HoloML: holoml\.add: line 1, column \d+: <animate> left out: what a script adds, the script moves itself\.$/.test(l))).toHaveLength(1);
    expect(said.filter((l) => /^HoloML: holoml\.add: line 1, column \d+: a <sound> that begins on a click left out: what a script adds, the script plays itself, with play\(\)\.$/.test(l))).toHaveLength(2);
    // Nothing was said of a limit: none was reached.
    expect(said.filter((l) => /limit/.test(l))).toEqual([]);
    await waitFor('the added models loaded', () => holo<{ src: string; state: string }[]>(API, 'window.__holoml.models()'), (m) => m.filter((x) => x.src === 'models/spinner.gltf' && x.state === 'loaded').length === 2, await sceneWait(h, 10_000));
  });

  it('Sp the text view shows every paragraph of a panel that is inside a link, after the link that has its first', async () => {
    await openPage(API);
    // The link is named by the panel's first paragraph, as before.
    expect(await holo<string[]>(API, 'window.__holoml.outline()')).toContain('a:Open the second page');
    const item = await inPage<string[]>(
      h,
      `(() => {
        const li = [...document.querySelectorAll('#holoml-outline li')].find((x) => x.querySelector('a') && x.querySelector('a').textContent === 'Open the second page');
        return li ? [...li.children].map((c) => c.tagName.toLowerCase() + ':' + [...(c.tagName === 'A' ? [c] : c.children)].map((p) => p.textContent).join('|')) : [];
      })()`,
      API,
    );
    expect(item).toEqual(['a:Open the second page', 'div:The second paragraph of a panel in a link.|And its third.']);
    await h.shell.click(TEXT_VIEW);
    await waitFor('the text view', () => holo<boolean>(API, 'window.__holoml.textView'), (v) => v === true);
    const text = await inPage<string>(h, 'document.getElementById("holoml-outline-nav").innerText', API);
    for (const words of ['Open the second page', 'The second paragraph of a panel in a link.', 'And its third.', 'A sign']) expect(text).toContain(words);
    // In the page's order: the panel's paragraphs one after another.
    expect(text.indexOf('Open the second page')).toBeLessThan(text.indexOf('The second paragraph'));
    expect(text.indexOf('The second paragraph')).toBeLessThan(text.indexOf('And its third.'));
    await h.shell.click(TEXT_VIEW);
    await waitFor('3D again', () => holo<boolean>(API, 'window.__holoml.textView'), (v) => v === false);
    // A script that changes the panel's words changes them there too.
    await inPage(h, `(holoml.find('notice').text = 'Open the second page\\n\\nOther words now.', true)`, API);
    expect(await inPage<string>(h, 'document.querySelector("#holoml-outline .holoml-panel-words").innerText.trim()', API)).toBe('Other words now.');
  });

  it('Sp only the ambient lights in the scene now dim the surroundings and the sky: with all of them removed, both are at full, not dark', async () => {
    const PAGE = 'review-134-ambient.holoml';
    await openPage(PAGE);
    await still(PAGE);
    const around = async () => [(await holo<{ intensity: number }>(PAGE, 'window.__holoml.environment()')).intensity, (await holo<{ intensity: number }>(PAGE, 'window.__holoml.sky()')).intensity];
    const both = (level: number) => (now: number[]) => now.every((v) => Math.abs(v - level) < 1e-6);
    // As the page wrote them: 0.3 and 0.15 of the 0.6 that is full.
    expect(await around()).toSatisfy(both(0.75));
    // The group that holds one goes: that light counts no more.
    await inPage(h, `(holoml.remove(holoml.find('lamps')), true)`, PAGE);
    await waitFor('dimmer, by the one ambient light left', around, both(0.5), await sceneWait(h, 5000));
    // The last one goes: at full, as a page without ambient lights is.
    await inPage(h, `(holoml.find('soft').remove(), true)`, PAGE);
    await waitFor('at full without ambient lights', around, both(1), await sceneWait(h, 5000));
    await still(PAGE);
    // Not dark: the mirror-like block shows the green panorama, brightly.
    const p = (await holo<Point | null>(PAGE, 'window.__holoml.point("mirror")'))!;
    const c = await colourAt(PAGE, p, 12);
    expect(c.g, `the block's colour ${JSON.stringify(c)}`).toBeGreaterThan(c.r + 40);
    expect(c.g).toBeGreaterThan(90);
    // One a script adds counts, from then on.
    await inPage(h, `(holoml.add('<light id="night" type="ambient" intensity="0.15" />'), true)`, PAGE);
    await waitFor('dimmed by the light the script added', around, both(0.25), await sceneWait(h, 5000));
    await inPage(h, `(holoml.find('night').intensity = 0.45, true)`, PAGE);
    await waitFor('brighter as that light is', around, both(0.75), await sceneWait(h, 5000));
  });

  it('Sp a model whose file needs a glTF extension the viewer does not read is left out, with the reason, like any model left out; its file is not fetched again at each approach', async () => {
    const PAGE = 'review-134-needs.holoml';
    const WHY = 'it needs the glTF extension EXT_made_up, which this browser does not read';
    await openPage(PAGE);
    type Model = { src: string; state: string; reason?: string };
    const models = async () => (await holo<{ models: Model[] }>(PAGE, 'window.__holoml.scene()')).models;
    const all = await models();
    expect(all.find((m) => m.src === 'review-134-needs.gltf')).toMatchObject({ state: 'left-out', reason: WHY });
    // The rest of the scene shows.
    expect(all.find((m) => m.src.endsWith('stone.gltf'))).toMatchObject({ state: 'loaded' });
    // Marked where it would be, in the notice, and in the console.
    expect(await holo<boolean>(PAGE, 'window.__holoml.object("needs").marked')).toBe(true);
    expect(await leftOut(PAGE)).toEqual([{ what: 'review-134-needs.gltf', why: WHY }]);
    expect(await inPage<string>(h, `document.querySelector('[data-testid="holoml-notice"]').textContent`, PAGE)).toContain(`review-134-needs.gltf: ${WHY}`);
    expect(await consoleText()).toContain(`HoloML: the model "review-134-needs.gltf" was left out: ${WHY}.`);
    // In a group that loads by area: left out at each approach, and fetched once (it would be left out again).
    const FAR = '/holoml/review-134-needs.gltf?far';
    expect(hits(FAR)).toBe(0);
    for (let approach = 1; approach <= 3; approach++) {
      await moveTo(PAGE, [0, 1.6, -25]);
      const far = await waitFor(`approach ${approach}: the far model left out`, () => area(PAGE, 'far'), (a) => a.in && a.models[0]!.state === 'left-out', await sceneWait(h, 10_000));
      expect(far.models[0]!.reason).toBe(WHY);
      await moveTo(PAGE, [0, 1.6, 5]);
      await waitFor('away again', () => area(PAGE, 'far'), (a) => !a.in && a.models[0]!.state === 'waiting', await sceneWait(h, 10_000));
    }
    expect(hits(FAR)).toBe(1);
  });

  it('Sp a material that takes no light is changed in its colour, opacity, and picture by material, by an option, and by a script; the console does not say its name was not found', async () => {
    const PAGE = 'review-134-unlit.holoml';
    await openPage(PAGE);
    type Material = { color: string; metalness: number | null; roughness: number | null; opacity: number; map: string | null; repeat: [number, number] | null };
    const signs = async () => (await holo<{ materials: Record<string, Material | undefined> }[]>(PAGE, 'window.__holoml.models()')).map((m) => m.materials['Sign']);
    const OWN = { color: '#ffffff', metalness: null, roughness: null, opacity: 1, map: null, repeat: null };
    const [plain, changed, pictured, chosen] = await signs();
    // As the file has it: white, with no metalness or roughness to tell of.
    expect(plain).toEqual(OWN);
    // A material element: its colour and opacity are taken; metalness and roughness are nothing to it.
    expect(changed).toEqual({ ...OWN, color: '#ff0000', opacity: 0.5 });
    // Its picture, tiled.
    expect(pictured).toEqual({ ...OWN, map: url('gen/stripes.png'), repeat: [3, 2] });
    expect(chosen).toEqual(OWN);
    // On the page: the changed box is red, the plain one is not.
    await still(PAGE);
    const at = async (id: string) => colourAt(PAGE, (await holo<Point | null>(PAGE, `window.__holoml.point(${JSON.stringify(id)})`))!, 6);
    const [red, white] = [await at('changed'), await at('plain')];
    expect(red.r, `the changed box ${JSON.stringify(red)}`).toBeGreaterThan(red.g + 60);
    expect(Math.abs(white.r - white.g), `the plain box ${JSON.stringify(white)}`).toBeLessThan(20);
    expect(white.g).toBeGreaterThan(120);
    // A choice's option.
    await inPage(h, `(holoml.find('finish').value = 'blue', true)`, PAGE);
    await waitFor('blue on the chosen box', signs, (s) => s[3]?.color === '#0000ff', await sceneWait(h, 5000));
    expect((await signs())[3]).toEqual({ ...OWN, color: '#0000ff', opacity: 0.75 });
    // A script's material(): the box was drawn as an instance until now, and gets its own copy.
    await inPage(h, `(holoml.find('plain').material('Sign', { color: '#00ff00', opacity: 0.75, metalness: 1, roughness: 0 }), true)`, PAGE);
    expect((await signs())[0]).toEqual({ ...OWN, color: '#00ff00', opacity: 0.75 });
    // The others keep theirs.
    expect((await signs())[1]).toEqual({ ...OWN, color: '#ff0000', opacity: 0.5 });
    await still(PAGE);
    const green = await at('plain');
    expect(green.g, `the box a script changed ${JSON.stringify(green)}`).toBeGreaterThan(green.r + 30);
    const text = await consoleText();
    expect(text).not.toMatch(/review-134-unlit\.gltf" has no material named/);
    expect(text).not.toMatch(/changes the material "Sign", which the model/);
    expect(await leftOut(PAGE)).toEqual([]);
  });

  it("Sp the card of a syntax error shows the error's code with its message and its place", async () => {
    const PAGE = 'mistake.holoml';
    await openPage(PAGE);
    expect(await holo(PAGE, 'window.__holoml.error')).toMatchObject({ code: 'unclosed-value', line: 5, column: 21 });
    const card = await inPage<string>(h, `document.querySelector('[data-testid="holoml-error"]').innerText`, PAGE);
    expect(card).toContain('The value of "background" is never closed with "');
    expect(card).toContain('Line 5, column 21 (unclosed-value):');
    expect(card).toContain('<scene background="#000>');
  });

  it("Sp a 0.1 page's screen text is not shown, as its slider is not, and the console says that neither is a 0.1 element", async () => {
    const PAGE = 'review-134-hud-01.holoml';
    await openPage(PAGE);
    expect(await holo(PAGE, 'window.__holoml.version')).toBe('0.1');
    const problems = await holo<{ code: string; line: number; column: number; message: string }[]>(PAGE, 'window.__holoml.problems');
    expect(problems).toEqual([
      { code: 'unknown-element', line: 9, column: 5, message: '<hud> is not a HoloML 0.1 element (it is in HoloML 0.2)' },
      { code: 'unknown-element', line: 10, column: 5, message: '<slider> is not a HoloML 0.1 element (it is in HoloML 0.2)' },
    ]);
    const text = await consoleText();
    expect(text).toContain('HoloML: line 9, column 5: <hud> is not a HoloML 0.1 element (it is in HoloML 0.2)');
    // Neither is on the page, in the scene or in its text view; the rest shows.
    expect(await holo<unknown[]>(PAGE, 'window.__holoml.huds()')).toEqual([]);
    expect(await holo<unknown[]>(PAGE, 'window.__holoml.sliders()')).toEqual([]);
    expect(await inPage<number>(h, 'document.querySelectorAll(".holoml-hud, .holoml-slider").length', PAGE)).toBe(0);
    expect(await holo<string[]>(PAGE, 'window.__holoml.labels()')).toEqual(['Still shown']);
    await h.shell.click(TEXT_VIEW);
    await waitFor('the text view', () => holo<boolean>(PAGE, 'window.__holoml.textView'), (v) => v === true);
    const words = await inPage<string>(h, 'document.body.innerText', PAGE);
    expect(words).toContain('Still shown');
    expect(words).not.toContain('Score: 0');
    expect(words).not.toContain('Pace');
    await h.shell.click(TEXT_VIEW);
    await waitFor('3D again', () => holo<boolean>(PAGE, 'window.__holoml.textView'), (v) => v === false);
  });
});
