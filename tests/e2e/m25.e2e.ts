/**
 * Milestone 25 end-to-end checks (TODO.md): HoloML 0.3 in HyperSpace 3D.
 * HL2 names, HL3 language and direction, HL4 compressed models, HL5 far
 * models, HL6 the scene API, HL7 a page's description, and HL9 the
 * example sites. HL1 (the language) is the holoml repository's tests;
 * HL8 (older pages) is every earlier milestone's checks; HL10 is the full
 * run, the Android app, and the published site.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import { inPage, launch, newProfile, sceneWait, settled, shellCall, sleep, softwareRenderer, tabs, waitFor, waitForPage, type Harness, type Point } from './harness';

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

type Vec = [number, number, number];
type Colour = { r: number; g: number; b: number };
type ModelReport = { src: string; state: string; standsInFor?: string; farFor?: string };
type FarInfo = { id: string | null; src: string; state: string; far: { src: string; state: string; reason: string | null; shown: boolean }; from: number; isFar: boolean; distance: number };
type StandIn = { id: string | null; state: string; standIn: { state: string; shown: boolean } | null };

const url = (page: string) => server.url(`holoml/${page}`);

function holo<T>(h: Harness, expression: string, page: string): Promise<T> {
  return inPage<T>(h, `window.__holoml ? (${expression}) : undefined`, page);
}

/** Opens a page in the harness's tab and waits until it is ready and drawn. */
async function openPage(h: Harness, page: string): Promise<void> {
  await shellCall(h, 'showUrl', url(page));
  await waitForPage(h, page, await sceneWait(h, 15_000));
  await waitFor(`${page} ready`, () => holo<boolean>(h, 'window.__holoml.ready', page), (r) => r === true, await sceneWait(h, 20_000));
  await waitFor(`${page} drawn`, () => holo<boolean>(h, 'window.__holoml.frames > 0 && !window.__holoml.compiling', page), (v) => v === true, await sceneWait(h, 20_000));
}

/** Moves the viewer through the page's scene API. */
const moveTo = (h: Harness, page: string, eye: Vec) => inPage<void>(h, `void (holoml.viewer.position = ${JSON.stringify(eye)})`, page);

/** The page's own pixels as drawn: the average colour in a small square around each point (page pixels). */
function pixels(h: Harness, page: string, points: Point[], half = 3): Promise<Colour[]> {
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
        return { r: r / n, g: g / n, b: b / n };
      });
    },
    { page, points, half },
  );
}

/** Keeps what the pages print to their consoles, from now on (in the main process). */
async function keepConsole(h: Harness): Promise<void> {
  await h.app.evaluate(({ webContents, app }) => {
    const g = globalThis as unknown as { __pageConsole?: string[] };
    g.__pageConsole = [];
    const hook = (w: Electron.WebContents) => {
      if (w.getType() === 'webview') w.on('console-message', (e) => g.__pageConsole!.push(e.message));
    };
    webContents.getAllWebContents().forEach(hook);
    app.on('web-contents-created', (_e, w) => hook(w));
  });
}
const consoleText = (h: Harness) => h.app.evaluate(() => ((globalThis as unknown as { __pageConsole?: string[] }).__pageConsole ?? []).join('\n'));

const BACKGROUND = { r: 0x1c, g: 0x20, b: 0x30 };
const away = (c: Colour, from: Colour) => Math.hypot(c.r - from.r, c.g - from.g, c.b - from.b);

