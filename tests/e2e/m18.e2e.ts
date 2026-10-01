/**
 * Milestone 18 end-to-end checks. First part (owner, prompt 92): how fast
 * the viewer walks and turns (HoloML 0.2 `speed` and `turn-speed`, and
 * `holoml.viewer.speed` and `turnSpeed`), and sliders (`slider` and the
 * `change` event), with Blockworld's Speed slider. U1 (the language) is
 * the holoml repository's tests.
 *
 * Second part (prompt 98): shadows, material pictures and tiling,
 * choices that change a material in place, light from a panorama of the
 * surroundings (U9 to U12), and the sofa studio (U13 to U15). U8 (the
 * language) is the holoml repository's tests; U16 (the published site)
 * is checked by hand.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  clickAt,
  clickUntil,
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
} from './harness';

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

type Vec = [number, number, number];
const url = (page: string) => server.url(`holoml/${page}`);

function holo<T>(h: Harness, expression: string, page: string): Promise<T> {
  return inPage<T>(h, `window.__holoml ? (${expression}) : undefined`, page);
}

async function ready(h: Harness, page: string, timeoutMs = 20_000): Promise<void> {
  await waitFor(`${page} ready`, () => holo<boolean>(h, 'window.__holoml.ready', page), (r) => r === true, timeoutMs);
}

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

/**
 * Where the viewer is and which way it looks, with the scene's own time
 * at that moment: the milliseconds its frames have moved it on by, each by
 * at most 100 (the viewer's `clock`). The viewer walks and turns by that
 * time, not by the wall's clock, which runs ahead of it on a machine that
 * draws slowly.
 */
const moment = (h: Harness, page: string) => inPage<{ p: Vec; d: Vec; t: number }>(h, '({ p: holoml.viewer.position, d: holoml.viewer.direction, t: window.__holoml.clock })', page);

/** How long to wait for so much of the scene's time to pass: longer where it is drawn in software. */
const sceneTimeWait = async (h: Harness, ms: number) => (await sceneWait(h, ms)) * 2 + 10_000;

/**
 * Holds a key down in the page for a while (walking and turning need
 * keys held): for so many milliseconds of the scene's own time, so that a
 * slow machine changes nothing but the wait.
 */
async function hold(h: Harness, page: string, keyCode: string, ms: number): Promise<void> {
  const from = (await moment(h, page)).t;
  await key(h, page, keyCode, 'keyDown');
  try {
    await waitFor(`${ms} ms of the scene's time with ${keyCode} held (from ${from} ms)`, () => moment(h, page), (m) => m.t >= from + ms, await sceneTimeWait(h, ms));
  } finally {
    await key(h, page, keyCode, 'keyUp');
  }
}

/**
 * How fast the viewer goes while a key is held: metres a second across
 * the floor, and degrees a second of turning, measured between two
 * moments well inside the hold, half a second apart, by the scene's own
 * time: the first a quarter of a second after the key went down, so the
 * time a key takes to arrive does not count.
 */
async function rates(h: Harness, page: string, keyCode: string): Promise<{ walk: number; turn: number }> {
  const start = await moment(h, page);
  await key(h, page, keyCode, 'keyDown');
  try {
    const a = await waitFor(`a quarter of a second of the scene's time with ${keyCode} held`, () => moment(h, page), (m) => m.t >= start.t + 250, await sceneTimeWait(h, 250));
    const b = await waitFor(`half a second more of the scene's time with ${keyCode} held`, () => moment(h, page), (m) => m.t >= a.t + 500, await sceneTimeWait(h, 500));
    const s = (b.t - a.t) / 1000;
    return { walk: across(a.p, b.p) / s, turn: turned(a.d, b.d) / s };
  } finally {
    await key(h, page, keyCode, 'keyUp');
  }
}

type View = { position: Vec; direction: Vec; speed: number; turnSpeed: number };
const view = (h: Harness, page: string) =>
  inPage<View>(h, '({ position: holoml.viewer.position, direction: holoml.viewer.direction, speed: holoml.viewer.speed, turnSpeed: holoml.viewer.turnSpeed })', page);
const across = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const yawOf = (d: Vec) => Math.atan2(-d[0], -d[2]);
const turned = (a: Vec, b: Vec) => {
  const d = Math.abs(yawOf(a) - yawOf(b));
  return (Math.min(d, 2 * Math.PI - d) * 180) / Math.PI;
};

type Slider = { id: string | null; label: string; value: number; min: number; max: number; step: number; corner: string | null };
const sliders = (h: Harness, page: string) => holo<Slider[]>(h, 'window.__holoml.sliders()', page);

