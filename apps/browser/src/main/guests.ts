import { clipboard, Menu, nativeImage, type MenuItemConstructorOptions, type WebContents } from 'electron';
import type { ShellCommand, ShortcutName } from '../shared/commands';
import { contextMenuEntries, type MenuAction } from './context-menu';
import { FaviconLoader, type FetchFn } from './favicon';
import { decidePopup, GESTURE_EVENTS } from './popups';
import { decidePageNavigation } from './security';
import { matchShortcut } from './shortcuts';
import type { TestLog } from './test-hooks';

export interface GuestDeps {
  /** Sends a command to the shell that hosts this page. */
  send(command: ShellCommand): void;
  platform: string;
  /** The person's own shortcut keys (Settings > Shortcuts, milestone 11). */
  shortcutKeys?(): Partial<Record<ShortcutName, string>>;
  /** Settings is waiting for a new shortcut's keys: pass every key through. */
  capturingKeys?(): boolean;
  testLog: TestLog | null;
  /** Records a finished page load in history; answers its id, or null. */
  recordVisit(url: string, title: string): Promise<number | null> | null;
  updateVisitTitle(id: number, title: string): void;
  /**
   * The page asks to be kept (a beforeunload handler) while its tab is
   * about to go elsewhere: ask the person; true to leave (main/leave-page.ts).
   */
  confirmLeave(url: string): boolean;
  /** Fetches the page's favicon: shown to the privacy shield first, like the page's own requests (main/privacy). */
  fetchFavicon: FetchFn;
}

/**
 * Sends browser shortcuts pressed in this web contents (the shell or a
 * page) to the shell, and stops the page from also seeing them.
 */
export function wireShortcuts(
  contents: WebContents,
  deps: Pick<GuestDeps, 'send' | 'platform' | 'shortcutKeys' | 'capturingKeys'>,
): void {
  contents.on('before-input-event', (event, input) => {
    if (deps.capturingKeys?.()) return;
    const name = matchShortcut(input, deps.platform, deps.shortcutKeys?.() ?? {});
    if (!name) return;
    event.preventDefault();
    deps.send({ type: 'shortcut', name });
  });
}

/**
 * Everything the main process does for one web page: web addresses only,
 * shortcuts, new-window rules, the right-click menu, and favicons.
 */
