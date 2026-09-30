/**
 * Checks for the shell's findings in the review of 2026-09-30 (prompts
 * 134 and 135): R1 to R7, each named in its check. The room, the top bar,
 * the panels, and the prompts; the main process's and the viewer's
 * findings have their own files.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, startHttpsFixtureServer, type FixtureServer } from './fixture-server';
import {
  ADDRESS,
  clickUntil,
  setContentSize,
  settled,
  cycleToTab,
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
/** A second site: the same pages from another port, so another origin. */
let other: FixtureServer;
const folders: string[] = [];

beforeAll(async () => {
  server = await startFixtureServer();
  other = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
  await other?.close();
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
const SITE = (id: string) => `hs-site-panel [data-testid="${id}"]`;
const FIND = (id: string) => `hs-find-bar [data-testid="${id}"]`;
const STRIP = (id: string) => `hs-tab-strip [data-testid="${id}"]`;
const INST = (id: string) => `hs-instruments [data-testid="${id}"]`;
const saved = (profile: string) => JSON.parse(readFileSync(join(profile, 'settings.json'), 'utf8')) as Record<string, unknown>;
const NOTICE = (id: string) => `hs-notice [data-testid^="${id}"]`;
const testLog = <T>(h: Harness, key: string) =>
  h.app.evaluate((_e, k) => (globalThis as unknown as { __hypersolTest: Record<string, unknown> }).__hypersolTest[k], key) as Promise<T>;

/**
 * Clicks a button of a prompt or notice in the very frame it appears, as
 * a click already on its way would land. Set up before the prompt is
 * caused; answers whether the button was armed when it was clicked.
 */
function clickAsItAppears(h: Harness, host: string, button: string): Promise<{ armed: boolean }> {
  return h.shell.evaluate(
    ([host, button]) =>
      new Promise<{ armed: boolean }>((resolve) => {
        const look = () => {
          const found = document.querySelector(host!)?.shadowRoot?.querySelector<HTMLButtonElement>(`[data-testid^="${button}"]`);
          if (!found) {
            requestAnimationFrame(look);
            return;
          }
          const armed = found.hasAttribute('data-armed');
          found.click();
          resolve({ armed });
        };
        look();
      }),
    [host, button],
  );
}

/** Chooses an entry of the top bar's menu. */
async function menu(h: Harness, item: string): Promise<void> {
  await h.shell.click(BAR('menu'));
  await h.shell.click(BAR(`menu-${item}`));
}

/** Whether the tab in front shows an error card. */
const errorCardShown = (h: Harness) =>
  h.shell.evaluate(() => {
    const panels = [...document.querySelectorAll<HTMLElement>('[data-testid="page-panel"]')];
    const front = panels.find((p) => p.style.visibility !== 'hidden');
    return front?.querySelector('[data-testid="page-overlay"]')?.hasAttribute('data-visible') ?? false;
  });

/** An address on this computer that nothing answers yet: its port, to start a server on later. */
async function unansweredPort(): Promise<number> {
  const probe = await startFixtureServer();
  const port = Number(new URL(probe.base).port);
  await probe.close();
  return port;
}

/** Opens a page in a new tab and waits for it; returns the tab's id. */
async function openTab(h: Harness, url: string, part: string): Promise<number> {
  await pressInShell(h, 'T', ['control']);
  await waitFor('a new tab', () => focusedTab(h), (t) => t.state === 'start');
  await navigateTo(h, url);
  await waitForPage(h, part);
  return (await focusedTab(h)).id;
}

/** Pixels of a page as drawn that have the colours of find-in-page's marks (yellow, and orange for the match in turn). */
async function findMarks(h: Harness, page: { id: number }): Promise<number> {
  const data = await h.app.evaluate(async ({ webContents }, id) => (await webContents.fromId(id)!.capturePage()).toBitmap().toString('base64'), page.id);
  const px = Buffer.from(data, 'base64');
  let marks = 0;
  // Blue, green, red, alpha: a strong red and green with little blue.
  for (let i = 0; i < px.length; i += 4) if (px[i + 2]! > 200 && px[i + 1]! > 120 && px[i]! < 110) marks++;
  return marks;
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

describe('R2: an error card goes when its error does', () => {
  it('a failed tab whose page then loads by itself shows no card', async () => {
    const port = await unansweredPort();
    const h = await launch(`http://127.0.0.1:${port}/link-a.html`, { userDataDir: newProfile() });
    let late: FixtureServer | undefined;
    try {
      await waitFor('the load to fail', () => shellCall(h, 'status'), (s) => s?.state === 'failed');
      expect(await errorCardShown(h)).toBe(true);
      // The site comes up, and the page is loaded again from outside the
      // tab's own controls (as the right-click menu's Reload does).
      late = await startFixtureServer(port);
      const page = await focusedPage(h);
      await h.app.evaluate(({ webContents }, id) => webContents.fromId(id)!.reload(), page.id);
      await waitFor('the page loaded', () => shellCall(h, 'status'), (s) => s?.state === 'loaded');
      await waitForPage(h, 'link-a');
      expect(await errorCardShown(h)).toBe(false);
    } finally {
      await h.close();
      await late?.close();
    }
  });

  it('a failed tab that sleeps and wakes loads its page without the old card', async () => {
    const port = await unansweredPort();
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ tabSleep: 5 }), sleepMinuteMs: 100 });
    let late: FixtureServer | undefined;
    try {
      await waitForPage(h, 'link-a');
      const front = (await focusedTab(h)).id;
      // A second tab whose load fails.
      await pressInShell(h, 'T', ['control']);
      await waitFor('a new tab', () => focusedTab(h), (t) => t.state === 'start');
      const failing = (await focusedTab(h)).id;
      await navigateTo(h, `http://127.0.0.1:${port}/link-b.html`);
      await waitFor('the load to fail', () => focusedTab(h), (t) => t.state === 'failed');
      expect(await errorCardShown(h)).toBe(true);
      // Behind the first tab, it sleeps.
      await cycleToTab(h, front);
      await waitFor(
        'the failed tab asleep',
        async () => {
          await shellCall(h, 'sleepNow');
          return tabs(h);
        },
        (t) => t.find((x) => x.id === failing)?.asleep === true,
      );
      // The site comes up; opening the tab wakes it.
      late = await startFixtureServer(port);
      await cycleToTab(h, failing);
      await waitFor('the page loaded', () => focusedTab(h), (t) => t.state === 'loaded' && !t.asleep);
      await waitForPage(h, 'link-b');
      expect(await errorCardShown(h)).toBe(false);
    } finally {
      await h.close();
      await late?.close();
    }
  });
});

