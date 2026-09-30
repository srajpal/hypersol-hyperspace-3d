import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type { ShellCommand } from '../shared/commands';
import { MAX_WAITING, type Challenge } from '../shared/sign-in';
import { SignIns } from './sign-in';

type Prompt = Extract<ShellCommand, { type: 'sign-in-prompt' }>['prompt'];

const SITE = 'https://site.example';
const shell = {};

/** A stand-in for a web page's WebContents. */
function fakePage(id: number, url = `${SITE}/page`) {
  const page = Object.assign(new EventEmitter(), {
    id,
    destroyed: false,
    hostWebContents: shell as object | null,
    getType: (): string => 'webview',
    getURL: () => url,
    isDestroyed: () => page.destroyed,
  });
  return page;
}

const challenge = (over: Partial<Challenge> = {}): Challenge => ({
  url: `${SITE}/private/`,
  isProxy: false,
  host: 'site.example',
  port: 443,
  realm: 'Staff only',
  forNavigation: true,
  ...over,
});

function setup() {
  const sent: ShellCommand[] = [];
  const signIns = new SignIns({ isTab: (c) => c.hostWebContents === (shell as never), send: (_contents, command) => void sent.push(command) });
  const page = fakePage(1);
  signIns.trackTab(page as never);
  /** What each request was answered, in order: [user name, password], or "cancelled". */
  const told: ([string, string] | 'cancelled')[] = [];
  /** Asks as Chromium would. */
  const ask = (c: Challenge = challenge(), from: ReturnType<typeof fakePage> | null = page) =>
    signIns.ask(from as never, c, (username, password) => void told.push(username === undefined || password === undefined ? 'cancelled' : [username, password]));
  const prompts = () => sent.filter((c) => c.type === 'sign-in-prompt').map((c) => (c as { prompt: Prompt }).prompt);
  const ended = () => sent.filter((c) => c.type === 'sign-in-ended').map((c) => (c as { id: number }).id);
  const fromShell = { sender: shell } as never;
  return { signIns, page, sent, told, ask, prompts, ended, fromShell };
}

