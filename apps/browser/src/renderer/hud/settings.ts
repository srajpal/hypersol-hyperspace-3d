import { LitElement, css, html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import type { DnsStatus, FilterStatus } from '../../shared/privacy';
import {
  defaults,
  MAX_TILT,
  MIN_TILT,
  SEARCH_ENGINES,
  type DnsMode,
  type SearchEngineId,
  type Settings,
  type StartupMode,
  type ThemeChoice,
} from '../../shared/settings';
import { PERMISSION_KINDS, PERMISSION_LABELS, type SiteChoices } from '../../shared/permissions';
import type { DataClient, PrivacyClient } from '../data';
import { panelStyles } from './panel-styles';
import { siteName } from './prompts';

/**
 * The Settings panel: search engine, what opens at startup, encrypted
 * DNS, the filter lists, and clearing browsing data. Changes save at
 * once. Escape closes it.
 *
 * Events: hs-panel-closed, hs-settings-changed (detail: Settings).
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
  client: DataClient | null = null;
  privacy: PrivacyClient | null = null;

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
  }

  static override styles = [
    panelStyles,
    css`
      .body {
        flex: 1;
        overflow: auto;
      }
      fieldset {
        margin: 0 0 16px;
        padding: 0;
        border: 0;
      }
      legend {
        padding: 0;
        margin: 6px 0 8px;
        font-family: var(--hs-font-mono);
        font-size: 12px;
        font-weight: 600;
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
        margin: 4px 0 0 26px;
        font-size: 12px;
        color: var(--hs-text-muted);
      }
      .sites {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .sites li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 5px 2px;
      }
      .actions {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 8px;
      }
    `,
  ];

  /** Opens the panel and loads the current settings. */
  show(): void {
    this.open = true;
    this.confirming = false;
    this.message = '';
    void this.load();
    void this.loadPrivacy();
    void this.updateComplete.then(() =>
      (this.renderRoot.querySelector('input[type="radio"]:checked') as HTMLInputElement | null)?.focus(),
    );
  }

  close(): void {
    if (!this.open) return;
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

  override render() {
    return html`
      <section role="dialog" aria-label="Settings" data-testid="settings" @keydown=${this.onKey}>
        <header>
          <h2>Settings</h2>
          <button class="icon-button" aria-label="Close Settings" data-testid="settings-close" @click=${() => this.close()}>
            ×
          </button>
        </header>
        <div class="body">
          ${this.problem ? html`<p class="error" role="alert" data-testid="set-problem">${this.problem}</p>` : nothing}
          <fieldset>
            <legend>Look</legend>
            ${this.themeChoice('nebula', 'Nebula: a synthwave night')}
            ${this.themeChoice('daylight', 'Daylight: a pastel day')}
            ${this.themeChoice('system', "Match the system's light or dark setting")}
            <label class="tilt">
              Page tilt
              <input
                type="range"
                data-testid="set-tilt"
                min=${MIN_TILT}
                max=${MAX_TILT}
                step="1"
                .value=${live(String(this.settings.pageTilt))}
                @change=${(e: Event) => this.save({ pageTilt: Number((e.target as HTMLInputElement).value) })}
              />
              <output data-testid="set-tilt-value">${this.settings.pageTilt}°</output>
            </label>
            <p class="note">Less tilt gives sharper text.</p>
          </fieldset>
          <fieldset>
            <legend>Instrument panel</legend>
            ${this.check('instruments', 'Show the instrument panel')}
            <div class="parts">
              ${this.check('instrumentsReadouts', 'Page readouts')} ${this.check('instrumentsGauges', 'Browser gauges')}
              ${this.check('instrumentsConsole', 'Console')} ${this.check('instrumentsNetwork', 'Network list')}
            </div>
            <label>
              Console shows
              <select data-testid="set-console-level" .value=${live(this.settings.consoleLevel)}
                @change=${(e: Event) => this.save({ consoleLevel: (e.target as HTMLSelectElement).value as Settings['consoleLevel'] })}>
                <option value="all">All messages</option>
                <option value="warnings">Warnings and errors</option>
                <option value="errors">Errors only</option>
              </select>
            </label>
            <p class="note">Readouts about the page and the browser, kept in memory only.</p>
          </fieldset>
          <fieldset>
            <legend>Search engine</legend>
            ${(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map(
              (id) => html`<label>
                <input
                  type="radio"
                  name="engine"
                  data-testid=${`set-engine-${id}`}
                  .checked=${live(this.settings.searchEngine === id)}
                  @change=${() => this.save({ searchEngine: id })}
                />
                ${SEARCH_ENGINES[id].name}
              </label>`,
            )}
          </fieldset>
          <fieldset>
            <legend>On startup</legend>
            ${this.startup('new-tab', 'Open a new tab')} ${this.startup('last-tabs', 'Reopen your tabs from last time')}
            ${this.sessionProblem
              ? html`<p class="error" role="alert" data-testid="set-session-problem">${this.sessionProblem}</p>`
              : nothing}
          </fieldset>
          <fieldset>
            <legend>Layers view</legend>
            <label>
              <input
                type="checkbox"
                data-testid="set-layers-on-open"
                .checked=${live(this.settings.layersOnOpen)}
                @change=${(e: Event) => this.save({ layersOnOpen: (e.target as HTMLInputElement).checked })}
              />
              Open pages in the layers view
            </label>
            <p class="note" data-testid="set-layers-sites">${this.siteChoicesText()}</p>
            <div class="actions">
              <button
                data-testid="set-layers-forget"
                ?disabled=${Object.keys(this.settings.layersSites).length === 0}
                @click=${() => this.save({ layersSites: {} })}
              >
                Forget site choices
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>Site permissions</legend>
            ${this.permissionsList()}
          </fieldset>
          <fieldset>
            <legend>Encrypted DNS</legend>
            ${this.dnsMode('secure', 'Secure: look up sites only through Quad9 (recommended)')}
            ${this.dnsMode('automatic', "Automatic: use Quad9 when possible, otherwise this network's DNS")}
            ${this.dns?.networkForSession
              ? html`<p class="note" data-testid="set-dns-session">Using this network's DNS until you close the app.</p>`
              : nothing}
          </fieldset>
          <fieldset>
            <legend>Ad and tracker blocking</legend>
            <label>
              <input
                type="checkbox"
                data-testid="set-filter-refresh"
                .checked=${live(this.settings.filterRefresh)}
                @change=${(e: Event) => this.save({ filterRefresh: (e.target as HTMLInputElement).checked })}
              />
              Update the filter lists every day
            </label>
            <p class="note" data-testid="set-filters-status">${this.filterText()}</p>
            ${this.filters?.lastError
              ? html`<p class="note error" role="alert" data-testid="set-filters-error">${this.filters.lastError}</p>`
              : nothing}
            <div class="actions">
              <button data-testid="set-filters-update" ?disabled=${this.filters?.refreshing ?? false} @click=${this.updateFilters}>
                ${this.filters?.refreshing ? 'Updating…' : 'Update now'}
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>Clear browsing data</legend>
            ${this.choice('history', 'History')} ${this.choice('cookies', 'Cookies and site data')}
            ${this.choice('cache', 'Cached files')} ${this.choice('passwords', 'Saved passwords')}
            <div class="actions">
              ${this.confirming
                ? html`<div class="confirm" role="alertdialog" aria-label="Clear browsing data">
                    <p>Clear the selected data? This can't be undone.</p>
                    <button class="danger" data-testid="set-clear-confirm" @click=${this.clear}>Clear</button>
                    <button data-testid="set-clear-cancel" @click=${() => (this.confirming = false)}>Cancel</button>
                  </div>`
                : html`<button
                    class="danger"
                    data-testid="set-clear"
                    ?disabled=${!this.choices.history && !this.choices.cookies && !this.choices.cache && !this.choices.passwords}
                    @click=${() => (this.confirming = true)}
                  >
                    Clear data
                  </button>`}
            </div>
          </fieldset>
          ${this.message ? html`<p class="muted" role="status" data-testid="set-message">${this.message}</p>` : nothing}
        </div>
      </section>
    `;
  }

  private startup(mode: StartupMode, label: string) {
    return html`<label>
      <input
        type="radio"
        name="startup"
        data-testid=${`set-startup-${mode}`}
        .checked=${live(this.settings.onStartup === mode)}
        @change=${() => this.save({ onStartup: mode })}
      />
      ${label}
    </label>`;
  }

  private check(key: 'instruments' | 'instrumentsReadouts' | 'instrumentsGauges' | 'instrumentsConsole' | 'instrumentsNetwork', label: string) {
    return html`<label>
      <input
        type="checkbox"
        data-testid=${`set-${key}`}
        .checked=${live(this.settings[key])}
        @change=${(e: Event) => this.save({ [key]: (e.target as HTMLInputElement).checked })}
      />
      ${label}
    </label>`;
  }

  private themeChoice(choice: ThemeChoice, label: string) {
    return html`<label>
      <input
        type="radio"
        name="theme"
        data-testid=${`set-theme-${choice}`}
        .checked=${live(this.settings.theme === choice)}
        @change=${() => this.save({ theme: choice })}
      />
      ${label}
    </label>`;
  }

  private dnsMode(mode: DnsMode, label: string) {
    return html`<label>
      <input
        type="radio"
        name="dns"
        data-testid=${`set-dns-${mode}`}
        .checked=${live(this.settings.dnsMode === mode)}
        @change=${() => this.save({ dnsMode: mode }).then(() => this.loadPrivacy())}
      />
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

  private choice(key: 'history' | 'cookies' | 'cache' | 'passwords', label: string) {
    return html`<label>
      <input
        type="checkbox"
        data-testid=${`set-clear-${key}`}
        .checked=${this.choices[key]}
        @change=${(e: Event) => (this.choices = { ...this.choices, [key]: (e.target as HTMLInputElement).checked })}
      />
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
      if (this.confirming) this.confirming = false;
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
