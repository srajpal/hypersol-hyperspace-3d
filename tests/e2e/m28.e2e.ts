/**
 * Milestone 28 end-to-end checks LT1 to LT9 (TODO.md): lifting pictures
 * and 3D models from web pages into the room. The pure parts are unit
 * tests beside the code (shared/lift.test.ts, shared/lifted-shape.test.ts,
 * main/lift.test.ts, main/context-menu.test.ts); these drive the app: the
 * right-click menu, the top bar's Lift button and its shortcut, the
 * objects in the room, and the states that change them. The fixture pages
 * are in tests/fixtures/lift (their pictures and models made by make.mjs).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  caughtUp,
  clickUntil,
  cycleToTab,
  describeMissedClick,
  focusedTab,
  launch,
  mainLog,
  navigateTo,
  newProfile,
  pressInShell,
  project,
  sceneWait,
  screenPointOf,
  settled,
  shellCall,
  sleep,
  tabs,
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

const LIFT = 'hs-toolbar [data-testid="lift"]';
const ENTRY = 'Lift into the room';

const lifted = (h: Harness) => shellCall(h, 'lifted');
type Lifted = Awaited<ReturnType<typeof lifted>>;
type Obj = Lifted['objects'][number];

/** Every object of the tab in front come and still (a model's shape arrived, nothing rising or moving). */
function still(h: Harness, what: string, count: number, timeoutMs = 40_000): Promise<Lifted> {
  return waitFor(
    `${what}: ${count} lifted and still`,
    () => lifted(h),
    (l) => l.objects.length === count && l.objects.every((o) => o.state === 'ready' && !o.moving && o.box !== null),
    timeoutMs,
  );
}

const byName = (l: Lifted, name: string): Obj => {
  const o = l.objects.find((x) => x.name === name);
  if (!o) throw new Error(`No lifted object named "${name}": ${l.objects.map((x) => x.name).join(', ')}`);
  return o;
};

const centre = (b: { x: number; y: number; width: number; height: number }): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

const notice = (h: Harness) => shellCall(h, 'notice');

/** Right-clicks an element of the page and returns the menu's labels (as m2.e2e.ts does). */
async function rightClick(h: Harness, selector: string, page: string): Promise<string[]> {
  const menus = () => h.app.evaluate(() => globalThis.__hypersolTest!.menus.map((m) => m.labels));
  const count = (await menus()).length;
  await settled(h);
  const p = await screenPointOf(h, selector, page);
  const opened = async () => (await menus()).length > count;
  await clickUntil(h, p, 'a right-click menu', opened, { button: 'right' }, () => describeMissedClick(h, p, opened, 'right'));
  const all = await menus();
  return all[all.length - 1]!;
}

function choose(h: Harness, label: string): Promise<void> {
  return h.app.evaluate((_electron, label) => {
    const log = globalThis.__hypersolTest!;
    log.menus[log.menus.length - 1]!.run(label);
  }, label);
}

