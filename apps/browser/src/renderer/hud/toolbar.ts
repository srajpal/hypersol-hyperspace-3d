import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { PERMISSION_LABELS, type PermissionKind } from '../../shared/permissions';

export type MenuAction = 'new-tab' | 'private-tab' | 'close-tab' | 'downloads' | 'print' | 'library' | 'settings' | 'about';

const icon = {
  gauge: html`<svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4.5 17a8.5 8.5 0 1 1 15 0" /><path d="M12 13.5l4-4.5" /><circle cx="12" cy="14" r="1.3" />
  </svg>`,
  plus: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>`,
  back: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>`,
  forward: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>`,
  reload: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4" /></svg>`,
  menu: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6h.01M12 12h.01M12 18h.01" /></svg>`,
  layers: html`<svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 17 9 5 9-5" />
  </svg>`,
  chevron: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg>`,
  lock: html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>`,
  open: html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.5-2" /></svg>`,
  camera: html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="13" height="10" rx="2" /><path d="M16 11l5-3v8l-5-3" /></svg>`,
  microphone: html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>`,
  location: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z" /><circle cx="12" cy="10" r="2" /></svg>`,
  star: html`<svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9z" />
  </svg>`,
};

/**
 * The top bar: back, forward, reload, the address and search field, the
 * menu, and the loading strip under it. Emits events; the shell's
 * controller does the work.
 *
 * Events (bubbling, composed): hs-navigate (detail: typed text), hs-back,
 * hs-forward, hs-reload, hs-bookmark, hs-layers, hs-instruments, hs-new-tab, hs-zoom (detail: 1, -1, or 0 to
 * reset), hs-menu (detail: MenuAction), hs-site (the site button: open the site panel).
 *
 * The "+" button opens a new tab; its arrow, or a right-click on it, offers
 * New tab and New private tab (milestone 9, owner feedback on milestone 8).
 */
export class HsToolbar extends LitElement {
  static override properties = {
    url: { type: String },
    canGoBack: { type: Boolean },
    canGoForward: { type: Boolean },
    canReload: { type: Boolean },
    loading: { type: Boolean },
    bookmarked: { type: Boolean },
    canBookmark: { type: Boolean },
    layers: { type: Boolean },
    instruments: { type: Boolean },
    zoom: { type: Number },
    canZoom: { type: Boolean },
    private: { type: Boolean },
    downloading: { type: Boolean },
    canLayers: { type: Boolean },
    site: { type: String },
    access: { attribute: false },
    menuOpen: { state: true },
    plusOpen: { state: true },
    strip: { state: true },
  };

  declare url: string;
  declare canGoBack: boolean;
  declare canGoForward: boolean;
  declare canReload: boolean;
  declare loading: boolean;
  declare bookmarked: boolean;
  declare canBookmark: boolean;
  /** The layers view is on for the page in front (milestone 5). */
  declare layers: boolean;
  declare canLayers: boolean;
  /** The instrument panel is showing (milestone 7). */
  declare instruments: boolean;
  /** The page's zoom factor (milestone 8). */
  declare zoom: number;
  declare canZoom: boolean;
  /** The tab in front is private (milestone 8). */
  declare private: boolean;
  /** A download is in progress: a dot on the menu button. */
  declare downloading: boolean;
  /** The page in front: https ('secure'), plain http ('insecure'), or none (a start tab). */
  declare site: 'secure' | 'insecure' | 'none';
  /** What the page in front was given (camera, microphone, location): the in-use marker (milestone 9). */
  declare access: PermissionKind[];
  declare menuOpen: boolean;
  declare plusOpen: boolean;
  declare strip: 'idle' | 'loading' | 'done';
  private stripTimer: number | undefined;

  constructor() {
    super();
    this.url = '';
    this.canGoBack = false;
    this.canGoForward = false;
    this.canReload = false;
    this.loading = false;
    this.bookmarked = false;
    this.canBookmark = false;
    this.layers = false;
    this.canLayers = false;
    this.instruments = false;
    this.zoom = 1;
    this.canZoom = false;
    this.private = false;
    this.downloading = false;
    this.site = 'none';
    this.access = [];
    this.menuOpen = false;
    this.plusOpen = false;
    this.strip = 'idle';
  }