describe('HL2, HL3, HL7: names, language and direction, and a page\'s description', () => {
  let h: Harness;
  const PAGE = 'm25-names.holoml';
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ layersOnOpen: false }) });
    await waitForPage(h, 'link-a.html');
    await openPage(h, PAGE);
  });
  afterAll(async () => h?.close());

  it("HL2 a model's and a group's label is what the outline lists and screen readers hear; without one, the id, then the file's name; a group is listed by its name alone; a link is named by them", async () => {
    const outline = await holo<string[]>(h, 'window.__holoml.outline()', PAGE);
    expect(outline).toContain('button:Group: Two cars');
    expect(outline).toContain('button:Model: מכונית כחולה');
    expect(outline).toContain('button:Model: plain');
    // A link is named by the models and groups in it (0.3), as by its labels and panels.
    expect(await inPage<string[]>(h, "[...document.querySelectorAll('#holoml-outline a')].map((a) => a.textContent)", PAGE)).toEqual(['A yellow car']);
    // The red car is a trigger: its button says its click action's label, as before 0.3, in the action's language.
    expect(outline).toContain('button:أدر السيارة');
    // A script reads and changes a name.
    expect(await inPage<string>(h, `holoml.find('plain').label === null ? 'none' : 'some'`, PAGE)).toBe('none');
    await inPage(h, `void (holoml.find('plain').label = 'A grey car')`, PAGE);
    expect(await holo<string[]>(h, 'window.__holoml.outline()', PAGE)).toContain('button:Model: A grey car');
  });

  it('HL3 the page and each text carry their language and direction for screen readers; right-to-left labels and panels are drawn so, auto by the first letter', async () => {
    expect(await inPage<string>(h, 'document.documentElement.lang', PAGE)).toBe('en');
    // The outline: the kind in the browser's words, the name in the page's language and direction.
    const named = await inPage<{ text: string; lang: string; dir: string }[]>(
      h,
      `[...document.querySelectorAll('#holoml-outline button span')].map((s) => ({ text: s.textContent, lang: s.lang, dir: s.dir }))`,
      PAGE,
    );
    expect(named).toContainEqual({ text: 'מכונית כחולה', lang: 'he', dir: 'rtl' });
    expect(named).toContainEqual({ text: 'Two cars', lang: 'en', dir: 'ltr' });
    // Places: "Go to:" and the place's name in its language.
    expect(named).toContainEqual({ text: 'الحديقة', lang: 'ar', dir: 'rtl' });
    // The action's button.
    expect(await inPage(h, `(() => { const b = [...document.querySelectorAll('#holoml-outline button')].find((x) => x.textContent === 'أدر السيارة'); return b && [b.lang, b.dir]; })()`, PAGE)).toEqual(['ar', 'rtl']);
    // The labels' words in the page, and how they are drawn.
    const notes = await inPage<{ text: string; lang: string; dir: string }[]>(h, `[...document.querySelectorAll('#holoml-labels p')].map((p) => ({ text: p.textContent, lang: p.lang, dir: p.dir }))`, PAGE);
    expect(notes).toContainEqual({ text: 'أهلاً وسهلاً بكم', lang: 'ar', dir: 'rtl' });
    expect(notes).toContainEqual({ text: 'Welcome', lang: 'en', dir: 'ltr' });
    expect(notes).toContainEqual({ text: 'שלום עולם', lang: 'en', dir: 'auto' });
    const drawn = await holo<{ text: string; dir: string }[]>(h, 'window.__holoml.labelDirections()', PAGE);
    expect(drawn).toEqual(
      expect.arrayContaining([
        { text: 'Welcome', dir: 'ltr' },
        { text: 'أهلاً وسهلاً بكم', dir: 'rtl' },
        // dir="auto": its first letter is Hebrew.
        { text: 'שלום עולם', dir: 'rtl' },
      ]),
    );
    // The panel's paragraphs, and the screen's text.
    expect(await inPage(h, `[...document.querySelectorAll('#holoml-labels div p')].map((p) => [p.textContent, p.lang, p.dir])`, PAGE)).toEqual([
      ['ברוכים הבאים לגלריה.', 'he', 'rtl'],
      ['פסקה שנייה.', 'he', 'rtl'],
    ]);
    expect(await inPage(h, `(() => { const s = document.querySelector('[data-testid="holoml-hud"]'); return [s.lang, s.dir, s.textContent.trim()]; })()`, PAGE)).toEqual(['ar', 'rtl', 'مرحبا']);
  });

  it("HL7 a page's description: under its title in the outline and the text view, and in its tab's tooltip, in the list and on its card", async () => {
    const DESCRIPTION = 'Names for models and groups, and text in English, Arabic, and Hebrew.';
    expect(await inPage<string>(h, `document.querySelector('[data-testid="holoml-description"]')?.textContent ?? ''`, PAGE)).toBe(DESCRIPTION);
    const tab = (await shellCall(h, 'tabs')).find((t: { focused: boolean }) => t.focused) as { id: number; title: string };
    await waitFor('the card has the description', () => shellCall(h, 'cardTooltip', tab.id), (t) => t === `HoloML 0.3: names and languages\n${DESCRIPTION}`);
    // Over the card, the room's tooltip says it. A HoloML page fills the window, so another tab is in front first.
    await h.shell.click('hs-toolbar [data-testid="new-tab"]');
    await waitFor('a second tab in front', () => tabs(h), (list) => list.length === 2 && !list.find((t) => t.id === tab.id)!.focused);
    await settled(h);
    const p = await shellCall(h, 'cardPoint', tab.id, 'body');
    expect(p, 'the card shows').not.toBeNull();
    await h.shell.mouse.move(p!.x, p!.y, { steps: 3 });
    await waitFor('the room tooltip', () => shellCall(h, 'roomTooltip'), (t) => t === `HoloML 0.3: names and languages\n${DESCRIPTION}`);
    await h.shell.mouse.move(2, 2);
    await waitFor('no tooltip off the cards', () => shellCall(h, 'roomTooltip'), (t) => t === '');
    // A page without a description has none: its card's tooltip is its title alone.
    await openPage(h, 'm25-far.holoml');
    const far = (await shellCall(h, 'tabs')).find((t: { focused: boolean }) => t.focused) as { id: number };
    await waitFor('no description', () => shellCall(h, 'cardTooltip', far.id), (t) => t === 'HoloML 0.3: far models');
  });
});

