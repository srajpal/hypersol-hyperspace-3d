import type { FilterStatus } from '../../shared/privacy';

/**
 * resources/filters/lists.json: which lists, from where, and which may
 * ship in the app. `resources` is the file of page scripts the blocker
 * puts into pages; only `pnpm filters:update` fetches it (see
 * FilterService), so the app never reads that entry.
 */
export interface ListManifest {
  base: string;
  lists: { path: string; name: string; license: string; ship: boolean }[];
  resources: { path: string; name: string; license: string; ship: boolean };
}

/** Files the service reads and writes; replaceable in tests. */
export interface FilterFiles {
  /** The saved copy from the last refresh, or null if there is none. May throw if unreadable. */
  readSaved(): { bin: Uint8Array; meta: string } | null;
  /** Writes the saved copy; each file swapped in whole. */
  writeSaved(bin: Uint8Array, meta: string): void;
  /** The starter copy included in the app, and when it was built. */
  readStarter(): { bin: Uint8Array; built: number };
  /** The SHA-256 of the page scripts file included in the app, as recorded when the starter copy was built (starter.json). */
  scriptsChecksum(): string;
}

export interface FilterDeps<E> {
  files: FilterFiles;
  /** Downloads one list as text. Rejects on failure. */
  download(url: string): Promise<string>;
  /**
   * Builds the engine from list texts, off the main thread, with the page
   * scripts included in the app. Rejects if those scripts do not match
   * their recorded checksum.
   */
  build(lists: string[]): Promise<Uint8Array>;
  /** Loads an engine from its saved form. Throws if the data is damaged or from another version. */
  load(bin: Uint8Array): E;
  now(): number;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
/** After a failed refresh, wait this long before trying again on schedule. */
export const RETRY_MS = 60 * 60 * 1000;

interface SavedMeta {
  updatedAt: number;
  /** The addresses the saved copy was built from; a changed list set makes it due at once. */
  urls: string[];
  /** The checksum of the page scripts the saved copy was built with: the ones included in the app, or it is not used. */
  scripts: string;
}

function plain(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * The filter lists behind the privacy shield. On start it loads the copy
 * saved by the last refresh, or, if that is missing, damaged, or from an
 * older version of the blocker, the starter copy included in the app, so
 * pages are protected from the first one (TODO.md milestone 4, Q2 a).
 * A refresh downloads every list from its named address, builds the new
 * engine off the main thread, saves it, and only then puts it in use; any
 * failure keeps the lists in use.
 *
 * The lists are text: rules about addresses and page elements. The
 * blocker also has page scripts, which it runs inside web pages; those
 * come with the app (inside the starter copy) and are changed only by
 * `pnpm filters:update` before a release, never by a refresh (review of
 * 2026-09-30, M5: a refresh used to download them from a moving branch
 * of another project and run them in every page within a day). A saved
 * copy built with any other scripts is not used.
 */
export class FilterService<E> {
  private current!: E;
  private source: FilterStatus['source'] = 'starter';
  private updatedAt = 0;
  private refreshing: Promise<FilterStatus> | null = null;
  private lastError: string | undefined;
  private lastAttemptAt: number | undefined;
  private problemText: string | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly manifest: ListManifest,
    private readonly deps: FilterDeps<E>,
    /** Where the lists are downloaded from (the manifest's base; a local server in tests). */
    private readonly base = manifest.base,
  ) {
    this.loadAtStart();
  }

  get engine(): E {
    return this.current;
  }

  /** Why the saved copy was not used at start, if it was not. */
  get problem(): string | null {
    return this.problemText;
  }

  /** Every address a refresh downloads, in order: the list texts, and nothing else. */
  get urls(): string[] {
    return this.manifest.lists.map((l) => this.base + l.path);
  }

  status(): FilterStatus {
    return {
      source: this.source,
      updatedAt: this.updatedAt,
      refreshing: this.refreshing !== null,
      ...(this.lastError ? { lastError: this.lastError } : {}),
    };
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** True when a scheduled refresh should run: the lists are a day old and no attempt failed within the hour. */
  due(): boolean {
    const now = this.deps.now();
    if (this.refreshing) return false;
    if (now - this.updatedAt < DAY_MS) return false;
    return this.lastAttemptAt === undefined || now - this.lastAttemptAt >= RETRY_MS;
  }

  /** Downloads and builds the lists; one refresh at a time. Never rejects. */
  refresh(): Promise<FilterStatus> {
    if (this.refreshing) return this.refreshing;
    this.lastAttemptAt = this.deps.now();
    this.refreshing = this.run().finally(() => {
      this.refreshing = null;
      this.emit();
    });
    this.emit();
    return this.refreshing;
  }

  private async run(): Promise<FilterStatus> {
    try {
      const texts = await Promise.all(this.urls.map((url) => this.deps.download(url)));
      const scripts = this.deps.files.scriptsChecksum();
      const bin = await this.deps.build(texts);
      const engine = this.deps.load(bin);
      const updatedAt = this.deps.now();
      const meta: SavedMeta = { updatedAt, urls: this.urls, scripts };
      this.deps.files.writeSaved(bin, `${JSON.stringify(meta, null, 2)}\n`);
      this.current = engine;
      this.source = 'downloaded';
      this.updatedAt = updatedAt;
      this.lastError = undefined;
    } catch (e) {
      this.lastError = `Couldn't update the filter lists (${plain(e)}). The current lists are still in use.`;
    }
    return { ...this.status(), refreshing: false };
  }

  private loadAtStart(): void {
    try {
      const saved = this.deps.files.readSaved();
      if (saved) {
        const meta = JSON.parse(saved.meta) as Partial<SavedMeta>;
        if (typeof meta.updatedAt !== 'number' || !Array.isArray(meta.urls)) throw new Error('its details file is damaged');
        if (meta.scripts !== this.deps.files.scriptsChecksum()) throw new Error('it was not built with the page scripts included in this version');
        this.current = this.deps.load(saved.bin);
        this.source = 'downloaded';
        // Lists added or removed since: due for a refresh at once.
        this.updatedAt = meta.urls.join('\n') === this.urls.join('\n') ? meta.updatedAt : 0;
        return;
      }
    } catch (e) {
      this.problemText = `The saved filter lists couldn't be used (${plain(e)}), so the included lists are in use.`;
    }
    const starter = this.deps.files.readStarter();
    this.current = this.deps.load(starter.bin);
    this.source = 'starter';
    this.updatedAt = starter.built;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