  static override styles = css`
    :host {
      position: fixed;
      top: 12px;
      left: 24px;
      right: 24px;
      /* Above the side panels, so the menu opens over them. */
      z-index: 20;
      display: block;
      font-family: inherit;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 40px;
      padding: 0 6px;
      border-radius: 10px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 35%, transparent);
      background: color-mix(in srgb, var(--hs-panel-glass) 88%, transparent);
      box-shadow: 0 0 calc(24px * var(--hs-glow-strength)) color-mix(in srgb, var(--hs-accent) 25%, transparent);
      position: relative;
    }
    button {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--hs-text);
      cursor: pointer;
      transition: background 200ms ease;
    }
    button:hover:not(:disabled) {
      background: color-mix(in srgb, var(--hs-accent) 18%, transparent);
    }
    button:disabled {
      color: var(--hs-text-muted);
      opacity: 0.45;
      cursor: default;
    }
    button:focus-visible,
    input:focus-visible,
    [role='menuitem']:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 1px;
    }
    svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .menu-button svg {
      stroke-width: 3.2;
    }
    .zoom {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .zoom button {
      width: 26px;
      font-size: 16px;
      line-height: 1;
    }
    .zoom .level {
      width: auto;
      min-width: 48px;
      padding: 0 4px;
      font-family: var(--hs-font-mono);
      font-size: 12px;
    }
    .plus-more {
      width: 16px;
      margin-left: -6px;
    }
    .plus-more svg {
      width: 14px;
      height: 14px;
    }
    .site {
      width: auto;
      min-width: 32px;
      gap: 4px;
      display: flex;
      align-items: center;
      padding: 0 6px;
      font-family: var(--hs-font-mono);
      font-size: 11px;
      letter-spacing: 0.04em;
    }
    .site svg {
      width: 17px;
      height: 17px;
    }
    .site[data-kind='insecure'] {
      color: var(--hs-warning);
    }
    .site .live {
      display: flex;
      gap: 2px;
      color: var(--hs-warning);
      animation: live 1.6s ease-in-out infinite;
    }
    @keyframes live {
      50% {
        opacity: 0.45;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .site .live {
        animation: none;
      }
    }
    .private-pill {
      flex: none;
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--hs-accent2);
      color: var(--hs-background-bottom);
      font-family: var(--hs-font-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
    }
    .menu-button[data-busy]::after {
      content: '';
      position: absolute;
      top: 4px;
      right: 4px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--hs-accent2);
      box-shadow: 0 0 6px var(--hs-accent2);
    }
    .menu-button {
      position: relative;
    }
    .instruments-button[aria-pressed='true'],
    .layers-button[aria-pressed='true'] {
      color: var(--hs-accent);
      background: color-mix(in srgb, var(--hs-accent) 18%, transparent);
    }
    .star[aria-pressed='true'] {
      color: var(--hs-accent);
    }
    .star[aria-pressed='true'] svg {
      fill: currentColor;
    }
    input {
      flex: 1;
      min-width: 0;
      height: 30px;
      padding: 0 12px;
      border-radius: 8px;
      border: 1px solid transparent;
      background: color-mix(in srgb, var(--hs-background-bottom) 60%, transparent);
      color: var(--hs-text);
      font: inherit;
      font-size: 14px;
    }
    input::placeholder {
      color: var(--hs-text-muted);
    }
    input:focus {
      border-color: var(--hs-accent);
      outline: none;
    }
    .strip {
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: -1px;
      height: 3px;
      border-radius: 2px;
      overflow: hidden;
      opacity: 0;
      transition: opacity 250ms ease;
    }
    .strip[data-state='loading'],
    .strip[data-state='done'] {
      opacity: 1;
    }
    .strip span {
      display: block;
      height: 100%;
      width: 40%;
      background: var(--hs-accent);
      box-shadow: 0 0 8px var(--hs-accent);
    }
    .strip[data-state='loading'] span {
      animation: sweep 1.1s ease-in-out infinite;
    }
    .strip[data-state='done'] span {
      width: 100%;
      transition: width 200ms ease;
    }
    @keyframes sweep {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(250%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .strip[data-state='loading'] span {
        animation: none;
        width: 100%;
        opacity: 0.6;
      }
    }
    [role='menu'].plus-menu {
      left: 0;
      right: auto;
      min-width: 200px;
    }
    [role='menu'] {
      position: absolute;
      top: 46px;
      right: 0;
      min-width: 240px;
      padding: 6px;
      border-radius: 10px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 35%, transparent);
      background: var(--hs-panel-glass);
      box-shadow: 0 8px 28px var(--hs-shadow);
    }
    [role='menuitem'] {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      width: 100%;
      height: auto;
      padding: 8px 12px;
      border-radius: 6px;
      font: inherit;
      font-size: 14px;
      text-align: left;
    }
    kbd {
      font: inherit;
      color: var(--hs-text-muted);
    }
  `;