describe('R3: a prompt or notice takes no click the instant it appears', () => {
  it('a click as the permission prompt appears answers nothing; once armed, Allow works', async () => {
    const h = await launch(server.url('media.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'media');
      const page = await focusedPage(h);
      const early = clickAsItAppears(h, 'hs-prompts', 'perm-allow');
      let settled = false;
      const answer = inPage<string>(h, 'camera()', page).then((a) => {
        settled = true;
        return a;
      });
      expect(await early).toEqual({ armed: false });
      // The prompt is still there, unanswered, and says the same to screen readers.
      const card = h.shell.locator(PROMPT('permission-prompt'));
      await h.shell.waitForSelector(`${PROMPT('permission-prompt')}[data-armed]`);
      expect((await shellCall(h, 'prompts')).permission).not.toBeNull();
      expect(settled).toBe(false);
      expect(await card.getAttribute('role')).toBe('alertdialog');
      expect(await h.shell.locator(PROMPT('perm-allow')).getAttribute('aria-disabled')).toBeNull();
      expect(await h.shell.locator(PROMPT('perm-allow')).isEnabled()).toBe(true);
      await h.shell.click(`${PROMPT('perm-allow')}[data-armed]`);
      expect(await answer).toBe('granted:video');
    } finally {
      await h.close();
    }
  });

  it('the key on a focused button counts as a click: Enter answers nothing before the prompt is armed', async () => {
    const h = await launch(server.url('media.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'media');
      const page = await focusedPage(h);
      // Focus the button and press Enter in the frame the prompt appears.
      const early = h.shell.evaluate(
        () =>
          new Promise<{ armed: boolean }>((resolve) => {
            const look = () => {
              const found = document.querySelector('hs-prompts')?.shadowRoot?.querySelector<HTMLButtonElement>('[data-testid="perm-allow"]');
              if (!found) {
                requestAnimationFrame(look);
                return;
              }
              found.focus();
              const armed = found.hasAttribute('data-armed');
              // A button turns Enter into a click; the key itself is sent too.
              found.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
              found.click();
              resolve({ armed });
            };
            look();
          }),
      );
      const answer = inPage<string>(h, 'microphone()', page);
      expect(await early).toEqual({ armed: false });
      await h.shell.waitForSelector(`${PROMPT('perm-block')}[data-armed]`);
      expect((await shellCall(h, 'prompts')).permission).not.toBeNull();
      await h.shell.locator(PROMPT('perm-block')).press('Enter');
      expect(await answer).toBe('denied:NotAllowedError');
    } finally {
      await h.close();
    }
  });

  it('a click as a download\'s notice appears opens nothing; once armed, Open works, and Dismiss works at once', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'hypersol-e2e-downloads-'));
    folders.push(folder);
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile(), downloadsDir: folder });
    try {
      await waitForPage(h, 'link-a');
      const opened = () => testLog<{ what: string; path: string }[]>(h, 'opened');
      const early = clickAsItAppears(h, 'hs-notice', 'notice-open');
      await navigateTo(h, server.url('download/sample.txt'));
      expect(await early).toEqual({ armed: false });
      await h.shell.waitForSelector(`${NOTICE('notice-open')}[data-armed]`);
      // Nothing was opened, and the notice is still up.
      expect(await opened()).toEqual([]);
      expect(await shellCall(h, 'notice')).toMatchObject({ kind: 'done', text: 'Downloaded sample.txt' });
      await h.shell.click(`${NOTICE('notice-open')}[data-armed]`);
      await waitFor('the file opened', opened, (o) => o.some((x) => x.what === 'open' && x.path.endsWith('sample.txt')));
      // Dismiss is not held back.
      const dismissed = clickAsItAppears(h, 'hs-notice', 'notice-close');
      await navigateTo(h, server.url('download/sample.txt'));
      expect(await dismissed).toEqual({ armed: false });
      await waitFor('the notice gone', () => shellCall(h, 'notice'), (n) => n === null);
      expect((await opened()).length).toBe(1);
    } finally {
      await h.close();
    }
  });
});

