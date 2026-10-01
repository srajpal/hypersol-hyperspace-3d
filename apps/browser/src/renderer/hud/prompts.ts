import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { describeKinds, type PermissionPrompt, type PromptAnswer } from '../../shared/permissions';
import type { OfferAnswer, PasswordOffer } from '../../shared/passwords';
import { INSECURE_SIGN_IN, MAX_SIGN_IN_TEXT, signInWords, type SignInPrompt } from '../../shared/sign-in';
import { ARM_MS } from './arm';
import { keepTabInside } from './dialog-focus';

/** What a sign-in prompt was answered: what was typed, or nothing for Cancel. */
export interface SignInAnswer {
  id: number;
  typed: { username: string; password: string } | null;
}

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
 * password after signing in; and a site or a proxy asking for a user
 * name and password (HTTP sign-in, shared/sign-in.ts). Each belongs to
 * one tab; the controller shows the focused tab's. A permission prompt
 * and a sign-in prompt take no click or key for their first half second
 * (hud/arm.ts).
 *
 * The sign-in prompt is a dialog: it takes the keyboard when it appears,
 * Tab stays inside it, Enter signs in, and Escape cancels. What is typed
 * in it lives in its two fields only, and they go when it does.
 *
 * Events: hs-permission-answer (detail: { id, answer }),
 * hs-password-answer (detail: { id, answer }), hs-offer-dismissed (detail:
 * id), hs-sign-in-answer (detail: SignInAnswer).
 */
export class HsPrompts extends LitElement {
  static override properties = {
    permission: { attribute: false },
    offer: { attribute: false },
    signIn: { attribute: false },
    armed: { state: true },
    signInArmed: { state: true },
  };

  declare permission: PermissionPrompt | null;
  declare offer: PasswordOffer | null;
  /** The permission prompt showing has been up long enough to take an answer. */
  declare armed: boolean;
  /** The prompt the wait was started for, by its id. */
  private armedFor: number | null = null;
  private armTimer: number | undefined;
  declare signIn: SignInPrompt | null;
  /** The sign-in prompt showing has been up long enough to take an answer. */
  declare signInArmed: boolean;
  private signInArmedFor: number | null = null;
  private signInArmTimer: number | undefined;
  /** The sign-in prompt that was last given the keyboard, by its id. */
  private signInFocused: number | null = null;

  constructor() {
    super();
    this.permission = null;
    this.offer = null;
    this.signIn = null;
    this.armed = false;
    this.signInArmed = false;
  }

