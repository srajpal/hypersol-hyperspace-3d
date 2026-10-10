/**
 * GitHub issue #75, checks FS1 to FS7 (TODO.md, "Issue #75"): full
 * screen and pointer lock for web pages, with the browser's own notice and
 * Escape that always leaves. The fixture page (tests/fixtures/
 * fullscreen.html) asks for each from a click on its button, and tries to
 * keep both: it stops Escape and replaces the document's ways out.
 *
 * Full screen here is the system's: the test window comes onto the screen
 * while a check holds it, and goes back after.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  caughtUp,
  clickAt,
  clickUntil,
  describeMissedClick,
  focusedPage,
  inPage,
  launch,
  mainLog,
  navigateTo,
  newProfile,
  pressInPage,
  pressInShell,
  screenPointOf,
  sceneWait,
  settled,
  SHOW_WINDOWS,
  shellCall,
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

const events = (h: Harness, page = 'fullscreen.html') => inPage<string[]>(h, 'window.__fixture.events', page);
const notice = (h: Harness) => shellCall(h, 'holdNotice');
const windowState = (h: Harness) =>
  h.app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]!;
    return { full: w.isFullScreen(), bounds: w.getBounds(), content: w.getContentBounds() };
  });
const site = () => new URL(server.base).host;

/** The window's size and place before the last full screen: leaving must bring them back exactly (FS2). */
let windowBefore: { x: number; y: number; width: number; height: number } | null = null;

/** Clicks the page's full-screen button, and waits until the page fills the screen and the notice shows. */
async function goFull(h: Harness, page = 'fullscreen.html'): Promise<void> {
  windowBefore = (await windowState(h)).bounds;
  const before = (await events(h, page)).filter((e) => e === 'in').length;
  const at = await screenPointOf(h, '#full', page);
  const went = async () => (await events(h, page)).filter((e) => e === 'in').length > before;
  // A click that misses says what it found there, the window's size and place, and the room's layout.
  await clickUntil(h, at, 'full screen', went, {}, async () =>
    JSON.stringify({ at: await describeMissedClick(h, at, went), window: await windowState(h), inner: await h.shell.evaluate(() => [innerWidth, innerHeight]), layout: await shellCall(h, 'layout') }),
  );
  await waitFor('the window full screen', () => windowState(h), (w) => w.full);
  await waitFor('the notice', () => notice(h), (n) => n.open && n.holding.some((x) => x.full));
}

/**
 * Out of full screen: the window is back, nothing holds, and the room and
 * the page in front are laid out for the window again (a click aimed
 * before that missed: the page was still the screen's size).
 */
async function outOfFull(h: Harness, what: string): Promise<void> {
  const was = windowBefore;
  await waitFor(`${what}: the window back where it was`, () => windowState(h), (w) => !w.full && (was === null || JSON.stringify(w.bounds) === JSON.stringify(was)));
  await waitFor(`${what}: nothing held`, () => notice(h), (n) => n.holding.length === 0);
  await waitFor(
    `${what}: laid out again`,
    async () => {
      const layout = await shellCall(h, 'layout');
      const inner = await h.shell.evaluate(() => [window.innerWidth, window.innerHeight]);
      // The browser's own page is as large as its window (on Linux it was once left at 1 by 1: main/fullscreen.ts).
      const { content } = await windowState(h);
      if (Math.abs(inner[0]! - content.width) > 2 || Math.abs(inner[1]! - content.height) > 2) return false;
      // A tab with the start panel has no web page to measure.
      const page = await focusedPage(h)
        .then((p) => inPage<number>(h, 'window.innerWidth', p))
        .catch(() => null);
      return layout.viewportWidth === inner[0] && layout.viewportHeight === inner[1] && (page === null || Math.abs(page - layout.panelWidth) <= 1);
    },
    (ok) => ok,
  );
  await settled(h);
}