/** Where an element of the page is drawn on screen: the box round its four corners. */
async function screenBox(h: Harness, selector: string, page: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const r = await h.app.evaluate(
    async ({ webContents }, [selector, page]) => {
      const w = webContents.getAllWebContents().find((c) => c.getType() === 'webview' && c.getURL().includes(page))!;
      return (await w.executeJavaScript(
        `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`,
      )) as { x: number; y: number; width: number; height: number };
    },
    [selector, page] as [string, string],
  );
  const corners = await Promise.all([project(h, r.x, r.y), project(h, r.x + r.width, r.y), project(h, r.x, r.y + r.height), project(h, r.x + r.width, r.y + r.height)]);
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/** The colours of quadrants.png, top left, top right, bottom left, bottom right (tests/fixtures/lift/make.mjs). */
const QUADRANTS = { topLeft: [230, 30, 30], topRight: [30, 200, 60], bottomLeft: [40, 60, 230], bottomRight: [240, 220, 30] };
type Quarter = keyof typeof QUADRANTS;
const near = (a: number[], b: number[], by = 14) => a.every((v, i) => Math.abs(v - b[i]!) <= by);

describe('LT1: finding what can be lifted', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('lift/pictures.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    await waitForPage(h, 'lift/pictures');
  });
  afterAll(async () => h?.close());

  it('pictures, a drawing, and a video in view are found, with their names; one far below the view is not', async () => {
    const items = await waitFor('the page answers', () => shellCall(h, 'liftable'), (i) => i.length >= 4);
    expect(items.map((i) => `${i.kind}:${i.name}`)).toEqual(['img:Four coloured quarters', 'canvas:Green drawing', 'video:Magenta clip', 'img:Too small']);
    expect(items.every((i) => i.src === '' && i.rect.width > 0 && i.rect.height > 0)).toBe(true);
    // What is at one point: the picture there, and nothing over text.
    const quad = items[0]!;
    const at = await shellCall(h, 'liftable', { x: quad.rect.x + 10, y: quad.rect.y + 10 });
    expect(at.map((i) => i.id)).toEqual([quad.id]);
    expect(await shellCall(h, 'liftable', { x: 400, y: 400 })).toEqual([]);
  });

  it('models: a <model-viewer> element, a <model> element, and links to .glb and .gltf files; a link to another kind of file is not one', async () => {
    await navigateTo(h, server.url('lift/models.html'));
    await waitForPage(h, 'lift/models');
    const items = await waitFor('the page answers', () => shellCall(h, 'liftable'), (i) => i.length > 0);
    expect(items.every((i) => i.kind === 'model')).toBe(true);
    expect(items.map((i) => i.name)).toEqual([
      'Orange and teal square',
      'Meshopt box',
      'Blockworld gem',
      'Draco box',
      'KTX2 box',
      'Square with an outside picture',
      'Too many triangles',
      'Too large',
      'Broken model',
      'On another site',
    ]);
    const src = Object.fromEntries(items.map((i) => [i.name, i.src]));
    expect(src['Orange and teal square']).toBe(server.url('lift/square.gltf'));
    expect(src['Meshopt box']).toBe(server.url('holoml/compressed/meshopt-box.glb'));
    expect(src['On another site']).toMatch(/^http:\/\/localhost:\d+\/holoml\/blockworld\/models\/gem\.gltf$/);
    // The picture report has the models too (milestone 5's, used by nothing else yet).
    const report = await waitFor('the picture report', () => shellCall(h, 'layers'), (l) => l.images.some((i) => i.kind === 'model'));
    expect(report.images.filter((i) => i.kind === 'model').map((i) => i.alt)).toContain('Meshopt box');
  });
});

