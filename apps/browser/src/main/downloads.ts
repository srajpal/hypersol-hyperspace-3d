import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { shell, type DownloadItem, type IpcMainInvokeEvent, type Session, type WebContents } from 'electron';
import {
  parseDownloadRequest,
  uniqueName,
  type DownloadInfo,
  type DownloadOp,
  type DownloadReply,
  type DownloadRequest,
} from '../shared/downloads';

const MAX_LISTED = 100;
const UPDATE_MS = 250;

export interface DownloadsOptions {
  /** The folder files are saved to (the system's Downloads folder; a temporary one in tests). */
  folder(): string;
  isShell(contents: WebContents): boolean;
  /** The list changed. */
  onChange(list: DownloadInfo[]): void;
  /** Test runs: record what would be opened instead of opening it. */
  opened?: (what: 'open' | 'show', path: string) => void;
}

/**
 * Downloads (milestone 8): every file is saved straight to the Downloads
 * folder, never over an existing file, and listed for the session.
 */
export class Downloads {
  private readonly items = new Map<number, { item: DownloadItem | null; info: DownloadInfo }>();
  private nextId = 1;
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly options: DownloadsOptions) {}

  /** Handles downloads from a session (the normal one and the private tabs' one). */
  watch(ses: Session): void {
    ses.on('will-download', (_event, item) => {
      const folder = this.options.folder();
      const name = uniqueName(item.getFilename(), (candidate) => existsSync(join(folder, candidate)) || this.reserved(join(folder, candidate)));
      const path = join(folder, name);
      item.setSavePath(path);
      const info: DownloadInfo = {
        id: this.nextId++,
        filename: name,
        url: item.getURL(),
        path,
        received: 0,
        total: item.getTotalBytes(),
        state: 'progressing',
        startedAt: Date.now(),
      };
      this.items.set(info.id, { item, info });
      this.trim();
      item.on('updated', (_e, state) => {
        info.received = item.getReceivedBytes();
        info.total = item.getTotalBytes();
        info.state = state === 'interrupted' ? 'interrupted' : 'progressing';
        this.changed();
      });
      item.once('done', (_e, state) => {
        info.received = item.getReceivedBytes();
        info.state = state;
        const entry = this.items.get(info.id);
        if (entry) entry.item = null;
        this.trim();
        this.changed(true);
      });
      this.changed(true);
    });
  }

  list(): DownloadInfo[] {
    return [...this.items.values()].map(({ info }) => ({ ...info }));
  }

  get active(): number {
    return [...this.items.values()].filter(({ info }) => info.state === 'progressing').length;
  }

  async handle(event: IpcMainInvokeEvent, raw: unknown): Promise<DownloadReply<DownloadOp>> {
    if (!this.options.isShell(event.sender)) return { ok: false, error: 'Not allowed' };
    const parsed = parseDownloadRequest(raw);
    if ('error' in parsed) return { ok: false, error: parsed.error };
    try {
      return { ok: true, value: await this.run(parsed.request) } as DownloadReply<DownloadOp>;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async run(r: DownloadRequest): Promise<unknown> {
    switch (r.op) {
      case 'downloads.list':
        return this.list();
      case 'downloads.clear':
        for (const [id, { info }] of this.items) if (info.state !== 'progressing') this.items.delete(id);
        this.changed(true);
        return null;
      case 'downloads.open':
      case 'downloads.show':
      case 'downloads.cancel': {
        const entry = this.items.get(r.id);
        if (!entry) throw new Error('No such download');
        if (r.op === 'downloads.cancel') {
          entry.item?.cancel();
          return null;
        }
        if (entry.info.state !== 'completed' && r.op === 'downloads.open') throw new Error('The download has not finished');
        const what = r.op === 'downloads.open' ? 'open' : 'show';
        if (this.options.opened) this.options.opened(what, entry.info.path);
        else if (what === 'open') {
          const problem = await shell.openPath(entry.info.path);
          if (problem) throw new Error(problem);
        } else shell.showItemInFolder(entry.info.path);
        return null;
      }
    }
  }

  /**
   * Keeps the list to MAX_LISTED by dropping the oldest finished entries.
   * A running download is never dropped (GitHub issue #10): it must stay
   * cancellable and keep its file name reserved, however many finish
   * after it.
   */
  private trim(): void {
    for (const [id, { info }] of this.items) {
      if (this.items.size <= MAX_LISTED) return;
      if (info.state !== 'progressing') this.items.delete(id);
    }
  }

  /** A name in use by a download still in progress. */
  private reserved(path: string): boolean {
    return [...this.items.values()].some(({ info }) => info.path === path && info.state === 'progressing');
  }

  private changed(now = false): void {
    if (now) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.options.onChange(this.list());
      return;
    }
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.options.onChange(this.list());
    }, UPDATE_MS);
  }
}
