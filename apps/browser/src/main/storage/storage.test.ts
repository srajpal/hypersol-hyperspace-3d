import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseDataRequest } from '../../shared/data';
import { DEFAULT_SETTINGS, applySettingsPatch, parseSettings, searchUrlFor } from '../../shared/settings';
import { SCHEMA_VERSION, Store } from './database';
import { StorageService } from './service';
import { parseSession, SettingsFile, type SettingsFileSystem } from './settings-file';

describe('Store', () => {
  let store: Store;
  beforeEach(() => {
    store = new Store(':memory:');
  });
  afterEach(() => store.close());

  it('creates the current schema', () => {
    expect(store.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('adds, lists, updates, and removes bookmarks', () => {
    store.addBookmark('https://a.example/', 'A', null, 1000);
    store.addBookmark('https://b.example/', 'B', 'data:image/png;base64,xx', 2000);
    expect(store.listBookmarks().map((b) => b.title)).toEqual(['B', 'A']);
    expect(store.hasBookmark('https://a.example/')).toBe(true);
    const again = store.addBookmark('https://a.example/', 'A renamed', null, 3000);
    expect(again.title).toBe('A renamed');
    expect(store.listBookmarks()).toHaveLength(2);
    store.removeBookmark('https://a.example/');
    expect(store.hasBookmark('https://a.example/')).toBe(false);
  });

  it('records visits, searches them, and keeps the latest per address', () => {
    store.recordVisit('https://a.example/one', 'First page', 1000);
    const id = store.recordVisit('https://b.example/', 'b.example', 2000);
    store.updateVisitTitle(id, 'Second page');
    store.recordVisit('https://a.example/one', 'First page', 3000);
    expect(store.searchHistory('', 10).map((h) => h.visitedAt)).toEqual([3000, 2000, 1000]);
    expect(store.searchHistory('second', 10).map((h) => h.title)).toEqual(['Second page']);
    expect(store.searchHistory('a.example', 10)).toHaveLength(2);
    expect(store.recentHistory(10).map((h) => h.url)).toEqual(['https://a.example/one', 'https://b.example/']);
  });

  it('treats % and _ in a search as plain characters', () => {
    store.recordVisit('https://a.example/', '50% off', 1000);
    store.recordVisit('https://b.example/', '500 things', 2000);
    expect(store.searchHistory('50%', 10).map((h) => h.title)).toEqual(['50% off']);
  });

  it('deletes one visit or all of them', () => {
    const id = store.recordVisit('https://a.example/', 'A', 1000);
    store.recordVisit('https://b.example/', 'B', 2000);
    store.deleteVisit(id);
    expect(store.searchHistory('', 10).map((h) => h.title)).toEqual(['B']);
    store.clearHistory();
    expect(store.searchHistory('', 10)).toEqual([]);
  });
});

describe('settings', () => {
  it('parses a good file and ignores unknown keys', () => {
    expect(parseSettings('{"searchEngine":"brave","onStartup":"last-tabs","later":1}')).toEqual({
      settings: { ...DEFAULT_SETTINGS, searchEngine: 'brave', onStartup: 'last-tabs' },
    });
  });

  it('reads and checks the instrument panel settings (milestone 7)', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      instruments: false,
      instrumentsReadouts: true,
      instrumentsGauges: true,
      instrumentsConsole: true,
      instrumentsNetwork: true,
      consoleLevel: 'all',
    });
    expect(parseSettings('{"instruments":true,"instrumentsNetwork":false,"consoleLevel":"errors"}').settings).toMatchObject({
      instruments: true,
      instrumentsNetwork: false,
      consoleLevel: 'errors',
    });
    expect(applySettingsPatch(DEFAULT_SETTINGS, { instruments: 'on' })).toHaveProperty('error');
    expect(applySettingsPatch(DEFAULT_SETTINGS, { consoleLevel: 'verbose' })).toHaveProperty('error');
  });

  it('reads and checks the theme and page tilt settings (milestone 6)', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ theme: 'nebula', pageTilt: 10 });
    expect(parseSettings('{"theme":"system","pageTilt":0}').settings).toMatchObject({ theme: 'system', pageTilt: 0 });
    expect(applySettingsPatch(DEFAULT_SETTINGS, { theme: 'vaporwave' })).toHaveProperty('error');
    expect(applySettingsPatch(DEFAULT_SETTINGS, { pageTilt: 21 })).toHaveProperty('error');
    expect(applySettingsPatch(DEFAULT_SETTINGS, { pageTilt: 2.5 })).toHaveProperty('error');
    expect(applySettingsPatch(DEFAULT_SETTINGS, { pageTilt: 20 })).toMatchObject({ settings: { pageTilt: 20 } });
  });

  it('reads and checks the layers view settings (milestone 5)', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ layersOnOpen: true, layersSites: {} });
    expect(parseSettings('{"layersOnOpen":false,"layersSites":{"News.Example":true}}').settings).toMatchObject({
      layersOnOpen: false,
      layersSites: { 'news.example': true },
    });
    expect(applySettingsPatch(DEFAULT_SETTINGS, { layersOnOpen: 1 })).toHaveProperty('error');
    expect(applySettingsPatch(DEFAULT_SETTINGS, { layersSites: { 'a b': true } })).toHaveProperty('error');
    expect(applySettingsPatch(DEFAULT_SETTINGS, { layersSites: { 'a.example': 'yes' } })).toHaveProperty('error');
    expect(applySettingsPatch(DEFAULT_SETTINGS, { layersSites: ['a.example'] })).toHaveProperty('error');
  });

  it('reads and checks the privacy settings (milestone 4)', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ dnsMode: 'secure', filterRefresh: true, pausedSites: [] });
    const text = '{"dnsMode":"automatic","filterRefresh":false,"pausedSites":["News.Example.com","[::1]"]}';
    expect(parseSettings(text).settings).toMatchObject({
      dnsMode: 'automatic',
      filterRefresh: false,
      pausedSites: ['news.example.com', '[::1]'],
    });
    expect(applySettingsPatch(DEFAULT_SETTINGS, { dnsMode: 'off' })).toHaveProperty('error');
    expect(applySettingsPatch(DEFAULT_SETTINGS, { filterRefresh: 'yes' })).toHaveProperty('error');
    expect(applySettingsPatch(DEFAULT_SETTINGS, { pausedSites: ['a b'] })).toHaveProperty('error');
    expect(applySettingsPatch(DEFAULT_SETTINGS, { pausedSites: 'x.example' })).toHaveProperty('error');
    expect(applySettingsPatch(DEFAULT_SETTINGS, { pausedSites: ['x.example', 'X.example'] })).toEqual({
      settings: { ...DEFAULT_SETTINGS, pausedSites: ['x.example'] },
    });
  });

  it('falls back to defaults for a damaged file, with a reason', () => {
    expect(parseSettings('{oops')).toEqual({ settings: DEFAULT_SETTINGS, problem: 'not valid JSON' });
    expect(parseSettings('[]').problem).toBe('not a settings object');
    expect(parseSettings('{"searchEngine":"altavista"}').problem).toContain('Unknown search engine');
  });

  it('refuses bad changes', () => {
    expect(applySettingsPatch(DEFAULT_SETTINGS, { onStartup: 'sometimes' })).toHaveProperty('error');
    expect(applySettingsPatch(DEFAULT_SETTINGS, { wallpaper: 'x' })).toEqual({ error: 'Unknown setting: wallpaper' });
    expect(applySettingsPatch(DEFAULT_SETTINGS, null)).toHaveProperty('error');
  });

  it('knows every search engine address', () => {
    for (const engine of ['duckduckgo', 'brave', 'startpage', 'google', 'bing'] as const) {
      const url = searchUrlFor({ ...DEFAULT_SETTINGS, searchEngine: engine });
      expect(url).toMatch(/^https:\/\/.+%s/);
    }
  });
});

