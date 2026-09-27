/**
 * What a page's preload tells the shell about the page (milestone 10):
 * whether a form has text typed into it and not sent, and whether the page
 * is capturing from the camera, microphone, or screen (GitHub issue #18),
 * so its tab is not put to sleep. Sent with sendToHost; only the shell
 * sees it.
 */
export const PAGE_STATE_CHANNEL = 'hypersol:page-state';
/** From the main process to a page: stop capturing these track kinds ('audio', 'video'); issue #22. */
export const CAPTURE_STOP_CHANNEL = 'hypersol:capture-stop';

export interface PageState {
  typed: boolean;
  capturing: boolean;
}

export function parsePageState(raw: unknown): PageState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const typed = (raw as Record<string, unknown>)['typed'];
  const capturing = (raw as Record<string, unknown>)['capturing'] ?? false;
  return typeof typed === 'boolean' && typeof capturing === 'boolean' ? { typed, capturing } : null;
}
