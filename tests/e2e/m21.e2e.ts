/**
 * Milestone 21 end-to-end checks (TODO.md): HoloML 0.2's fifth part and
 * the aquarium. X2 to X4: water, sounds from a place, and a model's
 * animation speed. X5 to X9: the aquarium (a copy in
 * tests/fixtures/holoml/aquarium). X1 (the language) is the holoml
 * repository's tests; X10 (the published site) is checked by hand.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import { clickAt, inPage, launch, pressInPage, pressInShell, project, sceneWait, shellCall, sleep, softwareRenderer, waitFor, waitForPage, type Harness, type Point } from './harness';

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

type Vec = [number, number, number];
type Colour = { light: number; r: number; g: number; b: number };
type WaterInfo = { min: Vec; max: Vec; color: string; clarity: number; caustics: boolean; causticsShown: boolean; causticsLeftOut: string | null; causticsTime: number };
type SoundPlace = { distance: number; gain: number; pan: number; range: number };
type SoundReport = { id: string | null; state: string; playing: boolean; plays: number; place?: SoundPlace };
type Ears = { left: number; right: number };

const url = (page: string) => server.url(`holoml/${page}`);

function holo<T>(h: Harness, expression: string, page: string): Promise<T> {
  return inPage<T>(h, `window.__holoml ? (${expression}) : undefined`, page);
}

async function ready(h: Harness, page: string, timeoutMs = 20_000): Promise<void> {
  await waitFor(`${page} ready`, () => holo<boolean>(h, 'window.__holoml.ready', page), (r) => r === true, timeoutMs);
}

/** Opens a page in the harness's tab and waits until it is ready and drawn (its shaders compile after it is ready). */
async function openPage(h: Harness, page: string): Promise<void> {
  await shellCall(h, 'showUrl', url(page));
  await waitForPage(h, page, await sceneWait(h, 15_000));
  await ready(h, page, await sceneWait(h, 20_000));
  await painted(h, page);
}

/** Waits until the scene is drawn with every shader it needs. */
async function painted(h: Harness, page: string): Promise<void> {
  await waitFor(`${page} drawn`, () => holo<boolean>(h, 'window.__holoml.frames > 0 && !window.__holoml.compiling', page), (v) => v === true, await sceneWait(h, 20_000));
}

const point = async (h: Harness, page: string, id: string) => (await holo<Point | null>(h, `window.__holoml.point(${JSON.stringify(id)})`, page))!;
const water = (h: Harness, page: string) => holo<WaterInfo>(h, 'window.__holoml.water()', page);
/** Moves the viewer through the page's scene API (a 0.2 page's own script could do the same). */
const moveTo = (h: Harness, page: string, eye: Vec) => inPage<void>(h, `void (holoml.viewer.position = ${JSON.stringify(eye)})`, page);

/** The page's own pixels as drawn: the average colour in a square around each point (page pixels; `half` pixels each way). */
function pixels(h: Harness, page: string, points: Point[], half = 4): Promise<Colour[]> {
  return h.app.evaluate(
    async ({ webContents }, { page, points, half }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop()!;
      const image = await guest.capturePage();
      const { width, height } = image.getSize();
      const scale = width / ((await guest.executeJavaScript('window.innerWidth')) as number);
      const px = image.toBitmap(); // BGRA
      return points.map(({ x, y }) => {
        let [r, g, b, n] = [0, 0, 0, 0];
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            const [X, Y] = [Math.round(x * scale) + dx, Math.round(y * scale) + dy];
            if (X < 0 || Y < 0 || X >= width || Y >= height) continue;
            const i = (Y * width + X) * 4;
            b += px[i]!;
            g += px[i + 1]!;
            r += px[i + 2]!;
            n++;
          }
        }
        [r, g, b] = [r / n, g / n, b / n];
        return { light: 0.299 * r + 0.587 * g + 0.114 * b, r, g, b };
      });
    },
    { page, points, half },
  );
}

/** Emulates (or stops emulating) reduced motion in the tab's page. */
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

async function centre(h: Harness, page: string): Promise<Point> {
  const [w, hgt] = await inPage<number[]>(h, '[innerWidth, innerHeight]', page);
  return project(h, w! / 2, hgt! / 2);
}

const distance = (a: Colour, b: { r: number; g: number; b: number }) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
const WATER = { r: 0x1f, g: 0x6f, b: 0x8b };

