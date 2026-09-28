/**
 * Milestone 17 end-to-end checks T2 to T8 (TODO.md): HoloML 0.2 (first
 * part) and Blockworld. T1 (the language) is the holoml repository's
 * tests; T9 (the published site) is checked by hand; T10 is the full run.
 * Blockworld is the holoml repository's, copied by pnpm holoml:sync.
 */
import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { _electron as electron } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  APP_DIR,
  clickUntil,
  framesDrawn,
  graphicsSwitches,
  holdKeyUntil,
  OFFLINE_RULES,
  removeFolder,
  sceneWait,
  settled,
  watchStalls,
  clickAt,
  closeFocusedTab,
  focusedTab,
  inPage,
  launch,
  pressInPage,
  pressInShell,
  project,
  shellCall,
  sleep,
  softwareRenderer,
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

type Vec = [number, number, number];
/** Blockworld's longer checks: drawn in software (GitHub's machines) they take minutes, not seconds. Not a requirement. */
const BLOCKWORLD_TIME = 240_000;
const url = (page: string) => server.url(`holoml/${page}`);

function holo<T>(h: Harness, expression: string, page: string): Promise<T> {
  return inPage<T>(h, `window.__holoml ? (${expression}) : undefined`, page);
}

async function ready(h: Harness, page: string, timeoutMs = 20_000): Promise<void> {
  await waitFor(`${page} ready`, () => holo<boolean>(h, 'window.__holoml.ready', page), (r) => r === true, timeoutMs);
}

async function open(h: Harness, page: string): Promise<void> {
  await shellCall(h, 'showUrl', url(page));
  await waitForPage(h, page);
  await ready(h, page);
}

/** Keeps what the pages print to their consoles, from now on (in the main process). */
async function watchConsole(h: Harness): Promise<void> {
  await h.app.evaluate(({ app, webContents }) => {
    const g = globalThis as unknown as { __pageConsole?: string[] };
    g.__pageConsole = [];
    const watch = (w: Electron.WebContents) => {
      if (w.getType() !== 'webview' || (w as unknown as { __watched?: boolean }).__watched) return;
      (w as unknown as { __watched?: boolean }).__watched = true;
      w.on('console-message', (e) => g.__pageConsole!.push(e.message));
    };
    webContents.getAllWebContents().forEach(watch);
    app.on('web-contents-created', (_e, w) => watch(w));
  });
}
const consoleText = (h: Harness) => h.app.evaluate(() => ((globalThis as unknown as { __pageConsole?: string[] }).__pageConsole ?? []).join('\n'));

/** The middle of the page, where the crosshair is, on the screen. */
async function centre(h: Harness, page: string): Promise<Point> {
  const [w, hgt] = await inPage<number[]>(h, '[innerWidth, innerHeight]', page);
  return project(h, w! / 2, hgt! / 2);
}

/** Sends a key down, waits, then up, to the page (walking needs keys held). */
async function key(h: Harness, page: string, keyCode: string, type: 'keyDown' | 'keyUp'): Promise<void> {
  await h.app.evaluate(
    ({ webContents }, { page, keyCode, type }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop();
      guest?.sendInputEvent({ type, keyCode });
    },
    { page, keyCode, type },
  );
}

async function hold(h: Harness, page: string, keyCode: string, ms: number): Promise<void> {
  await key(h, page, keyCode, 'keyDown');
  await sleep(ms);
  await key(h, page, keyCode, 'keyUp');
}

const walker = (h: Harness, page: string) => holo<{ feet: Vec; onGround: boolean; gravity: boolean } | null>(h, 'window.__holoml.walker()', page);

