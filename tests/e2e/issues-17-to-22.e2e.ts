/**
 * Checks for GitHub issues #17, #18, #19, and #22 (filed 2026-09-27):
 * sleeping tabs keep unsent drafts and live capture, a script alone
 * cannot bring up a password offer, and blocking the camera stops it.
 * Issue #20 is fixed in m4 (F9) and m7 (I6).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  caughtUp,
  clickAt,
  focusedPage,
  focusedTab,
  inPage,
  launch,
  navigateTo,
  newProfile,
  pressInShell,
  screenPointOf,
  shellCall,
  sleep,
  tabs,
  typeInPage,
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

const PROMPT = (id: string) => `hs-prompts [data-testid="${id}"]`;
const BAR = (id: string) => `hs-toolbar [data-testid="${id}"]`;
const SITE = (id: string) => `hs-site-panel [data-testid="${id}"]`;

/** Opens a page in a new tab and waits for it; returns the tab's id. */
async function openTab(h: Harness, file: string): Promise<number> {
  await pressInShell(h, 'T', ['control']);
  await waitFor('new tab', () => focusedTab(h), (t) => t.state === 'start');
  await navigateTo(h, server.url(file));
  await waitForPage(h, file.replace(/\.html.*$/, ''));
  return (await focusedTab(h)).id;
}

/** Answers the camera or microphone prompt with Allow. */
async function allow(h: Harness): Promise<void> {
  await waitFor('prompt', async () => (await shellCall(h, 'prompts')).permission, (p) => p !== null);
  await h.shell.click(PROMPT('perm-allow'));
}

describe('issue #17: unsent drafts keep a tab awake', () => {
  it('in a frame of the same site, in a shadow root, and after a submit the page stopped; the drafts are still there', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ tabSleep: 5, economy: 'off' }), sleepMinuteMs: 100 });
    try {
      await waitForPage(h, 'link-a');
      const idle = (await focusedTab(h)).id;
      // A frame of the same site.
      const framed = await openTab(h, 'sleep-iframe.html');
      let page = await focusedPage(h);
      await waitFor('frame loaded', () => inPage<boolean>(h, 'Boolean(document.getElementById("frame").contentDocument?.getElementById("draft"))', page), (v) => v);
      await clickAt(h, await screenPointOf(h, '#frame', page));
      await inPage(h, 'document.getElementById("frame").contentDocument.getElementById("draft").focus(); true', page);
      await typeInPage(h, 'framed draft', page);
      // A shadow root.
      const shadowed = await openTab(h, 'sleep-shadow.html');
      page = await focusedPage(h);
      await clickAt(h, await screenPointOf(h, '#box', page));
      await inPage(h, 'document.getElementById("box").shadowRoot.getElementById("draft").focus(); true', page);
      await typeInPage(h, 'shadow draft', page);
      // A submit the page stopped (the sign-in fixture keeps its text).
      const stopped = await openTab(h, 'login.html');
      page = await focusedPage(h);
      await clickAt(h, await screenPointOf(h, '#user', page));
      await typeInPage(h, 'kept draft', page);
      await inPage(h, 'document.getElementById("login").requestSubmit(); true', page);
      expect(await inPage<string>(h, 'document.getElementById("state").textContent', page)).toBe('Signed in');
      // Out of view, past the wait.
      await openTab(h, 'link-b.html?front=1');
      await sleep(1000);
      await shellCall(h, 'sleepNow');
      const all = await waitFor('the idle tab asleep', () => tabs(h), (t) => t.find((x) => x.id === idle)?.asleep === true);
      for (const [name, id] of [['frame', framed], ['shadow root', shadowed], ['stopped submit', stopped]] as const) {
        expect(all.find((x) => x.id === id)!.asleep, name).toBe(false);
      }
      expect(await inPage<string>(h, 'document.getElementById("frame").contentDocument.getElementById("draft").value', 'sleep-iframe')).toBe('framed draft');
      expect(await inPage<string>(h, 'document.getElementById("box").shadowRoot.getElementById("draft").value', 'sleep-shadow')).toBe('shadow draft');
      expect(await inPage<string>(h, 'document.getElementById("user").value', 'login')).toBe('kept draft');
      // Cleared by the page, the draft no longer holds the tab.
      await inPage(h, 'document.getElementById("user").value = ""; document.getElementById("user").dispatchEvent(new FocusEvent("focusout", { bubbles: true })); true', 'login');
      await sleep(300);
      await shellCall(h, 'sleepNow');
      await waitFor('the cleared tab asleep', () => tabs(h), (t) => t.find((x) => x.id === stopped)?.asleep === true);
    } finally {
      await h.close();
    }
  });
});

