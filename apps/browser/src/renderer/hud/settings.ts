import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import type { ShortcutName } from '../../shared/commands';
import type { DnsStatus, FilterStatus } from '../../shared/privacy';
import {
  DEFAULT_SETTINGS,
  defaults,
  MAX_TILT,
  MIN_TILT,
  SEARCH_ENGINES,
  type DnsMode,
  type EconomyMode,
  type PageMargin,
  type ParallaxAmount,
  type SearchEngineId,
  type Settings,
  type StartupMode,
  type TabDisplay,
  type TabSize,
  type TabSleep,
  type ThemeChoice,
  type TiltDirection,
} from '../../shared/settings';
import { PERMISSION_KINDS, PERMISSION_LABELS, type SiteChoices } from '../../shared/permissions';
import { bindings, comboFromEvent, describeCombo, SHORTCUTS } from '../../shared/shortcuts';
import type { DataClient, PrivacyClient } from '../data';
import { panelStyles } from './panel-styles';
import { siteName } from './prompts';

type SectionId = 'general' | 'appearance' | 'tabs' | 'privacy' | 'economy' | 'instruments' | 'shortcuts' | 'data';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance and view' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'privacy', label: 'Privacy and security' },
  { id: 'economy', label: 'Economy' },
  { id: 'instruments', label: 'Instrument panel' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'data', label: 'Clear data' },
];

/** One group of settings: where it lives, what it is called, the words it can be found by, and its controls. */
interface Group {
  id: string;
  section: SectionId;
  title: string;
  /** Extra words for search (what people might type). */
  words: string;
  /** Test ids of its controls, so a check can bring it into view (prefixes end with "*"). */
  ids: string[];
  render: () => TemplateResult;
}

/**
 * The Settings panel (reorganized in milestone 11, owner, prompt 51, Q2 a):
 * sections listed on the left, one page each, and a search at the top
 * that finds any setting by its name or related words across all sections
 * and shows it with its controls. Changes save at once. Escape closes it.
 *
 * Events: hs-panel-closed, hs-settings-changed (detail: Settings),
 * hs-open-passwords (the Library's Passwords tab).
 */
