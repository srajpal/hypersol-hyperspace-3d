/**
 * The tab list and which tab is focused. Pure data: the shell's
 * controller turns changes here into pages, cards, and HUD updates.
 */

export type TabState = 'start' | 'loading' | 'loaded' | 'failed' | 'crashed';

export interface Tab {
  id: number;
  /** Address shown for the tab; '' for a start tab. */
  url: string;
  title: string;
  state: TabState;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Favicon as a data: URL, when the page has one. */
  favicon?: string;
  /** A private tab (milestone 8): its own in-memory session, nothing kept. */
  private: boolean;
  /** Milestone 10: its page makes sound; the tab is muted; the tab is asleep (its page closed until opened). */
  audible: boolean;
  muted: boolean;
  asleep: boolean;
  /** A reopened tab: the closed page whose back and forward history it gets. */
  restoreFrom?: number;
}

export interface OpenOptions {
  url?: string;
  /** Open behind the focused tab instead of in front. */
  background?: boolean;
  /** Put the new tab right after this one (the tab that opened it). */
  afterId?: number;
  /** Open a private tab. */
  private?: boolean;
  /** Put the new tab at this place in the list (a reopened tab goes back where it was). */
  index?: number;
  /** Milestone 10: a reopened tab's title, favicon, and the closed page to take its history from. */
  title?: string;
  favicon?: string;
  restoreFrom?: number;
}

export type TabsListener = (tabs: TabStore) => void;

export class TabStore {
  private list: Tab[] = [];
  private focused = -1;
  private nextId = 1;
  private readonly listeners = new Set<TabsListener>();
  /** Called as a tab closes, with where it was, before the change is announced (reopening, milestone 10). */
  onClosed: ((tab: Tab, index: number) => void) | null = null;

  get tabs(): readonly Tab[] {
    return this.list;
  }

  get focusedId(): number {
    return this.focused;
  }

  get focusedTab(): Tab | undefined {
    return this.get(this.focused);
  }

  get(id: number): Tab | undefined {
    return this.list.find((t) => t.id === id);
  }

  indexOf(id: number): number {
    return this.list.findIndex((t) => t.id === id);
  }

  subscribe(listener: TabsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Opens a tab and returns it. A tab without an address is a start tab. */
  open(options: OpenOptions = {}): Tab {
    const url = options.url ?? '';
    const tab: Tab = {
      id: this.nextId++,
      url,
      title: options.title ?? (url === '' ? 'New tab' : url),
      state: url === '' ? 'start' : 'loading',
      canGoBack: false,
      canGoForward: false,
      private: options.private ?? false,
      audible: false,
      muted: false,
      asleep: false,
      ...(options.favicon ? { favicon: options.favicon } : {}),
      ...(options.restoreFrom !== undefined ? { restoreFrom: options.restoreFrom } : {}),
    };
    const after = options.afterId === undefined ? -1 : this.indexOf(options.afterId);
    if (options.index !== undefined) {
      this.list.splice(Math.max(0, Math.min(options.index, this.list.length)), 0, tab);
    } else if (after >= 0) {
      this.list.splice(after + 1, 0, tab);
    } else {
      this.list.push(tab);
    }
    if (!options.background || this.focused === -1) this.focused = tab.id;
    this.emit();
    return tab;
  }

  focus(id: number): void {
    if (id === this.focused || !this.get(id)) return;
    this.focused = id;
    this.emit();
  }

  /**
   * Closes a tab. Focus moves to the tab on the right, or the left if it
   * was last. Closing the only tab leaves a fresh start tab, so the
   * window always has a page.
   */
  close(id: number): void {
    const i = this.indexOf(id);
    if (i === -1) return;
    const [closed] = this.list.splice(i, 1);
    this.onClosed?.(closed!, i);
    if (this.list.length === 0) {
      this.focused = -1;
      this.open();
      return;
    }
    if (this.focused === id) {
      this.focused = (this.list[i] ?? this.list[i - 1])!.id;
    }
    this.emit();
  }

  /** Focuses the next tab (or previous with step -1), wrapping around. */
  cycle(step: 1 | -1): void {
    if (this.list.length < 2) return;
    const i = this.indexOf(this.focused);
    const next = (i + step + this.list.length) % this.list.length;
    this.focus(this.list[next]!.id);
  }

  update(id: number, changes: Partial<Omit<Tab, 'id'>>): void {
    const tab = this.get(id);
    if (!tab) return;
    let changed = false;
    for (const [key, value] of Object.entries(changes) as [keyof Tab, unknown][]) {
      if (tab[key] !== value) {
        (tab as unknown as Record<string, unknown>)[key] = value;
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this);
  }
}
