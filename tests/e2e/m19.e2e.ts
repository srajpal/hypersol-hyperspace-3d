/**
 * Milestone 19 end-to-end checks (TODO.md): HoloML 0.2's third part and
 * Harbour Loft. V2 to V7: panels, click actions, places, arriving through
 * a fade, the sky, and the floor plan. V1 (the language) is the holoml
 * repository's tests; V11 (the published site) is checked by hand.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  clickUntil,
  focusedTab,
  inPage,
  launch,
  pressInPage,
  pressInShell,
  project,
  sceneWait,
  shellCall,
  sleep,
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
type Rect = { left: number; top: number; right: number; bottom: number };
type Colour = { light: number; r: number; g: number; b: number };
type Panel = { id: string | null; paragraphs: string[]; lines: string[][]; width: number; height: number; size: number; background: string | null };
type Action = { trigger: string | null; button: string | null; pressed: string | null; animations: { target: string | null; progress: number; running: boolean }[]; sounds: string[] };
type Places = { start: string | null; current: string | null; places: { id: string; label: string }[] };
type Fade = { opacity: number; arriving: boolean; log: { to: number; at: number }[] };
type Plan = { corner: string | null; width: number; label: string; state: string; marker: { shown: boolean; x: number; y: number; angle: number } };

const url = (page: string) => server.url(`holoml/${page}`);

function holo<T>(h: Harness, expression: string, page: string): Promise<T> {
  return inPage<T>(h, `window.__holoml ? (${expression}) : undefined`, page);
}

async function ready(h: Harness, page: string, timeoutMs = 20_000): Promise<void> {
  await waitFor(`${page} ready`, () => holo<boolean>(h, 'window.__holoml.ready', page), (r) => r === true, timeoutMs);
}

/** Opens a page in the harness's tab and waits until it is ready. */
async function openPage(h: Harness, page: string, ref = page.split('?')[0]!): Promise<void> {
  await shellCall(h, 'showUrl', url(page));
  await waitForPage(h, ref, await sceneWait(h, 15_000));
  await ready(h, ref, await sceneWait(h, 20_000));
}

/**
 * Waits until an idle page has drawn what it loaded: a scene draws only
 * when something changes, so once the frame count holds still, the last
 * frame shows everything.
 */