describe('T2: scripts', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(url('script-basic.holoml'));
    await watchConsole(h);
    await waitForPage(h, 'script-basic.holoml');
    await ready(h, 'script-basic.holoml');
  });
  afterAll(async () => h?.close());

  it('T2 a page script from its own site runs and changes the scene through the API', async () => {
    const PAGE = 'script-basic.holoml';
    const probe = await waitFor(
      'the script to run and count 30 frames',
      () => inPage<{ ran: boolean; version: string; ready?: boolean; frames?: number; added: unknown; missing: unknown; errors: string[] } | undefined>(h, 'window.__probe', PAGE),
      (p) => p?.ready === true && p.frames === 30,
    );
    expect(probe!.version).toBe('0.2');
    expect(probe!.added).toEqual({ id: 'added', kind: 'model', parent: 'stand', solid: true });
    expect(probe!.missing).toBeNull();
    expect(probe!.errors[0]).toMatch(/three finite numbers/);
    expect(await holo<string[]>(h, 'window.__holoml.labels()', PAGE)).toContain('Changed by the script');
    expect(await inPage<number>(h, 'holoml.find("lamp").intensity', PAGE)).toBe(1.5);
    const huds = await holo<{ id: string; text: string }[]>(h, 'window.__holoml.huds()', PAGE);
    expect(huds.find((x) => x.id === 'score')?.text).toBe('Score: 10\nLevel: 2');
    // Removed, and added inside the group.
    expect(await holo<unknown>(h, 'window.__holoml.object("gone")', PAGE)).toBeNull();
    const added = await holo<{ position: Vec }>(h, 'window.__holoml.object("added")', PAGE);
    expect(added.position).toEqual([-2, 0, 2]);
    expect(await consoleText(h)).toMatch(/holoml\.add adds groups, models, lights, labels, and sounds, not <animate>/);
    // Clicks and keys reach the script.
    const car = await holo<Point>(h, 'window.__holoml.point("car")', PAGE);
    await clickAt(h, await project(h, car.x, car.y));
    await pressInPage(h, 'k', [], PAGE);
    await waitFor(
      'the click and the key',
      () => inPage<unknown[][]>(h, 'window.__probe.events', PAGE),
      (ev) => ev.some((e) => e[0] === 'click' && e[1] === 'left' && e[2] === 'car') && ev.some((e) => e[0] === 'key' && e[1] === 'k'),
    );
  });

  it('T2 an inline script, or one from another site, does not run, and the console says why', async () => {
    await open(h, 'script-inline.holoml');
    expect(await inPage<unknown>(h, 'typeof window.__probe', 'script-inline.holoml')).toBe('undefined');
    expect(await inPage<unknown>(h, 'typeof window.__inline', 'script-inline.holoml')).toBe('undefined');
    expect(await consoleText(h)).toMatch(/A <script> holds no code/);
    expect(await consoleText(h)).toMatch(/was not run: a script is a file named in "src"/);
    await open(h, 'script-away.holoml');
    await waitFor('the console', () => consoleText(h), (t) => /"http:\/\/localhost:1\/away\.js" was not run: scripts load only from the page's own site/.test(t));
    expect(await holo<string[]>(h, 'window.__holoml.labels()', 'script-away.holoml')).toEqual(['Away']);
  });

  it('T2 a script error is shown in the console, and the scene stays', async () => {
    await open(h, 'script-error.holoml');
    await waitFor('the error in the console', () => consoleText(h), (t) => t.includes('boom from the page script'));
    expect(await inPage<boolean>(h, 'window.__before === true', 'script-error.holoml')).toBe(true);
    expect(await holo<string[]>(h, 'window.__holoml.labels()', 'script-error.holoml')).toEqual(['Still here']);
    expect((await holo<{ state: string }[]>(h, 'window.__holoml.models()', 'script-error.holoml')).map((m) => m.state)).toEqual(['loaded']);
  });

  it('T2 a script that never stops leaves the browser answering, and its tab closes', async () => {
    const before = (await tabs(h)).length;
    await pressInShell(h, 'T', ['control']);
    await shellCall(h, 'showUrl', url('script-loop.holoml'));
    // The page's own process is busy for ever: ask the shell, never the page.
    await waitFor('the tab to show the page', async () => (await focusedTab(h)).url, (u) => u.endsWith('script-loop.holoml'));
    await sleep(1500);
    // The shell's own switch animation done, the page's script now spinning.
    await settled(h);
    const stalls = await watchStalls(h);
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t = performance.now();
      await shellCall(h, 'tabs');
      times.push(performance.now() - t);
      await sleep(100);
    }
    const why = await stalls();
    // Within 200 ms with a graphics card; drawn in software (GitHub's machines), logged, not
    // checked, as the other budgets (owner, prompt 96: the software GPU process is shared).
    const software = await softwareRenderer(h);
    const answers = `${times.map((t) => t.toFixed(0)).join(', ')} ms; ${why}`;
    if (software) console.log(`T2: answers took ${answers}; the 200 ms budget not checked: drawing in software (${software})`);
    else expect(Math.max(...times), answers).toBeLessThan(200);
    await closeFocusedTab(h);
    await waitFor('the tab closed', async () => (await tabs(h)).length, (n) => n === before);
  });
});

