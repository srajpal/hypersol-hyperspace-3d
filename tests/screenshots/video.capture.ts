/**
 * The one-minute video and the ten-second GIF (the promotion plan's step
 * 6, GitHub issue #93; TODO.md, "Issue #93", has the plan and the cut):
 *
 *   pnpm screenshots:video
 *
 * This file records the takes: the built app in a 1280 by 720 window,
 * the local copies in tests/fixtures served from 127.0.0.1 (no network),
 * the scenes driven with the harness's keys and clicks by the scene's own
 * clock, and the window captured every 1/30 s by the main process while
 * a take runs (JPEG, kept in memory, written after the take to
 * _video/frames/<take>/ with each frame's time in _video/takes.json).
 * tests/screenshots/video-encode.mjs then makes the WebM and the GIF (the
 * package script runs it after this file). Two title cards, plain pages
 * captured the same way, open and close the video.
 *
 * The scenes need the graphics card: drawn in software they look wrong,
 * so the run refuses to go on that way.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { startFixtureServer } from '../e2e/fixture-server';
import {
  clickAt,
  clickUntil,
  cycleToTab,
  focusedTab,
  inPage,
  launch,
  navigateTo,
  pressInShell,
  project,
  setContentSize,
  settled,
  shellCall,
  sleep,
  softwareRenderer,
  tabs,
  waitFor,
  waitForPage,
  type Harness,
  type Point,
} from '../e2e/harness';

const OUT = fileURLToPath(new URL('../../_video/', import.meta.url));
const WIDTH = 1280;
const HEIGHT = 720;
const RATE = 30;
const LOFT = 'harbour-loft/index.holoml';
const TERRACE = 'harbour-loft/terrace.holoml';

type Vec = [number, number, number];
/** A take as recorded: its frames in order with their times from the take's start, and for a card how long it holds. */
interface Take {
  name: string;
  frames: { t: number; file: string }[];
  hold?: number;
  gif?: boolean;
}

/** The main process's recording: a frame every 1/RATE s, kept in memory until the take ends. */
interface Recording {
  frames: { t: number; jpg: Buffer }[];
  busy: boolean;
  start: number;
  timer: ReturnType<typeof setInterval>;
}

function holo<T>(h: Harness, expression: string, page: string): Promise<T> {
  return inPage<T>(h, `window.__holoml ? (${expression}) : undefined`, page);
}

/** Sends a key down or up to a HoloML page. */
function key(h: Harness, page: string, keyCode: string, type: 'keyDown' | 'keyUp'): Promise<void> {
  return h.app.evaluate(
    ({ webContents }, { page, keyCode, type }) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(page)).pop();
      guest?.sendInputEvent({ type, keyCode });
    },
    { page, keyCode, type },
  );
}

/** Holds a key in a HoloML page for so many milliseconds of the scene's own clock (walking and turning need keys held). */
async function hold(h: Harness, page: string, keyCode: string, ms: number): Promise<void> {
  const clock = () => holo<number>(h, 'window.__holoml.clock', page);
  const from = await clock();
  await key(h, page, keyCode, 'keyDown');
  try {
    await waitFor(`${ms} ms with ${keyCode} held`, clock, (t) => t >= from + ms, ms * 2 + 10_000);
  } finally {
    await key(h, page, keyCode, 'keyUp');
  }
}

/** Where a thing of a HoloML page (by id) is on the screen, through the page's tilt. */
async function onScreen(h: Harness, page: string, id: string): Promise<Point> {
  const p = (await holo<Point | null>(h, `window.__holoml.point(${JSON.stringify(id)})`, page))!;
  return project(h, p.x, p.y);
}

/** Puts the viewer somewhere in a HoloML page, looking at a point. */
const stand = (h: Harness, page: string, at: Vec, look: Vec) =>
  inPage(h, `(holoml.viewer.position = ${JSON.stringify(at)}, holoml.viewer.lookAt(${JSON.stringify(look)}), true)`, page);

/** Follows a link of a HoloML page's outline by its words. */
const followLink = (h: Harness, page: string, label: string) =>
  inPage<boolean>(h, `(() => { const a = [...document.querySelectorAll('#holoml-outline a')].find((x) => x.textContent === ${JSON.stringify(label)}); a?.click(); return Boolean(a); })()`, page);

/** Presses a button of a HoloML page's outline by its words. */
const pressButton = (h: Harness, page: string, label: string) =>
  inPage<boolean>(h, `(() => { const b = [...document.querySelectorAll('#holoml-outline button')].find((x) => x.textContent === ${JSON.stringify(label)}); b?.click(); return Boolean(b); })()`, page);