async function drawn(h: Harness, page: string): Promise<void> {
  let last = -1;
  await waitFor(
    'the scene drawn and still',
    async () => {
      const now = await holo<number>(h, 'window.__holoml.frames', page);
      const still = now > 0 && now === last;
      last = now;
      await sleep(300);
      return still;
    },
    (v) => v,
    await sceneWait(h, 10_000),
  );
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
 * Presses Enter or Space in the page as a keyboard does: down, the
 * character, and up. A button acts on the character (Enter) or on the
 * key coming up (Space); key down alone, as pressInPage sends, moves only
 * what acts on it, such as a link.
 */
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

/** Holds a key down in the page for a while (walking and turning need keys held). */
async function hold(h: Harness, page: string, keyCode: string, ms: number): Promise<void> {
  await key(h, page, keyCode, 'keyDown');
  await sleep(ms);
  await key(h, page, keyCode, 'keyUp');
}

/** The page's own pixels as drawn: the average colour in a square around each point (page pixels; `half` each way). */
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

/**
 * Text on a light board: for each row of page pixels inside a rectangle
 * (kept a few pixels in from its edges), how many are dark, and how far
 * left and right the dark pixels reach (in page pixels).
 */
function darkRows(h: Harness, page: string, r: Rect): Promise<{ rows: number[]; minX: number; maxX: number }> {
  return h.app.evaluate(
    async ({ webContents }, { page, r }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop()!;
      const image = await guest.capturePage();
      const { width } = image.getSize();
      const scale = width / ((await guest.executeJavaScript('window.innerWidth')) as number);
      const px = image.toBitmap();
      const [x0, x1] = [Math.ceil(r.left * scale) + 4, Math.floor(r.right * scale) - 4];
      const [y0, y1] = [Math.ceil(r.top * scale) + 4, Math.floor(r.bottom * scale) - 4];
      const rows: number[] = [];
      let [minX, maxX] = [Infinity, -Infinity];
      for (let y = y0; y <= y1; y++) {
        let n = 0;
        for (let x = x0; x <= x1; x++) {
          const i = (y * width + x) * 4;
          if (0.299 * px[i + 2]! + 0.587 * px[i + 1]! + 0.114 * px[i]! < 110) {
            n++;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
          }
        }
        rows.push(n);
      }
      return { rows, minX: minX / scale, maxX: maxX / scale };
    },
    { page, r },
  );
}

/** Runs of rows with dark pixels: the lines of text, top to bottom. */
function bandsOf(rows: number[]): { start: number; end: number }[] {
  const bands: { start: number; end: number }[] = [];
  rows.forEach((n, y) => {
    if (n === 0) return;
    const last = bands.at(-1);
    if (last && last.end === y - 1) last.end = y;
    else bands.push({ start: y, end: y });
  });
  return bands;
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

const point = async (h: Harness, page: string, id: string | number) => (await holo<Point | null>(h, `window.__holoml.point(${JSON.stringify(id)})`, page))!;
/** Where a thing (by id) or a link (by index) is on the screen, through the page's tilt. */
const onScreen = async (h: Harness, page: string, id: string | number) => {
  const p = await point(h, page, id);
  return project(h, p.x, p.y);
};
const focusedText = (h: Harness, page: string) => inPage<string>(h, 'document.activeElement?.textContent ?? ""', page);
const view = (h: Harness, page: string) => holo<{ mode: string; position: Vec; target: Vec }>(h, 'window.__holoml.view()', page);
const near = (a: Vec, b: Vec, d = 0.05) => a.every((v, i) => Math.abs(v - b[i]!) <= d);

/** Tab through the page's outline until an item with this text has the keyboard. */
async function tabTo(h: Harness, page: string, text: string): Promise<void> {
  for (let i = 0; i < 30 && (await focusedText(h, page)) !== text; i++) await pressInPage(h, 'Tab', [], page);
  expect(await focusedText(h, page)).toBe(text);
}

describe('V2 to V4: panels, click actions, and places', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
  });
  afterAll(async () => h?.close());

  it('V2 a panel: its lines wrap within its width and its paragraphs stay apart; Find in page, screen readers, and the text view read it', async () => {
    const PAGE = 'panels.holoml';
    await openPage(h, PAGE);
    const panels = await holo<Panel[]>(h, 'window.__holoml.panels()', PAGE);
    const info = panels.find((p) => p.id === 'info')!;
    expect(info.paragraphs).toEqual(['Living room, 32 m²', 'Two tall windows face the harbour, and the oak floor runs through to the kitchen.', 'Evening light from the west.']);
    // The long paragraph wraps; its lines hold its words in order.
    expect(info.lines[1]!.length).toBeGreaterThan(1);
    expect(info.lines[1]!.join(' ')).toBe(info.paragraphs[1]);
    expect(panels.find((p) => p.id === 'plain')).toMatchObject({ paragraphs: ['Words without a board'], background: null });

    // The page's pixels: a band of dark text for each line, the paragraphs further apart than the lines of one.
    await drawn(h, PAGE);
    const rect = (await holo<Rect | null>(h, 'window.__holoml.rect("info")', PAGE))!;
    const rows = await darkRows(h, PAGE, rect);
    const bands = bandsOf(rows.rows);
    expect(bands.length, `the text's rows: ${JSON.stringify(bands)}`).toBe(info.lines.flat().length);
    const gaps = bands.slice(1).map((b, i) => b.start - bands[i]!.end);
    const breaks = [info.lines[0]!.length - 1, info.lines[0]!.length + info.lines[1]!.length - 1];
    const within = gaps.filter((_, i) => !breaks.includes(i));
    for (const i of breaks) expect(gaps[i], `gaps between rows: ${gaps.join(', ')}`).toBeGreaterThan(Math.max(...within) * 1.3);
    // Within the width: the words keep clear of the board's edges.
    const margin = (((rect.right - rect.left) * info.size * 0.8) / info.width) * 0.5;
    expect(rows.minX).toBeGreaterThan(rect.left + margin);
    expect(rows.maxX).toBeLessThan(rect.right - margin);

    // Find in page finds the words.
    await pressInPage(h, 'f', ['control'], PAGE);
    await waitFor('the find bar', () => shellCall(h, 'find'), (f) => f.open);
    await h.shell.fill('hs-find-bar [data-testid="find-input"]', 'oak floor');
    await waitFor('found', () => shellCall(h, 'find'), (f) => f.matches >= 1);
    await h.shell.locator('hs-find-bar [data-testid="find-input"]').press('Escape');
    await waitFor('closed', () => shellCall(h, 'find'), (f) => !f.open);

    // Screen readers: the panel's button, named by its first paragraph, and the rest of its words.
    const tree = await axNodes(h, PAGE);
    expect(tree.some((n) => n.role === 'button' && n.name === 'Panel: Living room, 32 m²')).toBe(true);
    expect(tree.some((n) => n.name.includes('Evening light from the west.'))).toBe(true);
    // A panel in a link names the link.
    expect(await holo<string[]>(h, 'window.__holoml.outline()', PAGE)).toContain('a:Open the second page');

    // The text view shows every paragraph.
    await pressInPage(h, 'V', ['control', 'shift'], PAGE);
    await waitFor('the text view', () => holo<boolean>(h, 'window.__holoml.textView', PAGE), (v) => v === true);
    const text = await inPage<string>(h, 'document.body.innerText', PAGE);
    for (const p of info.paragraphs) expect(text).toContain(p);
    await pressInPage(h, 'V', ['control', 'shift'], PAGE);
    await waitFor('3D again', () => holo<boolean>(h, 'window.__holoml.textView', PAGE), (v) => v === false);

    // A script changes the words: drawn again, as paragraphs.
    expect(await inPage<string>(h, "(() => { const t = holoml.find('info'); t.text = 'One\\n\\nTwo'; return t.text; })()", PAGE)).toBe('One\n\nTwo');
    const changed = (await holo<Panel[]>(h, 'window.__holoml.panels()', PAGE)).find((p) => p.id === 'info')!;
    expect(changed.lines).toEqual([['One'], ['Two']]);
    expect(changed.height).toBeLessThan(info.height);
  });

  it('V3 click actions: a click, and Enter on its button, open the door and the next closes it; the switch works the lamp; the sound plays; reduced motion; scripts hear the clicks', async () => {
    const PAGE = 'actions.holoml';
    await openPage(h, PAGE);
    await drawn(h, PAGE);
    const actions = () => holo<Action[]>(h, 'window.__holoml.actions()', PAGE);
    const action = async (trigger: string) => (await actions()).find((a) => a.trigger === trigger)!;
    const hinge = async () => (await holo<{ rotation: Vec }>(h, 'window.__holoml.object("hinge")', PAGE)).rotation[1];
    const lamp = () => inPage<number>(h, "holoml.find('lamp').intensity", PAGE);
    const clicks = () => inPage<{ thing: string | null; point: boolean; button: string }[]>(h, 'window.clicks', PAGE);

    // Each trigger is a button in the outline, named by its label (else its name); a toggle says whether it is on.
    const outline = await holo<string[]>(h, 'window.__holoml.outline()', PAGE);
    for (const b of ['button:Bedroom door', 'button:Hall light', 'button:box']) expect(outline).toContain(b);
    expect(outline).not.toContain('button:Model: door');
    expect(await action('door')).toMatchObject({ button: 'Bedroom door', pressed: 'false', sounds: ['creak'] });
    expect(await hinge()).toBeCloseTo(0, 3);

    // A click on the door: it swings open, and the sound plays (the click is the first, so sounds may play).
    await clickUntil(h, await onScreen(h, PAGE, 'door'), 'the door opens', async () => (await action('door')).pressed === 'true');
    await waitFor('the creak', () => holo<{ id: string; playing: boolean }[]>(h, 'window.__holoml.sounds()', PAGE), (s) => s.find((x) => x.id === 'creak')?.playing === true, 3000);
    await waitFor('open', hinge, (r) => Math.abs(r - 90) < 0.01);
    expect((await clicks()).at(-1)).toEqual({ thing: 'door', point: true, button: 'left' });
    // The next click closes it.
    const open = await onScreen(h, PAGE, 'door');
    await clickUntil(h, open, 'the door closes', async () => (await action('door')).pressed === 'false');
    await waitFor('shut', hinge, (r) => Math.abs(r) < 0.01);

    // The switch turns the lamp on, and off.
    const sw = await onScreen(h, PAGE, 'switch');
    await clickUntil(h, sw, 'the lamp on', async () => (await action('switch')).pressed === 'true');
    await waitFor('lit', lamp, (v) => Math.abs(v - 1.5) < 1e-6);
    await clickUntil(h, sw, 'the lamp off', async () => (await action('switch')).pressed === 'false');
    await waitFor('dark', lamp, (v) => v === 0);

    // Not a toggle: each click spins the box once from the start.
    const box = await onScreen(h, PAGE, 'box');
    await clickUntil(h, box, 'the box spins', async () => (await action('box')).animations[0]!.running);
    await waitFor('one turn', async () => (await action('box')).animations[0]!, (a) => !a.running && a.progress === 1, 3000);

    // The keyboard: Tab to the door's button; Enter opens it and Space closes it; scripts hear these as clicks without a point.
    await tabTo(h, PAGE, 'Bedroom door');
    await press(h, PAGE, 'Enter');
    await waitFor('open by keyboard', hinge, (r) => Math.abs(r - 90) < 0.01);
    expect((await clicks()).at(-1)).toEqual({ thing: 'door', point: false, button: 'left' });
    const tree = await axNodes(h, PAGE);
    expect(tree.find((n) => n.role === 'button' && n.name === 'Bedroom door')?.pressed).toBe('true');
    await press(h, PAGE, 'Space');
    await waitFor('shut by keyboard', hinge, (r) => Math.abs(r) < 0.01);

    // Reduced motion: each action goes straight to its end.
    await reducedMotion(h, true);
    try {
      await waitFor('reduced motion', () => holo<boolean>(h, 'holoml.reducedMotion', PAGE), (v) => v === true);
      await press(h, PAGE, 'Enter');
      const a = await action('door');
      expect(a.animations[0]).toMatchObject({ progress: 1, running: false });
      await waitFor('open at once', hinge, (r) => Math.abs(r - 90) < 0.01, 1000);
      await press(h, PAGE, 'Enter');
      await waitFor('shut at once', hinge, (r) => Math.abs(r) < 0.01, 1000);
    } finally {
      await reducedMotion(h, false);
    }
  });

  it('V4 places: #name starts there, an unknown name at the first; "Go to" and a link to #name move the viewer; Back returns', async () => {
    const PAGE = 'places.holoml';
    const HALL: Vec = [0, 1.6, 6];
    const KITCHEN: Vec = [4, 1.6, 1];
    await openPage(h, `${PAGE}#kitchen`);
    let places = await holo<Places>(h, 'window.__holoml.places()', PAGE);
    expect(places).toEqual({
      start: 'kitchen',
      current: 'kitchen',
      places: [
        { id: 'hall', label: 'Hall' },
        { id: 'kitchen', label: 'Kitchen' },
        { id: 'study', label: 'study' },
      ],
    });
    // It starts there, moving as the place it started at says (the kitchen's orbit, not the hall's walk).
    expect(near((await view(h, PAGE)).position, KITCHEN)).toBe(true);
    expect((await view(h, PAGE)).mode).toBe('orbit');

    // A name the page does not have: the first place, walking.
    await openPage(h, 'second.holoml');
    await openPage(h, `${PAGE}#nowhere`);
    places = await holo<Places>(h, 'window.__holoml.places()', PAGE);
    expect([places.start, places.current]).toEqual(['hall', 'hall']);
    expect(near((await view(h, PAGE)).position, HALL)).toBe(true);
    expect((await view(h, PAGE)).mode).toBe('walk');
    // The outline lists the places to go.
    const outline = await holo<string[]>(h, 'window.__holoml.outline()', PAGE);
    for (const b of ['button:Go to: Hall', 'button:Go to: Kitchen', 'button:Go to: study']) expect(outline).toContain(b);

    // "Go to: Kitchen" from the keyboard: there, and the address says so.
    await tabTo(h, PAGE, 'Go to: Kitchen');
    await press(h, PAGE, 'Enter');
    await waitFor('in the kitchen', () => holo<Places>(h, 'window.__holoml.places()', PAGE), (p) => p.current === 'kitchen');
    await waitFor('at the kitchen', async () => (await view(h, PAGE)).position, (p) => near(p, KITCHEN));
    expect((await focusedTab(h)).url).toBe(url(`${PAGE}#kitchen`));
    // Back: to where the address was.
    await pressInShell(h, 'Left', ['alt']);
    await waitFor('back in the hall', () => holo<Places>(h, 'window.__holoml.places()', PAGE), (p) => p.current === 'hall');
    await waitFor('at the hall', async () => (await view(h, PAGE)).position, (p) => near(p, HALL));

    // A link in the scene to #kitchen.
    await drawn(h, PAGE);
    const link = await onScreen(h, PAGE, 'to-kitchen');
    await clickUntil(h, link, 'the link to the kitchen', async () => (await holo<Places>(h, 'window.__holoml.places()', PAGE)).current === 'kitchen');
    await waitFor('at the kitchen again', async () => (await view(h, PAGE)).position, (p) => near(p, KITCHEN));
  });
});