describe('T3: sound', () => {
  let h: Harness;
  const PAGE = 'sound.holoml';
  const guestMuted = () =>
    h.app.evaluate(({ webContents }) => webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes('sound.holoml')).pop()!.isAudioMuted());
  beforeAll(async () => {
    h = await launch(url(PAGE));
    await waitForPage(h, PAGE);
    await ready(h, PAGE, 30_000);
  });
  afterAll(async () => h?.close());

  it('T3 nothing plays before the first click or key; after it the sound plays; the tab mute silences it', async () => {
    const sounds = () => holo<{ id: string; state: string; playing: boolean; reason?: string }[]>(h, 'window.__holoml.sounds()', PAGE);
    expect(await holo<boolean>(h, 'window.__holoml.soundsActive', PAGE)).toBe(false);
    expect((await sounds()).find((s) => s.id === 'tone')).toMatchObject({ state: 'loaded', playing: false });
    // The browser keeps the tab muted until then, whatever the page's scripts do.
    expect(await guestMuted()).toBe(true);
    // Over the limits: left out, like a model.
    const big = (await sounds()).find((s) => s.id === 'big')!;
    expect(big.state).toBe('left-out');
    expect(big.reason).toMatch(/larger than 32 MB/);
    expect((await holo<{ what: string }[]>(h, 'window.__holoml.leftOut()', PAGE)).some((o) => o.what.includes('big.wav'))).toBe(true);

    await clickAt(h, await centre(h, PAGE));
    await waitFor('sound allowed', () => holo<boolean>(h, 'window.__holoml.soundsActive', PAGE), (v) => v === true);
    await waitFor('the tone playing', async () => (await sounds()).find((s) => s.id === 'tone')?.playing, (v) => v === true);
    await waitFor('the tab unmuted', guestMuted, (m) => m === false);
    await waitFor('the tab audible', () => focusedTab(h), (t) => t.audible, 10_000);

    await h.shell.click('hs-toolbar [data-testid="menu"]');
    await h.shell.click('hs-toolbar [data-testid="menu-mute-tab"]');
    await waitFor('muted', () => focusedTab(h), (t) => t.muted);
    expect(await guestMuted()).toBe(true);
    await h.shell.click('hs-toolbar [data-testid="menu"]');
    await h.shell.click('hs-toolbar [data-testid="menu-mute-tab"]');
    await waitFor('unmuted', guestMuted, (m) => m === false);
  });
});

describe('T4: walls and gravity', () => {
  let h: Harness;
  const PAGE = 'walls.holoml';
  beforeAll(async () => {
    h = await launch(url(PAGE));
    await waitForPage(h, PAGE);
    await ready(h, PAGE);
  });
  afterAll(async () => h?.close());

  it('T4 the walker falls onto the floor, is stopped by a wall, jumps onto a step, and passes what is not solid', async () => {
    const landed = await waitFor('landed', () => walker(h, PAGE), (w) => w?.onGround === true && Math.abs(w.feet[1] - 1) < 0.01, 10_000);
    expect(landed!.gravity).toBe(true);
    // Toward the wall (+x): stopped at its face, less the body's half width.
    await hold(h, PAGE, 'W', 2000);
    let w = (await walker(h, PAGE))!;
    expect(w.feet[0]).toBeLessThanOrEqual(2 - 0.3);
    expect(w.feet[0]).toBeGreaterThan(1.5);
    // Turn to the step (-x), walk to it, and jump onto it.
    await inPage(h, 'holoml.viewer.lookAt([-6, 2.6, 0.5]), true', PAGE);
    await key(h, PAGE, 'W', 'keyDown');
    await sleep(1600);
    w = (await walker(h, PAGE))!;
    expect(w.feet[1]).toBeCloseTo(1, 2); // still on the floor: the step stops it
    await key(h, PAGE, 'Space', 'keyDown');
    await key(h, PAGE, 'Space', 'keyUp');
    await sleep(900);
    await key(h, PAGE, 'W', 'keyUp');
    w = (await waitFor('on the step', () => walker(h, PAGE), (x) => x?.onGround === true))!;
    expect(w.feet[1]).toBeCloseTo(2, 2);
    expect(w.feet[0]).toBeLessThan(-1);
    // The leaves are not solid: the walker goes through them (and off the floor's edge).
    await inPage(h, 'holoml.viewer.position = [0.5, 2.6, 0.5], true', PAGE);
    await inPage(h, 'holoml.viewer.lookAt([0.5, 2.6, -8]), true', PAGE);
    await hold(h, PAGE, 'W', 1500);
    w = (await walker(h, PAGE))!;
    expect(w.feet[2]).toBeLessThan(-2);
  });
});

