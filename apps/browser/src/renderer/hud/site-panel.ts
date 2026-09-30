import { LitElement, css, html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import {
  PERMISSION_KINDS,
  PERMISSION_LABELS,
  type PermissionChoice,
  type PermissionKind,
  type SitePermissions,
} from '../../shared/permissions';
import type { PermissionsClient } from '../data';
import { siteName } from './prompts';
import { watchDismiss } from './dismiss';

/**
 * The site panel (milestone 9), opened from the site button in the top
 * bar: whether the page is secure, and its camera, microphone, and
 * location choices, each Ask, Allow, or Block. A choice made in a private
 * tab is kept in memory only. Escape or a click elsewhere closes it.
 *
 * Events: hs-site-closed.
 */
export class HsSitePanel extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    site: { state: true },
    message: { state: true },
  };

  declare open: boolean;
  declare site: SitePermissions | null;
  declare message: string;
  client: PermissionsClient | null = null;
  /** The focused tab's page (its web contents id), or null. */
  tab: () => number | null = () => null;

  constructor() {
    super();
    this.open = false;
    this.site = null;
    this.message = '';
  }

  static override styles = css`
    :host {
      position: fixed;
      top: 58px;
      left: 150px;
      z-index: 19;
      width: min(340px, calc(100vw - 48px));
      display: none;
      color: var(--hs-text);
      font-size: 14px;
    }
    :host([open]) {
      display: block;
    }
    section {
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 50%, transparent);
      background: color-mix(in srgb, var(--hs-panel-glass) 96%, transparent);
      box-shadow: 0 10px 30px var(--hs-shadow);
    }
    h2 {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .security {
      margin: 0 0 12px;
      font-size: 12px;
      color: var(--hs-text-muted);
    }
    .security[data-insecure] {
      color: var(--hs-warning);
    }
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 5px 0;
    }
    .given {
      font-size: 11px;
      color: var(--hs-warning);
      margin-left: 6px;
    }
    select {
      padding: 3px 6px;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 45%, transparent);
      background: var(--hs-panel-glass);
      font: inherit;
      color: inherit;
    }
    select:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 1px;
    }
    .note {
      margin: 10px 0 0;
      font-size: 12px;
      color: var(--hs-text-muted);
    }
  `;

  /** Opens the panel for the focused page. */
  async show(): Promise<void> {
    this.open = true;
    this.message = '';
    await this.refresh();
    void this.updateComplete.then(() => (this.renderRoot.querySelector('select') as HTMLSelectElement | null)?.focus());
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('hs-site-closed', { bubbles: true, composed: true }));
  }

  async refresh(): Promise<void> {
    const tab = this.tab();
    if (!this.client || tab === null) {
      this.site = null;
      return;
    }
    try {
      this.site = await this.client.get({ op: 'site', tab });
    } catch (e) {
      this.message = e instanceof Error ? e.message : String(e);
    }
  }

  private stopDismiss: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    // The site button opens and closes the panel itself.
    this.stopDismiss = watchDismiss(this, () => this.open, () => this.close(), (path) =>
      path.some((t) => t instanceof HTMLElement && t.dataset['testid'] === 'site-button'));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopDismiss?.();
  }

  override render() {
    const s = this.site;
    return html`<section role="dialog" aria-label="Site settings" data-testid="site-panel" @keydown=${this.onKey}>
      ${s
        ? html`<h2 data-testid="site-origin">${siteName(s.origin)}</h2>
            <p class="security" ?data-insecure=${s.insecure}>
              ${s.insecure ? 'Not secure: this page uses http, without encryption.' : 'Connection is encrypted (https).'}
            </p>
            ${PERMISSION_KINDS.map((k) => this.row(s, k))}
            <p class="note">
              ${s.private
                ? 'Private tab: these choices are forgotten when the last private tab closes.'
                : 'Remembered for this site. A change applies the next time the site asks.'}
            </p>`
        : html`<p class="note">No web page in this tab.</p>`}
      ${this.message ? html`<p class="note" role="status">${this.message}</p>` : nothing}
    </section>`;
  }

  private row(s: SitePermissions, kind: PermissionKind) {
    const state = s.states[kind];
    const value = state === 'once' ? 'ask' : state;
    return html`<label>
      <span>
        ${PERMISSION_LABELS[kind]}
        ${s.given.includes(kind) ? html`<span class="given" data-testid=${`site-given-${kind}`}>given to this page</span>` : nothing}
        ${state === 'once' ? html`<span class="given">allowed this time</span>` : nothing}
      </span>
      <select data-testid=${`site-${kind}`} .value=${live(value)} @change=${(e: Event) => this.set(kind, (e.target as HTMLSelectElement).value as 'ask' | PermissionChoice)}>
        <option value="ask">Ask</option>
        <option value="allow">Allow</option>
        <option value="block">Block</option>
      </select>
    </label>`;
  }

  private async set(kind: PermissionKind, state: 'ask' | PermissionChoice): Promise<void> {
    const tab = this.tab();
    const origin = this.site?.origin;
    if (!this.client || tab === null || origin === undefined) return;
    try {
      // For the site shown here: the main process refuses it if the tab has left that site.
      this.site = await this.client.get({ op: 'site.set', tab, origin, kind, state });
      this.message = 'Saved.';
    } catch (e) {
      this.message = e instanceof Error ? e.message : String(e);
    }
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close();
    }
  };
}

customElements.define('hs-site-panel', HsSitePanel);

declare global {
  interface HTMLElementTagNameMap {
    'hs-site-panel': HsSitePanel;
  }
}