  /**
   * Puts the cursor in the address field, showing the current address
   * selected. Waits for pending updates so a new tab's empty address is
   * shown rather than the previous tab's.
   */
  focusAddress(): void {
    void this.updateComplete.then(() => {
      const input = this.renderRoot.querySelector('input');
      if (!input) return;
      input.value = this.url;
      input.focus();
      input.select();
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onOutside);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.onOutside);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('loading')) {
      window.clearTimeout(this.stripTimer);
      if (this.loading) this.strip = 'loading';
      else if (this.strip === 'loading') {
        this.strip = 'done';
        this.stripTimer = window.setTimeout(() => (this.strip = 'idle'), 400);
      }
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    const input = this.renderRoot.querySelector('input');
    if (input && changed.has('url') && (this.renderRoot as ShadowRoot).activeElement !== input) {
      input.value = this.url;
    }
  }

  override render() {
    const mod = navigator.platform.startsWith('Mac') ? 'Cmd' : 'Ctrl';
    return html`
      <div class="bar">
        <button
          data-testid="new-tab"
          aria-label="New tab"
          title=${`New tab (${mod}+T); right-click for a private tab`}
          @click=${() => this.fire('hs-new-tab')}
          @contextmenu=${(e: MouseEvent) => {
            e.preventDefault();
            this.plusOpen = true;
          }}
        >
          ${icon.plus}
        </button>
        <button
          class="plus-more"
          data-testid="new-tab-more"
          aria-label="New tab options"
          title="New tab or private tab"
          aria-haspopup="menu"
          aria-expanded=${this.plusOpen ? 'true' : 'false'}
          @click=${() => (this.plusOpen = !this.plusOpen)}
        >
          ${icon.chevron}
        </button>
        ${this.plusOpen
          ? html`<div role="menu" class="plus-menu" aria-label="New tab" data-testid="new-tab-menu" @keydown=${this.onMenuKey}>
              <button role="menuitem" data-testid="plus-new-tab" @click=${() => this.menu('new-tab')}>
                New tab <kbd>${mod}+T</kbd>
              </button>
              <button role="menuitem" data-testid="plus-private-tab" @click=${() => this.menu('private-tab')}>
                New private tab <kbd>${mod}+Shift+N</kbd>
              </button>
            </div>`
          : nothing}
        <button data-testid="back" aria-label="Back" title="Back" ?disabled=${!this.canGoBack} @click=${() => this.fire('hs-back')}>
          ${icon.back}
        </button>
        <button data-testid="forward" aria-label="Forward" title="Forward" ?disabled=${!this.canGoForward} @click=${() => this.fire('hs-forward')}>
          ${icon.forward}
        </button>
        <button data-testid="reload" aria-label="Reload" title="Reload" ?disabled=${!this.canReload} @click=${() => this.fire('hs-reload')}>
          ${icon.reload}
        </button>
        ${this.private ? html`<span class="private-pill" data-testid="private-pill" title="Private tab: nothing is kept">PRIVATE</span>` : nothing}
        ${this.site === 'none' ? nothing : this.siteButton()}
        <input
          data-testid="address"
          type="text"
          aria-label="Address and search"
          placeholder="Search the web or type an address"
          spellcheck="false"
          autocomplete="off"
          @focus=${(e: FocusEvent) => (e.target as HTMLInputElement).select()}
          @keydown=${this.onKey}
        />
        <div class="zoom" role="group" aria-label="Zoom">
          <button data-testid="zoom-out" aria-label="Zoom out" title=${`Zoom out (${mod}+−)`} ?disabled=${!this.canZoom} @click=${() => this.fire('hs-zoom', -1)}>−</button>
          <button class="level" data-testid="zoom-level" aria-label=${`Zoom ${Math.round(this.zoom * 100)}%, reset to 100%`} title=${`Reset zoom (${mod}+0)`}
            ?disabled=${!this.canZoom} @click=${() => this.fire('hs-zoom', 0)}>${Math.round(this.zoom * 100)}%</button>
          <button data-testid="zoom-in" aria-label="Zoom in" title=${`Zoom in (${mod}+=)`} ?disabled=${!this.canZoom} @click=${() => this.fire('hs-zoom', 1)}>+</button>
        </div>
        <button
          class="instruments-button"
          data-testid="instruments"
          aria-label="Instrument panel"
          title=${`Instrument panel (${mod}+Shift+I)`}
          aria-pressed=${this.instruments ? 'true' : 'false'}
          @click=${() => this.fire('hs-instruments')}
        >
          ${icon.gauge}
        </button>
        <button
          class="layers-button"
          data-testid="layers"
          aria-label="Layers view"
          title=${`Layers view (${mod}+Shift+L)`}
          aria-pressed=${this.layers ? 'true' : 'false'}
          ?disabled=${!this.canLayers}
          @click=${() => this.fire('hs-layers')}
        >
          ${icon.layers}
        </button>
        <button
          class="star"
          data-testid="star"
          aria-label=${this.bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
          title=${this.bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
          aria-pressed=${this.bookmarked ? 'true' : 'false'}
          ?disabled=${!this.canBookmark}
          @click=${() => this.fire('hs-bookmark')}
        >
          ${icon.star}
        </button>
        <button
          class="menu-button"
          ?data-busy=${this.downloading}
          data-testid="menu"
          aria-label="Menu"
          title="Menu"
          aria-haspopup="menu"
          aria-expanded=${this.menuOpen ? 'true' : 'false'}
          @click=${() => (this.menuOpen = !this.menuOpen)}
        >
          ${icon.menu}
        </button>
        ${this.menuOpen
          ? html`<div role="menu" aria-label="Menu" @keydown=${this.onMenuKey}>
              <button role="menuitem" data-testid="menu-new-tab" @click=${() => this.menu('new-tab')}>
                New tab <kbd>${mod}+T</kbd>
              </button>
              <button role="menuitem" data-testid="menu-private-tab" @click=${() => this.menu('private-tab')}>
                New private tab <kbd>${mod}+Shift+N</kbd>
              </button>
              <button role="menuitem" data-testid="menu-close-tab" @click=${() => this.menu('close-tab')}>
                Close tab <kbd>${mod}+W</kbd>
              </button>
              <button role="menuitem" data-testid="menu-downloads" @click=${() => this.menu('downloads')}>
                Downloads <kbd>${mod}+J</kbd>
              </button>
              <button role="menuitem" data-testid="menu-print" @click=${() => this.menu('print')}>
                Print <kbd>${mod}+P</kbd>
              </button>
              <button role="menuitem" data-testid="menu-library" @click=${() => this.menu('library')}>
                Library <kbd>${mod}+Shift+O</kbd>
              </button>
              <button role="menuitem" data-testid="menu-settings" @click=${() => this.menu('settings')}>
                Settings <kbd>${mod}+,</kbd>
              </button>
              <button role="menuitem" data-testid="menu-about" @click=${() => this.menu('about')}>
                About HyperSpace 3D
              </button>
            </div>`
          : nothing}
        <div class="strip" data-testid="progress" data-state=${this.strip} aria-hidden="true"><span></span></div>
      </div>
    `;
  }

