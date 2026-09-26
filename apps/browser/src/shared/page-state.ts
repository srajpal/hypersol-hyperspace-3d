/**
 * What a page's preload tells the shell about the page (milestone 10):
 * whether a form has text typed into it, so its tab is not put to sleep
 * and the text lost. Sent with sendToHost; only the shell sees it.
 */
export const PAGE_STATE_CHANNEL = 'hypersol:page-state';

export interface PageState {
  typed: boolean;
}

export function parsePageState(raw: unknown): PageState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const typed = (raw as Record<string, unknown>)['typed'];
  return typeof typed === 'boolean' ? { typed } : null;
}
