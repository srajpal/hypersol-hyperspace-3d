import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { PERMISSION_LABELS, type PermissionKind } from '../../shared/permissions';
import { watchDismiss } from './dismiss';
import type { Suggestion, Suggestions } from '../../shared/data';
import { siteKey } from '../../shared/site';
import { displayAddress } from '../url';

export type MenuAction =
  | 'new-tab'
  | 'private-tab'
  | 'open-file'
  | 'close-tab'
  | 'reopen-tab'
  | 'search-tabs'
  | 'mute-tab'
  | 'downloads'
  | 'print'
  | 'library'
  | 'settings'
  | 'shortcuts'
  | 'examples'
  | 'about';

const icon = {
  gauge: html`<svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4.5 17a8.5 8.5 0 1 1 15 0" /><path d="M12 13.5l4-4.5" /><circle cx="12" cy="14" r="1.3" />
  </svg>`,
  plus: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>`,
  back: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>`,
  forward: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>`,
  text: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 10h14M5 14h10M5 18h8" /></svg>`,
  stop: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>`,
  reload: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4" /></svg>`,
  menu: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6h.01M12 12h.01M12 18h.01" /></svg>`,
  look: html`<svg viewBox="0 0 24 24" aria-hidden="true">
    <ellipse cx="12" cy="13" rx="9" ry="4" /><path d="M12 4v5" /><path d="M9.5 6.5 12 4l2.5 2.5" /><circle cx="12" cy="13" r="1.4" />
  </svg>`,
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
 * The top bar: new tab, back, forward, reload or stop, the site button,
 * the address and search field with its completion, zoom, the instrument
 * panel, layers, and text view buttons, the bookmark star, the menu, and
 * the loading strip under it. Emits events; the shell's controller does
 * the work.
 *
 * Events (bubbling, composed): hs-navigate (detail: typed text, or a
 * suggestion's address), hs-search (detail: text to search for, from the
 * address bar's "Search ... for" row), hs-back, hs-forward, hs-reload,
 * hs-stop, hs-new-tab, hs-site (the site button: open the site panel),
 * hs-zoom (detail: 1, -1, or 0 to reset), hs-instruments, hs-layers,
 * hs-look-around (milestone 27: look around the room, or come back),
 * hs-text-view (a HoloML page's text view), hs-bookmark, and hs-menu
 * (detail: MenuAction).
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
    lookAround: { type: Boolean },
    canLookAround: { type: Boolean },
    lookReason: { type: String },
    holoml: { type: Boolean },
    textView: { type: Boolean },
    site: { type: String },
    access: { attribute: false },
    economy: { type: Boolean },
    muted: { type: Boolean },
    canReopen: { type: Boolean },
    keys: { attribute: false },
    omit: { attribute: false },
    menuOpen: { state: true },
    plusOpen: { state: true },
    suggestions: { state: true },
    selected: { state: true },
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
  /** Looking around the room (milestone 27): the camera is away from the desk. */
  declare lookAround: boolean;
  declare canLookAround: boolean;
  /** Why looking around is not offered now, or empty. */
  declare lookReason: string;
  /** A HoloML page in front (milestone 15): the text view button shows. */
  declare holoml: boolean;
  declare textView: boolean;
  /** The instrument panel is showing (milestone 7). */
  declare instruments: boolean;
  /** The page's zoom factor (milestone 8). */
  declare zoom: number;
  declare canZoom: boolean;
  /** The tab in front is private (milestone 8). */
  declare private: boolean;
  /** A download is in progress: a dot on the menu button. */
  declare downloading: boolean;
  /** The page in front: loaded over https ('secure'), over plain http ('insecure'), or none (a start tab, a failed page, a page not loaded yet). */
  declare site: 'secure' | 'insecure' | 'none';
  /** What the page in front was given (camera, microphone, location): the in-use marker (milestone 9). */
  declare access: PermissionKind[];
  /** Economy mode is on (milestone 10): "ECO" shows. */
  declare economy: boolean;
  /** The tab in front is muted, for the menu's Mute or Unmute. */
  declare muted: boolean;
  /** A closed tab can be reopened. */
  declare canReopen: boolean;
  /** Each shortcut's keys as they read on this platform (milestone 11: they follow remapping). */
  declare keys: Partial<Record<string, string>>;
  /**
   * Parts left out where the browser does not have them yet (milestone 24,
   * Android): "new-tab-more", "zoom", "instruments", "layers", "star", and
   * any menu entry by its action. Nothing is left out by default.
   */
  declare omit: readonly string[];
  declare menuOpen: boolean;
  declare plusOpen: boolean;
  /** Address bar completion (milestone 11): the list under the bar, and the row picked with the arrows. */
  declare suggestions: Suggestion[];
  declare selected: number;
  /** Where suggestions come from (the controller asks the history worker). */
  suggest: ((text: string) => Promise<Suggestions>) | null = null;
  forget: ((url: string) => Promise<void>) | null = null;
  /** The search engine's name, for "Search ... for". */
  searchName = 'the web';
  /** What was typed, and the address it was completed to. */
  private typed = '';
  /** The person has changed the text in the bar since it last showed the tab's address. */
  private edited = false;
  /** For measuring how much of an address fits the bar. */
  private measure: CanvasRenderingContext2D | null = null;
  private resizeWatch: ResizeObserver | null = null;
  private inline: { key: string; url: string } | null = null;
  /**
   * Every address offered while typing, by the key it completes to: Enter
   * goes to the real address of whatever the bar shows, whichever reply it
   * came from.
   */
  private readonly offered = new Map<string, string>();
  private suggestTicket = 0;
  declare strip: 'idle' | 'loading' | 'done';
  private stripTimer: number | undefined;

  constructor() {
    super();
    this.url = '';
    this.omit = [];
    this.canGoBack = false;
    this.canGoForward = false;
    this.canReload = false;
    this.holoml = false;
    this.textView = false;
    this.loading = false;
    this.bookmarked = false;
    this.canBookmark = false;
    this.layers = false;
    this.canLayers = false;
    this.lookAround = false;
    this.canLookAround = false;
    this.lookReason = '';
    this.instruments = false;
    this.zoom = 1;
    this.canZoom = false;
    this.private = false;
    this.downloading = false;
    this.site = 'none';
    this.access = [];
    this.economy = false;
    this.muted = false;
    this.canReopen = false;
    this.keys = {};
    this.menuOpen = false;
    this.plusOpen = false;
    this.suggestions = [];
    this.selected = -1;
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
    .eco-pill {
      flex: none;
      padding: 3px 7px;
      border-radius: 6px;
      border: 1px solid var(--hs-accent);
      color: var(--hs-accent);
      font-family: var(--hs-font-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
    }
    [role='menuitem']:disabled {
      opacity: 0.45;
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
    .layers-button[aria-pressed='true'],
    .look-button[aria-pressed='true'] {
      color: var(--hs-accent);
      background: color-mix(in srgb, var(--hs-accent) 18%, transparent);
    }
    .star[aria-pressed='true'] {
      color: var(--hs-accent);
    }
    .star[aria-pressed='true'] svg {
      fill: currentColor;
    }
    .address {
      flex: 1;
      min-width: 0;
      position: relative;
      display: flex;
    }
    [role='listbox'] {
      position: absolute;
      top: 38px;
      left: 0;
      right: 0;
      margin: 0;
      padding: 4px;
      list-style: none;
      border-radius: 10px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 45%, transparent);
      background: var(--hs-panel-glass);
      box-shadow: 0 10px 28px var(--hs-shadow);
      z-index: 2;
    }
    [role='option'] {
      display: grid;
      grid-template-columns: 18px 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 5px 8px;
      border-radius: 7px;
      cursor: pointer;
      font-size: 13px;
    }
    [role='option'][aria-selected='true'] {
      background: color-mix(in srgb, var(--hs-accent) 22%, transparent);
    }
    [role='option'] .text {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    [role='option'] .url {
      color: var(--hs-text-muted);
      margin-left: 8px;
    }
    [role='option'] .kind {
      color: var(--hs-text-muted);
      text-align: center;
    }
    [role='option'] button {
      width: 22px;
      height: 22px;
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
      this.edited = false;
      input.focus();
      input.select();
    });
  }

  private get addressFocused(): boolean {
    const input = this.addressInput;
    return input !== null && (this.renderRoot as ShadowRoot).activeElement === input;
  }

  /**
   * Puts the tab's address in the bar as it reads without the keyboard:
   * the end of its host always in view, however narrow the bar, and no
   * user name or password (url.ts, displayAddress).
   */
  private showAddress(input: HTMLInputElement): void {
    this.edited = false;
    const style = getComputedStyle(input);
    const room = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    this.measure ??= document.createElement('canvas').getContext('2d');
    const ctx = this.measure;
    if (!ctx || !(room > 0)) {
      input.value = displayAddress(this.url);
      return;
    }
    ctx.font = style.font;
    input.value = displayAddress(this.url, (start) => ctx.measureText(start).width <= room);
  }

  protected override firstUpdated(): void {
    // The bar widens and narrows with the window and with what else the
    // top bar shows; the address is fitted again each time.
    const input = this.addressInput;
    if (!input) return;
    this.resizeWatch = new ResizeObserver(() => {
      if (!this.addressFocused && !this.edited) this.showAddress(input);
    });
    this.resizeWatch.observe(input);
  }

  private stopDismiss: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    // The menus close on a press or focus elsewhere, clicks in the page included (milestone 11).
    this.stopDismiss = watchDismiss(this, () => this.menuOpen || this.plusOpen, () => {
      this.menuOpen = false;
      this.plusOpen = false;
    });
    document.addEventListener('keydown', this.onEscape);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopDismiss?.();
    this.resizeWatch?.disconnect();
    this.resizeWatch = null;
    document.removeEventListener('keydown', this.onEscape);
  }

  /** Escape closes an open menu wherever the keyboard is in the shell. */
  private readonly onEscape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || (!this.menuOpen && !this.plusOpen)) return;
    this.menuOpen = false;
    this.plusOpen = false;
  };

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
    const input = this.addressInput;
    if (input && changed.has('url') && !this.addressFocused) this.showAddress(input);
    // A menu that opens takes the keyboard, on its first entry: the arrow keys go on from there.
    if ((changed.has('menuOpen') && this.menuOpen) || (changed.has('plusOpen') && this.plusOpen)) this.menuItems()[0]?.focus();
  }

  /** Something here is open that Escape closes or drops: a menu, or the address bar's list or completion. */
  get escapeTaken(): boolean {
    return this.menuOpen || this.plusOpen || this.listShown || this.inline !== null;
  }

  private menuItems(): HTMLButtonElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLButtonElement>('[role="menu"] [role="menuitem"]:not(:disabled)')];
  }

  /** Whether a part shows (see `omit`). */
  private shows(part: string): boolean {
    return !this.omit.includes(part);
  }

  override render() {
    return html`
      <div class="bar">
        <button
          data-testid="new-tab"
          aria-label="New tab"
          title=${`New tab (${this.keys['new-tab'] ?? ''}); right-click for a private tab`}
          @click=${() => this.fire('hs-new-tab')}
          @contextmenu=${(e: MouseEvent) => {
            e.preventDefault();
            if (this.shows('new-tab-more')) this.plusOpen = true;
          }}
        >
          ${icon.plus}
        </button>
        ${this.shows('new-tab-more')
          ? html`<button
          class="plus-more"
          data-testid="new-tab-more"
          aria-label="New tab options"
          title="New tab or private tab"
          aria-haspopup="menu"
          aria-expanded=${this.plusOpen ? 'true' : 'false'}
          @click=${() => (this.plusOpen = !this.plusOpen)}
        >
          ${icon.chevron}
        </button>`
          : nothing}
        ${this.plusOpen
          ? html`<div role="menu" class="plus-menu" aria-label="New tab" data-testid="new-tab-menu" @keydown=${this.onMenuKey}>
              <button role="menuitem" data-testid="plus-new-tab" @click=${() => this.menu('new-tab')}>
                New tab <kbd>${this.keys['new-tab'] ?? ''}</kbd>
              </button>
              <button role="menuitem" data-testid="plus-private-tab" @click=${() => this.menu('private-tab')}>
                New private tab <kbd>${this.keys['private-tab'] ?? ''}</kbd>
              </button>
            </div>`
          : nothing}
        <button data-testid="back" aria-label="Back" title="Back" ?disabled=${!this.canGoBack} @click=${() => this.fire('hs-back')}>
          ${icon.back}
        </button>
        <button data-testid="forward" aria-label="Forward" title="Forward" ?disabled=${!this.canGoForward} @click=${() => this.fire('hs-forward')}>
          ${icon.forward}
        </button>
        ${this.loading
          ? html`<button data-testid="stop" aria-label="Stop" title="Stop loading (Esc)" @click=${() => this.fire('hs-stop')}>${icon.stop}</button>`
          : html`<button data-testid="reload" aria-label="Reload" title="Reload" ?disabled=${!this.canReload} @click=${() => this.fire('hs-reload')}>
          ${icon.reload}
        </button>`}
        ${this.private ? html`<span class="private-pill" data-testid="private-pill" title="Private tab: nothing is kept">PRIVATE</span>` : nothing}
        ${this.site === 'none' ? nothing : this.siteButton()}
        ${this.economy
          ? html`<span class="eco-pill" data-testid="eco-pill" title="Economy mode: the room draws less to save power (Settings > Economy)">ECO</span>`
          : nothing}
        <div class="address">
          <input
            data-testid="address"
            type="text"
            role="combobox"
            aria-label="Address and search"
            aria-autocomplete="both"
            aria-expanded=${this.suggestions.length > 0 ? 'true' : 'false'}
            aria-controls="suggestions"
            placeholder="Search the web or type an address"
            spellcheck="false"
            autocomplete="off"
            @focus=${(e: FocusEvent) => {
              // A new typing session, on the whole address (unless text typed earlier is still there).
              this.offered.clear();
              const input = e.target as HTMLInputElement;
              if (!this.edited) input.value = this.url;
              input.select();
            }}
            @input=${this.onInput}
            @compositionend=${this.onInput}
            @blur=${(e: FocusEvent) => {
              // Left as it was: the bar shows where the tab is now (the
              // page may have moved on while the bar had the keyboard).
              if (!this.edited) this.showAddress(e.target as HTMLInputElement);
              window.setTimeout(() => {
                // Unless the bar has the keyboard again by then.
                if (!this.addressFocused) this.closeSuggestions();
              }, 150);
            }}
            @keydown=${this.onKey}
          />
          ${this.suggestionList()}
        </div>
        ${this.shows('zoom')
          ? html`<div class="zoom" role="group" aria-label="Zoom">
          <button data-testid="zoom-out" aria-label="Zoom out" title=${`Zoom out (${this.keys['zoom-out'] ?? ''})`} ?disabled=${!this.canZoom} @click=${() => this.fire('hs-zoom', -1)}>−</button>
          <button class="level" data-testid="zoom-level" aria-label=${`Zoom ${Math.round(this.zoom * 100)}%, reset to 100%`} title=${`Reset zoom (${this.keys['zoom-reset'] ?? ''})`}
            ?disabled=${!this.canZoom} @click=${() => this.fire('hs-zoom', 0)}>${Math.round(this.zoom * 100)}%</button>
          <button data-testid="zoom-in" aria-label="Zoom in" title=${`Zoom in (${this.keys['zoom-in'] ?? ''})`} ?disabled=${!this.canZoom} @click=${() => this.fire('hs-zoom', 1)}>+</button>
        </div>`
          : nothing}
        ${this.shows('instruments')
          ? html`<button
          class="instruments-button"
          data-testid="instruments"
          aria-label="Instrument panel"
          title=${`Instrument panel (${this.keys['instruments'] ?? ''})`}
          aria-pressed=${this.instruments ? 'true' : 'false'}
          @click=${() => this.fire('hs-instruments')}
        >
          ${icon.gauge}
        </button>`
          : nothing}
        ${this.shows('layers')
          ? html`<button
          class="layers-button"
          data-testid="layers"
          aria-label="Layers view"
          title=${`Layers view (${this.keys['layers'] ?? ''})`}
          aria-pressed=${this.layers ? 'true' : 'false'}
          ?disabled=${!this.canLayers}
          @click=${() => this.fire('hs-layers')}
        >
          ${icon.layers}
        </button>`
          : nothing}
        ${this.shows('look-around')
          ? html`<button
          class="look-button"
          data-testid="look-around"
          aria-label="Look around the room"
          title=${this.lookReason
            ? `Look around the room: ${this.lookReason}`
            : this.lookAround
              ? `Back to the desk (${this.keys['look-around'] ?? ''}, or Esc)`
              : `Look around the room (${this.keys['look-around'] ?? ''})`}
          aria-pressed=${this.lookAround ? 'true' : 'false'}
          ?disabled=${!this.canLookAround}
          @click=${() => this.fire('hs-look-around')}
        >
          ${icon.look}
        </button>`
          : nothing}
        ${this.holoml
          ? html`<button
              data-testid="text-view"
              aria-label="Text view"
              title=${`Text view: the scene as a plain page (${this.keys['text-view'] ?? ''})`}
              aria-pressed=${this.textView ? 'true' : 'false'}
              @click=${() => this.fire('hs-text-view')}
            >
              ${icon.text}
            </button>`
          : nothing}
        ${this.shows('star')
          ? html`<button
          class="star"
          data-testid="star"
          aria-label=${this.bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
          title=${this.bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
          aria-pressed=${this.bookmarked ? 'true' : 'false'}
          ?disabled=${!this.canBookmark}
          @click=${() => this.fire('hs-bookmark')}
        >
          ${icon.star}
        </button>`
          : nothing}
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
              ${this.shows('new-tab')
                ? html`<button role="menuitem" data-testid="menu-new-tab" @click=${() => this.menu('new-tab')}>
                New tab <kbd>${this.keys['new-tab'] ?? ''}</kbd>
              </button>`
                : nothing}
              ${this.shows('private-tab')
                ? html`<button role="menuitem" data-testid="menu-private-tab" @click=${() => this.menu('private-tab')}>
                New private tab <kbd>${this.keys['private-tab'] ?? ''}</kbd>
              </button>`
                : nothing}
              ${this.shows('open-file')
                ? html`<button role="menuitem" data-testid="menu-open-file" @click=${() => this.menu('open-file')}>
                Open a HoloML file…
              </button>`
                : nothing}
              ${this.shows('close-tab')
                ? html`<button role="menuitem" data-testid="menu-close-tab" @click=${() => this.menu('close-tab')}>
                Close tab <kbd>${this.keys['close-tab'] ?? ''}</kbd>
              </button>`
                : nothing}
              ${this.shows('reopen-tab')
                ? html`<button role="menuitem" data-testid="menu-reopen-tab" ?disabled=${!this.canReopen} @click=${() => this.menu('reopen-tab')}>
                Reopen closed tab <kbd>${this.keys['reopen-tab'] ?? ''}</kbd>
              </button>`
                : nothing}
              ${this.shows('search-tabs')
                ? html`<button role="menuitem" data-testid="menu-search-tabs" @click=${() => this.menu('search-tabs')}>
                Search tabs <kbd>${this.keys['search-tabs'] ?? ''}</kbd>
              </button>`
                : nothing}
              ${this.shows('mute-tab')
                ? html`<button role="menuitem" data-testid="menu-mute-tab" @click=${() => this.menu('mute-tab')}>
                ${this.muted ? 'Unmute tab' : 'Mute tab'}
              </button>`
                : nothing}
              ${this.shows('downloads')
                ? html`<button role="menuitem" data-testid="menu-downloads" @click=${() => this.menu('downloads')}>
                Downloads <kbd>${this.keys['downloads'] ?? ''}</kbd>
              </button>`
                : nothing}
              ${this.shows('print')
                ? html`<button role="menuitem" data-testid="menu-print" @click=${() => this.menu('print')}>
                Print <kbd>${this.keys['print'] ?? ''}</kbd>
              </button>`
                : nothing}
              ${this.shows('library')
                ? html`<button role="menuitem" data-testid="menu-library" @click=${() => this.menu('library')}>
                Library <kbd>${this.keys['library'] ?? ''}</kbd>
              </button>`
                : nothing}
              ${this.shows('settings')
                ? html`<button role="menuitem" data-testid="menu-settings" @click=${() => this.menu('settings')}>
                Settings <kbd>${this.keys['settings'] ?? ''}</kbd>
              </button>`
                : nothing}
              ${this.shows('shortcuts')
                ? html`<button role="menuitem" data-testid="menu-shortcuts" @click=${() => this.menu('shortcuts')}>
                Keyboard shortcuts
              </button>`
                : nothing}
              ${this.shows('examples')
                ? html`<button role="menuitem" data-testid="menu-examples" @click=${() => this.menu('examples')}>
                HoloML examples <kbd>${this.keys['examples'] ?? ''}</kbd>
              </button>`
                : nothing}
              ${this.shows('about')
                ? html`<button role="menuitem" data-testid="menu-about" @click=${() => this.menu('about')}>
                About HyperSpace 3D
              </button>`
                : nothing}
            </div>`
          : nothing}
        <div class="strip" data-testid="progress" data-state=${this.strip} aria-hidden="true"><span></span></div>
      </div>
    `;
  }

  // ---- Address bar completion (milestone 11) ---------------------------------

  private get addressInput(): HTMLInputElement | null {
    return this.renderRoot.querySelector('input[data-testid="address"]');
  }

  /** The list under the bar: matches from history and bookmarks, then "Search ... for". */
  private suggestionList() {
    if (this.suggestions.length === 0 && this.typed.trim() === '') return nothing;
    if (this.suggestions.length === 0 && this.selected === -1 && !this.listShown) return nothing;
    const rows = [...this.suggestions];
    return html`<ul id="suggestions" role="listbox" aria-label="Suggestions" data-testid="address-suggestions">
      ${rows.map(
        (item, i) => html`<li
          role="option"
          data-testid="suggestion"
          aria-selected=${this.selected === i ? 'true' : 'false'}
          @mousedown=${(e: Event) => e.preventDefault()}
          @click=${() => this.go(item.url)}
        >
          <span class="kind" aria-hidden="true">${item.kind === 'bookmark' ? '★' : '◷'}</span>
          <span class="text">${item.title || item.url}<span class="url">${item.url}</span></span>
          ${item.kind === 'history' && this.forget
            ? html`<button data-testid="suggestion-remove" aria-label=${`Remove ${item.url} from history`} title="Remove from history"
                @click=${(e: Event) => {
                  e.stopPropagation();
                  void this.forget?.(item.url).then(() => this.refreshSuggestions());
                }}>×</button>`
            : html`<span></span>`}
        </li>`,
      )}
      <li
        role="option"
        data-testid="suggestion-search"
        aria-selected=${this.selected === rows.length ? 'true' : 'false'}
        @mousedown=${(e: Event) => e.preventDefault()}
        @click=${() => this.searchTyped()}
      >
        <span class="kind" aria-hidden="true">⌕</span>
        <span class="text">Search ${this.searchName} for “${this.typed.trim()}”</span><span></span>
      </li>
    </ul>`;
  }

  private listShown = false;

  private closeSuggestions(): void {
    this.suggestTicket += 1;
    this.suggestions = [];
    this.selected = -1;
    this.listShown = false;
    this.inline = null;
  }

  private readonly onInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const value = input.value;
    this.typed = value;
    this.edited = true;
    this.inline = null;
    this.selected = -1;
    const deleting = (e as InputEvent).inputType?.startsWith('delete') ?? false;
    // Text still being composed (an input method's candidates) is not
    // completed in place: that would break into the composition. The list
    // still shows, and the text is completed once it is composed.
    const composing = e.type === 'input' && ((e as InputEvent).isComposing ?? false);
    if (value.trim() === '') {
      this.closeSuggestions();
      return;
    }
    this.listShown = true;
    void this.askSuggestions(value, !deleting && !composing);
  };

  private async askSuggestions(value: string, complete: boolean): Promise<void> {
    if (!this.suggest) return;
    const ticket = ++this.suggestTicket;
    let found: Suggestions;
    try {
      found = await this.suggest(value);
    } catch {
      return;
    }
    const input = this.addressInput;
    if (ticket !== this.suggestTicket || !input || input.value !== value) return;
    this.suggestions = found.items;
    // Two addresses can complete to the same text (http and https, or
    // another spelling): the one Enter goes to is the one the top row
    // shows, so in each reply the completion comes first and the first
    // (best) address for a key is the one kept.
    const fresh = new Map<string, string>();
    if (found.inline) fresh.set(found.inline.key, found.inline.url);
    for (const item of found.items) {
      const key = siteKey(item.url);
      if (!fresh.has(key)) fresh.set(key, item.url);
    }
    for (const [key, url] of fresh) this.offered.set(key, url);
    // Complete the rest of the site in place, selected, so typing goes on over it.
    if (complete && found.inline && input.selectionStart === value.length) {
      const key = siteKey(value);
      if (found.inline.key.startsWith(key) && found.inline.key.length > key.length) {
        input.value = value + found.inline.key.slice(key.length);
        input.setSelectionRange(value.length, input.value.length);
        this.inline = found.inline;
      }
    }
  }

  private refreshSuggestions(): void {
    const input = this.addressInput;
    if (input) input.value = this.typed;
    void this.askSuggestions(this.typed, false);
  }

  private go(url: string): void {
    this.closeSuggestions();
    this.edited = false;
    this.fire('hs-navigate', url);
    this.addressInput?.blur();
  }

  private searchTyped(): void {
    const text = this.typed.trim();
    this.closeSuggestions();
    this.edited = false;
    if (text) this.fire('hs-search', text);
    this.addressInput?.blur();
  }

  /** Arrow keys move through the list, showing each row's address in the bar. */
  private moveSelection(step: 1 | -1): void {
    const input = this.addressInput;
    const count = this.suggestions.length + 1;
    if (!input || !this.listShown) return;
    let next = this.selected + step;
    if (next < -1) next = count - 1;
    if (next >= count) next = -1;
    this.selected = next;
    this.inline = null;
    input.value = next >= 0 && next < this.suggestions.length ? this.suggestions[next]!.url : this.typed;
    input.setSelectionRange(input.value.length, input.value.length);
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

  private readonly onKey = (e: KeyboardEvent) => {
    const input = e.target as HTMLInputElement;
    // While text is being composed the keys are the input method's: Enter
    // takes a candidate, the arrows move between them.
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!this.listShown) return;
      e.preventDefault();
      this.moveSelection(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter') {
      const picked = this.selected;
      if (picked >= 0 && picked < this.suggestions.length) {
        this.go(this.suggestions[picked]!.url);
        return;
      }
      if (picked === this.suggestions.length && this.listShown) {
        this.searchTyped();
        return;
      }
      // A completed site goes to the address it was visited at.
      const known = input.value !== this.typed ? this.offered.get(siteKey(input.value)) : undefined;
      const text = input.value.trim();
      this.closeSuggestions();
      this.offered.clear();
      if (text === '' && !known) return;
      this.edited = false;
      this.fire('hs-navigate', known ?? text);
      input.blur();
    } else if (e.key === 'Escape') {
      if (this.listShown || this.inline) {
        // First Escape: drop the completion and the list, keep what was typed.
        input.value = this.typed;
        this.closeSuggestions();
        e.stopPropagation();
        return;
      }
      // Text put back is what this Escape did; with nothing to put back
      // the key goes on to the shell (it stops a loading page).
      if (input.value !== this.url) e.preventDefault();
      input.value = this.url;
      this.edited = false;
      input.select();
    }
  };

  private readonly onMenuKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const plus = this.plusOpen;
      this.menuOpen = false;
      this.plusOpen = false;
      (this.renderRoot.querySelector(plus ? '[data-testid="new-tab-more"]' : '[data-testid="menu"]') as HTMLButtonElement | null)?.focus();
      return;
    }
    // Up and Down move between the entries, round the ends; Home and End go to the first and last.
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const items = this.menuItems();
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf((this.renderRoot as ShadowRoot).activeElement as HTMLButtonElement);
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key === 'ArrowDown' ? (at + 1) % items.length : at <= 0 ? items.length - 1 : at - 1;
    items[next]!.focus();
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