describe('R5: the address bar', () => {
  it("shows the end of a long host, not its start, and the whole address when it takes the keyboard", async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      const port = new URL(server.base).port;
      // No such site (every name but this computer's fails to resolve in test runs): the address still shows.
      const long = `http://accounts.google.com.${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}.evil.example:${port}/signin`;
      await navigateTo(h, long);
      await waitFor('the load to fail', () => focusedTab(h), (t) => t.state === 'failed');
      const shown = await h.shell.inputValue(ADDRESS);
      expect(shown.startsWith('http://…')).toBe(true);
      expect(shown.endsWith(`evil.example:${port}/signin`)).toBe(true);
      expect(shown).not.toContain('accounts.google.com');
      // The scheme and what is left of the host fit the bar as drawn.
      const fit = await h.shell.evaluate((port) => {
        const input = document.querySelector('hs-toolbar')!.shadowRoot!.querySelector<HTMLInputElement>('[data-testid="address"]')!;
        const style = getComputedStyle(input);
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.font = style.font;
        const start = input.value.slice(0, input.value.indexOf(`:${port}`) + port.length + 1);
        return { text: ctx.measureText(start).width, room: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), scrolled: input.scrollLeft };
      }, port);
      expect(fit.text).toBeLessThanOrEqual(fit.room);
      expect(fit.scrolled).toBe(0);
      // With the keyboard: the whole address, to read or edit.
      await h.shell.focus(ADDRESS);
      expect(await h.shell.inputValue(ADDRESS)).toBe(long);
      await h.shell.locator(ADDRESS).blur();
      expect(await h.shell.inputValue(ADDRESS)).toBe(shown);
    } finally {
      await h.close();
    }
  });

  it('never shows a user name and password, while loading or after', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      const { host } = new URL(server.base);
      await navigateTo(h, `http://reader:not-a-real-secret@${host}/slow?ms=1500`);
      await waitFor('the address being loaded in the bar', () => h.shell.inputValue(ADDRESS), (v) => v.includes('/slow'));
      expect(await h.shell.inputValue(ADDRESS)).toBe(`http://${host}/slow?ms=1500`);
      await waitFor('the page loaded', () => focusedTab(h), (t) => t.state === 'loaded' && t.title === 'Slow page', 20_000);
      expect(await h.shell.inputValue(ADDRESS)).toBe(`http://${host}/slow?ms=1500`);
    } finally {
      await h.close();
    }
  });

  it('left unedited, shows where the tab is now when it loses the keyboard', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      await h.shell.focus(ADDRESS);
      expect(await h.shell.inputValue(ADDRESS)).toBe(server.url('link-a.html'));
      // The page moves on by itself while the bar has the keyboard.
      await inPage(h, `location.href = ${JSON.stringify(server.url('link-b.html'))}; true`, 'link-a');
      await waitFor('the tab on the next page', () => focusedTab(h), (t) => t.url === server.url('link-b.html') && t.state === 'loaded');
      // Text under the cursor is not swapped while the person may be reading or about to type.
      expect(await h.shell.inputValue(ADDRESS)).toBe(server.url('link-a.html'));
      await h.shell.locator(ADDRESS).blur();
      expect(await h.shell.inputValue(ADDRESS)).toBe(server.url('link-b.html'));
      // Text the person typed and left is kept.
      await h.shell.fill(ADDRESS, 'half an addr');
      await h.shell.locator(ADDRESS).blur();
      expect(await h.shell.inputValue(ADDRESS)).toBe('half an addr');
      await h.shell.focus(ADDRESS);
      expect(await h.shell.inputValue(ADDRESS)).toBe('half an addr');
    } finally {
      await h.close();
    }
  });

  it('shows no lock for a certificate error, and "Not secure" only for a page that loaded over http', async () => {
    const tls = await startHttpsFixtureServer();
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      expect(await h.shell.locator(BAR('site-button')).getAttribute('data-kind')).toBe('insecure');
      await navigateTo(h, tls.url('link-b.html'));
      await waitFor(
        'the certificate card',
        () => h.shell.locator('[data-testid="page-panel"][aria-hidden="false"] .hs-error-card').getAttribute('data-kind'),
        (k) => k === 'certificate',
      );
      expect((await focusedTab(h)).state).toBe('failed');
      expect(await h.shell.inputValue(ADDRESS)).toBe(tls.url('link-b.html'));
      expect(await h.shell.locator(BAR('site-button')).count()).toBe(0);
      // A site that does not answer: no marker either.
      await navigateTo(h, `http://127.0.0.1:${await unansweredPort()}/`);
      await waitFor('the load to fail', () => shellCall(h, 'status'), (s) => s?.state === 'failed' && s.url.startsWith('http://127.0.0.1'));
      expect(await h.shell.locator(BAR('site-button')).count()).toBe(0);
      // Back on a page that loads: the marker is back.
      await navigateTo(h, server.url('link-b.html'));
      await waitForPage(h, 'link-b');
      await waitFor('the marker', () => h.shell.locator(BAR('site-button')).count(), (n) => n === 1);
      expect(await h.shell.locator(BAR('site-button')).getAttribute('data-kind')).toBe('insecure');
    } finally {
      await h.close();
      await tls.close();
    }
  });
});