describe('parseSession', () => {
  it('keeps only web addresses and a valid focus', () => {
    expect(parseSession('{"tabs":["https://a.example/","file:///x","http://b.example/"],"focused":1}')).toEqual({
      tabs: ['https://a.example/', 'http://b.example/'],
      focused: 1,
    });
    expect(parseSession('{"tabs":["https://a.example/"],"focused":9}')).toEqual({ tabs: ['https://a.example/'], focused: 0 });
    expect(parseSession('{"tabs":[]}')).toBeNull();
    expect(parseSession('not json')).toBeNull();
    expect(parseSession(null)).toBeNull();
  });
});

describe('parseDataRequest', () => {
  it('accepts well-formed requests', () => {
    expect(parseDataRequest({ op: 'bookmarks.add', url: 'https://a.example/', title: 'A', favicon: null })).toHaveProperty(
      'request',
    );
    expect(parseDataRequest({ op: 'session.save', tabs: ['https://a.example/'], focused: 0 })).toHaveProperty('request');
    expect(parseDataRequest({ op: 'session.save', tabs: [], focused: -1 })).toHaveProperty('request');
  });

  it('refuses anything else', () => {
    expect(parseDataRequest(null)).toHaveProperty('error');
    expect(parseDataRequest({ op: 'drop.tables' })).toHaveProperty('error');
    expect(parseDataRequest({ op: 'bookmarks.add', url: 'file:///etc/passwd', title: 'x', favicon: null })).toHaveProperty(
      'error',
    );
    expect(parseDataRequest({ op: 'bookmarks.add', url: 'https://a.example/', title: 'x', favicon: 'javascript:1' })).toHaveProperty(
      'error',
    );
    expect(parseDataRequest({ op: 'history.search', query: 'a', limit: 1e9 })).toHaveProperty('error');
    expect(parseDataRequest({ op: 'history.delete', id: -1 })).toHaveProperty('error');
    expect(parseDataRequest({ op: 'session.save', tabs: ['https://a.example/'], focused: 3 })).toHaveProperty('error');
    expect(parseDataRequest({ op: 'data.clear', history: 'yes', cookies: false, cache: false })).toHaveProperty('error');
  });
});