  private siteButton() {
    const insecure = this.site === 'insecure';
    const given = this.access.map((k) => PERMISSION_LABELS[k].toLowerCase());
    const label = `Site settings${insecure ? ', not secure' : ''}${given.length ? `; given your ${given.join(' and ')}` : ''}`;
    return html`<button class="site" data-testid="site-button" data-kind=${this.site} aria-label=${label} title=${label}
      @click=${() => this.fire('hs-site')}>
      ${insecure ? icon.open : icon.lock}${insecure ? html`<span>Not secure</span>` : nothing}
      ${this.access.length
        ? html`<span class="live" data-testid="access-marker">${this.access.map((k) => icon[k])}</span>`
        : nothing}
    </button>`;
  }

  private readonly onOutside = (e: PointerEvent) => {
    if (e.composedPath().includes(this)) return;
    if (this.menuOpen) this.menuOpen = false;
    if (this.plusOpen) this.plusOpen = false;
  };

  private readonly onKey = (e: KeyboardEvent) => {
    const input = e.target as HTMLInputElement;
    if (e.key === 'Enter') {
      const text = input.value.trim();
      if (text !== '') {
        this.fire('hs-navigate', text);
        input.blur();
      }
    } else if (e.key === 'Escape') {
      input.value = this.url;
      input.select();
    }
  };

  private readonly onMenuKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const plus = this.plusOpen;
      this.menuOpen = false;
      this.plusOpen = false;
      (this.renderRoot.querySelector(plus ? '[data-testid="new-tab-more"]' : '[data-testid="menu"]') as HTMLButtonElement | null)?.focus();
    }
  };

  private menu(action: MenuAction): void {
    this.menuOpen = false;
    this.plusOpen = false;
    this.fire('hs-menu', action);
  }

  private fire(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

customElements.define('hs-toolbar', HsToolbar);

declare global {
  interface HTMLElementTagNameMap {
    'hs-toolbar': HsToolbar;
  }
}