describe('V5: arriving through a fade', () => {
  let h: Harness;
  const A = 'fade-a.holoml';
  const B = 'fade-b.holoml';
  /** Watches the page's fade (from the page itself), keeping the darkest it gets where the next page of the site can read it. */
  const watchFade = (page: string) =>
    inPage(
      h,
      "(() => { sessionStorage.setItem('fadeMax', '0'); const f = document.getElementById('holoml-fade'); const loop = () => { const o = Number(getComputedStyle(f).opacity); if (o > Number(sessionStorage.getItem('fadeMax'))) sessionStorage.setItem('fadeMax', String(o)); requestAnimationFrame(loop); }; loop(); return true; })()",
      page,
    );
  const darkest = (page: string) => inPage<string | null>(h, "sessionStorage.getItem('fadeMax')", page).then(Number);
  const fade = (page: string) => holo<Fade>(h, 'window.__holoml.fade()', page);

  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
  });
  afterAll(async () => h?.close());

  it('V5 a link to another HoloML page of the same site fades out and in; a cut with reduced motion; other links as before', async () => {
    await openPage(h, A);
    await drawn(h, A);
    await watchFade(A);
    // The first link: "Next room".
    await clickUntil(h, await onScreen(h, A, 0), 'the next room', async () => (await focusedTab(h)).url === url(B));
    await waitForPage(h, B);
    // The first page went dark before it went.
    expect(await darkest(B)).toBeGreaterThan(0.95);
    // The next page stays dark while its model is still coming (the check holds it)...
    await waitFor('arriving', () => fade(B), (f) => f !== undefined && f.arriving && f.opacity === 1);
    const size = await inPage<{ w: number; h: number }>(h, '({ w: innerWidth, h: innerHeight })', B);
    const centre = { x: size.w / 2, y: size.h * 0.3 };
    const [dark] = await pixels(h, B, [centre], 8);
    expect(dark!.light).toBeLessThan(12);
    // ...and fades in once it has drawn its scene.
    server.release('fade-b');
    await ready(h, B);
    const done = await waitFor('faded in', () => fade(B), (f) => !f.arriving && f.opacity === 0, 6000);
    expect(done.log.map((x) => x.to)).toEqual([1, 0]);
    const [light] = await pixels(h, B, [centre], 8);
    expect(light!.light).toBeGreaterThan(150);

    // A link to a web page: no fade.
    await openPage(h, A);
    await drawn(h, A);
    await watchFade(A);
    await clickUntil(h, await onScreen(h, A, 1), 'the web page', async () => (await focusedTab(h)).url === server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
    expect(await darkest('link-a.html')).toBe(0);

    // Reduced motion: a cut, both ways.
    await reducedMotion(h, true);
    try {
      await openPage(h, A);
      await drawn(h, A);
      await watchFade(A);
      await clickUntil(h, await onScreen(h, A, 0), 'the next room, cut', async () => (await focusedTab(h)).url === url(B));
      await waitForPage(h, B);
      await ready(h, B);
      expect(await darkest(B)).toBe(0);
      expect(await fade(B)).toEqual({ opacity: 0, arriving: false, log: [] });
    } finally {
      await reducedMotion(h, false);
    }
  });
});