describe('StorageService', () => {
  let folder: string;
  const cleared: string[] = [];
  const cleaner = {
    clearCookiesAndSiteData: async () => void cleared.push('cookies'),
    clearCache: async () => void cleared.push('cache'),
  };
  /**
   * The services a check has open. They are closed when the check ends,
   * however it ends: closed in the check's own last line, a failed
   * assertion left the service's history worker running and its files
   * open under the folder about to be deleted.
   */
  const running = new Set<StorageService>();
  const open = (): StorageService => {
    const s = new StorageService(folder, cleaner);
    running.add(s);
    return s;
  };
  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'hypersol-storage-'));
    cleared.length = 0;
  });
  afterEach(() => {
    for (const s of running) s.close();
    running.clear();
    rmSync(folder, { recursive: true, force: true });
  });

  it('keeps bookmarks, history, and settings across a restart', async () => {
    const a = open();
    await a.handle({ op: 'bookmarks.add', url: 'https://a.example/', title: 'A', favicon: null });
    a.recordVisit('https://a.example/', 'A');
    await a.handle({ op: 'settings.set', patch: { searchEngine: 'bing' } });
    // The restart: the first is closed here, as part of the check.
    running.delete(a);
    a.close();
    const b = open();
    expect(await b.handle({ op: 'bookmarks.list' })).toMatchObject({ ok: true, value: [{ url: 'https://a.example/' }] });
    expect(await b.handle({ op: 'history.recent', limit: 5 })).toMatchObject({ ok: true, value: [{ title: 'A' }] });
    expect(await b.handle({ op: 'settings.get' })).toEqual({ ok: true, value: { ...DEFAULT_SETTINGS, searchEngine: 'bing' } });
    expect(JSON.parse(readFileSync(join(folder, 'settings.json'), 'utf8'))).toEqual({ ...DEFAULT_SETTINGS, searchEngine: 'bing' });
  });

  it('returns saved tabs at startup only when asked to', async () => {
    const s = open();
    await s.handle({ op: 'session.save', tabs: ['https://a.example/', 'https://b.example/'], focused: 1 });
    expect(await s.handle({ op: 'startup' })).toEqual({ ok: true, value: null });
    await s.handle({ op: 'settings.set', patch: { onStartup: 'last-tabs' } });
    expect(await s.handle({ op: 'startup' })).toEqual({
      ok: true,
      value: { tabs: ['https://a.example/', 'https://b.example/'], focused: 1 },
    });
  });

  it('sets a damaged settings file aside and uses the defaults', async () => {
    writeFileSync(join(folder, 'settings.json'), '{not json');
    const s = open();
    expect(await s.handle({ op: 'settings.get' })).toEqual({ ok: true, value: DEFAULT_SETTINGS });
    expect(s.settingsFile.setAsideAs).not.toBeNull();
    expect(readdirSync(folder).some((f) => f.startsWith('settings.json.damaged-'))).toBe(true);
  });

  it('keeps working when the database cannot be opened', async () => {
    mkdirSync(join(folder, 'hypersol.sqlite')); // a folder where the file should be
    const s = open();
    expect(s.available).toBe(false);
    expect(await s.handle({ op: 'status' })).toEqual({
      ok: true,
      value: { available: false, message: "Couldn't open your saved data" },
    });
    expect(await s.handle({ op: 'bookmarks.list' })).toEqual({ ok: false, error: "Couldn't open your saved data" });
    expect(await s.recordVisit('https://a.example/', 'A')).toBeNull();
    expect(await s.handle({ op: 'settings.get' })).toMatchObject({ ok: true });
  });

  it('clears what was chosen, and tells listeners', async () => {
    const s = open();
    const changes: string[] = [];
    s.onChange((w) => changes.push(w));
    await s.recordVisit('https://a.example/', 'A');
    await s.handle({ op: 'data.clear', history: true, cookies: true, cache: false });
    expect(await s.handle({ op: 'history.recent', limit: 5 })).toEqual({ ok: true, value: [] });
    expect(cleared).toEqual(['cookies']);
    expect(changes).toEqual(['history', 'history']);
  });

  it('a change from the main process is saved, and listeners hear of it unless it is one nothing shows (the window)', async () => {
    const s = open();
    const changes: string[] = [];
    s.onChange((w) => changes.push(w));
    s.updateSettings({ sitePermissions: { 'https://site.example': { camera: 'allow' } } });
    expect(changes).toEqual(['settings']);
    const left = { x: 40, y: 30, width: 1100, height: 720, maximized: false };
    s.updateSettings({ windowBounds: left }, false);
    expect(changes).toEqual(['settings']);
    // Saved all the same, beside what was there, and there at the next start.
    expect(s.settingsFile.settings).toMatchObject({ windowBounds: left, sitePermissions: { 'https://site.example': { camera: 'allow' } } });
    expect(open().settingsFile.settings.windowBounds).toEqual(left);
    expect(() => s.updateSettings({ windowBounds: { ...left, width: 1 } }, false)).toThrow(/windowBounds/);
  });

  it('refuses bad requests without throwing', async () => {
    const s = open();
    expect(await s.handle({ op: 'nope' })).toEqual({ ok: false, error: 'Unknown request: nope' });
    expect(await s.handle({ op: 'settings.set', patch: { searchEngine: 'x' } })).toMatchObject({ ok: false });
  });
});

