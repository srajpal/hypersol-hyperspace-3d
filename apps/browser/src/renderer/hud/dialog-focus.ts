/**
 * Keyboard focus for the dialogs that cover the window (About, the HoloML
 * examples): Tab stays inside while one is open, and closing it puts the
 * focus back where it was (review of 2026-09-30, R7).
 */

/** The element that has the keyboard, looked for inside the shell's own shadow roots too (a page's <webview> counts as one element). */
export function focusedElement(): Element | null {
  let at = document.activeElement;
  while (at && at.tagName !== 'WEBVIEW' && at.shadowRoot?.activeElement) at = at.shadowRoot.activeElement;
  return at;
}

const CONTROLS = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * For a dialog's keydown: Tab on its last control goes to its first, and
 * Shift+Tab on its first to its last, so the keyboard never leaves for
 * what is behind it.
 *
 * @param within The dialog, when it is only a part of what the root holds.
 */
export function keepTabInside(root: ShadowRoot, e: KeyboardEvent, within: ParentNode = root): void {
  if (e.key !== 'Tab') return;
  const controls = [...within.querySelectorAll<HTMLElement>(CONTROLS)];
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (!first || !last) return;
  const at = root.activeElement;
  const inside = at instanceof HTMLElement && controls.includes(at);
  if (e.shiftKey ? at === first || !inside : at === last || !inside) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
}

/**
 * Puts the keyboard back on what had it before a dialog opened. False
 * when that is gone (a menu entry that closed with its menu), so the
 * caller can choose another place.
 */
export function returnFocus(before: Element | null): boolean {
  if (!(before instanceof HTMLElement) || !before.isConnected || before === document.body) return false;
  before.focus();
  return focusedElement() === before;
}
