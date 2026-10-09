import { LitElement, css, html, nothing } from 'lit';

/**
 * Looking around the room (milestone 27): while the camera is away from
 * the desk, a small notice at the top says so, how to move, and how to
 * come back, with a "Back to the desk" button. It takes the keyboard when
 * looking around starts, so the keys move the camera, not the page.
 * Entering and leaving are announced to screen readers.
 *
 * Events: hs-look-back, the button.
 */
export class HsLookNotice extends LitElement {
  // Focusing the element focuses the notice inside it: a panel that closes gives the keyboard back this way.
  static override shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static override properties = {
    open: { type: Boolean, reflect: true },
    said: { state: true },
  };

  declare open: boolean;
  /** What the live region last said. */
  declare said: string;

  constructor() {
    super();
    this.open = false;
    this.said = '';
  }

  static override styles = css`
    :host {
      position: fixed;
      left: 50%;
      top: 76px;
      transform: translateX(-50%);
      z-index: 16;
      color: var(--hs-text);
      font-size: 13px;
    }
    .notice {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 10px 8px 14px;
      border-radius: 12px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 55%, transparent);
      background: color-mix(in srgb, var(--hs-panel-glass) 96%, transparent);
      box-shadow: 0 10px 30px var(--hs-shadow);
      outline: none;
    }
    .notice:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 2px;
    }
    strong {
      font-weight: 600;
    }
    .keys {
      color: var(--hs-text-muted);
    }
    kbd {
      font: inherit;
      padding: 0 4px;
      border-radius: 4px;
      border: 1px solid color-mix(in srgb, var(--hs-text) 25%, transparent);
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
      border-radius: 8px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 55%, transparent);
      background: transparent;
      padding: 4px 12px;
      white-space: nowrap;
    }
    button:hover {
      background: color-mix(in srgb, var(--hs-accent) 16%, transparent);
    }
    button:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 1px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    @media (max-width: 760px) {
      .keys {
        display: none;
      }
    }
  `;

  /** Starts looking around: shown, announced, and given the keyboard. */
  show(): void {
    this.open = true;
    this.said = 'Looking around the room. Escape returns to the desk.';
    this.takeKeys();
  }

  /** Gives the keyboard to the notice (looking around: the keys move the camera). */
  takeKeys(): void {
    void this.updateComplete.then(() => (this.renderRoot.querySelector('.notice') as HTMLElement | null)?.focus());
  }

  /** Back at the desk (or on the way): hidden and announced. */
  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.said = 'Back at the desk.';
  }

  /** Whether the keyboard is in the notice (its own keys then move the camera). */
  get hasFocus(): boolean {
    return this.open && this.matches(':focus-within');
  }

  override render() {
    return html`${this.open
        ? html`<section class="notice" tabindex="-1" role="region" aria-label="Looking around the room" data-testid="look-notice">
            <strong>Looking around</strong>
            <span class="keys"
              >Drag or <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> to turn, <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to
              move, the wheel or <kbd>+</kbd><kbd>−</kbd> to come closer, <kbd>Esc</kbd> to go back</span
            >
            <button data-testid="look-back" @click=${() => this.dispatchEvent(new CustomEvent('hs-look-back', { bubbles: true, composed: true }))}>
              Back to the desk
            </button>
          </section>`
        : nothing}
      <div class="sr-only" role="status" aria-live="polite" data-testid="look-said">${this.said}</div>`;
  }
}

customElements.define('hs-look-notice', HsLookNotice);

declare global {
  interface HTMLElementTagNameMap {
    'hs-look-notice': HsLookNotice;
  }
}
