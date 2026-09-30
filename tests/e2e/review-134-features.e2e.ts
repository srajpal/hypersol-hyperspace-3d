/**
 * Checks for the review of 2026-09-30 (prompts 134 and 135), the findings
 * that cross the main process and the shell: HTTP sign-in (M10), the
 * window's size and place (D7), and the text view's keys in the
 * shortcuts table (St4).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BASIC_LONG_REALM, BASIC_REALM, BASIC_SIGN_IN, startFixtureServer, type FixtureServer } from './fixture-server';
import {
  caughtUp,
  closeFocusedTab,
  cycleToTab,
  focusedPage,
  focusedTab,
  inPage,
  launch,
  navigateTo,
  newProfile,
  pressInPage,
  pressInShell,
  settingsTo,
  settled,
  shellCall,
  tabs,
  waitFor,
  waitForPage,
  type Harness,
} from './harness';

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => server?.close());

const BAR = (id: string) => `hs-toolbar [data-testid="${id}"]`;
const SET = (id: string) => `hs-settings [data-testid="${id}"]`;
const CARD = (id: string) => `hs-prompts [data-testid="${id}"]`;
/** The profile's saved settings, as the file has them now. */
const saved = (profile: string) => JSON.parse(readFileSync(join(profile, 'settings.json'), 'utf8')) as Record<string, unknown>;

