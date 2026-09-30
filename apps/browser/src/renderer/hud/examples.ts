import { LitElement, css, html, nothing } from 'lit';
import { EXAMPLES, HOLOML_REPOSITORY, HOLOML_SPEC, exampleSource, exampleUrl } from '../examples';
import { focusedElement, keepTabInside, returnFocus } from './dialog-focus';

/**
 * The HoloML examples (milestone 17; owner, prompt 85, and prompt 86, Q2
 * a): a card for each example site, with its picture, a line about it,
 * Open, and its source in the holoml repository; and links to HoloML's
 * repository and specification (prompt 88). Opened from the start panel's
 * "Try HoloML", the menu, and Ctrl+Shift+E; Escape closes it. Every link
 * opens in the tab in front, and nothing is fetched before one is chosen.
 * Tab stays inside it, and closing puts the focus back where it was.
 *
 * Events: hs-open-example (detail: the address), hs-examples-closed
 * (detail: whether the focus went back to where it was).
 */
export class HsExamples extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
  };

  declare open: boolean;
  /** What had the keyboard when the dialog opened. */
  private focusBefore: Element | null = null;

  constructor() {
    super();
    this.open = false;
  }

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) this.focusBefore = focusedElement();
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
      background: color-mix(in srgb, var(--hs-background-bottom) 70%, transparent);
    }
    section {
      box-sizing: border-box;
      width: min(920px, calc(100vw - 48px));
      max-height: calc(100vh - 96px);
      overflow: auto;
      padding: 24px 28px 22px;
      border-radius: 14px;
      border: 1px solid var(--hs-accent);
      background: var(--hs-panel-glass);
      color: var(--hs-text);
      box-shadow: 0 0 calc(40px * var(--hs-glow-strength)) color-mix(in srgb, var(--hs-accent) 40%, transparent);
    }
    header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
    }
    h2 {
      margin: 0;
      font-size: 22px;
    }
    .intro {
      margin: 6px 0 8px;
      color: var(--hs-text-muted);
      font-size: 14px;
      line-height: 1.5;
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 18px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 18px;
    }
    li {
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 35%, transparent);
      background: color-mix(in srgb, var(--hs-background-bottom) 55%, transparent);
    }
    img {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 10;
      object-fit: cover;
    }
    .text {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px 14px 14px;
      flex: 1;
    }
    h3 {
      margin: 0;
      font-size: 17px;
    }
    p {
      margin: 0;
      font-size: 14px;
      line-height: 1.45;
    }
    .features {
      color: var(--hs-text-muted);
      font-size: 12.5px;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: auto;
      padding-top: 8px;
    }
    .address {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--hs-text-muted);
      font-family: var(--hs-font-mono);
      font-size: 11px;
    }
    button {
      padding: 6px 18px;
      border-radius: 8px;
      border: 1px solid var(--hs-accent);
      background: transparent;
      color: var(--hs-text);
      font: inherit;
      cursor: pointer;
      flex: none;
    }
    button.open {
      background: color-mix(in srgb, var(--hs-accent) 22%, transparent);
    }
    button:hover {
      background: color-mix(in srgb, var(--hs-accent) 30%, transparent);
    }
    button:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 2px;
    }
  `;

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) (this.renderRoot.querySelector('button.open') as HTMLButtonElement | null)?.focus();
  }

  override render() {
    if (!this.open) return nothing;
    return html`
      <section role="dialog" aria-modal="true" aria-labelledby="examples-title" data-testid="examples" @keydown=${this.onKey}>
        <header>
          <h2 id="examples-title">HoloML examples</h2>
          <button data-testid="examples-close" @click=${() => this.close()}>Close</button>
        </header>
        <p class="intro">
          Sites written in HoloML, the markup language for 3D pages made alongside this browser. Each opens from the internet when you choose it;
          nothing is fetched before.
        </p>
        <div class="links">
          <button data-testid="examples-repository" data-url=${HOLOML_REPOSITORY} @click=${() => this.go(HOLOML_REPOSITORY)}>HoloML on GitHub</button>
          <button data-testid="examples-spec" data-url=${HOLOML_SPEC} @click=${() => this.go(HOLOML_SPEC)}>The HoloML specification</button>
        </div>
        <ul>
          ${EXAMPLES.map(
            (ex) => html`<li data-testid=${`example-${ex.id}`}>
              <img src=${ex.picture} alt=${`${ex.name}: a picture of the site in HyperSpace 3D`} />
              <div class="text">
                <h3>${ex.name}</h3>
                <p>${ex.line}</p>
                <p class="features">${ex.features}</p>
                <div class="actions">
                  <button class="open" data-testid=${`example-open-${ex.id}`} aria-label=${`Open ${ex.name}`} @click=${() => this.openExample(ex.id)}>
                    Open
                  </button>
                  <button
                    data-testid=${`example-source-${ex.id}`}
                    data-url=${exampleSource(ex.id)}
                    aria-label=${`${ex.name}'s source, in the HoloML repository`}
                    @click=${() => this.go(exampleSource(ex.id))}
                  >
                    Source
                  </button>
                  <span class="address" title=${exampleUrl(ex.id)}>${exampleUrl(ex.id)}</span>
                </div>
              </div>
            </li>`,
          )}
        </ul>
      </section>
    `;
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    const returned = returnFocus(this.focusBefore);
    this.focusBefore = null;
    this.dispatchEvent(new CustomEvent('hs-examples-closed', { detail: returned, bubbles: true, composed: true }));
  }

  private openExample(id: string): void {
    this.go(exampleUrl(id));
  }

  /** Opens an address in the tab in front, and closes. */
  private go(url: string): void {
    this.open = false;
    this.focusBefore = null; // the page it opens takes the keyboard
    this.dispatchEvent(new CustomEvent('hs-open-example', { detail: url, bubbles: true, composed: true }));
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close();
    } else {
      keepTabInside(this.renderRoot as ShadowRoot, e);
    }
  };
}

customElements.define('hs-examples', HsExamples);

declare global {
  interface HTMLElementTagNameMap {
    'hs-examples': HsExamples;
  }
}
