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

export interface PagePasswordResults {
  submitted: null;
  /** Saved user names for this page's origin (no passwords). */
  accounts: string[];
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