describe('R6: smaller faults of the top bar, tabs, and panels', () => {
  it('(a) Enter on a completed address loads the address the top row shows', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      const { host } = new URL(server.base);
      // Two addresses that read the same in the bar (it matches without
      // regard to case); the first is visited more, so it leads.
      const often = `http://${host}/search?q=needle`;
      const once = `http://${host}/search?q=NEEDLE`;
      for (const url of [often, once, server.url('link-b.html'), often]) {
        await navigateTo(h, url);
        await waitFor('the page loaded', () => focusedTab(h), (t) => t.url === url && t.state === 'loaded');
        await waitForPage(h, await focusedPage(h));
      }
      const input = h.shell.locator(ADDRESS);
      await input.click();
      await input.fill('');
      await input.pressSequentially(`${host}/search?q=n`);
      await waitFor('the address completed', () => input.inputValue(), (v) => v === `${host}/search?q=needle`);
      await waitFor('both addresses listed', () => h.shell.locator(BAR('suggestion')).count(), (n) => n >= 2);
      const top = await h.shell.locator(`${BAR('suggestion')} .url`).first().textContent();
      expect(top).toBe(often);
      await input.press('Enter');
      const tab = await waitFor('the page loaded', () => focusedTab(h), (t) => t.state === 'loaded' && t.url.includes('/search'));
      expect(tab.url).toBe(top);
    } finally {
      await h.close();
    }
  });

  it('(b) the site panel closes when its tab goes to another site', async () => {
    const h = await launch(server.url('media.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'media');
      await h.shell.click(BAR('site-button'));
      await waitFor('the site panel', () => shellCall(h, 'sitePanel'), (s) => s.open && s.site !== null);
      expect(await h.shell.locator(SITE('site-origin')).textContent()).toBe(new URL(server.base).host);
      // A page on the same site: the panel stays, its choices still apply.
      await inPage(h, `location.href = ${JSON.stringify(server.url('link-a.html'))}; true`, 'media');
      await waitFor('the next page', () => focusedTab(h), (t) => t.url === server.url('link-a.html') && t.state === 'loaded');
      expect((await shellCall(h, 'sitePanel')).open).toBe(true);
      // Another site: the panel goes, not left naming a site the tab has left.
      await inPage(h, `location.href = ${JSON.stringify(other.url('link-b.html'))}; true`, 'link-a');
      await waitFor('the other site', () => focusedTab(h), (t) => t.url === other.url('link-b.html'));
      await waitFor('the site panel closed', () => shellCall(h, 'sitePanel'), (s) => !s.open);
    } finally {
      await h.close();
    }
  });

  it('(c) Settings follows permission changes made elsewhere, and "Forget" forgets one site only', async () => {
    const site = new URL(server.base).origin;
    const profile = newProfile({ sitePermissions: { [site]: { camera: 'allow' }, 'https://elsewhere.example': { microphone: 'block' } } });
    const h = await launch(server.url('media.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'media');
      await menu(h, 'settings');
      await waitFor('Settings', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
      await settingsTo(h, 'set-perm-site');
      await waitFor('both sites listed', () => h.shell.locator(SET('set-perm-site')).count(), (n) => n === 2);
      // With Settings open, the page's site is set back to "Ask" in the site panel.
      await h.shell.click(BAR('site-button'));
      await waitFor('the site panel', () => shellCall(h, 'sitePanel'), (s) => s.open && s.site !== null);
      await h.shell.selectOption(SITE('site-camera'), 'ask');
      await waitFor('forgotten in the file', async () => Object.keys(saved(profile)['sitePermissions'] as object), (k) => k.length === 1);
      // Settings shows what is saved now.
      await waitFor('one site listed', () => h.shell.locator(SET('set-perm-site')).count(), (n) => n === 1);
      expect(await h.shell.locator(SET('set-perm-site')).textContent()).toContain('elsewhere.example');
      // Forgetting the other site does not bring the first one back.
      await h.shell.click(SET('set-perm-remove'));
      await waitFor('nothing remembered', async () => JSON.stringify(saved(profile)['sitePermissions']), (v) => v === '{}');
      await waitFor('the empty list', () => h.shell.locator(SET('set-perm-empty')).count(), (n) => n === 1);
    } finally {
      await h.close();
    }
  });

  it('(d) find is stopped on the tab it was running on when another tab comes in front', async () => {
    const h = await launch(server.url('find.html'), { userDataDir: newProfile({ layersOnOpen: false }) });
    try {
      await waitForPage(h, 'find');
      const page = await focusedPage(h);
      const first = (await focusedTab(h)).id;
      // Before any search: only the fringes of the letters' edges have such colours.
      const plain = await findMarks(h, page);
      await pressInShell(h, 'F', ['control']);
      await waitFor('the find bar', () => shellCall(h, 'find'), (f) => f.open);
      await h.shell.fill(FIND('find-input'), 'needle');
      await waitFor('three matches', () => shellCall(h, 'find'), (f) => f.matches === 3);
      await waitFor('the matches marked', () => findMarks(h, page), (n) => n > plain + 1000);
      // Another tab in front: the bar closes, and the search ends where it ran.
      await pressInShell(h, 'T', ['control']);
      await waitFor('a new tab in front', () => focusedTab(h), (t) => t.id !== first);
      expect((await shellCall(h, 'find')).open).toBe(false);
      await cycleToTab(h, first);
      await waitForPage(h, page);
      await waitFor('no marks left on the page', () => findMarks(h, page), (n) => n <= plain + 50, 5000);
    } finally {
      await h.close();
    }
  });

  it("(e) a private tab's zoom is kept for its site while private tabs are open, and never saved", async () => {
    const profile = newProfile();
    const h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'link-a');
      await pressInShell(h, 'N', ['control', 'shift']);
      await waitFor('a private tab', () => focusedTab(h), (t) => t.private);
      await navigateTo(h, server.url('link-a.html?private=1'));
      await waitForPage(h, 'private=1');
      await h.shell.click(BAR('zoom-in'));
      const zoomed = await waitFor('zoomed in', () => shellCall(h, 'zoom'), (z) => z.factor > 1.05);
      // Another page of the site, in the same private tab: the zoom holds.
      await navigateTo(h, server.url('link-b.html?private=2'));
      await waitForPage(h, 'private=2');
      await waitFor('the page at its zoom', () => shellCall(h, 'zoom'), (z) => Math.abs(z.label - zoomed.factor) < 0.001);
      expect((await shellCall(h, 'zoom')).factor).toBeCloseTo(zoomed.factor, 3);
      expect(saved(profile)['zoomSites'] ?? {}).toEqual({});
      // The last private tab closes: the next private tab starts at 100%.
      await pressInShell(h, 'W', ['control']);
      await waitFor('no private tab', () => tabs(h), (t) => !t.some((x) => x.private));
      await pressInShell(h, 'N', ['control', 'shift']);
      await waitFor('a private tab', () => focusedTab(h), (t) => t.private);
      await navigateTo(h, server.url('link-a.html?private=3'));
      await waitForPage(h, 'private=3');
      await waitFor('the page ready', () => shellCall(h, 'status'), (s) => s?.state === 'loaded');
      expect((await shellCall(h, 'zoom')).factor).toBeCloseTo(1, 3);
      expect(saved(profile)['zoomSites'] ?? {}).toEqual({});
    } finally {
      await h.close();
    }
  });

  it('(f) the console stays where it was scrolled to while new lines arrive, and follows them from the bottom', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ instruments: true }) });
    try {
      await waitForPage(h, 'link-a');
      const page = await focusedPage(h);
      const lines = async () => (await shellCall(h, 'instruments')).console.length;
      const scroll = () =>
        h.shell.locator(INST('inst-console-list')).evaluate((el) => ({ top: el.scrollTop, fromEnd: el.scrollHeight - el.scrollTop - el.clientHeight }));
      await inPage(h, `for (let i = 0; i < 60; i++) console.log('first line ' + i); true`, page);
      await waitFor('the lines listed', lines, (n) => n >= 60);
      await waitFor('the newest line in view', scroll, (s) => s.fromEnd < 4 && s.top > 0);
      // Up to the first lines, to read them.
      await h.shell.locator(INST('inst-console-list')).evaluate((el) => (el.scrollTop = 0));
      const before = await lines();
      await inPage(h, `for (let i = 0; i < 10; i++) console.log('later line ' + i); true`, page);
      await waitFor('more lines listed', lines, (n) => n >= before + 10);
      // The panel draws again every second (its clock): still at the top after that too.
      const clock = await h.shell.locator(INST('inst-clock')).textContent();
      await waitFor('the panel drawn again', () => h.shell.locator(INST('inst-clock')).textContent(), (t) => t !== clock);
      expect((await scroll()).top).toBe(0);
      // Back at the bottom, it follows new lines again.
      await h.shell.locator(INST('inst-console-list')).evaluate((el) => (el.scrollTop = el.scrollHeight));
      const then = await lines();
      await inPage(h, `for (let i = 0; i < 10; i++) console.log('last line ' + i); true`, page);
      await waitFor('more lines listed', lines, (n) => n >= then + 10);
      await waitFor('the newest line in view', scroll, (s) => s.fromEnd < 4);
    } finally {
      await h.close();
    }
  });

  it("(g) Enter on a tab's Close button in the list closes that tab without first bringing it in front", async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ tabDisplay: 'list' }) });
    try {
      await waitForPage(h, 'link-a');
      const a = (await focusedTab(h)).id;
      const b = await openTab(h, server.url('link-b.html'), 'link-b');
      const c = await openTab(h, server.url('find.html'), 'find');
      await cycleToTab(h, a);
      await waitFor('the list of tabs', () => h.shell.locator(STRIP('strip-tab')).count(), (n) => n === 3);
      await h.shell.locator(`hs-tab-strip [data-id="${b}"] [data-testid="strip-close"]`).press('Enter');
      const left = await waitFor('the tab closed', () => tabs(h), (t) => t.length === 2);
      expect(left.map((t) => t.id)).toEqual([a, c]);
      // Had the key also reached the tab, it would have come in front, and closing it would have passed the front to the next.
      expect(left.find((t) => t.focused)!.id).toBe(a);
      // The tab itself still answers Enter.
      await h.shell.locator(`hs-tab-strip [data-id="${c}"]`).press('Enter');
      await waitFor('the tab in front', () => focusedTab(h), (t) => t.id === c);
    } finally {
      await h.close();
    }
  });

  it('(h) an address typed stays in the bar while it loads, not flashing the page it leaves', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      const slow = server.url('slow?ms=1200');
      const seen = new Set<string>();
      await navigateTo(h, slow);
      const done = await waitFor(
        'the slow page loaded',
        async () => {
          const tab = await focusedTab(h);
          seen.add(tab.url);
          seen.add(await h.shell.inputValue(ADDRESS));
          return tab;
        },
        (t) => t.state === 'loaded' && t.title === 'Slow page',
        20_000,
      );
      expect(done.url).toBe(slow);
      expect([...seen]).toEqual([slow]);
      // A load that never becomes a page (a download) gives the address back to the page still shown.
      await navigateTo(h, server.url('download/sample.txt'));
      await waitFor('the download done', () => shellCall(h, 'downloads'), (d) => d.length === 1 && d[0]!.state === 'completed');
      const back = await waitFor('the tab back on its page', () => focusedTab(h), (t) => t.state === 'loaded' && t.url === slow);
      expect(back.title).toBe('Slow page');
    } finally {
      await h.close();
    }
  });
});

