import { LitElement, css, html, nothing } from 'lit';
import type { Bookmark, HistoryEntry } from '../../shared/data';
import type { SavedLogin } from '../../shared/passwords';
import { groupByDay, type DataClient, type PasswordsClient } from '../data';
import { panelStyles } from './panel-styles';
import { siteName } from './prompts';

type View = 'bookmarks' | 'history' | 'passwords';

/**
 * The Library panel: bookmarks, history, and saved passwords (milestone
 * 9: search, show, copy, delete, and the sites never to save for; owner,
 * prompt 38, Q2 a). Slides in from the right; Escape or the close button
 * closes it.
 *
 * Events: hs-open-url (detail: address), hs-panel-closed.
 */
/** How long typing in the history search box pauses before a search starts. */
export const SEARCH_PAUSE_MS = 200;

export class HsLibrary extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    view: { state: true },
    query: { state: true },
    loading: { state: true },
    error: { state: true },
    bookmarks: { state: true },
    history: { state: true },
    confirming: { state: true },
    logins: { state: true },
    never: { state: true },
    revealed: { state: true },
    note: { state: true },
  };

  declare open: boolean;
  declare view: View;
  declare query: string;
  declare loading: boolean;
  declare error: string;
  declare bookmarks: Bookmark[];
  declare history: HistoryEntry[];
  declare confirming: boolean;
  declare logins: SavedLogin[];
  /** Sites where passwords are never saved. */
  declare never: string[];
  /** Passwords shown with Show, by saved sign-in id; forgotten when the panel closes. */
  declare revealed: Record<number, string>;
  /** A passing message on the Passwords tab (copied; why passwords can't be saved). */
  declare note: string;
  client: DataClient | null = null;
  passwords: PasswordsClient | null = null;
  private request = 0;
  /** A refresh is running; another was asked for meanwhile. */
  private running = false;
  private again = false;
  private searchTimer: number | undefined;
  /**
   * Test runs only (renderer/main.ts switches it on): when the history
   * search box was typed in and when a search started, on the shell's own
   * clock, the last hundred. A check can then see that searches start
   * only once typing has paused, however fast or slowly the keys came.
   */
  keepSearchTimes = false;
  readonly searchTimes: { at: number; what: 'typed' | 'searched' }[] = [];

  constructor() {
    super();
    this.open = false;
    this.view = 'bookmarks';
    this.query = '';
    this.loading = false;
    this.error = '';
    this.bookmarks = [];
    this.history = [];
    this.confirming = false;
    this.logins = [];
    this.never = [];
    this.revealed = {};
    this.note = '';
  }

  static override styles = [
    panelStyles,
    css`
      [role='tablist'] {
        display: flex;
        gap: 6px;
        margin-bottom: 10px;
      }
      [role='tab'][aria-selected='true'] {
        background: color-mix(in srgb, var(--hs-accent) 25%, transparent);
      }
      input[type='search'] {
        box-sizing: border-box;
        width: 100%;
        height: 34px;
        padding: 0 12px;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, var(--hs-text-muted) 60%, transparent);
        background: color-mix(in srgb, var(--hs-background-bottom) 60%, transparent);
      }
      .list {
        flex: 1;
        overflow: auto;
        margin-top: 6px;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .item {
        flex: 1;
        min-width: 0;
        display: grid;
        grid-template-columns: 20px 1fr;
        column-gap: 10px;
        align-items: center;
        border: 0;
        text-align: left;
        padding: 7px 8px;
      }
      .item img,
      .item .dot {
        width: 16px;
        height: 16px;
        grid-row: span 2;
        border-radius: 3px;
      }
      .item .dot {
        background: color-mix(in srgb, var(--hs-accent) 40%, transparent);
      }
      .title,
      .url {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .url {
        font-size: 12px;
        color: var(--hs-text-muted);
      }
      footer {
        margin-top: 10px;
      }
      .login {
        flex: 1;
        min-width: 0;
        padding: 7px 8px;
      }
      .login .secret {
        font-family: var(--hs-font-mono);
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      .tag {
        margin-left: 6px;
        font-size: 11px;
        color: var(--hs-warning);
      }
      .small {
        padding: 3px 8px;
        font-size: 12px;
      }
    `,
  ];

  /** Opens the panel on a view and loads it. */
  show(view: View = this.view): void {
    this.view = view;
    this.open = true;
    this.confirming = false;
    void this.refresh();
    void this.updateComplete.then(() => (this.renderRoot.querySelector('input') as HTMLInputElement | null)?.focus());
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.confirming = false;
    this.revealed = {};
    this.note = '';
    this.dispatchEvent(new CustomEvent('hs-panel-closed', { bubbles: true, composed: true }));
  }

  /**
   * Reloads the current view (also called when saved data changes).
   * Requests made while one is running are merged into a single follow-up,
   * and a reply that a newer request has overtaken is dropped (GitHub
   * issue #4).
   */
  async refresh(): Promise<void> {
    if (!this.open || !this.client) return;
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.again = false;
        await this.load();
      } while (this.again && this.open);
    } finally {
      this.running = false;
    }
  }

  private async load(): Promise<void> {
    if (!this.client) return;
    const ticket = ++this.request;
    this.loading = true;
    // A search is noted as it starts, before the first answer is waited for: a key typed
    // meanwhile must not read as the search coming too soon after it (pull request #48).
    if (this.view === 'history') this.noteSearch('searched');
    try {
      const status = await this.client.get({ op: 'status' });
      if (!status.available) throw new Error(status.message ?? "Couldn't open your saved data");
      if (this.view === 'bookmarks') {
        const all = await this.client.get({ op: 'bookmarks.list' });
        if (ticket !== this.request) return;
        this.bookmarks = all;
      } else if (this.view === 'passwords') {
        if (!this.passwords) throw new Error('Passwords are not available');
        const [status, logins, never] = await Promise.all([
          this.passwords.get({ op: 'status' }),
          this.passwords.get({ op: 'list' }),
          this.passwords.get({ op: 'never.list' }),
        ]);
        if (ticket !== this.request) return;
        this.logins = logins;
        this.never = never;
        if (!status.available) this.note = status.message ?? '';
      } else {
        const found = await this.client.get({ op: 'history.search', query: this.query, limit: 500 });
        if (ticket !== this.request) return;
        this.history = found;
      }
      this.error = '';
    } catch (e) {
      if (ticket !== this.request) return;
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      if (ticket === this.request) this.loading = false;
    }
  }

  override render() {
    return html`
      <section role="dialog" aria-label="Library" data-testid="library" @keydown=${this.onKey}>
        <header>
          <h2>Library</h2>
          <button class="icon-button" aria-label="Close Library" data-testid="library-close" @click=${() => this.close()}>
            ×
          </button>
        </header>
        <div role="tablist" aria-label="Library views">
          ${this.tab('bookmarks', 'Bookmarks')} ${this.tab('history', 'History')} ${this.tab('passwords', 'Passwords')}
        </div>
        <input
          type="search"
          data-testid="lib-search"
          aria-label=${`Search ${this.view}`}
          placeholder=${`Search ${this.view}`}
          .value=${this.query}
          @input=${this.onSearch}
        />
        <div class="list" data-testid="lib-list">${this.body()}</div>
        ${this.view === 'history' && !this.error ? this.footer() : nothing}
      </section>
    `;
  }

  private tab(view: View, label: string) {
    return html`<button
      role="tab"
      data-testid=${`lib-tab-${view}`}
      aria-selected=${this.view === view ? 'true' : 'false'}
      @click=${() => {
        // A new tab starts with an empty search (milestone 11, owner feedback).
        if (this.view !== view) this.query = '';
        this.view = view;
        this.confirming = false;
        this.note = '';
        void this.refresh();
      }}
    >
      ${label}
    </button>`;
  }

  private body() {
    if (this.error) return html`<p class="error" data-testid="lib-error" role="alert">${this.error}</p>`;
    if (this.loading && this.items().length === 0) return html`<p class="muted">Loading…</p>`;
    if (this.view === 'bookmarks') {
      const shown = this.filteredBookmarks();
      if (shown.length === 0) return this.empty('Pages you bookmark will show up here. Use the star or Ctrl+D.');
      return html`<ul>
        ${shown.map(
          (b) => html`<li>
            ${this.item(b.url, b.title, b.favicon)}
            <button
              class="icon-button"
              data-testid="lib-remove"
              aria-label=${`Remove bookmark ${b.title}`}
              @click=${() => this.removeBookmark(b.url)}
            >
              ×
            </button>
          </li>`,
        )}
      </ul>`;
    }
    if (this.view === 'passwords') return this.passwordsBody();
    if (this.history.length === 0) return this.empty('Pages you visit will show up here.');
    return groupByDay(this.history).map(
      (g) => html`<h3>${g.label}</h3>
        <ul>
          ${g.items.map(
            (h) => html`<li>
              ${this.item(h.url, h.title, null, h.visitedAt)}
              <button
                class="icon-button"
                data-testid="lib-delete"
                aria-label=${`Delete ${h.title} from history`}
                @click=${() => this.deleteVisit(h.id)}
              >
                ×
              </button>
            </li>`,
          )}
        </ul>`,
    );
  }

  private item(url: string, title: string, favicon: string | null, time?: number) {
    const when = time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return html`<button class="item" data-testid="lib-item" title=${url} @click=${() => this.openUrl(url)}>
      ${favicon ? html`<img src=${favicon} alt="" />` : html`<span class="dot"></span>`}
      <span class="title">${title || url}</span>
      <span class="url">${when ? `${when} · ` : ''}${url}</span>
    </button>`;
  }

  private empty(hint: string) {
    return html`<p class="empty" data-testid="lib-empty">${this.query ? 'Nothing found' : 'Nothing saved yet'}</p>
      <p class="muted">${this.query ? 'Try other words.' : hint}</p>`;
  }

  private footer() {
    if (this.history.length === 0 && !this.confirming) return nothing;
    return html`<footer>
      ${this.confirming
        ? html`<div class="confirm" role="alertdialog" aria-label="Clear all history">
            <p>Clear all history? This can't be undone.</p>
            <button class="danger" data-testid="lib-clear-confirm" @click=${this.clearAll}>Clear</button>
            <button data-testid="lib-clear-cancel" @click=${() => (this.confirming = false)}>Cancel</button>
          </div>`
        : html`<button class="danger" data-testid="lib-clear" @click=${() => (this.confirming = true)}>
            Clear all history
          </button>`}
    </footer>`;
  }

  private passwordsBody() {
    const q = this.query.trim().toLowerCase();
    const shown = q
      ? this.logins.filter((l) => l.origin.toLowerCase().includes(q) || l.username.toLowerCase().includes(q))
      : this.logins;
    return html`${this.note ? html`<p class="muted" role="status" data-testid="pw-note">${this.note}</p>` : nothing}
      ${shown.length === 0
        ? this.empty('Passwords you save when signing in will show up here. Only you can see them on this computer.')
        : html`<ul>
            ${shown.map((l) => this.loginRow(l))}
          </ul>`}
      ${this.never.length > 0 && !q
        ? html`<h3>Never saved for</h3>
            <ul>
              ${this.never.map(
                (origin) => html`<li>
                  <span class="login" data-testid="pw-never-item">${siteName(origin)}</span>
                  <button class="icon-button" data-testid="pw-never-remove" aria-label=${`Allow saving on ${siteName(origin)} again`}
                    @click=${() => this.act(() => this.passwords!.get({ op: 'never.remove', origin }))}>×</button>
                </li>`,
              )}
            </ul>`
        : nothing}`;
  }

  private loginRow(l: SavedLogin) {
    const shownPassword = this.revealed[l.id];
    return html`<li data-testid="pw-item">
      <div class="login">
        <div class="title">${siteName(l.origin)}${l.origin.startsWith('http:') ? html`<span class="tag">not secure</span>` : nothing}</div>
        <div class="url" data-testid="pw-username">${l.username || '(no user name)'}</div>
        ${shownPassword !== undefined ? html`<div class="secret" data-testid="pw-value">${shownPassword}</div>` : nothing}
      </div>
      <button class="small" data-testid="pw-reveal" aria-label=${`${shownPassword === undefined ? 'Show' : 'Hide'} the password for ${l.username} on ${siteName(l.origin)}`}
        @click=${() => this.toggleReveal(l.id)}>${shownPassword === undefined ? 'Show' : 'Hide'}</button>
      <button class="small" data-testid="pw-copy" aria-label=${`Copy the password for ${l.username} on ${siteName(l.origin)}`}
        @click=${() => this.copy(l.id)}>Copy</button>
      <button class="icon-button" data-testid="pw-delete" aria-label=${`Delete the saved password for ${l.username} on ${siteName(l.origin)}`}
        @click=${() => this.act(() => this.passwords!.get({ op: 'delete', id: l.id }))}>×</button>
    </li>`;
  }

  private async toggleReveal(id: number): Promise<void> {
    if (this.revealed[id] !== undefined) {
      this.revealed = Object.fromEntries(Object.entries(this.revealed).filter(([key]) => Number(key) !== id));
      return;
    }
    try {
      const password = await this.passwords!.get({ op: 'reveal', id });
      this.revealed = { ...this.revealed, [id]: password };
    } catch (e) {
      this.note = e instanceof Error ? e.message : String(e);
    }
  }

  private async copy(id: number): Promise<void> {
    try {
      await this.passwords!.get({ op: 'copy', id });
      this.note = 'Password copied.';
    } catch (e) {
      this.note = e instanceof Error ? e.message : String(e);
    }
  }

  private items(): unknown[] {
    return this.view === 'bookmarks' ? this.bookmarks : this.view === 'passwords' ? this.logins : this.history;
  }

  private filteredBookmarks(): Bookmark[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.bookmarks;
    return this.bookmarks.filter((b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q));
  }

  /** History searches wait until typing pauses for SEARCH_PAUSE_MS. */
  private readonly onSearch = (e: Event) => {
    this.query = (e.target as HTMLInputElement).value;
    if (this.view !== 'history') return;
    this.noteSearch('typed');
    window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => void this.refresh(), SEARCH_PAUSE_MS);
  };

  private noteSearch(what: 'typed' | 'searched'): void {
    if (!this.keepSearchTimes) return;
    this.searchTimes.push({ at: performance.now(), what });
    if (this.searchTimes.length > 100) this.searchTimes.shift();
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (this.confirming) this.confirming = false;
      else this.close();
    }
  };

  private readonly clearAll = async () => {
    this.confirming = false;
    await this.act(() => this.client!.get({ op: 'history.clear' }));
  };

  private async removeBookmark(url: string): Promise<void> {
    await this.act(() => this.client!.get({ op: 'bookmarks.remove', url }));
  }

  private async deleteVisit(id: number): Promise<void> {
    await this.act(() => this.client!.get({ op: 'history.delete', id }));
  }

  private async act(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
    await this.refresh();
  }

  private openUrl(url: string): void {
    this.dispatchEvent(new CustomEvent('hs-open-url', { detail: url, bubbles: true, composed: true }));
  }
}

customElements.define('hs-library', HsLibrary);

declare global {
  interface HTMLElementTagNameMap {
    'hs-library': HsLibrary;
  }
}
