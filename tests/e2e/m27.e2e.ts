/**
 * Milestone 27 end-to-end checks FC1 to FC9 (TODO.md): looking around the
 * room. The camera's movement and its limits are unit tested in
 * packages/scene-core (free-camera.test.ts); these drive the app: the top
 * bar's button, the shortcut, a drag on the room, the keys, the page and
 * the cards while the camera is away, and the states that change it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  caughtUp,
  clickAt,
  inPage,
  launch,
  navigateTo,
  newProfile,
  pageCentre,
  pressInShell,
  project,
  roomStill,
  screenPointOf,
  sceneWait,
  shellCall,
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

const BUTTON = 'hs-toolbar [data-testid="look-around"]';
const NOTICE = 'hs-look-notice [data-testid="look-notice"]';
const BACK = 'hs-look-notice [data-testid="look-back"]';
const DEG = Math.PI / 180;

const look = (h: Harness) => shellCall(h, 'look');
type Look = Awaited<ReturnType<typeof look>>;

/** Looking around, with the notice up. */
const away = (h: Harness) => waitFor('looking around', () => look(h), (l) => l.away && l.noticeShown);
/** Back at the desk: the camera home and the notice gone. */
const home = (h: Harness) => waitFor('back at the desk', () => look(h), (l) => !l.active && !l.noticeShown);
/**
 * The camera has arrived where it was going, once what was asked for has
 * taken effect: a key sent to the window is handled a moment later, so
 * "not moving" alone could be read before it.
 */
const arrived = (h: Harness, what: string, taken: (l: Look) => boolean) =>
  waitFor(`the camera arrived: ${what}`, () => look(h), (l) => taken(l) && !l.moving);

/** A point over the room, clearly outside the page (bottom left; one tab, so no rail). */
async function roomPoint(h: Harness): Promise<Point> {
  const height = await h.shell.evaluate(() => window.innerHeight);
  return { x: 16, y: height - 16 };
}

/** Drags on the room from a point by (dx, dy), in steps. */
async function drag(h: Harness, from: Point, dx: number, dy: number, steps = 10): Promise<void> {
  await h.shell.mouse.move(from.x, from.y);
  await h.shell.mouse.down();
  await h.shell.mouse.move(from.x + dx, from.y + dy, { steps });
  await h.shell.mouse.up();
}

const quadKey = (q: Point[]) => q.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

const GRID_IDS = ['top-left', 'top', 'top-right', 'left', 'centre', 'right', 'bottom-left', 'bottom', 'bottom-right'];

/** Clicks every grid button where it shows (C2's way); each must land on its button. */
async function clickGrid(h: Harness): Promise<void> {
  await inPage(h, 'window.__fixture.clicks = []', 'click-grid');
  for (const id of GRID_IDS) {
    const centre = await pageCentre(h, `#${id}`, 'click-grid');
    await clickAt(h, await project(h, centre.x, centre.y));
    const n = GRID_IDS.indexOf(id) + 1;
    await waitFor(`the click on ${id}`, () => inPage<number>(h, 'window.__fixture.clicks.length', 'click-grid'), (c) => c >= n, 5000);
  }
  const clicks = await inPage<{ id: string }[]>(h, 'window.__fixture.clicks', 'click-grid');
  expect(clicks.map((c) => c.id)).toEqual(GRID_IDS);
}

