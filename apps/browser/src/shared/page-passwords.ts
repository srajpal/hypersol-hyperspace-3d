/**
 * Requests from a web page's preload to the password manager (milestone
 * 9; see shared/passwords.ts). Kept apart from shared/passwords.ts on
 * purpose: the shell's preload uses that file, and the two preloads must
 * not share a module, or the build splits it into a separate file, which a
 * sandboxed preload cannot load (found 2026-09-26; checked by
 * preload/preload-graph.test.ts).
 */

/** Page preload to main process (main frame of a web page only). */
export const PAGE_PASSWORDS_CHANNEL = 'hypersol:page-passwords';

export const MAX_USERNAME = 512;
export const MAX_PASSWORD = 1024;

export type PagePasswordRequest =
  | { op: 'submitted'; username: string; password: string }
  | { op: 'accounts' }
  | { op: 'fill'; username: string };

/**
 * The theme's colours for the list of saved sign-ins. The list is the
 * browser's own, drawn inside the page by its preload, so its colours are
 * the theme in use, which the main process knows and sends with the
 * names (review of 2026-09-30, St3: the list had a copy of the dark
 * theme's colours, and stayed dark in the light theme).
 */
export interface SignInListColors {
  text: string;
  textMuted: string;
  surface: string;
  accent: string;
}

/** The answer to 'accounts': the names to offer, and the colours to show them in. */
export interface AccountsReply {
  names: string[];
  colors: SignInListColors;
}

const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** Checks an answer to 'accounts' (the page side does not trust its input either). Null: nothing to show. */
export function parseAccountsReply(raw: unknown): AccountsReply | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const c = r['colors'] as Record<string, unknown> | null | undefined;
  if (!Array.isArray(r['names']) || typeof c !== 'object' || c === null) return null;
  if (!isColor(c['text']) || !isColor(c['textMuted']) || !isColor(c['surface']) || !isColor(c['accent'])) return null;
  const names = r['names'].filter((n): n is string => typeof n === 'string' && n.length <= MAX_USERNAME);
  if (names.length === 0) return null;
  return { names, colors: { text: c['text'], textMuted: c['textMuted'], surface: c['surface'], accent: c['accent'] } };
}

export interface PagePasswordResults {
  submitted: null;
  /** Saved user names for this page's origin (no passwords) with the list's colours; null when there are none. */
  accounts: AccountsReply | null;
  /** The password, only right after a real click or key press in the page. */
  fill: string | null;
}

export function parsePagePasswordRequest(raw: unknown): { request: PagePasswordRequest } | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'Not a request' };
  const r = raw as Record<string, unknown>;
  const name = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_USERNAME;
  switch (r['op']) {
    case 'submitted':
      if (!name(r['username'])) return { error: 'submitted: bad user name' };
      if (typeof r['password'] !== 'string' || r['password'].length === 0 || r['password'].length > MAX_PASSWORD) {
        return { error: 'submitted: bad password' };
      }
      return { request: { op: 'submitted', username: r['username'], password: r['password'] } };
    case 'accounts':
      return { request: { op: 'accounts' } };
    case 'fill':
      if (!name(r['username'])) return { error: 'fill: bad user name' };
      return { request: { op: 'fill', username: r['username'] } };
    default:
      return { error: `Unknown request: ${String(r['op'])}` };
  }
}