describe('HL4: compressed models', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ layersOnOpen: false }) });
    await waitForPage(h, 'link-a.html');
    await keepConsole(h);
  });
  afterAll(async () => h?.close());

  it('HL4 a Draco, a meshopt, and a KTX2 model load and draw, with the decoders from the browser itself; their triangles count as drawn', async () => {
    const PAGE = 'compressed/index.holoml';
    await openPage(h, PAGE);
    const models = await holo<ModelReport[]>(h, 'window.__holoml.models()', PAGE);
    for (const src of ['draco-box.gltf', 'meshopt-box.glb', 'ktx2-box.gltf']) expect(models.find((m) => m.src === src), src).toMatchObject({ state: 'loaded' });
    // Each box is 12 triangles, counted once decoded.
    expect((await holo<{ triangles: number }>(h, 'window.__holoml.totals()', PAGE)).triangles).toBe(36);
    // Drawn: each box's middle is not the background.
    await sleep(300);
    const at = await Promise.all(['draco', 'meshopt', 'ktx2'].map((id) => holo<Point>(h, `window.__holoml.point(${JSON.stringify(id)})`, PAGE)));
    const colours = await pixels(h, PAGE, at);
    colours.forEach((c, i) => expect(away(c, BACKGROUND), `box ${i}: ${JSON.stringify(c)}`).toBeGreaterThan(25));
    // Nothing of the decoders was asked of the page's site: they came with the browser.
    expect([...server.hits.keys()].filter((p) => /draco_|basis_|meshopt/.test(p) && !p.includes('-box'))).toEqual([]);
    expect(await consoleText(h)).not.toMatch(/Content Security Policy|Refused to/);
  });

  it('HL4 a compressed model that cannot be decoded is left out with a notice, and the rest shows', async () => {
    const PAGE = 'compressed/broken.holoml';
    await openPage(h, PAGE);
    const models = await holo<ModelReport[]>(h, 'window.__holoml.models()', PAGE);
    expect(models.find((m) => m.src === 'draco-box.gltf')).toMatchObject({ state: 'loaded' });
    expect(models.find((m) => m.src === 'broken-draco.gltf')?.state).toMatch(/^(left-out|failed)$/);
    expect(await inPage<string>(h, `document.querySelector('[data-testid="holoml-notice"]').textContent`, PAGE)).toContain('broken-draco.gltf');
  });
});

