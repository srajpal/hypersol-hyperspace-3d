import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePagePasswordRequest } from '../../shared/page-passwords';
import { parsePasswordRequest } from '../../shared/passwords';
import { SCHEMA_VERSION, Store } from '../storage/database';
import { StorageService } from '../storage/service';
import { NO_DATABASE, PasswordVault, type Keychain } from './vault';

/** A stand-in keychain: reversible, but never the plain text. */
function fakeKeychain(problem: string | null = null): Keychain & { calls: number } {
  const k = {
    calls: 0,
    problem: () => problem,
    encrypt: (text: string) => {
      k.calls += 1;
      return new Uint8Array(Buffer.from(`enc:${Buffer.from(text).toString('base64')}`));
    },
    decrypt: (bytes: Uint8Array) => {
      const s = Buffer.from(bytes).toString();
      if (!s.startsWith('enc:')) throw new Error('not ours');
      return Buffer.from(s.slice(4), 'base64').toString();
    },
  };
  return k;
}

const folders: string[] = [];
afterEach(() => {
  for (const f of folders.splice(0)) rmSync(f, { recursive: true, force: true });
});

describe('password vault (milestone 9)', () => {
  it('saves encrypted, offers save, update, or nothing, and fills only the same site', () => {
    const store = new Store(':memory:');
    const vault = new PasswordVault(() => store, fakeKeychain());
    const site = 'https://shop.example';
    expect(vault.consider(site, 'ada', 's3cret!')).toBe('new');
    vault.save(site, 'ada', 's3cret!');
    // Stored only encrypted.
    const raw = store.login(site, 'ada')!;
    expect(Buffer.from(raw.secret).toString()).not.toContain('s3cret!');
    expect(vault.consider(site, 'ada', 's3cret!')).toBeNull();
    expect(vault.consider(site, 'ada', 'changed')).toBe('update');
    expect(vault.consider(site, 'grace', 'x')).toBe('new');
    expect(vault.accounts(site)).toEqual(['ada']);
    // Another origin (other port, other scheme) knows nothing of it.
    expect(vault.accounts('https://shop.example:8443')).toEqual([]);
    expect(vault.accounts('http://shop.example')).toEqual([]);
    expect(vault.password('http://shop.example', 'ada')).toBeNull();
    expect(vault.password(site, 'ada')).toBe('s3cret!');
    expect(vault.list()[0]).toMatchObject({ origin: site, username: 'ada' });
    expect(vault.list()[0]!.usedAt).not.toBeNull();
    expect(Object.keys(vault.list()[0]!)).not.toContain('secret');
    vault.save(site, 'ada', 'changed');
    expect(vault.reveal(vault.list()[0]!.id)).toBe('changed');
    expect(vault.list()).toHaveLength(1);
  });

  it('keeps a "never" list, which saving again clears', () => {
    const store = new Store(':memory:');
    const vault = new PasswordVault(() => store, fakeKeychain());
    vault.never('http://router.local');
    expect(vault.consider('http://router.local', 'admin', 'pw')).toBeNull();
    expect(vault.neverList()).toEqual(['http://router.local']);
    vault.removeNever('http://router.local');
    expect(vault.consider('http://router.local', 'admin', 'pw')).toBe('new');
    vault.never('http://router.local');
    vault.save('http://router.local', 'admin', 'pw');
    expect(vault.neverList()).toEqual([]);
  });

  it('deletes', () => {
    const store = new Store(':memory:');
    const vault = new PasswordVault(() => store, fakeKeychain());
    vault.save('https://a.example', 'u', 'p');
    vault.delete(vault.list()[0]!.id);
    expect(vault.list()).toEqual([]);
    expect(() => vault.reveal(1)).toThrow(/gone/);
  });

  it('without the keychain: nothing saved or filled, and it says why (K5)', () => {
    const store = new Store(':memory:');
    const keychain = fakeKeychain("Passwords can't be saved: this computer's keychain isn't available.");
    const vault = new PasswordVault(() => store, keychain);
    expect(vault.problem()).toMatch(/keychain/);
    expect(vault.consider('https://a.example', 'u', 'p')).toBe('new'); // the offer then explains
    expect(() => vault.save('https://a.example', 'u', 'p')).toThrow(/keychain/);
    expect(keychain.calls).toBe(0);
    expect(store.listLogins()).toEqual([]);
    expect(vault.accounts('https://a.example')).toEqual([]);
    expect(vault.password('https://a.example', 'u')).toBeNull();
  });

  it('without the database: says why', () => {
    const vault = new PasswordVault(() => null, fakeKeychain());
    expect(vault.problem()).toBe(NO_DATABASE);
    expect(vault.list()).toEqual([]);
    expect(() => vault.save('https://a.example', 'u', 'p')).toThrow(NO_DATABASE);
  });

  it('upgrades a milestone 3 database without losing bookmarks or history', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hypersol-vault-'));
    folders.push(dir);
    const path = join(dir, 'hypersol.sqlite');
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE bookmarks (id INTEGER PRIMARY KEY, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL, favicon TEXT, created_at INTEGER NOT NULL);
      CREATE TABLE history (id INTEGER PRIMARY KEY, url TEXT NOT NULL, title TEXT NOT NULL, visited_at INTEGER NOT NULL);
      INSERT INTO bookmarks (url, title, created_at) VALUES ('https://kept.example/', 'Kept', 1);
      INSERT INTO history (url, title, visited_at) VALUES ('https://kept.example/', 'Kept', 2);
      PRAGMA user_version = 1;`);
    old.close();
    const store = new Store(path);
    expect(store.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(2);
    expect(store.listBookmarks().map((b) => b.url)).toEqual(['https://kept.example/']);
    expect(store.searchHistory('', 10)).toHaveLength(1);
    expect(store.listLogins()).toEqual([]);
    store.close();
  });

  it('Clear data removes saved passwords only when ticked', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hypersol-vault-'));
    folders.push(dir);
    const service = new StorageService(dir, { clearCookiesAndSiteData: async () => undefined, clearCache: async () => undefined });
    const vault = new PasswordVault(() => service.database, fakeKeychain());
    vault.save('https://a.example', 'u', 'p');
    await service.handle({ op: 'data.clear', history: true, cookies: false, cache: false });
    expect(vault.list()).toHaveLength(1);
    const changes: string[] = [];
    service.onChange((w) => changes.push(w));
    expect(await service.handle({ op: 'data.clear', history: false, cookies: false, cache: false, passwords: true })).toEqual({ ok: true, value: null });
    expect(vault.list()).toHaveLength(0);
    expect(changes).toContain('passwords');
    expect(await service.handle({ op: 'data.clear', history: false, cookies: false, cache: false, passwords: 'yes' })).toHaveProperty('ok', false);
    service.close();
  });
});

describe('password requests', () => {
  it('from a page are checked', () => {
    expect(parsePagePasswordRequest({ op: 'submitted', username: 'a', password: 'b' })).toHaveProperty('request');
    expect(parsePagePasswordRequest({ op: 'submitted', username: 'a', password: '' })).toHaveProperty('error');
    expect(parsePagePasswordRequest({ op: 'submitted', username: 'a'.repeat(513), password: 'b' })).toHaveProperty('error');
    expect(parsePagePasswordRequest({ op: 'submitted', username: 'a', password: 'b'.repeat(1025) })).toHaveProperty('error');
    expect(parsePagePasswordRequest({ op: 'accounts', origin: 'https://evil.example' })).toEqual({ request: { op: 'accounts' } });
    expect(parsePagePasswordRequest({ op: 'fill', username: 'a' })).toHaveProperty('request');
    expect(parsePagePasswordRequest({ op: 'list' })).toHaveProperty('error');
  });

  it('from the shell are checked', () => {
    expect(parsePasswordRequest({ op: 'list' })).toEqual({ request: { op: 'list' } });
    expect(parsePasswordRequest({ op: 'reveal', id: 2 })).toHaveProperty('request');
    expect(parsePasswordRequest({ op: 'reveal', id: -1 })).toHaveProperty('error');
    expect(parsePasswordRequest({ op: 'answer', offer: 1, answer: 'save' })).toHaveProperty('request');
    expect(parsePasswordRequest({ op: 'answer', offer: 1, answer: 'maybe' })).toHaveProperty('error');
    expect(parsePasswordRequest({ op: 'never.remove', origin: 5 })).toHaveProperty('error');
    expect(parsePasswordRequest({ op: 'export' })).toHaveProperty('error');
  });
});