export function wireGuest(guest: WebContents, deps: GuestDeps): void {
  let lastGesture: number | null = null;

  guest.on('input-event', (_event, input) => {
    if (GESTURE_EVENTS.has(input.type)) lastGesture = Date.now();
  });
  // A new document starts without the person's click.
  guest.on('did-navigate', () => {
    lastGesture = null;
  });

  const sinceGesture = () => (lastGesture === null ? null : Date.now() - lastGesture);

  guest.on('will-navigate', (event, url) => {
    const verdict = decidePageNavigation(guest.getURL(), url, sinceGesture());
    if (verdict === 'allow') return;
    event.preventDefault();
    // A local HoloML page leaving for the web goes without the parts of the
    // address that could carry what it read from its folder (main/security.ts).
    if (verdict !== 'refuse') void guest.loadURL(verdict.load).catch(() => undefined);
  });

  guest.on('will-prevent-unload', (event) => {
    // Electron keeps the page unless told otherwise; preventDefault lets the tab leave.
    if (deps.confirmLeave(guest.getURL())) event.preventDefault();
  });

  // History: one entry per page the tab navigates to. did-navigate comes
  // for committed main-frame navigations, not failed loads or in-page
  // jumps. Arriving at the same address again in the same tab (a reload)
  // adds no new entry. The title follows when the page reports it.
  // History is written in a worker thread (milestone 10), so the visit's id
  // arrives later; a title that comes first waits for it.
  let visit: { id: Promise<number | null>; url: string } | null = null;
  guest.on('did-navigate', (_event, url) => {
    if (visit && visit.url === url) return;
    // The title at this moment can still be the previous page's; start with
    // the address, and the page's own title replaces it when it arrives.
    const id = deps.recordVisit(url, '');
    visit = id === null ? null : { id, url };
  });
  guest.on('page-title-updated', (_event, title) => {
    const current = visit;
    if (!current || guest.getURL() !== current.url) return;
    void current.id.then((id) => {
      if (id !== null) deps.updateVisitTitle(id, title);
    });
  });

  guest.setWindowOpenHandler(({ url, disposition }) => {
    const verdict = url === '' ? 'refuse' : decidePageNavigation(guest.getURL(), url, sinceGesture());
    if (verdict === 'refuse') return { action: 'deny' };
    const decision = decidePopup(disposition, sinceGesture());
    if (decision.allow) {
      deps.send({ type: 'open-tab', url: verdict === 'allow' ? url : verdict.load, background: decision.background, openerWebContentsId: guest.id });
    } else {
      deps.testLog?.blockedPopups.push(url);
    }
    return { action: 'deny' };
  });

  wireShortcuts(guest, deps);
  // Ctrl + mouse wheel or a pinch: zoom like the zoom buttons (milestone 8).
  guest.on('zoom-changed', (_event, direction) => deps.send({ type: 'shortcut', name: direction === 'in' ? 'zoom-in' : 'zoom-out' }));

  guest.on('context-menu', (_event, params) => {
    const history = guest.navigationHistory;
    const entries = contextMenuEntries(params, {
      canGoBack: history.canGoBack(),
      canGoForward: history.canGoForward(),
    });
    const run = (action: MenuAction) => runMenuAction(guest, action, params.linkURL, deps);
    const template: MenuItemConstructorOptions[] = entries.map((e) =>
      'separator' in e
        ? { type: 'separator' }
        : { id: e.action, label: e.label, enabled: e.enabled, click: () => run(e.action) },
    );
    if (deps.testLog) {
      // Tests read the menu and pick an entry instead of a native popup,
      // which would wait for a real mouse.
      deps.testLog.menus.push({
        labels: entries.map((e) => ('separator' in e ? '---' : e.label)),
        run: (label: string) => {
          const entry = entries.find((e) => !('separator' in e) && e.label === label);
          if (!entry || 'separator' in entry || !entry.enabled) throw new Error(`No enabled entry "${label}"`);
          run(entry.action);
        },
      });
      return;
    }
    Menu.buildFromTemplate(template).popup();
  });

  // Favicons are untrusted input: bounded, one fetch at a time, cancelled
  // when the page moves on (main/favicon.ts, GitHub issue #1).
  const favicons = new FaviconLoader(
    deps.fetchFavicon,
    (bytes) => {
      const image = nativeImage.createFromBuffer(bytes);
      return image.isEmpty() ? null : image.resize({ width: 32, height: 32, quality: 'best' }).toDataURL();
    },
  );
  guest.on('page-favicon-updated', (_event, urls) => {
    favicons.request(urls, (dataUrl) => {
      if (!guest.isDestroyed()) deps.send({ type: 'favicon', webContentsId: guest.id, dataUrl });
    });
  });
  guest.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) favicons.cancel();
  });
  guest.once('destroyed', () => favicons.cancel());
}

function runMenuAction(guest: WebContents, action: MenuAction, linkURL: string, deps: GuestDeps): void {
  switch (action) {
    case 'open-link-new-tab':
      deps.send({ type: 'open-tab', url: linkURL, background: true, openerWebContentsId: guest.id });
      break;
    case 'copy-link':
      clipboard.writeText(linkURL);
      break;
    case 'cut':
      guest.cut();
      break;
    case 'copy':
      guest.copy();
      break;
    case 'paste':
      guest.paste();
      break;
    case 'select-all':
      guest.selectAll();
      break;
    case 'back':
      guest.navigationHistory.goBack();
      break;
    case 'forward':
      guest.navigationHistory.goForward();
      break;
    case 'reload':
      guest.reload();
      break;
  }
}