describe('FC1: entering and leaving', () => {
  let h: Harness;
  beforeAll(async () => {
    // The parallax off, so the desk camera stays put however the pointer moves: the page's outline can be compared exactly.
    h = await launch(server.url('click-grid.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    await waitForPage(h, 'click-grid');
  });
  afterAll(async () => h?.close());

  it('the button, the shortcut, and a drag on the room start it; Escape, Home, the button, and the notice end it; the desk is exactly as before', async () => {
    const desk = quadKey(await shellCall(h, 'panelQuad'));
    expect((await look(h)).can).toBe(true);
    expect(await h.shell.locator(BUTTON).getAttribute('aria-pressed')).toBe('false');

    const ways: { start: string; end: string; enter: () => Promise<void>; leave: () => Promise<void> }[] = [
      { start: 'the button', end: 'Escape', enter: () => h.shell.click(BUTTON), leave: () => pressInShell(h, 'Escape') },
      { start: 'the shortcut', end: 'Home', enter: () => pressInShell(h, 'K', ['control', 'shift']), leave: () => pressInShell(h, 'Home') },
      { start: 'a drag on the room', end: 'the button', enter: async () => drag(h, await roomPoint(h), 120, -40), leave: () => h.shell.click(BUTTON) },
      { start: 'the shortcut', end: 'the notice', enter: () => pressInShell(h, 'K', ['control', 'shift']), leave: () => h.shell.click(BACK) },
    ];
    for (const way of ways) {
      await way.enter();
      const l = await away(h);
      expect(l.away, way.start).toBe(true);
      expect(await h.shell.locator(BUTTON).getAttribute('aria-pressed')).toBe('true');
      // Moved: a turn by the keys (and the drag's own).
      const before = (await look(h)).goal;
      await pressInShell(h, 'Right');
      await pressInShell(h, 'Up');
      const moved = await arrived(h, `${way.start}, turned`, (l) => l.goal.pitch > before.pitch);
      expect(Math.abs(moved.state.yaw) + Math.abs(moved.state.pitch), `${way.start}: the camera moved`).toBeGreaterThan(5 * DEG);
      expect(quadKey(await shellCall(h, 'panelQuad'))).not.toBe(desk);
      await way.leave();
      const back = await home(h);
      expect(back.state, `${way.end}: home`).toEqual({ yaw: 0, pitch: 0, distance: 1, x: 0, y: 0 });
      expect(quadKey(await shellCall(h, 'panelQuad')), `${way.end}: the page where it was, to the pixel`).toBe(desk);
      expect(await h.shell.locator(BUTTON).getAttribute('aria-pressed')).toBe('false');
    }
    // And clicks land as before.
    await clickGrid(h);
  });
});

describe('FC2 and FC4: the mouse, and the limits', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  it('FC2 a plain click on the room does nothing; a drag turns the camera with the pointer; the wheel comes closer and goes further', async () => {
    const room = await roomPoint(h);
    await clickAt(h, room);
    await caughtUp(h, 'link-a');
    expect((await look(h)).active).toBe(false);

    // Dragging right: the room follows the pointer, so the camera goes round to the left of the page.
    await drag(h, room, 200, 0);
    let l = await arrived(h, 'turned by the drag', (x) => x.goal.yaw < 0);
    expect(l.away).toBe(true);
    expect(l.state.yaw).toBeLessThan(-20 * DEG);
    // Dragging down: the camera rises, looking down.
    const from = l.state;
    await drag(h, room, 0, -10, 2); // a drag that starts here (the room is still under the pointer)
    await drag(h, { x: room.x + 10, y: room.y - 300 }, 0, 160);
    l = await arrived(h, 'raised by the drag', (x) => x.goal.pitch > from.pitch);
    expect(l.state.pitch).toBeGreaterThan(from.pitch + 20 * DEG);
    // A plain click while away moves nothing.
    await clickAt(h, { x: room.x + 4, y: room.y - 4 });
    await caughtUp(h, 'link-a');
    expect((await look(h)).goal).toEqual(l.goal);

    // The wheel: down goes further, up comes closer.
    const at = { x: room.x + 30, y: room.y - 200 };
    await h.shell.mouse.move(at.x, at.y);
    await h.shell.mouse.wheel(0, 300);
    l = await arrived(h, 'further by the wheel', (x) => x.goal.distance > 1);
    expect(l.state.distance).toBeGreaterThan(1.3);
    await h.shell.mouse.wheel(0, -600);
    l = await arrived(h, 'closer by the wheel', (x) => x.goal.distance < 1);
    expect(l.state.distance).toBeLessThan(1);
    await pressInShell(h, 'Escape');
    await home(h);
  });

  it('FC4 however far it is pushed, the camera stays above the floor, within its distance, and never behind the page', async () => {
    const layout = await shellCall(h, 'layout');
    const floor = layout.position.y - layout.panelHeight / 2 - 120;
    await pressInShell(h, 'K', ['control', 'shift']);
    await away(h);
    const push = async (key: string, times: number) => {
      for (let i = 0; i < times; i++) await pressInShell(h, key, ['shift']);
    };
    const within = (l: Look, what: string) => {
      expect(Math.abs(l.state.yaw - layout.rotationY), `${what}: turn`).toBeLessThanOrEqual(70 * DEG + 1e-6);
      expect(l.state.distance, `${what}: distance`).toBeGreaterThanOrEqual(0.6 - 1e-9);
      expect(l.state.distance, `${what}: distance`).toBeLessThanOrEqual(2.5 + 1e-9);
      expect(l.camera.position.y, `${what}: above the floor`).toBeGreaterThanOrEqual(floor + 40 - 0.5);
      // In front of the page: on the side its face looks to.
      const normal = { x: Math.sin(layout.rotationY), z: Math.cos(layout.rotationY) };
      const p = l.camera.position;
      expect((p.x - layout.position.x) * normal.x + (p.z - layout.position.z) * normal.z, `${what}: in front of the page`).toBeGreaterThan(0);
    };
    await push('Right', 40);
    await push('S', 30);
    await push('PageDown', 30);
    await push('Down', 30);
    within(await arrived(h, 'right, far, and low', (l) => l.goal.distance === 2.5 && l.goal.yaw > layout.rotationY + 69 * DEG), 'right, far, low');
    await push('Left', 80);
    await push('W', 60);
    await push('PageUp', 60);
    await push('Up', 60);
    await push('A', 60);
    within(await arrived(h, 'left, near, and high', (l) => l.goal.distance === 0.6 && l.goal.pitch > 59 * DEG && l.goal.x < 0), 'left, near, high');
    // A long drag and the wheel, the other way.
    const room = await roomPoint(h);
    await drag(h, { x: room.x + 400, y: room.y - 300 }, -380, 250, 20);
    await h.shell.mouse.wheel(0, 5000);
    within(await arrived(h, 'a long drag and the wheel', (l) => l.goal.distance === 2.5), 'a long drag and the wheel');
    await pressInShell(h, 'Escape');
    await home(h);
  });
});

describe('FC3: the keys', () => {
  it('every movement by the keys alone; the keys do not reach the page; the shortcut can be changed', async () => {
    const h = await launch(server.url('form.html'), { userDataDir: newProfile({ parallax: 'off', shortcuts: { 'look-around': 'Mod+Alt+K' } }) });
    try {
      await waitForPage(h, 'form');
      await inPage(h, `document.getElementById('name').focus(); true`, 'form');
      // The changed shortcut works, and the old one does not.
      await pressInShell(h, 'K', ['control', 'shift']);
      await caughtUp(h, 'form');
      expect((await look(h)).active).toBe(false);
      await pressInShell(h, 'K', ['control', 'alt']);
      await away(h);
      // The notice has the keyboard.
      expect(await h.shell.evaluate(() => document.activeElement?.tagName.toLowerCase())).toBe('hs-look-notice');
      const goal = async () => (await look(h)).goal;
      const g0 = await goal();
      // Each key changes where the camera is going; the change is waited for, as a key sent to the window is handled a moment later.
      let last = g0;
      const after = async (key: string, modifiers: ('shift')[] = []) => {
        const before = JSON.stringify(last);
        await pressInShell(h, key, modifiers);
        last = await waitFor(`${key} taken`, goal, (g) => JSON.stringify(g) !== before);
        return last;
      };
      expect((await after('Right')).yaw).toBeGreaterThan(g0.yaw);
      expect((await after('Left')).yaw).toBeCloseTo(g0.yaw, 9);
      expect((await after('Up')).pitch).toBeGreaterThan(g0.pitch);
      expect((await after('Down')).pitch).toBeCloseTo(g0.pitch, 9);
      expect((await after('W')).distance).toBeLessThan(1);
      expect((await after('S')).distance).toBeCloseTo(1, 9);
      expect((await after('=')).distance).toBeLessThan(1);
      expect((await after('-')).distance).toBeCloseTo(1, 9);
      expect((await after('D')).x).toBeGreaterThan(0);
      expect((await after('A')).x).toBeCloseTo(0, 9);
      expect((await after('PageUp')).y).toBeGreaterThan(0);
      expect((await after('PageDown')).y).toBeCloseTo(0, 9);
      // Shift moves further.
      const one = (await after('Right')).yaw;
      await after('Left');
      expect((await after('Right', ['shift'])).yaw).toBeCloseTo(3 * one, 6);
      // None of it reached the page's text field.
      await caughtUp(h, 'form');
      expect(await inPage<string>(h, `document.getElementById('name').value`, 'form')).toBe('');
      await pressInShell(h, 'Home');
      await home(h);
      // Back at the desk, the keyboard is the page's again.
      await waitFor('the page has the keyboard', () => inPage<boolean>(h, 'document.hasFocus()', 'form'), (f) => f);
    } finally {
      await h.close();
    }
  });
});

describe('FC5 and FC6: the page and the cards while away', () => {
  it('FC5 a click on the page does not reach it and brings the camera back; nothing gives the page the keyboard; the page goes on meanwhile', async () => {
    const h = await launch(server.url('click-grid.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    try {
      await waitForPage(h, 'click-grid');
      await inPage(h, `window.__ticks = 0; setInterval(() => window.__ticks++, 50); window.__fixture.events = []; true`, 'click-grid');
      await pressInShell(h, 'K', ['control', 'shift']);
      await away(h);
      const ticks = await inPage<number>(h, 'window.__ticks', 'click-grid');
      await waitFor('the page going on', () => inPage<number>(h, 'window.__ticks', 'click-grid'), (t) => t > ticks + 3);
      // A click where the centre button shows now.
      const centre = await screenPointOf(h, '#centre', 'click-grid');
      await clickAt(h, centre);
      await home(h);
      await caughtUp(h, 'click-grid');
      const events = await inPage<string[]>(h, 'window.__fixture.events', 'click-grid');
      expect(events.filter((e) => /^(pointerdown|mousedown|click)/.test(e))).toEqual([]);
      // Nothing gives the page the keyboard meanwhile: it is inert while the camera is
      // away, and a panel that closes gives the keyboard back to the notice, not the page.
      await pressInShell(h, 'K', ['control', 'shift']);
      await away(h);
      const PAGE = '[data-testid="page-panel"][aria-hidden="false"]';
      expect(await h.shell.evaluate((sel) => (document.querySelector(sel) as HTMLElement).inert, PAGE)).toBe(true);
      await pressInShell(h, ',', ['control']);
      await waitFor('Settings open', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
      await pressInShell(h, 'Escape');
      await waitFor('Settings closed', () => shellCall(h, 'openPanel'), (p) => p === null);
      await waitFor('the notice has the keyboard', () => h.shell.evaluate(() => document.activeElement?.tagName.toLowerCase()), (t) => t === 'hs-look-notice');
      expect((await look(h)).away).toBe(true);
      // Tab goes round the shell, never into the page.
      for (let i = 0; i < 12; i++) {
        await h.shell.keyboard.press('Tab');
        expect(await h.shell.evaluate(() => document.activeElement?.tagName.toLowerCase())).not.toBe('webview');
      }
      await pressInShell(h, 'K', ['control', 'shift']);
      await home(h);
      expect(await h.shell.evaluate(() => (document.querySelector('[data-testid="page-panel"][aria-hidden="false"]') as HTMLElement).inert)).toBe(false);
    } finally {
      await h.close();
    }
  });

  it('FC6 a click on a card switches to its tab and comes back; hover and the rail\'s wheel work as at the desk', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    try {
      await waitForPage(h, 'link-a');
      // Enough tabs for the rail to scroll.
      for (let i = 0; i < 9; i++) {
        await pressInShell(h, 'T', ['control']);
        await navigateTo(h, server.url(`link-b.html?n=${i}`));
        await waitForPage(h, `n=${i}`);
      }
      const tabs = await shellCall(h, 'tabs');
      await pressInShell(h, 'K', ['control', 'shift']);
      await away(h);
      // Hover on a card shows its tooltip.
      const card = await shellCall(h, 'cardPoint', tabs[tabs.length - 1]!.id, 'body');
      expect(card).not.toBeNull();
      await h.shell.mouse.move(card!.x, card!.y);
      await waitFor('the card tooltip', () => shellCall(h, 'roomTooltip'), (t) => t.length > 0);
      // The wheel on a card scrolls the rail, and does not move the camera.
      const rail = await shellCall(h, 'rail');
      expect(rail.maxScroll).toBeGreaterThan(0);
      const before = (await look(h)).goal;
      await h.shell.mouse.wheel(0, -400);
      await waitFor('the rail scrolled', () => shellCall(h, 'rail'), (r) => r.scroll !== rail.scroll);
      expect((await look(h)).goal).toEqual(before);
      // A click on a card in view, not the tab in front: it comes to the front, and the camera comes back.
      const focused = await shellCall(h, 'focusedTabId');
      let pick: { id: number; at: Point } | null = null;
      for (const t of tabs) {
        const at = t.id === focused ? null : await shellCall(h, 'cardPoint', t.id, 'body');
        if (at) pick = { id: t.id, at };
      }
      expect(pick).not.toBeNull();
      await clickAt(h, pick!.at);
      await home(h);
      await waitFor('its tab in front', () => shellCall(h, 'focusedTabId'), (id) => id === pick!.id);
    } finally {
      await h.close();
    }
  });
});

describe('FC7: other states', () => {
  it('reduced motion: no animation, it jumps and comes back at once', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    try {
      await waitForPage(h, 'link-a');
      await h.shell.emulateMedia({ reducedMotion: 'reduce' });
      await pressInShell(h, 'K', ['control', 'shift']);
      await away(h);
      await pressInShell(h, 'Right');
      const l = await waitFor('turned', () => look(h), (x) => x.goal.yaw > 0);
      expect(l.moving).toBe(false);
      expect(l.state).toEqual(l.goal);
      expect(l.state.yaw).toBeGreaterThan(0);
      await pressInShell(h, 'Escape');
      // Back at once: no frames in between are needed.
      const back = await waitFor('back', () => look(h), (x) => !x.away);
      expect(back.active).toBe(false);
    } finally {
      await h.close();
    }
  });

  it('economy mode: at most 30 frames a second while moving', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ parallax: 'off', economy: 'on' }) });
    try {
      await waitForPage(h, 'link-a');
      await pressInShell(h, 'K', ['control', 'shift']);
      await away(h);
      await roomStill(h);
      const before = await shellCall(h, 'frames');
      const start = Date.now();
      const room = await roomPoint(h);
      await h.shell.mouse.move(room.x, room.y);
      await h.shell.mouse.down();
      for (let i = 1; i <= 30; i++) await h.shell.mouse.move(room.x + i * 8, room.y - (i % 2) * 6);
      await h.shell.mouse.up();
      await arrived(h, 'turned by the drag', (l) => l.goal.yaw < 0);
      const seconds = (Date.now() - start) / 1000;
      const fps = ((await shellCall(h, 'frames')) - before) / seconds;
      console.log(`FC7: ${fps.toFixed(1)} frames a second while moving in economy mode`);
      expect(fps).toBeLessThanOrEqual(33);
      await pressInShell(h, 'Escape');
      await home(h);
    } finally {
      await h.close();
    }
  });

  it('a HoloML page that fills the window brings the camera back and does not offer it; a private tab works the same', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    try {
      await waitForPage(h, 'link-a');
      await pressInShell(h, 'K', ['control', 'shift']);
      await away(h);
      await shellCall(h, 'showUrl', server.url('holoml/still.holoml'));
      await waitForPage(h, 'still.holoml', await sceneWait(h, 15_000));
      await waitFor('the scene fills the window', () => shellCall(h, 'holoml'), (s) => s.fill);
      const l = await home(h);
      expect(l.can).toBe(false);
      expect(await h.shell.locator(BUTTON).isDisabled()).toBe(true);
      expect(await h.shell.locator(BUTTON).getAttribute('title')).toContain('HoloML');
      await pressInShell(h, 'K', ['control', 'shift']);
      await caughtUp(h, 'still.holoml');
      expect((await look(h)).active).toBe(false);
      // A private tab.
      await pressInShell(h, 'N', ['control', 'shift']);
      await navigateTo(h, server.url('link-b.html'));
      await waitForPage(h, 'link-b');
      expect(await h.shell.locator(BUTTON).isDisabled()).toBe(false);
      await h.shell.click(BUTTON);
      await away(h);
      await pressInShell(h, 'Escape');
      await home(h);
    } finally {
      await h.close();
    }
  });

  it('without WebGL 2 the button is unavailable and says why', async () => {
    const h = await launch(server.url('link-a.html'), { noWebGL: true });
    try {
      await waitForPage(h, 'link-a');
      expect(await h.shell.locator(BUTTON).isDisabled()).toBe(true);
      expect(await h.shell.locator(BUTTON).getAttribute('title')).toContain("can't draw the 3D room");
      await pressInShell(h, 'K', ['control', 'shift']);
      await caughtUp(h, 'link-a');
      expect((await look(h)).active).toBe(false);
    } finally {
      await h.close();
    }
  });
});