describe('FS1 to FS4: full screen', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url('fullscreen.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    await waitForPage(h, 'fullscreen.html');
  });
  afterAll(async () => h?.close());

  it('FS3 a page that asks without a click is refused, as before', async () => {
    // Run as the page's own script would be, with no click: the harness's inPage runs code as if after one, and a
    // click's activation lasts a few seconds, so the page is first left until it has none.
    const run = (code: string) =>
      h.app.evaluate(
        ({ webContents }, c) => webContents.getAllWebContents().find((w) => w.getType() === 'webview' && w.getURL().includes('fullscreen.html'))!.executeJavaScript(c, false),
        code,
      );
    await waitFor('no activation left in the page', () => run('navigator.userActivation.isActive'), (active) => active === false, 15_000);
    const asked = await run('askWithoutClick()');
    expect(asked).toMatch(/^refused:/);
    expect((await windowState(h)).full).toBe(false);
    expect((await notice(h)).open).toBe(false);
  });

  it('FS1 and FS4 a click on the full-screen button fills the screen with the page\'s box; the browser\'s notice names the site and says how to leave, over the page', async () => {
    const before = await windowState(h);
    await goFull(h);
    expect(await inPage<string | null>(h, 'document.fullscreenElement && document.fullscreenElement.id', 'fullscreen.html')).toBe('stage');
    const n = await notice(h);
    expect(n.text).toBe(`${site()} is full screen. Press Esc to leave.`);
    expect(await h.shell.locator('hs-hold-notice').evaluate((e) => e.matches(':popover-open'))).toBe(true);
    // Drawn over the page: the shell's picture at the notice's middle is the notice, not the page's blue box.
    const at = await h.shell.locator('hs-hold-notice').evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.left + 10), y: Math.round(r.top + r.height / 2) };
    });
    const pixel = await h.app.evaluate(async ({ BrowserWindow }, p) => {
      const image = await BrowserWindow.getAllWindows()[0]!.webContents.capturePage({ x: p.x, y: p.y, width: 1, height: 1 });
      return [...image.toBitmap().subarray(0, 3)];
    }, at);
    // The page's box is #2050c0 (a bitmap is blue, green, red).
    expect(Math.abs(pixel[0]! - 0xc0) + Math.abs(pixel[1]! - 0x50) + Math.abs(pixel[2]! - 0x20), JSON.stringify(pixel)).toBeGreaterThan(40);
    // It goes after a few seconds.
    await waitFor('the notice gone', () => notice(h), (x) => !x.open, 8000);
    // And comes back when the pointer reaches the top of the screen. The moves are given to the page itself, as
    // the key checks' are: sent through the shell, now and then a batch reached nothing at all just after the
    // window changed size (one run in about eight; milestone 2 knew input lost that way). Moved down and up
    // again until it shows (the browser listens at most every 1.5 seconds).
    const movePage = (y: number) =>
      h.app.evaluate(({ webContents }, y) => {
        const page = webContents.getAllWebContents().find((w) => w.getType() === 'webview' && w.getURL().includes('fullscreen.html'))!;
        page.sendInputEvent({ type: 'mouseMove', x: 400, y });
      }, y);
    let shown = false;
    for (let attempt = 0; attempt < 4 && !shown; attempt++) {
      for (const y of [300, 200, 100, 1]) await movePage(y);
      shown = await waitFor('the notice again', () => notice(h), (x) => x.open, 2500).then(() => true, () => false);
    }
    expect(shown, `the notice shown again at the top edge (the main process told the shell ${JSON.stringify(await mainLog(h, 'fullscreenEdges'))})`).toBe(true);
    // FS2 below needs the window as it was.
    expect(before.full).toBe(false);
  });

  it('FS2 Escape leaves though the page stops it and replaces the document\'s way out; the window and the page are as before', async () => {
    const escapes = await inPage<number>(h, 'window.__fixture.escapes', 'fullscreen.html');
    await pressInPage(h, 'Escape', [], 'fullscreen.html');
    await outOfFull(h, 'Escape');
    expect(await events(h)).toContain('out');
    expect((await notice(h)).open).toBe(false);
    // The page never saw the key.
    expect(await inPage<number>(h, 'window.__fixture.escapes', 'fullscreen.html')).toBe(escapes);
    const after = await windowState(h);
    await waitFor('the room laid out for the window again', () => shellCall(h, 'layout'), (l) => l.viewportWidth > 0 && l.viewportWidth < after.bounds.width + 1);
  });

  it("FS2 the page's own way out, a new tab, and leaving the page also leave", async () => {
    // The page's own way out (it replaced exitFullscreen with one that does nothing; the older name still works).
    await goFull(h);
    await inPage(h, 'void document.webkitExitFullscreen()', 'fullscreen.html');
    await outOfFull(h, "the page's own way out");
    // A new tab: the page in full screen is no longer in front.
    await goFull(h);
    await pressInPage(h, 'T', ['control'], 'fullscreen.html');
    await outOfFull(h, 'a new tab');
    await pressInShell(h, 'W', ['control']);
    await waitForPage(h, 'fullscreen.html');
    // Leaving the page.
    await goFull(h);
    await h.app.evaluate(({ webContents }) => webContents.getAllWebContents().find((w) => w.getType() === 'webview' && w.getURL().includes('fullscreen.html'))!.loadURL('about:blank'));
    await outOfFull(h, 'leaving the page');
  });
});

describe('FS2: closing the tab', () => {
  it('closing a tab in full screen leaves, and the window is back', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    try {
      await waitForPage(h, 'link-a');
      await pressInShell(h, 'T', ['control']);
      await navigateTo(h, server.url('fullscreen.html'));
      await waitForPage(h, 'fullscreen.html');
      await goFull(h);
      await pressInPage(h, 'W', ['control'], 'fullscreen.html');
      await outOfFull(h, 'closing the tab');
      await waitForPage(h, 'link-a');
    } finally {
      await h.close();
    }
  });
});

