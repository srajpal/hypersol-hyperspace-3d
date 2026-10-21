import type { IpcMainInvokeEvent } from 'electron';

/**
 * What the blocker's library is given in place of the page's own request
 * (GitHub issue #133). Its onInjectCosmeticFilters reads only the request's
 * frameId and processId, and puts styles and page scripts in through
 * `sender.insertCSS` and `sender.executeJavaScript(script, true)`; this
 * keeps the first two and runs the scripts differently:
 *
 * - In the frame that asked, not the page's top frame, and at once: a
 *   web page's executeJavaScript waits for the whole page to have loaded,
 *   with a did-stop-loading listener for each script (YouTube's thirty
 *   went past Node's warning at ten).
 * - Each in a block of its own: the lists' scripts run in one realm, and
 *   several declare the same class at their top level (four of YouTube's,
 *   `class JSONPath`), so every one after the first failed to run at all.
 *   In a block such a declaration is the block's own; a `var` and a
 *   function still reach the page's global scope, as the scripts mean.
 * - With no user gesture: a script has no need of one, and it would let the
 *   page act as if clicked (full screen, a new window) after its load.
 * - Its failures caught: a script that fails on a page is the list's
 *   matter, and an uncaught one was an unhandled rejection in the main
 *   process.
 */
export function cosmeticsRequest(event: IpcMainInvokeEvent): IpcMainInvokeEvent {
  const frame = event.senderFrame;
  const sender = {
    insertCSS: (css: string, options?: Electron.InsertCSSOptions) => (event.sender.isDestroyed() ? Promise.resolve('') : event.sender.insertCSS(css, options).catch(() => '')),
    executeJavaScript: (code: string) => (frame && !frame.isDestroyed() ? frame.executeJavaScript(inBlock(code), false).catch(() => undefined) : Promise.resolve(undefined)),
  };
  return { frameId: event.frameId, processId: event.processId, sender } as unknown as IpcMainInvokeEvent;
}

/** A page script in a block of its own. */
export function inBlock(code: string): string {
  return `{\n${code}\n}`;
}
