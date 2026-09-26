/**
 * The password manager (milestone 9). Passwords are encrypted with the
 * system's keychain and kept in hypersol.sqlite (owner, prompt 38, Q1 a).
 * A page's preload reports sign-ins and asks for accounts over
 * PAGE_PASSWORDS_CHANNEL; the main process decides from the page's real
 * origin, never from anything the page says. A saved password is filled
 * only when you pick the account from the list under a sign-in field
 * (prompt 45, Q1 b), and only on the exact origin it was saved for. The
 * shell manages them over PASSWORDS_CHANNEL (the Library's Passwords tab,
 * prompt 38, Q2 a) and answers save offers.
 */

export const PASSWORDS_CHANNEL = 'hypersol:passwords';

/** A saved sign-in as the Library lists it; the password itself is fetched only on request. */
export interface SavedLogin {
  id: number;
  origin: string;
  username: string;
  createdAt: number;
  usedAt: number | null;
}

/** An offer to save or update a password, shown under the top bar for one tab. */
export interface PasswordOffer {
  id: number;
  webContentsId: number;
  origin: string;
  username: string;
  /** The account is saved with another password: offer to update it. */
  update: boolean;
  /** The page is plain http (saved anyway, with a warning: prompt 45, Q3 a). */
  insecure: boolean;
  /** Why nothing can be saved (the keychain is not available), if so. */
  problem?: string;
}

export type OfferAnswer = 'save' | 'never' | 'not-now';

// ---- From the shell ----------------------------------------------------------

export type PasswordRequest =
  | { op: 'status' }
  | { op: 'list' }
  | { op: 'reveal'; id: number }
  | { op: 'copy'; id: number }
  | { op: 'delete'; id: number }
  | { op: 'never.list' }
  | { op: 'never.remove'; origin: string }
  | { op: 'answer'; offer: number; answer: OfferAnswer };

export interface PasswordResults {
  /** message: why passwords cannot be saved or read, if so. */
  status: { available: boolean; message?: string };
  list: SavedLogin[];
  reveal: string;
  copy: null;
  delete: null;
  'never.list': string[];
  'never.remove': null;
  answer: null;
}

export type PasswordOp = PasswordRequest['op'];
export type PasswordReply<K extends PasswordOp> = { ok: true; value: PasswordResults[K] } | { ok: false; error: string };

export function parsePasswordRequest(raw: unknown): { request: PasswordRequest } | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'Not a request' };
  const r = raw as Record<string, unknown>;
  const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1;
  switch (r['op']) {
    case 'status':
    case 'list':
    case 'never.list':
      return { request: { op: r['op'] } };
    case 'reveal':
    case 'copy':
    case 'delete':
      if (!isId(r['id'])) return { error: `${r['op']}: id must be a saved sign-in` };
      return { request: { op: r['op'], id: r['id'] } };
    case 'never.remove':
      if (typeof r['origin'] !== 'string' || r['origin'].length > 300) return { error: 'never.remove: origin must be text' };
      return { request: { op: 'never.remove', origin: r['origin'] } };
    case 'answer':
      if (!isId(r['offer'])) return { error: 'answer: offer must be an offer id' };
      if (r['answer'] !== 'save' && r['answer'] !== 'never' && r['answer'] !== 'not-now') {
        return { error: 'answer: answer must be save, never, or not-now' };
      }
      return { request: { op: 'answer', offer: r['offer'], answer: r['answer'] } };
    default:
      return { error: `Unknown request: ${String(r['op'])}` };
  }
}
