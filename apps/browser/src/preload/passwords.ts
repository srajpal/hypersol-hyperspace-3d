/**
 * The password manager's page side (milestone 9), in the page's main
 * frame only. It runs in the preload's isolated world, so page scripts
 * cannot call it or read what it holds.
 *
 * Saving: when you submit a sign-in (the form's submit, a click on its
 * button, or Enter in a field), the user name and password are sent to
 * the main process, which decides whether to offer to save them for the
 * page's real origin. Only real input counts, never events a script made.
 *
 * Filling (owner, prompt 45, Q1 b): nothing is filled on load. Clicking a
 * sign-in field (or pressing the down arrow in it) shows the accounts
 * saved for this site under it; picking one asks the main process for its
 * password, which it gives only right after real input in this page, and
 * fills the fields.
 */
import { ipcRenderer } from 'electron';
import { PAGE_PASSWORDS_CHANNEL, parseAccountsReply, type AccountsReply } from '../shared/page-passwords';

const TEXT_TYPES = new Set(['text', 'email', 'tel', '']);
const SUBMIT_WORDS = /\b(log ?in|sign ?in|continue|next|submit|enter|go)\b/i;

const ask = (request: unknown): Promise<unknown> => ipcRenderer.invoke(PAGE_PASSWORDS_CHANNEL, request).catch(() => null);

const isInput = (el: unknown): el is HTMLInputElement => el instanceof HTMLInputElement;

function passwordFields(scope: ParentNode): HTMLInputElement[] {
  return [...scope.querySelectorAll('input[type="password" i]')].filter(
    (el): el is HTMLInputElement => isInput(el) && !el.disabled,
  );
}

/** The user name field for a password field: autocomplete="username", else the last text field before it. */
function usernameFor(password: HTMLInputElement, scope: ParentNode): HTMLInputElement | null {
  const fields = [...scope.querySelectorAll('input')].filter(
    (el): el is HTMLInputElement => isInput(el) && TEXT_TYPES.has(el.type.toLowerCase()) && !el.disabled,
  );
  const named = fields.find((f) => f.autocomplete.split(/\s+/).includes('username'));
  if (named) return named;
  const before = fields.filter((f) => f.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING);
  return before[before.length - 1] ?? null;
}

function scopeOf(el: Element): ParentNode {
  return (isInput(el) || el instanceof HTMLButtonElement ? el.form : null) ?? el.closest('form') ?? document;
}

function credentials(scope: ParentNode): { username: string; password: string } | null {
  const filled = passwordFields(scope).filter((p) => p.value !== '');
  if (filled.length === 0) return null;
  // A change-password form has several: the new one is marked, or last.
  const password = filled.find((p) => p.autocomplete.includes('new-password')) ?? filled[filled.length - 1]!;
  const username = usernameFor(password, scope)?.value.trim() ?? '';
  return { username, password: password.value };
}

let lastReported = '';

function report(scope: ParentNode): void {
  const found = credentials(scope);
  if (!found) return;
  const key = `${found.username}\n${found.password}`;
  if (key === lastReported) return;
  lastReported = key;
  void ask({ op: 'submitted', ...found });
}

function isSubmitControl(el: Element): boolean {
  if (el instanceof HTMLInputElement) return el.type === 'submit' || el.type === 'image';
  if (el instanceof HTMLButtonElement) return el.type === 'submit' || SUBMIT_WORDS.test(el.textContent ?? '');
  return SUBMIT_WORDS.test(el.textContent ?? '');
}

/** A field in a sign-in form: a password field, or a text field next to one. */
function isSignInField(el: EventTarget | null): el is HTMLInputElement {
  if (!isInput(el) || el.disabled || el.readOnly) return false;
  const type = el.type.toLowerCase();
  if (type === 'password') return true;
  return TEXT_TYPES.has(type) && passwordFields(scopeOf(el)).length > 0;
}

// ---- The account list ---------------------------------------------------------

let list: { host: HTMLElement; field: HTMLInputElement } | null = null;

function hideList(): void {
  list?.host.remove();
  list = null;
}