describe('M10: HTTP sign-in', () => {
  /** The sign-in prompt showing, once it takes an answer (it waits half a second first, hud/arm.ts). */
  const asked = async (h: Harness, what = 'the sign-in prompt, taking answers') =>
    (await waitFor(what, () => shellCall(h, 'prompts'), (p) => p.signIn !== null && p.signInArmed)).signIn!;
  const noPrompt = (h: Harness, what = 'no sign-in prompt') => waitFor(what, () => shellCall(h, 'prompts'), (p) => p.signIn === null);
  /** Prompts showing or waiting in the main process, in all tabs. */
  const waiting = (h: Harness) => h.app.evaluate(() => globalThis.__hypersolTest!.signInsWaiting!());
  /** Which of the prompt's controls has the keyboard ('' when none has). */
  const keyboardIn = (h: Harness) =>
    h.shell.evaluate(() => {
      const prompts = document.querySelector('hs-prompts');
      return document.activeElement === prompts ? (prompts?.shadowRoot?.activeElement?.getAttribute('data-testid') ?? '') : '';
    });
  const type = async (h: Harness, username: string, password: string) => {
    await h.shell.fill(CARD('sign-in-username'), username);
    await h.shell.fill(CARD('sign-in-password'), password);
  };
  const titleOf = (h: Harness, page: string) => inPage<string>(h, 'document.title', page);
  /**
   * Presses Enter in the shell as a keyboard does: the key down, its
   * character, the key up. A form is sent by the character, which
   * pressInShell leaves out; and Playwright's own press would wait for a
   * key-up that lands in the page once the prompt has gone (harness.ts,
   * navigateTo).
   */
  const enterInShell = (h: Harness) =>
    h.app.evaluate(({ BrowserWindow }) => {
      const shell = BrowserWindow.getAllWindows()[0]!.webContents;
      shell.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
      shell.sendInputEvent({ type: 'char', keyCode: '\r' });
      shell.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
    });
  const site = () => new URL(server.base).host;

  it('asks in a dialog that names the site and quotes its realm, and the right user name and password load the page', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      const url = server.url('review-134/basic/page.html');
      await navigateTo(h, url);
      const prompt = await asked(h);
      // Who asks comes from the request's address; the server's words are quoted and marked as the site's.
      expect(prompt).toMatchObject({ asker: site(), proxy: false, insecure: true, realm: BASIC_REALM });
      expect(await h.shell.locator(CARD('sign-in-asks')).textContent()).toBe(`${site()} asks for a user name and password.`);
      expect(await h.shell.locator(CARD('sign-in-realm')).textContent()).toBe(`The site says: “${BASIC_REALM}”`);
      // Plain http: what is typed can be read on the way, and the prompt says so.
      expect(await h.shell.locator(CARD('sign-in-insecure')).textContent()).toBe("This site's connection is not private; the password can be read on the way.");
      // A dialog with a name, for screen readers; the password is not shown as it is typed.
      const card = h.shell.locator(CARD('sign-in-prompt'));
      expect(await card.getAttribute('role')).toBe('dialog');
      expect(await card.getAttribute('aria-label')).toBe(`Sign in to ${site()}`);
      expect(await h.shell.locator(CARD('sign-in-password')).getAttribute('type')).toBe('password');
      // The keyboard is in the first field, and Tab stays inside the dialog, both ways round.
      await waitFor('the keyboard in the user name field', () => keyboardIn(h), (at) => at === 'sign-in-username');
      await h.shell.keyboard.press('Shift+Tab');
      expect(await keyboardIn(h)).toBe('sign-in-cancel');
      await h.shell.keyboard.press('Tab');
      expect(await keyboardIn(h)).toBe('sign-in-username');
      // The request is held meanwhile: the tab is still loading, and nothing has been sent again.
      expect(server.hits.get('/review-134/basic/page.html')).toBe(1);
      expect(await waiting(h)).toBe(1);

      // Enter signs in.
      await type(h, BASIC_SIGN_IN.username, BASIC_SIGN_IN.password);
      await h.shell.locator(CARD('sign-in-password')).focus();
      await enterInShell(h);
      await waitFor('the page behind the sign-in', () => titleOf(h, 'review-134/basic/'), (t) => t === 'Signed in');
      await waitForPage(h, 'review-134/basic/');
      await noPrompt(h);
      expect((await focusedTab(h)).url).toBe(url);
      expect(await waiting(h)).toBe(0);
      // Nothing typed there is offered to the password manager.
      await caughtUp(h, 'review-134/basic/');
      expect((await shellCall(h, 'prompts')).offer).toBeNull();
      // Chromium keeps the sign-in for the session: another page of the area needs no prompt.
      await navigateTo(h, server.url('review-134/basic/second.html'));
      await waitFor('a second page of the area', () => titleOf(h, 'basic/second.html'), (t) => t === 'Signed in');
      expect((await shellCall(h, 'prompts')).signIn).toBeNull();
    } finally {
      await h.close();
    }
  });

  it('Cancel, and Escape, show the 401 page the site sent; a wrong password asks again', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      // Cancel.
      await navigateTo(h, server.url('review-134/basic/one.html'));
      await asked(h);
      await h.shell.click(`${CARD('sign-in-cancel')}[data-armed]`);
      await waitFor('the 401 page', () => titleOf(h, 'basic/one.html'), (t) => t === 'Sign-in needed');
      expect(await inPage<string>(h, 'document.getElementById("words").textContent', 'basic/one.html')).toBe('The 401 page: sign in to read this');
      await noPrompt(h);
      expect(await waiting(h)).toBe(0);

      // Escape in the dialog.
      await navigateTo(h, server.url('review-134/basic/two.html'));
      await asked(h);
      await h.shell.locator(CARD('sign-in-username')).focus();
      await pressInShell(h, 'Escape');
      await waitFor('the 401 page again', () => titleOf(h, 'basic/two.html'), (t) => t === 'Sign-in needed');
      await noPrompt(h);

      // A wrong password: the site says 401 again, and the person is asked again, in empty fields.
      await navigateTo(h, server.url('review-134/basic/three.html'));
      const first = await asked(h);
      await type(h, BASIC_SIGN_IN.username, 'not-the-password');
      await h.shell.click(`${CARD('sign-in-submit')}[data-armed]`);
      const second = await waitFor('asked again', () => shellCall(h, 'prompts'), (p) => p.signIn !== null && p.signIn.id !== first.id && p.signInArmed);
      expect(second.signIn).toMatchObject({ asker: site(), realm: BASIC_REALM });
      expect(await h.shell.locator(CARD('sign-in-username')).inputValue()).toBe('');
      expect(await h.shell.locator(CARD('sign-in-password')).inputValue()).toBe('');
      expect(server.hits.get('/review-134/basic/three.html')).toBe(2);
      await type(h, BASIC_SIGN_IN.username, BASIC_SIGN_IN.password);
      await h.shell.click(`${CARD('sign-in-submit')}[data-armed]`);
      await waitFor('the page behind the sign-in', () => titleOf(h, 'basic/three.html'), (t) => t === 'Signed in');
      expect(server.hits.get('/review-134/basic/three.html')).toBe(3);
    } finally {
      await h.close();
    }
  });

  it('belongs to its tab: not shown over another, not answered by a tab switch, cancelled by leaving the page or closing the tab', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      const plain = (await focusedTab(h)).id;
      // A second tab, whose page asks.
      await pressInShell(h, 'T', ['control']);
      await waitFor('a second tab', () => tabs(h), (t) => t.length === 2);
      await settled(h);
      const asking = (await focusedTab(h)).id;
      await navigateTo(h, server.url('review-134/basic/tab.html'));
      const prompt = await asked(h);
      await type(h, BASIC_SIGN_IN.username, 'half-typed');

      // Over the other tab nothing shows; the request stays held, unanswered.
      await cycleToTab(h, plain);
      await noPrompt(h, 'no sign-in prompt over the other tab');
      expect(await h.shell.locator(CARD('sign-in-prompt')).count()).toBe(0);
      expect(await waiting(h)).toBe(1);
      expect(server.hits.get('/review-134/basic/tab.html')).toBe(1);
      // Back in its tab it shows again, the same prompt, with nothing left of what was typed.
      await cycleToTab(h, asking);
      expect((await asked(h, 'the prompt again, back in its tab')).id).toBe(prompt.id);
      expect(await h.shell.locator(CARD('sign-in-username')).inputValue()).toBe('');
      expect(await h.shell.locator(CARD('sign-in-password')).inputValue()).toBe('');

      // Leaving for another page cancels it.
      await navigateTo(h, server.url('link-b.html'));
      await waitForPage(h, 'link-b');
      await noPrompt(h, 'no sign-in prompt once the tab has gone elsewhere');
      expect(await waiting(h)).toBe(0);
      expect(server.hits.get('/review-134/basic/tab.html')).toBe(1);

      // Closing the tab cancels it too, and leaves nothing over the tab that comes to the front.
      await navigateTo(h, server.url('review-134/basic/closing.html'));
      await asked(h);
      expect(await waiting(h)).toBe(1);
      await closeFocusedTab(h);
      await waitFor('nothing waiting once the tab has closed', () => waiting(h), (n) => n === 0);
      expect((await focusedTab(h)).id).toBe(plain);
      expect((await shellCall(h, 'prompts')).signIn).toBeNull();
    } finally {
      await h.close();
    }
  });

  it('a second sign-in in a tab waits its turn; a long realm is cut; a picture from another site cannot ask', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      const page = await focusedPage(h);
      // Two requests of the page's own site, behind two different sign-ins.
      await inPage(
        h,
        `window.got = {};
         for (const [name, path] of [['first', '/review-134/basic/data.json'], ['second', '/review-134/basic-long/data.json']]) {
           fetch(path).then((r) => { window.got[name] = r.status; }, (e) => { window.got[name] = String(e); });
         }
         true`,
        page,
      );
      await waitFor('both requests held', () => waiting(h), (n) => n === 2);
      const first = await asked(h);
      expect(first.realm).toBe(BASIC_REALM);
      // Answered, the first gives way to the second, whose long realm is cut to 80 characters and still only quoted.
      await h.shell.click(`${CARD('sign-in-cancel')}[data-armed]`);
      const second = await asked(h, 'the second sign-in, in its turn');
      expect(second.id).not.toBe(first.id);
      expect([...second.realm]).toHaveLength(80);
      expect(second.realm).toBe(`${[...BASIC_LONG_REALM].slice(0, 79).join('')}…`);
      expect(await h.shell.locator(CARD('sign-in-realm')).textContent()).toBe(`The site says: “${second.realm}”`);
      expect(await h.shell.locator(CARD('sign-in-asks')).textContent()).toBe(`${new URL(server.base).host} asks for a user name and password.`);
      await type(h, BASIC_SIGN_IN.username, BASIC_SIGN_IN.password);
      await h.shell.click(`${CARD('sign-in-submit')}[data-armed]`);
      await waitFor('both requests answered', () => inPage<Record<string, number>>(h, 'window.got', page), (got) => got['first'] !== undefined && got['second'] !== undefined);
      expect(await inPage(h, 'window.got', page)).toEqual({ first: 401, second: 200 });
      expect(await waiting(h)).toBe(0);

      // A picture from another site that asks for a password: nobody is asked, and the picture fails.
      const elsewhere = server.url('review-134/basic/picture.png').replace('127.0.0.1', 'shop.test');
      const loaded = await inPage<string>(
        h,
        `new Promise((resolve) => { const i = new Image(); i.onload = () => resolve('loaded'); i.onerror = () => resolve('failed'); i.src = ${JSON.stringify(elsewhere)}; })`,
        page,
      );
      expect(loaded).toBe('failed');
      expect(server.hits.get('/review-134/basic/picture.png')).toBe(1);
      await caughtUp(h, page);
      expect(await waiting(h)).toBe(0);
      expect((await shellCall(h, 'prompts')).signIn).toBeNull();
    } finally {
      await h.close();
    }
  });
});

