import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { BookmarkFileError, IMPORT_LIMITS, readBookmarkFile, writeBookmarkFile, type ImportedBookmark } from './bookmark-file';
import { parseDataRequest, type DataOp, type DataReply, type DataRequest } from '../../shared/data';
import { applySettingsPatch, type Settings, type SettingsPatch } from '../../shared/settings';
import { Store } from './database';
import { inProcess, WorkerHistory, type HistoryBackend } from './history-backend';
import { siteKey } from '../../shared/site';
import { SessionFile, SettingsFile } from './settings-file';

export type DataChange = 'bookmarks' | 'history' | 'settings' | 'passwords';

export interface SiteDataCleaner {
  /** Cookies and site storage (local storage, IndexedDB, service workers, and so on). */
  clearCookiesAndSiteData(): Promise<void>;
  clearCache(): Promise<void>;
}

const UNAVAILABLE = "Couldn't open your saved data";

/** Files the person chooses with the system's dialogs (milestone 26, bookmark files). */
export interface FileChooser {
  /** A file to read; null when none was chosen. */
  open(): Promise<string | null>;
  /** Where to write, offering this name; null when no place was chosen. */
  save(defaultName: string): Promise<string | null>;
}

export interface StorageOptions {
  /** Runs history elsewhere (the app: a worker thread); by default on this thread. */
  historyBackend?: (store: Store, databasePath: string) => HistoryBackend;
  /** The system's file dialogs; without them, importing and exporting bookmarks is refused. */
  files?: FileChooser;
}

/**
 * Saved data for the app: bookmarks and history (hypersol.sqlite),
 * settings.json, and session.json, all in one folder (the app data
 * folder). No Electron imports, so it can be unit tested.
 *
 * If the database cannot be opened the app keeps working: history is
 * not recorded and requests for bookmarks and history report the
 * problem in plain words.
 */
export class StorageService {
  private readonly store: Store | null;
  private readonly storeError: string | null;
  /** History reads and writes, answered later (a worker thread in the app, milestone 10). */
  private readonly history: HistoryBackend | null;
  readonly settingsFile: SettingsFile;
  private readonly sessionFile: SessionFile;
  private readonly listeners = new Set<(what: DataChange) => void>();
  private readonly files: FileChooser | null;
  /** The bookmark file last read, waiting for Add (milestone 26): only the newest can be added. */
  private pendingImport: { token: number; found: ImportedBookmark[] } | null = null;
  private importTokens = 0;