function setValue(field: HTMLInputElement, value: string): void {
  field.focus();
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

async function fill(field: HTMLInputElement, username: string): Promise<void> {
  const password = await ask({ op: 'fill', username });
  if (typeof password !== 'string') return;
  const scope = scopeOf(field);
  const passwordField = field.type.toLowerCase() === 'password' ? field : (passwordFields(scope)[0] ?? null);
  const userField = passwordField ? usernameFor(passwordField, scope) : field;
  if (userField) setValue(userField, username);
  if (passwordField) setValue(passwordField, password);
}

function showList(field: HTMLInputElement, { names, colors }: AccountsReply): void {
  hideList();
  const r = field.getBoundingClientRect();
  const host = document.createElement('hypersol-sign-ins');
  // Inline !important beats the page's styles; the list itself is in a closed shadow root.
  host.setAttribute(
    'style',
    [
      'all: initial',
      'position: fixed',
      'inset: auto',
      `left: ${Math.max(0, Math.round(r.left))}px`,
      `top: ${Math.round(r.bottom + 4)}px`,
      `min-width: ${Math.max(220, Math.round(r.width))}px`,
      'margin: 0',
      'padding: 0',
      'border: 0',
      'background: transparent',
      'overflow: visible',
      'z-index: 2147483647',
      'display: block',
    ]
      .map((d) => `${d} !important`)
      .join('; '),
  );
  host.setAttribute('popover', 'manual');
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `
    .box { font: 14px system-ui, sans-serif; color: ${colors.text}; background: ${colors.surface}; border: 1px solid ${colors.accent};
      border-radius: 8px; box-shadow: 0 8px 24px rgb(0 0 0 / 40%); padding: 4px; }
    .head { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: ${colors.textMuted}; padding: 4px 8px; }
    button { display: block; width: 100%; box-sizing: border-box; text-align: left; font: inherit; color: inherit;
      background: transparent; border: 0; border-radius: 6px; padding: 8px 10px; cursor: pointer; }
    button:hover, button:focus-visible { background: color-mix(in srgb, ${colors.accent} 25%, ${colors.surface}); outline: none; }`;
  const box = document.createElement('div');
  box.className = 'box';
  box.setAttribute('role', 'listbox');
  box.setAttribute('aria-label', 'Saved sign-ins for this site');
  const head = document.createElement('div');
  head.className = 'head';
  head.textContent = 'HyperSpace 3D: saved sign-ins';
  box.append(head);
  for (const name of names) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'option');
    b.dataset['username'] = name;
    b.textContent = name === '' ? '(no user name)' : name;
    b.addEventListener('click', (e) => {
      if (!e.isTrusted) return;
      hideList();
      void fill(field, name);
    });
    box.append(b);
  }
  root.append(style, box);
  (document.body ?? document.documentElement).append(host);
  try {
    host.showPopover();
  } catch {
    // Without the top layer the list still shows, over most pages.
  }
  list = { host, field };
}

async function offerAccounts(field: HTMLInputElement): Promise<void> {
  // The names, and the colours of the theme in use (the main process knows it).
  const accounts = parseAccountsReply(await ask({ op: 'accounts' }));
  if (!accounts) return;
  if (document.activeElement !== field && list === null) return; // the person moved on
  showList(field, accounts);
}

function start(): void {
  // Saving: a sign-in submitted by real input.
  window.addEventListener(
    'submit',
    (e) => {
      // requestSubmit() from a script makes a trusted event too: only a
      // submit during the person's own click or key press counts (issue #19).
      if (e.isTrusted && e.target instanceof HTMLFormElement && navigator.userActivation.isActive) report(e.target);
    },
    true,
  );
  window.addEventListener(
    'click',
    (e) => {
      if (!e.isTrusted || !(e.target instanceof Element)) return;
      const control = e.target.closest('button, input[type="submit"], input[type="image"], [role="button"]');
      if (control && isSubmitControl(control)) report(scopeOf(control));
    },
    true,
  );
  window.addEventListener(
    'keydown',
    (e) => {
      if (!e.isTrusted) return;
      if (e.key === 'Escape') hideList();
      if (!isSignInField(e.target)) return;
      if (e.key === 'Enter') report(scopeOf(e.target));
      else if (e.key === 'ArrowDown' && !list) void offerAccounts(e.target);
    },
    true,
  );

  // Filling: the account list appears when a sign-in field is clicked.
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (!e.isTrusted) return;
      if (list && !e.composedPath().includes(list.host)) hideList();
      if (isSignInField(e.target)) {
        const field = e.target;
        // After the click has focused the field.
        setTimeout(() => void offerAccounts(field), 0);
      }
    },
    true,
  );
  window.addEventListener('scroll', () => hideList(), true);
  window.addEventListener('resize', () => hideList());
  window.addEventListener('pagehide', () => hideList());
  // The page lost the keyboard (the shell's panels, another tab): the list goes.
  window.addEventListener('blur', () => hideList());
}

if (window === window.top && (location.protocol === 'http:' || location.protocol === 'https:')) start();