describe('X2 to X4: water, sounds from a place, and animation speed', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
  });
  afterAll(async () => h?.close());

  it('X2 through the water a far model takes more of its colour than a near one, and one outside keeps its own; water with the light of its waves has it with a graphics card, and leaves it out, saying so, without one', async () => {
    let PAGE = 'water.holoml';
    await openPage(h, PAGE);
    expect(await water(h, PAGE)).toMatchObject({ min: [-5, -0.2, -8], max: [5, 4, 8], color: '#1f6f8b', clarity: 12, caustics: false, causticsShown: false });
    // How much each block has faded, by the page's own measure of the way through the water (as the shader's):
    // "near" is 1 m inside the tank's front, "far" 10 m, and "outside" is out of the water.
    const fade = (id: string) => holo<number>(h, `window.__holoml.waterFadeAt(window.__holoml.object(${JSON.stringify(id)}).position)`, PAGE);
    const [nearFade, farFade, outsideFade] = [await fade('near'), await fade('far'), await fade('outside')];
    expect(outsideFade).toBe(0);
    expect(nearFade).toBeGreaterThan(0.05);
    expect(nearFade).toBeLessThan(0.15);
    expect(farFade).toBeGreaterThan(0.75);
    expect(farFade).toBeLessThan(0.9);
    // On the page: the same red, lit alike, drawn through that much water.
    await sleep(500);
    const [near, far, outside] = await pixels(h, PAGE, [await point(h, PAGE, 'near'), await point(h, PAGE, 'far'), await point(h, PAGE, 'outside')]);
    expect(outside!.r - outside!.b, `the block outside the water is red (${JSON.stringify(outside)})`).toBeGreaterThan(100);
    const mix = (f: number) => ({ r: outside!.r + (WATER.r - outside!.r) * f, g: outside!.g + (WATER.g - outside!.g) * f, b: outside!.b + (WATER.b - outside!.b) * f });
    expect(distance(near!, mix(nearFade)), `near ${JSON.stringify(near)} against ${JSON.stringify(mix(nearFade))}`).toBeLessThan(40);
    expect(distance(far!, mix(farFade)), `far ${JSON.stringify(far)} against ${JSON.stringify(mix(farFade))}`).toBeLessThan(40);
    expect(distance(far!, WATER)).toBeLessThan(distance(near!, WATER) / 3);

    // The moving light, over a stone floor under 3 m of clear water.
    PAGE = 'caustics.holoml';
    await openPage(h, PAGE);
    const software = await softwareRenderer(h);
    // Drawn in software (GitHub's machines), the moving light is left out, as shadows are, and the console says so.
    if (software) expect(await water(h, PAGE)).toMatchObject({ caustics: true, causticsShown: false, causticsLeftOut: expect.stringMatching(/draws 3D in software/) });
    else expect(await water(h, PAGE)).toMatchObject({ caustics: true, causticsShown: true, causticsLeftOut: null });
  });

  it('X2 the light of the waves moves over a floor in the water, and holds still with reduced motion (with a graphics card)', async (ctx) => {
    const PAGE = 'caustics.holoml';
    const software = await softwareRenderer(h);
    if (software) {
      // There is no moving light to look at there: the check is skipped, not passed.
      console.log(`X2: the water's moving light left out, drawing in software (${software}); its pixels not checked`);
      ctx.skip(`the water's moving light is drawn only with graphics hardware; drawing in software (${software})`);
    }
    await openPage(h, PAGE);
    const c = await point(h, PAGE, 'spot');
    const line = () =>
      pixels(
        h,
        PAGE,
        Array.from({ length: 121 }, (_, i) => ({ x: c.x - 240 + i * 4, y: c.y })),
        0,
      );
    const a = await line();
    await sleep(700);
    const b = await line();
    const light = a.map((p) => p.light);
    expect(Math.max(...light) - Math.min(...light), 'bright threads and darker cells along a line of the floor').toBeGreaterThan(25);
    const moved = a.reduce((s, p, i) => s + Math.abs(p.light - b[i]!.light), 0) / a.length;
    expect(moved, 'the light moved in 0.7 s').toBeGreaterThan(3);
    // With reduced motion it holds still, and an idle page draws nothing.
    await reducedMotion(h, true);
    try {
      await sleep(400);
      const time = (await water(h, PAGE)).causticsTime;
      const s1 = await line();
      const frames = await holo<number>(h, 'window.__holoml.frames', PAGE);
      await sleep(700);
      const s2 = await line();
      expect((await water(h, PAGE)).causticsTime).toBe(time);
      expect(await holo<number>(h, 'window.__holoml.frames', PAGE)).toBe(frames);
      const still = s1.reduce((s, p, i) => s + Math.abs(p.light - s2[i]!.light), 0) / s1.length;
      expect(still).toBeLessThan(0.5);
    } finally {
      await reducedMotion(h, false);
    }
  });

  it('X3 a sound from a place is quieter as the viewer walks away, silent beyond its range, and comes from its side; it moves with its group, and a script can move it', async () => {
    const PAGE = 'sound-place.holoml';
    await openPage(h, PAGE);
    const sounds = () => holo<SoundReport[]>(h, 'window.__holoml.sounds()', PAGE);
    const sound = async (id: string) => (await sounds()).find((s) => s.id === id)!;
    const ears = (id: string) => holo<Ears | null>(h, `window.__holoml.soundLevels(${JSON.stringify(id)})`, PAGE);
    const both = (e: Ears | null) => (e ? e.left + e.right : 0);
    // Nothing plays before the first click or key, as with every sound.
    expect(await holo<boolean>(h, 'window.__holoml.soundsActive', PAGE)).toBe(false);
    expect(await inPage<Vec | null>(h, 'holoml.find("right").position', PAGE)).toEqual([4, 1.6, 0]);
    expect(await inPage<Vec | null>(h, 'holoml.find("plain").position', PAGE)).toBeNull();
    await clickAt(h, await centre(h, PAGE));
    await waitFor('the tone to the right playing', () => sound('right'), (s) => s.playing, 10_000);

    // 4 m to the viewer's right, heard within 12 m: full within 1 m, then evenly less, so 8/11 here.
    let right = await waitFor('its place worked out', () => sound('right'), (s) => s.place !== undefined);
    expect(right.place!.distance).toBeCloseTo(4, 2);
    expect(right.place!.gain).toBeCloseTo(8 / 11, 2);
    expect(right.place!.pan).toBeGreaterThan(0.95);
    // The right ear hears it; the left hardly.
    const side = await waitFor('heard in the right ear', () => ears('right'), (e) => e !== null && e.right > 0.005, 10_000);
    expect(side!.left, `left ${side!.left} right ${side!.right}`).toBeLessThan(side!.right * 0.2);
    // Facing it: ahead, and both ears alike.
    await inPage(h, 'holoml.viewer.lookAt([4, 1.6, 0]), true', PAGE);
    right = await waitFor('ahead of the viewer', () => sound('right'), (s) => Math.abs(s.place!.pan) < 0.05);
    const ahead = await waitFor('both ears alike', () => ears('right'), (e) => e !== null && e.left > 0.005 && Math.abs(e.left - e.right) < 0.2 * Math.max(e.left, e.right));
    // Walking away, still facing it: 10 m, 2/11 as loud; then 13 m, past its range, silent.
    await moveTo(h, PAGE, [-6, 1.6, 0]);
    right = await waitFor('10 m away', () => sound('right'), (s) => Math.abs(s.place!.distance - 10) < 0.05);
    expect(right.place!.gain).toBeCloseTo(2 / 11, 2);
    await waitFor('quieter', () => ears('right'), (e) => both(e) > 0 && both(e) < both(ahead) * 0.5);
    await moveTo(h, PAGE, [-9, 1.6, 0]);
    right = await waitFor('13 m away', () => sound('right'), (s) => Math.abs(s.place!.distance - 13) < 0.05);
    expect(right.place!.gain).toBe(0);
    await waitFor('silent past its range', () => ears('right'), (e) => e !== null && both(e) < 0.0005);

    // In a group 30 m off: silent, until the group comes near; the sound comes with it.
    let cart = await waitFor('the cart tone playing', () => sound('cart-tone'), (s) => s.playing && s.place !== undefined);
    expect(cart.place!.gain).toBe(0);
    await inPage(h, 'holoml.find("cart").position = [-9, 0, -2], true', PAGE);
    cart = await waitFor('the cart 2 m away', () => sound('cart-tone'), (s) => Math.abs(s.place!.distance - 2) < 0.05);
    expect(cart.place!.gain).toBeCloseTo(8 / 9, 2);
    await waitFor('the cart heard', () => ears('cart-tone'), (e) => both(e) > 0.01);

    // A script moves a sound: 3 m to the viewer's left now (the viewer faces +x, so -z is left).
    await inPage(h, 'holoml.find("right").position = [-9, 1.6, -3], true', PAGE);
    expect(await inPage<Vec>(h, 'holoml.find("right").position', PAGE)).toEqual([-9, 1.6, -3]);
    right = await waitFor('on the left', () => sound('right'), (s) => s.place!.pan < -0.95);
    expect(right.place!.distance).toBeCloseTo(3, 2);
    const left = await waitFor('heard in the left ear', () => ears('right'), (e) => e !== null && e.left > 0.005);
    expect(left!.right).toBeLessThan(left!.left * 0.2);
    // A sound without a place is heard alike everywhere: it has no place, and the page's hooks have no ears for it.
    await inPage(h, 'holoml.find("plain").play(), true', PAGE);
    await waitFor('the plain tone playing', () => sound('plain'), (s) => s.playing);
    expect((await sound('plain')).place).toBeUndefined();
    expect(await ears('plain')).toBeNull();
  });

  it("X4 a script's animation speed makes a model's animation run that much faster, and 0 holds it still", async () => {
    const PAGE = 'animation-speed.holoml';
    await openPage(h, PAGE);
    const speed = (id: string) => inPage<number>(h, `holoml.find(${JSON.stringify(id)}).animationSpeed`, PAGE);
    expect(await speed('spin')).toBe(1);
    await inPage(h, 'holoml.find("spin").animationSpeed = 2, true', PAGE);
    expect(await speed('spin')).toBe(2);
    expect(await speed('steady')).toBe(1);
    // Outside 0 to 4: an error, and the speed stays.
    const error = await inPage<string>(h, '(() => { try { holoml.find("spin").animationSpeed = 5; return "none"; } catch (e) { return `${e.name}: ${e.message}`; } })()', PAGE);
    expect(error).toBe('TypeError: animationSpeed must be a number from 0 to 4');
    expect(await speed('spin')).toBe(2);
    // How far each clip (2 s long, repeating) runs in a second of the page's frames, measured in the page.
    const advance = () =>
      inPage<[number, number]>(
        h,
        `new Promise((resolve) => {
          const times = () => window.__holoml.models().map((m) => m.animation.time);
          let last = times();
          const sum = [0, 0];
          const start = performance.now();
          const step = () => {
            const now = times();
            for (const i of [0, 1]) {
              let d = now[i] - last[i];
              if (d < 0) d += 2;
              sum[i] += d;
            }
            last = now;
            if (performance.now() - start < 1000) requestAnimationFrame(step);
            else resolve(sum);
          };
          requestAnimationFrame(step);
        })`,
        PAGE,
      );
    const [fast, steady] = await advance();
    expect(steady).toBeGreaterThan(0.3);
    expect(fast / steady).toBeCloseTo(2, 1);
    await inPage(h, 'holoml.find("spin").animationSpeed = 0, true', PAGE);
    const [held, still] = await advance();
    expect(held).toBeLessThan(0.001);
    expect(still).toBeGreaterThan(0.3);
  });
});

