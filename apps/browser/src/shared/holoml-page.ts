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
/** From a page's preload to the shell: the scene's state ({ busy?, textView? }), milestone 15. */
export const HOLOML_STATE_CHANNEL = 'hypersol-holoml-state';
/**
 * From the shell to a HoloML page: 'stop', 'text-view-on', or 'text-view-off'
 * (milestone 15); 'behind' and 'in-front', as its tab goes behind another and
 * comes to the front again (milestone 21: a page behind draws no frames).
 * From the main process (main/inspect), for the instrument panel's Scene
 * part: 'select:<index>' chooses a thing, 'pick-on' and 'pick-off' switch
 * picking (review of 2026-09-30, D12: before, both were executeJavaScript
 * calls on the page's window). The page's preload passes each on to the
 * viewer over their private line; nothing on the page's window acts.
 */
export const HOLOML_COMMAND_CHANNEL = 'hypersol:holoml-command';

/** Where the viewer's script is served, to HoloML pages only by their content policy. */
export const VIEWER_SCHEME = 'hypersol-viewer';
export const VIEWER_ENTRY = `${VIEWER_SCHEME}://app/assets/viewer.js`;
/** HoloML files opened from the computer (owner, prompt 65, Q3 a). */
export const LOCAL_SCHEME = 'hypersol-file';
