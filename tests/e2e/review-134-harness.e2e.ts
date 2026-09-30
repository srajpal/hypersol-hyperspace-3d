/**
 * Checks of the test tools themselves, from the review of 2026-09-30
 * (prompts 134 and 135): the repairs to the harness and the fixture
 * server that other checks now lean on. Each fails without its repair.
 */
import { get } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  AppGone,
  caughtUp,
  clickUntil,
  focusedPage,
  inPage,
  launch,
  newProfile,
  screenPointOf,
  shellCall,
  waitFor,
  waitForExit,
  waitForPage,
} from './harness';

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

describe('the fixture server: the slow download', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends its first pieces and then holds, however much time passes, until it is released', async () => {
    // The server runs in this process, so its timers run by this clock:
    // one the check moves, from before the request is made.
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] });
    let received = 0;
    let ended = false;
    let more: () => void = () => undefined;
    /** Resolves when the next piece has arrived, or the file has ended. */
    const next = () => new Promise<void>((resolve) => (more = resolve));
    const request = get(server.url('download/slow.bin'), (res) => {
      res.on('data', (piece: Buffer) => {
        received += piece.length;
        more();
      });
      res.on('end', () => {
        ended = true;
        more();
      });
    });
    try {
      // Once the server has the request (turn by turn of this process,
      // not by the clock)...
      while ((server.hits.get('/download/slow.bin') ?? 0) === 0) await new Promise((r) => setImmediate(r));
      // ...a minute passes on its clock. Sent against the clock, as it was
      // until 2026-09-30 (16 KB every 100 ms), the whole file goes out now.
      vi.advanceTimersByTime(60_000);
      while (received < 64 * 1024 && !ended) await next();
      // Anything more the server sent in that minute is here before the
      // answer to a request made after it.
      await new Promise<void>((resolve, reject) => get(server.url('icon.png'), (res) => res.resume().on('end', resolve)).on('error', reject));
      expect({ received, ended }).toEqual({ received: 64 * 1024, ended: false });
      // Released: the rest comes, and the file ends.
      server.release('slow.bin');
      while (!ended) await next();
      expect(received).toBe(2 * 1024 * 1024);
    } finally {
      request.destroy();
    }
  });
});

describe('the harness: waiting on an app that has gone', () => {
  it('a wait stops with AppGone when the app has ended, instead of asking a dead app for its full time', async () => {
    const h = await launch(server.url('link-a.html'));
    try {
      await waitForPage(h, 'link-a');
      // The app ends at once, as in a crash: no window closes, nothing is said.
      void h.app.evaluate(({ app }) => app.exit(3)).catch(() => undefined);
      await waitForExit(h, 30_000);
      // Two minutes allowed, and never true: only the app's end stops it.
      const failed = await waitFor('an answer from the app', () => shellCall(h, 'tabs'), () => false, 120_000).then(
        () => null,
        (e: unknown) => e,
      );
      expect(failed).toBeInstanceOf(AppGone);
      expect(String(failed)).toContain("The app's process has ended");
      expect(String(failed)).toContain('an answer from the app');
    } finally {
      await h.close();
    }
  }, 60_000);
});

describe('the harness: caughtUp', () => {
  it('what a sign-in or a click brings is there as soon as caughtUp returns, with no further wait', async () => {
    // The checks that something is NOT offered or shown (K1, K2, K4, issue
    // #19) look right after caughtUp. That proves something only if, where
    // the thing IS offered or shown, it is already there at that moment:
    // here a new password brings an offer, and a click on the field the
    // list of saved sign-ins, five times each.
    const h = await launch(server.url('login.html'), { userDataDir: newProfile({ layersOnOpen: false }) });
    try {
      await waitForPage(h, 'login');
      const page = await focusedPage(h);
      const offer = async () => (await shellCall(h, 'prompts')).offer;
      const listShown = () => inPage<boolean>(h, `document.querySelector('hypersol-sign-ins') !== null`, page);
      const signIn = async (pass: string) => {
        await inPage(
          h,
          `document.getElementById('user').value = 'ada'; document.getElementById('pass').value = ${JSON.stringify(pass)}; document.getElementById('state').textContent = 'Sign in'; true`,
          page,
        );
        await clickUntil(h, await screenPointOf(h, '#go', page), 'the sign-in', async () => (await inPage<string>(h, `document.getElementById('state').textContent`, page)) === 'Signed in');
      };
      // One saved sign-in, so that a click on the field has a list to bring.
      await signIn('test-pass-0');
      await waitFor('an offer', offer, (o) => o !== null);
      await h.shell.click('hs-prompts [data-testid="pw-save"]');
      await waitFor('the offer answered', offer, (o) => o === null);
      for (let i = 1; i <= 5; i++) {
        await signIn(`test-pass-${i}`);
        await caughtUp(h, page);
        expect(await offer(), `offer ${i}`).toMatchObject({ username: 'ada', update: true, id: i + 1 });
        await h.shell.click('hs-prompts [data-testid="pw-not-now"]');
        await waitFor('the offer answered', offer, (o) => o === null);

        await inPage(h, 'document.activeElement?.blur(), true', page);
        await clickUntil(h, await screenPointOf(h, '#user', page), 'the field to take the keyboard', () =>
          inPage<boolean>(h, `document.activeElement === document.getElementById('user')`, page),
        );
        await caughtUp(h, page);
        expect(await listShown(), `list ${i}`).toBe(true);
        // The page losing the keyboard puts the list away, for the next round.
        await inPage(h, `dispatchEvent(new Event('blur')), true`, page);
        await waitFor('the list put away', listShown, (shown) => !shown);
      }
    } finally {
      await h.close();
    }
  });
});
