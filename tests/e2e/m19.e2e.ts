/**
 * Milestone 19 end-to-end checks (TODO.md): HoloML 0.2's third part and
 * Harbour Loft. V2 to V7: panels, click actions, places, arriving through
 * a fade, the sky, and the floor plan. V8 to V10: Harbour Loft (a copy in
 * tests/fixtures/holoml/harbour-loft). V1 (the language) is the holoml
 * repository's tests; V11 (the published site) is checked by hand.
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
 * when something changes (each arrival asks for a frame), so once no
 * shaders are compiling and the frame count holds still, the last frame
 * shows everything (sceneStill).
 */
async function drawn(h: Harness, page: string): Promise<void> {
  await sceneStill(h, page, await sceneWait(h, 10_000));
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

/**
 * Holds a key down in the page for a while (walking and turning need
 * keys held): for so many milliseconds of the scene's own time (the
 * viewer's `clock`), which its frames move on, each by at most 100 ms.
 * The viewer walks and turns by that time, not by the wall's clock, so on
 * a machine that draws slowly it has gone as far, and turned as far, when
 * the key comes up as on a fast one; only the wait is longer.
 */
async function hold(h: Harness, page: string, keyCode: string, ms: number): Promise<void> {
  const clock = () => holo<number>(h, 'window.__holoml.clock', page);
  const from = await clock();
  await key(h, page, keyCode, 'keyDown');
  try {
    await waitFor(`${ms} ms of the scene's time with ${keyCode} held (from ${from} ms)`, clock, (t) => t >= from + ms, (await sceneWait(h, ms)) * 2 + 10_000);
  } finally {
    await key(h, page, keyCode, 'keyUp');
  }
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
  /**
   * The page's brightness over some milliseconds, sampled by the browser
   * (its own pictures of the page, 0 to 255 in a square around a point at
   * half its width and 30% of its height) from when the page appears,
   * each with the times its capture began and finished. The page itself
   * is not asked; a page busy over its first frame (drawing in software)
   * holds back the browser's pictures of it too, until it is done.
   */
  const brightness = (page: string, ms: number) =>
    h.app.evaluate(
      async ({ webContents }, { page, ms }) => {
        const out: { t: number; done: number; light: number }[] = [];
        const end = Date.now() + ms;
        while (Date.now() < end) {
          const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview').pop();
          if (guest?.getURL().includes(page)) {
            const t = Date.now();
            const image = await guest.capturePage();
            const { width, height } = image.getSize();
            if (width > 0 && height > 0) {
              const px = image.toBitmap(); // BGRA
              const [cx, cy, half] = [Math.round(width / 2), Math.round(height * 0.3), 8];
              let [sum, n] = [0, 0];
              for (let y = cy - half; y <= cy + half; y++) {
                for (let x = cx - half; x <= cx + half; x++) {
                  const i = (y * width + x) * 4;
                  sum += 0.299 * px[i + 2]! + 0.587 * px[i + 1]! + 0.114 * px[i]!;
                  n++;
                }
              }
              out.push({ t, done: Date.now(), light: sum / n });
            }
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        return out;
      },
      { page, ms },
    );

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
    // The next page is dark while its model is still coming (the check holds it): its brightness, sampled from when
    // it appears, for 2.5 s...
    const samples = await brightness(B, 2500);
    await waitForPage(h, B);
    // The first page went dark before it went.
    expect(await darkest(B)).toBeGreaterThan(0.95);
    // ...shows nothing of its scene until it begins to fade in (the lit scene reads about 226; the page's own dark
    // ground, before its fade is first painted, about 16; the fade, 0). It begins once its scene is drawn with nothing
    // left to load, or after the 4 s it waits at most; a page drawing its first frame in software may be busy for all
    // of that time, and then the samples are those taken before it started, and after. A picture finished before the
    // fade-in began counts, whatever it shows. So does one that began before and came back after (the browser's only
    // picture of a page busy from 0.2 s to 5.2 s, on GitHub's machines), if it is dark: a page cannot have shown its
    // scene and gone dark again before fading in. One that began before, came back after, and is not dark says
    // nothing either way (the fade-in may have begun while it was taken) and is left out, as every later one is.
    const [started, origin] = [await fade(B), await inPage<number>(h, 'performance.timeOrigin', B)];
    expect(started.log[0]).toMatchObject({ to: 1 });
    const until = started.log[1] ? origin + started.log[1].at : Infinity;
    const beforeFadeIn = samples.filter((x) => x.done <= until || (x.t < until && x.light < 30));
    const seen = `the fade set at ${Math.round(started.log[0]!.at)} ms, the fade-in begun at ${Math.round(until - origin)} ms; samples: ${JSON.stringify(samples.map((x) => [Math.round(x.t - origin), Math.round(x.done - origin), Math.round(x.light)]))}`;
    expect(beforeFadeIn.length, seen).toBeGreaterThan(0);
    expect(Math.max(...beforeFadeIn.map((x) => x.light)), seen).toBeLessThan(30);
    console.log(`V5: ${seen}`);
    const size = await inPage<{ w: number; h: number }>(h, '({ w: innerWidth, h: innerHeight })', B);
    const centre = { x: size.w / 2, y: size.h * 0.3 };
    // ...and fades in once it has drawn its scene with nothing left to load.
    server.release('fade-b');
    await ready(h, B);
    const done = await waitFor('faded in', () => fade(B), (f) => !f.arriving && f.opacity === 0, await sceneWait(h, 6000));
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
    // Turning right, for half a second of the scene's time: the marker turns clockwise, by less than a quarter turn.
    await hold(h, PAGE, 'Right', 500);
    const turned = await waitFor('turned', plan, (p) => p.marker.angle > 20);
    expect(turned.marker.angle).toBeLessThan(90);
    // Outside the area: no marker.
    await inPage(h, 'holoml.viewer.position = [9, 1.6, 0], true', PAGE);
    await waitFor('off the plan', plan, (p) => !p.marker.shown);
  });
});