describe('LT2: lifting a picture from the right-click menu', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('lift/pictures.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    await waitForPage(h, 'lift/pictures');
  });
  afterAll(async () => h?.close());

  it('offers "Lift into the room" on a picture, not on text', async () => {
    expect(await rightClick(h, 'p', 'lift/pictures')).not.toContain(ENTRY);
    expect(await rightClick(h, '#quadrants', 'lift/pictures')).toContain(ENTRY);
  });

  it("the picture rises from where it was into the arc, with the page's own pixels, and nothing is fetched", async () => {
    const was = await screenBox(h, '#quadrants', 'lift/pictures');
    const hits = server.hits.get('/lift/quadrants.png') ?? 0;
    const requests = (await mainLog(h, 'requests')).length;
    await choose(h, ENTRY);
    const l = await still(h, 'the picture', 1);
    const o = byName(l, 'Four coloured quarters');
    expect(o.kind).toBe('img');
    // It rose from the picture's place: it was first drawn over it, as large.
    const first = o.firstBox!;
    expect(Math.abs(centre(first).x - centre(was).x), JSON.stringify({ first, was })).toBeLessThan(24);
    expect(Math.abs(centre(first).y - centre(was).y), JSON.stringify({ first, was })).toBeLessThan(24);
    expect(first.width / was.width).toBeGreaterThan(0.85);
    expect(first.width / was.width).toBeLessThan(1.3);
    // And stands on the right of the page, which made room for the arc.
    expect(l.rail).toBe(true);
    const quad = await shellCall(h, 'panelQuad');
    expect(o.box!.x).toBeGreaterThan(Math.max(quad[1]!.x, quad[2]!.x));
    // The page's own pixels, the right way up.
    const pic = (await shellCall(h, 'liftedPicture', o.tabId, o.itemId))!;
    for (const [where, colour] of Object.entries(QUADRANTS)) {
      expect(near(pic[where as Quarter], colour), `${where}: ${JSON.stringify(pic[where as Quarter])}`).toBe(true);
    }
    // Captured, not fetched: the picture was not asked for again, and no request was made.
    expect(server.hits.get('/lift/quadrants.png') ?? 0).toBe(hits);
    expect((await mainLog(h, 'requests')).slice(requests)).toEqual([]);
    const captures = (await mainLog(h, 'lifts')).filter((x) => x.kind === 'capture');
    expect(captures).toHaveLength(1);
    expect(captures[0]!.result).toBe('ok');
    expect((await notice(h))?.text).toBe('Lifted into the room: Four coloured quarters.');
  });

  it('a picture already lifted, or too small, is not lifted again, and the notice says why', async () => {
    await rightClick(h, '#quadrants', 'lift/pictures');
    await choose(h, ENTRY);
    await waitFor('the notice', () => notice(h), (n) => n?.text === 'Already in the room: Four coloured quarters.');
    await rightClick(h, '#tiny', 'lift/pictures');
    await choose(h, ENTRY);
    await waitFor('the notice', () => notice(h), (n) => n?.text === 'Too small to lift: a picture must show at least 48 pixels each way.');
    expect((await lifted(h)).objects).toHaveLength(1);
  });

  it("a drawing and a video lift as they are now: the drawing's green, the video's current frame", async () => {
    await rightClick(h, '#drawing', 'lift/pictures');
    await choose(h, ENTRY);
    await rightClick(h, '#clip', 'lift/pictures');
    await choose(h, ENTRY);
    const l = await still(h, 'the drawing and the video', 3);
    const d = byName(l, 'Green drawing');
    const v = byName(l, 'Magenta clip');
    const drawing = (await shellCall(h, 'liftedPicture', d.tabId, d.itemId))!;
    const video = (await shellCall(h, 'liftedPicture', v.tabId, v.itemId))!;
    expect(near(drawing.middle, [32, 192, 64]), JSON.stringify(drawing.middle)).toBe(true);
    expect(near(video.middle, [224, 32, 224]), JSON.stringify(video.middle)).toBe(true);
    expect(v.kind).toBe('video');
  });
});

describe('LT3: lifting everything in view', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('lift/pictures.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    await waitForPage(h, 'lift/pictures');
  });
  afterAll(async () => h?.close());

  it("the button lifts every picture in view of at least 48 pixels a side, in the page's order down the arc", async () => {
    await h.shell.click(LIFT);
    const l = await still(h, 'everything in view', 3);
    expect(l.objects.map((o) => o.name)).toEqual(['Four coloured quarters', 'Green drawing', 'Magenta clip']);
    const ys = l.objects.map((o) => o.box!.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect((await notice(h))?.text).toBe('Lifted into the room: 3 things.');
    // Again: nothing more in view to lift.
    await h.shell.click(LIFT);
    await waitFor('the notice', () => notice(h), (n) => n?.text === 'Nothing more in view to lift: pictures at least 48 pixels each way, and 3D models.');
  });

  it('up to 12 from a page, by the button and by the shortcut; again with more in view, still 12', async () => {
    await navigateTo(h, server.url('lift/many.html'));
    await waitForPage(h, 'lift/many');
    await waitFor("the last page's objects gone", () => lifted(h), (l) => l.objects.length === 0);
    await h.shell.click(LIFT);
    const l = await still(h, 'the most from a page', 12);
    expect(l.objects.map((o) => o.name)).toEqual(Array.from({ length: 12 }, (_, i) => `Square ${i + 1}`));
    await h.shell.click(LIFT);
    await waitFor('the notice', () => notice(h), (n) => n?.text === 'Up to 12 things can be lifted from a page: put one back first.');
    expect((await lifted(h)).objects).toHaveLength(12);
    // One put back: the shortcut lifts one more, that one again (the first in view not lifted), at the end of the
    // arc, and no more.
    await h.shell.locator('[data-testid="lifted-object"]').first().focus();
    await h.shell.keyboard.press('Delete');
    const fewer = await still(h, 'one put back', 11);
    expect(fewer.objects.map((o) => o.name)).not.toContain('Square 1');
    await pressInShell(h, 'U', ['control', 'shift']);
    const again = await still(h, 'the shortcut', 12);
    expect(again.objects.map((o) => o.name)).toEqual([...Array.from({ length: 11 }, (_, i) => `Square ${i + 2}`), 'Square 1']);
  });
});

