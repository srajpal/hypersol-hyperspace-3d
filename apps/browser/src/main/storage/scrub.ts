import { DatabaseSync } from 'node:sqlite';

/**
 * What every connection to hypersol.sqlite is opened with. The write-ahead
 * log lets the history worker and the main process each have a connection
 * (a writer waits for the other rather than failing). secure_delete makes
 * SQLite overwrite what is deleted with zeros, where it otherwise only
 * marks the space as free and leaves the text in the file (review of
 * 2026-09-30, D6); it is a setting of the connection, not of the file, so
 * each connection asks for it.
 */
export const CONNECTION_SETTINGS = 'PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA secure_delete = ON;';

/** Opens one more connection to the database the main process has already brought up to date (the history worker's). */
export function connect(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(CONNECTION_SETTINGS);
  return db;
}

/**
 * After a deletion the person asked for ("Clear all history", removing a
 * visit, deleting a saved sign-in): everything in the write-ahead log is
 * written into the database file and the log is emptied, so the deleted
 * text is not left in the log's earlier pages either. Never throws: if the
 * other connection is busy past the wait, the next one does it.
 */
export function scrubDeleted(db: DatabaseSync): void {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch {
    // The deletion itself is done; the log is emptied at the next checkpoint.
  }
}
