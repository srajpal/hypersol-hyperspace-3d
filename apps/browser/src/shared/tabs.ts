/**
 * Tab requests from the shell (milestone 10): putting a tab's back and
 * forward history into a new page, for a reopened tab and for a sleeping
 * tab that wakes. The main process keeps each page's history while it is
 * open and for a while after it closes (memory only).
 */

export const TABS_CHANNEL = 'hypersol:tabs';

export type TabsRequest = { op: 'restore'; tab: number; from: number };

export interface TabsResults {
  /** False when there was no history to restore (the shell then loads the address). */
  restore: boolean;
}

export type TabsOp = TabsRequest['op'];
export type TabsReply<K extends TabsOp> = { ok: true; value: TabsResults[K] } | { ok: false; error: string };

export function parseTabsRequest(raw: unknown): { request: TabsRequest } | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'Not a request' };
  const r = raw as Record<string, unknown>;
  const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1;
  if (r['op'] !== 'restore') return { error: `Unknown request: ${String(r['op'])}` };
  if (!isId(r['tab']) || !isId(r['from'])) return { error: 'restore: tab and from must be page ids' };
  return { request: { op: 'restore', tab: r['tab'], from: r['from'] } };
}

/** How many closed or sleeping pages' histories are kept. */
export const KEPT_HISTORIES = 60;