describe('LT4 and LT5: lifting models, and the decoding frame', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('lift/models.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    await waitForPage(h, 'lift/models');
  });
  afterAll(async () => h?.close());

  it("a model from the right-click menu: its file and the files it names come from the page's own site, through its session and the shield", async () => {
    const requests = (await mainLog(h, 'requests')).length;
    expect(await rightClick(h, '#embedded', 'lift/models')).toContain(ENTRY);
    await choose(h, ENTRY);
    const l = await still(h, 'the square', 1);
    const o = byName(l, 'Orange and teal square');
    expect(o.kind).toBe('model');
    expect(o.shape).toEqual({ meshes: 1, triangles: 2, pictures: 1 });
    // Asked for in the page's own session (the shield sees every request there), all from its own site. (The
    // decoding frame's own files come from the viewer's address, in the shell's session.)
    const asked = (await mainLog(h, 'requests')).slice(requests).filter((u) => /^https?:/.test(u));
    for (const file of ['lift/square.gltf', 'lift/square.bin', 'lift/square.png']) expect(asked).toContain(server.url(file));
    expect(asked.filter((u) => !u.startsWith(server.base))).toEqual([]);
    // The frame that decoded it is gone.
    expect(await h.shell.locator('[data-testid="lift-decoder"]').count()).toBe(0);
  });

  it('the button lifts every model in view; one over a limit, one that cannot be read, and one on another site are refused, and the notice says why', async () => {
    await h.shell.click(LIFT);
    const l = await still(h, 'the models', 6);
    expect(l.objects.map((o) => o.name)).toEqual(['Orange and teal square', 'Meshopt box', 'Blockworld gem', 'Draco box', 'KTX2 box', 'Square with an outside picture']);
    // Compressed models, with the viewer's own decoders: Draco, meshopt, and a KTX2 picture.
    for (const name of ['Meshopt box', 'Draco box', 'KTX2 box', 'Blockworld gem']) expect(byName(l, name).shape!.meshes, name).toBeGreaterThan(0);
    expect(byName(l, 'KTX2 box').shape!.pictures).toBe(1);
    const text = (await waitFor('the notice', () => notice(h), (n) => n?.text.startsWith('Could not lift 4 models') === true))!.text;
    expect(text).toContain('Too many triangles (it has more than 2,000,000 triangles)');
    expect(text).toContain('Too large (a file it names (zeros.bin?bytes=41943040) is larger than 32 MB)');
    expect(text).toContain('Broken model (it could not be read as a glTF model)');
    expect(text).toContain("On another site (it is not on this page's own site)");
    // The model on another site was never asked for; nor the files of the one with too many triangles.
    const asked = await mainLog(h, 'requests');
    expect(asked.some((u) => u.startsWith('http://localhost:'))).toBe(false);
    expect(asked.some((u) => u.includes('zeros.bin?bytes=') && !u.includes('41943040'))).toBe(false);
  });

  it('LT5 a picture its file names on another site is not fetched, and the frame, which can reach no network, shows the model without it', async () => {
    const l = await lifted(h);
    expect(byName(l, 'Square with an outside picture').shape).toEqual({ meshes: 1, triangles: 2, pictures: 0 });
    expect((await mainLog(h, 'requests')).some((u) => u.includes('outside.test'))).toBe(false);
    // The frame's own content policy: nothing from the network, only the viewer's files and what it makes.
    const policy = await h.app.evaluate(async ({ session }) => {
      const res = await session.defaultSession.fetch('hypersol-viewer://app/lift-host.html');
      return res.headers.get('content-security-policy') ?? '';
    });
    expect(policy).toContain("default-src 'none'");
    expect(policy).toMatch(/connect-src hypersol-viewer: blob: data:(;|$)/);
    expect(policy).toMatch(/img-src blob: data:(;|$)/);
    // No frame is left once the models have come.
    expect(await h.shell.evaluate(() => document.querySelectorAll('iframe').length)).toBe(0);
  });
});