describe('HL5: far models', () => {
  let h: Harness;
  const PAGE = 'm25-far.holoml';
  const far = () => holo<FarInfo[]>(h, 'window.__holoml.far()', PAGE);
  const one = async (id: string) => (await far()).find((f) => f.id === id)!;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ layersOnOpen: false }) });
    await waitForPage(h, 'link-a.html');
    await keepConsole(h);
    await openPage(h, PAGE);
  });
  afterAll(async () => h?.close());

  it('HL5 from far away the lighter version is drawn and the model itself is not loaded; near, the model, and the far one hides; and back', async () => {
    expect(await one('car')).toMatchObject({ isFar: true, state: 'waiting', far: { state: 'loaded', shown: true } });
    await moveTo(h, PAGE, [0, 1.6, 6]);
    await waitFor('the car itself', () => one('car'), (f) => f.state === 'loaded' && !f.far.shown && !f.isFar);
    await moveTo(h, PAGE, [0, 1.6, 40]);
    await waitFor('the far car again', () => one('car'), (f) => f.isFar && f.far.shown && f.state === 'waiting');
  });

  it('HL5 at the line it does not flicker: a little past it, the model stays; a little more, it swaps', async () => {
    await moveTo(h, PAGE, [0, 1.6, 6]);
    await waitFor('near', () => one('car'), (f) => f.state === 'loaded' && !f.isFar);
    // 20.5 m: past 20, within the margin.
    await moveTo(h, PAGE, [0, 1.6, 20.45]);
    await sleep(500);
    expect(await one('car')).toMatchObject({ isFar: false, state: 'loaded' });
    // 21.5 m: past the margin.
    await moveTo(h, PAGE, [0, 1.6, 21.5]);
    await waitFor('far', () => one('car'), (f) => f.isFar && f.far.shown);
  });

  it('HL5 a far version that cannot be loaded leaves the model to show at every distance, and says why', async () => {
    const f = await one('no-far');
    expect(f.far.state).toMatch(/^(failed|left-out)$/);
    expect(f.state).toBe('loaded');
    expect(await consoleText(h)).toContain('missing-far.gltf');
  });

  it('HL5 with loading by area: the stand-in until the group comes near; then the far version or the model by the distance', async () => {
    const stand = async () => (await holo<StandIn[]>(h, 'window.__holoml.standIns()', PAGE)).find((s) => s.id === 'area-car')!;
    expect((await stand()).standIn).toMatchObject({ shown: true });
    expect(await one('area-car')).toMatchObject({ state: 'waiting', far: { shown: false } });
    // 8 m from the group: within its 12, past the car's 6.
    await moveTo(h, PAGE, [-30, 1.6, 8]);
    await waitFor('the far version', () => one('area-car'), (f) => f.far.shown);
    expect((await stand()).standIn).toMatchObject({ shown: false });
    // 2 m: the car itself.
    await moveTo(h, PAGE, [-30, 1.6, 2]);
    await waitFor('the car itself', () => one('area-car'), (f) => f.state === 'loaded' && !f.far.shown);
    // Away from the group: let go, and the stand-in again.
    await moveTo(h, PAGE, [0, 1.6, 40]);
    await waitFor('let go', () => one('area-car'), (f) => f.state === 'waiting' && !f.far.shown);
    expect((await stand()).standIn).toMatchObject({ shown: true });
  });
});

