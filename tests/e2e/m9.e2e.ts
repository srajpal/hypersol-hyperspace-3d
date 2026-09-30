/**
 * Milestone 9 end-to-end checks K1 to K10 (TODO.md): saving and filling
 * passwords, the Library's Passwords tab, private tabs, a missing
 * keychain, site permissions (prompt, memory, site panel, marker), the
 * download notice, the "+" menu, and flat printing. Every sign-in here is
 * a made-up test value on a 127.0.0.1 fixture page.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  caughtUp,
  clickAt,
  clickUntil,
  focusedPage,
  focusedTab,
  inPage,
  launch,
  navigateTo,
  pressInShell,
  removeFolder,
  screenPointOf,
  shellCall,
  sleep,
  typeInPage,
  waitFor,
  waitForExit,
  waitForPage,
  type Harness,
  type PageRef,
  settingsTo,
} from './harness';

let server: FixtureServer;
/** A second site: the same pages on another port, so another origin. */
let other: FixtureServer;
const folders: string[] = [];

function newFolder(prefix: string, settings?: object): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  folders.push(dir);
  if (settings) writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings));
  return dir;
}
const newProfile = (settings?: object) => newFolder('hypersol-e2e-profile-', { layersOnOpen: false, ...settings });

beforeAll(async () => {
  server = await startFixtureServer();
  other = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
  await other?.close();
  for (const dir of folders) await removeFolder(dir);
});

const BAR = (id: string) => `hs-toolbar [data-testid="${id}"]`;
const PROMPT = (id: string) => `hs-prompts [data-testid="${id}"]`;
const LIB = (id: string) => `hs-library [data-testid="${id}"]`;
const SITE = (id: string) => `hs-site-panel [data-testid="${id}"]`;
const SET = (id: string) => `hs-settings [data-testid="${id}"]`;
const NOTICE = (id: string) => `hs-notice [data-testid^="${id}"]`;
const origin = (s: FixtureServer) => new URL(s.base).origin;
const saved = (profile: string) => JSON.parse(readFileSync(join(profile, 'settings.json'), 'utf8')) as Record<string, unknown>;
const testLog = <T>(h: Harness, key: string) =>
  h.app.evaluate((_e, k) => (globalThis as unknown as { __hypersolTest: Record<string, unknown> }).__hypersolTest[k], key) as Promise<T>;

/** The saved sign-ins as the database holds them, read directly from the file. */
function logins(profile: string): { origin: string; username: string; secret: Uint8Array }[] {
  const db = new DatabaseSync(join(profile, 'hypersol.sqlite'), { readOnly: true });
  try {
    return db.prepare('SELECT origin, username, secret FROM logins ORDER BY id').all() as unknown as {
      origin: string;
      username: string;
      secret: Uint8Array;
    }[];
  } finally {
    db.close();
  }
}

/**
 * Clicks an element in the page with a real click, and again if a click
 * is lost (GitHub's Linux machines, issue #30). Done when `landed` says
 * so; by default when the element has the keyboard (the focus is cleared
 * first, so an earlier focus does not count).
 */
async function clickIn(h: Harness, selector: string, page: PageRef, landed?: () => Promise<boolean>): Promise<void> {
  const q = JSON.stringify(selector);
  if (!landed) await inPage(h, 'document.activeElement?.blur(), true', page);
  const hasFocus = () => inPage<boolean>(h, `document.activeElement === document.querySelector(${q})`, page);
  await clickUntil(h, await screenPointOf(h, selector, page), `a click on ${selector}`, landed ?? hasFocus);
}

/** The test page says it signed in (its answer to the button). */
const signedIn = (h: Harness, page: PageRef) => async () => (await inPage<string>(h, `document.getElementById('state').textContent`, page)) === 'Signed in';

/** Puts test values in the form and presses its button with a real click. */
async function signIn(h: Harness, user: string, pass: string, page: PageRef): Promise<void> {
  await inPage(
    h,
    `document.getElementById('user').value = ${JSON.stringify(user)}; document.getElementById('pass').value = ${JSON.stringify(pass)}; document.getElementById('state').textContent = 'Sign in'; true`,
    page,
  );
  await clickIn(h, '#go', page, signedIn(h, page));
}

const offer = async (h: Harness) => (await shellCall(h, 'prompts')).offer;
const listShown = (h: Harness, page: PageRef) => inPage<boolean>(h, `document.querySelector('hypersol-sign-ins') !== null`, page);