// ---- X5 to X9: the aquarium ------------------------------------------------------------------

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
function press(h: Harness, page: string, which: 'Enter' | 'Space' | 'F'): Promise<void> {
  return h.app.evaluate(
    ({ webContents }, { page, which }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop()!;
      guest.sendInputEvent({ type: 'keyDown', keyCode: which });
      guest.sendInputEvent({ type: 'char', keyCode: which === 'Enter' ? '\r' : which === 'Space' ? ' ' : 'f' });
      guest.sendInputEvent({ type: 'keyUp', keyCode: which });
    },
    { page, which },
  );
}

/** The accessibility tree's named nodes, as screen readers get them. */
function axNodes(h: Harness, page: string): Promise<{ role: string; name: string }[]> {
  return h.app.evaluate(async ({ webContents }, page) => {
    const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop()!;
    const attached = guest.debugger.isAttached();
    if (!attached) guest.debugger.attach('1.3');
    try {
      const r = (await guest.debugger.sendCommand('Accessibility.getFullAXTree')) as { nodes: { ignored: boolean; role?: { value: string }; name?: { value: string } }[] };
      return r.nodes.filter((n) => !n.ignored && n.name?.value).map((n) => ({ role: n.role?.value ?? '', name: n.name!.value }));
    } finally {
      if (!attached) guest.debugger.detach();
    }
  }, page);
}