async function ready(h: Harness, page: string): Promise<void> {
  await waitForPage(h, page);
  await waitFor(`${page} ready`, () => holo<boolean>(h, 'window.__holoml.ready', page), (r) => r === true, 30_000);
  await waitFor(`${page} drawn`, () => holo<boolean>(h, 'window.__holoml.frames > 0 && !window.__holoml.compiling', page), (v) => v, 30_000);
}

/** Starts the main process capturing the window every 1/RATE s. */
function startRecording(h: Harness): Promise<void> {
  return h.app.evaluate(({ BrowserWindow }, every) => {
    const win = BrowserWindow.getAllWindows()[0]!;
    const rec: Recording = { frames: [], busy: false, start: Date.now(), timer: undefined as unknown as ReturnType<typeof setInterval> };
    rec.timer = setInterval(() => {
      if (rec.busy) return;
      rec.busy = true;
      const t = Date.now() - rec.start;
      win.webContents
        .capturePage()
        .then((image) => rec.frames.push({ t, jpg: image.toJPEG(92) }))
        .catch(() => undefined)
        .finally(() => {
          rec.busy = false;
        });
    }, every);
    (globalThis as unknown as { __video?: Recording }).__video = rec;
  }, 1000 / RATE);
}

/** Stops the capture and brings the frames over, forty at a time, into _video/frames/<name>/. */
async function stopRecording(h: Harness, name: string): Promise<Take> {
  const count = await h.app.evaluate(async () => {
    const g = globalThis as unknown as { __video?: Recording };
    const rec = g.__video!;
    clearInterval(rec.timer);
    while (rec.busy) await new Promise((r) => setTimeout(r, 10));
    return rec.frames.length;
  });
  const dir = `${OUT}frames/${name}/`;
  mkdirSync(dir, { recursive: true });
  const frames: Take['frames'] = [];
  for (let from = 0; from < count; from += 40) {
    const chunk = await h.app.evaluate(
      (_, [a, b]) => {
        const rec = (globalThis as unknown as { __video?: Recording }).__video!;
        return rec.frames.slice(a, b).map((f) => ({ t: f.t, jpg: f.jpg.toString('base64') }));
      },
      [from, from + 40],
    );
    for (const f of chunk) {
      const file = `${String(frames.length).padStart(5, '0')}.jpg`;
      writeFileSync(`${dir}${file}`, Buffer.from(f.jpg, 'base64'));
      frames.push({ t: f.t, file: `frames/${name}/${file}` });
    }
  }
  await h.app.evaluate(() => {
    delete (globalThis as unknown as { __video?: Recording }).__video;
  });
  const seconds = frames.length > 0 ? (frames[frames.length - 1]!.t / 1000).toFixed(1) : '0';
  console.log(`[video] ${name}: ${frames.length} frames over ${seconds} s (${((frames.length * 1000) / Math.max(1, frames[frames.length - 1]?.t ?? 1)).toFixed(0)} a second)`);
  return { name, frames };
}

