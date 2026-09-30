import type { IpcMainInvokeEvent, WebContents } from 'electron';
import type { ShellCommand } from '../shared/commands';
import { challengeKey, describeChallenge, MAX_WAITING, parseSignInRequest, type Challenge, type SignInPrompt, type SignInRequest } from '../shared/sign-in';

export interface SignInDeps {
  /** Is this a web page in one of the shell's tabs? Nothing else is ever asked for. */
  isTab(contents: WebContents): boolean;
  /** Sends a command to the shell that hosts a page. */
  send(contents: WebContents, command: ShellCommand): void;
}

/** Electron's answer to a sign-in request: a user name and password, or nothing to cancel it. */
export type Answer = (username?: string, password?: string) => void;

interface Pending {
  prompt: SignInPrompt;
  contents: WebContents;
  /** Which sign-in it is for (shared/sign-in.ts, challengeKey). */
  key: string;
  /** Every request this prompt's one answer goes to. */
  answers: Answer[];
}

/**
 * HTTP sign-in (review of 2026-09-30, M10): a site, or a proxy, that
 * asks for a user name and password. Until then there was no answer at
 * all, so such a site could never be used. Each request is held while
 * the person is asked in the shell, in a prompt that belongs to the tab
 * the request came from; what they type goes to Chromium and nowhere
 * else, and Cancel (or no tab to ask in) lets Chromium show the site's
 * own "401" page.
 *
 * One prompt shows per tab. A second sign-in asked for in the same tab
 * waits its turn, up to MAX_WAITING; requests for the same sign-in (a
 * page's ten pictures behind one password) share one prompt and its
 * answer. Leaving the page or closing the tab cancels what is waiting;
 * switching tabs answers nothing.
 */
export class SignIns {
  /** Prompts showing or waiting, in the order they were asked for. */
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(private readonly deps: SignInDeps) {}

  /** How many prompts are showing or waiting, in all tabs (for the end-to-end checks). */
  get waiting(): number {
    return this.pending.size;
  }

  /** A request needs signing in to (Electron's login event). Always answers, now or later. */
  ask(contents: WebContents | null, challenge: Challenge, answer: Answer): void {
    const tab = contents !== null && !contents.isDestroyed() && contents.getType() === 'webview' && this.deps.isTab(contents) ? contents : null;
    const described = tab ? describeChallenge(challenge, tab.getURL()) : null;
    if (!tab || !described) {
      answer();
      return;
    }
    const key = challengeKey(described);
    const waiting = this.of(tab);
    const same = waiting.find((p) => p.key === key);
    if (same) {
      same.answers.push(answer);
      return;
    }
    if (waiting.length >= MAX_WAITING) {
      answer();
      return;
    }
    const p: Pending = { prompt: { id: this.nextId++, webContentsId: tab.id, ...described }, contents: tab, key, answers: [answer] };
    this.pending.set(p.prompt.id, p);
    if (waiting.length === 0) this.show(p);
  }

  /** Watches a web page: a new page in the tab, a crash, or closing it cancels what it was asked. */
  trackTab(contents: WebContents): void {
    contents.on('did-start-navigation', (details) => {
      if (details.isMainFrame && !details.isSameDocument) this.drop(contents);
    });
    contents.on('render-process-gone', () => this.drop(contents));
    contents.once('destroyed', () => this.drop(contents));
  }

  /** A request from the shell (registered with handleFromShell, main/ipc.ts). Never throws. */
  async handle(event: IpcMainInvokeEvent, raw: unknown): Promise<{ ok: true; value: null } | { ok: false; error: string }> {
    const parsed = parseSignInRequest(raw);
    if ('error' in parsed) return { ok: false, error: parsed.error };
    this.run(parsed.request, event.sender);
    return { ok: true, value: null };
  }

  private run(r: SignInRequest, shell: WebContents): void {
    const p = this.pending.get(r.id);
    // A prompt already settled (the page moved on meanwhile) has nothing left to answer.
    if (!p || p.contents.isDestroyed() || p.contents.hostWebContents !== shell) return;
    if (r.op === 'answer') this.settle(p, [r.username, r.password]);
    else this.settle(p, null);
  }

  /** The tab's prompts, the one showing first. */
  private of(contents: WebContents): Pending[] {
    return [...this.pending.values()].filter((p) => p.contents === contents);
  }

  private show(p: Pending): void {
    this.deps.send(p.contents, { type: 'sign-in-prompt', prompt: p.prompt });
  }

  /** Answers every request a prompt stands for, takes it off the shell, and shows the tab's next one. */
  private settle(p: Pending, typed: [string, string] | null): void {
    if (!this.pending.delete(p.prompt.id)) return;
    for (const answer of p.answers) {
      try {
        if (typed) answer(typed[0], typed[1]);
        else answer();
      } catch {
        // The request went away by itself (its page closed): nothing to answer.
      }
    }
    if (p.contents.isDestroyed()) return;
    this.deps.send(p.contents, { type: 'sign-in-ended', id: p.prompt.id });
    const next = this.of(p.contents)[0];
    if (next) this.show(next);
  }

  /** Cancels everything a tab was asked: its page is going, or gone. */
  private drop(contents: WebContents): void {
    for (const p of this.of(contents)) {
      this.pending.delete(p.prompt.id);
      for (const answer of p.answers) {
        try {
          answer();
        } catch {
          // As above.
        }
      }
      if (!contents.isDestroyed()) this.deps.send(contents, { type: 'sign-in-ended', id: p.prompt.id });
    }
  }
}
