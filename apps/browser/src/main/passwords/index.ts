import type { IpcMainInvokeEvent, WebContents } from 'electron';
import type { ShellCommand } from '../../shared/commands';
import { originOf } from '../../shared/permissions';
import { parsePagePasswordRequest, type PagePasswordRequest } from '../../shared/page-passwords';
import { parsePasswordRequest, type PasswordOffer, type PasswordRequest } from '../../shared/passwords';
import { GESTURE_EVENTS } from '../popups';
import type { PasswordVault } from './vault';

/** A saved password is handed to a page only this soon after a real click or key press in it. */
export const FILL_GESTURE_MS = 5000;

export interface PasswordDeps {
  /** The page is in a private tab: nothing is offered, saved, or filled there. */
  isPrivate(contents: WebContents): boolean;
  /** Sends a command to the shell that hosts a page. */
  send(contents: WebContents, command: ShellCommand): void;
  writeClipboard(text: string): void;
  /** Saved passwords changed (the Library refreshes). */
  onChange(): void;
}

interface PendingOffer {
  offer: PasswordOffer;
  password: string;
  contents: WebContents;
}

/**
 * The password manager's main-process side (milestone 9). A page's
 * preload reports a sign-in (submitted), asks which accounts are saved for
 * the page (accounts), and asks for one to be filled (fill). The origin is
 * always the page's real one, from the frame that sent the request, and
 * only the page's main frame is heard. Private tabs are never offered,
 * saved, or filled. The shell answers offers and runs the Library's
 * Passwords tab.
 */
export class Passwords {
  private readonly offers = new Map<number, PendingOffer>();
  private nextOffer = 1;
  private readonly lastGesture = new WeakMap<WebContents, number>();

  constructor(
    private readonly vault: PasswordVault,
    private readonly deps: PasswordDeps,
  ) {}

  /** Watches a web page for real input (for filling) and drops its offers when it closes. */
  trackTab(contents: WebContents): void {
    contents.on('input-event', (_event, input) => {
      if (GESTURE_EVENTS.has(input.type)) this.lastGesture.set(contents, Date.now());
    });
    contents.once('destroyed', () => {
      for (const [id, pending] of this.offers) if (pending.contents === contents) this.offers.delete(id);
    });
  }

  /** A request from a page's preload. Never throws. */
  handlePage(event: IpcMainInvokeEvent, raw: unknown): unknown {
    const contents = event.sender;
    const frame = event.senderFrame;
    if (contents.getType() !== 'webview' || !frame || frame !== contents.mainFrame) return null;
    const parsed = parsePagePasswordRequest(raw);
    if ('error' in parsed) return null;
    const origin = originOf(frame.url);
    const request = parsed.request;
    if (!origin || this.deps.isPrivate(contents)) return request.op === 'accounts' ? [] : null;
    try {
      return this.page(contents, origin, request);
    } catch (e) {
      console.warn(`Password request failed: ${e instanceof Error ? e.message : String(e)}`);
      return request.op === 'accounts' ? [] : null;
    }
  }

  private page(contents: WebContents, origin: string, r: PagePasswordRequest): unknown {
    switch (r.op) {
      case 'submitted': {
        // Only a sign-in the person made: real input to this page just
        // before, as for filling. A script's requestSubmit() alone makes a
        // trusted submit event, but no input (GitHub issue #19).
        const input = this.lastGesture.get(contents);
        if (input === undefined || Date.now() - input > FILL_GESTURE_MS) return null;
        const problem = this.vault.problem();
        const kind = this.vault.consider(origin, r.username, r.password);
        if (!kind) return null;
        // One offer per tab: a newer sign-in replaces an unanswered one.
        for (const [id, pending] of this.offers) if (pending.contents === contents) this.offers.delete(id);
        const offer: PasswordOffer = {
          id: this.nextOffer++,
          webContentsId: contents.id,
          origin,
          username: r.username,
          update: kind === 'update',
          insecure: origin.startsWith('http:'),
          ...(problem ? { problem } : {}),
        };
        if (!problem) this.offers.set(offer.id, { offer, password: r.password, contents });
        this.deps.send(contents, { type: 'password-offer', offer });
        return null;
      }
      case 'accounts':
        return this.vault.accounts(origin);
      case 'fill': {
        const at = this.lastGesture.get(contents);
        if (at === undefined || Date.now() - at > FILL_GESTURE_MS) return null;
        return this.vault.password(origin, r.username);
      }
    }
  }

  /** A request from the shell (registered with handleFromShell, main/ipc.ts). Never throws. */
  async handleShell(raw: unknown): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
    const parsed = parsePasswordRequest(raw);
    if ('error' in parsed) return { ok: false, error: parsed.error };
    try {
      return { ok: true, value: this.shell(parsed.request) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private shell(r: PasswordRequest): unknown {
    switch (r.op) {
      case 'status': {
        const message = this.vault.problem();
        return message ? { available: false, message } : { available: true };
      }
      case 'list':
        return this.vault.list();
      case 'reveal':
        return this.vault.reveal(r.id);
      case 'copy':
        this.deps.writeClipboard(this.vault.reveal(r.id));
        return null;
      case 'delete':
        this.vault.delete(r.id);
        this.deps.onChange();
        return null;
      case 'never.list':
        return this.vault.neverList();
      case 'never.remove':
        this.vault.removeNever(r.origin);
        this.deps.onChange();
        return null;
      case 'answer': {
        const pending = this.offers.get(r.offer);
        if (!pending) return null;
        this.offers.delete(r.offer);
        if (r.answer === 'save') this.vault.save(pending.offer.origin, pending.offer.username, pending.password);
        else if (r.answer === 'never') this.vault.never(pending.offer.origin);
        if (r.answer !== 'not-now') this.deps.onChange();
        return null;
      }
    }
  }
}