describe('settings failures (GitHub issue #2)', () => {
  let folder: string;
  const cleaner = { clearCookiesAndSiteData: async () => undefined, clearCache: async () => undefined };
  // As above: a service a check opens is closed when the check ends, however it ends.
  const running = new Set<StorageService>();
  const open = (): StorageService => {
    const s = new StorageService(folder, cleaner);
    running.add(s);
    return s;
  };
  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'hypersol-settings-'));
  });
  afterEach(() => {
    for (const s of running) s.close();
    running.clear();
    rmSync(folder, { recursive: true, force: true });
  });

  it('starts with defaults and an explanation when settings.json cannot be read', async () => {
    mkdirSync(join(folder, 'settings.json')); // a folder where the file should be
    const s = open();
    expect(await s.handle({ op: 'settings.get' })).toEqual({ ok: true, value: DEFAULT_SETTINGS });
    const status = await s.handle({ op: 'status' });
    expect(status).toMatchObject({ ok: true, value: { available: true } });
    expect((status as { value: { settingsProblem: string } }).value.settingsProblem).toMatch(/couldn't be read \(EISDIR\)/);
  });

  it('a failed save changes nothing and says so', async () => {
    mkdirSync(join(folder, 'settings.json'));
    const s = open();
    const reply = await s.handle({ op: 'settings.set', patch: { searchEngine: 'bing' } });
    expect(reply).toMatchObject({ ok: false });
    expect((reply as { error: string }).error).toMatch(/Couldn't save your settings .*Nothing was changed/);
    expect(await s.handle({ op: 'settings.get' })).toEqual({ ok: true, value: DEFAULT_SETTINGS });
  });

  it('a save under a missing folder leaves the settings in use unchanged', () => {
    const file = new SettingsFile(join(folder, 'missing', 'settings.json'));
    expect(() => file.save({ ...DEFAULT_SETTINGS, searchEngine: 'bing' })).toThrow(/ENOENT/);
    expect(file.settings.searchEngine).toBe('duckduckgo');
  });

  it('keeps a damaged file it cannot move aside, and will not overwrite it', () => {
    const writes: string[] = [];
    const fs: SettingsFileSystem = {
      read: () => '{broken',
      setAside: () => {
        throw Object.assign(new Error('locked'), { code: 'EBUSY' });
      },
      write: (_p, text) => void writes.push(text),
    };
    const file = new SettingsFile('settings.json', fs);
    expect(file.settings).toEqual(DEFAULT_SETTINGS);
    expect(file.problem).toMatch(/couldn't be moved aside \(EBUSY\).*left as it is/);
    expect(() => file.save({ ...DEFAULT_SETTINGS, searchEngine: 'bing' })).toThrow(/EBUSY/);
    expect(writes).toEqual([]);
    expect(file.settings.searchEngine).toBe('duckduckgo');
  });

  it('once the old file is set aside, saves work and the explanation clears', () => {
    let attempts = 0;
    let movedAside = false;
    const writes: string[] = [];
    const fs: SettingsFileSystem = {
      read: () => (movedAside ? null : '{broken'),
      setAside: () => {
        attempts += 1;
        if (attempts === 1) throw Object.assign(new Error('locked'), { code: 'EBUSY' });
        movedAside = true;
        return 'settings.json.damaged-x';
      },
      write: (_p, text) => void writes.push(text),
    };
    const file = new SettingsFile('settings.json', fs);
    expect(file.problem).not.toBeNull();
    // The second attempt at setting the file aside succeeds, then the save.
    file.save({ ...DEFAULT_SETTINGS, searchEngine: 'bing' });
    expect(attempts).toBe(2);
    expect(movedAside).toBe(true);
    expect(writes).toHaveLength(1);
    expect(file.settings.searchEngine).toBe('bing');
    expect(file.problem).toBeNull();
  });
});