describe('HL6: the scene API of HoloML 0.3', () => {
  let h: Harness;
  const PAGE = 'm25-api.holoml';
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ layersOnOpen: false }) });
    await waitForPage(h, 'link-a.html');
    await keepConsole(h);
    await openPage(h, PAGE);
  });
  afterAll(async () => h?.close());

  it('HL6 an animate starts and stops; the water changes; the plan hides; a model and a group are named', async () => {
    const out = await inPage<Record<string, unknown>>(
      h,
      `(async () => {
        'use strict';
        const out = {};
        const spin = holoml.find('spin');
        out.kind = spin.kind;
        out.runningAtFirst = spin.running;
        spin.stop();
        out.stopped = spin.running;
        // Where it stopped, once a frame has put it there; then it stays.
        await new Promise((r) => setTimeout(r, 150));
        const held = holoml.find('car').rotation;
        await new Promise((r) => setTimeout(r, 300));
        out.held = JSON.stringify(holoml.find('car').rotation) === JSON.stringify(held);
        spin.start();
        out.started = spin.running;
        const pool = holoml.find('pool');
        pool.color = '#336699';
        pool.clarity = 4;
        out.water = [pool.color, pool.clarity];
        try { pool.clarity = 0; } catch (e) { out.badClarity = e.name; }
        holoml.find('map').visible = false;
        out.planVisible = holoml.find('map').visible;
        out.labels = [holoml.find('car').label, holoml.find('stand').label];
        holoml.find('stand').label = 'A new stand';
        return out;
      })()`,
      PAGE,
    );
    expect(out).toEqual({ kind: 'animate', runningAtFirst: true, stopped: false, held: true, started: true, water: ['#336699', 4], badClarity: 'TypeError', planVisible: false, labels: ['A car', 'The stand'] });
    expect(await holo(h, 'window.__holoml.water()', PAGE)).toMatchObject({ color: '#336699', clarity: 4 });
    expect(await inPage<boolean>(h, `document.querySelector('[data-testid="holoml-plan"]').hidden`, PAGE)).toBe(true);
    expect(await holo<string[]>(h, 'window.__holoml.outline()', PAGE)).toContain('button:Group: A new stand');
  });

  it('HL6 the viewer goes to a place and the page hears where it arrived; an id that is no place is an error', async () => {
    expect(await inPage<string>(h, 'holoml.viewer.place', PAGE)).toBe('hall');
    await inPage(h, `window.__arrived = []; holoml.on('place', (e) => window.__arrived.push(e.place)); holoml.viewer.goTo('terrace'); true`, PAGE);
    await waitFor('arrived at the terrace', () => inPage<string[]>(h, 'window.__arrived', PAGE), (a) => a.includes('terrace'));
    expect(await inPage<string>(h, 'holoml.viewer.place', PAGE)).toBe('terrace');
    expect(await inPage<string>(h, `(() => { try { holoml.viewer.goTo('nowhere'); return 'no error'; } catch (e) { return e.name; } })()`, PAGE)).toBe('TypeError');
  });

  it("HL6 holoml.add takes animations, panels, and links, with click actions; an animation whose target is not there is left out; a sound's place is taken away", async () => {
    const out = await inPage<Record<string, unknown>>(
      h,
      `(() => {
        const added = holoml.add('<model id="lamp" src="models/placeholder-car.gltf" position="-3 0 0" /><animate id="nod" target="#lamp" attribute="rotation" to="0 20 0" duration="1s" begin="click" toggle label="Nod" /><panel position="0 2 2" width="1">Added words</panel><a href="m25-far.holoml"><label position="0 3 2">To the far page</label></a><animate target="#nothing" attribute="position" to="0 1 0" duration="1s" />');
        const tone = holoml.find('tone');
        tone.position = null;
        return { kinds: added.map((t) => t.kind), tone: tone.position };
      })()`,
      PAGE,
    );
    expect(out).toEqual({ kinds: ['model', 'animate', 'panel'], tone: null });
    expect(await holo<string[]>(h, 'window.__holoml.links()', PAGE)).toEqual(expect.arrayContaining([server.url('holoml/m25-far.holoml')]));
    await waitFor('the action joined its trigger', () => holo<{ trigger: string | null }[]>(h, 'window.__holoml.actions()', PAGE), (a) => a.some((x) => x.trigger === 'lamp'));
    // The checker finds it first: an <animate> whose target is no element's id is left out, and the console says why.
    expect(await consoleText(h)).toMatch(/holoml\.add: line 1, column \d+: No element has the id "nothing"; <animate> left out\./);
  });

  it("HL6 a 0.2 page's scripts have the API as it was", async () => {
    await openPage(h, 'review-134-api.holoml');
    expect(await inPage(h, `[typeof holoml.viewer.goTo, 'place' in holoml.viewer, 'label' in holoml.find('car')]`, 'review-134-api.holoml')).toEqual(['undefined', false, false]);
  });
});

describe('the look, as the specification now writes it down', () => {
  let h: Harness;
  const PAGE = 'm25-sky.holoml';
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ layersOnOpen: false }) });
    await waitForPage(h, 'link-a.html');
    await openPage(h, PAGE);
  });
  afterAll(async () => h?.close());

  /** The colour in the middle of the view, looking along a direction. */
  async function seen(direction: Vec): Promise<Colour> {
    await inPage(h, `(holoml.viewer.lookAt(${JSON.stringify(direction)}), true)`, PAGE);
    // Turned and still (looking up, walking stops a little short of straight up).
    let last: Vec | null = null;
    await waitFor('turned', () => inPage<Vec>(h, 'holoml.viewer.direction', PAGE), (d) => {
      const still = last !== null && Math.hypot(...d.map((v, i) => v - last![i]!)) < 1e-6;
      last = d;
      return still && d.reduce((sum, v, i) => sum + v * direction[i]!, 0) > 0;
    });
    await sleep(300);
    const [w, hgt] = await inPage<number[]>(h, '[innerWidth, innerHeight]', PAGE);
    return (await pixels(h, PAGE, [{ x: w! / 2, y: hgt! / 2 }], 1))[0]!;
  }
  const RED = { r: 255, g: 0, b: 0 };
  const GREEN = { r: 0, g: 255, b: 0 };
  const BLUE = { r: 0, g: 0, b: 255 };
  const YELLOW = { r: 255, g: 255, b: 0 };

  it("a panorama's middle faces +x, a quarter across faces -z, and its top is straight up (SPEC.md section 9, \"Drawing\")", async () => {
    // The sky: blue, a red band down its middle, a green one a quarter across, and yellow along its top.
    expect(away(await seen([1, 0, 0]), RED)).toBeLessThan(40);
    expect(away(await seen([0, 0, -1]), GREEN)).toBeLessThan(40);
    expect(away(await seen([0, 0, 1]), BLUE)).toBeLessThan(40);
    expect(away(await seen([-1, 0, 0]), BLUE)).toBeLessThan(40);
    expect(away(await seen([0, 10, -1]), YELLOW)).toBeLessThan(40);
  });
});