describe('D7: the window\'s size and place are remembered', () => {
  /** The window's size and place while not maximised, as the app has them. */
  const bounds = (h: Harness) => h.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getNormalBounds());
  const resize = (h: Harness, width: number, height: number) =>
    h.app.evaluate(({ BrowserWindow }, [w, ht]) => BrowserWindow.getAllWindows()[0]!.setSize(w!, ht!), [width, height]);
  type Left = { x: number; y: number; width: number; height: number; maximized: boolean } | null | undefined;
  const left = (profile: string) => saved(profile)['windowBounds'] as Left;
  /**
   * The size a window opens at when nothing is saved: 1280 by 800, unless
   * the display is smaller (GitHub's Windows machines give a window of
   * 1024 by 768), when the system makes it fit. Read once from a fresh
   * window, so the checks below compare with what this machine gives.
   */
  let defaultSize: { width: number; height: number };
  beforeAll(async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      const { width, height } = await bounds(h);
      defaultSize = { width, height };
      expect(width).toBeLessThanOrEqual(1280);
      expect(height).toBeLessThanOrEqual(800);
    } finally {
      await h.close();
    }
  });

  it('a restart opens the window at the size it was left; a test window not asked to stays at the default size', async () => {
    const profile = newProfile();
    // Test windows keep their 1280 by 800 (the other checks rely on it); this one asks for the real behaviour.
    let h = await launch(server.url('link-a.html'), { userDataDir: profile, rememberWindow: true });
    try {
      await waitForPage(h, 'link-a');
      expect(await bounds(h)).toMatchObject(defaultSize);

      // Saved soon after a change, while the app runs.
      await resize(h, 1000, 700);
      const first = await bounds(h);
      expect(first).toMatchObject({ width: 1000, height: 700 });
      await waitFor('the size saved in settings.json', async () => left(profile), (b) => b?.width === 1000 && b?.height === 700);
      expect(left(profile)).toEqual({ ...first, maximized: false });

      // And at once when the window closes, before the wait is over.
      await resize(h, 960, 640);
      const last = await bounds(h);
      await h.close();
      expect(left(profile)).toEqual({ ...last, maximized: false });
      expect(last).toMatchObject({ width: 960, height: 640 });

      // The next start opens at that size.
      h = await launch(server.url('link-a.html'), { userDataDir: profile, rememberWindow: true });
      await waitForPage(h, 'link-a');
      expect(await bounds(h)).toMatchObject({ width: 960, height: 640 });
      await h.close();

      // A test window that does not ask opens at the default size, and leaves what is saved as it is.
      h = await launch(server.url('link-a.html'), { userDataDir: profile });
      await waitForPage(h, 'link-a');
      expect(await bounds(h)).toMatchObject(defaultSize);
      await resize(h, 980, 660);
      await h.close();
      expect(left(profile)).toEqual({ ...last, maximized: false });
    } finally {
      await h.close();
    }
  });

  it('a saved size that is not one is set aside with the rest of a damaged file, and the window opens at the default', async () => {
    const profile = newProfile({ windowBounds: { x: 0, y: 0, width: 'wide', height: 700, maximized: false } });
    const h = await launch(server.url('link-a.html'), { userDataDir: profile, rememberWindow: true });
    try {
      await waitForPage(h, 'link-a');
      expect(await bounds(h)).toMatchObject(defaultSize);
    } finally {
      await h.close();
    }
  });
});

