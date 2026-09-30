import { webContents as allContents, type IpcMainInvokeEvent, type NavigationEntry, type WebContents } from 'electron';
import { KEPT_HISTORIES, parseTabsRequest } from '../shared/tabs';
import { isAllowedPageUrl } from './security';

interface Kept {
  entries: NavigationEntry[];
  index: number;
  private: boolean;
}

/**
 * Keeps each web page's back and forward history (milestone 10), so a
 * reopened tab or a sleeping tab that wakes gets it back. Updated as the
 * page navigates; kept after the page closes for the last KEPT_HISTORIES
 * closed pages. Memory only; private tabs' go with the last private tab.
 */
export class TabHistory {
  private readonly open = new Map<number, Kept>();
  private readonly closed = new Map<number, Kept>();

  constructor(private readonly deps: { isPrivate(contents: WebContents): boolean }) {}

  track(contents: WebContents): void {
    const id = contents.id;
    const isPrivate = this.deps.isPrivate(contents);
    const note = () => {
      if (contents.isDestroyed()) return;
      const history = contents.navigationHistory;
      const all = history.getAllEntries();
      const active = all[history.getActiveIndex()];
      // Only web addresses are kept (a blank page waiting for a restore is not).
      const entries = all.filter((e) => !e.url.startsWith('about:') && e.url !== '' && isAllowedPageUrl(e.url));
      if (entries.length === 0) return;
      const index = active ? Math.max(0, entries.indexOf(active)) : entries.length - 1;
      this.open.set(id, { entries, index, private: isPrivate });
    };
    contents.on('did-navigate', note);
    contents.on('did-navigate-in-page', note);
    contents.on('page-title-updated', note);
    contents.once('destroyed', () => {
      const kept = this.open.get(id);
      this.open.delete(id);
      if (!kept) return;
      this.closed.set(id, kept);
      while (this.closed.size > KEPT_HISTORIES) this.closed.delete(this.closed.keys().next().value!);
    });
  }

  forgetPrivate(): void {
    for (const [id, kept] of this.closed) if (kept.private) this.closed.delete(id);
  }

  /** A request from the shell (registered with handleFromShell, main/ipc.ts). Never throws. */
  async handle(event: IpcMainInvokeEvent, raw: unknown): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
    const parsed = parseTabsRequest(raw);
    if ('error' in parsed) return { ok: false, error: parsed.error };
    const { tab, from } = parsed.request;
    const target = allContents.fromId(tab);
    if (!target || target.isDestroyed() || target.getType() !== 'webview' || target.hostWebContents !== event.sender) {
      return { ok: false, error: 'No such page' };
    }
    const kept = this.closed.get(from) ?? this.open.get(from);
    // A private tab's history never goes into a normal tab, nor the other way.
    if (!kept || kept.private !== this.deps.isPrivate(target)) return { ok: true, value: false };
    this.closed.delete(from);
    // The new page starts blank; let that first load finish, or it lands on
    // top of the restored history.
    if (target.isLoading()) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 3000);
        target.once('did-stop-loading', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    // Not awaited: its promise waits for the page to finish loading, which
    // a web page may never do (or not for long), and the tab follows the
    // load through its own events. A failed load shows the tab's error card.
    target.navigationHistory.restore({ entries: kept.entries, index: kept.index }).catch(() => undefined);
    return { ok: true, value: true };
  }
}
