import type { WebContents, WebPreferences } from 'electron';
import { PRIVATE_PARTITION, RESTORE_BLANK } from '../shared/commands';
import { LOCAL_SCHEME } from '../shared/holoml-page';

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