describe('V6 and V7: the sky and the floor plan', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
  });
  afterAll(async () => h?.close());

  it("V6 the sky shows behind the scene, the right way up, from the page's own site, counted against its limits", async () => {
    const PAGE = 'sky.holoml';
    await openPage(h, PAGE);
    expect(await holo<{ state: string; intensity: number }>(h, 'window.__holoml.sky()', PAGE)).toMatchObject({ state: 'loaded', intensity: 1 });
    await drawn(h, PAGE);
    const size = await inPage<{ w: number; h: number }>(h, '({ w: innerWidth, h: innerHeight })', PAGE);
    const [above, below] = await pixels(h, PAGE, [
      { x: size.w / 2, y: size.h * 0.2 },
      { x: size.w / 2, y: size.h * 0.8 },
    ]);
    // Orange above the horizon, blue below.
    expect(above!.r, `above: ${above!.r.toFixed(0)}, ${above!.g.toFixed(0)}, ${above!.b.toFixed(0)}`).toBeGreaterThan(above!.b + 80);
    expect(below!.b, `below: ${below!.r.toFixed(0)}, ${below!.g.toFixed(0)}, ${below!.b.toFixed(0)}`).toBeGreaterThan(below!.r + 80);
    // Counted: the page's bytes are the sky's.
    const bytes = (await (await fetch(url('gen/sky.png?top=ff6010&bottom=1060ff'))).arrayBuffer()).byteLength;
    expect((await holo<{ totals: { bytes: number } }>(h, 'window.__holoml.scene()', PAGE)).totals.bytes).toBe(bytes);

    // From another site: not loaded, said so, and the background colour instead.
    const AWAY = 'sky-away.holoml';
    await openPage(h, AWAY);
    expect(await holo<{ state: string }>(h, 'window.__holoml.sky()', AWAY)).toMatchObject({ state: 'refused' });
    expect(await holo<{ what: string; why: string }[]>(h, 'window.__holoml.leftOut()', AWAY)).toContainEqual({ what: 'https://example.com/sky.jpg', why: "the sky loads only from the page's own site" });
    await drawn(h, AWAY);
    const [back] = await pixels(h, AWAY, [{ x: size.w / 2, y: size.h / 2 }]);
    expect(back!.g).toBeGreaterThan(back!.r + 15);
  });

  it('V7 the floor plan: in its corner, named for screen readers; its marker follows the viewer as they walk and turn', async () => {
    const PAGE = 'plan.holoml';
    await openPage(h, PAGE);
    await drawn(h, PAGE);
    const plan = () => holo<Plan>(h, 'window.__holoml.plan()', PAGE);
    const start = await plan();
    expect(start).toMatchObject({ corner: 'bottom-left', width: 240, label: 'Floor plan of the test room', state: 'loaded' });
    // The viewer stands at (0, 2), halfway across and 70% down the plan, facing up it.
    expect(start.marker.shown).toBe(true);
    expect(start.marker.x).toBeCloseTo(0.5, 3);
    expect(start.marker.y).toBeCloseTo(0.7, 3);
    expect(start.marker.angle).toBeCloseTo(0, 3);
    // In the lower left corner, and the marker's red where the plan says.
    const box = await inPage<Rect & { vh: number }>(h, "(() => { const r = document.querySelector('[data-testid=holoml-plan]').getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, vh: innerHeight }; })()", PAGE);
    expect(box.left).toBeLessThan(40);
    expect(box.vh - box.bottom).toBeLessThan(40);
    const at = (m: Plan['marker']) => ({ x: box.left + m.x * (box.right - box.left), y: box.top + m.y * (box.bottom - box.top) });
    const [dot] = await pixels(h, PAGE, [at(start.marker)], 2);
    expect(dot!.r).toBeGreaterThan(dot!.g + 60);
    // Screen readers: a picture with its label.
    expect((await axNodes(h, PAGE)).some((n) => n.role === 'image' && n.name === 'Floor plan of the test room')).toBe(true);

    // Walking forward (toward -z): up the plan.
    await hold(h, PAGE, 'W', 900);
    const walked = await waitFor('walked', plan, (p) => p.marker.y < 0.7 - 0.08);
    expect(walked.marker.x).toBeCloseTo(0.5, 2);
    // Turning right: the marker turns clockwise.
    await hold(h, PAGE, 'Right', 500);
    const turned = await waitFor('turned', plan, (p) => p.marker.angle > 20);
    expect(turned.marker.angle).toBeLessThan(90);
    // Outside the area: no marker.
    await inPage(h, 'holoml.viewer.position = [9, 1.6, 0], true', PAGE);
    await waitFor('off the plan', plan, (p) => !p.marker.shown);
  });
});
