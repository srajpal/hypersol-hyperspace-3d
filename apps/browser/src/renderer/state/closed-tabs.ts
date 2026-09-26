/**
 * Recently closed tabs, for "Reopen closed tab" (milestone 10). Memory
 * only, for this session; private tabs are never added.
 */

export interface ClosedTab {
  url: string;
  title: string;
  favicon?: string;
  /** Where it was in the tab list. */
  index: number;
  /** Its page, whose back and forward history the main process kept; null if it never had one. */
  from: number | null;
}

export const MAX_CLOSED = 25;

export class ClosedTabs {
  private readonly list: ClosedTab[] = [];

  get size(): number {
    return this.list.length;
  }

  /** Adds the tab just closed; the oldest goes beyond MAX_CLOSED. */
  push(tab: ClosedTab): void {
    this.list.push({ ...tab });
    if (this.list.length > MAX_CLOSED) this.list.shift();
  }

  /** The most recently closed tab, taken off the list. */
  pop(): ClosedTab | undefined {
    return this.list.pop();
  }
}
