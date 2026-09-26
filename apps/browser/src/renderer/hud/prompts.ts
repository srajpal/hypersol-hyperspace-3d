import { LitElement, css, html, nothing } from 'lit';
import { describeKinds, type PermissionPrompt, type PromptAnswer } from '../../shared/permissions';
import type { OfferAnswer, PasswordOffer } from '../../shared/passwords';

/** "127.0.0.1:8123" or "example.com" for an origin. */
export function siteName(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/**
 * Questions for the page in front, under the top bar (milestone 9): a
 * site asking for the camera, microphone, or location (Allow, Allow this
 * time, Block: owner, prompt 45, Q2 a), and an offer to save or update a
 * password after signing in. Each belongs to one tab; the controller shows
 * the focused tab's.
 *
 * Events: hs-permission-answer (detail: { id, answer }),
 * hs-password-answer (detail: { id, answer }), hs-offer-dismissed (detail: id).
 */
export class HsPrompts extends LitElement {
  static override properties = {
    permission: { attribute: false },
    offer: { attribute: false },
  };

  declare permission: PermissionPrompt | null;
  declare offer: PasswordOffer | null;

  constructor() {
    super();
    this.permission = null;
    this.offer = null;
  }

  static override styles = css`
    :host {
      position: fixed;
      top: 62px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 18;
      width: min(560px, calc(100vw - 48px));
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--hs-text);
      font-size: 14px;
      pointer-events: none;
    }
    .card {
      pointer-events: auto;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 55%, transparent);
      background: color-mix(in srgb, var(--hs-panel-glass) 96%, transparent);
      box-shadow:
        0 10px 30px var(--hs-shadow),
        0 0 calc(24px * var(--hs-glow-strength)) color-mix(in srgb, var(--hs-accent) 30%, transparent);
    }
    .card[data-kind='permission'] {
      border-color: color-mix(in srgb, var(--hs-accent2) 70%, transparent);
    }
    p {
      margin: 0 0 10px;
    }
    strong {
      font-weight: 600;
    }
    .note {
      margin: -4px 0 10px;
      font-size: 12px;
      color: var(--hs-warning);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
      border-radius: 8px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 55%, transparent);
      background: transparent;
      padding: 5px 12px;
    }
    button.primary {
      background: color-mix(in srgb, var(--hs-accent) 24%, transparent);
    }
    button:hover {
      background: color-mix(in srgb, var(--hs-accent) 16%, transparent);
    }
    button:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 2px;
    }
  `;

  override render() {
    return html`${this.permission ? this.permissionCard(this.permission) : nothing}
    ${this.offer ? this.offerCard(this.offer) : nothing}`;
  }

  private permissionCard(p: PermissionPrompt) {
    const answer = (a: PromptAnswer) => this.fire('hs-permission-answer', { id: p.id, answer: a });
    return html`<div class="card" data-kind="permission" role="alertdialog" aria-label="Permission request" data-testid="permission-prompt">
      <p><strong>${siteName(p.origin)}</strong> wants to use ${describeKinds(p.kinds)}.</p>
      <div class="actions">
        <button class="primary" data-testid="perm-allow" @click=${() => answer('allow')}>Allow</button>
        <button data-testid="perm-once" @click=${() => answer('once')}>Allow this time</button>
        <button data-testid="perm-block" @click=${() => answer('block')}>Block</button>
      </div>
    </div>`;
  }

  private offerCard(o: PasswordOffer) {
    const answer = (a: OfferAnswer) => this.fire('hs-password-answer', { id: o.id, answer: a });
    const who = o.username === '' ? 'this sign-in' : html`<strong>${o.username}</strong>`;
    if (o.problem) {
      return html`<div class="card" role="status" data-testid="password-offer" data-kind="problem">
        <p data-testid="password-problem">${o.problem}</p>
        <div class="actions"><button data-testid="pw-ok" @click=${() => this.fire('hs-offer-dismissed', o.id)}>OK</button></div>
      </div>`;
    }
    return html`<div class="card" role="alertdialog" aria-label="Save password" data-testid="password-offer" data-kind=${o.update ? 'update' : 'save'}>
      <p>
        ${o.update ? html`Update the saved password for ${who}` : html`Save the password for ${who}`} on
        <strong>${siteName(o.origin)}</strong>?
      </p>
      ${o.insecure
        ? html`<p class="note" data-testid="password-insecure">Not secure: this site uses http, so the password was sent without encryption.</p>`
        : nothing}
      <div class="actions">
        <button class="primary" data-testid="pw-save" @click=${() => answer('save')}>${o.update ? 'Update' : 'Save'}</button>
        <button data-testid="pw-never" @click=${() => answer('never')}>Never for this site</button>
        <button data-testid="pw-not-now" @click=${() => answer('not-now')}>Not now</button>
      </div>
    </div>`;
  }

  private fire(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

customElements.define('hs-prompts', HsPrompts);

declare global {
  interface HTMLElementTagNameMap {
    'hs-prompts': HsPrompts;
  }
}
