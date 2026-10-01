import type { ShortcutName } from '../shared/commands';
import { bindings, holomlOnly, matchCombo } from '../shared/shortcuts';

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
 * macOS app switcher. The person's own combinations (Settings >
 * Shortcuts, milestone 11) replace an action's defaults.
 */
export function matchShortcut(
  input: KeyInput,
  platform: string,
  overrides: Readonly<Partial<Record<ShortcutName, string>>> = {},
): ShortcutName | null {
  if (input.type !== 'keyDown' && input.type !== 'rawKeyDown') return null;
  return matchCombo(
    { ctrl: input.control, alt: input.alt, shift: input.shift, meta: input.meta, key: input.key },
    bindings(overrides, platform),
    platform,
  );
}

/**
 * The shortcut a key press in a web contents stands for, or null to leave
 * the keys to it. As matchShortcut, but a shortcut for HoloML pages only
 * (the text view) is one only in a HoloML page: in any other page its
 * keys go to the page (Ctrl+Shift+V pastes as plain text), and in the
 * shell they go to the shell, which knows whether a text field has the
 * keyboard (renderer/app.ts).
 *
 * @param holomlPage The key was pressed in a HoloML page.
 */
export function shortcutIn(
  input: KeyInput,
  platform: string,
  overrides: Readonly<Partial<Record<ShortcutName, string>>>,
  holomlPage: boolean,
): ShortcutName | null {
  const name = matchShortcut(input, platform, overrides);
  return name !== null && holomlOnly(name) && !holomlPage ? null : name;
}
