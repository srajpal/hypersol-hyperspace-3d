import type { DatabaseSync } from 'node:sqlite';
import type { HistoryEntry } from '../../shared/data';

/**
 * History queries on one connection to hypersol.sqlite (milestone 10,
 * GitHub issue #4). The app runs these in a worker thread
 * (history-worker.ts) so a large history never holds up the main
 * process; the unit tests run them directly.
 *
 * Search uses a full-text index (FTS5 with the trigram tokenizer, which
 * matches any part of a word, like the plain search did); text shorter
 * than three letters falls back to the plain search. "Recent" reads a
 * table of each address's latest visit, kept by triggers. Both come with
 * schema 3 (database.ts).
 */

interface HistoryRow {
  id: number;
  url: string;
  title: string;
  visited_at: number;
}

const toEntry = (r: HistoryRow): HistoryEntry => ({ id: r.id, url: r.url, title: r.title, visitedAt: r.visited_at });

/** Escapes LIKE wildcards so a search for "50%" finds "50%". */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** The text as one FTS5 phrase: any run of its characters matches, quotes doubled. */
function ftsPhrase(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

/** The trigram tokenizer needs three characters to use the index. */
const MIN_INDEXED = 3;

export class HistoryStore {
  constructor(private readonly db: DatabaseSync) {}

  /** Records one visit; returns its id. */
  record(url: string, title: string, now = Date.now()): number {
    const result = this.db.prepare('INSERT INTO history (url, title, visited_at) VALUES (?, ?, ?)').run(url, title, now);
    return Number(result.lastInsertRowid);
  }

  updateTitle(id: number, title: string): void {
    this.db.prepare('UPDATE history SET title = ? WHERE id = ?').run(title, id);
  }

  /** Visits whose address or title contains the text, newest first. */
  search(query: string, limit: number): HistoryEntry[] {
    const text = query.trim();
    let rows: unknown[];
    if (text === '') {
      rows = this.db.prepare('SELECT * FROM history ORDER BY visited_at DESC, id DESC LIMIT ?').all(limit);
    } else if ([...text].length >= MIN_INDEXED) {
      rows = this.db
        .prepare(
          `SELECT h.* FROM history_fts f JOIN history h ON h.id = f.rowid
           WHERE history_fts MATCH ? ORDER BY h.visited_at DESC, h.id DESC LIMIT ?`,
        )
        .all(ftsPhrase(text), limit);
    } else {
      rows = this.db
        .prepare(
          `SELECT * FROM history WHERE url LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\'
           ORDER BY visited_at DESC, id DESC LIMIT ?`,
        )
        .all(likePattern(text), likePattern(text), limit);
    }
    return (rows as HistoryRow[]).map(toEntry);
  }

  /** The most recent visit to each address, newest first. */
  recent(limit: number): HistoryEntry[] {
    const rows = this.db
      .prepare(
        `SELECT h.* FROM history_latest l JOIN history h ON h.id = l.visit_id
         ORDER BY l.visited_at DESC, l.visit_id DESC LIMIT ?`,
      )
      .all(limit);
    return (rows as unknown as HistoryRow[]).map(toEntry);
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM history WHERE id = ?').run(id);
  }

  clear(): void {
    this.db.exec('BEGIN');
    try {
      // Emptied directly: row-by-row triggers would be slow for a long history.
      this.db.exec(`DELETE FROM history_latest; DELETE FROM history; INSERT INTO history_fts (history_fts) VALUES ('delete-all');`);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
}

/**
 * Schema 3 (milestone 10): the full-text index and the latest-visit
 * table, filled from the history already saved, and the triggers that
 * keep both current.
 */
export const HISTORY_INDEX_MIGRATION = `
  CREATE VIRTUAL TABLE history_fts USING fts5(url, title, content = 'history', content_rowid = 'id', tokenize = 'trigram');
  INSERT INTO history_fts (history_fts) VALUES ('rebuild');
  CREATE TABLE history_latest (
    url TEXT PRIMARY KEY,
    visit_id INTEGER NOT NULL,
    visited_at INTEGER NOT NULL
  );
  CREATE INDEX history_latest_by_time ON history_latest (visited_at DESC, visit_id DESC);
  INSERT INTO history_latest (url, visit_id, visited_at)
    SELECT h.url, h.id, h.visited_at FROM history h
    JOIN (SELECT url, MAX(id) AS id FROM history GROUP BY url) m ON m.id = h.id;
  CREATE TRIGGER history_added AFTER INSERT ON history BEGIN
    INSERT INTO history_fts (rowid, url, title) VALUES (new.id, new.url, new.title);
    INSERT INTO history_latest (url, visit_id, visited_at) VALUES (new.url, new.id, new.visited_at)
      ON CONFLICT (url) DO UPDATE SET visit_id = excluded.visit_id, visited_at = excluded.visited_at
      WHERE excluded.visit_id > history_latest.visit_id;
  END;
  CREATE TRIGGER history_removed AFTER DELETE ON history BEGIN
    INSERT INTO history_fts (history_fts, rowid, url, title) VALUES ('delete', old.id, old.url, old.title);
    DELETE FROM history_latest WHERE url = old.url AND visit_id = old.id;
    INSERT INTO history_latest (url, visit_id, visited_at)
      SELECT url, id, visited_at FROM history WHERE url = old.url ORDER BY id DESC LIMIT 1
      ON CONFLICT (url) DO NOTHING;
  END;
  CREATE TRIGGER history_retitled AFTER UPDATE OF title ON history BEGIN
    INSERT INTO history_fts (history_fts, rowid, url, title) VALUES ('delete', old.id, old.url, old.title);
    INSERT INTO history_fts (rowid, url, title) VALUES (new.id, new.url, new.title);
  END;
`;
