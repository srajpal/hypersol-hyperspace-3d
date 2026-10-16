import { BrowserWindow, ipcMain, type WebContents } from 'electron';
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
 * - The window after full screen: on Linux without a window manager (as
 *   on GitHub's machines), a page that left full screen by itself once
 *   left the browser's own page at 1 by 1 pixel in a window of the right
 *   size, until the window's bounds were set again (found by check FS2 in
 *   `pnpm test:linux`). The size is checked after leaving and, if it is
 *   wrong, the bounds are set again.
 * - The page after full screen on macOS, where full screen is a Space
 *   with a transition: the page's exit takes the window out of the Space,
 *   but the exit itself never completes in the page (its promise stays
 *   pending, document.fullscreenElement stays set, no fullscreenchange),
 *   so the page would keep its full-screen state in an ordinary window.
 *   And the browser's own page (the shell), whose webview element
 *   Electron puts into the shell document's full screen for a page's,
 *   keeps that too, which holds the page at the window's width instead
 *   of its box's, and a page's next request then never enters. A second
 *   exit of each, once the window has left, completes. So on macOS both
 *   are looked at after the window's leave-full-screen event and taken
 *   out again if they still say they are full (issue #111, found on the
 *   owner's Mac; Windows and Linux leave in one step).
 */
export class FullScreen {
  /** By page; kept weakly, so a page that is gone takes its state with it (no listener of its own on each page). */
  private readonly holding = new WeakMap<WebContents, { full: boolean; locked: boolean; edgeAt: number }>();
  /**
   * The pages full screen now (macOS, for the looks after leaving: none is
   * taken out while another holds the screen). A page that is gone is
   * dropped at the next look (no listener of its own: a WebContents has
   * ten already, and an eleventh is a warning the checks count as an
   * error).
   */
  private readonly fullNow = new Set<WebContents>();

  constructor(
    private readonly send: (page: WebContents, command: ShellCommand) => void,
    /** Test runs: told each top-edge report. */
    private readonly edgeLog?: (y: number) => void,
    /** Test runs: told each look after full screen on macOS (mendPage). */
    private readonly mendLog?: (mend: { at: number; page: number; shellFull: boolean; pageFull: boolean; shellAsked: boolean; pageAsked: boolean }) => void,
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
      this.fullNow.add(page);
      this.send(page, { type: 'page-fullscreen', webContentsId: id, on: true });
    });
    page.on('leave-html-full-screen', () => {
      this.state(page).full = false;
      this.fullNow.delete(page);
      this.send(page, { type: 'page-fullscreen', webContentsId: id, on: false });
      for (const ms of [300, 1200]) setTimeout(() => void this.mendWindow(page), ms);
      if (process.platform === 'darwin') this.mendPageOnceLeft(page);
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

  /** After full screen: the browser's own page as large as its window, or the window's bounds set again. */
  private async mendWindow(page: WebContents): Promise<void> {
    const shell = page.isDestroyed() ? null : page.hostWebContents;
    const win = shell && !shell.isDestroyed() ? BrowserWindow.fromWebContents(shell) : null;
    if (!shell || !win || win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return;
    const inner = (await shell.executeJavaScript('[innerWidth, innerHeight]').catch(() => null)) as [number, number] | null;
    const content = win.getContentBounds();
    if (!inner || win.isDestroyed() || (Math.abs(inner[0] - content.width) <= 2 && Math.abs(inner[1] - content.height) <= 2)) return;
    const bounds = win.getBounds();
    win.setBounds({ ...bounds, width: bounds.width - 1 });
    win.setBounds(bounds);
  }

  /**
   * macOS: once the window has left its full-screen Space (its
   * leave-full-screen event; at once if it is not in one) and holds
   * still, the shell's document and the page's are taken out again if
   * either still says it is full.
   */
  private mendPageOnceLeft(page: WebContents): void {
    const shell = page.isDestroyed() ? null : page.hostWebContents;
    const win = shell && !shell.isDestroyed() ? BrowserWindow.fromWebContents(shell) : null;
    const mend = () => void this.mendPage(page);
    // The window's leave-full-screen event can come while the window is still on its way back to its place;
    // an exit asked then is ignored, and so is every one after it. So the look waits until the window's bounds
    // have held still for a moment (at most 3 s). It looks once: a second look later fell into the next full
    // screen (another tab's, before its own event had come) and broke it.
    const onceStill = () => {
      if (!win || win.isDestroyed()) return mend();
      let last = JSON.stringify(win.getBounds());
      let stillFor = 0;
      const started = Date.now();
      const tick = () => {
        if (win.isDestroyed()) return;
        const now = JSON.stringify(win.getBounds());
        stillFor = now === last ? stillFor + 100 : 0;
        last = now;
        if (stillFor >= 300 || Date.now() - started > 3000) mend();
        else setTimeout(tick, 100);
      };
      setTimeout(tick, 100);
    };
    if (win && !win.isDestroyed() && win.isFullScreen()) win.once('leave-full-screen', onceStill);
    else onceStill();
  }

  /** The shell's document and the page's out of full screen if either still says it is in (macOS, after the window has left). */
  private async mendPage(page: WebContents): Promise<void> {
    if (page.isDestroyed()) return;
    // A page full screen again by now (this one, or another tab's) holds the shell's document rightly: nothing to
    // mend. The window in full screen says so too, and sooner (the page's event comes after the window's).
    for (const p of this.fullNow) if (p.isDestroyed()) this.fullNow.delete(p);
    if (this.fullNow.size > 0) return;
    const shell = page.hostWebContents;
    const win = shell && !shell.isDestroyed() ? BrowserWindow.fromWebContents(shell) : null;
    if (win && !win.isDestroyed() && win.isFullScreen()) return;
    let shellFull = false;
    if (shell && !shell.isDestroyed()) {
      // The shell is the browser's own page: its exit is asked as its own script would.
      shellFull = (await shell
        .executeJavaScript('document.fullscreenElement ? (void document.exitFullscreen().catch(() => undefined), true) : false', true)
        .catch(() => false)) as boolean;
    }
    if (page.isDestroyed()) return;
    const still = (await page
      .executeJavaScriptInIsolatedWorld(LEAVE_WORLD, [{ code: 'document.fullscreenElement !== null' }], true)
      .catch(() => false)) as boolean;
    if (still && !page.isDestroyed()) this.leave(page);
    this.mendLog?.({ at: Date.now(), page: page.id, shellFull, pageFull: still, shellAsked: shellFull, pageAsked: still });
  }

  /** Takes a page out of full screen and gives the pointer back. */
  leave(page: WebContents): void {
    if (page.isDestroyed()) return;
    void page.executeJavaScriptInIsolatedWorld(LEAVE_WORLD, [{ code: LEAVE_SCRIPT }], true).catch(() => undefined);
  }
}