describe('FC8 and FC9: screen readers, and efficiency', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    await waitForPage(h, 'link-a');
  });
  afterAll(async () => h?.close());

  it('FC8 the button has a name and a pressed state; entering and leaving are announced; the notice and its button are reached by the keyboard', async () => {
    expect(await h.shell.locator(BUTTON).getAttribute('aria-label')).toBe('Look around the room');
    await h.shell.click(BUTTON);
    await away(h);
    expect(await h.shell.locator(BUTTON).getAttribute('aria-pressed')).toBe('true');
    const said = () => h.shell.locator('hs-look-notice [data-testid="look-said"]').textContent();
    expect(await said()).toBe('Looking around the room. Escape returns to the desk.');
    expect(await h.shell.locator(NOTICE).getAttribute('aria-label')).toBe('Looking around the room');
    // The notice has the keyboard; Tab reaches its button, and Enter on it comes back.
    expect(await h.shell.evaluate(() => document.activeElement?.tagName.toLowerCase())).toBe('hs-look-notice');
    await h.shell.keyboard.press('Tab');
    expect(await h.shell.evaluate(() => document.querySelector('hs-look-notice')!.shadowRoot!.activeElement?.getAttribute('data-testid'))).toBe('look-back');
    await h.shell.keyboard.press('Enter');
    await home(h);
    expect(await said()).toBe('Back at the desk.');
    expect(await h.shell.locator(BUTTON).getAttribute('aria-pressed')).toBe('false');
  });

  it('FC9 nothing is drawn while the camera is still, away or back at the desk', async () => {
    await roomStill(h);
    await pressInShell(h, 'K', ['control', 'shift']);
    await away(h);
    await pressInShell(h, 'Right');
    await arrived(h, 'turned', (l) => l.goal.yaw > 0);
    await roomStill(h);
    await pressInShell(h, 'Escape');
    await home(h);
    await roomStill(h);
  });

  it('FC9 frames while moving at the display\'s rate (with a graphics card)', async (ctx) => {
    await pressInShell(h, 'K', ['control', 'shift']);
    await away(h);
    const room = await roomPoint(h);
    const before = await shellCall(h, 'frames');
    const start = Date.now();
    await h.shell.mouse.move(room.x, room.y);
    await h.shell.mouse.down();
    let i = 0;
    while (Date.now() - start < 1000) {
      i++;
      await h.shell.mouse.move(room.x + (i % 2) * 200, room.y - 100, { steps: 4 });
    }
    await h.shell.mouse.up();
    const seconds = (Date.now() - start) / 1000;
    const fps = ((await shellCall(h, 'frames')) - before) / seconds;
    console.log(`FC9: ${fps.toFixed(1)} frames a second while looking around`);
    await pressInShell(h, 'Escape');
    await home(h);
    const software = await softwareRenderer(h);
    if (software) {
      console.log(`FC9: frame rate not checked: drawing in software (${software})`);
      ctx.skip();
    }
    expect(fps).toBeGreaterThanOrEqual(50);
  });
});
