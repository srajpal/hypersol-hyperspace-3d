/**
 * Milestone 21 end-to-end checks (TODO.md): HoloML 0.2's fifth part and
 * the aquarium. X2 to X4: water, sounds from a place, and a model's
 * animation speed. X1 (the language) is the holoml repository's tests;
 * X10 (the published site) is checked by hand.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import { clickAt, inPage, launch, project, sceneWait, shellCall, sleep, softwareRenderer, waitFor, waitForPage, type Harness, type Point } from './harness';

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

/** Opens a page in the harness's tab and waits until it is ready. */
async function openPage(h: Harness, page: string): Promise<void> {
  await shellCall(h, 'showUrl', url(page));
  await waitForPage(h, page, await sceneWait(h, 15_000));
  await ready(h, page, await sceneWait(h, 20_000));
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

  it('X2 through the water a far model takes more of its colour than a near one, and one outside keeps its own; the light moves over a floor in the water, and holds still with reduced motion', async () => {
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
    if (software) {
      // Drawn in software (GitHub's machines), the moving light is left out, as shadows are, and the console says so.
      expect(await water(h, PAGE)).toMatchObject({ caustics: true, causticsShown: false, causticsLeftOut: expect.stringMatching(/draws 3D in software/) });
      console.log(`X2: the water's moving light left out, drawing in software (${software}); its pixels not checked`);
      return;
    }
    expect(await water(h, PAGE)).toMatchObject({ caustics: true, causticsShown: true, causticsLeftOut: null });
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
