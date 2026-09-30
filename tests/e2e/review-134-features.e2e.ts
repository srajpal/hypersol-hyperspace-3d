/**
 * Checks for the review of 2026-09-30 (prompts 134 and 135), the findings
 * that cross the main process and the shell: HTTP sign-in (M10).
 */
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
  pressInShell,
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

const CARD = (id: string) => `hs-prompts [data-testid="${id}"]`;

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