describe('FS5: pointer lock', () => {
  it('a click holds the pointer; the notice says so; Escape gives it back though the page stops it', async (ctx) => {
    // Chromium gives the pointer only to a page in a window that has the system's focus, and test windows never
    // take it (they stay out of the way); with HYPERSOL_TEST_SHOW=1 they do. Reported as skipped otherwise.
    if (!SHOW_WINDOWS) {
      console.log('FS5: pointer lock needs a window with the system\'s focus; run with HYPERSOL_TEST_SHOW=1');
      ctx.skip('pointer lock needs a window with the system\'s focus (HYPERSOL_TEST_SHOW=1)');
    }
    const h = await launch(server.url('fullscreen.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    try {
      await waitForPage(h, 'fullscreen.html');
      await clickUntil(h, await screenPointOf(h, '#lock', 'fullscreen.html'), 'the pointer held', async () => (await events(h)).includes('locked'));
      const n = await waitFor('the notice', () => notice(h), (x) => x.open && x.holding.some((p) => p.locked));
      expect(n.text).toBe(`${site()} has the pointer. Press Esc to get it back.`);
      expect((await windowState(h)).full).toBe(false);
      await pressInPage(h, 'Escape', [], 'fullscreen.html');
      await waitFor('the pointer given back', () => events(h), (e) => e.includes('unlocked'));
      await waitFor('nothing held', () => notice(h), (x) => x.holding.length === 0 && !x.open);
      expect(await inPage<number>(h, 'window.__fixture.escapes', 'fullscreen.html')).toBe(0);
    } finally {
      await h.close();
    }
  });
});

describe('FS6 and FS7: other states, and screen readers', () => {
  it('a private tab the same; looking around is not offered while full; lifted objects are behind the page and back after', async () => {
    const h = await launch(server.url('fullscreen.html'), { userDataDir: newProfile({ parallax: 'off' }) });
    try {
      await waitForPage(h, 'fullscreen.html');
      // A picture lifted into the room (milestone 28).
      await h.shell.click('hs-toolbar [data-testid="lift"]');
      const lifted = await waitFor('lifted', () => shellCall(h, 'lifted'), (l) => l.objects.length === 1 && l.objects.every((o) => !o.moving));
      await goFull(h);
      // FS7: the notice is a status that screen readers hear.
      expect(await h.shell.locator('hs-hold-notice').locator('[data-testid="hold-notice-text"]').getAttribute('role')).toBe('status');
      // Looking around is not offered meanwhile.
      await pressInPage(h, 'K', ['control', 'shift'], 'fullscreen.html');
      await caughtUp(h, 'fullscreen.html');
      expect((await shellCall(h, 'look')).active).toBe(false);
      await pressInPage(h, 'Escape', [], 'fullscreen.html');
      await outOfFull(h, 'Escape');
      const back = await waitFor('the lifted picture back in the arc', () => shellCall(h, 'lifted'), (l) => l.objects.length === 1 && l.rail && !l.objects[0]!.moving);
      expect(back.objects[0]!.name).toBe(lifted.objects[0]!.name);
      // A private tab.
      await pressInShell(h, 'N', ['control', 'shift']);
      await navigateTo(h, server.url('fullscreen.html?private=1'));
      await waitForPage(h, 'private=1');
      await goFull(h, 'private=1');
      await pressInPage(h, 'Escape', [], 'private=1');
      await outOfFull(h, 'a private tab');
    } finally {
      await h.close();
    }
  });

  it("a HoloML page's script may ask on a click, as a web page's may", async () => {
    const h = await launch(server.url('holoml/fullscreen.holoml'), { userDataDir: newProfile({ parallax: 'off' }) });
    try {
      await waitForPage(h, 'fullscreen.holoml', await sceneWait(h, 15_000));
      const page = await focusedPage(h);
      await waitFor('the scene ready', () => inPage<boolean>(h, 'window.__holoml ? window.__holoml.ready : false', page), (r) => r, 30_000);
      const box = await h.shell.evaluate(() => {
        const r = document.querySelector('[data-testid="page-panel"][aria-hidden="false"]')!.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await clickAt(h, box);
      await waitFor('full screen', () => inPage<string[]>(h, 'window.fullscreenEvents', page), (e) => e.includes('in'));
      await waitFor('the notice', () => notice(h), (n) => n.open && n.text.endsWith('is full screen. Press Esc to leave.'));
      await pressInPage(h, 'Escape', [], page);
      await outOfFull(h, 'Escape on a HoloML page');
    } finally {
      await h.close();
    }
  });
});