describe('issue #18: live capture keeps a tab awake', () => {
  it('video-only and silent microphone capture; a stopped stream lets the tab sleep again', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ tabSleep: 5, economy: 'off' }), sleepMinuteMs: 100 });
    try {
      await waitForPage(h, 'link-a');
      const camera = await openTab(h, 'media.html?camera');
      let page = await focusedPage(h);
      let started = inPage<string>(h, 'navigator.mediaDevices.getUserMedia({ video: true }).then((s) => { window.keep = s; return "live"; }, (e) => e.name)', page);
      await allow(h);
      expect(await started).toBe('live');
      const microphone = await openTab(h, 'media.html?microphone');
      page = await focusedPage(h);
      started = inPage<string>(h, 'navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => { window.keep = s; return "live"; }, (e) => e.name)', page);
      await allow(h);
      expect(await started).toBe('live');
      await openTab(h, 'link-b.html?front=1');
      await sleep(1000);
      await shellCall(h, 'sleepNow');
      await sleep(500);
      let all = await tabs(h);
      expect(all.find((x) => x.id === camera)!.asleep).toBe(false);
      expect(all.find((x) => x.id === microphone)!.asleep).toBe(false);
      expect(all.find((x) => x.id === microphone)!.audible).toBe(false); // silent: kept awake by the capture alone
      // A clone of the camera keeps it on after the original stops (PR #29 review).
      await inPage(h, 'window.copy = window.keep.getVideoTracks()[0].clone(); window.keep.getTracks().forEach((t) => t.stop()); true', 'media.html?camera');
      await sleep(300);
      await shellCall(h, 'sleepNow');
      await sleep(500);
      expect((await tabs(h)).find((x) => x.id === camera)!.asleep).toBe(false);
      // The clone stops too: that tab may sleep again.
      await inPage(h, 'window.copy.stop(); true', 'media.html?camera');
      await sleep(300);
      await shellCall(h, 'sleepNow');
      all = await waitFor('the camera tab asleep', () => tabs(h), (t) => t.find((x) => x.id === camera)?.asleep === true);
      expect(all.find((x) => x.id === microphone)!.asleep).toBe(false);
    } finally {
      await h.close();
    }
  });
});

