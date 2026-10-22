import type { IpcMainInvokeEvent } from 'electron';
import type { ElectronBlocker } from '@ghostery/adblocker-electron';

/**
 * The blocker's page scripts, and what its library is given in place of the
 * page's own request (GitHub issue #133).
 *
 * The library's page script asks for a page's styles and scripts as the page
 * starts, but does not wait for the answer, and its onInjectCosmeticFilters
 * runs each script with `sender.executeJavaScript(script, true)`: a web
 * page's executeJavaScript waits for the whole page to have loaded (with a
 * did-stop-loading listener for each script; YouTube's thirty went past
 * Node's warning at ten), all in one realm, with a user gesture, and its
 * failures uncaught. So:
 *
 * - The scripts go to our page preload, which asks for them and waits
 *   (pageScripts, preload/page-scripts.ts) and runs them before any of the
 *   page's own: run as soon as an answer came, a fast page's code could
 *   still run first (BS1 in GitHub's Windows builds).
 * - Each in a block of its own: the lists' scripts run in one realm, and
 *   several declare the same class at their top level (four of YouTube's,
 *   `class JSONPath`), so every one after the first failed to run at all.
 *   In a block such a declaration is the block's own; a `var` and a
 *   function still reach the page's global scope, as the scripts mean.
 * - With no user gesture: a script has no need of one, and it would let the
 *   page act as if clicked (full screen, a new window).
 * - The library's own request then puts in styles alone (cosmeticsRequest):
 *   its first brings the same scripts again, and later ones none.
 */
export function cosmeticsRequest(event: IpcMainInvokeEvent): IpcMainInvokeEvent {
  const sender = {
    insertCSS: (css: string, options?: Electron.InsertCSSOptions) => (event.sender.isDestroyed() ? Promise.resolve('') : event.sender.insertCSS(css, options).catch(() => '')),
    executeJavaScript: () => Promise.resolve(undefined),
  };
  return { frameId: event.frameId, processId: event.processId, sender } as unknown as IpcMainInvokeEvent;
}

/**
 * A page's scripts from the lists, each in a block of its own, for the page
 * preload to run. The library's onInjectCosmeticFilters is asked as for a
 * page's first request; it hands over every script before its first await,
 * so they are all here when it returns. Styles are left to the library's own
 * request.
 */
export function pageScripts(engine: Pick<ElectronBlocker, 'onInjectCosmeticFilters'>, ids: { frameId: number; processId: number }, page: string): string[] {
  const scripts: string[] = [];
  const sender = {
    insertCSS: () => Promise.resolve(''),
    executeJavaScript: (code: string) => {
      scripts.push(inBlock(code));
      return Promise.resolve(undefined);
    },
  };
  const request = { ...ids, sender } as unknown as IpcMainInvokeEvent;
  void engine.onInjectCosmeticFilters(request, page, undefined).catch(() => undefined);
  return scripts;
}

/** A page script in a block of its own. */
export function inBlock(code: string): string {
  return `{\n${code}\n}`;
}
