/**
 * Milestone 25 end-to-end checks (TODO.md): HoloML 0.3 in HyperSpace 3D.
 * HL2 names, HL3 language and direction, HL4 compressed models, HL5 far
 * models, HL6 the scene API, and HL7 a page's description. HL1 (the
 * language) is the holoml repository's tests; HL8 (older pages) is every
 * earlier milestone's checks; HL9 (the examples) is below once they are
 * updated; HL10 is the full run, the Android app, and the published site.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import { inPage, launch, newProfile, sceneWait, settled, shellCall, sleep, tabs, waitFor, waitForPage, type Harness, type Point } from './harness';

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

  it("HL2 a model's and a group's label is what the outline lists and screen readers hear; without one, the id, then the file's name; a group is listed by its name alone", async () => {
    const outline = await holo<string[]>(h, 'window.__holoml.outline()', PAGE);
    expect(outline).toContain('button:Group: Two cars');
    expect(outline).toContain('button:Model: מכונית כחולה');
    expect(outline).toContain('button:Model: plain');
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
