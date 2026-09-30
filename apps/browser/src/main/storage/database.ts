import { DatabaseSync } from 'node:sqlite';
import type { Bookmark, HistoryEntry } from '../../shared/data';
import type { SavedLogin } from '../../shared/passwords';
import { HISTORY_INDEX_MIGRATION, HISTORY_SITES_MIGRATION, HistoryStore } from './history';
import { CONNECTION_SETTINGS, scrubDeleted } from './scrub';

/** Current schema; raise it and add a step to MIGRATIONS for any change. */
export const SCHEMA_VERSION = 4;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE bookmarks (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      favicon TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE history (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      visited_at INTEGER NOT NULL
    );
    CREATE INDEX history_by_time ON history (visited_at DESC);
    CREATE INDEX history_by_url ON history (url);
  `,
  // Milestone 9: saved sign-ins. The password is stored only encrypted
  // with the system's keychain (main/passwords/vault.ts); "never" lists
  // the sites where you asked never to save.
  2: `
    CREATE TABLE logins (
      id INTEGER PRIMARY KEY,
      origin TEXT NOT NULL,
      username TEXT NOT NULL,
      secret BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      used_at INTEGER,
      UNIQUE (origin, username)
    );
    CREATE TABLE login_never (
      origin TEXT PRIMARY KEY
    );
  `,
  // Milestone 10 (GitHub issue #4): a full-text index for history search
  // and a table of each address's latest visit (main/storage/history.ts).
  3: HISTORY_INDEX_MIGRATION,
  // Milestone 11: visit counts and address keys, for the address bar's completions.
  4: HISTORY_SITES_MIGRATION,
};

interface BookmarkRow {
  id: number;
  url: string;
  title: string;
  favicon: string | null;
  created_at: number;
}

interface LoginRow {
  id: number;
  origin: string;
  username: string;
  secret: Uint8Array;
  created_at: number;
  used_at: number | null;
}

/** A saved sign-in with its encrypted password. */
export interface LoginRecord extends SavedLogin {
  secret: Uint8Array;
}

const toLogin = (r: LoginRow): LoginRecord => ({
  id: r.id,
  origin: r.origin,
  username: r.username,
  secret: r.secret,
  createdAt: r.created_at,
  usedAt: r.used_at,
});

const toBookmark = (r: BookmarkRow): Bookmark => ({
  id: r.id,
  url: r.url,
  title: r.title,
  favicon: r.favicon,
  createdAt: r.created_at,
});

/** Bookmarks, history, and saved sign-ins in one SQLite file (hypersol.sqlite). */
export class Store {
  private readonly db: DatabaseSync;
  /** History on this connection (the app's own history goes through the worker, history-worker.ts). */
  readonly history: HistoryStore;

  /** Opens (or creates) the database at path; ':memory:' for tests. Throws if it cannot. */
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    // The history worker has its own connection, opened the same way (storage/scrub.ts).
    this.db.exec(`${CONNECTION_SETTINGS} PRAGMA foreign_keys = ON;`);
    this.migrate();
    this.history = new HistoryStore(this.db);
  }

  get schemaVersion(): number {
    return (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  }

  private migrate(): void {
    let version = this.schemaVersion;
    if (version > SCHEMA_VERSION) {
      throw new Error(`Saved data is from a newer version (schema ${version}); this version reads up to ${SCHEMA_VERSION}.`);
    }
    while (version < SCHEMA_VERSION) {
      version += 1;
      this.db.exec('BEGIN');
      try {
        this.db.exec(MIGRATIONS[version]!);
        this.db.exec(`PRAGMA user_version = ${version}`);
        this.db.exec('COMMIT');
      } catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
      }
    }
  }

  // ---- Bookmarks ----------------------------------------------------------

  listBookmarks(): Bookmark[] {
    return (this.db.prepare('SELECT * FROM bookmarks ORDER BY created_at DESC, id DESC').all() as unknown as BookmarkRow[]).map(
      toBookmark,
    );
  }

  hasBookmark(url: string): boolean {
    return this.db.prepare('SELECT 1 FROM bookmarks WHERE url = ?').get(url) !== undefined;
  }

  /** Adds a bookmark, or updates its title and favicon if the address is already saved. */
  addBookmark(url: string, title: string, favicon: string | null, now = Date.now()): Bookmark {
    this.db
      .prepare(
        `INSERT INTO bookmarks (url, title, favicon, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (url) DO UPDATE SET title = excluded.title, favicon = COALESCE(excluded.favicon, favicon)`,
      )
      .run(url, title, favicon, now);
    return toBookmark(this.db.prepare('SELECT * FROM bookmarks WHERE url = ?').get(url) as unknown as BookmarkRow);
  }

  removeBookmark(url: string): void {
    this.db.prepare('DELETE FROM bookmarks WHERE url = ?').run(url);
  }

  // ---- History (main/storage/history.ts) ----------------------------------

  recordVisit(url: string, title: string, now = Date.now()): number {
    return this.history.record(url, title, now);
  }

  updateVisitTitle(id: number, title: string): void {
    this.history.updateTitle(id, title);
  }

  searchHistory(query: string, limit: number): HistoryEntry[] {
    return this.history.search(query, limit);
  }

  recentHistory(limit: number): HistoryEntry[] {
    return this.history.recent(limit);
  }

  deleteVisit(id: number): void {
    this.history.delete(id);
  }

  clearHistory(): void {
    this.history.clear();
  }

  // ---- Saved sign-ins (milestone 9) ---------------------------------------

  /** Every saved sign-in, by site then user name. */
  listLogins(): LoginRecord[] {
    return (this.db.prepare('SELECT * FROM logins ORDER BY origin, username').all() as unknown as LoginRow[]).map(toLogin);
  }

  loginsFor(origin: string): LoginRecord[] {
    return (this.db.prepare('SELECT * FROM logins WHERE origin = ? ORDER BY used_at DESC, username').all(origin) as unknown as LoginRow[]).map(
      toLogin,
    );
  }

  login(origin: string, username: string): LoginRecord | null {
    const row = this.db.prepare('SELECT * FROM logins WHERE origin = ? AND username = ?').get(origin, username);
    return row ? toLogin(row as unknown as LoginRow) : null;
  }

  loginById(id: number): LoginRecord | null {
    const row = this.db.prepare('SELECT * FROM logins WHERE id = ?').get(id);
    return row ? toLogin(row as unknown as LoginRow) : null;
  }

  /** Saves a sign-in, or replaces the password of the same site and user name. */
  saveLogin(origin: string, username: string, secret: Uint8Array, now = Date.now()): void {
    this.db
      .prepare(
        `INSERT INTO logins (origin, username, secret, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (origin, username) DO UPDATE SET secret = excluded.secret`,
      )
      .run(origin, username, secret, now);
  }

  markLoginUsed(id: number, now = Date.now()): void {
    this.db.prepare('UPDATE logins SET used_at = ? WHERE id = ?').run(now, id);
  }

  deleteLogin(id: number): void {
    this.db.prepare('DELETE FROM logins WHERE id = ?').run(id);
    scrubDeleted(this.db);
  }

  clearLogins(): void {
    this.db.exec('DELETE FROM logins; DELETE FROM login_never;');
    scrubDeleted(this.db);
  }

  neverList(): string[] {
    return (this.db.prepare('SELECT origin FROM login_never ORDER BY origin').all() as unknown as { origin: string }[]).map((r) => r.origin);
  }

  isNever(origin: string): boolean {
    return this.db.prepare('SELECT 1 FROM login_never WHERE origin = ?').get(origin) !== undefined;
  }

  addNever(origin: string): void {
    this.db.prepare('INSERT OR IGNORE INTO login_never (origin) VALUES (?)').run(origin);
  }

  removeNever(origin: string): void {
    this.db.prepare('DELETE FROM login_never WHERE origin = ?').run(origin);
    scrubDeleted(this.db);
  }

  close(): void {
    this.db.close();
  }
}