describe('issue #19: no password offer from a script alone', () => {
  it('requestSubmit() without input brings no offer; a real sign-in still does', async () => {
    const h = await launch(server.url('login.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'login');
      const page = await focusedPage(h);
      await inPage(
        h,
        `document.querySelector('#user').value = 'qa-user'; document.querySelector('#pass').value = 'synthetic-only'; document.querySelector('form').requestSubmit(); true`,
        page,
      );
      // Nothing is offered, once the app has dealt with whatever the
      // page sent it for the script's sign-in.
      await caughtUp(h, page);
      expect((await shellCall(h, 'prompts')).offer).toBeNull();
      // The person signs in: the offer comes.
      await clickAt(h, await screenPointOf(h, '#user', page));
      await inPage(h, 'document.querySelector("#user").select(); true', page);
      await typeInPage(h, 'ada', page);
      await clickAt(h, await screenPointOf(h, '#pass', page));
      await inPage(h, 'document.querySelector("#pass").select(); true', page);
      await typeInPage(h, 'test-pass-1', page);
      await clickAt(h, await screenPointOf(h, '#go', page));
      const made = await waitFor('an offer', async () => (await shellCall(h, 'prompts')).offer, (o) => o !== null && o.username === 'ada');
      // The app numbers its offers as it makes them: this is its first.
      expect(made!.id).toBe(1);
    } finally {
      await h.close();
    }
  });
});

describe('issue #22: blocking the camera stops it', () => {
  it('Block in the site panel ends live capture in every tab on the site; new requests are refused', async () => {
    const h = await launch(server.url('media.html?one'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'media.html?one');
      const one = await focusedPage(h);
      const tabOne = (await focusedTab(h)).id;
      const start = (page: { id: number } | string) =>
        inPage<string>(h, 'navigator.mediaDevices.getUserMedia({ video: true }).then((s) => { window.keep = s; return "live"; }, (e) => e.name)', page);
      const first = start(one);
      await allow(h);
      expect(await first).toBe('live');
      // Clones, of a track and of a whole stream, keep the camera on too (PR #29 review).
      await inPage(h, 'window.trackCopy = window.keep.getVideoTracks()[0].clone(); window.streamCopy = window.keep.clone(); true', one);
      // Another tab on the same site, allowed by the remembered choice.
      await openTab(h, 'media.html?two');
      const two = await focusedPage(h);
      expect(await start(two)).toBe('live');
      await pressInShell(h, 'Tab', ['control', 'shift']);
      await waitFor('first tab', () => focusedTab(h), (t) => t.id === tabOne);
      await waitFor('marker', () => shellCall(h, 'accessOf', tabOne), (k) => k.includes('camera'));
      // Block, through the site panel.
      await h.shell.click(BAR('site-button'));
      await waitFor('site panel', () => shellCall(h, 'sitePanel'), (s) => s.open && s.site !== null);
      await h.shell.selectOption(SITE('site-camera'), 'block');
      const state = (page: { id: number }) => inPage<string>(h, 'window.keep.getVideoTracks()[0].readyState', page);
      await waitFor('first tab stopped', () => state(one), (s) => s === 'ended');
      await waitFor('clones stopped', () => inPage<string>(h, '[window.trackCopy.readyState, window.streamCopy.getVideoTracks()[0].readyState].join()', one), (s) => s === 'ended,ended');
      await waitFor('second tab stopped', () => state(two), (s) => s === 'ended');
      await waitFor('marker gone', () => shellCall(h, 'accessOf', tabOne), (k) => !k.includes('camera'));
      expect(await h.shell.locator(SITE('site-given-camera')).count()).toBe(0);
      expect(await start(one)).toBe('NotAllowedError');
    } finally {
      await h.close();
    }
  });

  for (const blockIn of ['private', 'normal'] as const) {
    it(`Block in a ${blockIn} tab leaves the other kind of tab's capture alone (PR #29 review)`, async () => {
      const h = await launch(server.url('media.html?normal'), { userDataDir: newProfile() });
      try {
        await waitForPage(h, 'media.html?normal');
        const normal = await focusedPage(h);
        const normalTab = (await focusedTab(h)).id;
        const start = (page: { id: number }) =>
          inPage<string>(h, 'navigator.mediaDevices.getUserMedia({ video: true }).then((s) => { window.keep = s; return "live"; }, (e) => e.name)', page);
        const a = start(normal);
        await allow(h);
        expect(await a).toBe('live');
        await pressInShell(h, 'N', ['control', 'shift']);
        await waitFor('private tab', () => focusedTab(h), (t) => t.private);
        const privateTab = (await focusedTab(h)).id;
        await navigateTo(h, server.url('media.html?private'));
        await waitForPage(h, 'media.html?private');
        const secret = await focusedPage(h);
        const b = start(secret);
        await allow(h);
        expect(await b).toBe('live');
        // Block from the chosen tab's site panel.
        const [blocking, other] = blockIn === 'private' ? [secret, normal] : [normal, secret];
        if (blockIn === 'normal') {
          await pressInShell(h, 'Tab', ['control']);
          await waitFor('normal tab', () => focusedTab(h), (t) => t.id === normalTab);
        } else {
          await waitFor('private tab in front', () => focusedTab(h), (t) => t.id === privateTab);
        }
        await h.shell.click(BAR('site-button'));
        await waitFor('site panel', () => shellCall(h, 'sitePanel'), (s) => s.open && s.site !== null);
        await h.shell.selectOption(SITE('site-camera'), 'block');
        const state = (page: { id: number }) => inPage<string>(h, 'window.keep.getVideoTracks()[0].readyState', page);
        await waitFor('the blocking tab stopped', () => state(blocking), (s) => s === 'ended');
        await sleep(500);
        expect(await state(other)).toBe('live');
      } finally {
        await h.close();
      }
    });
  }
});