describe('LT6: looking at them', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('lift/pictures.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    await waitForPage(h, 'lift/pictures');
    await h.shell.click(LIFT);
    await still(h, 'lifted', 3);
  });
  afterAll(async () => h?.close());

  const objectOf = (o: Obj) => h.shell.locator(`[data-testid="lifted"][data-item="${o.itemId}"]`);

  it('hovering an object shows its name; a drag turns it', async () => {
    const o = byName(await lifted(h), 'Four coloured quarters');
    const c = centre(o.box!);
    await h.shell.mouse.move(c.x, c.y);
    const label = objectOf(o).locator('[data-testid="lifted-name"]');
    await waitFor('its name shown', () => label.evaluate((e) => getComputedStyle(e).visibility), (v) => v === 'visible');
    expect(await label.textContent()).toBe('Four coloured quarters');
    await h.shell.mouse.down();
    await h.shell.mouse.move(c.x + 100, c.y, { steps: 10 });
    await h.shell.mouse.up();
    const turned = await waitFor('turned', () => lifted(h), (l) => byName(l, 'Four coloured quarters').spin.yaw > 30);
    expect(byName(turned, 'Four coloured quarters').near).toBe(false);
  });

  it('a click brings it nearer, larger, in front of the page; a click again sends it back', async () => {
    const before = byName(await lifted(h), 'Green drawing');
    await h.shell.mouse.click(centre(before.box!).x, centre(before.box!).y);
    const nearer = byName(await still(h, 'nearer', 3), 'Green drawing');
    expect(nearer.near).toBe(true);
    expect(nearer.box!.width).toBeGreaterThan(before.box!.width * 2);
    expect(await objectOf(nearer).locator('[data-testid="lifted-object"]').getAttribute('aria-pressed')).toBe('true');
    await h.shell.mouse.click(centre(nearer.box!).x, centre(nearer.box!).y);
    const back = byName(await still(h, 'back in the arc', 3), 'Green drawing');
    expect(back.near).toBe(false);
    expect(Math.abs(back.box!.x - before.box!.x)).toBeLessThan(4);
  });

  it('the free camera reaches them: they stay in the room as it moves', async () => {
    const before = byName(await lifted(h), 'Magenta clip').box!;
    await pressInShell(h, 'K', ['control', 'shift']);
    await pressInShell(h, 'Left');
    await pressInShell(h, 'Left');
    const moved = await waitFor('seen from elsewhere', () => lifted(h), (l) => Math.abs(byName(l, 'Magenta clip').box!.x - before.x) > 20);
    expect(byName(moved, 'Magenta clip').box!.width).toBeGreaterThan(0);
    await pressInShell(h, 'Escape');
    await waitFor('back at the desk', () => lifted(h), (l) => Math.abs(byName(l, 'Magenta clip').box!.x - before.x) < 3);
  });

  it('its close button puts it back into the page, and says so', async () => {
    const o = byName(await lifted(h), 'Four coloured quarters');
    await h.shell.mouse.move(centre(o.box!).x, centre(o.box!).y);
    const close = objectOf(o).locator('[data-testid="lifted-close"]');
    await waitFor('the close button shown', () => close.evaluate((e) => getComputedStyle(e).visibility), (v) => v === 'visible');
    await close.click();
    const l = await still(h, 'put back', 2);
    expect(l.objects.map((x) => x.name)).toEqual(['Green drawing', 'Magenta clip']);
    expect(await h.shell.locator('[data-testid="lifted-said"]').textContent()).toBe('Put back into the page: Four coloured quarters');
    // It can be lifted again.
    await h.shell.click(LIFT);
    await still(h, 'lifted again', 3);
  });
});

