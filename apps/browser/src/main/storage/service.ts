import { join } from 'node:path';
import { parseDataRequest, type DataOp, type DataReply, type DataRequest } from '../../shared/data';
import { applySettingsPatch, type Settings } from '../../shared/settings';
import { Store } from './database';
import { inProcess, WorkerHistory, type HistoryBackend } from './history-backend';
import { SessionFile, SettingsFile } from './settings-file';

export type DataChange = 'bookmarks' | 'history' | 'settings' | 'passwords';

export interface SiteDataCleaner {
  /** Cookies and site storage (local storage, IndexedDB, service workers, and so on). */
  clearCookiesAndSiteData(): Promise<void>;
  clearCache(): Promise<void>;
}

const UNAVAILABLE = "Couldn't open your saved data";

export interface StorageOptions {
  /** Runs history elsewhere (the app: a worker thread); by default on this thread. */
  historyBackend?: (store: Store, databasePath: string) => HistoryBackend;
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

  /** Changes settings from the main process (site permissions); throws with the reason if refused. */
  updateSettings(patch: Partial<Settings>): Settings {
    const result = applySettingsPatch(this.settingsFile.settings, patch);
    if ('error' in result) throw new Error(result.error);
    this.settingsFile.save(result.settings);
    this.emit('settings');
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
    this.history?.close();
    this.store?.close();
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