describe('R6: the room draws what is needed, where it is needed', () => {
  it('a loading tab whose card is out of view asks for no frames; a card in view still spins', async () => {
    // One tab, so no rail of cards; its page takes a while, and has no picture yet.
    const h = await launch(server.url('slow?ms=4000'), { userDataDir: newProfile() });
    try {
      await sleep(500); // the window's first frames
      const before = await shellCall(h, 'frames');
      await sleep(1000);
      const after = await shellCall(h, 'frames');
      expect((await focusedTab(h)).state).toBe('loading');
      expect(await shellCall(h, 'railVisible')).toBe(false);
      expect(after - before).toBeLessThanOrEqual(2);
      // Two tabs: the rail shows, and the loading tab's card spins.
      await waitFor('the page loaded', () => focusedTab(h), (t) => t.state === 'loaded', 20_000);
      await pressInShell(h, 'T', ['control']);
      await waitFor('a new tab', () => focusedTab(h), (t) => t.state === 'start');
      await navigateTo(h, server.url('slow?ms=3000&second'));
      await waitFor('loading', () => focusedTab(h), (t) => t.state === 'loading');
      await settled(h);
      const spinStart = await shellCall(h, 'frames');
      await waitFor('the spinner drawn', () => shellCall(h, 'frames'), (n) => n > spinStart + 10, 2500);
      expect((await focusedTab(h)).state).toBe('loading');
    } finally {
      await h.close();
    }
  });

  it("the room's resolution follows the display's pixel ratio when it changes", async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      const start = await shellCall(h, 'economy');
      expect(start.pixelRatio).toBe(start.devicePixelRatio);
      // As a move to a display with another scaling does: the window's pixel ratio changes.
      await h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.setZoomFactor(1.5));
      const changed = await waitFor('the new pixel ratio', () => shellCall(h, 'economy'), (e) => e.devicePixelRatio !== start.devicePixelRatio);
      expect(changed.devicePixelRatio).toBeCloseTo(start.devicePixelRatio * 1.5, 3);
      await waitFor('the room at the new ratio', () => shellCall(h, 'economy'), (e) => e.pixelRatio === e.devicePixelRatio, 5000);
      // And again: each change is followed, not only the first.
      await h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.setZoomFactor(1));
      await waitFor('the first ratio again', () => shellCall(h, 'economy'), (e) => e.devicePixelRatio === start.devicePixelRatio && e.pixelRatio === e.devicePixelRatio, 5000);
    } finally {
      await h.close();
    }
  });

  it('with the WebGL context lost, pages still follow a resize and a tab switch', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      /** How far the page in front, as the window draws it, is from where the room places it (pixels). */
      const offBy = () =>
        h.shell.evaluate(() => {
          const hooks = (window as unknown as { __hypersolShellTest: { panelQuad(): { x: number; y: number }[] } }).__hypersolShellTest;
          const quad = hooks.panelQuad();
          const front = [...document.querySelectorAll<HTMLElement>('[data-testid="page-panel"]')].find((p) => p.style.visibility !== 'hidden');
          if (!front) return Number.POSITIVE_INFINITY;
          const box = front.getBoundingClientRect();
          const xs = quad.map((p) => p.x);
          const ys = quad.map((p) => p.y);
          return Math.max(
            Math.abs(box.left - Math.min(...xs)),
            Math.abs(box.right - Math.max(...xs)),
            Math.abs(box.top - Math.min(...ys)),
            Math.abs(box.bottom - Math.max(...ys)),
          );
        });
      expect(await offBy()).toBeLessThan(3);
      const lost = await h.shell.evaluate(() => {
        const canvas = document.querySelector('#room canvas') as HTMLCanvasElement;
        const ext = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
        if (!ext) return false;
        return new Promise<boolean>((resolve) => {
          canvas.addEventListener('webglcontextlost', () => resolve(true), { once: true });
          ext.loseContext();
        });
      });
      expect(lost).toBe(true);
      // A resize: the page is drawn where the room now places it.
      const size = await h.shell.evaluate(() => [window.innerWidth, window.innerHeight]);
      await setContentSize(h, size[0]! - 160, size[1]! - 90);
      await waitFor('the page in its new place', offBy, (d) => d < 3, 5000);
      // A tab switch: the new tab's page comes to the centre.
      await pressInShell(h, 'T', ['control']);
      await waitFor('a new tab', () => focusedTab(h), (t) => t.state === 'start');
      await settled(h);
      await waitFor('the new page in place', offBy, (d) => d < 3, 5000);
    } finally {
      await h.close();
    }
  });
});
