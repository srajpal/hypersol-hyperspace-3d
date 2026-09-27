/**
 * Milestone 18 end-to-end checks, first part (owner, prompt 92): how fast
 * the viewer walks and turns (HoloML 0.2 `speed` and `turn-speed`, and
 * `holoml.viewer.speed` and `turnSpeed`), and sliders (`slider` and the
 * `change` event), with Blockworld's Speed slider. U1 (the language) is
 * the holoml repository's tests. The sofa studio's checks come with the
 * rest of the milestone's plan.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import { clickUntil, inPage, launch, pressInPage, project, shellCall, sleep, waitFor, waitForPage, type Harness } from './harness';

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

/** Holds a key down in the page for a while (walking and turning need keys held). */
async function hold(h: Harness, page: string, keyCode: string, ms: number): Promise<void> {
  await key(h, page, keyCode, 'keyDown');
  await sleep(ms);
  await key(h, page, keyCode, 'keyUp');
}

/**
 * How fast the viewer goes while a key is held: metres a second across
 * the floor, and degrees a second of turning, measured between two
 * moments well inside the hold (the page's own clock), so the time a key
 * takes to arrive does not count.
 */
async function rates(h: Harness, page: string, keyCode: string): Promise<{ walk: number; turn: number }> {
  const sample = () => inPage<{ p: Vec; d: Vec; t: number }>(h, '({ p: holoml.viewer.position, d: holoml.viewer.direction, t: performance.now() })', page);
  await key(h, page, keyCode, 'keyDown');
  try {
    await sleep(250);
    const a = await sample();
    await sleep(500);
    const b = await sample();
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
