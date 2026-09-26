import { LitElement, css, html, nothing } from 'lit';

export interface StripTab {
  id: number;
  title: string;
  favicon?: string;
  focused: boolean;
  private: boolean;
  audible: boolean;
  muted: boolean;
  asleep: boolean;
}

/** Height the list takes under the top bar, for the room's layout. */
export const STRIP_HEIGHT = 34;

/**
 * The list of tabs in the top bar (milestone 10): a row of small tabs
 * under it, shown when tabs are set to "Cards that hide" or "List in the
 * top bar". Each has its favicon, title, speaker, and close button; "+"
 * opens a tab.
 *
 * Events: hs-strip-focus, hs-strip-close, hs-strip-mute (detail: tab id), hs-new-tab.
 */
export class HsTabStrip extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    tabs: { attribute: false },
  };

  declare open: boolean;
  declare tabs: StripTab[];

  constructor() {
    super();
    this.open = false;
    this.tabs = [];
  }

  static override styles = css`
    :host {
      position: fixed;
      top: 58px;
      left: 24px;
      right: 24px;
      z-index: 19;
      height: 30px;
      display: none;
      color: var(--hs-text);
      font-size: 12px;
    }
    :host([open]) {
      display: block;
    }
    [role='tablist'] {
      display: flex;
      gap: 4px;
      height: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tab {
      flex: 0 1 180px;
      min-width: 90px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 4px 0 8px;
      border-radius: 8px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 25%, transparent);
      background: color-mix(in srgb, var(--hs-panel-glass) 85%, transparent);
      cursor: pointer;
    }
    .tab[aria-selected='true'] {
      border-color: var(--hs-accent);
      background: color-mix(in srgb, var(--hs-accent) 20%, var(--hs-panel-glass));
    }
    .tab[data-asleep] .title {
      color: var(--hs-text-muted);
      font-style: italic;
    }
    .tab[data-private] {
      border-color: var(--hs-accent2);
    }
    img,
    .dot {
      width: 14px;
      height: 14px;
      flex: none;
      border-radius: 3px;
    }
    .dot {
      background: color-mix(in srgb, var(--hs-accent) 40%, transparent);
    }
    .title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    button {
      flex: none;
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    button:hover {
      background: color-mix(in srgb, var(--hs-accent) 20%, transparent);
    }
    .tab:focus-visible,
    button:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 1px;
    }
    .plus {
      width: 30px;
      height: 30px;
      font-size: 16px;
      border: 1px dashed color-mix(in srgb, var(--hs-accent) 45%, transparent);
    }
  `;

  override render() {
    return html`<div role="tablist" aria-label="Tabs" data-testid="tab-strip">
      ${this.tabs.map((t) => this.tab(t))}
      <button class="plus" data-testid="strip-new" aria-label="New tab" title="New tab" @click=${() => this.fire('hs-new-tab')}>+</button>
    </div>`;
  }

  private tab(t: StripTab) {
    const title = t.title || 'Untitled';
    return html`<div
      class="tab"
      role="tab"
      tabindex="0"
      data-testid="strip-tab"
      data-id=${t.id}
      aria-selected=${t.focused ? 'true' : 'false'}
      ?data-asleep=${t.asleep}
      ?data-private=${t.private}
      title=${`${title}${t.asleep ? ' (asleep)' : ''}${t.private ? ' (private)' : ''}`}
      @click=${() => this.fire('hs-strip-focus', t.id)}
      @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && this.fire('hs-strip-focus', t.id)}
    >
      ${t.favicon ? html`<img src=${t.favicon} alt="" />` : html`<span class="dot"></span>`}
      <span class="title">${title}</span>
      ${t.audible || t.muted
        ? html`<button data-testid="strip-mute" aria-label=${`${t.muted ? 'Unmute' : 'Mute'} ${title}`} title=${t.muted ? 'Unmute' : 'Mute'}
            @click=${(e: Event) => {
              e.stopPropagation();
              this.fire('hs-strip-mute', t.id);
            }}>${t.muted ? '🔇' : '🔊'}</button>`
        : nothing}
      <button data-testid="strip-close" aria-label=${`Close ${title}`} title="Close tab"
        @click=${(e: Event) => {
          e.stopPropagation();
          this.fire('hs-strip-close', t.id);
        }}>×</button>
    </div>`;
  }

  private fire(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

customElements.define('hs-tab-strip', HsTabStrip);

declare global {
  interface HTMLElementTagNameMap {
    'hs-tab-strip': HsTabStrip;
  }
}
