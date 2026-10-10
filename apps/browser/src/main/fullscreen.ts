import { ipcMain, type WebContents } from 'electron';
import type { ShellCommand } from '../shared/commands';
import { LEAVE_SCRIPT, LEAVE_WORLD, POINTER_LOCK_CHANNEL, TOP_EDGE_EVERY_MS, TOP_EDGE_PX, escapeLeaves } from '../shared/fullscreen';

/**
 * Full screen and pointer lock for web pages (GitHub issue #75), the main
 * process's part. The permissions themselves are given in
 * main/permissions.ts (ALLOWED_WITH_NOTICE); Chromium asks for a real
 * click or key first. Here:
 *
 * - What each page holds: full screen from Electron's own events, the
 *   pointer from the page's trusted preload (preload/fullscreen.ts). The
 *   shell is told, and shows its notice.
 * - Escape: seen here before the page sees it (before-input-event), on
 *   the page and on the shell, so a page that stops the key cannot keep
 *   either. The page is taken out of both in a world of the main
 *   process's own, apart from the page's scripts.
 * - The pointer at the top of the screen in full screen: the shell is
 *   told, to show its notice again. Mouse events of every frame of the
 *   page come here, an embedded player's too.
 */
export class FullScreen {
  /** By page; kept weakly, so a page that is gone takes its state with it (no listener of its own on each page). */
  private readonly holding = new WeakMap<WebContents, { full: boolean; locked: boolean; edgeAt: number }>();

  constructor(
    private readonly send: (page: WebContents, command: ShellCommand) => void,
    /** Test runs: told each top-edge report. */
    private readonly edgeLog?: (y: number) => void,
  ) {
    ipcMain.on(POINTER_LOCK_CHANNEL, (event, on: unknown) => {
      const page = event.sender;
      if (page.getType() !== 'webview' || event.senderFrame !== page.mainFrame || typeof on !== 'boolean') return;
      const state = this.state(page);
      if (state.locked === on) return;
      state.locked = on;
      this.send(page, { type: 'pointer-lock', webContentsId: page.id, on });
    });
  }

  private state(page: WebContents): { full: boolean; locked: boolean; edgeAt: number } {
    let s = this.holding.get(page);
    if (!s) {
      s = { full: false, locked: false, edgeAt: 0 };
      this.holding.set(page, s);
    }
    return s;
  }

  /** Whether a page holds the screen or the pointer now. */
  holds(page: WebContents): boolean {
    const s = this.holding.get(page);
    return s !== undefined && (s.full || s.locked);
  }

  /** Watches one web page. */
  track(page: WebContents): void {
    const id = page.id;
    page.on('enter-html-full-screen', () => {
      this.state(page).full = true;
      this.send(page, { type: 'page-fullscreen', webContentsId: id, on: true });
    });
    page.on('leave-html-full-screen', () => {
      this.state(page).full = false;
      this.send(page, { type: 'page-fullscreen', webContentsId: id, on: false });
    });
    page.on('before-input-event', (event, input) => {
      if (!escapeLeaves(input, this.holds(page))) return;
      event.preventDefault();
      this.leave(page);
    });
    page.on('input-event', (_event, input) => {
      const s = this.holding.get(page);
      if (!s?.full || input.type !== 'mouseMove') return;
      const y = (input as Electron.MouseInputEvent).y;
      const now = Date.now();
      if (y > TOP_EDGE_PX || now - s.edgeAt < TOP_EDGE_EVERY_MS) return;
      s.edgeAt = now;
      this.edgeLog?.(y);
      this.send(page, { type: 'fullscreen-top-edge', webContentsId: id });
    });
    // A new document holds neither; Chromium ends full screen as it goes.
    page.on('did-navigate', () => {
      const s = this.holding.get(page);
      if (s?.locked) {
        s.locked = false;
        this.send(page, { type: 'pointer-lock', webContentsId: id, on: false });
      }
    });
  }

  /** Escape on the shell (the keyboard was the browser's): every page the shell hosts leaves both. */
  watchShell(shell: WebContents, pages: () => WebContents[]): void {
    shell.on('before-input-event', (event, input) => {
      const holding = pages().filter((p) => !p.isDestroyed() && p.hostWebContents === shell && this.holds(p));
      if (holding.length === 0 || !escapeLeaves(input, true)) return;
      event.preventDefault();
      for (const p of holding) this.leave(p);
    });
  }

  /** Takes a page out of full screen and gives the pointer back. */
  leave(page: WebContents): void {
    if (page.isDestroyed()) return;
    void page.executeJavaScriptInIsolatedWorld(LEAVE_WORLD, [{ code: LEAVE_SCRIPT }], true).catch(() => undefined);
  }
}