describe('U2 to U5: speeds and sliders', () => {
  let h: Harness;
  const PAGE = 'speed.holoml';
  beforeAll(async () => {
    h = await launch(url(PAGE));
    await waitForPage(h, PAGE);
    await ready(h, PAGE);
  });
  afterAll(async () => h?.close());

  it('U2 the page sets how fast the viewer walks; the default is 2.2 metres a second', async () => {
    const start = await view(h, PAGE);
    expect(start.speed).toBe(4);
    expect(start.turnSpeed).toBe(180);
    // About 4 metres a second (frames come as they come).
    const { walk } = await rates(h, PAGE, 'W');
    expect(walk).toBeGreaterThan(3.2);
    expect(walk).toBeLessThan(4.8);
    // A 0.2 page that says nothing walks at the default.
    const other = await launch(url('walls.holoml'));
    try {
      await waitForPage(other, 'walls.holoml');
      await ready(other, 'walls.holoml');
      const d = await view(other, 'walls.holoml');
      expect([d.speed, d.turnSpeed]).toEqual([2.2, 90]);
    } finally {
      await other.close();
    }
  });

  it('U3 the page sets how fast the viewer turns from the keyboard', async () => {
    const before = await view(h, PAGE);
    // About 180 degrees a second, without moving.
    const { walk, turn } = await rates(h, PAGE, 'Left');
    expect(turn).toBeGreaterThan(144);
    expect(turn).toBeLessThan(216);
    expect(walk).toBeLessThan(0.05);
    expect(across(before.position, (await view(h, PAGE)).position)).toBeLessThan(0.05);
  });

  it('U4 a script reads and sets the speeds, and a value out of range is an error', async () => {
    const errors = await inPage<string[]>(
      h,
      `(() => {
        const out = [];
        for (const [what, v] of [['speed', 0.1], ['speed', 11], ['speed', 'fast'], ['turnSpeed', 5], ['turnSpeed', 1000]]) {
          try { holoml.viewer[what] = v; out.push('no error'); } catch (e) { out.push(e.message); }
        }
        return out;
      })()`,
      PAGE,
    );
    expect(errors).toEqual([
      'viewer.speed must be a number from 0.5 to 10',
      'viewer.speed must be a number from 0.5 to 10',
      'viewer.speed must be a number from 0.5 to 10',
      'viewer.turnSpeed must be a number from 10 to 720',
      'viewer.turnSpeed must be a number from 10 to 720',
    ]);
    // Unchanged by the refused values; then set, and it walks at the new speed.
    expect((await view(h, PAGE)).speed).toBe(4);
    await inPage(h, 'holoml.viewer.speed = 8, holoml.viewer.turnSpeed = 30, true', PAGE);
    const start = await view(h, PAGE);
    expect([start.speed, start.turnSpeed]).toEqual([8, 30]);
    const { walk } = await rates(h, PAGE, 'W');
    expect(walk).toBeGreaterThan(6.4);
    expect(walk).toBeLessThan(9.6);
    const { turn } = await rates(h, PAGE, 'Left');
    expect(turn).toBeGreaterThan(24);
    expect(turn).toBeLessThan(36);
    await inPage(h, 'holoml.viewer.speed = 4, holoml.viewer.turnSpeed = 180, true', PAGE);
  });

  it('U5 a slider: in its corner with its label, moved by keyboard and mouse, heard by the script, and read by screen readers', async () => {
    const [pace, plain] = await sliders(h, PAGE);
    expect(pace).toEqual({ id: 'pace', label: 'Pace 1×', value: 1, min: 0.5, max: 2, step: 0.25, corner: 'top-left' });
    // Defaults: from 0 to 1 unless the page says, in steps of a hundredth of the range, starting at min.
    expect(plain).toEqual({ id: 'plain', label: 'Plain', value: 0, min: 0, max: 10, step: 0.1, corner: 'bottom-left' });
    const thing = await inPage<{ kind: string; value: number; min: number; max: number; step: number; text: string }>(
      h,
      "(() => { const t = holoml.find('pace'); return { kind: t.kind, value: t.value, min: t.min, max: t.max, step: t.step, text: t.text }; })()",
      PAGE,
    );
    expect(thing).toEqual({ kind: 'slider', value: 1, min: 0.5, max: 2, step: 0.25, text: 'Pace 1×' });

    // The keyboard: with the slider in focus, the right arrow moves it one step.
    await inPage(h, "document.querySelector('[data-id=\"pace\"] input').focus(), true", PAGE);
    await pressInPage(h, 'Right', [], PAGE);
    await waitFor('the change heard', () => inPage<[string, number][]>(h, 'window.__changes', PAGE), (c) => c.length > 0);
    expect(await inPage<[string, number][]>(h, 'window.__changes', PAGE)).toEqual([['pace', 1.25]]);
    const faster = await view(h, PAGE);
    expect([faster.speed, faster.turnSpeed]).toEqual([5, 225]);
    expect((await sliders(h, PAGE))[0]!.label).toBe('Pace 1.25×');
    // The slider keeps its own keys: the left arrow moves it back, and does not turn the viewer.
    await pressInPage(h, 'Left', [], PAGE);
    await waitFor('back to 1', () => inPage<number>(h, "holoml.find('pace').value", PAGE), (v) => v === 1);
    expect(turned(faster.direction, (await view(h, PAGE)).direction)).toBeLessThan(1);
    // Other keys still walk while it has the keyboard.
    const before = await view(h, PAGE);
    await hold(h, PAGE, 'W', 400);
    expect(across(before.position, (await view(h, PAGE)).position)).toBeGreaterThan(0.5);

    // The mouse: a click at the slider's right end sets it to its largest value, without a scene click.
    const end = await inPage<{ x: number; y: number }>(
      h,
      "(() => { const r = document.querySelector('[data-id=\"pace\"] input').getBoundingClientRect(); return { x: r.right - 3, y: r.top + r.height / 2 }; })()",
      PAGE,
    );
    // Clicked again if a click is lost (GitHub's Linux machines, issue #30).
    await clickUntil(h, await project(h, end.x, end.y), 'the slider at 2', async () => (await inPage<number>(h, "holoml.find('pace').value", PAGE)) === 2);
    expect((await view(h, PAGE)).speed).toBe(8);
    expect(await inPage<number>(h, 'window.__clicks', PAGE)).toBe(0);

    // A script moves it without a change event; a value out of range is an error.
    const heard = (await inPage<unknown[]>(h, 'window.__changes', PAGE)).length;
    await inPage(h, "holoml.find('pace').value = 0.5, true", PAGE);
    expect((await sliders(h, PAGE))[0]!.value).toBe(0.5);
    expect((await inPage<unknown[]>(h, 'window.__changes', PAGE)).length).toBe(heard);
    expect(await inPage<string>(h, "(() => { try { holoml.find('pace').value = 3; return 'no error'; } catch (e) { return e.message; } })()", PAGE)).toBe(
      'value must be a number from 0.5 to 2',
    );

    // Screen readers: a slider named by its label, with its value.
    const tree = await h.app.evaluate(async ({ webContents }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes('speed.holoml')).pop()!;
      guest.debugger.attach('1.3');
      try {
        const r = (await guest.debugger.sendCommand('Accessibility.getFullAXTree')) as {
          nodes: { ignored: boolean; role?: { value: string }; name?: { value: string }; value?: { value: unknown } }[];
        };
        return r.nodes.filter((n) => !n.ignored && n.role?.value === 'slider').map((n) => ({ name: n.name?.value ?? '', value: String(n.value?.value ?? '') }));
      } finally {
        guest.debugger.detach();
      }
    });
    expect(tree).toContainEqual({ name: 'Pace 2×', value: '0.5' });
    expect(tree.map((n) => n.name)).toContain('Plain');

    // The text view shows the sliders with their labels.
    await h.shell.click('hs-toolbar [data-testid="text-view"]');
    await waitFor('the text view', () => holo<boolean>(h, 'window.__holoml.textView', PAGE), (v) => v === true);
    const text = await inPage<string>(h, 'document.body.innerText', PAGE);
    expect(text).toContain('Pace 2×');
    expect(text).toContain('Plain');
    expect(await inPage<number>(h, "document.querySelectorAll('.holoml-slider input').length", PAGE)).toBe(2);
    await h.shell.click('hs-toolbar [data-testid="text-view"]');
    await waitFor('the scene again', () => holo<boolean>(h, 'window.__holoml.textView', PAGE), (v) => v === false);
  });
});

