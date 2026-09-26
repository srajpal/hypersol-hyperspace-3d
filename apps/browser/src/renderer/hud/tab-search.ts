import { LitElement, css, html, nothing } from 'lit';
import type { StripTab } from './tab-strip';

export interface SearchTab extends StripTab {
  url: string;
}

/** The tabs whose title or address contains the text (any case). */
export function filterTabs<T extends { title: string; url: string }>(tabs: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...tabs];
  return tabs.filter((t) => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q));
}

/**
 * Search tabs (milestone 10): Ctrl/Cmd+Shift+A or the menu. Lists every
 * tab (title, site, sound, asleep); typing filters it, the arrow keys
 * move, Enter switches to the tab, and each has a close button. Escape or
 * a click elsewhere closes it.
 *
 * Events: hs-tab-pick, hs-tab-close (detail: tab id), hs-tab-search-closed.
 */
export class HsTabSearch extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    tabs: { attribute: false },
    query: { state: true },
    active: { state: true },
  };

  declare open: boolean;
  declare tabs: SearchTab[];
  declare query: string;
  declare active: number;

  constructor() {
    super();
    this.open = false;
    this.tabs = [];
    this.query = '';
    this.active = 0;
  }

  static override styles = css`
    :host {
      position: fixed;
      top: 62px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 21;
      width: min(520px, calc(100vw - 48px));
      display: none;
      color: var(--hs-text);
      font-size: 14px;
    }
    :host([open]) {
      display: block;
    }
    section {
      padding: 10px;
      border-radius: 12px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 55%, transparent);
      background: color-mix(in srgb, var(--hs-panel-glass) 97%, transparent);
      box-shadow: 0 12px 36px var(--hs-shadow);
    }
    input {
      box-sizing: border-box;
      width: 100%;
      height: 34px;
      padding: 0 12px;
      border-radius: 8px;
      border: 1px solid var(--hs-accent);
      background: color-mix(in srgb, var(--hs-background-bottom) 60%, transparent);
      color: inherit;
      font: inherit;
    }
    input:focus {
      outline: none;
    }
    ul {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
      max-height: min(420px, 60vh);
      overflow: auto;
    }
    li {
      display: grid;
      grid-template-columns: 18px 1fr auto auto;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 8px;
      cursor: pointer;
    }
    li[aria-selected='true'] {
      background: color-mix(in srgb, var(--hs-accent) 22%, transparent);
    }
    img,
    .dot {
      width: 16px;
      height: 16px;
      border-radius: 3px;
    }
    .dot {
      background: color-mix(in srgb, var(--hs-accent) 40%, transparent);
    }
    .text {
      min-width: 0;
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
    .marks {
      font-size: 11px;
      color: var(--hs-text-muted);
      white-space: nowrap;
    }
    button {
      border: 0;
      border-radius: 6px;
      width: 24px;
      height: 24px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    button:hover {
      background: color-mix(in srgb, var(--hs-accent) 20%, transparent);
    }
    .empty {
      margin: 10px 4px 2px;
      color: var(--hs-text-muted);
    }
  `;

  show(): void {
    this.query = '';
    this.active = Math.max(0, this.tabs.findIndex((t) => t.focused));
    this.open = true;
    void this.updateComplete.then(() => (this.renderRoot.querySelector('input') as HTMLInputElement | null)?.focus());
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('hs-tab-search-closed', { bubbles: true, composed: true }));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onOutside);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.onOutside);
  }

  private get shown(): SearchTab[] {
    return filterTabs(this.tabs, this.query);
  }

  override render() {
    const shown = this.shown;
    const active = Math.min(this.active, Math.max(0, shown.length - 1));
    return html`<section role="dialog" aria-label="Search tabs" data-testid="tab-search">
      <input
        type="search"
        data-testid="tab-search-input"
        aria-label="Search tabs"
        placeholder="Search tabs"
        role="combobox"
        aria-expanded="true"
        aria-controls="tab-results"
        .value=${this.query}
        @input=${(e: Event) => {
          this.query = (e.target as HTMLInputElement).value;
          this.active = 0;
        }}
        @keydown=${this.onKey}
      />
      ${shown.length === 0
        ? html`<p class="empty" data-testid="tab-search-empty">No tab matches.</p>`
        : html`<ul id="tab-results" role="listbox" aria-label="Tabs">
            ${shown.map(
              (t, i) => html`<li
                role="option"
                data-testid="tab-search-item"
                data-id=${t.id}
                aria-selected=${i === active ? 'true' : 'false'}
                @click=${() => this.pick(t.id)}
              >
                ${t.favicon ? html`<img src=${t.favicon} alt="" />` : html`<span class="dot"></span>`}
                <span class="text"><div class="title">${t.title || 'Untitled'}</div><div class="url">${t.url || 'New tab'}</div></span>
                <span class="marks">${[t.focused ? 'showing' : '', t.audible && !t.muted ? 'sound' : '', t.muted ? 'muted' : '', t.asleep ? 'asleep' : '', t.private ? 'private' : '']
                  .filter(Boolean)
                  .join(' · ')}</span>
                <button data-testid="tab-search-close" aria-label=${`Close ${t.title}`}
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    this.dispatchEvent(new CustomEvent('hs-tab-close', { detail: t.id, bubbles: true, composed: true }));
                  }}>×</button>
              </li>`,
            )}
          </ul>`}
      ${nothing}
    </section>`;
  }

  private pick(id: number): void {
    this.close();
    this.dispatchEvent(new CustomEvent('hs-tab-pick', { detail: id, bubbles: true, composed: true }));
  }

  private readonly onKey = (e: KeyboardEvent) => {
    const shown = this.shown;
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active = Math.min(shown.length - 1, this.active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active = Math.max(0, this.active - 1);
    } else if (e.key === 'Enter') {
      const t = shown[Math.min(this.active, shown.length - 1)];
      if (t) this.pick(t.id);
    }
  };

  private readonly onOutside = (e: PointerEvent) => {
    if (this.open && !e.composedPath().includes(this)) this.close();
  };
}

customElements.define('hs-tab-search', HsTabSearch);

declare global {
  interface HTMLElementTagNameMap {
    'hs-tab-search': HsTabSearch;
  }
}
