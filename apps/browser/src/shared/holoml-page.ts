/**
 * HoloML pages (milestone 14): what the page preload and the main process
 * say to each other. Only the page preload and the main process import
 * this file (the shell's preload must share no module with the page's).
 */

/** Sync: is this tab's document a HoloML page? (the document's address) -> boolean */
export const HOLOML_DOCUMENT_CHANNEL = 'hypersol:holoml-document';
/** A .holoml file dropped onto a page: open it in that tab (its path on disk). */
export const HOLOML_DROP_CHANNEL = 'hypersol:holoml-drop';
/** From a page's preload to the shell (sendToHost): this tab shows a HoloML page (its address). */
export const HOLOML_SHOWN_CHANNEL = 'hypersol-holoml-shown';

/** Where the viewer's script is served, to HoloML pages only by their content policy. */
export const VIEWER_SCHEME = 'hypersol-viewer';
export const VIEWER_ENTRY = `${VIEWER_SCHEME}://app/assets/viewer.js`;
/** HoloML files opened from the computer (owner, prompt 65, Q3 a). */
export const LOCAL_SCHEME = 'hypersol-file';
