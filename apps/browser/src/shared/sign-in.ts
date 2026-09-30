/**
 * HTTP sign-in (review of 2026-09-30, M10): a site that answers "401"
 * and asks for a user name and password (Basic or Digest), or a proxy
 * that does. The main process holds the request and asks the person
 * through a prompt in the shell, for the tab the request came from.
 * Nothing typed is kept by the browser's own code or offered to the
 * password manager; Chromium remembers it for the session, as it does in
 * any browser.
 *
 * Pure, so the main process, the shell, and the unit tests share it.
 */
import { originOf } from './permissions';

/** The shell answers sign-in prompts over this channel. */
export const SIGN_IN_CHANNEL = 'hypersol:sign-in';

/** The most of a server's realm the prompt shows, in characters. */
export const MAX_REALM = 80;
/** The longest user name or password taken from the prompt, in characters. */
export const MAX_SIGN_IN_TEXT = 1024;
/** The most sign-in requests of one tab that wait their turn; more are cancelled. */
export const MAX_WAITING = 10;

/** A prompt the shell shows under the top bar for one tab's page. */
export interface SignInPrompt {
  id: number;
  webContentsId: number;
  /**
   * Who asks, as the browser knows it, never as the server says it: the
   * site's host, with its port if it has one ("example.com",
   * "127.0.0.1:8123"), from the request's own address; for a proxy, the
   * proxy's host and port.
   */
  asker: string;
  /** A proxy asks, not the site. */
  proxy: boolean;
  /** The request is not over https: what is typed can be read on the way. */
  insecure: boolean;
  /** The server's own words (its "realm"), cut to MAX_REALM; '' when it gave none. Shown as a quotation. */
  realm: string;
}

/** What the main process knows about a sign-in request (Electron's login event). */
export interface Challenge {
  /** The address of the request that was answered "401" (or "407" by a proxy). */
  url: string;
  isProxy: boolean;
  /** The proxy's host and port (for a site they repeat the address's). */
  host: string;
  port: number;
  realm: string;
  /** The request is a page or frame being loaded, not a part of a page (a picture, a script's request). */
  forNavigation: boolean;
}

export type SignInRequest = { op: 'answer'; id: number; username: string; password: string } | { op: 'cancel'; id: number };

export interface SignInResults {
  answer: null;
  cancel: null;
}

export type SignInOp = SignInRequest['op'];
export type SignInReply<K extends SignInOp> = { ok: true; value: SignInResults[K] } | { ok: false; error: string };

/**
 * A server's realm as the prompt may show it: on one line, without
 * control characters, and cut to MAX_REALM characters (a cut one ends in
 * "…"). The words are the server's, so they are only ever shown as a
 * quotation.
 */
export function quotedRealm(realm: string): string {
  const line = [...realm.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').replace(/\s+/g, ' ').trim()];
  return line.length > MAX_REALM ? `${line.slice(0, MAX_REALM - 1).join('')}…` : line.join('');
}

/**
 * What the prompt says for a sign-in request, or null when nobody is
 * asked and the request is cancelled: a request that is not for a web
 * address, and a part of a page (a picture, a script's request) that
 * comes from another site than the page, so a page cannot put another
 * site's sign-in prompt in front of its reader (Chromium's own browser
 * refuses those too).
 *
 * @param pageUrl The address of the page in the tab the request came from.
 */
export function describeChallenge(c: Challenge, pageUrl: string): Omit<SignInPrompt, 'id' | 'webContentsId'> | null {
  const origin = originOf(c.url);
  if (!origin) return null;
  const realm = quotedRealm(c.realm);
  if (c.isProxy) {
    if (c.host === '') return null;
    // An IPv6 address is written in brackets before a port.
    const host = c.host.includes(':') && !c.host.startsWith('[') ? `[${c.host}]` : c.host;
    return { asker: `${host}:${c.port}`, proxy: true, insecure: false, realm };
  }
  if (!c.forNavigation && originOf(pageUrl) !== origin) return null;
  return { asker: new URL(origin).host, proxy: false, insecure: !origin.startsWith('https:'), realm };
}

/**
 * Requests for the same sign-in: the same asker, the same realm. One
 * answer serves them all (a page with ten pictures behind one sign-in
 * asks once).
 */
export function challengeKey(p: Pick<SignInPrompt, 'asker' | 'proxy' | 'insecure' | 'realm'>): string {
  return JSON.stringify([p.proxy, p.insecure, p.asker, p.realm]);
}

/** The prompt's first line, in two parts around the asker's name (shown in bold). */
export function signInWords(p: Pick<SignInPrompt, 'proxy'>): { before: string; after: string } {
  return p.proxy ? { before: 'The proxy ', after: ' asks for a user name and password.' } : { before: '', after: ' asks for a user name and password.' };
}

/** Said when the request is not over https. */
export const INSECURE_SIGN_IN = "This site's connection is not private; the password can be read on the way.";

const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1;
const isTyped = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_SIGN_IN_TEXT;

export function parseSignInRequest(raw: unknown): { request: SignInRequest } | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'Not a request' };
  const r = raw as Record<string, unknown>;
  switch (r['op']) {
    case 'answer':
      if (!isId(r['id'])) return { error: 'answer: id must be a prompt id' };
      if (!isTyped(r['username']) || !isTyped(r['password'])) {
        return { error: `answer: the user name and the password must be text of at most ${MAX_SIGN_IN_TEXT} characters` };
      }
      return { request: { op: 'answer', id: r['id'], username: r['username'], password: r['password'] } };
    case 'cancel':
      if (!isId(r['id'])) return { error: 'cancel: id must be a prompt id' };
      return { request: { op: 'cancel', id: r['id'] } };
    default:
      return { error: `Unknown request: ${String(r['op'])}` };
  }
}