/** The page's memory after its garbage is collected: its JavaScript heap and its ArrayBuffers, in bytes. */
function pageMemory(h: Harness, page: string): Promise<{ heap: number; buffers: number }> {
  return h.app.evaluate(async ({ webContents }, page) => {
    const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop()!;
    const attached = guest.debugger.isAttached();
    if (!attached) guest.debugger.attach('1.3');
    try {
      await guest.debugger.sendCommand('HeapProfiler.collectGarbage');
      const use = (await guest.debugger.sendCommand('Runtime.getHeapUsage')) as { usedSize: number; backingStorageSize?: number };
      return { heap: use.usedSize, buffers: use.backingStorageSize ?? 0 };
    } finally {
      if (!attached) guest.debugger.detach();
    }
  }, page);
}

interface Ocean {
  TANK: { min: Vec; max: Vec };
  TUNNEL: { radius: number; from: number; to: number };
  FEEDER: Vec;
  ROCKS: { at: Vec; scale: number }[];
  KINDS: { kind: string; name: string; about: string; count: number; school: boolean }[];
}

describe('X5 to X9: the aquarium', () => {
  let h: Harness;
  let ocean: Ocean;
  let ids: string[];
  /** How long the aquarium took to be drawn (X5), and the frames a second it was drawn at (X9): measured by those checks, and held to their budgets by the ones after them. */
  let drawnMs: number | null = null;
  let framesASecond: number | null = null;
  const TANK_PAGE = 'aquarium/index.holoml';
  /** The aquarium's checks: drawn in software (GitHub's machines) they take minutes, not seconds. Not a requirement. */
  const TANK_TIME = 600_000;
  const MB = 1024 * 1024;
  const EATERS = ['tuna', 'barramundi', 'bream', 'mackerel', 'snapper', 'clownfish', 'butterflyfish'];

  const frames = () => holo<number>(h, 'window.__holoml.frames', TANK_PAGE);
  const feet = async () => (await holo<{ feet: Vec }>(h, 'window.__holoml.walker()', TANK_PAGE)).feet;
  const stand = (at: Vec, look: Vec) => inPage(h, `(holoml.viewer.position = ${JSON.stringify(at)}, holoml.viewer.lookAt(${JSON.stringify(look)}), true)`, TANK_PAGE);
  const hud = async (id: string) => (await holo<{ id: string | null; text: string }[]>(h, 'window.__holoml.huds()', TANK_PAGE)).find((x) => x.id === id)?.text ?? '';
  const board = async () => (await holo<{ id: string | null; paragraphs: string[] }[]>(h, 'window.__holoml.panels()', TANK_PAGE)).find((p) => p.id === 'board')!.paragraphs;
  const places = () => holo<{ current: string | null }>(h, 'window.__holoml.places()', TANK_PAGE);
  const plays = async (id: string) => (await holo<{ id: string | null; plays: number }[]>(h, 'window.__holoml.sounds()', TANK_PAGE)).find((s) => s.id === id)!.plays;
  /** Every fish's place, by its id. */
  const fishAt = async () => Object.fromEntries(await inPage<[string, Vec][]>(h, `${JSON.stringify(ids)}.map((id) => [id, holoml.find(id).position])`, TANK_PAGE)) as Record<string, Vec>;
  const focusedText = () => inPage<string>(h, 'document.activeElement?.textContent ?? ""', TANK_PAGE);
  /**
   * Tab through the page's outline until an item with this text has the
   * keyboard. When it never does, the failure says which text was looked
   * for, how many times Tab was pressed, and what had the keyboard last.
   */
  async function tabTo(text: string): Promise<void> {
    let presses = 0;
    let last = await focusedText();
    while (last !== text && presses < 90) {
      await pressInPage(h, 'Tab', [], TANK_PAGE);
      presses++;
      last = await focusedText();
    }
    expect(last, `Tab did not reach ${JSON.stringify(text)} in the outline: Tab was pressed ${presses} times, and the keyboard was last on ${JSON.stringify(last)}`).toBe(text);
  }
  /** Walks with a key held until the walker stops (the same place while the page drew new frames) or the time is up. */
  async function walkUntilStopped(keyCode: string, maxMs: number): Promise<Vec> {
    await key(h, TANK_PAGE, keyCode, 'keyDown');
    try {
      const end = Date.now() + maxMs;
      let [last, lastFrames, still] = [await feet(), await frames(), 0];
      while (Date.now() < end && still < 3) {
        await sleep(250);
        const [now, drawnNow] = [await feet(), await frames()];
        if (drawnNow < lastFrames + 2) continue;
        still = now.every((v, i) => Math.abs(v - last[i]!) <= 0.002) ? still + 1 : 0;
        [last, lastFrames] = [now, drawnNow];
      }
      return last;
    } finally {
      await key(h, TANK_PAGE, keyCode, 'keyUp');
    }
  }

  beforeAll(async () => {
    ocean = (await import(new URL('../fixtures/holoml/aquarium/ocean.js', import.meta.url).href)) as Ocean;
    ids = ocean.KINDS.flatMap((k) => Array.from({ length: k.count }, (_, i) => `${k.kind}-${i + 1}`));
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
  });
  afterAll(async () => h?.close());

  it('X5 the aquarium: ready with everything loaded and no problems; the fish swim, in the water and clear of the tunnel and the rocks; the ledges and the rail stop the walker', async () => {
    const t = Date.now();
    await shellCall(h, 'showUrl', url(TANK_PAGE));
    await waitForPage(h, TANK_PAGE, await sceneWait(h, 15_000));
    await ready(h, TANK_PAGE, 60_000);
    const ms = Date.now() - t;
    // Its shaders compile once it is ready, without holding up the page: the tank is on the screen when they have.
    await painted(h, TANK_PAGE);
    // Within 5 seconds is the next check's.
    drawnMs = Date.now() - t;
    console.log(`X5: ready in ${ms} ms, drawn in ${drawnMs} ms`);
    expect(await holo<unknown[]>(h, 'window.__holoml.problems', TANK_PAGE)).toEqual([]);
    expect(await holo<unknown[]>(h, 'window.__holoml.leftOut()', TANK_PAGE)).toEqual([]);
    // Since milestone 25 (HoloML 0.3 `far`) a fish past 10 m is drawn from its lighter version, and its own model
    // waits until it swims near: every other model is loaded, and every far fish's lighter version is drawn (a near
    // fish's lighter version waits in turn).
    const [models, far] = await holo<[{ src: string; state: string; farFor?: string }[], { state: string; isFar: boolean; far: { shown: boolean } }[]]>(
      h,
      '[window.__holoml.models(), window.__holoml.far()]',
      TANK_PAGE,
    );
    const waiting = models.filter((m) => m.state !== 'loaded' && !m.farFor);
    expect(waiting.every((m) => m.state === 'waiting')).toBe(true);
    expect(waiting).toHaveLength(far.filter((f) => f.isFar).length);
    expect(far.filter((f) => f.isFar && !(f.far.shown && f.state === 'waiting'))).toEqual([]);
    expect(ids).toHaveLength(30);
    for (const k of ocean.KINDS) expect(models.filter((m) => m.src === `models/${k.kind}.glb`), k.kind).toHaveLength(k.count);

    // The fish swim: every one moves, and every place it is seen at is in the water, outside the tunnel's glass, and outside the rocks.
    const { TANK, TUNNEL, ROCKS } = ocean;
    const first = await fishAt();
    const end = Date.now() + (await sceneWait(h, 8000));
    let samples = 0;
    let last = first;
    while (Date.now() < end) {
      await sleep(400);
      last = await fishAt();
      samples++;
      for (const [id, p] of Object.entries(last)) {
        for (let a = 0; a < 3; a++) expect(p[a], `${id} in the water (${p.join(', ')})`).toBeGreaterThanOrEqual(TANK.min[a]!);
        for (let a = 0; a < 3; a++) expect(p[a], `${id} in the water (${p.join(', ')})`).toBeLessThanOrEqual(TANK.max[a]!);
        if (p[2] < TUNNEL.from && p[2] > TUNNEL.to) expect(Math.hypot(p[0], Math.max(0, p[1])), `${id} outside the tunnel (${p.join(', ')})`).toBeGreaterThan(TUNNEL.radius);
        for (const r of ROCKS) {
          const centre: Vec = [r.at[0], r.at[1] + 0.75 * r.scale, r.at[2]];
          expect(Math.hypot(p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]), `${id} outside the rock at ${r.at.join(', ')}`).toBeGreaterThan(0.95 * r.scale);
        }
      }
    }
    expect(samples).toBeGreaterThan(5);
    for (const id of ids) expect(Math.hypot(...last[id]!.map((v, i) => v - first[id]![i]!) as Vec), `${id} swam`).toBeGreaterThan(0.05);

    // The ledges keep the walker off the glass (the right one's inside face at x = 1.775; the walker is 0.6 m wide), and the rail across the end.
    await stand([0, 1.6, 2], [5, 1.6, 2]);
    const atLedge = await walkUntilStopped('W', await sceneWait(h, 8000));
    expect(atLedge[0], `stopped at ${atLedge.join(', ')}`).toBeGreaterThan(1.3);
    expect(atLedge[0]).toBeLessThan(1.6);
    await stand([0, 1.6, -9], [0, 1.6, -15]);
    const atRail = await walkUntilStopped('W', await sceneWait(h, 8000));
    expect(atRail[2], `stopped at ${atRail.join(', ')}`).toBeGreaterThan(-11.45);
    expect(atRail[2]).toBeLessThan(-11.1);
  }, TANK_TIME);

  it('X5 the aquarium is ready and drawn within 5 s (with a graphics card)', async (ctx) => {
    expect(drawnMs, 'the check before this one timed the aquarium').not.toBeNull();
    // Within 5 s with a graphics card; drawn in software (GitHub's machines), the time is measured and logged
    // (by the check before), and this check is skipped, not passed.
    const software = await softwareRenderer(h);
    if (software) {
      console.log(`X5: drawn in ${drawnMs} ms; the 5-second budget not checked: drawing in software (${software})`);
      ctx.skip(`the 5-second budget is for graphics hardware; drawing in software (${software})`);
    }
    expect(drawnMs!).toBeLessThan(5000);
  });

  it('X6 feeding: the Feed button (a click, and Enter on its button in the outline) drops the food with its sound; the fish come to it and eat every flake within a minute', async () => {
    await openPage(h, TANK_PAGE);
    const { FEEDER } = ocean;
    const eaters = ids.filter((id) => EATERS.includes(id.split('-')[0]!));
    /** How many of the fish that eat are within 3 m of where the food falls (across the ground). */
    const nearFood = async () => {
      const at = await fishAt();
      return eaters.filter((id) => Math.hypot(at[id]![0] - FEEDER[0], at[id]![2] - FEEDER[2]) < 3).length;
    };
    await stand([-0.6, 1.6, 1.5], [1.74, 1.2, 0.2]);
    expect(await hud('status')).toBe('');
    const before = await nearFood();
    // A click on the button (the first also lets sounds play): its plop, and food falling.
    const feedAt = (await waitFor('the Feed button in view', () => holo<Point | null>(h, 'window.__holoml.point("feed")', TANK_PAGE), (p) => p !== null))!;
    await clickAt(h, await project(h, feedAt.x, feedAt.y));
    // (Waits for what the page does in its own frames are as long as its frames need: drawn in software, seconds each.)
    await waitFor('food falling', () => hud('status'), (s) => s === 'Food is falling: the fish are coming.', await sceneWait(h, 5000));
    await stand([-0.6, 1.6, 1.5], [3.6, 3, 0]);
    await waitFor('the plop', () => plays('plop'), (n) => n >= 1, await sceneWait(h, 5000));
    // The fish come to it, and eat every flake.
    const most = await waitFor('fish at the food', nearFood, (n) => n >= before + 3, await sceneWait(h, 20_000));
    console.log(`X6: ${before} of ${eaters.length} fish that eat were within 3 m of the feeder before; ${most} came`);
    const done = await waitFor('the food eaten', () => hud('status'), (s) => s.startsWith('The fish have eaten'), await sceneWait(h, 60_000));
    expect(done).toBe('The fish have eaten.');
    // Enter on the button in the outline does the same.
    await tabTo('Feed the fish');
    await press(h, TANK_PAGE, 'Enter');
    await waitFor('food falling again', () => hud('status'), (s) => s === 'Food is falling: the fish are coming.', await sceneWait(h, 5000));
    await waitFor('the plop again', () => plays('plop'), (n) => n >= 2, await sceneWait(h, 5000));
  }, TANK_TIME);

  it("X7 a click on a fish, through the glass, and its kind's button in the outline, tell about it on the board", async () => {
    await openPage(h, TANK_PAGE);
    expect((await board())[0]).toBe('The fish of the tunnel');
    // The turtle, held still (reduced motion) above the tunnel, clicked through the glass from inside.
    await reducedMotion(h, true);
    try {
      await openPage(h, TANK_PAGE);
      await inPage(h, `(holoml.find('turtle-1').position = [0.3, 3.6, -1.5], true)`, TANK_PAGE);
      await stand([0, 1.6, 1.5], [0.3, 3.6, -1.5]);
      await sleep(300);
      await clickAt(h, await centre(h, TANK_PAGE));
      // The hawksbill took the flatback's place on 2026-09-30 (the flatback's model could not be used for its licence).
      const told = await waitFor('the turtle on the board', board, (b) => b[0] === 'Hawksbill sea turtle', await sceneWait(h, 5000));
      expect(told[1]).toMatch(/coral reefs/);
    } finally {
      await reducedMotion(h, false);
    }
    // The shark's button in the outline, from the keyboard.
    await openPage(h, TANK_PAGE);
    await tabTo('About the great white shark');
    await press(h, TANK_PAGE, 'Enter');
    const shark = await waitFor('the shark on the board', board, (b) => b[0] === 'Great white shark', await sceneWait(h, 5000));
    expect(shark[1]).toMatch(/must keep swimming to breathe/);
    // The board's words are in the page, for screen readers and Find in page.
    expect(await inPage<string>(h, 'document.getElementById("holoml-outline").innerText', TANK_PAGE)).toContain('must keep swimming to breathe');
  }, TANK_TIME);

  it('X8 for everyone: the whole visit from the keyboard; screen readers name the fish, the button, and the places; the text view; with reduced motion everything holds still, and feeding says the fish have eaten', async () => {
    await openPage(h, TANK_PAGE);
    const tree = await axNodes(h, TANK_PAGE);
    for (const k of ocean.KINDS) expect(tree.some((n) => n.role === 'button' && n.name === `About ${k.about}`), k.kind).toBe(true);
    expect(tree.some((n) => n.role === 'button' && n.name === 'Feed the fish')).toBe(true);
    for (const place of ['The entrance', 'In the tunnel', 'The feeding place', 'The end of the tunnel']) expect(tree.some((n) => n.role === 'button' && n.name === `Go to: ${place}`), place).toBe(true);
    expect(tree.some((n) => n.role === 'link' && n.name === 'About the aquarium')).toBe(true);
    // The keyboard: to the feeding place, and a fish's board.
    await tabTo('Go to: The feeding place');
    await press(h, TANK_PAGE, 'Enter');
    await waitFor('at the feeding place', places, (p) => p.current === 'feeding');
    await tabTo('About the tuna');
    await press(h, TANK_PAGE, 'Enter');
    await waitFor('the tuna on the board', board, (b) => b[0] === 'Tuna', await sceneWait(h, 5000));

    // The text view reads the welcome, the board, and the buttons.
    await pressInPage(h, 'V', ['control', 'shift'], TANK_PAGE);
    await waitFor('the text view', () => holo<boolean>(h, 'window.__holoml.textView', TANK_PAGE), (v) => v === true);
    const text = await inPage<string>(h, 'document.body.innerText', TANK_PAGE);
    for (const words of ['The ocean tunnel', 'About the great white shark', 'Feed the fish', 'Built for speed']) expect(text).toContain(words);
    await pressInPage(h, 'V', ['control', 'shift'], TANK_PAGE);
    await waitFor('3D again', () => holo<boolean>(h, 'window.__holoml.textView', TANK_PAGE), (v) => v === false);

    // Reduced motion: the fish, the bubbles, and the light hold still, and an idle page draws nothing; feeding (F, and Enter on the button) says the fish have eaten.
    await reducedMotion(h, true);
    try {
      await openPage(h, TANK_PAGE);
      const water = () => holo<{ causticsTime: number }>(h, 'window.__holoml.water()', TANK_PAGE);
      const [fishBefore, lightBefore] = [await fishAt(), (await water()).causticsTime];
      await sleep(1500);
      const f0 = await frames();
      await sleep(2000);
      expect(await frames(), 'no frames while idle').toBe(f0);
      expect(await fishAt()).toEqual(fishBefore);
      expect((await water()).causticsTime).toBe(lightBefore);
      await press(h, TANK_PAGE, 'F');
      await waitFor('food down', () => hud('status'), (s) => s === 'Food is down.', await sceneWait(h, 5000));
      await waitFor('eaten', () => hud('status'), (s) => s === 'The fish have eaten.', await sceneWait(h, 5000));
      await inPage(h, `(holoml.find('status').text = '', true)`, TANK_PAGE);
      await tabTo('Feed the fish');
      await press(h, TANK_PAGE, 'Enter');
      await waitFor('eaten again', () => hud('status'), (s) => s === 'The fish have eaten.', await sceneWait(h, 5000));
      expect(await fishAt()).toEqual(fishBefore);
    } finally {
      await reducedMotion(h, false);
    }
  }, TANK_TIME);

  it("X9 efficient: the fish go on swimming; no frames in a hidden tab; the page's memory does not grow over two minutes of bubbles and feeding", async () => {
    await openPage(h, TANK_PAGE);
    const software = await softwareRenderer(h);
    await sleep(3000);
    const f0 = await frames();
    await sleep(2000);
    // It goes on drawing, on any machine; at least 30 frames a second is the next check's.
    framesASecond = ((await frames()) - f0) / 2;
    console.log(`X9: ${framesASecond.toFixed(1)} frames a second`);
    expect(framesASecond).toBeGreaterThan(0);
    // A new tab in front: the aquarium's page, now hidden, draws nothing; back to it, and it draws again.
    await pressInShell(h, 'T', ['control']);
    // Once the page is told its tab is behind, a frame it had begun may still finish (slowly, drawn in software); then
    // nothing.
    await waitFor('the aquarium behind', () => holo<boolean>(h, 'window.__holoml.behind', TANK_PAGE), (b) => b === true, await sceneWait(h, 5000));
    await sleep(software ? 3000 : 1000);
    const hidden = await frames();
    await sleep(1500);
    expect(await frames(), 'no frames while hidden').toBe(hidden);
    await pressInShell(h, 'W', ['control']);
    await waitFor('drawing again', frames, (n) => n > hidden + 5, await sceneWait(h, 5000));
    // Two minutes of bubbles and feeding: the page's memory, after its garbage is collected, is where it was.
    const start = await pageMemory(h, TANK_PAGE);
    for (let round = 0; round < 2; round++) {
      await inPage(h, `(holoml.find('status').text = '', true)`, TANK_PAGE);
      await press(h, TANK_PAGE, 'F');
      await sleep(60_000);
    }
    const after = await pageMemory(h, TANK_PAGE);
    console.log(`X9: heap ${(start.heap / MB).toFixed(1)} MB then ${(after.heap / MB).toFixed(1)} MB; buffers ${(start.buffers / MB).toFixed(1)} MB then ${(after.buffers / MB).toFixed(1)} MB`);
    expect(after.heap + after.buffers, 'the page memory after two minutes').toBeLessThan(start.heap + start.buffers + 4 * MB);
  }, TANK_TIME);

  it('X9 at least 30 frames a second while the fish swim (with a graphics card)', async (ctx) => {
    expect(framesASecond, 'the check before this one counted the frames').not.toBeNull();
    // With a graphics card; drawn in software (GitHub's machines), the rate is measured and logged (by the
    // check before), and this check is skipped, not passed.
    const software = await softwareRenderer(h);
    if (software) {
      console.log(`X9: ${framesASecond!.toFixed(1)} frames a second; the budget not checked: drawing in software (${software})`);
      ctx.skip(`the frame-rate budget is for graphics hardware; drawing in software (${software})`);
    }
    expect(framesASecond!).toBeGreaterThanOrEqual(30);
  });
});