/** A .glb file's triangles and the extensions it needs (from the fixtures' copy of the example sites). */
function glbFacts(page: string, src: string): { triangles: number; required: string[] } {
  const bytes = readFileSync(fileURLToPath(new URL(`../fixtures/holoml/${page.replace(/[^/]+$/, '')}${src}`, import.meta.url)));
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8')) as {
    meshes?: { primitives: { indices?: number }[] }[];
    accessors: { count: number }[];
    extensionsRequired?: string[];
  };
  let triangles = 0;
  for (const m of json.meshes ?? []) for (const p of m.primitives) triangles += json.accessors[p.indices!]!.count / 3;
  return { triangles, required: json.extensionsRequired ?? [] };
}

describe('HL9: the example sites', () => {
  let h: Harness;
  const MB = 1024 * 1024;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ layersOnOpen: false }) });
    await waitForPage(h, 'link-a.html');
  });
  afterAll(async () => h?.close());

  it('HL9 every model and group a screen reader reaches on the example sites has a name: none is heard as a file or an id', async () => {
    const PAGES = [
      'harbour-loft/index.holoml',
      'harbour-loft/terrace.holoml',
      'harbour-loft/about.holoml',
      'aquarium/index.holoml',
      'aquarium/about.holoml',
      'sneaker-store/index.holoml',
      'sneaker-store/shoe.holoml',
      'sneaker-store/about.holoml',
      'sofa-studio/index.holoml',
      'sofa-studio/about.holoml',
      'blockworld/index.holoml',
      'words/index.holoml',
      // The showroom, a 0.1 site until prompt 171: the hall, a car's own page, and the about page.
      'showroom/index.holoml',
      'showroom/pippet-sunflower.holoml',
      'showroom/about.holoml',
    ];
    for (const page of PAGES) {
      await openPage(h, page);
      const named = (await holo<string[]>(h, 'window.__holoml.outline()', page))
        .filter((item) => /^button:(Model|Group): /.test(item))
        .map((item) => item.replace(/^button:(Model|Group): /, ''));
      // A model inside a link is reached as the link, which its panel or its label names.
      expect(named.filter((n) => /\.(glb|gltf)$/.test(n) || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(n)), page).toEqual([]);
    }
  }, 600_000);

  it('HL9 the ocean tunnel: far fish are drawn from their lighter versions, with far fewer triangles; at least 30 frames a second (with a graphics card)', async (ctx) => {
    const PAGE = 'aquarium/index.holoml';
    await openPage(h, PAGE);
    // One look at every fish: drawn from its far version (its own model not loaded), or near.
    const fish = await holo<FarInfo[]>(h, 'window.__holoml.far()', PAGE);
    expect(fish).toHaveLength(30);
    const far = fish.filter((f) => f.isFar);
    // From the entrance most fish are past 10 m.
    expect(far.length, 'fish drawn far').toBeGreaterThanOrEqual(15);
    for (const f of far) expect(f, f.id!).toMatchObject({ state: 'waiting', far: { shown: true } });
    for (const f of fish.filter((x) => !x.isFar)) expect(f.state, f.id!).toBe('loaded');
    // Each far version has under a third of its fish's triangles (about a fifth; the mackerel, whose seams hold on to
    // its corners, 29 per cent); what the fish draw now, against all of them near.
    let now = 0;
    let allNear = 0;
    for (const f of fish) {
      const [near, light] = [glbFacts(PAGE, f.src), glbFacts(PAGE, f.far.src)];
      expect(light.triangles, f.far.src).toBeLessThan(near.triangles / 3);
      now += f.isFar ? light.triangles : near.triangles;
      allNear += near.triangles;
    }
    console.log(`HL9: the fish draw ${now} triangles, ${allNear} if all were near`);
    expect(now).toBeLessThan(allNear / 2);
    // The frame rate while they swim.
    const f0 = await holo<number>(h, 'window.__holoml.frames', PAGE);
    await sleep(2000);
    const rate = ((await holo<number>(h, 'window.__holoml.frames', PAGE)) - f0) / 2;
    console.log(`HL9: ${rate.toFixed(1)} frames a second in the ocean tunnel`);
    // With a graphics card; drawn in software (GitHub's machines), the rate is logged, and this check is skipped, not passed.
    const software = await softwareRenderer(h);
    if (software) ctx.skip(`the frame-rate budget is for graphics hardware; drawing in software (${software})`);
    expect(rate).toBeGreaterThanOrEqual(30);
  }, 120_000);

  it('HL9 the sneaker store downloads less: its shoes are compressed with Draco, and it loads under 1 MB at first (2.4 MB before)', async () => {
    const PAGE = 'sneaker-store/index.holoml';
    await openPage(h, PAGE);
    const loaded = (await holo<ModelReport[]>(h, 'window.__holoml.models()', PAGE)).filter((m) => m.state === 'loaded').map((m) => m.src);
    const shoes = [...new Set(loaded.filter((src) => /shoe-/.test(src)))];
    // The bays by the entrance, and every bay's stand-ins.
    expect(shoes.filter((s) => !s.endsWith('-far.glb')).length).toBeGreaterThanOrEqual(1);
    expect(shoes.filter((s) => s.endsWith('-far.glb'))).toHaveLength(10);
    for (const src of shoes) expect(glbFacts(PAGE, src).required, src).toContain('KHR_draco_mesh_compression');
    const { bytes } = (await holo<{ bytes: number }>(h, 'window.__holoml.totals()', PAGE))!;
    console.log(`HL9: the sneaker store loaded ${(bytes / MB).toFixed(2)} MB at first`);
    expect(bytes).toBeLessThan(1 * MB);
  }, 120_000);

  it('HL9 Words in a room: each wall, sign, and board in its own language and direction, for screen readers and as drawn', async () => {
    const PAGE = 'words/index.holoml';
    await openPage(h, PAGE);
    expect(await inPage<string>(h, 'document.documentElement.lang', PAGE)).toBe('en');
    const named = await inPage<{ text: string; lang: string; dir: string }[]>(
      h,
      `[...document.querySelectorAll('#holoml-outline button span')].map((s) => ({ text: s.textContent, lang: s.lang, dir: s.dir }))`,
      PAGE,
    );
    expect(named).toEqual(
      expect.arrayContaining([
        { text: 'The English wall', lang: 'en', dir: 'ltr' },
        { text: 'الجدار العربي', lang: 'ar', dir: 'rtl' },
        { text: 'הקיר העברי', lang: 'he', dir: 'rtl' },
      ]),
    );
    const signs = await inPage<{ text: string; lang: string; dir: string }[]>(h, `[...document.querySelectorAll('#holoml-labels > p')].map((p) => ({ text: p.textContent, lang: p.lang, dir: p.dir }))`, PAGE);
    expect(signs).toEqual([
      { text: 'Welcome', lang: 'en', dir: 'ltr' },
      { text: 'أهلاً وسهلاً', lang: 'ar', dir: 'rtl' },
      { text: 'ברוכים הבאים', lang: 'he', dir: 'rtl' },
    ]);
    expect(await holo<{ text: string; dir: string }[]>(h, 'window.__holoml.labelDirections()', PAGE)).toEqual([
      { text: 'Welcome', dir: 'ltr' },
      { text: 'أهلاً وسهلاً', dir: 'rtl' },
      { text: 'ברוכים הבאים', dir: 'rtl' },
    ]);
    // Each board's paragraphs, in its wall's language.
    const boards = await inPage<[string, string][]>(h, `[...document.querySelectorAll('#holoml-labels div p')].map((p) => [p.lang, p.dir])`, PAGE);
    expect(boards).toEqual([
      ['en', 'ltr'],
      ['en', 'ltr'],
      ['ar', 'rtl'],
      ['ar', 'rtl'],
      ['he', 'rtl'],
      ['he', 'rtl'],
    ]);
    // The screen's text: dir="auto", in the page's language.
    expect(await inPage(h, `(() => { const s = document.querySelector('[data-testid="holoml-hud"]'); return [s.lang, s.dir]; })()`, PAGE)).toEqual(['en', 'auto']);
  });
});
