/**
 * Tells the shell when the person has typed into a form on this page
 * (milestone 10), so the tab is never put to sleep with unsent text.
 * Only real typing counts; sending the form clears it. The typed text
 * itself never leaves the page.
 */
import { ipcRenderer } from 'electron';
import { PAGE_STATE_CHANNEL } from '../shared/page-state';

let typed = false;

function tell(value: boolean): void {
  if (typed === value) return;
  typed = value;
  ipcRenderer.sendToHost(PAGE_STATE_CHANNEL, { typed });
}

function isField(el: EventTarget | null): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !['button', 'submit', 'reset', 'image', 'hidden'].includes(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

if (window === window.top) {
  window.addEventListener('input', (e) => {
    if (e.isTrusted && isField(e.target)) tell(true);
  }, true);
  window.addEventListener('submit', () => tell(false), true);
}