describe("U6: Blockworld's Speed slider", () => {
  let h: Harness;
  const PAGE = 'blockworld/index.holoml';
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
    await shellCall(h, 'showUrl', url(PAGE));
    await waitForPage(h, PAGE);
    await ready(h, PAGE, 30_000);
  });
  afterAll(async () => h?.close());

  it('U6 Blockworld walks at 4.3 m/s and turns at 120 degrees a second; its slider makes both faster or slower', async () => {
    const start = await view(h, PAGE);
    expect([start.speed, start.turnSpeed]).toEqual([4.3, 120]);
    const [pace] = await sliders(h, PAGE);
    expect(pace).toMatchObject({ id: 'pace', label: 'Speed 1×', value: 1, min: 0.5, max: 2, corner: 'top-left' });
    // End: the slider's largest value, from the keyboard.
    await inPage(h, "document.querySelector('[data-id=\"pace\"] input').focus(), true", PAGE);
    await pressInPage(h, 'End', [], PAGE);
    await waitFor('twice as fast', () => view(h, PAGE), (v) => v.speed === 8.6 && v.turnSpeed === 240);
    expect((await sliders(h, PAGE))[0]!.label).toBe('Speed 2×');
    // Home: the smallest.
    await pressInPage(h, 'Home', [], PAGE);
    await waitFor('half as fast', () => view(h, PAGE), (v) => v.speed === 2.15 && v.turnSpeed === 60);
    expect((await sliders(h, PAGE))[0]!.label).toBe('Speed 0.5×');
  });
});

// ---- Second part: the sofa studio's HoloML (prompt 98) ------------------------------

type Point = { x: number; y: number };
type Colour = { light: number; r: number; g: number; b: number };
type Material = { color: string; metalness: number; roughness: number; opacity: number; map: string | null; repeat: [number, number] | null };
type Choice = { id: string | null; label: string; corner: string | null; value: string; options: { value: string; label: string }[] };

/**
 * The page's own pixels as drawn: the average colour in a square around
 * each point (page pixels; `half` pixels each way), and its brightness.
 */