describe('T5 to T7: Blockworld', () => {
  let h: Harness;
  const PAGE = 'blockworld/index.holoml';
  const bw = <T>(expression: string, page = PAGE) => inPage<T>(h, `window.blockworld.${expression}`, page);
  const hud = async (id: string, page = PAGE) => (await holo<{ id: string; text: string }[]>(h, 'window.__holoml.huds()', page)).find((x) => x.id === id)?.text ?? '';
  let loadMs = 0;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'));
    await waitForPage(h, 'link-a.html');
    const t = Date.now();
    await shellCall(h, 'showUrl', url(PAGE));
    await waitForPage(h, PAGE);
    await ready(h, PAGE, 30_000);
    loadMs = Date.now() - t;
  });
  afterAll(async () => h?.close());

  it('T5 the island of blocks loads within 5 s and draws smoothly, with few draw calls', async () => {
    const software = await softwareRenderer(h);
    // Within 5 s with a graphics card. Drawn in software (GitHub's machines), the time is
    // logged, not checked, as the frame rate below is (owner, prompts 59 and 95).
    if (software) console.log(`T5: loaded in ${loadMs} ms; the 5-second budget not checked: drawing in software (${software})`);
    else expect(loadMs).toBeLessThan(5000);
    const blocks = await bw<number>('blocks');
    expect(blocks).toBeGreaterThan(1000);
    const stats = await holo<{ calls: number; pools: { src: string; count: number }[] }>(h, 'window.__holoml.stats()', PAGE);
    expect(stats.calls).toBeLessThan(60);
    expect(stats.pools.reduce((n, p) => n + p.count, 0)).toBeGreaterThan(1000);
    const f0 = await holo<number>(h, 'window.__holoml.frames', PAGE);
    await sleep(2000);
    const fps = ((await holo<number>(h, 'window.__holoml.frames', PAGE)) - f0) / 2;
    // With a graphics card, 30 frames a second or more; drawn in software (GitHub's machines), only that it draws, as C9.
    expect(fps).toBeGreaterThan(software ? 0 : 30);
  });

  it('T6 breaking and placing by mouse and by keyboard; keys 1 to 5 choose the block', async () => {
    const top = await bw<number>('top(0, 1)');
    // Standing still first: drawn in software (GitHub's machines), the walker takes a while to land.
    await inPage(h, `holoml.viewer.position = [0.5, ${top + 3.2}, 3.5], true`, PAGE);
    await waitFor('standing', () => walker(h, PAGE), (w) => w?.onGround === true, await sceneWait(h, 5000));
    type Aim = { at: Vec; normal: Vec };
    /** Looks at the ground ahead: the block under the crosshair, and which way the face there faces. */
    const aim = async (): Promise<Aim> => {
      await inPage(h, `holoml.viewer.lookAt([0.5, ${top - 0.5}, 1.5]), true`, PAGE);
      await framesDrawn(h, PAGE);
      const code = '(() => { const a = holoml.aim(); return a && a.thing && a.normal ? { at: a.thing.position.map(Math.floor), normal: a.normal.map(Math.round) } : null; })()';
      return (await waitFor('a block under the crosshair', () => inPage<Aim | null>(h, code, PAGE), (a) => a !== null))!;
    };
    const kind = (p: Vec) => bw<string | null>(`blockAt(${p.join(', ')})`);
    const gone = (k: string | null) => k === null || k === 'water';
    const onFace = (a: Aim): Vec => [a.at[0] + a.normal[0], a.at[1] + a.normal[1], a.at[2] + a.normal[2]];
    const crosshair = await centre(h, PAGE);
    // The mouse: a click breaks the block under the crosshair (clicked again if a click is lost, issue #30)...
    let a = await aim();
    expect(await kind(a.at)).not.toBeNull();
    await clickUntil(h, crosshair, 'broken by a click', async () => gone(await kind(a.at)));
    // ...and with stone chosen (key 3), a right-click places one on the face it points at.
    await pressInPage(h, '3', [], PAGE);
    await waitFor('stone chosen', () => hud('hand'), (t) => t.startsWith('Placing: Stone'));
    a = await aim();
    await clickUntil(h, crosshair, 'placed by a right-click', async () => (await kind(onFace(a))) === 'stone', { button: 'right' });
    // The keyboard: E breaks, and Q places (planks, key 4), what is under the crosshair.
    a = await aim();
    await pressInPage(h, 'e', [], PAGE);
    await waitFor('broken with E', () => kind(a.at), gone);
    await pressInPage(h, '4', [], PAGE);
    await waitFor('planks chosen', () => hud('hand'), (t) => t.startsWith('Placing: Planks'));
    a = await aim();
    await pressInPage(h, 'q', [], PAGE);
    await waitFor('placed with Q', () => kind(onFace(a)), (k) => k === 'planks');
    await pressInPage(h, '1', [], PAGE);
    await waitFor('grass chosen', () => hud('hand'), (t) => t.startsWith('Placing: Grass'));
  }, BLOCKWORLD_TIME);

  it('T6 five gems, found in the stone and brought to the chest, win the game', async () => {
    const gems = await bw<Vec[]>('gems');
    expect(gems).toHaveLength(5);
    for (const [i, g] of gems.entries()) {
      const top = await bw<number>(`top(${g[0]}, ${g[2]})`);
      await inPage(h, `holoml.viewer.position = [${g[0]}, ${top + 1.7}, ${g[2]}], true`, PAGE);
      // Dig straight down with E until the gem is found.
      for (let tries = 0; tries < 20 && (await bw<number>('carried')) === i; tries++) {
        await inPage(h, `holoml.viewer.lookAt([${g[0]}, -20, ${g[2]}]), true`, PAGE);
        await pressInPage(h, 'e', [], PAGE);
        await sleep(450);
      }
      expect(await bw<number>('carried'), `gem ${i + 1}`).toBe(i + 1);
    }
    expect(await hud('score')).toMatch(/^Gems carried: 5/);
    // To the chest, and put them in.
    const chest = await bw<Vec>('chest');
    await inPage(h, `holoml.viewer.position = [${chest[0]}, ${chest[1] + 2.4}, ${chest[2] + 2.2}], true`, PAGE);
    await sleep(600);
    await inPage(h, `holoml.viewer.lookAt(${JSON.stringify(chest)}), true`, PAGE);
    await waitFor('the chest under the crosshair', () => inPage<string | null>(h, 'holoml.aim()?.thing?.id ?? null', PAGE), (id) => id === 'chest');
    await pressInPage(h, 'e', [], PAGE);
    await waitFor('won', () => bw<boolean>('won'), (v) => v === true);
    expect(await hud('score')).toMatch(/In the chest: 5 of 5/);
    expect(await hud('message')).toMatch(/You won/);
  }, BLOCKWORLD_TIME);

  it('T4 the chest is solid: the walker stands on it', async () => {
    const chest = await bw<Vec>('chest');
    await inPage(h, `holoml.viewer.position = [${chest[0]}, ${chest[1] + 4}, ${chest[2]}], true`, PAGE);
    const w = await waitFor('standing', () => walker(h, PAGE), (x) => x?.onGround === true, await sceneWait(h, 5000));
    // The chest's lid is 0.43 m above its middle.
    expect(w!.feet[1]).toBeCloseTo(chest[1] + 0.43, 1);
  });

  it('T6 night comes, and a torch lights its surroundings', async () => {
    const NIGHT = 'blockworld/index.holoml?hour=22';
    await shellCall(h, 'showUrl', url(NIGHT));
    await waitForPage(h, 'hour=22', await sceneWait(h, 15_000));
    await ready(h, 'hour=22', await sceneWait(h, 30_000));
    expect(await hud('clock', 'hour=22')).toMatch(/Day 1, 22:/);
    expect(await holo<string>(h, 'window.__holoml.lights().find((l) => l.type === "directional").intensity.toFixed(2)', 'hour=22')).toBe('0.00');
    const top = await bw<number>('top(0, 1)', 'hour=22');
    await inPage(h, `holoml.viewer.position = [0.5, ${top + 3.2}, 3.5], true`, 'hour=22');
    await sleep(400);
    await inPage(h, `holoml.viewer.lookAt([0.5, ${top - 0.5}, 1.5]), true`, 'hour=22');
    await pressInPage(h, '5', [], 'hour=22');
    await pressInPage(h, 'q', [], 'hour=22');
    const torches = await waitFor('a torch', () => bw<Vec[]>('torches', 'hour=22'), (t) => t.length === 1);
    expect(torches[0]![1]).toBeCloseTo(top + 0.8, 1);
    const intensity = await inPage<number>(h, 'holoml.find("torch-1").intensity', 'hour=22');
    expect(intensity).toBeGreaterThan(0);
    // It lights its surroundings: from a view that stands still, compare the page's own pixels
    // with the torch's light and without it, in a grid of 10 by 6 cells less the top and bottom
    // rows (the screen text). Faces toward the torch get brighter; faces away from it do not.
    const cells = () =>
      h.app.evaluate(async ({ webContents }) => {
        const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes('hour=22')).pop()!;
        const image = (await guest.capturePage()).resize({ width: 200, height: 120 });
        const { width, height } = image.getSize();
        const px = image.toBitmap(); // BGRA
        const out: number[] = [];
        for (let cy = 1; cy < 5; cy++) {
          for (let cx = 0; cx < 10; cx++) {
            let sum = 0;
            let n = 0;
            for (let y = Math.floor((cy * height) / 6); y < Math.floor(((cy + 1) * height) / 6); y++) {
              for (let x = Math.floor((cx * width) / 10); x < Math.floor(((cx + 1) * width) / 10); x++) {
                const i = (y * width + x) * 4;
                sum += 0.114 * px[i]! + 0.587 * px[i + 1]! + 0.299 * px[i + 2]!;
                n++;
              }
            }
            out.push(sum / n);
          }
        }
        return out;
      });
    await waitFor('standing', () => walker(h, 'hour=22'), (w) => w?.onGround === true, await sceneWait(h, 5000));
    // New frames before each picture: drawn in software, a frame can take longer than a pause.
    await framesDrawn(h, 'hour=22', 3);
    const lit = await cells();
    await inPage(h, 'holoml.find("torch-1").intensity = 0, true', 'hour=22');
    await framesDrawn(h, 'hour=22', 3);
    const dark = await cells();
    await inPage(h, `holoml.find("torch-1").intensity = ${intensity}, true`, 'hour=22');
    const brighter = lit.filter((v, i) => v >= dark[i]! * 1.3).length;
    expect(brighter, `cells at least 30% brighter with the torch's light: ${brighter} of ${lit.length}`).toBeGreaterThanOrEqual(lit.length / 4);
  }, BLOCKWORLD_TIME);

  it('T7 the screen text is in the text view and the accessibility tree', async () => {
    const NIGHT = 'hour=22';
    // Ctrl+Shift+V in the page (R8 checks the button too): drawn in software, Blockworld keeps
    // the shared GPU process so busy that a click's wait for the button to hold still can run out.
    await pressInPage(h, 'V', ['control', 'shift'], NIGHT);
    await waitFor('the text view', () => holo<boolean>(h, 'window.__holoml.textView', NIGHT), (v) => v === true, await sceneWait(h, 15_000));
    const text = await inPage<string>(h, 'document.body.innerText', NIGHT);
    expect(text).toContain('Gems carried: 0');
    expect(text).toContain('Placing:');
    await pressInPage(h, 'V', ['control', 'shift'], NIGHT);
    await waitFor('3D again', () => holo<boolean>(h, 'window.__holoml.textView', NIGHT), (v) => v === false, await sceneWait(h, 15_000));
    const tree = await h.app.evaluate(async ({ webContents }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes('hour=22')).pop()!;
      guest.debugger.attach('1.3');
      try {
        const r = (await guest.debugger.sendCommand('Accessibility.getFullAXTree')) as { nodes: { ignored: boolean; name?: { value: string } }[] };
        return r.nodes.filter((n) => !n.ignored).map((n) => n.name?.value ?? '');
      } finally {
        guest.debugger.detach();
      }
    });
    expect(tree.some((n) => n.includes('Gems carried: 0'))).toBe(true);
    // The clock (a day lasts four minutes, so the hour has moved on since the page opened).
    expect(tree.some((n) => /^Day \d+, \d\d:\d\d$/.test(n))).toBe(true);
  }, BLOCKWORLD_TIME);

  it('T7 with reduced motion, the day stands still at noon', async () => {
    const STILL = 'blockworld/index.holoml?still';
    await h.app.evaluate(async ({ webContents }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview').pop()!;
      guest.debugger.attach('1.3');
      await guest.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    });
    try {
      await shellCall(h, 'showUrl', url(STILL));
      await waitForPage(h, '?still', await sceneWait(h, 15_000));
      await ready(h, '?still', await sceneWait(h, 30_000));
      const first = await hud('clock', '?still');
      expect(first).toBe('Day 1, 12:00 (the clock stands still)');
      await sleep(2000);
      expect(await hud('clock', '?still')).toBe(first);
    } finally {
      await h.app.evaluate(({ webContents }) => {
        for (const w of webContents.getAllWebContents()) if (w.getType() === 'webview' && w.debugger.isAttached()) w.debugger.detach();
      });
    }
  }, BLOCKWORLD_TIME);

  it('T7 the keyboard alone: the arrows turn, Page Down looks down, and E breaks the block under the crosshair', async () => {
    // Walking (W), jumping (Space), placing (Q), and choosing (1 to 5) by key are in T4 and T6.
    const KEYS = '?keys';
    await shellCall(h, 'showUrl', url(`${PAGE}${KEYS}`));
    await waitForPage(h, KEYS, await sceneWait(h, 15_000));
    await ready(h, KEYS, await sceneWait(h, 30_000));
    await waitFor('standing', () => walker(h, KEYS), (w) => w?.onGround === true, await sceneWait(h, 15_000));
    const view = () => inPage<{ position: Vec; direction: Vec }>(h, '({ position: holoml.viewer.position, direction: holoml.viewer.direction })', KEYS);
    const yawOf = (d: Vec) => Math.atan2(-d[0], -d[2]);
    const turnedBy = (a: Vec, b: Vec) => {
      const change = Math.abs(yawOf(a) - yawOf(b));
      return Math.min(change, 2 * Math.PI - change);
    };
    const before = await view();
    // The left arrow turns, without moving (held until it has turned: in software, frames come slowly).
    const turned = await holdKeyUntil(h, KEYS, 'Left', 'turned by the left arrow', view, (v) => turnedBy(v.direction, before.direction) > 0.4);
    expect(Math.hypot(turned.position[0] - before.position[0], turned.position[2] - before.position[2])).toBeLessThan(0.05);
    // Page Down looks down, at the ground in front.
    await holdKeyUntil(h, KEYS, 'PageDown', 'looking down with Page Down', view, (v) => v.direction[1] < -0.8);
    const aimed = await waitFor('a block under the crosshair', () => inPage<Vec | null>(h, 'holoml.aim()?.thing?.position ?? null', KEYS), (p) => p !== null);
    const [x, y, z] = aimed!.map(Math.floor) as Vec;
    expect(await bw<string | null>(`blockAt(${x}, ${y}, ${z})`, KEYS)).not.toBeNull();
    // E breaks it.
    await pressInPage(h, 'e', [], KEYS);
    await waitFor('broken with E', () => bw<string | null>(`blockAt(${x}, ${y}, ${z})`, KEYS), (k) => k === null || k === 'water');
  }, BLOCKWORLD_TIME);
});