describe('LT6: the room around them', () => {
  it('the room holds still while the pointer is on an object, as it does over the page; their frames change with the theme', async () => {
    // The parallax on (the default), so the room follows the pointer elsewhere.
    const h = await launch(server.url('lift/pictures.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'lift/pictures');
      await h.shell.click(LIFT);
      const l = await still(h, 'lifted', 3);
      const o = byName(l, 'Green drawing');
      const height = await h.shell.evaluate(() => window.innerHeight);
      // Over the room: the parallax follows.
      await h.shell.mouse.move(20, height - 20, { steps: 4 });
      await waitFor('the parallax follows the pointer', () => shellCall(h, 'parallaxPaused'), (p) => p === false);
      // On the object: it holds, and the object stays under the pointer.
      await h.shell.mouse.move(centre(o.box!).x, centre(o.box!).y, { steps: 6 });
      await waitFor('the parallax paused', () => shellCall(h, 'parallaxPaused'), (p) => p === true);
      const at = byName(await still(h, 'held', 3), 'Green drawing').box!;
      await h.shell.mouse.move(centre(at).x + 6, centre(at).y + 4, { steps: 3 });
      expect(byName(await still(h, 'held', 3), 'Green drawing').box).toEqual(at);
      // The theme: the frames take the new desk colour, as the room's own desk does.
      expect(o.colour).toBe((await shellCall(h, 'sceneColors')).desk);
      await h.shell.click('hs-theme-button [data-testid="theme"]');
      const desk = await waitFor('the other theme', () => shellCall(h, 'sceneColors'), (c) => c.desk !== o.colour);
      await waitFor('the frames recoloured', () => lifted(h), (x) => x.objects.every((y) => y.colour === desk.desk));
    } finally {
      await h.close();
    }
  });
});

describe('LT7: their life', () => {
  it('they wait while another tab is in front, and go when the page navigates or the tab closes', async () => {
    const h = await launch(server.url('lift/pictures.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    try {
      await waitForPage(h, 'lift/pictures');
      const first = (await focusedTab(h)).id;
      await h.shell.click(LIFT);
      await still(h, 'lifted', 3);
      // Another tab in front: they wait, unseen, and the arc gives its room back.
      await pressInShell(h, 'T', ['control']);
      await navigateTo(h, server.url('lift/many.html'));
      await waitForPage(h, 'lift/many');
      let l = await waitFor('the arc gone', () => lifted(h), (x) => !x.rail);
      expect(l.objects.filter((o) => o.tabId === first)).toHaveLength(3);
      expect(await h.shell.locator('[data-testid="lifted"]:not([hidden])').count()).toBe(0);
      // Lifting in this tab, then back to the first: each tab shows its own.
      await h.shell.click(LIFT);
      await waitFor("this tab's", () => lifted(h), (x) => x.objects.filter((o) => o.tabId !== first && o.state === 'ready').length === 12);
      const second = (await focusedTab(h)).id;
      await cycleToTab(h, first);
      l = await waitFor("the first tab's again", () => lifted(h), (x) => x.rail && x.objects.filter((o) => o.tabId === first).every((o) => o.box !== null && !o.moving));
      expect(await h.shell.locator('[data-testid="lifted"]:not([hidden])').count()).toBe(3);
      // The second tab closes: its objects go.
      await cycleToTab(h, second);
      await pressInShell(h, 'W', ['control']);
      await waitFor("the closed tab's gone", () => lifted(h), (x) => x.objects.every((o) => o.tabId === first));
      // A page that goes to another address takes them with it.
      await navigateTo(h, server.url('lift/models.html'));
      await waitForPage(h, 'lift/models');
      await waitFor('gone with the page', () => lifted(h), (x) => x.objects.length === 0 && !x.rail);
    } finally {
      await h.close();
    }
  });

  it('a tab that sleeps: its page closes, and what was lifted from it goes', async () => {
    // A "minute" of 100 ms: five minutes is half a second here (as L7 does).
    const h = await launch(server.url('lift/pictures.html'), {
      userDataDir: newProfile({ parallax: 'off', tabSleep: 5, economy: 'off' }),
      sleepMinuteMs: 100,
    });
    try {
      await waitForPage(h, 'lift/pictures');
      await h.shell.click(LIFT);
      await still(h, 'lifted', 3);
      const sleeper = (await focusedTab(h)).id;
      await pressInShell(h, 'T', ['control']);
      await sleep(1000);
      await shellCall(h, 'sleepNow');
      await waitFor('asleep', () => tabs(h), (t) => t.find((x) => x.id === sleeper)?.asleep === true);
      await waitFor('gone with its sleep', () => lifted(h), (x) => x.objects.length === 0);
    } finally {
      await h.close();
    }
  });

  it("a private tab's go with it; nothing lifted is saved: after a restart there is none, and no captured picture is in the profile", async () => {
    const profile = newProfile({ parallax: 'off', onStartup: 'last-tabs' });
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
    let h = await launch(server.url('lift/pictures.html'), { userDataDir: profile });
    let picture = '';
    try {
      await waitForPage(h, 'lift/pictures');
      await h.shell.click(LIFT);
      const l = await still(h, 'lifted', 3);
      const quad = byName(l, 'Four coloured quarters');
      picture = (await shellCall(h, 'liftedPicture', quad.tabId, quad.itemId))!.url;
      // A private tab lifts as any other; closed, its objects go with it.
      await pressInShell(h, 'N', ['control', 'shift']);
      await navigateTo(h, server.url('lift/many.html'));
      await waitForPage(h, 'lift/many');
      const privateTab = await focusedTab(h);
      expect(privateTab.private).toBe(true);
      await h.shell.click(LIFT);
      await waitFor("the private tab's", () => lifted(h), (x) => x.objects.filter((o) => o.tabId === privateTab.id && o.state === 'ready').length === 12);
      await pressInShell(h, 'W', ['control']);
      await waitFor('gone with the private tab', () => lifted(h), (x) => x.objects.every((o) => o.tabId !== privateTab.id));
    } finally {
      await h.close();
    }
    // The captured pixels are in no file of the profile: a run of the picture's compressed data.
    const png = Buffer.from(picture.split(',')[1]!, 'base64');
    const at = png.indexOf('IDAT') + 4;
    const body = png.subarray(at, at + 64);
    expect(body.length).toBe(64);
    for (const file of files(profile)) {
      if (statSync(file).size > 64 * 1024 * 1024) continue;
      expect(readFileSync(file).includes(body), file).toBe(false);
    }
    h = await launch('', { userDataDir: profile });
    try {
      await waitForPage(h, 'lift/pictures');
      await caughtUp(h, 'lift/pictures');
      expect((await lifted(h)).objects).toEqual([]);
    } finally {
      await h.close();
    }
  });
});

describe('LT8: other states', () => {
  // A HoloML scene has no right-click menu (its orbit controls take the right button), so its menu offers nothing.
  it('not on a HoloML page: the button is unavailable and says why, and so does the shortcut', async () => {
    const h = await launch(server.url('holoml/still.holoml'), { userDataDir: newProfile({ parallax: 'off' }) });
    try {
      await waitForPage(h, 'still.holoml', await sceneWait(h, 15_000));
      await waitFor('the scene fills the window', () => shellCall(h, 'holoml'), (s) => s.fill);
      expect(await h.shell.locator(LIFT).isDisabled()).toBe(true);
      expect(await h.shell.locator(LIFT).getAttribute('title')).toBe('Lift into the room: not on HoloML pages: the scene is 3D already');
      await pressInShell(h, 'U', ['control', 'shift']);
      await waitFor('the notice', () => notice(h), (n) => n?.text === 'Nothing can be lifted: not on HoloML pages: the scene is 3D already.');
      expect((await lifted(h)).objects).toEqual([]);
    } finally {
      await h.close();
    }
  });

  it("without WebGL 2 the button is unavailable and says why; the menu's entry says so too", async () => {
    const h = await launch(server.url('lift/pictures.html'), { noWebGL: true });
    try {
      await waitForPage(h, 'lift/pictures');
      expect(await h.shell.locator(LIFT).isDisabled()).toBe(true);
      expect(await h.shell.locator(LIFT).getAttribute('title')).toBe("Lift into the room: this computer can't draw the 3D room");
      await rightClick(h, '#quadrants', 'lift/pictures');
      await choose(h, ENTRY);
      await waitFor('the notice', () => notice(h), (n) => n?.text === "It cannot be lifted: this computer can't draw the 3D room.");
      expect((await lifted(h)).objects).toEqual([]);
    } finally {
      await h.close();
    }
  });

  it('reduced motion: objects appear in their places without rising, and come nearer without moving', async () => {
    const h = await launch(server.url('lift/pictures.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    try {
      await waitForPage(h, 'lift/pictures');
      await h.shell.emulateMedia({ reducedMotion: 'reduce' });
      await h.shell.click(LIFT);
      const l = await still(h, 'lifted', 3);
      for (const o of l.objects) expect(o.firstBox, o.name).toEqual(o.box);
      const o = l.objects[0]!;
      await h.shell.locator(`[data-testid="lifted"][data-item="${o.itemId}"] [data-testid="lifted-object"]`).focus();
      await h.shell.keyboard.press('Enter');
      const nearer = await waitFor('nearer', () => lifted(h), (x) => x.objects[0]!.near);
      expect(nearer.objects[0]!.moving).toBe(false);
    } finally {
      await h.close();
    }
  });

  it("economy mode, and the layers view off: lifting works, with the page's pixels", async () => {
    const h = await launch(server.url('lift/pictures.html'), { userDataDir: newProfile({ parallax: 'off', economy: 'on' }) });
    try {
      await waitForPage(h, 'lift/pictures');
      await waitFor('economy mode', () => shellCall(h, 'economy'), (e) => e.on);
      // The layers view is on by default (every check above lifted with it on): off here.
      await pressInShell(h, 'L', ['control', 'shift']);
      await waitFor('the layers view off', () => shellCall(h, 'layers'), (x) => x.on === false);
      await h.shell.click(LIFT);
      const l = await still(h, 'lifted', 3);
      const quad = byName(l, 'Four coloured quarters');
      const pic = (await shellCall(h, 'liftedPicture', quad.tabId, quad.itemId))!;
      for (const [where, colour] of Object.entries(QUADRANTS)) expect(near(pic[where as Quarter], colour), where).toBe(true);
    } finally {
      await h.close();
    }
  });
});

describe('LT9: the keyboard and screen readers', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('lift/pictures.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    await waitForPage(h, 'lift/pictures');
  });
  afterAll(async () => h?.close());

  it('the button has a name; the shortcut lifts, and the notice says what', async () => {
    expect(await h.shell.locator(LIFT).getAttribute('aria-label')).toBe('Lift into the room');
    expect(await h.shell.locator(LIFT).getAttribute('title')).toMatch(/^Lift the pictures and 3D models in view into the room \((Ctrl|⌘)\+Shift\+U\)$/);
    await pressInShell(h, 'U', ['control', 'shift']);
    await still(h, 'lifted', 3);
    expect((await notice(h))?.text).toBe('Lifted into the room: 3 things.');
  });

  it('each object is a button named for what it is, reached with Tab; Enter brings it nearer, the arrows turn it, Escape sends it back, Delete puts it back', async () => {
    for (const name of ['Four coloured quarters, lifted picture', 'Green drawing, lifted picture', 'Magenta clip, lifted still of a video']) {
      expect(await h.shell.getByRole('button', { name, exact: true }).count(), name).toBe(1);
    }
    // Backwards from the top bar's first control: the objects come just before it.
    await h.shell.locator('hs-toolbar [data-testid="new-tab"]').focus();
    let reached = '';
    for (let i = 0; i < 12 && !reached.startsWith('Magenta clip'); i++) {
      await h.shell.keyboard.press('Shift+Tab');
      reached = await h.shell.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
    }
    expect(reached).toBe('Magenta clip, lifted still of a video');
    await h.shell.keyboard.press('Enter');
    await waitFor('nearer', () => lifted(h), (x) => byName(x, 'Magenta clip').near);
    await h.shell.keyboard.press('ArrowRight');
    await waitFor('turned', () => lifted(h), (x) => byName(x, 'Magenta clip').spin.yaw === 15);
    await h.shell.keyboard.press('Escape');
    const l = await waitFor('sent back', () => lifted(h), (x) => !byName(x, 'Magenta clip').near);
    expect(byName(l, 'Magenta clip').spin.yaw).toBe(15);
    await h.shell.keyboard.press('Delete');
    await still(h, 'put back', 2);
    expect(await h.shell.locator('[data-testid="lifted-said"]').textContent()).toBe('Put back into the page: Magenta clip');
  });
});
