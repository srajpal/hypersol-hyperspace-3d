/**
 * Progress screenshots (owner request, prompt 20): captures the main
 * screens of the built app into docs/screenshots/<milestone>/.
 *
 *   MILESTONE=m3 pnpm screenshots
 *
 * Uses Electron's own window capture: Playwright's screenshots can show a
 * page wider than it is. Pages are the local test fixtures, so no real
 * browsing data appears.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { startFixtureServer } from '../e2e/fixture-server';
import {
  clickAt,
  clickCard,
  focusedPage,
  inPage,
  launch,
  screenPointOf,
  shellCall,
  navigateTo,
  pressInPage,
  pressInShell,
  settled,
  sleep,
  tabs,
  waitFor,
  waitForPage,
  type Harness,
} from '../e2e/harness';

const STAR = 'hs-toolbar [data-testid="star"]';
const milestone = process.env['MILESTONE'];
const outDir = fileURLToPath(new URL(`../../docs/screenshots/${milestone ?? 'unknown'}/`, import.meta.url));

async function capture(h: Harness, name: string): Promise<void> {
  await sleep(600); // let snapshots, favicons, and animations finish
  const png = await h.app.evaluate(async ({ BrowserWindow }) => {
    const image = await BrowserWindow.getAllWindows()[0]!.webContents.capturePage();
    return image.toPNG().toString('base64');
  });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(png, 'base64'));
}

it('captures the main screens', async () => {
  if (!milestone || !/^m\d+$/.test(milestone)) {
    throw new Error('Set MILESTONE, for example MILESTONE=m3 pnpm screenshots');
  }
  mkdirSync(outDir, { recursive: true });
  const server = await startFixtureServer();
  const downloads = mkdtempSync(join(tmpdir(), 'hypersol-shots-downloads-'));
  const h = await launch(server.url('link-a.html'), { searchUrl: `${server.base}search?q=%s`, downloadsDir: downloads });
  try {
    await waitForPage(h, 'link-a');
    for (const page of ['form.html', 'long.html']) {
      await pressInShell(h, 'T', ['control']);
      await settled(h);
      await navigateTo(h, server.url(page));
      await waitForPage(h, page.replace('.html', ''));
    }
    await sleep(800);
    await clickCard(h, (await tabs(h))[0]!.id);
    await waitForPage(h, 'link-a');
    // Bookmark this page, so the star, start panel, and Library have data.
    await waitFor('star ready', () => h.shell.locator(STAR).isDisabled(), (d) => !d);
    await h.shell.click(STAR);
    await waitFor('bookmarked', () => h.shell.locator(STAR).getAttribute('aria-pressed'), (p) => p === 'true');
    await capture(h, '1-tabs');

    await pressInShell(h, 'T', ['control']);
    await settled(h);
    await capture(h, '2-start-panel');

    await navigateTo(h, 'http://notfound.test/');
    await sleep(600);
    await capture(h, '3-error-card');

    await pressInShell(h, 'O', ['control', 'shift']);
    await h.shell.click('hs-library [data-testid="lib-tab-history"]');
    await capture(h, '4-library-history');
    await pressInShell(h, ',', ['control']);
    await capture(h, '5-settings');
    // Scroll the Settings panel to its privacy part (milestone 4).
    await h.shell.evaluate(() => {
      const body = document.querySelector('hs-settings')?.shadowRoot?.querySelector('.body');
      body?.querySelector('[data-testid="set-dns-secure"]')?.scrollIntoView({ block: 'start' });
    });
    await capture(h, '6-settings-privacy');
    await pressInShell(h, 'Escape');

    // The privacy shield (milestone 4): a page with a tracker and an ad, on a named test host.
    await navigateTo(h, server.url('shield.html').replace('127.0.0.1', 'shop.test'));
    await waitForPage(h, 'shield.html');
    await waitFor('shield count', () => h.shell.evaluate(() => (document.querySelector('hs-shield') as (Element & { count?: number }) | null)?.count ?? 0), (n) => n > 0);
    await h.shell.click('hs-shield [data-testid="shield"]');
    await capture(h, '7-shield-popover');
    await pressInShell(h, 'Escape');
    await navigateTo(h, server.url('ddm/clk/landing').replace('127.0.0.1', 'ad.doubleclick.net'));
    await sleep(600);
    await capture(h, '8-blocked-card');

    // The layers view (milestone 5): a page broken apart into layers, then flat.
    await navigateTo(h, server.url('layers.html'));
    await waitForPage(h, 'layers.html');
    await sleep(800);
    await capture(h, '9-layers-view');
    await pressInShell(h, 'L', ['control', 'shift']);
    await sleep(600);
    await capture(h, '10-layers-off');
    await pressInShell(h, 'L', ['control', 'shift']);
    await pressInShell(h, ',', ['control']);
    await h.shell.evaluate(() => {
      const body = document.querySelector('hs-settings')?.shadowRoot?.querySelector('.body');
      body?.querySelector('[data-testid="set-layers-on-open"]')?.scrollIntoView({ block: 'start' });
    });
    await capture(h, '11-settings-layers');
    await pressInShell(h, 'Escape');

    // Daylight (milestone 6): the same screens in the light theme.
    await h.shell.click('hs-theme-button [data-testid="theme"]');
    await waitFor('Daylight', () => h.shell.evaluate(() => document.documentElement.style.colorScheme), (s) => s === 'light');
    await sleep(400);
    await capture(h, '12-daylight-layers');
    await navigateTo(h, server.url('link-a.html'));
    await waitForPage(h, 'link-a');
    await capture(h, '13-daylight-tabs');
    await pressInShell(h, ',', ['control']);
    await capture(h, '14-daylight-settings');
    await pressInShell(h, 'Escape');
    await navigateTo(h, server.url('shield.html').replace('127.0.0.1', 'shop.test'));
    await waitForPage(h, 'shield.html');
    await h.shell.click('hs-shield [data-testid="shield"]');
    await capture(h, '15-daylight-shield');
    await pressInShell(h, 'Escape');

    // The instrument panel (milestone 7), in Daylight and then Nebula.
    await navigateTo(h, server.url('inspect.html'));
    await waitForPage(h, 'inspect.html');
    await pressInShell(h, 'L', ['control', 'shift']); // flat page, to see the readouts beside it
    await pressInShell(h, 'I', ['control', 'shift']);
    await sleep(2500);
    await capture(h, '16-daylight-instruments');
    await h.shell.click('hs-theme-button [data-testid="theme"]');
    await sleep(1500);
    await capture(h, '17-nebula-instruments');
    await pressInShell(h, ',', ['control']);
    await h.shell.evaluate(() => {
      const body = document.querySelector('hs-settings')?.shadowRoot?.querySelector('.body');
      body?.querySelector('[data-testid="set-instruments"]')?.scrollIntoView({ block: 'start' });
    });
    await capture(h, '18-settings-instruments');
    await pressInShell(h, 'Escape');
    await h.shell.click('hs-instruments [data-testid="inst-max-network"]');
    await sleep(500);
    await capture(h, '19-network-maximized');
    await pressInShell(h, 'Escape');
    await pressInShell(h, 'I', ['control', 'shift']); // instrument panel off again

    // Everyday features (milestone 8): zoom, find, downloads, a private tab.
    await navigateTo(h, server.url('find.html'));
    await waitForPage(h, 'find');
    await h.shell.click('hs-toolbar [data-testid="zoom-in"]');
    await h.shell.click('hs-toolbar [data-testid="zoom-in"]');
    await pressInShell(h, 'F', ['control']);
    await h.shell.fill('hs-find-bar [data-testid="find-input"]', 'needle');
    await sleep(600);
    await capture(h, '20-zoom-and-find');
    await pressInShell(h, 'Escape');
    await h.shell.click('hs-toolbar [data-testid="zoom-level"]');
    await navigateTo(h, server.url('download/sample.txt'));
    await sleep(800);
    await pressInShell(h, 'J', ['control']);
    await sleep(400);
    await capture(h, '21-downloads');
    await pressInShell(h, 'Escape');
    await pressInShell(h, 'N', ['control', 'shift']);
    await sleep(600);
    await capture(h, '22-private-tab');
    await pressInShell(h, 'W', ['control']);
    await h.shell.evaluate(() => (document.querySelector('hs-notice') as unknown as { hide(): void }).hide()); // the download notice from above

    // Passwords, site permissions, and the milestone 8 feedback (milestone 9).
    // Made-up test sign-ins on a local page.
    await navigateTo(h, server.url('login.html'));
    await waitForPage(h, 'login');
    let page = await focusedPage(h);
    await inPage(h, `document.getElementById('user').value = 'ada'; document.getElementById('pass').value = 'test-pass-1'; true`, page);
    await clickAt(h, await screenPointOf(h, '#go', page));
    await waitFor('offer', async () => (await shellCall(h, 'prompts')).offer, (o) => o !== null);
    await capture(h, '23-password-offer');
    await h.shell.click('hs-prompts [data-testid="pw-save"]');
    await navigateTo(h, server.url('login.html?again=1'));
    await waitForPage(h, 'again=1');
    page = await focusedPage(h);
    await clickAt(h, await screenPointOf(h, '#user', page));
    await waitFor('account list', () => inPage<boolean>(h, `document.querySelector('hypersol-sign-ins') !== null`, page), (x) => x);
    await capture(h, '24-sign-in-list');
    await pressInPage(h, 'Escape', [], page); // closes the list
    await pressInShell(h, 'O', ['control', 'shift']);
    await h.shell.click('hs-library [data-testid="lib-tab-passwords"]');
    await capture(h, '25-library-passwords');
    await pressInShell(h, 'Escape');
    await navigateTo(h, server.url('media.html'));
    await waitForPage(h, 'media');
    page = await focusedPage(h);
    const asked = inPage<string>(h, 'both()', page);
    await waitFor('prompt', async () => (await shellCall(h, 'prompts')).permission, (x) => x !== null);
    await capture(h, '26-permission-prompt');
    await h.shell.click('hs-prompts [data-testid="perm-allow"]');
    await asked;
    await h.shell.click('hs-toolbar [data-testid="site-button"]');
    await capture(h, '27-site-panel');
    await pressInShell(h, 'Escape');
    await navigateTo(h, server.url('download/sample.txt'));
    await waitFor('notice', () => shellCall(h, 'notice'), (n) => n !== null);
    await capture(h, '28-download-notice');
    await h.shell.click('hs-toolbar [data-testid="new-tab-more"]');
    await capture(h, '29-new-tab-menu');
    await pressInShell(h, 'Escape');
    await h.shell.evaluate(() => (document.querySelector('hs-notice') as unknown as { hide(): void }).hide());

    // Tabs and economy (milestone 10): sound and a sleeping tab on the cards,
    // tab search, the list in the top bar, and economy mode.
    const setSettings = (patch: object) =>
      h.shell.evaluate(async (p) => {
        const w = window as unknown as { hypersol: { data(r: object): Promise<unknown> } };
        await w.hypersol.data({ op: 'settings.set', patch: p });
      }, patch);
    await navigateTo(h, server.url('sound.html'));
    await waitForPage(h, 'sound');
    await inPage(h, 'play()', await focusedPage(h));
    await waitFor('sound', async () => (await tabs(h)).some((t) => t.audible), (x) => x);
    await capture(h, '30-sound-on-card');
    await pressInShell(h, 'A', ['control', 'shift']);
    await sleep(300);
    await capture(h, '31-tab-search');
    await pressInShell(h, 'Escape');
    await setSettings({ tabDisplay: 'list' });
    await sleep(600);
    await capture(h, '32-tab-list');
    await setSettings({ tabDisplay: 'cards', economy: 'on' });
    await pressInShell(h, ',', ['control']);
    await h.shell.evaluate(() => {
      const body = document.querySelector('hs-settings')?.shadowRoot?.querySelector('.body');
      body?.querySelector('[data-testid="set-tab-size"]')?.scrollIntoView({ block: 'start' });
    });
    await sleep(400);
    await capture(h, '33-economy-and-tabs-settings');
    await pressInShell(h, 'Escape');
    await setSettings({ economy: 'battery' });

    // Milestone 11: the wider page, address bar completion, the new Settings.
    await h.shell.evaluate(() => (document.querySelector('hs-notice') as unknown as { hide(): void }).hide());
    await navigateTo(h, server.url('link-a.html'));
    await waitForPage(h, 'link-a');
    await capture(h, '34-wider-page');
    const input = h.shell.locator('hs-toolbar [data-testid="address"]');
    await input.click();
    await input.pressSequentially('127.0.0.1');
    await waitFor('suggestions', () => h.shell.locator('hs-toolbar [data-testid="suggestion"]').count(), (n) => n > 0);
    await sleep(300);
    await capture(h, '35-address-completion');
    await input.press('Escape');
    await input.press('Escape');
    await pressInShell(h, ',', ['control']);
    await h.shell.click('hs-settings [data-testid="set-nav-appearance"]');
    await capture(h, '36-settings-appearance');
    await h.shell.fill('hs-settings [data-testid="set-search"]', 'camera');
    await sleep(300);
    await capture(h, '37-settings-search');
    await h.shell.fill('hs-settings [data-testid="set-search"]', '');
    await h.shell.click('hs-settings [data-testid="set-nav-shortcuts"]');
    await capture(h, '38-settings-shortcuts');
    await pressInShell(h, 'Escape');

    // Milestone 12: the version and copyright in About, and the notice on
    // a computer that cannot draw the 3D room.
    await h.shell.click('hs-toolbar [data-testid="menu"]');
    await h.shell.click('hs-toolbar [data-testid="menu-about"]');
    await waitFor('about', () => h.shell.locator('hs-about [data-testid="about"]').isVisible(), (v) => v);
    await capture(h, '39-about-0.9.0');
    await pressInShell(h, 'Escape');
  } finally {
    await h.close();
  }
  const flat = await launch(server.url('link-a.html'), { noWebGL: true });
  try {
    await waitForPage(flat, 'link-a');
    await flat.shell.locator('hs-room-message [data-testid="room-message"]').waitFor({ state: 'visible' });
    await capture(flat, '40-no-webgl-notice');
  } finally {
    await flat.close();
  }
  // Milestone 14: a HoloML page across the window, and a page with a mistake.
  const holo = await launch(server.url('holoml/still.holoml'));
  const ready = (page: string) =>
    waitFor('the scene', () => inPage<boolean>(holo, 'window.__holoml?.ready === true', page), (r) => r, 20_000);
  try {
    await waitForPage(holo, 'still.holoml');
    await ready('still.holoml');
    await capture(holo, '41-holoml-scene');
    await shellCall(holo, 'showUrl', server.url('holoml/mistake.holoml'));
    await waitForPage(holo, 'mistake.holoml');
    await ready('mistake.holoml');
    await capture(holo, '42-holoml-mistake');
  } finally {
    await holo.close();
  }
  // Milestone 15: a model left out with its notice, the text view, and the Scene inspector.
  const profile = mkdtempSync(join(tmpdir(), 'hypersol-shots-profile-'));
  writeFileSync(join(profile, 'settings.json'), JSON.stringify({ layersOnOpen: false, instruments: true }));
  const hard = await launch(server.url('holoml/limits-files.holoml'));
  try {
    await waitForPage(hard, 'limits-files.holoml');
    await waitFor('left out', () => inPage<number>(hard, 'window.__holoml?.leftOut().length ?? 0', 'limits-files.holoml'), (n) => n === 1, 30_000);
    await capture(hard, '43-holoml-left-out');
    await shellCall(hard, 'showUrl', server.url('holoml/still.holoml'));
    await waitForPage(hard, 'still.holoml');
    await waitFor('the scene', () => inPage<boolean>(hard, 'window.__holoml?.ready === true', 'still.holoml'), (r) => r, 20_000);
    await hard.shell.click('hs-toolbar [data-testid="text-view"]');
    await waitFor('the text view', () => inPage<boolean>(hard, 'window.__holoml.textView', 'still.holoml'), (v) => v);
    await capture(hard, '44-holoml-text-view');
  } finally {
    await hard.close();
  }
  const inspect = await launch(server.url('holoml/still.holoml'), { userDataDir: profile });
  try {
    await waitForPage(inspect, 'still.holoml');
    await waitFor('the scene', () => inPage<boolean>(inspect, 'window.__holoml?.ready === true', 'still.holoml'), (r) => r, 20_000);
    await inspect.shell.locator('hs-instruments [data-testid="inst-scene-tree"] button', { hasText: 'model car' }).click();
    await inspect.shell.locator('hs-instruments [data-testid="inst-scene-detail"]').waitFor({ state: 'visible' });
    await capture(inspect, '45-holoml-inspector');
  } finally {
    await inspect.close();
  }
  // Milestone 16: HoloML's showroom (the local copy), from the start panel's link.
  const showroom = (page: string) => server.url(`holoml/showroom/${page}`);
  const show = await launch(server.url('link-a.html'), { showroomUrl: showroom('index.holoml') });
  const shown = (page: string) =>
    waitFor('the scene', () => inPage<boolean>(show, 'window.__holoml?.ready === true', page), (r) => r, 30_000);
  try {
    await waitForPage(show, 'link-a');
    await pressInShell(show, 'T', ['control']);
    await show.shell.locator('[data-testid="start-showroom"]').waitFor({ state: 'visible' });
    await settled(show);
    await capture(show, '46-start-panel-showroom');
    await show.shell.click('[data-testid="start-showroom"]');
    await waitForPage(show, 'index.holoml');
    await shown('index.holoml');
    await sleep(2500);
    await capture(show, '47-showroom-hall');
    await shellCall(show, 'showUrl', showroom('tallberg-glacier.holoml'));
    await waitForPage(show, 'tallberg-glacier.holoml');
    await shown('tallberg-glacier.holoml');
    await capture(show, '48-showroom-car');
  } finally {
    await show.close();
  }
  // Milestone 17: Blockworld by day and at night, the examples, and the start panel.
  const game = await launch(server.url('link-a.html'), { examplesBase: server.url('holoml/') });
  const BW = 'blockworld/index.holoml';
  const inGame = (page: string) => waitFor('the game', () => inPage<boolean>(game, 'window.__holoml?.ready === true', page), (r) => r, 30_000);
  const landed = (page: string) => waitFor('standing', () => inPage<boolean>(game, 'window.__holoml.walker()?.onGround ?? false', page), (v) => v, 15_000);
  try {
    await waitForPage(game, 'link-a');
    await pressInShell(game, 'T', ['control']);
    await game.shell.locator('[data-testid="start-examples"]').waitFor({ state: 'visible' });
    await settled(game);
    await capture(game, '49-start-panel-examples');
    await game.shell.click('[data-testid="start-examples"]');
    await game.shell.locator('hs-examples [data-testid="examples"]').waitFor({ state: 'visible' });
    await sleep(500);
    await capture(game, '50-examples');
    await game.shell.click('hs-examples [data-testid="example-open-blockworld"]');
    await waitForPage(game, BW);
    await inGame(BW);
    await landed(BW);
    await inPage(game, 'holoml.viewer.lookAt([3, 6.2, -8]), true', BW);
    await sleep(2500);
    await capture(game, '51-blockworld');
    // At night, with torches placed on the ground ahead.
    const NIGHT = `${BW}?hour=21.5`;
    await shellCall(game, 'showUrl', server.url(`holoml/${NIGHT}`));
    await waitForPage(game, 'hour=21.5');
    await inGame('hour=21.5');
    await landed('hour=21.5');
    await pressInPage(game, '5', [], 'hour=21.5');
    for (const [x, z] of [[-2, -3], [3, -2], [0, -6]] as [number, number][]) {
      // Stand near each place, and put a torch on the ground there.
      const top = await inPage<number>(game, `window.blockworld.top(${x}, ${z})`, 'hour=21.5');
      await inPage(game, `holoml.viewer.position = [${x + 0.5}, ${top + 1.7}, ${z + 3.5}], true`, 'hour=21.5');
      await sleep(700);
      await inPage(game, `holoml.viewer.lookAt([${x + 0.5}, ${top - 0.5}, ${z + 0.5}]), true`, 'hour=21.5');
      await sleep(200);
      await pressInPage(game, 'q', [], 'hour=21.5');
      await sleep(200);
    }
    // Then back, to see them from a distance.
    const back = await inPage<number>(game, 'window.blockworld.top(0, 5)', 'hour=21.5');
    await inPage(game, `holoml.viewer.position = [0.5, ${back + 1.7}, 5.5], true`, 'hour=21.5');
    await sleep(900);
    await inPage(game, 'holoml.viewer.lookAt([0.5, 4.5, -5]), true', 'hour=21.5');
    await sleep(2000);
    await capture(game, '52-blockworld-night');
  } finally {
    await game.close();
    await server.close();
  }
}, 480_000);