describe('St4: the text view\'s keys are a shortcut like the others', () => {
  const PAGE = 'still.holoml';
  const CTRL = process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
  const textView = (h: Harness) => inPage<boolean | null>(h, 'window.__holoml ? window.__holoml.textView : null', PAGE);
  const hint = (h: Harness) => h.shell.locator(BAR('text-view')).getAttribute('title');
  /** The keys the page itself was given (a shortcut's keys never reach it). */
  const listen = (h: Harness, page: string) =>
    inPage(h, `window.__keys = []; addEventListener('keydown', (e) => window.__keys.push((e.ctrlKey ? 'ctrl+' : '') + (e.altKey ? 'alt+' : '') + (e.shiftKey ? 'shift+' : '') + e.key.toLowerCase()), true); true`, page);
  const heard = (h: Harness, page: string) => inPage<string[]>(h, 'window.__keys', page);
  const inAddress = (h: Harness) =>
    h.shell.evaluate(() => {
      const bar = document.querySelector('hs-toolbar');
      return document.activeElement === bar && bar?.shadowRoot?.activeElement?.getAttribute('data-testid') === 'address';
    });

  it('switches the view in a HoloML page only, can be changed in Settings > Shortcuts, and the old keys then do nothing', async () => {
    const profile = newProfile({ layersOnOpen: false });
    const h = await launch(server.url(`holoml/${PAGE}`), { userDataDir: profile });
    try {
      await waitForPage(h, PAGE);
      await waitFor('the scene ready', () => inPage<boolean>(h, 'window.__holoml ? window.__holoml.ready : false', PAGE), (r) => r === true, 20_000);
      await listen(h, PAGE);
      // The default keys: the button's hint names them, and in the page they switch the view once.
      expect(await hint(h)).toBe(`Text view: the scene as a plain page (${CTRL}+Shift+V)`);
      await pressInPage(h, 'V', ['control', 'shift'], PAGE);
      await waitFor('the text view', () => textView(h), (v) => v === true);
      await waitFor('the button pressed', () => h.shell.locator(BAR('text-view')).getAttribute('aria-pressed'), (v) => v === 'true');
      await pressInPage(h, 'V', ['control', 'shift'], PAGE);
      await waitFor('3D again', () => textView(h), (v) => v === false);
      // They are the browser's there: the page itself never sees them.
      expect(await heard(h, PAGE)).toEqual([]);

      // In an ordinary page the same keys are the page's (paste as plain text), not a shortcut.
      await pressInShell(h, 'T', ['control']);
      await waitFor('a second tab', () => tabs(h), (t) => t.length === 2);
      await settled(h);
      await navigateTo(h, server.url('form.html'));
      await waitForPage(h, 'form.html');
      await listen(h, 'form.html');
      await pressInPage(h, 'V', ['control', 'shift'], 'form.html');
      await waitFor('the keys reach the page', () => heard(h, 'form.html'), (keys) => keys.includes('ctrl+shift+v'));
      await closeFocusedTab(h);
      await settled(h);

      // Changed in Settings > Shortcuts, like any other.
      await pressInShell(h, ',', ['control']);
      await waitFor('Settings open', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
      await settingsTo(h, 'set-key-change-text-view');
      await h.shell.click(SET('set-key-change-text-view'));
      await waitFor('waiting for keys', () => h.shell.locator(SET('set-key-waiting')).isVisible(), (v) => v);
      await pressInShell(h, 'Y', ['control', 'alt']);
      await waitFor('saved', async () => (saved(profile)['shortcuts'] as Record<string, string> | undefined)?.['text-view'], (k) => k === 'Mod+Alt+Y');
      // Its old keys are free for another action now; while it had them they were refused (unit tests).
      await h.shell.press(SET('set-search'), 'Escape');
      await waitFor('Settings closed', () => shellCall(h, 'openPanel'), (p) => p === null);
      await waitFor('the hint follows', () => hint(h), (t) => t === `Text view: the scene as a plain page (${CTRL}+Alt+Y)`);

      // The old keys do nothing now: they reach the page like any other keys, and once a
      // later shortcut has done its work (keys pressed in a page are dealt with in order)
      // the view is still the 3D one.
      await pressInPage(h, 'V', ['control', 'shift'], PAGE);
      await pressInPage(h, 'L', ['control'], PAGE);
      await waitFor('the later shortcut done', () => inAddress(h), (there) => there);
      expect(await textView(h)).toBe(false);
      expect(await heard(h, PAGE)).toEqual(['ctrl+shift+v']);
      // The new keys switch it, from the page and from the shell.
      await pressInPage(h, 'Y', ['control', 'alt'], PAGE);
      await waitFor('the text view, by the new keys', () => textView(h), (v) => v === true);
      await h.shell.locator(BAR('text-view')).focus();
      await h.shell.keyboard.press('Control+Alt+Y');
      await waitFor('3D again, by the new keys in the shell', () => textView(h), (v) => v === false);
      // In the shell too the old keys are no shortcut any more.
      await h.shell.keyboard.press('Control+Shift+V');
      await caughtUp(h, PAGE);
      expect(await textView(h)).toBe(false);
    } finally {
      await h.close();
    }
  });
});
