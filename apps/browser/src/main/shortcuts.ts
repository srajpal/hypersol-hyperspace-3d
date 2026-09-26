import type { ShortcutName } from '../shared/commands';

/** The fields of Electron's before-input-event input that shortcuts need. */
export interface KeyInput {
  type: string;
  key: string;
  control: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

/**
 * Maps a key press to a browser shortcut, or null. Ctrl on Windows and
 * Linux, Cmd on macOS; Ctrl+Tab on every platform, since Cmd+Tab is the
 * macOS app switcher.
 */
export function matchShortcut(input: KeyInput, platform: string): ShortcutName | null {
  if (input.type !== 'keyDown' && input.type !== 'rawKeyDown') return null;
  const mac = platform === 'darwin';
  const mod = mac ? input.meta : input.control;
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  const plainMod = mod && !input.alt && !input.shift;

  if (input.control && key === 'Tab' && !input.alt) return input.shift ? 'prev-tab' : 'next-tab';
  if (mod && !input.alt && !input.shift && key === 'PageDown') return 'next-tab';
  if (mod && !input.alt && !input.shift && key === 'PageUp') return 'prev-tab';
  if (plainMod && key === 't') return 'new-tab';
  if (plainMod && key === 'd') return 'bookmark';
  if (plainMod && key === ',') return 'settings';
  if (mod && input.shift && !input.alt && key === 'o') return 'library';
  if (mod && input.shift && !input.alt && key === 'l') return 'layers';
  if (mod && input.shift && !input.alt && key === 'i') return 'instruments';
  if (mod && input.shift && !input.alt && key === 'n') return 'private-tab';
  // Milestone 10: reopen a closed tab, search tabs.
  if (mod && input.shift && !input.alt && key === 't') return 'reopen-tab';
  if (mod && input.shift && !input.alt && key === 'a') return 'search-tabs';
  // Zoom: Ctrl/Cmd with plus (also = and the shifted +), minus, and 0.
  if (mod && !input.alt && (key === '=' || key === '+')) return 'zoom-in';
  if (plainMod && (key === '-' || key === '_')) return 'zoom-out';
  if (plainMod && key === '0') return 'zoom-reset';
  if (plainMod && key === 'f') return 'find';
  if (plainMod && key === 'p') return 'print';
  if (plainMod && key === 'j') return 'downloads';
  if (plainMod && key === 'w') return 'close-tab';
  if (plainMod && key === 'l') return 'focus-address';
  if (!mac && input.alt && !input.control && !input.shift && key === 'd') return 'focus-address';
  if ((plainMod && key === 'r') || (key === 'F5' && !mod && !input.alt && !input.shift)) return 'reload';
  if (mac) {
    if (plainMod && key === '[') return 'back';
    if (plainMod && key === ']') return 'forward';
  } else if (input.alt && !input.control && !input.shift && !input.meta) {
    if (key === 'ArrowLeft') return 'back';
    if (key === 'ArrowRight') return 'forward';
  }
  return null;
}