describe('T8: the HoloML examples section', () => {
  let h: Harness;
  const DIALOG = 'hs-examples [data-testid="examples"]';
  const isOpen = () => h.shell.locator(DIALOG).count();
  const holomlHits = () => [...server.hits.keys()].filter((k) => k.startsWith('/holoml/')).length;
  beforeAll(async () => {
    h = await launch(server.url('link-a.html'), { examplesBase: url('') });
    await waitForPage(h, 'link-a.html');
  });
  afterAll(async () => h?.close());

  it('T8 opens from the start panel, the menu, and Ctrl+Shift+E, with a picture of each example, and fetches nothing', async () => {
    await pressInShell(h, 'T', ['control']);
    await h.shell.locator('[data-testid="start-examples"]').waitFor({ state: 'visible' });
    expect(await h.shell.locator('[data-testid="start-showroom"]').getAttribute('data-url')).toBe(url('showroom/index.holoml'));
    expect(await h.shell.locator('[data-testid="start-example-blockworld"]').getAttribute('data-url')).toBe(url('blockworld/index.holoml'));
    // The sofa studio joined in milestone 18 (prompt 98).
    expect(await h.shell.locator('[data-testid="start-example-sofa-studio"]').getAttribute('data-url')).toBe(url('sofa-studio/index.holoml'));
    const hits = holomlHits();
    // From the start panel.
    await h.shell.click('[data-testid="start-examples"]');
    await waitFor('the examples', isOpen, (n) => n === 1);
    for (const id of ['showroom', 'blockworld', 'sofa-studio']) {
      const card = `hs-examples [data-testid="example-${id}"]`;
      expect(await h.shell.locator(card).isVisible()).toBe(true);
      const picture = (await waitFor(
        `${id}'s picture loaded`,
        () => h.shell.locator(`${card} img`).evaluate((img: HTMLImageElement) => ({ w: img.complete ? img.naturalWidth : 0, alt: img.alt })),
        (p) => p.w > 0,
      ))!;
      expect(picture.w).toBeGreaterThan(300);
      expect(picture.alt).toMatch(/a picture of the site/);
    }
    expect(await h.shell.locator('hs-examples [data-testid="example-blockworld"]').innerText()).toMatch(/HoloML 0\.2/);
    // Links to HoloML's repository, its specification, and each example's source (owner, prompt 88).
    expect(await h.shell.locator('hs-examples [data-testid="examples-repository"]').getAttribute('data-url')).toBe('https://github.com/srajpal/holoml');
    expect(await h.shell.locator('hs-examples [data-testid="examples-spec"]').getAttribute('data-url')).toBe('https://github.com/srajpal/holoml/blob/main/SPEC.md');
    expect(await h.shell.locator('hs-examples [data-testid="example-source-blockworld"]').getAttribute('data-url')).toBe(
      'https://github.com/srajpal/holoml/tree/main/examples/blockworld',
    );
    // Opening it asked the sites for nothing.
    expect(holomlHits()).toBe(hits);
    await h.shell.keyboard.press('Escape');
    await waitFor('closed', isOpen, (n) => n === 0);
    // From the menu.
    await h.shell.click('hs-toolbar [data-testid="menu"]');
    await h.shell.click('hs-toolbar [data-testid="menu-examples"]');
    await waitFor('the examples, from the menu', isOpen, (n) => n === 1);
    await h.shell.click('hs-examples [data-testid="examples-close"]');
    await waitFor('closed', isOpen, (n) => n === 0);
    // With Ctrl+Shift+E, and from the keyboard: the first Open has the focus.
    await pressInShell(h, 'E', ['control', 'shift']);
    await waitFor('the examples, from the shortcut', isOpen, (n) => n === 1);
    await waitFor(
      'Open in focus',
      () => h.shell.evaluate(() => (document.querySelector('hs-examples')!.shadowRoot!.activeElement as HTMLElement | null)?.dataset['testid'] ?? ''),
      (t) => t === 'example-open-showroom',
    );
    // Past the showroom's Source to Blockworld's Open.
    await h.shell.keyboard.press('Tab');
    await h.shell.keyboard.press('Tab');
    await waitFor(
      "Blockworld's Open in focus",
      () => h.shell.evaluate(() => (document.querySelector('hs-examples')!.shadowRoot!.activeElement as HTMLElement | null)?.dataset['testid'] ?? ''),
      (t) => t === 'example-open-blockworld',
    );
    await h.shell.keyboard.press('Enter');
    await waitFor('Blockworld opened in the tab', async () => (await focusedTab(h)).url, (u) => u === url('blockworld/index.holoml'));
    expect(await isOpen()).toBe(0);
    await waitForPage(h, 'blockworld/index.holoml');
    await ready(h, 'blockworld/index.holoml', 30_000);
  });
});

