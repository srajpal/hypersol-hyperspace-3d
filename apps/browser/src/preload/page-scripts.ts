/**
 * The ad blocker's page scripts (GitHub issue #133), the page side: asks the
 * main process for the filter lists' scripts for this page, waits for the
 * answer, and runs them in the page before any of the page's own scripts,
 * with no user gesture (main/privacy/cosmetics.ts says why). In the top
 * frame only, as the library's own page script asks there alone. Nothing is
 * exposed to the page.
 */
import { ipcRenderer, webFrame } from 'electron';
import { PAGE_SCRIPTS_CHANNEL } from '../shared/page-scripts';

if (window === window.top && !location.href.startsWith('devtools://')) {
  const scripts: unknown = ipcRenderer.sendSync(PAGE_SCRIPTS_CHANNEL);
  if (Array.isArray(scripts)) {
    for (const script of scripts) {
      // A script that fails on a page is the list's matter.
      if (typeof script === 'string') webFrame.executeJavaScript(script, false).catch(() => undefined);
    }
  }
}