/** Clicks the first account in the saved sign-ins list under a field (its box, from the page's side; the list itself is closed to the page). */
async function pickFirstAccount(h: Harness, page: PageRef): Promise<void> {
  const box = await inPage<{ left: number; bottom: number }>(
    h,
    `(() => { const r = document.querySelector('hypersol-sign-ins').getBoundingClientRect(); return { left: r.left, bottom: r.bottom }; })()`,
    page,
  );
  const shell = await h.shell.evaluate(
    ([x, y]) => (window as unknown as { __hypersolShellTest: { projectPagePoint(u: number, v: number): { x: number; y: number } } }).__hypersolShellTest.projectPagePoint(x!, y!),
    [box.left + 40, box.bottom - 22],
  );
  await clickAt(h, shell);
}

describe('K1 to K3: passwords', () => {
  it('K1 offers to save on sign-in, stores only encrypted, and offers Update, Not now, and Never', async () => {
    const profile = newProfile();
    const h = await launch(server.url('login.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'login');
      const page = await focusedPage(h);
      // Typed the way a person does.
      await clickIn(h, '#user', page);
      await typeInPage(h, 'ada', page);
      await clickIn(h, '#pass', page);
      await typeInPage(h, 'test-pass-1', page);
      await clickIn(h, '#go', page, signedIn(h, page));
      const first = await waitFor('an offer to save', () => offer(h), (o) => o !== null);
      expect(first).toMatchObject({ origin: origin(server), username: 'ada', update: false, insecure: true });
      expect(await h.shell.locator(PROMPT('password-insecure')).isVisible()).toBe(true);
      await h.shell.click(PROMPT('pw-save'));
      await waitFor('saved', async () => logins(profile), (l) => l.length === 1);
      const row = logins(profile)[0]!;
      expect(row).toMatchObject({ origin: origin(server), username: 'ada' });
      expect(Buffer.from(row.secret).toString('latin1')).not.toContain('test-pass-1');
      expect(await offer(h)).toBeNull();

      // The same password again: nothing to offer, once the app has dealt
      // with the sign-in.
      await inPage(h, `document.getElementById('state').textContent = 'Sign in'`, page);
      await signIn(h, 'ada', 'test-pass-1', page);
      await caughtUp(h, page);
      expect(await offer(h)).toBeNull();

      // A new password for the same account: Update.
      const before = Buffer.from(logins(profile)[0]!.secret).toString('base64');
      await signIn(h, 'ada', 'test-pass-2', page);
      const update = await waitFor('an offer to update', () => offer(h), (o) => o !== null);
      expect(update!.update).toBe(true);
      // The app numbers its offers as it makes them: none was made in between.
      expect(update!.id).toBe(first!.id + 1);
      await h.shell.click(PROMPT('pw-save'));
      await waitFor('updated', async () => logins(profile), (l) => l.length === 1 && Buffer.from(l[0]!.secret).toString('base64') !== before);

      // Not now: nothing saved.
      await signIn(h, 'grace', 'test-pass-3', page);
      await waitFor('an offer', () => offer(h), (o) => o?.username === 'grace');
      await h.shell.click(PROMPT('pw-not-now'));
      await sleep(300);
      expect(logins(profile).map((l) => l.username)).toEqual(['ada']);

      // Never for this site: no more offers there.
      await signIn(h, 'hopper', 'test-pass-4', page);
      await waitFor('an offer', () => offer(h), (o) => o?.username === 'hopper');
      await h.shell.click(PROMPT('pw-never'));
      await signIn(h, 'lovelace', 'test-pass-5', page);
      await caughtUp(h, page);
      expect(await offer(h)).toBeNull();
      expect(logins(profile).map((l) => l.username)).toEqual(['ada']);
    } finally {
      await h.close();
    }
  });

  it('K2 fills only after a click on the field and a pick from the list, and only on the same site; K3 the Passwords tab', async () => {
    const profile = newProfile();
    const h = await launch(server.url('login.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'login');
      let page = await focusedPage(h);
      await signIn(h, 'ada', 'test-pass-1', page);
      await waitFor('an offer', () => offer(h), (o) => o !== null);
      await h.shell.click(PROMPT('pw-save'));
      await waitFor('saved', async () => logins(profile), (l) => l.length === 1);

      // Back on the page later: nothing is filled on load, once the app
      // has dealt with whatever the loaded page sent it...
      await navigateTo(h, server.url('login.html?again=1'));
      await waitForPage(h, 'again=1');
      page = await focusedPage(h);
      const fields = () => inPage<string[]>(h, `[document.getElementById('user').value, document.getElementById('pass').value]`, page);
      await caughtUp(h, page);
      expect(await fields()).toEqual(['', '']);
      expect(await listShown(h, page)).toBe(false);

      // A click on the field shows the account (...and the fields are
      // still empty then); picking it fills both fields.
      await clickIn(h, '#user', page);
      await waitFor('the account list', () => listShown(h, page), (s) => s);
      expect(await fields()).toEqual(['', '']);
      await pickFirstAccount(h, page);
      await waitFor(
        'filled',
        () => inPage<string[]>(h, `[document.getElementById('user').value, document.getElementById('pass').value]`, page),
        (v) => v[0] === 'ada' && v[1] === 'test-pass-1',
      );
      expect(await inPage<string[]>(h, 'window.seen', page)).toEqual(expect.arrayContaining(['user=3', 'pass=11']));
      expect(await listShown(h, page)).toBe(false);

      // Another site (another port) is not offered it.
      await navigateTo(h, other.url('login.html'));
      await waitForPage(h, other.base);
      const elsewhere = await focusedPage(h);
      await clickIn(h, '#user', elsewhere);
      // The click asks the app for this site's accounts: none, once it has answered.
      await caughtUp(h, elsewhere);
      expect(await listShown(h, elsewhere)).toBe(false);

      // K3: the Library's Passwords tab.
      await pressInShell(h, 'O', ['control', 'shift']);
      await waitFor('Library open', () => shellCall(h, 'openPanel'), (p) => p === 'library');
      await h.shell.click(LIB('lib-tab-passwords'));
      await waitFor('one saved sign-in', () => h.shell.locator(LIB('pw-item')).count(), (n) => n === 1);
      expect(await h.shell.locator(LIB('pw-username')).textContent()).toBe('ada');
      expect(await h.shell.locator(LIB('pw-value')).count()).toBe(0);
      await h.shell.fill(LIB('lib-search'), 'nobody');
      await waitFor('search finds nothing', () => h.shell.locator(LIB('pw-item')).count(), (n) => n === 0);
      await h.shell.fill(LIB('lib-search'), 'ad');
      await waitFor('search finds it', () => h.shell.locator(LIB('pw-item')).count(), (n) => n === 1);
      await h.shell.click(LIB('pw-reveal'));
      await waitFor('shown', () => h.shell.locator(LIB('pw-value')).textContent(), (t) => t === 'test-pass-1');
      await h.shell.click(LIB('pw-copy'));
      await waitFor('copied', () => h.app.evaluate(({ clipboard }) => clipboard.readText()), (t) => t === 'test-pass-1');
      await h.shell.click(LIB('pw-delete'));
      await waitFor('deleted', () => h.shell.locator(LIB('pw-item')).count(), (n) => n === 0);
      expect(logins(profile)).toEqual([]);
      await h.app.evaluate(({ clipboard }) => clipboard.clear());
    } finally {
      await h.close();
    }
  });

  it('K3 the "never" list can be undone in the Library', async () => {
    const profile = newProfile();
    const h = await launch(server.url('login.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'login');
      const page = await focusedPage(h);
      await signIn(h, 'ada', 'test-pass-1', page);
      await waitFor('an offer', () => offer(h), (o) => o !== null);
      await h.shell.click(PROMPT('pw-never'));
      await pressInShell(h, 'O', ['control', 'shift']);
      await h.shell.click(LIB('lib-tab-passwords'));
      await waitFor('never list', () => h.shell.locator(LIB('pw-never-item')).textContent(), (t) => t === new URL(server.base).host);
      await h.shell.click(LIB('pw-never-remove'));
      await waitFor('never list empty', () => h.shell.locator(LIB('pw-never-item')).count(), (n) => n === 0);
      await h.shell.locator(LIB('lib-search')).press('Escape');
      await signIn(h, 'ada', 'test-pass-2', page);
      await waitFor('offers again', () => offer(h), (o) => o !== null);
    } finally {
      await h.close();
    }
  });
});

describe('K4 and K5: private tabs and a missing keychain', () => {
  it('K4 no offer and no filling in a private tab (opened from the "+" menu)', async () => {
    const profile = newProfile();
    const h = await launch(server.url('login.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'login');
      await signIn(h, 'ada', 'test-pass-1', await focusedPage(h));
      await waitFor('an offer', () => offer(h), (o) => o !== null);
      await h.shell.click(PROMPT('pw-save'));
      await waitFor('saved', async () => logins(profile), (l) => l.length === 1);

      await h.shell.click(BAR('new-tab-more'));
      await h.shell.click(BAR('plus-private-tab'));
      await waitFor('private tab', () => focusedTab(h), (t) => t.private);
      await navigateTo(h, server.url('login.html?private=1'));
      await waitForPage(h, 'private=1');
      const page = await focusedPage(h);
      // As in K1 and K2: the click and the sign-in are dealt with by the
      // app before the list and the offer are looked for.
      await clickIn(h, '#user', page);
      await caughtUp(h, page);
      expect(await listShown(h, page)).toBe(false);
      await signIn(h, 'grace', 'test-pass-2', page);
      await caughtUp(h, page);
      expect(await offer(h)).toBeNull();
      expect(logins(profile).map((l) => l.username)).toEqual(['ada']);
    } finally {
      await h.close();
    }
  });

  it('K5 without the keychain nothing is saved, and the offer says why', async () => {
    const profile = newProfile();
    const h = await launch(server.url('login.html'), { userDataDir: profile, noKeychain: true });
    try {
      await waitForPage(h, 'login');
      await signIn(h, 'ada', 'test-pass-1', await focusedPage(h));
      const o = await waitFor('an offer', () => offer(h), (x) => x !== null);
      expect(o!.problem).toMatch(/keychain/);
      expect(await h.shell.locator(PROMPT('password-problem')).textContent()).toMatch(/keychain/);
      expect(await h.shell.locator(PROMPT('pw-save')).count()).toBe(0);
      await h.shell.click(PROMPT('pw-ok'));
      await waitFor('gone', () => offer(h), (x) => x === null);
      expect(logins(profile)).toEqual([]);
      await pressInShell(h, 'O', ['control', 'shift']);
      await h.shell.click(LIB('lib-tab-passwords'));
      await waitFor('the reason in the Library', () => h.shell.locator(LIB('pw-note')).textContent(), (t) => /keychain/.test(t ?? ''));
    } finally {
      await h.close();
    }
  });
});

describe('K6 to K8: site permissions', () => {
  it('K6 the prompt answers the page; K7 choices are remembered, "this time" is not, others stay refused; K8 site panel, Settings, marker', async () => {
    const profile = newProfile();
    let h = await launch(server.url('media.html'), { userDataDir: profile, keepRunning: true });
    const site = origin(server);
    try {
      await waitForPage(h, 'media');
      let page = await focusedPage(h);
      const tabId = (await focusedTab(h)).id;
      const prompt = async () => (await shellCall(h, 'prompts')).permission;

      // K6: Allow.
      let answer = inPage<string>(h, 'camera()', page);
      let p = await waitFor('camera prompt', prompt, (x) => x !== null);
      expect(p).toMatchObject({ origin: site, kinds: ['camera'] });
      expect(await h.shell.locator(PROMPT('permission-prompt')).textContent()).toContain('wants to use your camera');
      await h.shell.click(PROMPT('perm-allow'));
      expect(await answer).toBe('granted:video');
      await waitFor('prompt gone', prompt, (x) => x === null);
      // K8: the marker, in the top bar and for the tab card.
      await waitFor('marker', () => shellCall(h, 'accessOf', tabId), (k) => k.includes('camera'));
      expect(await h.shell.locator(BAR('access-marker')).isVisible()).toBe(true);

      // Allow this time.
      answer = inPage<string>(h, 'microphone()', page);
      p = await waitFor('microphone prompt', prompt, (x) => x !== null);
      expect(p!.kinds).toEqual(['microphone']);
      await h.shell.click(PROMPT('perm-once'));
      expect(await answer).toBe('granted:audio');

      // Block.
      answer = inPage<string>(h, 'locate()', page);
      p = await waitFor('location prompt', prompt, (x) => x !== null);
      expect(p!.kinds).toEqual(['location']);
      await h.shell.click(PROMPT('perm-block'));
      expect(await answer).toBe('denied:1');

      // Remembered on this page without asking: allow, this time, block.
      expect(await inPage<string>(h, 'camera()', page)).toBe('granted:video');
      expect(await inPage<string>(h, 'microphone()', page)).toBe('granted:audio');
      expect(await inPage<string>(h, 'locate()', page)).toBe('denied:1');
      expect(await prompt()).toBeNull();
      // Other permissions stay refused.
      expect(await inPage<string>(h, 'Notification.requestPermission()', page)).toBe('denied');
      expect((saved(profile)['sitePermissions'] as Record<string, unknown>)[site]).toEqual({ camera: 'allow', location: 'block' });

      // K8: the site panel shows and changes the choices.
      await h.shell.click(BAR('site-button'));
      await waitFor('site panel', () => shellCall(h, 'sitePanel'), (s) => s.open && s.site !== null);
      expect(await h.shell.locator(SITE('site-origin')).textContent()).toBe(new URL(site).host);
      expect(await h.shell.locator(SITE('site-camera')).inputValue()).toBe('allow');
      expect(await h.shell.locator(SITE('site-location')).inputValue()).toBe('block');
      expect((await shellCall(h, 'sitePanel')).site!.states['microphone']).toBe('once');
      expect(await h.shell.locator(SITE('site-given-camera')).isVisible()).toBe(true);
      await h.shell.selectOption(SITE('site-location'), 'ask');
      await waitFor('location forgotten', async () => (saved(profile)['sitePermissions'] as Record<string, unknown>)[site], (v) => JSON.stringify(v) === '{"camera":"allow"}');
      await h.shell.locator(SITE('site-location')).press('Escape');
      await waitFor('panel closed', () => shellCall(h, 'sitePanel'), (s) => !s.open);

      // Leaving the site ends "this time" and the marker.
      await navigateTo(h, other.url('link-a.html'));
      await waitForPage(h, other.base);
      await waitFor('marker gone', () => shellCall(h, 'accessOf', tabId), (k) => k.length === 0);
      expect(await h.shell.locator(BAR('access-marker')).count()).toBe(0);
      await navigateTo(h, server.url('media.html'));
      await waitForPage(h, server.base);
      page = await focusedPage(h);
      answer = inPage<string>(h, 'microphone()', page);
      await waitFor('asked again', prompt, (x) => x?.kinds[0] === 'microphone');
      await h.shell.click(PROMPT('perm-block'));
      expect(await answer).toBe('denied:NotAllowedError');

      // K7: after a restart, Allow and Block are still in force.
      await h.app.evaluate(({ app }) => app.quit());
      await waitForExit(h, 30_000);
      await h.close();
      h = await launch(server.url('media.html'), { userDataDir: profile, keepRunning: true });
      await waitForPage(h, 'media');
      page = await focusedPage(h);
      expect(await inPage<string>(h, 'camera()', page)).toBe('granted:video');
      expect(await inPage<string>(h, 'microphone()', page)).toBe('denied:NotAllowedError');
      expect(await shellCall(h, 'prompts')).toMatchObject({ permission: null });

      // Private tabs ask for themselves, and forget with the last one.
      await pressInShell(h, 'N', ['control', 'shift']);
      await navigateTo(h, server.url('media.html?private=1'));
      await waitForPage(h, 'private=1');
      page = await focusedPage(h);
      answer = inPage<string>(h, 'locate()', page);
      await waitFor('private prompt', async () => (await shellCall(h, 'prompts')).permission, (x) => x !== null);
      await h.shell.click(PROMPT('perm-allow'));
      expect(await answer).not.toBe('denied:1');
      expect(await inPage<string>(h, 'locate()', page)).not.toBe('denied:1');
      expect((saved(profile)['sitePermissions'] as Record<string, Record<string, string>>)[site]!['location']).toBeUndefined();
      await pressInShell(h, 'W', ['control']);
      await waitFor('private tab closed', () => shellCall(h, 'tabs'), (t) => !t.some((x) => x.private));
      await sleep(500);
      await pressInShell(h, 'N', ['control', 'shift']);
      await navigateTo(h, server.url('media.html?private=2'));
      await waitForPage(h, 'private=2');
      answer = inPage<string>(h, 'locate()', await focusedPage(h));
      await waitFor('asked again in a new private tab', async () => (await shellCall(h, 'prompts')).permission, (x) => x !== null);
      await h.shell.click(PROMPT('perm-block'));
      expect(await answer).toBe('denied:1');
      await pressInShell(h, 'W', ['control']);

      // K8: Settings lists the remembered choices and forgets them.
      await pressInShell(h, ',', ['control']);
      await waitFor('Settings open', () => shellCall(h, 'openPanel'), (x) => x === 'settings');
      await settingsTo(h, 'set-perm-site');
      await waitFor('one site listed', () => h.shell.locator(SET('set-perm-site')).count(), (n) => n === 1);
      await settingsTo(h, 'set-perm-site');
      expect(await h.shell.locator(SET('set-perm-site')).textContent()).toContain('Camera: allowed');
      await settingsTo(h, 'set-perm-remove');
      await h.shell.click(SET('set-perm-remove'));
      await waitFor('forgotten', async () => saved(profile)['sitePermissions'], (v) => JSON.stringify(v) === '{}');
      await settingsTo(h, 'set-perm-empty');
      expect(await h.shell.locator(SET('set-perm-empty')).isVisible()).toBe(true);
    } finally {
      await h.close();
    }
  });
});

describe('K9 and K10: download notice, the "+" menu, and printing', () => {
  it('K9 a finished download and a failed one each show a notice; Open and Show in folder work', async () => {
    const folder = newFolder('hypersol-e2e-downloads-');
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile(), downloadsDir: folder });
    try {
      await waitForPage(h, 'link-a');
      await navigateTo(h, server.url('download/sample.txt'));
      const done = await waitFor('notice', () => shellCall(h, 'notice'), (n) => n !== null);
      expect(done).toMatchObject({ kind: 'done', text: 'Downloaded sample.txt' });
      await h.shell.click(NOTICE('notice-show'));
      await waitFor('shown in its folder', () => testLog<{ what: string; path: string }[]>(h, 'opened'), (o) =>
        o.some((x) => x.what === 'show' && x.path.endsWith('sample.txt')));
      expect(await shellCall(h, 'notice')).toBeNull();

      await navigateTo(h, server.url('download/sample.txt'));
      await waitFor('second notice', () => shellCall(h, 'notice'), (n) => n?.text === 'Downloaded sample (1).txt');
      await h.shell.click(NOTICE('notice-open'));
      await waitFor('opened', () => testLog<{ what: string; path: string }[]>(h, 'opened'), (o) =>
        o.some((x) => x.what === 'open' && x.path.endsWith('sample (1).txt')));

      await navigateTo(h, server.url('download/broken.bin'));
      const failed = await waitFor('failure notice', () => shellCall(h, 'notice'), (n) => n?.kind === 'failed');
      expect(failed!.text).toBe('Download failed: broken.bin');
      await h.shell.click(NOTICE('notice-downloads'));
      await waitFor('Downloads panel', () => shellCall(h, 'openPanel'), (p) => p === 'downloads');
    } finally {
      await h.close();
    }
  });

  it('K10 the "+" menu opens a private tab (and right-click opens it too); pages print the same with the layers view on and off', async () => {
    const h = await launch(server.url('layers.html'), { userDataDir: newProfile({ layersOnOpen: true }) });
    try {
      await waitForPage(h, 'layers');
      const page = await focusedPage(h);
      await waitFor('lifted', () => inPage<number>(h, `document.querySelectorAll('[data-hs-layer]').length`, page), (n) => n > 0);
      await waitFor('lift settled', () => shellCall(h, 'animating'), (a) => !a);
      await sleep(600);
      const pdf = () =>
        h.app.evaluate(async ({ webContents }, id) => {
          const bytes = await webContents.fromId(id)!.printToPDF({});
          // The date and document id differ on every print; the rest is the page.
          return bytes
            .toString('latin1')
            .replace(/\/(CreationDate|ModDate) ?\(D:[^)]*\)/g, '')
            .replace(/\/ID ?\[<[0-9A-Fa-f]*> ?<[0-9A-Fa-f]*>\]/g, '');
        }, page.id);
      const lifted = await pdf();
      await h.shell.click(BAR('layers'));
      await waitFor('flat', () => inPage<number>(h, `document.querySelectorAll('[data-hs-layer]').length`, page), (n) => n === 0);
      await sleep(600);
      const flat = await pdf();
      const flatAgain = await pdf();
      expect(flatAgain).toBe(flat); // printing is repeatable, so the comparison means something
      expect(lifted.length).toBeGreaterThan(1000);
      expect(lifted).toBe(flat);

      // The "+" menu.
      await h.shell.click(BAR('new-tab-more'));
      expect(await h.shell.locator(BAR('new-tab-menu')).isVisible()).toBe(true);
      await h.shell.click(BAR('plus-private-tab'));
      await waitFor('a private tab', () => focusedTab(h), (t) => t.private && t.state === 'start');
      await h.shell.click(BAR('new-tab'), { button: 'right' });
      expect(await h.shell.locator(BAR('new-tab-menu')).isVisible()).toBe(true);
      await h.shell.click(BAR('plus-new-tab'));
      await waitFor('a normal tab', () => focusedTab(h), (t) => !t.private && t.state === 'start');
      expect((await shellCall(h, 'tabs')).length).toBe(3);
    } finally {
      await h.close();
    }
  });
});