function pixels(h: Harness, page: string, points: Point[], half = 5): Promise<Colour[]> {
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

const models = (h: Harness, page: string) => holo<{ src: string; state: string; materials: Record<string, Material> }[]>(h, 'window.__holoml.models()', page);
const leftOut = (h: Harness, page: string) => holo<{ what: string; why: string }[]>(h, 'window.__holoml.leftOut()', page);
const choices = (h: Harness, page: string) => holo<Choice[]>(h, 'window.__holoml.choices()', page);
const point = async (h: Harness, page: string, id: string) => (await holo<Point | null>(h, `window.__holoml.point(${JSON.stringify(id)})`, page))!;
const hudText = async (h: Harness, page: string, id: string) => (await holo<{ id: string; text: string }[]>(h, 'window.__holoml.huds()', page)).find((x) => x.id === id)?.text ?? '';
const focusedText = (h: Harness, page: string) =>
  inPage<string>(h, "(() => { const e = document.activeElement; return e instanceof HTMLInputElement ? `radio:${e.closest('fieldset').dataset.id}:${e.value}` : (e?.textContent ?? ''); })()", page);

/**
 * Waits until an idle page has drawn what it loaded: a scene draws only
 * when something changes (each arrival asks for a frame), so once no
 * shaders are compiling and the frame count holds still, the last frame
 * shows everything (sceneStill).
 */
async function drawn(h: Harness, page: string): Promise<void> {
  await sceneStill(h, page, await sceneWait(h, 10_000));
}

/** Opens a page in the harness's tab and waits until it is ready. */
async function openPage(h: Harness, page: string): Promise<void> {
  await shellCall(h, 'showUrl', url(page));
  await waitForPage(h, page.split('?')[0]!, await sceneWait(h, 15_000));
  await ready(h, page.split('?')[0]!, await sceneWait(h, 20_000));
}

/** A radio button's centre on the screen: a choice's option, by value. */
async function optionPoint(h: Harness, page: string, choice: string, value: string): Promise<Point> {
  const c = await inPage<Point>(
    h,
    `(() => { const r = document.querySelector('[data-id="${choice}"] input[value="${value}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
    page,
  );
  return project(h, c.x, c.y);
}

/** The accessibility tree's groups and radio buttons, as screen readers get them. */
function radioTree(h: Harness, page: string): Promise<{ role: string; name: string; checked: boolean }[]> {
  return h.app.evaluate(async ({ webContents }, page) => {
    const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop()!;
    guest.debugger.attach('1.3');
    try {
      const r = (await guest.debugger.sendCommand('Accessibility.getFullAXTree')) as {
        nodes: { ignored: boolean; role?: { value: string }; name?: { value: string }; properties?: { name: string; value: { value: unknown } }[] }[];
      };
      return r.nodes
        .filter((n) => !n.ignored && (n.role?.value === 'radio' || n.role?.value === 'group' || n.role?.value === 'radiogroup'))
        .map((n) => ({
          role: n.role!.value,
          name: n.name?.value ?? '',
          checked: n.properties?.some((p) => p.name === 'checked' && p.value.value === 'true') ?? false,
        }));
    } finally {
      guest.debugger.detach();
    }
  }, page);
}

describe('U9 to U12: shadows, pictures, choices, and the surroundings', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
  });
  afterAll(async () => h?.close());

  it('U9 a light marked shadows casts them from the models marked shadows; drawn in software, they are left out and said so', async () => {
    const PAGE = 'shadows.holoml';
    await openPage(h, PAGE);
    const software = await softwareRenderer(h);
    const shadows = await holo<{ lights: number; models: number; leftOut: string | null }>(h, 'window.__holoml.shadows()', PAGE);
    // Drawn in software (GitHub's machines), a page's shadows are left out, and the console says so (owner, prompt 98, Q5 a).
    if (software) expect(shadows).toEqual({ lights: 0, models: 0, leftOut: expect.stringMatching(/draws 3D in software/) });
    // With a graphics card: the floor and the left block have shadows; the right block does not.
    else expect(shadows).toEqual({ lights: 1, models: 2, leftOut: null });
  });

  it('U9 the floor is darker under the model marked shadows than under the one without (with a graphics card)', async (ctx) => {
    const PAGE = 'shadows.holoml';
    const software = await softwareRenderer(h);
    if (software) {
      // There are no shadows to look at there: the check is skipped, not passed.
      console.log(`U9: shadows left out, drawing in software (${software}); the floor's pixels not checked`);
      ctx.skip(`shadows are drawn only with graphics hardware; drawing in software (${software})`);
    }
    await openPage(h, PAGE);
    const under = [await point(h, PAGE, 'under-casting'), await point(h, PAGE, 'under-plain')];
    await drawn(h, PAGE);
    const [shaded, lit] = await pixels(h, PAGE, under);
    expect(shaded!.light, `the floor under the block with shadows (${shaded!.light.toFixed(0)}) and under the one without (${lit!.light.toFixed(0)})`).toBeLessThan(
      lit!.light * 0.75,
    );
  });

  it("U10 a material's pictures load within the page's limits, show on the model, and tile as repeat says", async () => {
    const PAGE = 'textures.holoml';
    await openPage(h, PAGE);
    const all = await models(h, PAGE);
    const [striped, own] = [all[0]!.materials['stone']!, all[1]!.materials['stone']!];
    expect(striped.map).toBe(server.url('holoml/gen/stripes.png'));
    expect(striped.repeat).toEqual([3, 1]);
    // Tiling alone tiles the model's own picture.
    expect(own).toMatchObject({ map: 'own', repeat: [2, 2] });
    // On the page: the picture's red and blue, in narrow stripes (3 times 2 pairs across the face).
    const c = await point(h, PAGE, 'striped');
    await drawn(h, PAGE);
    const line = await pixels(
      h,
      PAGE,
      Array.from({ length: 81 }, (_, i) => ({ x: c.x - 40 + i, y: c.y })),
      0,
    );
    const red = (p: Colour) => p.r > p.b + 60;
    const blue = (p: Colour) => p.b > p.r + 60;
    expect(line.filter(red).length).toBeGreaterThan(10);
    expect(line.filter(blue).length).toBeGreaterThan(10);
    // Stripes crossed along the line (the blend at an edge is neither colour, and is passed over).
    let changes = 0;
    let was: 'red' | 'blue' | null = null;
    for (const p of line) {
      const now = red(p) ? 'red' : blue(p) ? 'blue' : null;
      if (now && was && now !== was) changes++;
      if (now) was = now;
    }
    expect(changes, 'stripes crossed in 80 pixels').toBeGreaterThanOrEqual(3);
    // Pictures that are not shown: from another site (never asked for), and too large; the models keep their own.
    const why = await leftOut(h, PAGE);
    expect(why).toContainEqual({ what: 'https://pictures.example/weave.png', why: "pictures load only from the page's own site" });
    expect(why).toContainEqual({ what: 'gen/claim.png?w=8192&h=8192', why: 'a picture of 8192 by 8192 pixels is larger than 4096 by 4096' });
    expect(all[2]!.materials['stone']!.map).toBe('own');
    expect(all[3]!.state).toBe('loaded');
    // Pictures count against the page's limits: the stripes' bytes are in the page's total; the refused picture's are not.
    const stripes = (await (await fetch(server.url('holoml/gen/stripes.png'))).arrayBuffer()).byteLength;
    const scene = await holo<{ models: { bytes?: number }[]; totals: { bytes: number } }>(h, 'window.__holoml.scene()', PAGE);
    expect(scene.totals.bytes).toBe(scene.models[0]!.bytes! + stripes);
  });

  it('U11 a choice: in its corner with its label; mouse, keyboard, and screen readers pick an option; the material changes in place; the script hears it', async () => {
    const PAGE = 'choice.holoml';
    await openPage(h, PAGE);
    const [finish, size] = await choices(h, PAGE);
    expect(finish).toEqual({
      id: 'finish',
      label: 'Finish',
      corner: 'bottom-left',
      value: 'blue',
      options: [
        { value: 'stone', label: 'Stone' },
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
        { value: 'striped', label: 'Striped' },
      ],
    });
    // Options without values take their labels.
    expect(size).toMatchObject({ id: 'size', label: 'Size', corner: 'top-right', value: 'Small', options: [{ value: 'Small' }, { value: 'Large' }] });
    // The option chosen at the start is on the model.
    const block = async () => (await models(h, PAGE))[0]!.materials['stone']!;
    await waitFor('blue on the block', block, (m) => m.color === '#3050ff');
    await inPage(h, 'window.__stay = true', PAGE);

    // The mouse: Red; the page stays (no new page), the script hears it, and the rest of the look is the material's own.
    await clickUntil(h, await optionPoint(h, PAGE, 'finish', 'red'), 'red on the block', async () => (await block()).color === '#ff3030');
    expect(await block()).toMatchObject({ roughness: 0.2, map: 'own' });
    expect(await hudText(h, PAGE, 'heard')).toBe('finish: red');
    expect(await inPage<boolean>(h, 'window.__stay === true', PAGE)).toBe(true);

    // The keyboard: the arrow keys move to the next option, as in any group of radio buttons.
    await pressInPage(h, 'Right', [], PAGE);
    await waitFor('blue again', block, (m) => m.color === '#3050ff');
    expect(await hudText(h, PAGE, 'heard')).toBe('finish: blue');
    // Each option starts from the material's own look: Blue gives no roughness, so the model's own is back.
    expect((await block()).roughness).not.toBe(0.2);
    await pressInPage(h, 'Right', [], PAGE);
    await waitFor('the striped picture', block, (m) => m.map === server.url('holoml/gen/stripes.png'));
    expect((await block()).repeat).toEqual([2, 2]);
    expect(await hudText(h, PAGE, 'heard')).toBe('finish: striped');

    // Scripts read and set the chosen option (without a change event); a value no option has is an error.
    const thing = await inPage<{ kind: string; value: string; options: string[]; text: string }>(
      h,
      "(() => { const t = holoml.find('finish'); return { kind: t.kind, value: t.value, options: t.options, text: t.text }; })()",
      PAGE,
    );
    expect(thing).toEqual({ kind: 'choice', value: 'striped', options: ['stone', 'red', 'blue', 'striped'], text: 'Finish' });
    await inPage(h, "holoml.find('finish').value = 'stone', true", PAGE);
    await waitFor('the stone again', block, (m) => m.color === '#ffffff' && m.map === 'own');
    expect((await choices(h, PAGE))[0]!.value).toBe('stone');
    expect(await hudText(h, PAGE, 'heard')).toBe('finish: striped');
    expect(await inPage<string>(h, "(() => { try { holoml.find('finish').value = 'gold'; return 'no error'; } catch (e) { return e.message; } })()", PAGE)).toBe(
      'value must be one of the choice\'s options: "stone", "red", "blue", "striped"',
    );
    // A choice for scripts alone changes nothing in the scene, and is heard.
    await clickUntil(h, await optionPoint(h, PAGE, 'size', 'Large'), 'Large heard', async () => (await hudText(h, PAGE, 'heard')) === 'size: Large');

    // Screen readers: each choice a group named by its label, its options radio buttons, the chosen one checked.
    const tree = await radioTree(h, PAGE);
    expect(tree.some((n) => n.role !== 'radio' && n.name === 'Finish')).toBe(true);
    expect(tree.filter((n) => n.role === 'radio').map((n) => n.name)).toEqual(['Stone', 'Red', 'Blue', 'Striped', 'Small', 'Large']);
    expect(tree.find((n) => n.name === 'Stone')!.checked).toBe(true);

    // The text view shows the choices.
    await pressInPage(h, 'V', ['control', 'shift'], PAGE);
    await waitFor('the text view', () => holo<boolean>(h, 'window.__holoml.textView', PAGE), (v) => v === true);
    const text = await inPage<string>(h, 'document.body.innerText', PAGE);
    for (const words of ['Finish', 'Stone', 'Striped', 'Size', 'Large']) expect(text).toContain(words);
    await pressInPage(h, 'V', ['control', 'shift'], PAGE);
    await waitFor('the scene again', () => holo<boolean>(h, 'window.__holoml.textView', PAGE), (v) => v === false);
  });

  it("U12 the page's panorama lights the scene (a mirror-like block takes its colour), and counts against the limits", async () => {
    const PAGE = 'environment.holoml';
    await openPage(h, PAGE);
    expect(await holo<{ state: string; intensity: number }>(h, 'window.__holoml.environment()', PAGE)).toMatchObject({ state: 'loaded', intensity: 1 });
    await drawn(h, PAGE);
    const [mirror] = await pixels(h, PAGE, [await point(h, PAGE, 'mirror')], 20);
    // The panorama is green: so is the block's reflection.
    expect(mirror!.g, `the block's colour: ${mirror!.r.toFixed(0)}, ${mirror!.g.toFixed(0)}, ${mirror!.b.toFixed(0)}`).toBeGreaterThan(mirror!.r + 40);
    expect(mirror!.g).toBeGreaterThan(mirror!.b + 40);
    const hdr = (await (await fetch(server.url('holoml/gen/panorama.hdr'))).arrayBuffer()).byteLength;
    const scene = await holo<{ models: { bytes?: number }[]; totals: { bytes: number } }>(h, 'window.__holoml.scene()', PAGE);
    expect(scene.totals.bytes).toBe(scene.models[0]!.bytes! + hdr);

    // Over the picture limit: left out and said so; the renderer's own soft light instead.
    const LARGE = 'environment-large.holoml';
    await openPage(h, LARGE);
    expect(await holo<{ state: string; intensity: number }>(h, 'window.__holoml.environment()', LARGE)).toMatchObject({ state: 'left-out', intensity: 0.45 });
    expect(await leftOut(h, LARGE)).toContainEqual({ what: 'gen/claim.png?w=8192&h=4096', why: 'a picture of 8192 by 4096 pixels is larger than 4096 by 4096' });
    expect((await models(h, LARGE))[0]!.state).toBe('loaded');
  });
});

