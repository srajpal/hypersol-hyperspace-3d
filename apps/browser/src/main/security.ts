import type { App, WebContents, WebPreferences } from 'electron';
import { PRIVATE_PARTITION, RESTORE_BLANK } from '../shared/commands';
import { LOCAL_SCHEME } from '../shared/holoml-page';
import { USER_ACTIVATION_MS } from './popups';

/** Web pages may only be http, https, or the blank page. */
export function isAllowedPageUrl(url: string): boolean {
  if (url === '' || url === 'about:blank') return true;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** A HoloML file opened from the computer (milestone 14): hypersol-file://<folder name>/<path>. */
export function isLocalHolomlUrl(url: string): boolean {
  try {
    return new URL(url).protocol === `${LOCAL_SCHEME}:`;
  } catch {
    return false;
  }
}

/**
 * Where a page may go by itself (links, scripts): the web, or, from a
 * local HoloML file, another file in the same opened folder. Nothing else
 * reaches a local address: only the person opens files (milestone 14).
 */
export function isAllowedPageNavigation(from: string, to: string): boolean {
  if (isAllowedPageUrl(to)) return true;
  if (!isLocalHolomlUrl(to) || !isLocalHolomlUrl(from)) return false;
  return new URL(from).host === new URL(to).host;
}

/** What happens to a navigation a page starts by itself: it goes ahead, is refused, or another address is loaded in its place. */
export type NavigationVerdict = 'allow' | 'refuse' | { load: string };

/**
 * A page's own navigation, decided (review of 2026-09-30, M6). On top of
 * isAllowedPageNavigation: a HoloML file opened from the computer can
 * read the files beside it, so its script must not be able to carry what
 * it read to the web in an address. It may leave for a web address only
 * right after a real click or key press on the page (as a link needs),
 * and then without the address's query string and fragment.
 *
 * @param msSinceGesture Time since the last real click or key press in
 *   the page, or null if there has been none since it loaded.
 */
export function decidePageNavigation(from: string, to: string, msSinceGesture: number | null): NavigationVerdict {
  if (!isAllowedPageNavigation(from, to)) return 'refuse';
  if (!isLocalHolomlUrl(from) || isLocalHolomlUrl(to) || to === '' || to === 'about:blank') return 'allow';
  if (msSinceGesture === null || msSinceGesture < 0 || msSinceGesture > USER_ACTIVATION_MS) return 'refuse';
  const url = new URL(to);
  url.search = '';
  url.hash = '';
  // Compared as the parser writes them, so an address that only differs in form goes ahead as it is.
  return url.href === new URL(to).href ? 'allow' : { load: url.href };
}

/**
 * A site that asks for a client certificate gets none (review of
 * 2026-09-30, M2). With no listener Electron hands over the first
 * certificate in the system's store without asking, in private tabs too:
 * the site, or a third party's part of a page, would learn the name and
 * e-mail address on a work or identity certificate. Until there is a
 * chooser, the answer is "no certificate".
 */
export function refuseClientCertificates(app: Pick<App, 'on'>): void {
  app.on('select-client-certificate', (event, _contents, _url, _list, callback) => {
    event.preventDefault();
    callback();
  });
}

/** What the main process knows about a "a file was dropped on this page" message. */
export interface DropMessage {
  /** The dropped file's path, as the page's preload gave it. */
  path: unknown;
  /** The sender's kind: 'webview' for a web page. */
  senderType: string;
  fromMainFrame: boolean;
  /** The sender is one of the shell's own tabs. */
  hostedByShell: boolean;
  /** That tab is still opening an earlier dropped file. */
  alreadyOpening: boolean;
}

/**
 * May a dropped file's message be acted on (review of 2026-09-30, M11)?
 * The path comes from a page's preload, which a page that broke out of
 * its own world could imitate, and the main process cannot see the drop
 * itself. So it holds the message to everything it can know: a web page
 * in one of the shell's tabs, its main frame, one file at a time, and a
 * path that names a .holoml file (that it exists and is a file is checked
 * when it is opened, main/holoml.ts).
 */
export function isAcceptableDrop(d: DropMessage): boolean {
  return (
    typeof d.path === 'string' &&
    d.path.length <= 4096 &&
    /[^\\/]\.holoml$/i.test(d.path) &&
    d.senderType === 'webview' &&
    d.fromMainFrame &&
    d.hostedByShell &&
    !d.alreadyOpening
  );
}

export interface AttachRecord {
  /** Preload the webview asked for, if any. */
  requestedPreload: string | null;
  /** Preload actually used: always the trusted page preload. */
  appliedPreload: string;
  src: string;
  allowed: boolean;
}

/** Safe settings forced onto every web page, whatever the webview asked for. */
export function lockDownWebPreferences(prefs: WebPreferences, pagePreloadPath: string, noWebGL = false): string | null {
  const loose = prefs as WebPreferences & { preloadURL?: string };
  const requested = loose.preloadURL ?? loose.preload ?? null;
  delete loose.preloadURL;
  prefs.preload = pagePreloadPath;
  prefs.nodeIntegration = false;
  prefs.nodeIntegrationInSubFrames = false;
  prefs.nodeIntegrationInWorker = false;
  prefs.contextIsolation = true;
  prefs.sandbox = true;
  prefs.webSecurity = true;
  prefs.allowRunningInsecureContent = false;
  prefs.experimentalFeatures = false;
  prefs.spellcheck = false;
  prefs.webviewTag = false;
  // After a page's second alert or confirm in a row, the dialog offers to stop them: `while (1) alert()` can be left.
  prefs.safeDialogs = true;
  // Test mode only: pages as on a computer that cannot draw WebGL (milestone 14, P11).
  if (noWebGL) prefs.webgl = false;
  return requested === pagePreloadPath ? null : requested;
}

/**
 * Hardens the 3D shell: it never navigates away or opens windows, and
 * every webview it attaches gets the trusted page preload and safe
 * settings. Webviews with a non-web address are refused.
 */
export function hardenShell(
  shell: WebContents,
  pagePreloadPath: string,
  onAttach?: (record: AttachRecord) => void,
  noWebGL = false,
): void {
  shell.on('will-attach-webview', (event, webPreferences, params) => {
    const requestedPreload =
      lockDownWebPreferences(webPreferences, pagePreloadPath, noWebGL) ?? (params['preload'] || null);
    const src = params['src'] ?? '';
    // Web pages use the default session, or the private tabs' in-memory one.
    const partition = params['partition'] ?? '';
    const allowed =
      (isAllowedPageUrl(src) || isLocalHolomlUrl(src) || src === RESTORE_BLANK) && (partition === '' || partition === PRIVATE_PARTITION);
    if (!allowed) event.preventDefault();
    // A page that will take a closed page's history loads nothing first (milestone 10).
    else if (src === RESTORE_BLANK) params['src'] = '';
    onAttach?.({ requestedPreload, appliedPreload: pagePreloadPath, src, allowed });
  });
  shell.on('will-navigate', (event) => event.preventDefault());
  shell.setWindowOpenHandler(() => ({ action: 'deny' }));
}
