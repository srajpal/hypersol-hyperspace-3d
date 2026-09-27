import { LitElement, css, html, nothing } from 'lit';

/** The About panel: name, version, engine versions, licence. Escape closes it. */
export class HsAbout extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    appVersion: { type: String },
    electron: { type: String },
    chrome: { type: String },
  };

  declare open: boolean;
  declare appVersion: string;
  declare electron: string;
  declare chrome: string;

  constructor() {
    super();
    this.open = false;
    this.appVersion = '';
    this.electron = '';
    this.chrome = '';
  }

  static override styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 30;
      display: none;
    }
    :host([open]) {
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--hs-background-bottom) 65%, transparent);
    }
    section {
      width: min(440px, calc(100vw - 48px));
      padding: 28px 32px;
      border-radius: 14px;
      border: 1px solid var(--hs-accent);
      background: var(--hs-panel-glass);
      color: var(--hs-text);
      box-shadow: 0 0 calc(40px * var(--hs-glow-strength)) color-mix(in srgb, var(--hs-accent) 40%, transparent);
    }
    h2 {
      margin: 0 0 4px;
      font-size: 22px;
    }
    p {
      margin: 6px 0;
      color: var(--hs-text-muted);
      font-size: 14px;
      line-height: 1.5;
    }
    button {
      margin-top: 16px;
      padding: 6px 18px;
      border-radius: 8px;
      border: 1px solid var(--hs-accent);
      background: transparent;
      color: var(--hs-text);
      font: inherit;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 2px;
    }
  `;

  override updated(): void {
    if (this.open) (this.renderRoot.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  override render() {
    if (!this.open) return nothing;
    return html`
      <section role="dialog" aria-modal="true" aria-labelledby="about-title" data-testid="about" @keydown=${this.onKey}>
        <h2 id="about-title">HyperSol HyperSpace 3D</h2>
        <p data-testid="about-version">Version ${this.appVersion}</p>
        <p data-testid="about-engine">Electron ${this.electron} · Chromium ${this.chrome}</p>
        <p>Copyright 2026 The HyperSpace 3D Authors. Open source under the Apache License 2.0. No telemetry.</p>
        <p>A salute to HyperSol WebSurfer (2001) and the HyperSpace 3D concept (2001 to 2003).</p>
        <button data-testid="about-close" @click=${() => this.close()}>Close</button>
      </section>
    `;
  }

  close(): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent('hs-about-closed', { bubbles: true, composed: true }));
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };
}

customElements.define('hs-about', HsAbout);

declare global {
  interface HTMLElementTagNameMap {
    'hs-about': HsAbout;
  }
}
