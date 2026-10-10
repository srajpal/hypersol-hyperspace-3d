import { LitElement, css, html } from 'lit';
import { NOTICE_MS, holdNotice, type HoldKind } from '../../shared/fullscreen';

/**
 * The browser's own notice when a page fills the screen or holds the
 * pointer (GitHub issue #75): which site, and that Escape leaves. It is
 * a popover, so it is drawn in the top layer, over the page even when the
 * page is the full-screen element (which is drawn over everything else
 * the browser shows); shown after the page, it is above it. It stays for
 * a few seconds and comes back when asked (the pointer at the top of the
 * screen); screen readers hear it. It takes no clicks: Escape is the way
 * out, and a button here would sit where a page could draw one too.
 */
export class HsHoldNotice extends LitElement {
  static override properties = {
    text: { state: true },
  };

  /** What it says now, or '' when hidden. */
  declare text: string;
  private timer: number | undefined;

  constructor() {
    super();
    this.text = '';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('popover', 'manual');
    this.dataset['testid'] = 'hold-notice';
    // The page becomes the full-screen element after the main process has said so, and goes into the top layer
    // above the notice shown then: the notice comes back above it (found by check FS4).
    document.addEventListener('fullscreenchange', this.onFullscreen);
  }

  override disconnectedCallback(): void {
    document.removeEventListener('fullscreenchange', this.onFullscreen);
    super.disconnectedCallback();
  }

  private readonly onFullscreen = (): void => {
    if (!this.open || document.fullscreenElement === null) return;
    this.hidePopover();
    this.showPopover();
  };

  static override styles = css`
    :host {
      position: fixed;
      inset: 24px auto auto 50%;
      transform: translateX(-50%);
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      overflow: visible;
      color: var(--hs-text);
      font-size: 16px;
      pointer-events: none;
    }
    .notice {
      padding: 12px 20px;
      border-radius: 12px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 60%, transparent);
      background: var(--hs-panel-glass);
      box-shadow: 0 10px 30px var(--hs-shadow);
      white-space: nowrap;
    }
  `;

  /** Whether it is showing now. */
  get open(): boolean {
    return this.matches(':popover-open');
  }

  /** Shows it for a page holding the screen or the pointer, for a few seconds, on top of everything. */
  show(kind: HoldKind, site: string): void {
    this.text = holdNotice(kind, site);
    // Shown again, it comes to the top of the top layer: above a page that went full screen since.
    if (this.open) this.hidePopover();
    this.showPopover();
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), NOTICE_MS);
  }

  hide(): void {
    window.clearTimeout(this.timer);
    if (this.open) this.hidePopover();
    this.text = '';
  }

  override render() {
    return html`<div class="notice" role="status" aria-live="assertive" data-testid="hold-notice-text">${this.text}</div>`;
  }
}

customElements.define('hs-hold-notice', HsHoldNotice);

declare global {
  interface HTMLElementTagNameMap {
    'hs-hold-notice': HsHoldNotice;
  }
}