  constructor(
    folder: string,
    private readonly cleaner: SiteDataCleaner,
    options: StorageOptions = {},
  ) {
    let store: Store | null = null;
    let error: string | null = null;
    const path = join(folder, 'hypersol.sqlite');
    try {
      store = new Store(path);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    this.store = store;
    this.storeError = error;
    this.history = store ? (options.historyBackend?.(store, path) ?? inProcess(store.history)) : null;
    this.settingsFile = new SettingsFile(join(folder, 'settings.json'));
    this.sessionFile = new SessionFile(join(folder, 'session.json'));
    this.files = options.files ?? null;
  }

  get available(): boolean {
    return this.store !== null;
  }

  /** Whether history runs in a worker thread that is still working (milestone 10, for the tests). */
  get historyInWorker(): boolean {
    return this.history instanceof WorkerHistory && this.history.working;
  }

  /** The database, for the password vault (main/passwords); null when it could not be opened. */
  get database(): Store | null {
    return this.store;
  }

  /**
   * Changes settings from the main process (site permissions, the
   * window's size and place); throws with the reason if refused.
   *
   * @param tell Whether listeners hear of the change. The shell shows
   *   nothing of the window's size and place, so it is not told of those.
   */
  updateSettings(patch: SettingsPatch, tell = true): Settings {
    const result = applySettingsPatch(this.settingsFile.settings, patch);
    if ('error' in result) throw new Error(result.error);
    this.settingsFile.save(result.settings);
    if (tell) this.emit('settings');
    return result.settings;
  }

  /** Tells listeners that saved data changed outside a request (saved passwords). */
  notify(what: DataChange): void {
    this.emit(what);
  }

  /** Why the database could not be opened, for logs. */
  get problem(): string | null {
    return this.storeError;
  }

  onChange(listener: (what: DataChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Records a page visit; answers its id, or null when history is unavailable. */
  async recordVisit(url: string, title: string): Promise<number | null> {
    if (!this.history || !/^https?:\/\//i.test(url)) return null;
    try {
      const id = await this.history.record(url, title || url);
      this.emit('history');
      return id;
    } catch {
      return null;
    }
  }

  async updateVisitTitle(id: number, title: string): Promise<void> {
    if (!this.history || title === '') return;
    try {
      await this.history.updateTitle(id, title);
      this.emit('history');
    } catch {
      // A missed title is not worth interrupting browsing for.
    }
  }

  /** Answers one request from the shell. Never throws. */
  async handle(raw: unknown): Promise<DataReply<DataOp>> {
    const parsed = parseDataRequest(raw);
    if ('error' in parsed) return { ok: false, error: parsed.error };
    try {
      return { ok: true, value: await this.run(parsed.request) } as DataReply<DataOp>;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  close(): void {
    void this.history?.close();
    this.store?.close();
  }

  /** Closes saved data, and answers once the history worker's thread has stopped (for ending the app outside a normal quit). */
  async closed(): Promise<void> {
    try {
      await this.history?.close();
    } finally {
      this.store?.close();
    }
  }

  /** Reads the bookmark file the person chooses, and keeps what it would add until Add or another file. */
  private async readImport(): Promise<unknown> {
    const store = this.needStore();
    if (!this.files) throw new Error('Bookmarks cannot be imported here.');
    const path = await this.files.open();
    if (!path) return null;
    this.pendingImport = null;
    const token = ++this.importTokens;
    const preview = { token, file: basename(path), found: [] as { url: string; title: string; folder: string }[], skipped: [] as unknown[], skippedCount: 0 };
    try {
      if ((await stat(path)).size > IMPORT_LIMITS.fileBytes) throw new BookmarkFileError(`This file is larger than ${IMPORT_LIMITS.fileBytes / 1024 / 1024} MB.`);
      const read = readBookmarkFile(await readFile(path, 'utf8'), (url) => store.hasBookmark(url));
      this.pendingImport = { token, found: read.found };
      return { ...preview, found: read.found.map((b) => ({ url: b.url, title: b.title, folder: b.folder })), skipped: read.skipped, skippedCount: read.skippedCount };
    } catch (e) {
      if (e instanceof BookmarkFileError) return { ...preview, error: e.message };
      throw new Error(`Couldn't read ${basename(path)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private needStore(): Store {
    if (!this.store) throw new Error(UNAVAILABLE);
    return this.store;
  }

  private needHistory(): HistoryBackend {
    if (!this.history) throw new Error(UNAVAILABLE);
    return this.history;
  }

  private async run(r: DataRequest): Promise<unknown> {
    switch (r.op) {
      case 'status': {
        const settingsProblem = this.settingsFile.problem;
        return {
          available: this.store !== null,
          ...(this.store ? {} : { message: UNAVAILABLE }),
          ...(settingsProblem ? { settingsProblem } : {}),
        };
      }
      case 'bookmarks.list':
        return this.needStore().listBookmarks();
      case 'bookmarks.has':
        return this.store ? this.store.hasBookmark(r.url) : false;
      case 'bookmarks.add': {
        const b = this.needStore().addBookmark(r.url, r.title || r.url, r.favicon);
        this.emit('bookmarks');
        return b;
      }
      case 'bookmarks.remove':
        this.needStore().removeBookmark(r.url);
        this.emit('bookmarks');
        return null;
      case 'bookmarks.import-read':
        return this.readImport();
      case 'bookmarks.import-add': {
        const pending = this.pendingImport;
        if (!pending || pending.token !== r.token) throw new Error('That bookmark file is no longer waiting to be added. Choose it again.');
        this.pendingImport = null;
        const now = Date.now();
        const added = this.needStore().importBookmarks(pending.found.map((b) => ({ url: b.url, title: b.title, favicon: b.favicon, createdAt: b.createdAt ?? now })));
        this.emit('bookmarks');
        return added;
      }
      case 'bookmarks.export': {
        const store = this.needStore();
        if (!this.files) throw new Error('Bookmarks cannot be exported here.');
        const path = await this.files.save('bookmarks.html');
        if (!path) return null;
        const all = store.listBookmarks();
        await writeFile(path, writeBookmarkFile(all), 'utf8');
        return { file: basename(path), count: all.length };
      }
      case 'history.search':
        return this.needHistory().search(r.query, r.limit);
      case 'history.recent':
        return this.needHistory().recent(r.limit);
      case 'history.delete':
        await this.needHistory().delete(r.id);
        this.emit('history');
        return null;
      case 'history.clear':
        await this.needHistory().clear();
        this.emit('history');
        return null;
      case 'history.suggest': {
        // History (in the worker), then bookmarks that match.
        const found = await this.needHistory().suggest(r.text, r.limit);
        const text = r.text.trim().toLowerCase();
        const marks = this.store
          ? this.store
              .listBookmarks()
              .filter((b) => b.url.toLowerCase().includes(text) || b.title.toLowerCase().includes(text))
              .filter((b) => !found.items.some((i) => i.url === b.url))
              .slice(0, 3)
              .map((b) => ({ url: b.url, title: b.title, kind: 'bookmark' as const }))
          : [];
        let inline = found.inline;
        if (!inline) {
          const key = siteKey(text);
          const mark = this.store?.listBookmarks().find((b) => siteKey(b.url).startsWith(key));
          if (mark && key !== '') inline = { key: siteKey(mark.url), url: mark.url };
        }
        return { inline, items: [...found.items, ...marks].slice(0, r.limit) };
      }
      case 'history.forget-url':
        await this.needHistory().forgetUrl(r.url);
        this.emit('history');
        return null;
      case 'settings.get':
        return this.settingsFile.settings;
      case 'settings.set':
        return this.updateSettings(r.patch);
      case 'session.save':
        this.sessionFile.save({ tabs: r.tabs, focused: r.focused });
        return null;
      case 'startup':
        return this.settingsFile.settings.onStartup === 'last-tabs' ? this.sessionFile.load() : null;
      case 'data.clear':
        if (r.history && this.history) {
          await this.history.clear();
          this.emit('history');
        }
        if (r.cookies) await this.cleaner.clearCookiesAndSiteData();
        if (r.cache) await this.cleaner.clearCache();
        // Saved passwords go only when ticked (milestone 9).
        if (r.passwords && this.store) {
          this.store.clearLogins();
          this.emit('passwords');
        }
        return null;
    }
  }

  private emit(what: DataChange): void {
    for (const listener of this.listeners) listener(what);
  }
}