/** A title card: a plain page drawn by an offscreen window of the app's Electron, as one frame held for a while. */
async function card(h: Harness, name: string, html: string, holdMs: number): Promise<Take> {
  const jpg = await h.app.evaluate(
    async ({ BrowserWindow }, { html, width, height }) => {
      const win = new BrowserWindow({ width, height, show: false, frame: false, webPreferences: { offscreen: true, sandbox: true } });
      try {
        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        await win.webContents.executeJavaScript('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))', true);
        const image = await win.webContents.capturePage({ x: 0, y: 0, width, height });
        return image.resize({ width, height }).toJPEG(95).toString('base64');
      } finally {
        win.destroy();
      }
    },
    { html, width: WIDTH, height: HEIGHT },
  );
  const dir = `${OUT}frames/${name}/`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}00000.jpg`, Buffer.from(jpg, 'base64'));
  return { name, frames: [{ t: 0, file: `frames/${name}/00000.jpg` }], hold: holdMs };
}

const CARD_STYLE = `html,body{margin:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#07090f;color:#e8ecf8;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  h1{margin:0 0 14px;font-size:64px;font-weight:700}p{margin:0;font-size:30px;color:#9ff6ff;max-width:980px;line-height:1.35}
  .small{font-size:24px;color:#aab2c0;margin-top:26px}`;

it('records the takes of the video and the GIF', async () => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(`${OUT}frames/`, { recursive: true });
  const server = await startFixtureServer();
  const h = await launch(server.url('readme/field-notes.html'));
  const takes: Take[] = [];
  const take = async (name: string, fn: () => Promise<void>, gif = false): Promise<void> => {
    await startRecording(h);
    try {
      await fn();
    } finally {
      const t = await stopRecording(h, name);
      t.gif = gif || undefined;
      takes.push(t);
    }
  };
  /** Everything lifted from the page in front has come and stands still. */
  const still = (count: number) =>
    waitFor('lifted and still', () => shellCall(h, 'lifted'), (l) => l.objects.length === count && l.objects.every((o) => o.state === 'ready' && !o.moving), 60_000);
  const tabOf = async (part: string) => (await tabs(h)).find((t) => t.url.includes(part))!.id;
  try {
    const software = await softwareRenderer(h);
    if (software) throw new Error(`The video needs the graphics card; this run draws in software (${software}).`);
    await waitForPage(h, 'field-notes.html');
    await setContentSize(h, WIDTH, HEIGHT);
    await settled(h);
    for (const page of ['showroom/index.holoml', 'blockworld/index.holoml?hour=16.3', LOFT]) {
      await pressInShell(h, 'T', ['control']);
      await sleep(500);
      await shellCall(h, 'showUrl', server.url(`holoml/${page}`));
      await ready(h, page.split('?')[0]!);
      await settled(h);
      await sleep(1500); // the tab's snapshot for its card
    }
    const notes = await tabOf('field-notes');
    const loft = await tabOf('harbour-loft');

    // 1. The title card.
    takes.push(
      await card(
        h,
        '01-title',
        `<style>${CARD_STYLE}</style><h1>HyperSol HyperSpace 3D</h1><p>A free, open-source desktop browser with a 3D interface</p><p class="small">Ordinary websites in a 3D room, and fully 3D sites written in HoloML</p>`,
        6000,
      ),
    );

    // 2. The room: four tabs as cards, the page on the tilted panel, switching tabs.
    await cycleToTab(h, notes);
    await settled(h);
    await sleep(800);
    await take('02-room', async () => {
      await sleep(1800);
      for (let i = 0; i < 3; i++) {
        await pressInShell(h, 'Tab', ['control']);
        await settled(h);
        await sleep(1400);
      }
    });

    // 3. Harbour Loft: in from the hall, the study door, the hall lamp, and up to the terrace.
    await cycleToTab(h, loft);
    await settled(h);
    await stand(h, LOFT, [1.3, 1.65, -0.6], [-3, 1, 3]);
    await sleep(600);
    await take('03-loft-walk', async () => {
      await sleep(500);
      await hold(h, LOFT, 'W', 2000);
      await hold(h, LOFT, 'Right', 800);
      await sleep(500);
      await hold(h, LOFT, 'Left', 1200);
      await sleep(600);
    });
    await stand(h, LOFT, [-0.9, 1.6, -2.55], [-2, 1.1, -2.55]);
    await sleep(600);
    await take('04-loft-door', async () => {
      await sleep(500);
      await clickAt(h, await onScreen(h, LOFT, 'study-door'));
      await sleep(1600);
      await hold(h, LOFT, 'W', 2400);
      await sleep(500);
    });
    await stand(h, LOFT, [0.7, 1.6, -1.2], [-0.8, 1.4, -3.75]);
    await sleep(600);
    await take('05-loft-lamp', async () => {
      await sleep(500);
      const lit = async () => (await holo<{ trigger: string | null; pressed: string | null }[]>(h, 'window.__holoml.actions()', LOFT)).some((a) => a.trigger === 'hall-switch' && a.pressed === 'true');
      const sw = await holo<Point | null>(h, "window.__holoml.point('hall-switch')", LOFT);
      if (sw) await clickUntil(h, await project(h, sw.x, sw.y), 'the hall light', lit).catch(() => pressButton(h, LOFT, 'Hall light'));
      else await pressButton(h, LOFT, 'Hall light');
      await sleep(2200);
    });
    await pressButton(h, LOFT, 'Go to: By the door to the terrace');
    await sleep(800);
    await stand(h, LOFT, [-3.5, 1.6, 0.9], [-6.1, 1.0, 0.42]);
    await sleep(600);
    await take(
      '06-loft-terrace',
      async () => {
        await sleep(600);
        await hold(h, LOFT, 'W', 250);
        await sleep(300);
        // The door in the brick wall: clicked where it is seen (again if the click is lost, as clicks are now and
        // then), or through its link in the page's outline when the walker stands too near to see it whole.
        const door = await holo<Point | null>(h, "window.__holoml.point('stairs-door')", LOFT);
        const up = async () => (await focusedTab(h)).url.includes('terrace.holoml');
        if (door) {
          await clickUntil(h, await project(h, door.x, door.y), 'the roof terrace', up).catch(async () => {
            console.log('[video] the door took no click; its link followed instead');
            await followLink(h, LOFT, 'Up to the roof terrace');
          });
        } else {
          console.log('[video] the door is not in view; its link followed');
          await followLink(h, LOFT, 'Up to the roof terrace');
        }
        await waitFor('the roof terrace', up, (v) => v, 20_000);
        await waitForPage(h, 'harbour-loft/terrace', 20_000);
        await ready(h, TERRACE);
        await sleep(900);
        await hold(h, TERRACE, 'W', 2000);
        await hold(h, TERRACE, 'Right', 900);
        await sleep(500);
        await hold(h, TERRACE, 'Left', 1000);
        await sleep(1300);
      },
      true,
    );

    // 4. Lifting into the room: a web page's pictures, then a shop page's shoes, one nearer and turned.
    await cycleToTab(h, notes);
    await settled(h);
    await sleep(600);
    await take('07-lift-pictures', async () => {
      await sleep(600);
      await h.shell.click('hs-toolbar [data-testid="lift"]');
      await still(1);
      await sleep(900);
      await inPage(h, 'document.querySelector(".week").scrollIntoView({ behavior: "smooth" })', 'field-notes');
      await sleep(1200);
      await h.shell.click('hs-toolbar [data-testid="lift"]');
      await still(4);
      await sleep(1500);
    });
    await h.shell.evaluate(() => document.querySelector('hs-notice')?.hide());
    await navigateTo(h, server.url('lift/showcase.html'));
    await waitForPage(h, 'lift/showcase');
    await settled(h);
    await sleep(800);
    await take('08-lift-shoes', async () => {
      await sleep(500);
      await h.shell.click('hs-toolbar [data-testid="lift"]');
      await still(5);
      await h.shell.evaluate(() => document.querySelector('hs-notice')?.hide());
      await sleep(600);
      await h.shell.locator('[data-testid="lifted-object"]').first().focus();
      await h.shell.keyboard.press('Enter');
      for (const k of ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp']) {
        await h.shell.keyboard.press(k);
        await sleep(350);
      }
      await waitFor('nearer', () => shellCall(h, 'lifted'), (l) => l.objects[0]!.near && !l.objects[0]!.moving);
      await sleep(600);
      for (let i = 0; i < 6; i++) {
        await h.shell.keyboard.press('ArrowLeft');
        await sleep(300);
      }
      await sleep(1200);
    });
    await h.shell.locator('[data-testid="lifted-object"]').first().focus();
    await h.shell.keyboard.press('Escape');
    await h.shell.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await sleep(600);

    // 5. Looking around the room, and back to the page.
    await take('09-look-around', async () => {
      await sleep(400);
      await pressInShell(h, 'K', ['control', 'shift']);
      await sleep(400);
      for (let i = 0; i < 6; i++) {
        await pressInShell(h, 'Right');
        await sleep(160);
      }
      for (let i = 0; i < 4; i++) {
        await pressInShell(h, 'Up');
        await sleep(160);
      }
      for (let i = 0; i < 2; i++) {
        await pressInShell(h, 'S');
        await sleep(160);
      }
      await waitFor('there', () => shellCall(h, 'look'), (l) => l.goal.yaw !== 0 && !l.moving);
      await sleep(1400);
      await pressInShell(h, 'Home');
      await waitFor('back at the desk', () => shellCall(h, 'look'), (l) => !l.active);
      await settled(h);
      await sleep(1000);
    });

    // 6. The closing card.
    takes.push(
      await card(
        h,
        '10-closing',
        `<style>${CARD_STYLE}</style><h1>srajpal.github.io/hypersol-hyperspace-3d</h1><p>Free and open source, Apache 2.0, for Windows, macOS, and Linux</p><p class="small">HoloML, the markup language for 3D websites: github.com/srajpal/holoml</p>`,
        4000,
      ),
    );
  } finally {
    writeFileSync(`${OUT}takes.json`, JSON.stringify({ width: WIDTH, height: HEIGHT, rate: RATE, takes }, null, 2));
    await h.close();
    await server.close();
  }
}, 600_000);
