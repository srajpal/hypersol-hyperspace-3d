import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Store } from './database';
import { HistoryStore } from './history';
import { connect } from './scrub';

// Text that appears nowhere but in what these tests save.
const MARK = 'zq7-private-marker';
// The same, whose every three letters in a row appear nowhere else either (not in a table's or a column's name).
const PIECED = 'zq7xq9wq3kq5vq';

const folders: string[] = [];
const stores: { close(): void }[] = [];

afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const dir of folders.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function open(): { store: Store; path: string } {
  const dir = mkdtempSync(join(tmpdir(), 'hypersol-unit-scrub-'));
  folders.push(dir);
  const path = join(dir, 'hypersol.sqlite');
  const store = new Store(path);
  stores.push(store);
  return { store, path };
}

/** Whether the text is anywhere in the database file or its write-ahead log, as bytes on disk. */
function onDisk(path: string, text: string): boolean {
  const files = [path, `${path}-wal`].filter((f) => existsSync(f)).map((f) => readFileSync(f));
  return Buffer.concat(files).includes(text);
}

/**
 * Whether any three letters of the text, in a row, are on disk: the
 * search index keeps text as such pieces (a trigram index), so a marker
 * can be gone as a whole while its pieces remain.
 */
function piecesOnDisk(path: string, text: string): string[] {
  const pieces = new Set<string>();
  for (let i = 0; i + 3 <= text.length; i++) pieces.add(text.slice(i, i + 3));
  return [...pieces].filter((p) => onDisk(path, p));
}

describe('deleted means gone from the file (review of 2026-09-30, D6)', () => {
  it('"Clear all history" leaves none of its addresses or titles in the file or its log', () => {
    const { store, path } = open();
    for (let i = 0; i < 300; i++) store.recordVisit(`https://${MARK}.example/page/${i}`, `A title with ${MARK} in it, number ${i}`);
    expect(onDisk(path, MARK)).toBe(true);
    store.clearHistory();
    expect(store.recentHistory(10)).toEqual([]);
    expect(onDisk(path, MARK)).toBe(false);
  });

  it('also when the clearing is done on the history worker\'s connection, while the main one stays open', () => {
    const { store, path } = open();
    const db = connect(path);
    stores.push(db);
    const worker = new HistoryStore(db);
    for (let i = 0; i < 300; i++) worker.record(`https://${MARK}.example/page/${i}`, `A title with ${MARK} in it, number ${i}`);
    expect(store.recentHistory(1)).toHaveLength(1); // the main connection has read it
    expect(onDisk(path, MARK)).toBe(true);
    worker.clear();
    expect(onDisk(path, MARK)).toBe(false);
    expect(store.recentHistory(1)).toEqual([]);
  });

  it('removing one visit, or every visit to an address, takes its text out too', () => {
    const { store, path } = open();
    const id = store.recordVisit(`https://one.example/${MARK}-${PIECED}`, `One visit ${MARK} ${PIECED}`);
    store.recordVisit('https://kept.example/', 'Kept');
    expect(piecesOnDisk(path, PIECED)).not.toEqual([]);
    store.deleteVisit(id);
    expect(onDisk(path, MARK)).toBe(false);
    // The search index too: it keeps three-letter pieces, which it must also remove at once.
    expect(piecesOnDisk(path, PIECED)).toEqual([]);
    store.recordVisit(`https://two.example/${MARK}-${PIECED}`, `Twice ${MARK}`);
    store.recordVisit(`https://two.example/${MARK}-${PIECED}`, `Twice ${MARK}`);
    expect(onDisk(path, MARK)).toBe(true);
    store.history.forgetUrl(`https://two.example/${MARK}-${PIECED}`);
    expect(onDisk(path, MARK)).toBe(false);
    expect(piecesOnDisk(path, PIECED)).toEqual([]);
    expect(store.recentHistory(10).map((h) => h.url)).toEqual(['https://kept.example/']);
  });

  it('a deleted sign-in, and cleared sign-ins, leave no site, user name, or secret behind', () => {
    const { store, path } = open();
    const secret = new TextEncoder().encode(`stands in for an encrypted password ${MARK}`);
    store.saveLogin(`https://${MARK}.example`, `user-${MARK}`, secret);
    store.saveLogin('https://kept.example', 'someone', new Uint8Array([1, 2, 3]));
    expect(onDisk(path, MARK)).toBe(true);
    store.deleteLogin(store.login(`https://${MARK}.example`, `user-${MARK}`)!.id);
    expect(onDisk(path, MARK)).toBe(false);
    expect(store.listLogins().map((l) => l.origin)).toEqual(['https://kept.example']);

    store.saveLogin(`https://${MARK}.example`, `user-${MARK}`, secret);
    store.addNever(`https://never-${MARK}.example`);
    expect(onDisk(path, MARK)).toBe(true);
    store.clearLogins();
    expect(onDisk(path, MARK)).toBe(false);
    expect(store.listLogins()).toEqual([]);
  });
});
