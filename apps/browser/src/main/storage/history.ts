import type { DatabaseSync } from 'node:sqlite';
import type { HistoryEntry, Suggestion, Suggestions } from '../../shared/data';

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

/** An address as the address bar matches it: without the scheme or "www.", in lower case. */
export function siteKey(url: string): string {
  return url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
}

/** How much a site counts: its visits, weighted by how recent the last one was. */
export function frecency(visits: number, lastVisit: number, now: number): number {
  const days = (now - lastVisit) / 86_400_000;
  const weight = days < 4 ? 1 : days < 14 ? 0.7 : days < 31 ? 0.5 : days < 90 ? 0.3 : 0.1;
  return visits * weight;
}

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

  /** Forgets every visit to an address (removing it from the address bar's suggestions). */
  forgetUrl(url: string): void {
    this.db.prepare('DELETE FROM history WHERE url = ?').run(url);
  }

  /**
   * What the address bar offers for typed text (milestone 11): the
   * address to complete it to, if any, and the best matches, ranked by
   * how often and how recently they were visited. Sites whose address
   * starts with the text come first; then pages whose address or title
   * contains it.
   */
  suggest(text: string, limit: number, now = Date.now()): Suggestions {
    const typed = siteKey(text.trim());
    if (typed === '') return { inline: null, items: [] };
    const rows = this.db
      .prepare(
        `SELECT l.url, l.key, l.visits, l.visited_at, h.title FROM history_latest l JOIN history h ON h.id = l.visit_id
         WHERE l.key >= ? AND l.key < ? ORDER BY l.visits DESC, l.visited_at DESC LIMIT 300`,
      )
      .all(typed, `${typed}\uffff`) as unknown as { url: string; key: string; visits: number; visited_at: number; title: string }[];
    const scored = rows.map((r) => ({ ...r, score: frecency(r.visits, r.visited_at, now) }));
    // Completing to a whole site: its root, scored by all its pages together.
    const sites = new Map<string, { key: string; url: string; score: number; best: number }>();
    for (const r of scored) {
      const host = r.key.split('/')[0]!;
      const root = `${host}/`;
      const site = sites.get(root) ?? { key: root, url: `${new URL(r.url).origin}/`, score: 0, best: -1 };
      site.score += r.score;
      if (r.key === root || r.score > site.best) {
        site.url = r.key === root ? r.url : site.url;
        site.best = Math.max(site.best, r.score);
      }
      sites.set(root, site);
    }
    let inline: Suggestions['inline'] = null;
    if (!typed.includes('/')) {
      const site = [...sites.values()].filter((x) => x.key.startsWith(typed)).sort((a, b) => b.score - a.score)[0];
      if (site) inline = { key: site.key, url: site.url };
    } else {
      const page = scored.sort((a, b) => b.score - a.score)[0];
      if (page) inline = { key: page.key, url: page.url };
    }
    // The site it completes to leads the list, then the rest by score.
    const items: Suggestion[] = [...scored]
      .sort((a, b) => b.score - a.score)
      .map((r) => ({ url: r.url, title: r.title, kind: 'history' as const }));
    if (inline) {
      const lead = items.findIndex((i) => i.url === inline!.url);
      const [first] = lead >= 0 ? items.splice(lead, 1) : [{ url: inline.url, title: inline.key, kind: 'history' as const }];
      items.unshift(first!);
    }
    if (items.length < limit) {
      for (const h of this.search(text, limit * 3)) {
        if (!items.some((i) => i.url === h.url)) items.push({ url: h.url, title: h.title, kind: 'history' });
        if (items.length >= limit * 2) break;
      }
    }
    return { inline, items: items.slice(0, limit) };
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

/**
 * Schema 4 (milestone 11): what the address bar completes from. Each
 * address's latest-visit row also counts its visits and keeps a key: the
 * address without "https://", "http://", or "www.", in lower case, which
 * an index serves for "starts with" matches.
 */
export const HISTORY_SITES_MIGRATION = `
  ALTER TABLE history_latest ADD COLUMN visits INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE history_latest ADD COLUMN key TEXT NOT NULL DEFAULT '';
  UPDATE history_latest SET
    visits = (SELECT COUNT(*) FROM history h WHERE h.url = history_latest.url),
    key = lower(CASE
      WHEN url LIKE 'https://www.%' THEN substr(url, 13)
      WHEN url LIKE 'http://www.%' THEN substr(url, 12)
      WHEN url LIKE 'https://%' THEN substr(url, 9)
      WHEN url LIKE 'http://%' THEN substr(url, 8)
      ELSE url END);
  CREATE INDEX history_latest_by_key ON history_latest (key);
  DROP TRIGGER history_added;
  DROP TRIGGER history_removed;
  CREATE TRIGGER history_added AFTER INSERT ON history BEGIN
    INSERT INTO history_fts (rowid, url, title) VALUES (new.id, new.url, new.title);
    INSERT INTO history_latest (url, visit_id, visited_at, visits, key)
      VALUES (new.url, new.id, new.visited_at, 1, lower(CASE
      WHEN new.url LIKE 'https://www.%' THEN substr(new.url, 13)
      WHEN new.url LIKE 'http://www.%' THEN substr(new.url, 12)
      WHEN new.url LIKE 'https://%' THEN substr(new.url, 9)
      WHEN new.url LIKE 'http://%' THEN substr(new.url, 8)
      ELSE new.url END))
      ON CONFLICT (url) DO UPDATE SET
        visits = history_latest.visits + 1,
        visited_at = CASE WHEN excluded.visit_id > history_latest.visit_id THEN excluded.visited_at ELSE history_latest.visited_at END,
        visit_id = MAX(history_latest.visit_id, excluded.visit_id);
  END;
  CREATE TRIGGER history_removed AFTER DELETE ON history BEGIN
    INSERT INTO history_fts (history_fts, rowid, url, title) VALUES ('delete', old.id, old.url, old.title);
    UPDATE history_latest SET visits = visits - 1 WHERE url = old.url;
    DELETE FROM history_latest WHERE url = old.url AND visits <= 0;
    UPDATE history_latest SET
      visit_id = (SELECT id FROM history WHERE url = old.url ORDER BY id DESC LIMIT 1),
      visited_at = (SELECT visited_at FROM history WHERE url = old.url ORDER BY id DESC LIMIT 1)
      WHERE url = old.url AND visit_id = old.id;
  END;
`;