describe('HTTP sign-in (review of 2026-09-30, M10)', () => {
  it('asks in the tab the request came from, and gives Chromium what was typed', async () => {
    const { signIns, ask, told, prompts, ended, fromShell } = setup();
    ask();
    expect(told).toEqual([]);
    expect(prompts()).toEqual([{ id: 1, webContentsId: 1, asker: 'site.example', proxy: false, insecure: false, realm: 'Staff only' }]);
    expect(await signIns.handle(fromShell, { op: 'answer', id: 1, username: 'ada', password: 'made-up' })).toEqual({ ok: true, value: null });
    expect(told).toEqual([['ada', 'made-up']]);
    expect(ended()).toEqual([1]);
    // An answer that comes twice, or for a prompt that never was, does nothing.
    await signIns.handle(fromShell, { op: 'answer', id: 1, username: 'x', password: 'y' });
    await signIns.handle(fromShell, { op: 'cancel', id: 99 });
    expect(told).toEqual([['ada', 'made-up']]);
  });

  it('Cancel answers with nothing, so Chromium shows the 401 page the site sent', async () => {
    const { signIns, ask, told, fromShell } = setup();
    ask();
    await signIns.handle(fromShell, { op: 'cancel', id: 1 });
    expect(told).toEqual(['cancelled']);
  });

  it('cancels at once what no tab can be asked about', () => {
    const { ask, told, prompts } = setup();
    // No web contents (a request of the app's own), the shell itself, a page no shell of ours hosts, a page that has gone.
    ask(challenge(), null);
    const window = fakePage(2);
    window.getType = () => 'window';
    ask(challenge(), window);
    const stray = fakePage(3);
    stray.hostWebContents = {};
    ask(challenge(), stray);
    const gone = fakePage(4);
    gone.destroyed = true;
    ask(challenge(), gone);
    // Not a web address; and a part of the page that comes from another site.
    ask(challenge({ url: 'ftp://site.example/file' }));
    ask(challenge({ url: 'https://other.example/picture.png', forNavigation: false }));
    expect(told).toEqual(Array(6).fill('cancelled'));
    expect(prompts()).toEqual([]);
  });

  it('a second sign-in in the same tab waits its turn; the same one again shares the prompt and its answer', async () => {
    const { signIns, ask, told, prompts, fromShell } = setup();
    ask();
    ask(challenge({ url: `${SITE}/private/picture.png`, forNavigation: false })); // the same sign-in
    ask(challenge({ realm: 'Archive' })); // another one
    expect(prompts().map((p) => p.realm)).toEqual(['Staff only']);
    await signIns.handle(fromShell, { op: 'answer', id: 1, username: 'ada', password: 'made-up' });
    expect(told).toEqual([
      ['ada', 'made-up'],
      ['ada', 'made-up'],
    ]);
    // Only now is the second one shown.
    expect(prompts().map((p) => p.realm)).toEqual(['Staff only', 'Archive']);
    await signIns.handle(fromShell, { op: 'cancel', id: prompts()[1]!.id });
    expect(told[2]).toBe('cancelled');
  });

  it(`lets at most ${MAX_WAITING} sign-ins of one tab wait: more are cancelled`, () => {
    const { ask, told, prompts } = setup();
    for (let i = 0; i <= MAX_WAITING; i++) ask(challenge({ realm: `Area ${i}` }));
    expect(told).toEqual(['cancelled']);
    expect(prompts()).toHaveLength(1);
  });

  it('each tab has its own prompt: one tab neither holds up nor answers the prompt of another', async () => {
    const { signIns, ask, told, prompts, fromShell } = setup();
    const second = fakePage(2);
    signIns.trackTab(second as never);
    ask();
    ask(challenge(), second);
    expect(prompts().map((p) => p.webContentsId)).toEqual([1, 2]);
    await signIns.handle(fromShell, { op: 'answer', id: 2, username: 'ada', password: 'made-up' });
    expect(told).toEqual([['ada', 'made-up']]);
    // Only the shell that hosts the tab may answer.
    await signIns.handle({ sender: {} } as never, { op: 'answer', id: 1, username: 'x', password: 'y' });
    expect(told).toHaveLength(1);
  });

  it('a new page in the tab, a crash, or closing it cancels what was asked, waiting ones too', () => {
    for (const leave of ['navigate', 'crash', 'close'] as const) {
      const { ask, told, page, ended } = setup();
      ask();
      ask(challenge({ realm: 'Archive' }));
      // A jump inside the page, or a frame going elsewhere, is not leaving.
      page.emit('did-start-navigation', { isMainFrame: true, isSameDocument: true });
      page.emit('did-start-navigation', { isMainFrame: false, isSameDocument: false });
      expect(told).toEqual([]);
      if (leave === 'navigate') page.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false });
      else if (leave === 'crash') page.emit('render-process-gone');
      else {
        page.destroyed = true;
        page.emit('destroyed');
      }
      expect(told, leave).toEqual(['cancelled', 'cancelled']);
      // The shell is told to take the prompts away while there is a page to tell it for.
      expect(ended(), leave).toEqual(leave === 'close' ? [] : [1, 2]);
    }
  });

  it('refuses a request that is not one, without answering anything', async () => {
    const { signIns, ask, told, fromShell } = setup();
    ask();
    expect(await signIns.handle(fromShell, { op: 'answer', id: 1, username: 'ada' })).toHaveProperty('error');
    expect(await signIns.handle(fromShell, { op: 'answer', id: 1, username: 'ada', password: 'x'.repeat(1025) })).toHaveProperty('error');
    expect(await signIns.handle(fromShell, { op: 'forget', id: 1 })).toHaveProperty('error');
    expect(told).toEqual([]);
  });
});
