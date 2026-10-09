/**
 * Checks for the fixes approved in prompt 189 (2026-10-09): the three
 * draft advisories on private tabs and the Library's passwords, and the
 * HoloML viewer's issues #66 and #67. Each check fails without its fix.
 */
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  clickUntil,
  focusedPage,
  focusedTab,
  inPage,
  launch,
  mainLog,
  navigateTo,
  newProfile as freshProfile,
  pressInShell,
  screenPointOf,
  shellCall,
  waitFor,
  waitForPage,
  type Harness,
  type PageRef,
} from './harness';

let server: FixtureServer;

const newProfile = (settings?: object) => freshProfile({ layersOnOpen: false, ...settings });

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

const LIB = (id: string) => `hs-library [data-testid="${id}"]`;
const PROMPT = (id: string) => `hs-prompts [data-testid="${id}"]`;

/** The saved sign-ins' ids and user names, read directly from the file. */
function loginRows(profile: string): { id: number; username: string }[] {
  const db = new DatabaseSync(join(profile, 'hypersol.sqlite'), { readOnly: true });
  try {
    return db.prepare('SELECT id, username FROM logins ORDER BY id').all() as unknown as { id: number; username: string }[];
  } finally {
    db.close();
  }
}

/** Signs in on the test page with a real click, and saves the password the app offers. */
async function signInAndSave(h: Harness, profile: string, user: string, pass: string, page: PageRef): Promise<void> {
  await inPage(
    h,
    `document.getElementById('user').value = ${JSON.stringify(user)}; document.getElementById('pass').value = ${JSON.stringify(pass)}; document.getElementById('state').textContent = 'Sign in'; true`,
    page,
  );
  const signedIn = async () => (await inPage<string>(h, `document.getElementById('state').textContent`, page)) === 'Signed in';
  await clickUntil(h, await screenPointOf(h, '#go', page), 'a click on #go', signedIn);
  await waitFor('an offer to save', async () => (await shellCall(h, 'prompts')).offer, (o) => o?.username === user);
  await h.shell.click(PROMPT('pw-save'));
  await waitFor('saved', async () => loginRows(profile), (rows) => rows.some((r) => r.username === user));
}

/** Opens the Library on its Passwords tab, with at least `count` sign-ins listed. */
async function openPasswords(h: Harness, count = 1): Promise<void> {
  await pressInShell(h, 'O', ['control', 'shift']);
  await waitFor('Library open', () => shellCall(h, 'openPanel'), (p) => p === 'library');
  await h.shell.click(LIB('lib-tab-passwords'));
  await waitFor('the saved sign-ins', () => h.shell.locator(LIB('pw-item')).count(), (n) => n >= count);
}

async function closeLibrary(h: Harness): Promise<void> {
  await h.shell.keyboard.press('Escape');
  await waitFor('Library closed', () => shellCall(h, 'openPanel'), (p) => p === null);
}

/**
 * Holds the Library's next Show at the password client: its answer comes
 * only when the check calls releaseReveal.
 */
async function holdReveals(h: Harness): Promise<void> {
  await h.shell.evaluate(() => {
    type Client = { get(r: { op: string }): Promise<unknown> };
    const lib = document.querySelector('hs-library') as unknown as { passwords: Client };
    const real = lib.passwords;
    const w = window as unknown as { __revealsAsked: number; __revealGo: (() => Promise<void>) | null };
    w.__revealsAsked = 0;
    w.__revealGo = null;
    lib.passwords = {
      get: (r) => {
        if (r.op !== 'reveal') return real.get(r);
        w.__revealsAsked++;
        return new Promise((resolve, reject) => {
          w.__revealGo = async () => {
            try {
              resolve(await real.get(r));
            } catch (e) {
              reject(e);
            }
          };
        });
      },
    };
  });
}

/** Lets the held Show answer, then waits for the Library to have dealt with it; the passwords it then shows. */
async function releaseReveal(h: Harness): Promise<Record<string, string>> {
  return h.shell.evaluate(async () => {
    const w = window as unknown as { __revealGo: (() => Promise<void>) | null };
    const lib = document.querySelector('hs-library') as unknown as { revealed: Record<string, string>; updateComplete: Promise<unknown> };
    await w.__revealGo!();
    await new Promise((r) => setTimeout(r, 0));
    await lib.updateComplete;
    return lib.revealed;
  });
}

const revealsAsked = (h: Harness) => h.shell.evaluate(() => (window as unknown as { __revealsAsked: number }).__revealsAsked);