export class HsSettings extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    settings: { state: true },
    message: { state: true },
    problem: { state: true },
    sessionProblem: { type: String },
    confirming: { state: true },
    choices: { state: true },
    filters: { state: true },
    dns: { state: true },
    section: { state: true },
    query: { state: true },
    capturing: { state: true },
    keyMessage: { state: true },
  };

  declare open: boolean;
  declare settings: Settings;
  declare message: string;
  declare problem: string;
  /** Why the open tabs could not be saved, if they could not. */
  declare sessionProblem: string;
  declare confirming: boolean;
  declare choices: { history: boolean; cookies: boolean; cache: boolean; passwords: boolean };
  declare filters: FilterStatus | null;
  declare dns: DnsStatus | null;
  declare section: SectionId;
  declare query: string;
  /** The shortcut waiting for its new keys, if any. */
  declare capturing: ShortcutName | null;
  declare keyMessage: string;
  client: DataClient | null = null;
  privacy: PrivacyClient | null = null;
  /** The platform, for how keys read (Ctrl or Cmd). */
  platform = 'win32';
  /** Tells the main process to let key presses through while a shortcut is being changed. */
  captureKeys: (on: boolean) => void = () => undefined;

  constructor() {
    super();
    this.open = false;
    this.settings = defaults();
    this.message = '';
    this.problem = '';
    this.sessionProblem = '';
    this.confirming = false;
    this.choices = { history: true, cookies: false, cache: false, passwords: false };
    this.filters = null;
    this.dns = null;
    this.section = 'general';
    this.query = '';
    this.capturing = null;
    this.keyMessage = '';
  }

  static override styles = [
    panelStyles,
    css`
      :host {
        width: min(760px, calc(100vw - 48px));
      }
      .top {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 12px;
      }
      input[type='search'] {
        flex: 1;
        box-sizing: border-box;
        height: 34px;
        padding: 0 12px;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, var(--hs-text-muted) 60%, transparent);
        background: color-mix(in srgb, var(--hs-background-bottom) 60%, transparent);
      }
      .layout {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 14px;
      }
      nav {
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow: auto;
      }
      nav button {
        border: 0;
        text-align: left;
        padding: 7px 10px;
        border-radius: 8px;
      }
      nav button[aria-selected='true'] {
        background: color-mix(in srgb, var(--hs-accent) 24%, transparent);
        color: var(--hs-text);
        box-shadow: inset 3px 0 0 var(--hs-accent);
      }
      .body {
        overflow: auto;
        padding-right: 4px;
      }
      .group {
        margin: 0 0 12px;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--hs-accent) 22%, transparent);
        background: color-mix(in srgb, var(--hs-background-bottom) 28%, transparent);
      }
      .group[data-flash] {
        border-color: var(--hs-accent);
        box-shadow: 0 0 calc(18px * var(--hs-glow-strength)) color-mix(in srgb, var(--hs-accent) 40%, transparent);
      }
      .group h3 {
        margin: 0 0 8px;
        font-family: inherit;
        font-size: 14px;
        letter-spacing: 0;
        text-transform: none;
        color: var(--hs-text);
      }
      .where {
        margin: 14px 0 6px;
        font-family: var(--hs-font-mono);
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--hs-text-muted);
      }
      label {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 2px;
        cursor: pointer;
      }
      input[type='radio'],
      input[type='checkbox'] {
        accent-color: var(--hs-accent);
        width: 16px;
        height: 16px;
        margin: 0;
      }
      .parts {
        display: grid;
        grid-template-columns: 1fr 1fr;
        margin-left: 26px;
      }
      select {
        margin-left: auto;
        padding: 3px 6px;
        border-radius: 6px;
        border: 1px solid color-mix(in srgb, var(--hs-accent) 45%, transparent);
        background: var(--hs-panel-glass);
        font: inherit;
        color: inherit;
      }
      .tilt input {
        flex: 1;
        accent-color: var(--hs-accent);
      }
      .tilt output {
        min-width: 3ch;
        font-family: var(--hs-font-mono);
        text-align: right;
      }
      .note {
        margin: 2px 0 4px;
        font-size: 12px;
        color: var(--hs-text-muted);
      }
      .actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .sites,
      .keys {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .sites li,
      .keys li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 5px 2px;
      }
      .keys kbd {
        font-family: var(--hs-font-mono);
        font-size: 12px;
        padding: 2px 6px;
        border-radius: 5px;
        border: 1px solid color-mix(in srgb, var(--hs-text-muted) 50%, transparent);
      }
      .keys .own kbd {
        border-color: var(--hs-accent);
      }
      .keys .label {
        flex: 1;
      }
      .keys .waiting {
        color: var(--hs-accent);
        font-size: 12px;
      }
    `,
  ];

  /** Opens the panel (on a section, if given) and loads the current settings. */
  show(section?: SectionId): void {
    this.open = true;
    this.confirming = false;
    this.message = '';
    this.query = '';
    if (section) this.section = section;
    void this.load();
    void this.loadPrivacy();
    void this.updateComplete.then(() => (this.renderRoot.querySelector('input[type="search"]') as HTMLInputElement | null)?.focus());
  }

  close(): void {
    if (!this.open) return;
    this.stopCapture();
    this.open = false;
    this.confirming = false;
    this.dispatchEvent(new CustomEvent('hs-panel-closed', { bubbles: true, composed: true }));
  }

  async load(): Promise<void> {
    if (!this.client) return;
    try {
      this.settings = await this.client.get({ op: 'settings.get' });
      const status = await this.client.get({ op: 'status' });
      this.problem = status.settingsProblem ?? '';
    } catch (e) {
      this.message = e instanceof Error ? e.message : String(e);
    }
  }

  /** Filter list and encrypted DNS status. */
  async loadPrivacy(): Promise<void> {
    if (!this.privacy) return;
    try {
      [this.filters, this.dns] = await Promise.all([
        this.privacy.get({ op: 'filters.status' }),
        this.privacy.get({ op: 'dns.status' }),
      ]);
    } catch (e) {
      this.message = e instanceof Error ? e.message : String(e);
    }
  }

  /**
   * Shows the settings group that holds a control (by its test id), in
   * its section, and marks it for a moment. Used by search results and by
   * the tests.
   */
  async reveal(controlId: string): Promise<boolean> {
    const group = this.groups().find((g) => g.ids.some((id) => (id.endsWith('*') ? controlId.startsWith(id.slice(0, -1)) : id === controlId)));
    if (!group) return false;
    this.query = '';
    this.section = group.section;
    await this.updateComplete;
    const el = this.renderRoot.querySelector(`[data-group="${group.id}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
      el.setAttribute('data-flash', '');
      window.setTimeout(() => el.removeAttribute('data-flash'), 1200);
    }
    return true;
  }

  override render() {
    const q = this.query.trim().toLowerCase();
    return html`
      <section role="dialog" aria-label="Settings" data-testid="settings" @keydown=${this.onKey}>
        <header>
          <h2>Settings</h2>
          <button class="icon-button" aria-label="Close Settings" data-testid="settings-close" @click=${() => this.close()}>×</button>
        </header>
        <div class="top">
          <input
            type="search"
            data-testid="set-search"
            aria-label="Search settings"
            placeholder="Search settings"
            .value=${live(this.query)}
            @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)}
          />
        </div>
        ${this.problem ? html`<p class="error" role="alert" data-testid="set-problem">${this.problem}</p>` : nothing}
        <div class="layout">
          <nav role="tablist" aria-label="Settings sections" aria-orientation="vertical">
            ${SECTIONS.map(
              (s) => html`<button
                role="tab"
                data-testid=${`set-nav-${s.id}`}
                aria-selected=${!q && this.section === s.id ? 'true' : 'false'}
                @click=${() => {
                  this.query = '';
                  this.section = s.id;
                }}
              >
                ${s.label}
              </button>`,
            )}
          </nav>
          <div class="body" role="tabpanel" data-testid="set-body">
            ${q ? this.results(q) : this.groups().filter((g) => g.section === this.section).map((g) => this.group(g))}
            ${this.message ? html`<p class="muted" role="status" data-testid="set-message">${this.message}</p>` : nothing}
          </div>
        </div>
      </section>
    `;
  }

  /** Search: every group whose name or words match, under its section's name. */
  private results(q: string) {
    const words = q.split(/\s+/);
    const found = this.groups().filter((g) => {
      const text = `${g.title} ${g.words} ${SECTIONS.find((s) => s.id === g.section)!.label}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
    if (found.length === 0) return html`<p class="empty" data-testid="set-search-empty">No setting matches “${this.query.trim()}”.</p>`;
    return SECTIONS.filter((s) => found.some((g) => g.section === s.id)).map(
      (s) => html`<p class="where">${s.label}</p>
        ${found.filter((g) => g.section === s.id).map((g) => this.group(g))}`,
    );
  }

  private group(g: Group) {
    return html`<div class="group" data-group=${g.id} data-testid=${`set-group-${g.id}`}>
      <h3>${g.title}</h3>
      ${g.render()}
    </div>`;
  }

  /** Every settings group, in section order. */
  private groups(): Group[] {
    const s = this.settings;
    return [
      // ---- General
      {
        id: 'search-engine',
        section: 'general',
        title: 'Search engine',
        words: 'search engine duckduckgo brave startpage google bing address bar',
        ids: ['set-engine-*'],
        render: () => html`${(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map(
          (id) => html`<label>
            <input type="radio" name="engine" data-testid=${`set-engine-${id}`} .checked=${live(s.searchEngine === id)}
              @change=${() => this.save({ searchEngine: id })} />
            ${SEARCH_ENGINES[id].name}
          </label>`,
        )}`,
      },
      {
        id: 'startup',
        section: 'general',
        title: 'On startup',
        words: 'startup start open reopen tabs last time session',
        ids: ['set-startup-*', 'set-session-problem'],
        render: () => html`${this.startup('new-tab', 'Open a new tab')} ${this.startup('last-tabs', 'Reopen your tabs from last time')}
          ${this.sessionProblem ? html`<p class="error" role="alert" data-testid="set-session-problem">${this.sessionProblem}</p>` : nothing}`,
      },
      // ---- Appearance and view
      {
        id: 'theme',
        section: 'appearance',
        title: 'Theme',
        words: 'theme look colour color dark light nebula daylight system',
        ids: ['set-theme-*'],
        render: () => html`${this.themeChoice('nebula', 'Nebula: a synthwave night')}
          ${this.themeChoice('daylight', 'Daylight: a pastel day')}
          ${this.themeChoice('system', "Match the system's light or dark setting")}`,
      },
      {
        id: 'view',
        section: 'appearance',
        title: 'Page view',
        words: 'tilt angle lean direction page movement parallax motion margin space width flat still view default reset',
        ids: ['set-tilt', 'set-tilt-value', 'set-tilt-direction', 'set-parallax', 'set-page-margin', 'set-flat', 'set-view-default'],
        render: () => html`<label class="tilt">
            How far the page leans
            <input type="range" data-testid="set-tilt" min=${MIN_TILT} max=${MAX_TILT} step="1" .value=${live(String(s.pageTilt))}
              @change=${(e: Event) => this.save({ pageTilt: Number((e.target as HTMLInputElement).value) })} />
            <output data-testid="set-tilt-value">${s.pageTilt}°</output>
          </label>
          <p class="note">Less lean gives sharper text.</p>
          <label>
            Which way it leans
            <select data-testid="set-tilt-direction" .value=${live(s.tiltDirection)}
              @change=${(e: Event) => this.save({ tiltDirection: (e.target as HTMLSelectElement).value as TiltDirection })}>
              <option value="right">Right edge back</option>
              <option value="left">Left edge back</option>
            </select>
          </label>
          <label>
            Room movement with the pointer
            <select data-testid="set-parallax" .value=${live(s.parallax)}
              @change=${(e: Event) => this.save({ parallax: (e.target as HTMLSelectElement).value as ParallaxAmount })}>
              <option value="off">Off</option>
              <option value="subtle">Subtle</option>
              <option value="normal">Normal</option>
            </select>
          </label>
          <label>
            Space around the page
            <select data-testid="set-page-margin" .value=${live(s.pageMargin)}
              @change=${(e: Event) => this.save({ pageMargin: (e.target as HTMLSelectElement).value as PageMargin })}>
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="roomy">Roomy</option>
            </select>
          </label>
          <div class="actions">
            <button data-testid="set-flat" @click=${() => this.save({ pageTilt: 0, parallax: 'off' })}>Flat and still</button>
            <button data-testid="set-view-default"
              @click=${() => this.save({ pageTilt: DEFAULT_SETTINGS.pageTilt, tiltDirection: DEFAULT_SETTINGS.tiltDirection, parallax: DEFAULT_SETTINGS.parallax, pageMargin: DEFAULT_SETTINGS.pageMargin })}>
              Default view
            </button>
            <span class="note">"Flat and still": no lean and no movement. "Default view": the lean, direction, movement, and space the app starts with.</span>
          </div>`,
      },
      {
        id: 'layers',
        section: 'appearance',
        title: 'Layers view',
        words: 'layers view depth 3d lift sections images',
        ids: ['set-layers-*'],
        render: () => html`<label>
            <input type="checkbox" data-testid="set-layers-on-open" .checked=${live(s.layersOnOpen)}
              @change=${(e: Event) => this.save({ layersOnOpen: (e.target as HTMLInputElement).checked })} />
            Open pages in the layers view
          </label>
          <p class="note" data-testid="set-layers-sites">${this.siteChoicesText()}</p>
          <div class="actions">
            <button data-testid="set-layers-forget" ?disabled=${Object.keys(s.layersSites).length === 0} @click=${() => this.save({ layersSites: {} })}>
              Forget site choices
            </button>
          </div>`,
      },
      // ---- Tabs
      {
        id: 'tabs',
        section: 'tabs',
        title: 'Tabs',
        words: 'tabs cards size small medium large list top bar show',
        ids: ['set-tab-size', 'set-tab-display'],
        render: () => html`<label>
            Card size
            <select data-testid="set-tab-size" .value=${live(s.tabSize)} @change=${(e: Event) => this.save({ tabSize: (e.target as HTMLSelectElement).value as TabSize })}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label>
            Show tabs as
            <select data-testid="set-tab-display" .value=${live(s.tabDisplay)}
              @change=${(e: Event) => this.save({ tabDisplay: (e.target as HTMLSelectElement).value as TabDisplay })}>
              <option value="cards">Cards</option>
              <option value="list">List in the top bar</option>
            </select>
          </label>`,
      },
      // ---- Privacy and security
      {
        id: 'dns',
        section: 'privacy',
        title: 'Encrypted DNS',
        words: 'dns encrypted quad9 secure automatic network privacy',
        ids: ['set-dns-*'],
        render: () => html`${this.dnsMode('secure', 'Secure: look up sites only through Quad9 (recommended)')}
          ${this.dnsMode('automatic', "Automatic: use Quad9 when possible, otherwise this network's DNS")}
          ${this.dns?.networkForSession ? html`<p class="note" data-testid="set-dns-session">Using this network's DNS until you close the app.</p>` : nothing}`,
      },
      {
        id: 'blocking',
        section: 'privacy',
        title: 'Ad and tracker blocking',
        words: 'ads trackers blocking shield filter lists update',
        ids: ['set-filter-refresh', 'set-filters-*'],
        render: () => html`<label>
            <input type="checkbox" data-testid="set-filter-refresh" .checked=${live(s.filterRefresh)}
              @change=${(e: Event) => this.save({ filterRefresh: (e.target as HTMLInputElement).checked })} />
            Update the filter lists every day
          </label>
          <p class="note" data-testid="set-filters-status">${this.filterText()}</p>
          ${this.filters?.lastError ? html`<p class="note error" role="alert" data-testid="set-filters-error">${this.filters.lastError}</p>` : nothing}
          <div class="actions">
            <button data-testid="set-filters-update" ?disabled=${this.filters?.refreshing ?? false} @click=${this.updateFilters}>
              ${this.filters?.refreshing ? 'Updating…' : 'Update now'}
            </button>
          </div>`,
      },
      {
        id: 'permissions',
        section: 'privacy',
        title: 'Site permissions',
        words: 'permissions camera microphone location sites allow block',
        ids: ['set-perm-*'],
        render: () => this.permissionsList(),
      },
      {
        id: 'passwords',
        section: 'privacy',
        title: 'Passwords',
        words: 'passwords saved sign-ins logins keychain',
        ids: ['set-open-passwords'],
        render: () => html`<p class="note">Saved passwords are encrypted with this computer's keychain and filled only when you pick an account.</p>
          <div class="actions">
            <button data-testid="set-open-passwords" @click=${() => this.dispatchEvent(new CustomEvent('hs-open-passwords', { bubbles: true, composed: true }))}>
              Open saved passwords
            </button>
          </div>`,
      },
      // ---- Economy
      {
        id: 'economy',
        section: 'economy',
        title: 'Economy mode',
        words: 'economy battery power save performance frame rate resolution',
        ids: ['set-economy'],
        render: () => html`<label>
            Economy mode
            <select data-testid="set-economy" .value=${live(s.economy)} @change=${(e: Event) => this.save({ economy: (e.target as HTMLSelectElement).value as EconomyMode })}>
              <option value="off">Off</option>
              <option value="on">On</option>
              <option value="battery">On when running on battery</option>
            </select>
          </label>
          <p class="note">Draws the room at a lower resolution, without glow, sun, parallax, or animations, at most 30 frames a second. Pages stay sharp.</p>`,
      },
      {
        id: 'sleep',
        section: 'economy',
        title: 'Sleeping tabs',
        words: 'sleep sleeping tabs memory unused minutes',
        ids: ['set-tab-sleep'],
        render: () => html`<label>
            Put unused tabs to sleep
            <select data-testid="set-tab-sleep" .value=${live(String(s.tabSleep))}
              @change=${(e: Event) => this.save({ tabSleep: Number((e.target as HTMLSelectElement).value) as TabSleep })}>
              <option value="0">Never</option>
              <option value="5">After 5 minutes</option>
              <option value="15">After 15 minutes</option>
              <option value="30">After 30 minutes</option>
              <option value="60">After 60 minutes</option>
            </select>
          </label>
          <p class="note">A sleeping tab frees its memory and loads again when you open it. Never: the tab in front, tabs playing sound, downloading, or with text typed into a form. In economy mode, after 5 minutes at most.</p>`,
      },
      // ---- Instrument panel
      {
        id: 'instruments',
        section: 'instruments',
        title: 'Instrument panel',
        words: 'instrument panel readouts gauges console network devtools',
        ids: ['set-instruments*', 'set-console-level'],
        render: () => html`${this.check('instruments', 'Show the instrument panel')}
          <div class="parts">
            ${this.check('instrumentsReadouts', 'Page readouts')} ${this.check('instrumentsGauges', 'Browser gauges')}
            ${this.check('instrumentsConsole', 'Console')} ${this.check('instrumentsNetwork', 'Network list')}
          </div>
          <label>
            Console shows
            <select data-testid="set-console-level" .value=${live(s.consoleLevel)}
              @change=${(e: Event) => this.save({ consoleLevel: (e.target as HTMLSelectElement).value as Settings['consoleLevel'] })}>
              <option value="all">All messages</option>
              <option value="warnings">Warnings and errors</option>
              <option value="errors">Errors only</option>
            </select>
          </label>
          <p class="note">Readouts about the page and the browser, kept in memory only.</p>`,
      },
      // ---- Shortcuts
      {
        id: 'shortcuts',
        section: 'shortcuts',
        title: 'Keyboard shortcuts',
        words: 'shortcuts keys keyboard hotkeys remap change',
        ids: ['set-key-*', 'set-keys-*'],
        render: () => this.shortcutsList(),
      },
      // ---- Clear data
      {
        id: 'clear',
        section: 'data',
        title: 'Clear browsing data',
        words: 'clear delete history cookies cache passwords data',
        ids: ['set-clear*'],
        render: () => html`${this.choice('history', 'History')} ${this.choice('cookies', 'Cookies and site data')}
          ${this.choice('cache', 'Cached files')} ${this.choice('passwords', 'Saved passwords')}
          <div class="actions">
            ${this.confirming
              ? html`<div class="confirm" role="alertdialog" aria-label="Clear browsing data">
                  <p>Clear the selected data? This can't be undone.</p>
                  <button class="danger" data-testid="set-clear-confirm" @click=${this.clear}>Clear</button>
                  <button data-testid="set-clear-cancel" @click=${() => (this.confirming = false)}>Cancel</button>
                </div>`
              : html`<button class="danger" data-testid="set-clear"
                  ?disabled=${!this.choices.history && !this.choices.cookies && !this.choices.cache && !this.choices.passwords}
                  @click=${() => (this.confirming = true)}>Clear data</button>`}
          </div>`,
      },
    ];
  }

  // ---- Shortcuts (milestone 11) ------------------------------------------

  private shortcutsList() {
    const own = this.settings.shortcuts;
    const table = bindings(own, this.platform);
    return html`<p class="note">Change a shortcut, then press the new keys. Copy, paste, cut, undo, and select all are kept for text.</p>
      ${this.keyMessage ? html`<p class="note error" role="alert" data-testid="set-keys-message">${this.keyMessage}</p>` : nothing}
      <ul class="keys" data-testid="set-keys-list">
        ${SHORTCUTS.map((sc) => {
          const keys = table.get(sc.name) ?? [];
          const waiting = this.capturing === sc.name;
          return html`<li data-testid="set-key-row" data-name=${sc.name} class=${own[sc.name] ? 'own' : ''}>
            <span class="label">${sc.label}</span>
            ${waiting
              ? html`<span class="waiting" data-testid="set-key-waiting">Press the new keys (Escape to cancel)</span>`
              : html`<span>${keys.map((k, i) => html`${i > 0 ? ' or ' : ''}<kbd data-testid="set-key-keys">${describeCombo(k, this.platform)}</kbd>`)}</span>`}
            <button data-testid=${`set-key-change-${sc.name}`} @click=${() => this.startCapture(sc.name)}>${waiting ? 'Waiting…' : 'Change'}</button>
            ${own[sc.name]
              ? html`<button data-testid=${`set-key-reset-${sc.name}`} aria-label=${`Reset ${sc.label}`} @click=${() => this.setKey(sc.name, null)}>Reset</button>`
              : nothing}
          </li>`;
        })}
      </ul>
      <div class="actions">
        <button data-testid="set-keys-reset-all" ?disabled=${Object.keys(own).length === 0} @click=${() => this.saveKeys({})}>Reset all to the defaults</button>
      </div>`;
  }

  private startCapture(name: ShortcutName): void {
    this.keyMessage = '';
    this.capturing = name;
    this.captureKeys(true);
    document.addEventListener('keydown', this.onCaptureKey, true);
  }

  private stopCapture(): void {
    if (this.capturing === null) return;
    this.capturing = null;
    this.captureKeys(false);
    document.removeEventListener('keydown', this.onCaptureKey, true);
  }

  private readonly onCaptureKey = (e: KeyboardEvent) => {
    const name = this.capturing;
    if (!name) return;
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return; // waiting for the key itself
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      this.stopCapture();
      return;
    }
    const combo = comboFromEvent(e, this.platform);
    this.stopCapture();
    void this.setKey(name, combo);
  };

  private async setKey(name: ShortcutName, combo: string | null): Promise<void> {
    const next = { ...this.settings.shortcuts };
    if (combo === null) delete next[name];
    else next[name] = combo;
    await this.saveKeys(next);
  }

  private async saveKeys(shortcuts: Partial<Record<ShortcutName, string>>): Promise<void> {
    if (!this.client) return;
    try {
      this.settings = await this.client.get({ op: 'settings.set', patch: { shortcuts } });
      this.keyMessage = '';
      this.dispatchEvent(new CustomEvent('hs-settings-changed', { detail: this.settings, bubbles: true, composed: true }));
    } catch (e) {
      this.keyMessage = e instanceof Error ? e.message : String(e);
    }
  }

  // ---- Controls -----------------------------------------------------------

  /** Remembered camera, microphone, and location answers, each removable (milestone 9). */
  private permissionsList() {
    const sites = Object.entries(this.settings.sitePermissions);
    if (sites.length === 0) {
      return html`<p class="note" data-testid="set-perm-empty">
        Sites ask before using your camera, microphone, or location. What you allow or block is listed here.
      </p>`;
    }
    const words = (choices: SiteChoices) =>
      PERMISSION_KINDS.filter((k) => choices[k])
        .map((k) => `${PERMISSION_LABELS[k]}: ${choices[k] === 'allow' ? 'allowed' : 'blocked'}`)
        .join(', ');
    return html`<ul class="sites">
      ${sites.map(
        ([origin, choices]) => html`<li data-testid="set-perm-site">
          <span><strong>${siteName(origin)}</strong><br /><span class="muted">${words(choices)}</span></span>
          <button data-testid="set-perm-remove" aria-label=${`Forget the choices for ${siteName(origin)}`}
            @click=${() => {
              const rest = { ...this.settings.sitePermissions };
              delete rest[origin];
              void this.save({ sitePermissions: rest });
            }}>Forget</button>
        </li>`,
      )}
    </ul>`;
  }

  private startup(mode: StartupMode, label: string) {
    return html`<label>
      <input type="radio" name="startup" data-testid=${`set-startup-${mode}`} .checked=${live(this.settings.onStartup === mode)}
        @change=${() => this.save({ onStartup: mode })} />
      ${label}
    </label>`;
  }

  private check(key: 'instruments' | 'instrumentsReadouts' | 'instrumentsGauges' | 'instrumentsConsole' | 'instrumentsNetwork', label: string) {
    return html`<label>
      <input type="checkbox" data-testid=${`set-${key}`} .checked=${live(this.settings[key])}
        @change=${(e: Event) => this.save({ [key]: (e.target as HTMLInputElement).checked })} />
      ${label}
    </label>`;
  }

  private themeChoice(choice: ThemeChoice, label: string) {
    return html`<label>
      <input type="radio" name="theme" data-testid=${`set-theme-${choice}`} .checked=${live(this.settings.theme === choice)}
        @change=${() => this.save({ theme: choice })} />
      ${label}
    </label>`;
  }

  private dnsMode(mode: DnsMode, label: string) {
    return html`<label>
      <input type="radio" name="dns" data-testid=${`set-dns-${mode}`} .checked=${live(this.settings.dnsMode === mode)}
        @change=${() => this.save({ dnsMode: mode }).then(() => this.loadPrivacy())} />
      ${label}
    </label>`;
  }

  private siteChoicesText(): string {
    const n = Object.keys(this.settings.layersSites).length;
    if (n === 0) return 'Switching the view on a page (the layers button in the top bar, or its shortcut) is remembered for its site.';
    return n === 1
      ? '1 site has its own choice, remembered when you switched the view there.'
      : `${n} sites have their own choice, remembered when you switched the view there.`;
  }

  private filterText(): string {
    const f = this.filters;
    if (!f) return '';
    const when = new Date(f.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    return f.source === 'starter' ? `Lists from ${when}, included with the app.` : `Lists updated ${when}.`;
  }

  private readonly updateFilters = async () => {
    if (!this.privacy) return;
    if (this.filters) this.filters = { ...this.filters, refreshing: true };
    try {
      this.filters = await this.privacy.get({ op: 'filters.update' });
      if (!this.filters.lastError) this.message = 'Filter lists updated.';
    } catch (e) {
      this.message = e instanceof Error ? e.message : String(e);
      await this.loadPrivacy();
    }
  };

  private choice(key: 'history' | 'cookies' | 'cache' | 'passwords', label: string) {
    return html`<label>
      <input type="checkbox" data-testid=${`set-clear-${key}`} .checked=${this.choices[key]}
        @change=${(e: Event) => (this.choices = { ...this.choices, [key]: (e.target as HTMLInputElement).checked })} />
      ${label}
    </label>`;
  }

  private async save(patch: Partial<Settings>): Promise<void> {
    if (!this.client) return;
    try {
      this.settings = await this.client.get({ op: 'settings.set', patch });
      this.problem = '';
      this.message = 'Saved.';
      this.dispatchEvent(new CustomEvent('hs-settings-changed', { detail: this.settings, bubbles: true, composed: true }));
    } catch (e) {
      this.message = e instanceof Error ? e.message : String(e);
      // Show the settings actually in use: the failed change did not happen.
      await this.load();
      this.requestUpdate();
    }
  }

  private readonly clear = async () => {
    this.confirming = false;
    if (!this.client) return;
    try {
      await this.client.get({ op: 'data.clear', ...this.choices });
      this.message = 'Cleared.';
    } catch (e) {
      this.message = e instanceof Error ? e.message : String(e);
    }
  };

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (this.capturing) return; // the capture handles it
      if (this.confirming) this.confirming = false;
      else if (this.query) this.query = '';
      else this.close();
    }
  };
}

customElements.define('hs-settings', HsSettings);

declare global {
  interface HTMLElementTagNameMap {
    'hs-settings': HsSettings;
  }
}
