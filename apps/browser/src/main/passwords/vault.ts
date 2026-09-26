import type { SavedLogin } from '../../shared/passwords';
import type { Store } from '../storage/database';

/**
 * The system's protected storage (Electron's safeStorage: DPAPI on
 * Windows, the Keychain on macOS, the secret service on Linux). A stand-in
 * is used in unit tests.
 */
export interface Keychain {
  /** Why it cannot be used, or null when it can. */
  problem(): string | null;
  encrypt(text: string): Uint8Array;
  decrypt(bytes: Uint8Array): string;
}

export const NO_DATABASE = "Passwords can't be saved: your saved data couldn't be opened.";

/**
 * Saved sign-ins, encrypted with the keychain and kept in the database.
 * The plain password exists only in memory, for as long as a request
 * needs it. No Electron imports, so it can be unit tested.
 */
export class PasswordVault {
  constructor(
    private readonly store: () => Store | null,
    private readonly keychain: Keychain,
  ) {}

  /** Why passwords cannot be saved or read now, or null. */
  problem(): string | null {
    if (!this.store()) return NO_DATABASE;
    return this.keychain.problem();
  }

  /**
   * What a sign-in with these details should offer: to save a new
   * account, to update a saved one, or nothing (the same password is
   * saved already, or the site is on the "never" list).
   */
  consider(origin: string, username: string, password: string): 'new' | 'update' | null {
    const store = this.store();
    if (!store) return 'new'; // the offer then explains the problem
    if (store.isNever(origin)) return null;
    const saved = store.login(origin, username);
    if (!saved) return 'new';
    if (this.keychain.problem()) return null;
    try {
      return this.keychain.decrypt(saved.secret) === password ? null : 'update';
    } catch {
      return 'update';
    }
  }

  save(origin: string, username: string, password: string): void {
    const store = this.need();
    store.saveLogin(origin, username, this.keychain.encrypt(password));
    store.removeNever(origin);
  }

  never(origin: string): void {
    this.need().addNever(origin);
  }

  /** User names saved for a site (never the passwords). */
  accounts(origin: string): string[] {
    const store = this.store();
    if (!store || this.keychain.problem()) return [];
    return store.loginsFor(origin).map((l) => l.username);
  }

  /** The saved password for a site's account, or null; marks it used. */
  password(origin: string, username: string): string | null {
    const store = this.store();
    if (!store || this.keychain.problem()) return null;
    const saved = store.login(origin, username);
    if (!saved) return null;
    const text = this.keychain.decrypt(saved.secret);
    store.markLoginUsed(saved.id);
    return text;
  }

  list(): SavedLogin[] {
    const store = this.store();
    if (!store) return [];
    return store.listLogins().map((l) => ({ id: l.id, origin: l.origin, username: l.username, createdAt: l.createdAt, usedAt: l.usedAt }));
  }

  /** A saved sign-in's password, by id (the Library's Show and Copy). */
  reveal(id: number): string {
    const saved = this.need().loginById(id);
    if (!saved) throw new Error('That saved sign-in is gone');
    return this.keychain.decrypt(saved.secret);
  }

  /** Deleting needs no keychain: a sign-in can go even when it cannot be read. */
  delete(id: number): void {
    const store = this.store();
    if (!store) throw new Error(NO_DATABASE);
    store.deleteLogin(id);
  }

  neverList(): string[] {
    return this.store()?.neverList() ?? [];
  }

  removeNever(origin: string): void {
    this.store()?.removeNever(origin);
  }

  private need(): Store {
    const problem = this.problem();
    if (problem) throw new Error(problem);
    return this.store()!;
  }
}
