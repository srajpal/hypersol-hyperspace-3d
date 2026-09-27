import { LitElement, css, html, nothing } from 'lit';

/**
 * Says so when this computer cannot draw the 3D room (milestone 12, owner
 * prompt 60): Chromium would not start WebGL 2, which the room needs, as
 * happens without a graphics driver or in some virtual machines. Pages,
 * the top bar, and the panels still work; the room and the tab cards are
 * not drawn. Stays until dismissed, and is announced to screen readers.
 */
export class HsRoomMessage extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
  };

  declare open: boolean;

  constructor() {
    super();
    this.open = false;
  }

  static override styles = css`
    :host {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      z-index: 17;
      width: min(620px, calc(100vw - 48px));
      display: none;
      color: var(--hs-text);
      font-size: 14px;
    }
    :host([open]) {
      display: block;
    }
    .message {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid var(--hs-warning);
      background: color-mix(in srgb, var(--hs-panel-glass) 96%, transparent);
      box-shadow: 0 10px 30px var(--hs-shadow);
    }
    h2 {
      margin: 0;
      font-size: 15px;
      color: var(--hs-warning);
    }
    p {
      margin: 0;
      line-height: 1.4;
    }
    button {
      align-self: flex-end;
      font: inherit;
      color: inherit;
      cursor: pointer;
      border-radius: 8px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 55%, transparent);
      background: transparent;
      padding: 4px 12px;
    }
    button:hover {
      background: color-mix(in srgb, var(--hs-accent) 16%, transparent);
    }
    button:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 1px;
    }
  `;

  override render() {
    if (!this.open) return nothing;
    return html`<section class="message" role="alert" data-testid="room-message">
      <h2>This computer can't draw the 3D room</h2>
      <p>
        HyperSpace 3D needs WebGL 2, and Chromium could not start it here. This happens without a
        graphics driver, in some virtual machines, or when WebGL is switched off.
      </p>
      <p>
        Pages, the top bar, and the panels still work, but the room and the tab cards are not shown. To
        see your tabs, set Settings &gt; Tabs &gt; Show tabs as to "List in the top bar".
      </p>
      <button data-testid="room-message-close" @click=${() => (this.open = false)}>OK</button>
    </section>`;
  }
}

customElements.define('hs-room-message', HsRoomMessage);

declare global {
  interface HTMLElementTagNameMap {
    'hs-room-message': HsRoomMessage;
  }
}