describe('U13 to U15: the sofa studio', () => {
  let h: Harness;
  const PAGE = 'sofa-studio/index.holoml';
  const STUDIO = 'sofa-studio/index';
  let loadMs = 0;
  /** The studio's shadows as it was first drawn: read by the first check, and held to what a graphics card draws by the one after it. */
  let shadowsAtFirst: { lights: number; models: number } | null = null;
  const sofa = async () => (await models(h, STUDIO)).find((m) => m.src === 'models/sofa.gltf')!.materials;
  const price = () => hudText(h, STUDIO, 'price');
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
    const t = Date.now();
    await shellCall(h, 'showUrl', url(PAGE));
    await waitForPage(h, STUDIO, await sceneWait(h, 15_000));
    await ready(h, STUDIO, 60_000);
    loadMs = Date.now() - t;
  });
  afterAll(async () => h?.close());

  it('U13 ready with everything loaded; each fabric and wood changes the sofa, the price follows, and the cart page lists the choices', async () => {
    expect(await holo<unknown[]>(h, 'window.__holoml.problems', STUDIO)).toEqual([]);
    expect(await leftOut(h, STUDIO)).toEqual([]);
    const all = await models(h, STUDIO);
    expect(all.length).toBe(8);
    expect(all.every((m) => m.state === 'loaded')).toBe(true);
    expect(await holo<{ state: string }>(h, 'window.__holoml.environment()', STUDIO)).toMatchObject({ state: 'loaded' });
    // What casts shadows, and how soon the studio was ready, are the next check's: both are for a graphics card.
    shadowsAtFirst = await holo<{ lights: number; models: number }>(h, 'window.__holoml.shadows()', STUDIO);

    // The sofa as it comes: its own fabric and walnut frame.
    expect((await sofa())['Fabric']!.map).toBe('own');
    expect(await price()).toBe('Linden two-seat sofa\nStone weave · Walnut\n$1,290');
    const pick = (choice: string, value: string) => inPage(h, `document.querySelector('[data-id="${choice}"] input[value="${value}"]').click(), true`, STUDIO);
    const FABRICS: [string, string, string][] = [
      ['linen', 'Blue linen', '$1,380'],
      ['velvet', 'Red velvet', '$1,530'],
      ['check', 'Wool check', '$1,600'],
      ['leather', 'Brown leather', '$1,850'],
    ];
    for (const [value, name, total] of FABRICS) {
      await pick('fabric', value);
      const picture = value === 'check' ? 'boucle' : value;
      await waitFor(`${name} on the sofa`, sofa, (m) => m['Fabric']!.map === url(`sofa-studio/textures/${picture}-color.jpg`));
      expect(await price()).toBe(`Linden two-seat sofa\n${name} · Walnut\n${total}`);
    }
    // The wood changes the frame alone.
    await pick('wood', 'ebony');
    await waitFor('ebony on the frame', sofa, (m) => m['Wood']!.map === url('sofa-studio/textures/sofa-wood-ebony.jpg'));
    expect((await sofa())['Fabric']!.map).toBe(url('sofa-studio/textures/leather-color.jpg'));
    expect(await price()).toBe('Linden two-seat sofa\nBrown leather · Ebony\n$1,970');
    await pick('fabric', 'velvet');
    await waitFor('velvet', price, (p) => p.endsWith('$1,650'));

    // "Add to cart", a link in the scene (the page's first): the cart page lists the choices.
    const link = (await holo<Point | null>(h, 'window.__holoml.point(0)', STUDIO))!;
    await clickUntil(h, await project(h, link.x, link.y), 'the cart page', async () => (await focusedTab(h)).url.endsWith('/sofa-studio/cart.html'));
    await waitForPage(h, 'cart.html');
    const cart = await waitFor('the cart', () => inPage<string>(h, 'document.body.innerText', 'cart.html'), (t) => t.includes('$1,650'));
    for (const words of ['Linden two-seat sofa', 'Red velvet', 'Ebony', '$1,650', 'there is no shop behind it']) expect(cart).toContain(words);
    // Back in the studio, the choices are as they were.
    await pressInShell(h, 'Left', ['alt']);
    await waitFor('back', async () => (await focusedTab(h)).url, (u) => u === url(PAGE));
    await ready(h, STUDIO, await sceneWait(h, 20_000));
    expect((await choices(h, STUDIO)).map((c) => c.value)).toEqual(['velvet', 'ebony', 'day']);
    await waitFor('velvet again', sofa, (m) => m['Fabric']!.map === url('sofa-studio/textures/velvet-color.jpg'));
    expect(await price()).toBe('Linden two-seat sofa\nRed velvet · Ebony\n$1,650');
  });

  it('U13 the studio is ready within 5 s, and its two lights cast shadows from its eight models (with a graphics card)', async (ctx) => {
    expect(shadowsAtFirst, 'the check before this one read the shadows').not.toBeNull();
    // Within 5 s with a graphics card, where shadows are drawn; in software (GitHub's machines) the time is
    // measured and logged, shadows are left out, and the check is skipped, not passed (owner, prompts 59, 95, and 98 Q5 a).
    const software = await softwareRenderer(h);
    if (software) {
      console.log(`U13: ready in ${loadMs} ms; the 5-second budget and the shadows not checked: drawing in software (${software})`);
      ctx.skip(`the 5-second budget and shadows are for graphics hardware; drawing in software (${software})`);
    }
    console.log(`U13: ready in ${loadMs} ms`);
    expect(loadMs).toBeLessThan(5000);
    expect(shadowsAtFirst).toMatchObject({ lights: 2, models: 8 });
  });

  it('U14 the whole page from the keyboard; screen readers name the choices; the text view shows them', async () => {
    // Into the page, on the floor in front of the sofa (nothing to follow there).
    const size = await inPage<{ w: number; h: number }>(h, '({ w: innerWidth, h: innerHeight })', STUDIO);
    await clickAt(h, await project(h, size.w * 0.8, size.h * 0.85));
    const stops: string[] = [];
    for (let i = 0; i < 20 && !stops.at(-1)?.startsWith('radio:fabric'); i++) {
      await pressInPage(h, 'Tab', [], STUDIO);
      await sleep(100);
      stops.push(await focusedText(h, STUDIO));
    }
    // The scene's links and models first, in page order, then the choices.
    expect(stops).toContain('Add to cart');
    expect(stops).toContain('About this studio');
    expect(stops.at(-1)).toBe('radio:fabric:velvet');
    // The arrow keys pick the next fabric, and the script shows its price.
    await pressInPage(h, 'Right', [], STUDIO);
    await waitFor('bouclé check', price, (p) => p === 'Linden two-seat sofa\nWool check · Ebony\n$1,720');
    // Tab to the wood, then to the light.
    await pressInPage(h, 'Tab', [], STUDIO);
    await waitFor('the wood', () => focusedText(h, STUDIO), (t) => t === 'radio:wood:ebony');
    await pressInPage(h, 'Left', [], STUDIO);
    await waitFor('oak', price, (p) => p === 'Linden two-seat sofa\nWool check · Oak\n$1,660');
    await pressInPage(h, 'Tab', [], STUDIO);
    await waitFor('the light', () => focusedText(h, STUDIO), (t) => t === 'radio:time:day');
    await pressInPage(h, 'Right', [], STUDIO);
    // Evening: the lamp comes on, and the fill dims.
    await waitFor('evening', () => inPage<number>(h, "holoml.find('lamp-light').intensity", STUDIO), (v) => v > 0);
    expect(await inPage<number>(h, "holoml.find('fill').intensity", STUDIO)).toBeLessThan(0.1);

    // Screen readers: each choice named, its options radio buttons, the chosen ones checked.
    const tree = await radioTree(h, STUDIO);
    for (const name of ['Fabric', 'Wood', 'Light']) expect(tree.some((n) => n.role !== 'radio' && n.name === name), name).toBe(true);
    expect(tree.filter((n) => n.role === 'radio' && n.checked).map((n) => n.name)).toEqual(['Wool check', 'Oak', 'Evening']);

    // The text view: the price and the choices.
    await pressInPage(h, 'V', ['control', 'shift'], STUDIO);
    await waitFor('the text view', () => holo<boolean>(h, 'window.__holoml.textView', STUDIO), (v) => v === true);
    const text = await inPage<string>(h, 'document.body.innerText', STUDIO);
    for (const words of ['Linden two-seat sofa', '$1,660', 'Fabric', 'Brown leather', 'Wood', 'Ebony', 'Light', 'Evening', 'Add to cart']) expect(text).toContain(words);
    await pressInPage(h, 'V', ['control', 'shift'], STUDIO);
    await waitFor('3D again', () => holo<boolean>(h, 'window.__holoml.textView', STUDIO), (v) => v === false);

    // Back to the link with Shift+Tab, and Enter follows it.
    for (let i = 0; i < 20 && (await focusedText(h, STUDIO)) !== 'Add to cart'; i++) await pressInPage(h, 'Tab', ['shift'], STUDIO);
    expect(await focusedText(h, STUDIO)).toBe('Add to cart');
    await pressInPage(h, 'Enter', [], STUDIO);
    await waitFor('the cart page', async () => (await focusedTab(h)).url, (u) => u.endsWith('/sofa-studio/cart.html'));
    await waitForPage(h, 'cart.html');
    const cart = await waitFor('the cart', () => inPage<string>(h, 'document.body.innerText', 'cart.html'), (t) => t.includes('$1,660'));
    expect(cart).toContain('Wool check');
    await pressInShell(h, 'Left', ['alt']);
    await waitFor('back', async () => (await focusedTab(h)).url, (u) => u === url(PAGE));
    await ready(h, STUDIO, await sceneWait(h, 20_000));
  });

  it('U15 an idle sofa studio draws no frames, with reduced motion too', async () => {
    // Once the choices the checks before made have been drawn.
    await drawn(h, STUDIO);
    await sleep(1000);
    const f0 = await holo<number>(h, 'window.__holoml.frames', STUDIO);
    await sleep(2000);
    expect(await holo<number>(h, 'window.__holoml.frames', STUDIO)).toBe(f0);
    // Nothing on the page moves by itself, so reduced motion changes nothing: still no frames.
    await h.app.evaluate(async ({ webContents }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview').pop()!;
      guest.debugger.attach('1.3');
      await guest.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    });
    try {
      await drawn(h, STUDIO);
      await sleep(1000);
      const f1 = await holo<number>(h, 'window.__holoml.frames', STUDIO);
      await sleep(2000);
      expect(await holo<number>(h, 'window.__holoml.frames', STUDIO)).toBe(f1);
    } finally {
      await h.app.evaluate(({ webContents }) => {
        for (const w of webContents.getAllWebContents()) if (w.getType() === 'webview' && w.debugger.isAttached()) w.debugger.detach();
      });
    }
  });
});