describe('The advisories of 2026-10-09', () => {
  it('GHSA-h34m-3f58-vj6h: a private tab opened while the last private session is cleared waits for it, and sees none of it', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'link-a');
      // The private session's clearing is held until the check lets it go.
      await h.app.evaluate(({ session }) => {
        const s = session.fromPartition('hypersol-private');
        const real = s.clearStorageData.bind(s);
        const g = globalThis as unknown as { __clearAsked?: boolean; __clearGo?: () => void };
        g.__clearAsked = false;
        s.clearStorageData = ((...args: Parameters<typeof real>) => {
          g.__clearAsked = true;
          return new Promise<void>((resolve, reject) => {
            g.__clearGo = () => {
              s.clearStorageData = real;
              real(...args).then(resolve, reject);
            };
          });
        }) as typeof s.clearStorageData;
      });

      await pressInShell(h, 'N', ['control', 'shift']);
      await waitFor('a private tab', () => focusedTab(h), (t) => t.private);
      await navigateTo(h, server.url('cookie.html?set=1'));
      await waitForPage(h, 'cookie');
      expect(await inPage<string>(h, 'document.cookie', await focusedPage(h))).toContain('hs_test=1');

      // The last private tab closes: the clearing starts, and is held.
      await pressInShell(h, 'W', ['control']);
      await waitFor('the clearing started', () => h.app.evaluate(() => (globalThis as unknown as { __clearAsked: boolean }).__clearAsked), (a) => a);

      // A new private tab meanwhile: its page is held, and never reaches the site.
      await pressInShell(h, 'N', ['control', 'shift']);
      await waitFor('a new private tab', () => focusedTab(h), (t) => t.private);
      await navigateTo(h, server.url('cookie.html?after=1'));
      const held = async () => (await mainLog(h, 'heldRequests')).some((u) => u.includes('after=1'));
      const reached = () => server.hits.has('/cookie.html?after=1');
      await waitFor('the page held (or, without the fix, loaded)', async () => (await held()) || reached(), (done) => done);
      const reachedEarly = reached();
      // (Without the fix, the page has loaded before the clearing ends.)
      if (reachedEarly) await waitForPage(h, 'after=1');

      // Once the clearing ends, the page loads, without the old session's
      // cookie: what it saw as it loaded (written in the page), as the
      // clearing would take the cookie away again afterwards.
      await h.app.evaluate(() => (globalThis as unknown as { __clearGo: () => void }).__clearGo());
      await waitForPage(h, 'after=1');
      const page = await focusedPage(h);
      expect(await inPage<string>(h, `document.getElementById('cookies').textContent`, page)).not.toContain('hs_test');
      expect(await inPage<string>(h, 'document.cookie', page)).not.toContain('hs_test');
      expect(reachedEarly).toBe(false);

      // What the new session writes stays: the clearing was over before its page loaded.
      await inPage(h, `document.cookie = 'hs_new=1; path=/'; true`, page);
      const kept = await h.app.evaluate(async ({ session }) =>
        (await session.fromPartition('hypersol-private').cookies.get({ name: 'hs_new' })).map((c) => c.value),
      );
      expect(kept).toEqual(['1']);
    } finally {
      await h.close();
    }
  });

  it('GHSA-2mm9-j4r3-p2v2: a Show answered after the Library closed shows nothing, closed and reopened too', async () => {
    const profile = newProfile();
    const h = await launch(server.url('login.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'login');
      await signInAndSave(h, profile, 'ada', 'test-pass-1', await focusedPage(h));
      await openPasswords(h);
      await holdReveals(h);

      // Show, then close before the answer comes; it comes while closed.
      await h.shell.click(LIB('pw-reveal'));
      await waitFor('the Show asked for', () => revealsAsked(h), (n) => n === 1);
      await closeLibrary(h);
      expect(await releaseReveal(h)).toEqual({});
      await openPasswords(h);
      expect(await h.shell.locator(LIB('pw-value')).count()).toBe(0);

      // Show, close, and open again before the answer comes.
      await h.shell.click(LIB('pw-reveal'));
      await waitFor('the Show asked for', () => revealsAsked(h), (n) => n === 2);
      await closeLibrary(h);
      await openPasswords(h);
      expect(await releaseReveal(h)).toEqual({});
      expect(await h.shell.locator(LIB('pw-value')).count()).toBe(0);

      // A Show answered while the Library stays open still shows (the check's hold works).
      await h.shell.click(LIB('pw-reveal'));
      await waitFor('the Show asked for', () => revealsAsked(h), (n) => n === 3);
      expect(Object.values(await releaseReveal(h))).toEqual(['test-pass-1']);
      await waitFor('shown', () => h.shell.locator(LIB('pw-value')).textContent(), (t) => t === 'test-pass-1');
    } finally {
      await h.close();
    }
  });

  it("GHSA-vv44-hw63-7mm7: a deleted sign-in's shown password never appears under a new sign-in given its id", async () => {
    const profile = newProfile();
    const h = await launch(server.url('login.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'login');
      await signInAndSave(h, profile, 'ada', 'test-pass-1', await focusedPage(h));
      const [deleted] = loginRows(profile);
      await openPasswords(h);
      await h.shell.click(LIB('pw-reveal'));
      await waitFor('shown', () => h.shell.locator(LIB('pw-value')).textContent(), (t) => t === 'test-pass-1');

      // Deleted with the Library open.
      await h.shell.click(LIB('pw-delete'));
      await waitFor('deleted', () => h.shell.locator(LIB('pw-item')).count(), (n) => n === 0);

      // Another sign-in is saved, and SQLite gives it the same id (written
      // straight to the file, as the app's own save needs a page's sign-in;
      // the list shows no password, so the stand-in secret is never read).
      const db = new DatabaseSync(join(profile, 'hypersol.sqlite'));
      try {
        db.exec('PRAGMA busy_timeout = 5000');
        db.prepare('INSERT INTO logins (origin, username, secret, created_at) VALUES (?, ?, ?, ?)').run(
          new URL(server.base).origin,
          'grace',
          new Uint8Array([1, 2, 3]),
          Date.now(),
        );
      } finally {
        db.close();
      }
      expect(loginRows(profile)).toEqual([{ id: deleted!.id, username: 'grace' }]);

      await h.shell.evaluate(() => (document.querySelector('hs-library') as unknown as { refresh(): Promise<void> }).refresh());
      await waitFor('the new sign-in listed', () => h.shell.locator(LIB('pw-username')).allTextContents(), (u) => u.join() === 'grace');
      expect(await h.shell.locator(LIB('pw-value')).count()).toBe(0);
      expect(await h.shell.evaluate(() => (document.querySelector('hs-library') as unknown as { revealed: object }).revealed)).toEqual({});
    } finally {
      await h.close();
    }
  });
});
