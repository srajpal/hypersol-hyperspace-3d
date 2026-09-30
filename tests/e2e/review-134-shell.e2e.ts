/**
 * Checks for the shell's findings in the review of 2026-09-30 (prompts
 * 134 and 135): R1 to R7, each named in its check. The room, the top bar,
 * the panels, and the prompts; the main process's and the viewer's
 * findings have their own files.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  clickUntil,
  focusedPage,
  focusedTab,
  inPage,
  launch,
  navigateTo,
  pressInShell,
  project,
  removeFolder,
  screenPointOf,
  settingsTo,
  shellCall,
  sleep,
  tabs,
  waitFor,
  waitForPage,
  type Harness,
} from './harness';

let server: FixtureServer;
const folders: string[] = [];

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
  for (const f of folders) await removeFolder(f);
});

/** A fresh profile; economy mode off, so a laptop on battery runs the same checks. */
function newProfile(settings: object = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'hypersol-e2e-profile-'));
  folders.push(dir);
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ economy: 'off', ...settings }));
  return dir;
}

const BAR = (id: string) => `hs-toolbar [data-testid="${id}"]`;
const PROMPT = (id: string) => `hs-prompts [data-testid="${id}"]`;
const LIB = (id: string) => `hs-library [data-testid="${id}"]`;
const SET = (id: string) => `hs-settings [data-testid="${id}"]`;

/** Chooses an entry of the top bar's menu. */
async function menu(h: Harness, item: string): Promise<void> {
  await h.shell.click(BAR('menu'));
  await h.shell.click(BAR(`menu-${item}`));
}

/** Moves the pointer into the room's bottom-left corner and waits for the camera to settle off-centre. */
async function cameraOffCentre(h: Harness): Promise<{ x: number; y: number }> {
  const height = await h.shell.evaluate(() => window.innerHeight);
  await h.shell.mouse.move(52, height - 52);
  await h.shell.mouse.move(12, height - 12, { steps: 8 });
  const moved = await waitFor(
    'the camera to settle off-centre',
    async () => {
      const a = await shellCall(h, 'cameraOffset');
      await sleep(100);
      return { a, b: await shellCall(h, 'cameraOffset') };
    },
    ({ a, b }) => a.x === b.x && a.y === b.y && (a.x !== 0 || a.y !== 0),
  );
  return moved.b;
}

describe('R4: a HoloML page that fills the window is flat', () => {
  it('the camera goes back to the centre though the pointer is over the page', async () => {
    const h = await launch('', { userDataDir: newProfile() });
    try {
      await waitFor('the start tab', () => focusedTab(h), (t) => t.state === 'start');
      const off = await cameraOffCentre(h);
      expect(Math.abs(off.x)).toBeGreaterThan(1);
      // Onto the page (the start panel): the parallax pauses with the camera still off-centre.
      const onPage = await project(h, 300, 200);
      await h.shell.mouse.move(onPage.x, onPage.y, { steps: 4 });
      await waitFor('the parallax paused', () => shellCall(h, 'parallaxPaused'), (p) => p);
      expect(await shellCall(h, 'cameraOffset')).not.toEqual({ x: 0, y: 0 });
      // A HoloML page arrives under the resting pointer.
      await navigateTo(h, server.url('holoml/still.holoml'));
      await waitFor('the page to fill the window', () => shellCall(h, 'holoml'), (s) => s.fill && s.shown);
      expect(await shellCall(h, 'cameraOffset')).toEqual({ x: 0, y: 0 });
      // Flat: the page's outline is a rectangle with level edges.
      const [tl, tr, br, bl] = await shellCall(h, 'panelQuad');
      expect(Math.abs(tl!.y - tr!.y)).toBeLessThan(0.01);
      expect(Math.abs(bl!.y - br!.y)).toBeLessThan(0.01);
      expect(Math.abs(tl!.x - bl!.x)).toBeLessThan(0.01);
      expect(Math.abs(tr!.x - br!.x)).toBeLessThan(0.01);
    } finally {
      await h.close();
    }
  });
});

describe('R1: switching panels closes the one that was open', () => {
  it('a password shown in the Library is hidden again after a visit to Settings', async () => {
    const h = await launch(server.url('login.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'login');
      const page = await focusedPage(h);
      // A sign-in with made-up values, saved.
      await inPage(h, `document.getElementById('user').value = 'ada'; document.getElementById('pass').value = 'test-pass-1'; true`, page);
      const signedIn = async () => (await inPage<string>(h, `document.getElementById('state').textContent`, page)) === 'Signed in';
      await clickUntil(h, await screenPointOf(h, '#go', page), 'the sign-in button', signedIn);
      await waitFor('an offer to save', async () => (await shellCall(h, 'prompts')).offer, (o) => o !== null);
      await h.shell.click(PROMPT('pw-save'));
      // Library > Passwords > Show.
      await menu(h, 'library');
      await waitFor('the Library', () => shellCall(h, 'openPanel'), (p) => p === 'library');
      await h.shell.click(LIB('lib-tab-passwords'));
      await waitFor('the saved sign-in', () => h.shell.locator(LIB('pw-item')).count(), (n) => n === 1);
      await h.shell.click(LIB('pw-reveal'));
      await waitFor('the password shown', () => h.shell.locator(LIB('pw-value')).textContent(), (t) => t === 'test-pass-1');
      // To Settings and back: the Library opens on Passwords again, with nothing shown.
      await menu(h, 'settings');
      await waitFor('Settings', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
      await menu(h, 'library');
      await waitFor('the Library again', () => shellCall(h, 'openPanel'), (p) => p === 'library');
      await waitFor('the saved sign-in again', () => h.shell.locator(LIB('pw-item')).count(), (n) => n === 1);
      expect(await h.shell.locator(LIB('lib-tab-passwords')).getAttribute('aria-selected')).toBe('true');
      expect(await h.shell.locator(LIB('pw-value')).count()).toBe(0);
      expect(await h.shell.locator(LIB('pw-reveal')).textContent()).toBe('Show');
    } finally {
      await h.close();
    }
  });

  it('a shortcut waiting for its new keys stops waiting: shortcuts work, and the next key is not saved', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      await menu(h, 'shortcuts');
      await waitFor('Settings', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
      const findKeys = () => h.shell.locator(`${SET('set-key-row')}[data-name="find"] kbd`).allTextContents();
      const before = await findKeys();
      expect(before.length).toBeGreaterThan(0);
      await h.shell.click(SET('set-key-change-find'));
      await waitFor('waiting for keys', () => h.shell.locator(SET('set-key-waiting')).count(), (n) => n === 1);
      // Another panel opens while it waits.
      await menu(h, 'library');
      await waitFor('the Library', () => shellCall(h, 'openPanel'), (p) => p === 'library');
      // A shortcut works again, and its keys did not become the binding.
      await pressInShell(h, 'T', ['control']);
      await waitFor('a new tab from Ctrl+T', () => tabs(h), (t) => t.length === 2);
      await menu(h, 'shortcuts');
      await waitFor('Settings again', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
      await settingsTo(h, 'set-key-change-find');
      expect(await h.shell.locator(SET('set-key-waiting')).count()).toBe(0);
      expect(await findKeys()).toEqual(before);
      expect(await h.shell.locator(SET('set-keys-message')).count()).toBe(0);
    } finally {
      await h.close();
    }
  });
});
