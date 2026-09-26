import { LitElement, css, html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import type { ShieldReport } from '../../shared/privacy';
import type { PrivacyClient } from '../data';

const TYPE_LABELS: Record<string, string> = {
  mainFrame: 'Page',
  subFrame: 'Frame',
  script: 'Script',
  image: 'Image',
  stylesheet: 'Style',
  xhr: 'Request',
  media: 'Media',
  font: 'Font',
  ping: 'Ping',
  webSocket: 'Socket',
  object: 'Plug-in',
};

function split(url: string): { host: string; rest: string } {
  try {
    const u = new URL(url);
    return { host: u.hostname, rest: `${u.pathname}${u.search}` };
  } catch {
    return { host: url, rest: '' };
  }
}

/**
 * The privacy shield (bottom right): how many requests were blocked on
 * the focused page, and a popover listing them with a "Pause on this
 * site" switch (TODO.md milestone 4, Q3 a). Escape closes the popover and
 * returns the keyboard to the button.
 *
 * Events: hs-shield-paused (detail: { site, paused }), after the change is saved.
 */
export class HsShield extends LitElement {
  static override properties = {
    count: { type: Number },
    disabled: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
    report: { state: true },
    message: { state: true },
  };

  declare count: number;
  /** No web page in the focused tab (a start tab): nothing to show. */
  declare disabled: boolean;
  declare open: boolean;
  declare report: ShieldReport | null;
  declare message: string;
  client: PrivacyClient | null = null;
  /** The focused tab's page (its web contents id), or null. */
  tab: () => number | null = () => null;

  constructor() {
    super();
    this.count = 0;
    this.disabled = true;
    this.open = false;
    this.report = null;
    this.message = '';
  }

  static override styles = css`
    :host {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 14;
      display: block;
      color: var(--hs-text);
      font-size: 14px;
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    button:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 2px;
    }
    .shield {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px 6px 9px;
      border-radius: 10px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 60%, transparent);
      background: color-mix(in srgb, var(--hs-panel-glass) 92%, transparent);
      box-shadow: 0 0 calc(18px * var(--hs-glow-strength)) color-mix(in srgb, var(--hs-accent) 30%, transparent);
    }
    .shield:hover {
      background: color-mix(in srgb, var(--hs-accent) 16%, var(--hs-panel-glass));
    }
    :host([disabled]) .shield {
      opacity: 0.55;
      cursor: default;
    }
    svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: var(--hs-accent);
      stroke-width: 2;
    }
    /* An LCD-style readout, a nod to 1980s and 1990s hardware. */
    .count {
      min-width: 3ch;
      font-family: var(--hs-font-mono);
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.08em;
      text-align: right;
      color: var(--hs-accent);
      text-shadow: 0 0 calc(8px * var(--hs-glow-strength)) var(--hs-accent);
    }
    section {
      position: absolute;
      right: 0;
      bottom: calc(100% + 10px);
      box-sizing: border-box;
      width: min(380px, calc(100vw - 48px));
      max-height: min(460px, calc(100vh - 140px));
      display: flex;
      flex-direction: column;
      padding: 14px 16px 12px;
      border-radius: 14px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 45%, transparent);
      background: color-mix(in srgb, var(--hs-panel-glass) 96%, transparent);
      box-shadow:
        0 12px 40px var(--hs-shadow),
        0 0 calc(30px * var(--hs-glow-strength)) color-mix(in srgb, var(--hs-accent) 25%, transparent);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
    }
    .close {
      border: 0;
      background: transparent;
      width: 28px;
      height: 28px;
      font-size: 18px;
      border-radius: 8px;
    }
    .site {
      margin: 6px 0 8px;
      color: var(--hs-text-muted);
      overflow-wrap: anywhere;
    }
    label {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 0;
      cursor: pointer;
    }
    input[type='checkbox'] {
      accent-color: var(--hs-accent);
      width: 16px;
      height: 16px;
      margin: 0;
    }
    .summary {
      margin: 8px 0 6px;
    }
    .muted {
      color: var(--hs-text-muted);
    }
    .error {
      color: var(--hs-warning);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow: auto;
      border-top: 1px solid color-mix(in srgb, var(--hs-accent) 25%, transparent);
    }
    li {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0 8px;
      padding: 6px 0;
      border-bottom: 1px solid color-mix(in srgb, var(--hs-accent) 12%, transparent);
    }
    .host {
      overflow-wrap: anywhere;
    }
    .type {
      font-size: 12px;
      color: var(--hs-text-muted);
    }
    .rest {
      grid-column: 1 / -1;
      font-size: 12px;
      color: var(--hs-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;

  /** Opens or closes the popover. */
  toggle(): void {
    if (this.open) this.close();
    else if (!this.disabled) {
      this.open = true;
      void this.refresh();
      void this.updateComplete.then(() => (this.renderRoot.querySelector('section') as HTMLElement | null)?.focus());
    }
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    void this.updateComplete.then(() => (this.renderRoot.querySelector('.shield') as HTMLElement | null)?.focus());
  }

  /** Reloads what was blocked on the focused page (while the popover is open). */
  async refresh(): Promise<void> {
    const tab = this.tab();
    if (!this.open || !this.client || tab === null) {
      if (tab === null) this.report = null;
      return;
    }
    try {
      this.report = await this.client.get({ op: 'shield.report', tab });
      this.message = '';
    } catch (e) {
      this.message = e instanceof Error ? e.message : String(e);
    }
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('disabled') && this.disabled) this.open = false;
  }

  override render() {
    const label = this.disabled ? 'Privacy shield' : `Privacy shield: ${this.count} blocked on this page`;
    return html`
      ${this.open ? this.renderPopover() : nothing}
      <button
        class="shield"
        data-testid="shield"
        aria-label=${label}
        aria-haspopup="dialog"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-disabled=${this.disabled ? 'true' : 'false'}
        @click=${() => this.toggle()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /></svg>
        <span class="count" data-testid="shield-count">${this.disabled ? '–' : this.count}</span>
      </button>
    `;
  }

  private renderPopover() {
    const r = this.report;
    const site = r?.site ?? '';
    return html`<section role="dialog" aria-label="Privacy shield" tabindex="-1" data-testid="shield-popover" @keydown=${this.onKey}>
      <header>
        <h2>Privacy shield</h2>
        <button class="close" aria-label="Close the shield" data-testid="shield-close" @click=${() => this.close()}>×</button>
      </header>
      ${site
        ? html`<p class="site">${site}</p>
            <label>
              <input
                type="checkbox"
                role="switch"
                data-testid="shield-pause"
                .checked=${live(r?.paused ?? false)}
                @change=${(e: Event) => this.pause(site, (e.target as HTMLInputElement).checked)}
              />
              Pause the shield on this site
            </label>`
        : nothing}
      ${this.message ? html`<p class="error" role="alert">${this.message}</p>` : nothing}
      <p class="summary" data-testid="shield-summary">${this.summary(r)}</p>
      ${r && r.items.length > 0
        ? html`<ul data-testid="shield-list" aria-label="Blocked on this page">
            ${[...r.items].reverse().map((item) => {
              const { host, rest } = split(item.url);
              return html`<li>
                <span class="host">${host}</span><span class="type">${TYPE_LABELS[item.type] ?? 'Other'}</span>
                ${rest && rest !== '/' ? html`<span class="rest" title=${item.url}>${rest}</span>` : nothing}
              </li>`;
            })}
          </ul>`
        : nothing}
    </section>`;
  }

  private summary(r: ShieldReport | null): string {
    if (!r) return 'Loading…';
    if (r.paused) return 'Paused: nothing is blocked on this site.';
    if (r.count === 0) return 'Nothing blocked on this page.';
    const shown = r.items.length < r.count ? ` (the latest ${r.items.length} are listed)` : '';
    return `${r.count} ${r.count === 1 ? 'request' : 'requests'} blocked on this page${shown}.`;
  }

  private async pause(site: string, paused: boolean): Promise<void> {
    const tab = this.tab();
    if (!this.client || tab === null) return;
    try {
      await this.client.get({ op: 'shield.pause', tab, site, paused });
      this.dispatchEvent(new CustomEvent('hs-shield-paused', { detail: { site, paused }, bubbles: true, composed: true }));
    } catch (e) {
      this.message = e instanceof Error ? e.message : String(e);
    }
    await this.refresh();
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close();
    }
  };
}

customElements.define('hs-shield', HsShield);

declare global {
  interface HTMLElementTagNameMap {
    'hs-shield': HsShield;
  }
}