describe('After the report (prompt 89)', () => {
  it("a HoloML tab's card shows the scene once it is drawn, not only the page as it was when it loaded", async () => {
    const h = await launch(server.url('link-a.html'));
    // How much of a card's picture is the late car's red paint.
    const redShare = async (tabId: number) => {
      const src = await shellCall(h, 'cardPicture', tabId);
      if (!src) return 0;
      return h.shell.evaluate(async (s) => {
        const img = new Image();
        img.src = s;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = 160;
        c.height = Math.max(1, Math.round((160 * img.height) / img.width));
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let red = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i]! > 110 && d[i + 1]! < 80 && d[i + 2]! < 80) red++;
        return red / (d.length / 4);
      }, src);
    };
    try {
      await waitForPage(h, 'link-a.html');
      const PAGE = 'late-model.holoml';
      const tab = await focusedTab(h);
      const before = tab.snapshotAt;
      await shellCall(h, 'showUrl', url(PAGE));
      await waitForPage(h, PAGE);
      // The page itself loads at once and gets its picture; the fixture server holds the car
      // back until this check lets it through.
      await waitFor('a picture of the page while the car is still coming', () => focusedTab(h), (t) => t.snapshotAt > before && t.url.endsWith(PAGE));
      expect(await holo<boolean>(h, 'window.__holoml.ready', PAGE)).toBe(false);
      expect(await redShare(tab.id)).toBeLessThan(0.002);
      server.release('late-car');
      await ready(h, PAGE);
      await waitFor('the car on the card', () => redShare(tab.id), (share) => share > 0.01, 6000);
    } finally {
      await h.close();
    }
  });

  it('Blockworld plays in a development run (pnpm dev), its script and all', async () => {
    // As milestone 16's development-run check: the dev server on its own,
    // the built app pointed at it, in a throwaway profile, offline.
    const req = createRequire(join(APP_DIR, 'package.json'));
    type DevServer = { listen(): Promise<unknown>; close(): Promise<void>; resolvedUrls: { local: string[] } | null };
    const vite = (await import(pathToFileURL(req.resolve('vite')).href)) as { createServer(options: object): Promise<DevServer> };
    const { VIEWER_DEPS } = (await import(pathToFileURL(join(APP_DIR, 'viewer-deps.mjs')).href)) as { VIEWER_DEPS: string[] };
    const dev = await vite.createServer({
      root: join(APP_DIR, 'src/renderer'),
      configFile: false,
      logLevel: 'warn',
      optimizeDeps: { include: VIEWER_DEPS },
      server: { port: 0, host: '127.0.0.1' },
    });
    await dev.listen();
    const devUrl = dev.resolvedUrls!.local[0]!.replace(/\/$/, '');
    const profile = mkdtempSync(join(tmpdir(), 'hypersol-e2e-dev-'));
    const env = { ...process.env, HYPERSOL_TEST: '1', HYPERSOL_TEST_BACKGROUND: '1', ELECTRON_RENDERER_URL: devUrl } as Record<string, string>;
    delete env['ELECTRON_RUN_AS_NODE'];
    const app = await electron.launch({
      executablePath: req('electron') as unknown as string,
      args: [APP_DIR, `--start-url=${url('blockworld/index.holoml')}`, `--hypersol-user-data=${profile}`, OFFLINE_RULES, ...graphicsSwitches()],
      env,
    });
    try {
      await app.firstWindow();
      const blocks = () =>
        app.evaluate(async ({ webContents }) => {
          const page = webContents.getAllWebContents().find((w) => w.getType() === 'webview' && w.getURL().includes('blockworld'));
          return page ? ((await page.executeJavaScript('window.blockworld ? window.blockworld.blocks : 0')) as number) : 0;
        });
      await waitFor('the island drawn by the script in a development run', blocks, (n) => n > 1000, 40_000);
    } finally {
      await app.close();
      await dev.close();
      await removeFolder(profile);
    }
  }, 120_000);
});