describe('V8 to V10: Harbour Loft', () => {
  let h: Harness;
  const PAGE = 'harbour-loft/index.holoml';
  const LOFT = 'harbour-loft/index';
  const TERRACE = 'harbour-loft/terrace';
  let loadMs = 0;

  /** The doors: the door (the trigger), its hinge, its button, and the hinge's turn shut and open. */
  const DOORS: [string, string, string, number, number][] = [
    ['study-door', 'study-hinge', 'Study door', -90, -180],
    ['bathroom-door', 'bathroom-hinge', 'Bathroom door', -90, 0],
    ['bedroom-door', 'bedroom-hinge', 'Bedroom door', 90, 0],
  ];
  /** The lamps: the trigger (a switch, or the lamp itself), its button, its light and how bright it comes on, and its bulbs' glow and how large. */
  const LAMPS: [string, string, string, number, string[], number][] = [
    ['hall-switch', 'Hall light', 'hall-light', 1.2, ['hall-glow'], 1],
    ['kitchen-switch', 'Kitchen lights', 'kitchen-light', 1.2, ['kitchen-glow-1', 'kitchen-glow-2'], 1],
    ['bathroom-switch', 'Bathroom light', 'bathroom-light', 1.2, ['bathroom-glow'], 1],
    ['living-lamp', 'Living room lamp', 'living-light', 1, ['living-glow'], 0.7],
    ['bedside-left', 'Bedside lamp, left', 'bedside-left-light', 0.9, ['bedside-left-glow'], 0.7],
    ['bedside-right', 'Bedside lamp, right', 'bedside-right-light', 0.9, ['bedside-right-glow'], 0.7],
    ['desk-lamp', 'Desk lamp', 'desk-light', 1.6, ['desk-glow'], 0.75],
  ];
  const info = (id: string, page = LOFT) => holo<{ rotation: Vec; scale: Vec }>(h, `window.__holoml.object(${JSON.stringify(id)})`, page);
  const turnOf = async (id: string) => (await info(id)).rotation[1];
  const scaleOf = async (id: string) => (await info(id)).scale[0];
  /** Two turns about y the same, whichever way round they are written. */
  const sameTurn = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180) < 0.5;
  const intensity = (id: string) => inPage<number>(h, `holoml.find(${JSON.stringify(id)}).intensity`, LOFT);
  const action = async (trigger: string) => (await holo<Action[]>(h, 'window.__holoml.actions()', LOFT)).find((a) => a.trigger === trigger)!;
  const places = (page = LOFT) => holo<Places>(h, 'window.__holoml.places()', page);
  const fade = (page: string) => holo<Fade>(h, 'window.__holoml.fade()', page);
  const feet = async () => (await holo<{ feet: Vec }>(h, 'window.__holoml.walker()', LOFT)).feet;
  const frames = () => holo<number>(h, 'window.__holoml.frames', LOFT);
  /** Presses a button of the page's outline by its words, as Enter on it does (the keyboard itself is V9's). */
  const pressButton = (label: string) =>
    inPage<boolean>(h, `(() => { const b = [...document.querySelectorAll('#holoml-outline button')].find((x) => x.textContent === ${JSON.stringify(label)}); b?.click(); return Boolean(b); })()`, LOFT);
  /** Puts the viewer somewhere, looking at a point. */
  const stand = (at: Vec, look: Vec, page = LOFT) => inPage(h, `(holoml.viewer.position = ${JSON.stringify(at)}, holoml.viewer.lookAt(${JSON.stringify(look)}), true)`, page);
  /** The kind and value of what has the keyboard, for radio buttons. */
  const focusedRadio = () => inPage<string | null>(h, "document.activeElement?.type === 'radio' ? document.activeElement.value : null", LOFT);

  /**
   * Walks with a key held until the walker stops (something solid in the
   * way) or the time is up; stopped is the same place while the page drew
   * new frames, so a slow machine does not count as stopped.
   */
  async function walkUntilStopped(keyCode: string, maxMs: number): Promise<Vec> {
    await key(h, LOFT, keyCode, 'keyDown');
    try {
      const end = Date.now() + maxMs;
      let [last, lastFrames, still] = [await feet(), await frames(), 0];
      while (Date.now() < end && still < 3) {
        await sleep(250);
        const [now, drawnNow] = [await feet(), await frames()];
        if (drawnNow < lastFrames + 2) continue;
        still = near(now, last, 0.002) ? still + 1 : 0;
        [last, lastFrames] = [now, drawnNow];
      }
      return last;
    } finally {
      await key(h, LOFT, keyCode, 'keyUp');
    }
  }

  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
    const t = Date.now();
    await shellCall(h, 'showUrl', url(PAGE));
    await waitForPage(h, LOFT, await sceneWait(h, 15_000));
    await ready(h, LOFT, 60_000);
    loadMs = Date.now() - t;
  });
  afterAll(async () => h?.close());

  it('V8 the flat is ready within 5 s (with a graphics card)', async (ctx) => {
    // Within 5 s with a graphics card; drawn in software (GitHub's machines), the time is measured and logged,
    // and the check is skipped, not passed (owner, prompts 59, 95, and 98 Q5 a).
    const software = await softwareRenderer(h);
    if (software) {
      console.log(`V8: ready in ${loadMs} ms; the 5-second budget not checked: drawing in software (${software})`);
      ctx.skip(`the 5-second budget is for graphics hardware; drawing in software (${software})`);
    }
    console.log(`V8: ready in ${loadMs} ms`);
    expect(loadMs).toBeGreaterThan(0);
    expect(loadMs).toBeLessThan(5000);
  });

  it('V8 ready with everything loaded; walls and doors stop the walker; every door and lamp works; the terrace and back; the booking page', async () => {
    expect(await holo<unknown[]>(h, 'window.__holoml.problems', LOFT)).toEqual([]);
    expect(await holo<unknown[]>(h, 'window.__holoml.leftOut()', LOFT)).toEqual([]);
    const source = await (await fetch(url(PAGE))).text();
    const all = await holo<{ src: string; state: string }[]>(h, 'window.__holoml.models()', LOFT);
    expect(all.length).toBe(source.match(/<model /g)!.length);
    expect(all.filter((m) => m.state !== 'loaded')).toEqual([]);
    for (const part of ['sky', 'environment', 'plan']) expect(await holo<{ state: string }>(h, `window.__holoml.${part}()`, LOFT), part).toMatchObject({ state: 'loaded' });
    expect((await holo<{ state: string }[]>(h, 'window.__holoml.sounds()', LOFT)).map((s) => s.state)).toEqual(Array(10).fill('loaded'));
    expect(await places()).toMatchObject({ start: 'hall', current: 'hall' });
    expect((await places()).places.map((p) => p.label)).toEqual(['Hall', 'Living room', 'Kitchen', 'Bedroom', 'Study', 'Bathroom', 'By the door to the terrace']);
    await drawn(h, LOFT);

    // The walls stop the walker: backing away from the harbour, the hall's walker stops at the front wall (its inside at z = -3.75; the walker is 0.6 m wide).
    const back = await walkUntilStopped('S', await sceneWait(h, 6000));
    expect(back[2], `stopped at ${back.join(', ')}`).toBeGreaterThan(-3.5);
    expect(back[2]).toBeLessThan(-3.3);

    // The study door, shut, stops the walker; a click opens it, with its sound, and the walker goes through.
    await stand([-1.2, 1.6, -2.55], [-5, 1.6, -2.55]);
    const atDoor = await walkUntilStopped('W', await sceneWait(h, 6000));
    expect(atDoor[0], `stopped at ${atDoor.join(', ')}`).toBeGreaterThan(-1.75);
    await stand([-0.9, 1.6, -2.55], [-2, 1.1, -2.55]);
    await drawn(h, LOFT);
    const doorPlays = async () => (await holo<{ src: string; plays: number }[]>(h, 'window.__holoml.sounds()', LOFT)).filter((x) => x.src === 'sounds/door.wav').reduce((n, x) => n + x.plays, 0);
    const played = await doorPlays();
    await clickUntil(h, await onScreen(h, LOFT, 'study-door'), 'the study door opens', async () => (await action('study-door')).pressed === 'true');
    // Its sound played (counted as it starts: drawing in software, the page may answer only after it has ended).
    await waitFor('the door sound', doorPlays, (n) => n > played, await sceneWait(h, 3000));
    await waitFor('open', () => turnOf('study-hinge'), (r) => sameTurn(r, -180));
    await stand([-1.2, 1.6, -2.55], [-5, 1.6, -2.55]);
    const inStudy = await walkUntilStopped('W', await sceneWait(h, 6000));
    expect(inStudy[0], `walked to ${inStudy.join(', ')}`).toBeLessThan(-3);

    // The hall's switch, by the front door: a click lights the pendant and its bulb, and the next puts them out.
    await stand([-0.8, 1.6, -2.7], [-0.8, 1.1, -3.75]);
    await drawn(h, LOFT);
    const sw = await onScreen(h, LOFT, 'hall-switch');
    await clickUntil(h, sw, 'the hall light on', async () => (await action('hall-switch')).pressed === 'true');
    await waitFor('lit', () => intensity('hall-light'), (v) => Math.abs(v - 1.2) < 1e-6);
    await waitFor('its bulb', () => scaleOf('hall-glow'), (s) => Math.abs(s - 1) < 1e-6);
    await clickUntil(h, sw, 'the hall light off', async () => (await action('hall-switch')).pressed === 'false');
    await waitFor('out', () => intensity('hall-light'), (v) => v === 0);

    // Every door and lamp, by its button: each runs its actions, and the next press undoes them.
    // (All pressed together, then read: drawing in software, each wait for a frame takes seconds.)
    expect(await pressButton('Study door')).toBe(true);
    await waitFor('the study door shut', () => turnOf('study-hinge'), (r) => sameTurn(r, -90));
    for (const [door, , label] of DOORS) expect(await action(door)).toMatchObject({ button: label, pressed: 'false', sounds: ['door.wav'] });
    for (const [trigger, label] of LAMPS) expect(await action(trigger)).toMatchObject({ button: label, pressed: 'false', sounds: ['switch.wav'] });
    for (const [, , label] of DOORS) expect(await pressButton(label)).toBe(true);
    for (const [, label] of LAMPS) expect(await pressButton(label)).toBe(true);
    for (const [door, hinge, label, , open] of DOORS) {
      await waitFor(`${label} open`, () => turnOf(hinge), (r) => sameTurn(r, open), await sceneWait(h, 5000));
      expect((await action(door)).pressed).toBe('true');
    }
    for (const [trigger, label, light, bright, glows, size] of LAMPS) {
      await waitFor(`${label} on`, () => intensity(light), (v) => Math.abs(v - bright) < 1e-6, await sceneWait(h, 5000));
      for (const g of glows) await waitFor(`${g} glowing`, () => scaleOf(g), (s) => Math.abs(s - size) < 1e-6, await sceneWait(h, 5000));
      expect((await action(trigger)).pressed).toBe('true');
    }
    for (const [, , label] of DOORS) await pressButton(label);
    for (const [, label] of LAMPS) await pressButton(label);
    for (const [, hinge, label, shut] of DOORS) await waitFor(`${label} shut`, () => turnOf(hinge), (r) => sameTurn(r, shut), await sceneWait(h, 5000));
    for (const [, label, light, , glows] of LAMPS) {
      await waitFor(`${label} off`, () => intensity(light), (v) => v === 0, await sceneWait(h, 5000));
      for (const g of glows) await waitFor(`${g} out`, () => scaleOf(g), (s) => s < 0.01, await sceneWait(h, 5000));
    }

    // Up to the roof terrace through the door in the brick wall (a fade), and back down to the door there.
    expect(await pressButton('Go to: By the door to the terrace')).toBe(true);
    await waitFor('by the terrace door', places, (p) => p.current === 'terrace-door');
    await stand([-5.3, 1.6, 0.9], [-6.1, 1.1, 0.9]);
    await drawn(h, LOFT);
    await clickUntil(h, await onScreen(h, LOFT, 'stairs-door'), 'the roof terrace', async () => (await focusedTab(h)).url === url('harbour-loft/terrace.holoml'));
    await waitForPage(h, TERRACE, await sceneWait(h, 15_000));
    await ready(h, TERRACE, await sceneWait(h, 20_000));
    expect(await holo<unknown[]>(h, 'window.__holoml.problems', TERRACE)).toEqual([]);
    expect((await holo<{ state: string }[]>(h, 'window.__holoml.models()', TERRACE)).filter((m) => m.state !== 'loaded')).toEqual([]);
    const arrived = await waitFor('faded in', () => fade(TERRACE), (f) => f !== undefined && !f.arriving && f.opacity === 0, await sceneWait(h, 8000));
    expect(arrived.log.map((x) => x.to)).toEqual([1, 0]);
    expect(await places(TERRACE)).toMatchObject({ start: 'door', current: 'door' });
    await stand([-3.6, 1.6, 0.4], [-3.6, 1.1, -1], TERRACE);
    await drawn(h, TERRACE);
    await clickUntil(h, await onScreen(h, TERRACE, 'flat-door'), 'back down to the flat', async () => (await focusedTab(h)).url === url(`${PAGE}#terrace-door`));
    await waitForPage(h, LOFT, await sceneWait(h, 15_000));
    await ready(h, LOFT, await sceneWait(h, 20_000));
    expect(await places()).toMatchObject({ start: 'terrace-door', current: 'terrace-door' });
    expect(near((await view(h, LOFT)).position, [-5.55, 1.6, 0.9])).toBe(true);

    // The booking page, from its panel in the hall: a form that sends nothing.
    await stand([0, 1.6, -1.9], [-1.94, 1.5, -1.68]);
    await drawn(h, LOFT);
    await clickUntil(h, await onScreen(h, LOFT, 0), 'the booking page', async () => (await focusedTab(h)).url === url('harbour-loft/booking.html'));
    await waitForPage(h, 'booking.html');
    const asked = () => [...server.hits.values()].reduce((n, x) => n + x, 0);
    const before = asked();
    await inPage(h, "(document.getElementById('name').value = 'A visitor', document.querySelector('button[type=submit]').click(), true)", 'booking.html');
    await waitFor('the note', () => inPage<boolean>(h, "document.getElementById('sent').hidden", 'booking.html'), (hidden) => hidden === false);
    expect(await inPage<string>(h, "document.getElementById('sent').textContent", 'booking.html')).toBe('This is an example: nothing was sent, and there is no agent behind it.');
    expect(await inPage<string>(h, "document.getElementById('name').value", 'booking.html')).toBe('');
    await sleep(500);
    expect(asked()).toBe(before);
    await pressInShell(h, 'Left', ['alt']);
    await waitFor('back', async () => (await focusedTab(h)).url, (u) => u.startsWith(url(PAGE)));
    await ready(h, LOFT, await sceneWait(h, 20_000));
    // Drawn in software (GitHub's Linux machines), the flat takes about half a minute to load, and each frame seconds.
  }, 480_000);

  it('V9 the whole tour from the keyboard: places, doors, lamps, links, and the Light choice; screen readers name them; the text view; reduced motion', async () => {
    // On from V8, the flat as it was left (loading it again takes half a minute drawn in software): to the hall first.
    expect(await pressButton('Go to: Hall')).toBe(true);
    await waitFor('in the hall', places, (p) => p.current === 'hall');
    await drawn(h, LOFT);
    // Into the page: a click on the hall's floor (nothing to use there).
    const size = await inPage<{ w: number; h: number }>(h, '({ w: innerWidth, h: innerHeight })', LOFT);
    await clickAt(h, await project(h, size.w * 0.5, size.h * 0.93));
    // Tab: the places, the panels, the links, the doors, and the lamps, all before the walls, windows, and furniture (the models prepare.mjs writes).
    const stops: string[] = [];
    for (let i = 0; i < 80 && stops.at(-1) !== 'Desk lamp'; i++) {
      await pressInPage(h, 'Tab', [], LOFT);
      await sleep(60);
      stops.push(await focusedText(h, LOFT));
    }
    const wanted = ['Go to: Hall', 'Go to: Kitchen', 'Go to: By the door to the terrace', 'Book a viewing', 'About this tour', 'Up to the roof terrace', 'Study door', 'Bathroom door', 'Bedroom door', 'Hall light', 'Kitchen lights', 'Bathroom light', 'Living room lamp', 'Bedside lamp, left', 'Bedside lamp, right', 'Desk lamp'];
    for (const s of wanted) expect(stops, `the Tab stops: ${stops.join(' | ')}`).toContain(s);
    const source = await (await fetch(url(PAGE))).text();
    const block = source.slice(source.indexOf('<!-- prepare.mjs: from here'), source.indexOf('<!-- prepare.mjs: to here'));
    const structure = new Set([...block.matchAll(/<model (?:id="([^"]+)" )?src="models\/([^"]+)"/g)].map((m) => `Model: ${m[1] ?? m[2]}`));
    expect(structure.has('Model: wall.glb')).toBe(true);
    expect(stops.filter((s) => structure.has(s))).toEqual([]);
    console.log(`V9: every place, panel, link, door, and lamp within ${stops.length} Tab stops, before the walls and furniture`);

    // "Go to: Kitchen", with Enter.
    for (let i = 0; i < 80 && (await focusedText(h, LOFT)) !== 'Go to: Kitchen'; i++) await pressInPage(h, 'Tab', ['shift'], LOFT);
    await press(h, LOFT, 'Enter');
    await waitFor('in the kitchen', places, (p) => p.current === 'kitchen');
    // A door and a lamp: Enter runs them, Space undoes them.
    await tabTo(h, LOFT, 'Bathroom door');
    await press(h, LOFT, 'Enter');
    await waitFor('the bathroom door open', () => turnOf('bathroom-hinge'), (r) => sameTurn(r, 0));
    await press(h, LOFT, 'Space');
    await waitFor('shut', () => turnOf('bathroom-hinge'), (r) => sameTurn(r, -90));
    await tabTo(h, LOFT, 'Kitchen lights');
    await press(h, LOFT, 'Enter');
    await waitFor('the kitchen lit', () => intensity('kitchen-light'), (v) => Math.abs(v - 1.2) < 1e-6);

    // The Light choice, after the page's outline (where every model is a stop): onward with Tab, and the arrow keys pick the evening.
    let more = 0;
    for (; more < 250 && (await focusedRadio()) === null; more++) await pressInPage(h, 'Tab', [], LOFT);
    expect(await focusedRadio()).toBe('day');
    console.log(`V9: the Light choice after ${more} more Tab stops`);
    await pressInPage(h, 'Right', [], LOFT);
    await waitFor('evening', () => intensity('fill'), (v) => v < 0.1);

    // Screen readers: the places, doors, and lamps are named buttons (a lamp that is on is pressed), the panels' words, the plan, the links, the choice.
    const tree = await axNodes(h, LOFT);
    for (const name of ['Go to: Kitchen', 'Go to: Bedroom', 'Go to: Bathroom', 'Study door', 'Bedroom door', 'Hall light', 'Bedside lamp, left', 'Desk lamp']) {
      expect(tree.some((n) => n.role === 'button' && n.name === name), name).toBe(true);
    }
    expect(tree.find((n) => n.role === 'button' && n.name === 'Kitchen lights')?.pressed).toBe('true');
    expect(tree.some((n) => n.name.includes('The top floor of an old sail loft on the quay'))).toBe(true);
    expect(tree.some((n) => n.role === 'image' && n.name === 'Floor plan of Harbour Loft')).toBe(true);
    expect(tree.some((n) => n.role === 'link' && n.name === 'Up to the roof terrace')).toBe(true);
    expect(tree.some((n) => n.role === 'radio' && n.name === 'Evening')).toBe(true);

    // The text view: the panels' words, the places, the doors and lamps, the links, and the choice.
    await pressInPage(h, 'V', ['control', 'shift'], LOFT);
    await waitFor('the text view', () => holo<boolean>(h, 'window.__holoml.textView', LOFT), (v) => v === true);
    const text = await inPage<string>(h, 'document.body.innerText', LOFT);
    for (const words of ['Harbour Loft, 90 m²', 'Offers over $685,000', 'Bathroom, 12 m²', 'Go to: Kitchen', 'Study door', 'Hall light', 'Book a viewing', 'Up to the roof terrace', 'Light', 'Evening']) {
      expect(text).toContain(words);
    }
    await pressInPage(h, 'V', ['control', 'shift'], LOFT);
    await waitFor('3D again', () => holo<boolean>(h, 'window.__holoml.textView', LOFT), (v) => v === false);

    // Reduced motion: a door goes straight to its end, and the terrace arrives with a cut.
    await reducedMotion(h, true);
    try {
      await waitFor('reduced motion', () => holo<boolean>(h, 'holoml.reducedMotion', LOFT), (v) => v === true);
      await pressButton('Bedroom door');
      expect((await action('bedroom-door')).animations[0]).toMatchObject({ progress: 1, running: false });
      await waitFor('open at once', () => turnOf('bedroom-hinge'), (r) => sameTurn(r, 0), 1000);
      await pressButton('Bedroom door');
      await waitFor('shut at once', () => turnOf('bedroom-hinge'), (r) => sameTurn(r, 90), 1000);
      await inPage(h, "([...document.querySelectorAll('#holoml-outline a')].find((a) => a.textContent === 'Up to the roof terrace').click(), true)", LOFT);
      await waitForPage(h, TERRACE, await sceneWait(h, 15_000));
      await ready(h, TERRACE, await sceneWait(h, 20_000));
      expect(await fade(TERRACE)).toEqual({ opacity: 0, arriving: false, log: [] });
    } finally {
      await reducedMotion(h, false);
    }
  }, 300_000);

  it('V10 an idle flat draws no frames: by day, in the evening with every lamp on and every door open, and with reduced motion', async () => {
    await openPage(h, PAGE);
    await inPage(h, `(document.querySelector('[data-id="time"] input[value="day"]').click(), true)`, LOFT);
    await drawn(h, LOFT);
    const idle = async (what: string) => {
      await sleep(1000);
      const f0 = await frames();
      await sleep(2000);
      expect(await frames(), what).toBe(f0);
    };
    await idle('by day');
    await inPage(h, `(document.querySelector('[data-id="time"] input[value="evening"]').click(), true)`, LOFT);
    for (const [, label] of LAMPS) expect(await pressButton(label)).toBe(true);
    for (const [, , label] of DOORS) expect(await pressButton(label)).toBe(true);
    await drawn(h, LOFT);
    await idle('in the evening, lit, the doors open');
    await reducedMotion(h, true);
    try {
      await drawn(h, LOFT);
      await idle('with reduced motion');
    } finally {
      await reducedMotion(h, false);
    }
  }, 240_000);
});