  /** Each permission prompt that appears, the next in a tab's queue included, waits before it takes an answer. */
  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('permission')) {
      const id = this.permission?.id ?? null;
      if (id !== this.armedFor) {
        this.armedFor = id;
        window.clearTimeout(this.armTimer);
        this.armed = false;
        if (id !== null) this.armTimer = window.setTimeout(() => (this.armed = true), ARM_MS);
      }
    }
    // A sign-in prompt waits the same way each time it appears: the next
    // one in a tab's queue, and the same one shown again after a tab switch.
    if (changed.has('signIn')) {
      const id = this.signIn?.id ?? null;
      if (id !== this.signInArmedFor) {
        this.signInArmedFor = id;
        window.clearTimeout(this.signInArmTimer);
        this.signInArmed = false;
        if (id !== null) this.signInArmTimer = window.setTimeout(() => (this.signInArmed = true), ARM_MS);
      }
    }
  }

  /** A sign-in prompt that appears takes the keyboard, in its first field. */
  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('signIn')) return;
    const id = this.signIn?.id ?? null;
    if (id === this.signInFocused) return;
    this.signInFocused = id;
    if (id !== null) this.focusSignIn();
  }

  /** Puts the keyboard in the sign-in prompt: in its first field, unless it is inside the prompt already. */
  focusSignIn(): void {
    const card = this.renderRoot.querySelector<HTMLElement>('[data-kind="sign-in"]');
    if (!card || card.contains((this.renderRoot as ShadowRoot).activeElement)) return;
    card.querySelector<HTMLInputElement>('input')?.focus();
  }

  /** Cancels the sign-in prompt showing, as its Cancel button does (also Escape elsewhere in the shell, and the Stop button). */
  cancelSignIn(): void {
    if (this.signIn && this.signInArmed) this.fire('hs-sign-in-answer', { id: this.signIn.id, typed: null } satisfies SignInAnswer);
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
    .said {
      margin: -4px 0 10px;
      font-size: 13px;
      color: var(--hs-text-muted);
      overflow-wrap: anywhere;
    }
    label {
      display: grid;
      grid-template-columns: 96px 1fr;
      align-items: center;
      gap: 8px;
      margin: 0 0 8px;
    }
    input {
      min-width: 0;
      padding: 5px 8px;
      border-radius: 8px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 45%, transparent);
      background: color-mix(in srgb, var(--hs-background-bottom) 60%, transparent);
      color: inherit;
      font: inherit;
    }
    input:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 1px;
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
    return html`${this.signIn ? this.signInCard(this.signIn) : nothing}
    ${this.permission ? this.permissionCard(this.permission) : nothing}
    ${this.offer ? this.offerCard(this.offer) : nothing}`;
  }

  /**
   * A site (or a proxy) asks for a user name and password. Who asks is the
   * browser's own knowledge (the request's address); the server's words,
   * its "realm", are shown as a quotation and marked as the site's.
   */
  private signInCard(p: SignInPrompt) {
    const words = signInWords(p);
    const submit = (e: Event) => {
      e.preventDefault();
      if (!this.signInArmed) return;
      const form = e.currentTarget as HTMLFormElement;
      const typed = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
      this.fire('hs-sign-in-answer', { id: p.id, typed: { username: typed('username'), password: typed('password') } } satisfies SignInAnswer);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.cancelSignIn();
        return;
      }
      keepTabInside(this.renderRoot as ShadowRoot, e, e.currentTarget as HTMLElement);
    };
    // A new prompt gets new fields: nothing typed into one is ever left for the next.
    return keyed(
      p.id,
      html`<form class="card" data-kind="sign-in" role="dialog" aria-label=${`Sign in to ${p.asker}`} data-testid="sign-in-prompt"
        ?data-armed=${this.signInArmed} novalidate @submit=${submit} @keydown=${onKey}>
        <p data-testid="sign-in-asks">${words.before}<strong data-testid="sign-in-asker">${p.asker}</strong>${words.after}</p>
        ${p.realm ? html`<p class="said" data-testid="sign-in-realm">${p.proxy ? 'The proxy' : 'The site'} says: “${p.realm}”</p>` : nothing}
        ${p.insecure ? html`<p class="note" data-testid="sign-in-insecure">${INSECURE_SIGN_IN}</p>` : nothing}
        <label>User name <input data-testid="sign-in-username" name="username" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength=${MAX_SIGN_IN_TEXT} /></label>
        <label>Password <input data-testid="sign-in-password" name="password" type="password" autocomplete="off" maxlength=${MAX_SIGN_IN_TEXT} /></label>
        <div class="actions">
          <button class="primary" type="submit" data-testid="sign-in-submit" ?data-armed=${this.signInArmed}>Sign in</button>
          <button type="button" data-testid="sign-in-cancel" ?data-armed=${this.signInArmed} @click=${() => this.cancelSignIn()}>Cancel</button>
        </div>
      </form>`,
    );
  }

  private permissionCard(p: PermissionPrompt) {
    const answer = (a: PromptAnswer) => {
      if (this.armed) this.fire('hs-permission-answer', { id: p.id, answer: a });
    };
    return html`<div class="card" data-kind="permission" role="alertdialog" aria-label="Permission request" data-testid="permission-prompt" ?data-armed=${this.armed}>
      <p><strong>${siteName(p.origin)}</strong> wants to use ${describeKinds(p.kinds)}.</p>
      <div class="actions">
        <button class="primary" data-testid="perm-allow" ?data-armed=${this.armed} @click=${() => answer('allow')}>Allow</button>
        <button data-testid="perm-once" ?data-armed=${this.armed} @click=${() => answer('once')}>Allow this time</button>
        <button data-testid="perm-block" ?data-armed=${this.armed} @click=${() => answer('block')}>Block</button>
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
