import { LitElement, css, html } from 'lit';

export interface NoticeAction {
  id: string;
  label: string;
}

export interface Notice {
  text: string;
  kind: 'done' | 'failed';
  actions: NoticeAction[];
}

/** How long a notice stays, unless the pointer or the keyboard is on it. */
export const NOTICE_MS = 8000;

/**
 * A short notice at the bottom of the window (milestone 9): a download
 * finished or failed (owner feedback on milestone 8: no sign that a
 * download had finished). It goes by itself after a few seconds, stays
 * while the pointer or keyboard is on it, and is announced to screen
 * readers.
 *
 * Events: hs-notice-action (detail: the action's id).
 */
export class HsNotice extends LitElement {
  static override properties = {
    notice: { state: true },
  };

  declare notice: Notice | null;
  private timer: number | undefined;
  private held = false;

  constructor() {
    super();
    this.notice = null;
  }

  static override styles = css`
    :host {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      z-index: 16;
      max-width: min(560px, calc(100vw - 48px));
      display: block;
      color: var(--hs-text);
      font-size: 14px;
    }
    .notice {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 55%, transparent);
      background: color-mix(in srgb, var(--hs-panel-glass) 96%, transparent);
      box-shadow:
        0 10px 30px var(--hs-shadow),
        0 0 calc(24px * var(--hs-glow-strength)) color-mix(in srgb, var(--hs-accent) 30%, transparent);
    }
    .notice[data-kind='failed'] {
      border-color: var(--hs-warning);
    }
    .text {
      flex: 1;
      min-width: 12ch;
      overflow-wrap: anywhere;
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
      border-radius: 8px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 55%, transparent);
      background: transparent;
      padding: 4px 10px;
    }
    button:hover {
      background: color-mix(in srgb, var(--hs-accent) 16%, transparent);
    }
    button:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 2px;
    }
    .close {
      border: 0;
      padding: 2px 6px;
      font-size: 16px;
      line-height: 1;
    }
  `;

  show(notice: Notice): void {
    this.notice = notice;
    this.schedule();
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.notice = null;
  }

  private schedule(): void {
    window.clearTimeout(this.timer);
    if (!this.held) this.timer = window.setTimeout(() => this.hide(), NOTICE_MS);
  }

  private hold(held: boolean): void {
    this.held = held;
    if (held) window.clearTimeout(this.timer);
    else if (this.notice) this.schedule();
  }

  override render() {
    const n = this.notice;
    if (!n) return html`<div role="status" aria-live="polite"></div>`;
    return html`<div
      class="notice"
      role="status"
      aria-live="polite"
      data-testid="notice"
      data-kind=${n.kind}
      @pointerenter=${() => this.hold(true)}
      @pointerleave=${() => this.hold(false)}
      @focusin=${() => this.hold(true)}
      @focusout=${() => this.hold(false)}
    >
      <span class="text" data-testid="notice-text">${n.text}</span>
      ${n.actions.map(
        (a) => html`<button data-testid=${`notice-${a.id}`} @click=${() => this.act(a.id)}>${a.label}</button>`,
      )}
      <button class="close" aria-label="Dismiss" data-testid="notice-close" @click=${() => this.hide()}>×</button>
    </div>`;
  }

  private act(id: string): void {
    this.hide();
    this.dispatchEvent(new CustomEvent('hs-notice-action', { detail: id, bubbles: true, composed: true }));
  }
}

customElements.define('hs-notice', HsNotice);

declare global {
  interface HTMLElementTagNameMap {
    'hs-notice': HsNotice;
  }
}
