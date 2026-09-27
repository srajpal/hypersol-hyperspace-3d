import type { ShortcutName } from '../shared/commands';
import { bindings, matchCombo } from '../shared/shortcuts';

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
