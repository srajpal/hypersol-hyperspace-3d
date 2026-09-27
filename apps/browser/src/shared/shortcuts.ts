/**
 * Browser shortcuts (milestone 11): each action's key combinations, which
 * the person can change in Settings > Shortcuts. A combination is written
 * like "Mod+Shift+T": Mod is Cmd on macOS and Ctrl elsewhere; Ctrl, Alt,
 * Shift, and Meta mean themselves. Pure, so the main process (which acts
 * on key presses), the shell (which shows and edits them), and the unit
 * tests share it.
 */
import type { ShortcutName } from './commands';

export interface ShortcutInfo {
  name: ShortcutName;
  label: string;
  /** The default combinations; the first is the one shown. */
  keys: string[];
  /** Different defaults on macOS. */
  mac?: string[];
}

/** Every shortcut, in the order Settings lists them. */
export const SHORTCUTS: readonly ShortcutInfo[] = [
  { name: 'new-tab', label: 'New tab', keys: ['Mod+T'] },
  { name: 'private-tab', label: 'New private tab', keys: ['Mod+Shift+N'] },
  { name: 'close-tab', label: 'Close tab', keys: ['Mod+W'] },
  { name: 'reopen-tab', label: 'Reopen closed tab', keys: ['Mod+Shift+T'] },
  { name: 'next-tab', label: 'Next tab', keys: ['Ctrl+Tab', 'Mod+PageDown'] },
  { name: 'prev-tab', label: 'Previous tab', keys: ['Ctrl+Shift+Tab', 'Mod+PageUp'] },
  { name: 'search-tabs', label: 'Search tabs', keys: ['Mod+Shift+A'] },
  { name: 'focus-address', label: 'Go to the address bar', keys: ['Mod+L', 'Alt+D'], mac: ['Mod+L'] },
  { name: 'back', label: 'Back', keys: ['Alt+ArrowLeft'], mac: ['Mod+['] },
  { name: 'forward', label: 'Forward', keys: ['Alt+ArrowRight'], mac: ['Mod+]'] },
  { name: 'reload', label: 'Reload', keys: ['Mod+R', 'F5'] },
  { name: 'find', label: 'Find in page', keys: ['Mod+F'] },
  { name: 'zoom-in', label: 'Zoom in', keys: ['Mod+=', 'Mod+Shift+=', 'Mod++', 'Mod+Shift++'] },
  { name: 'zoom-out', label: 'Zoom out', keys: ['Mod+-', 'Mod+_'] },
  { name: 'zoom-reset', label: 'Reset zoom', keys: ['Mod+0'] },
  { name: 'bookmark', label: 'Bookmark this page', keys: ['Mod+D'] },
  { name: 'library', label: 'Library', keys: ['Mod+Shift+O'] },
  { name: 'downloads', label: 'Downloads', keys: ['Mod+J'] },
  { name: 'print', label: 'Print', keys: ['Mod+P'] },
  { name: 'settings', label: 'Settings', keys: ['Mod+,'] },
  { name: 'layers', label: 'Layers view', keys: ['Mod+Shift+L'] },
  { name: 'instruments', label: 'Instrument panel', keys: ['Mod+Shift+I'] },
];

/** Kept for editing text everywhere; no shortcut may take them. */
export const RESERVED = ['Mod+C', 'Mod+V', 'Mod+X', 'Mod+Z', 'Mod+Shift+Z', 'Mod+Y', 'Mod+A'];

export interface Combo {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

const NAMED = new Set([
  'Tab', 'PageUp', 'PageDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Insert', 'Delete',
  'Backspace', 'Enter', 'Space', 'Escape',
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
]);

/** A key as combinations name it: one character in lower case, or a named key. */
export function keyName(key: string): string {
  if (key === ' ') return 'Space';
  return key.length === 1 ? key.toLowerCase() : key;
}

/** Reads "Mod+Shift+T" for a platform; null if it is not a combination. */
export function parseCombo(text: string, platform: string): Combo | null {
  if (typeof text !== 'string' || text.length === 0 || text.length > 40) return null;
  // The key itself may be "+" ("Mod++").
  const parts = text.endsWith('++') ? [...text.slice(0, -2).split('+'), '+'] : text.split('+');
  const key = parts.pop();
  if (!key) return null;
  const combo: Combo = { ctrl: false, alt: false, shift: false, meta: false, key: keyName(key) };
  const mac = platform === 'darwin';
  for (const p of parts) {
    if (p === 'Mod') {
      if (mac) combo.meta = true;
      else combo.ctrl = true;
    } else if (p === 'Ctrl') combo.ctrl = true;
    else if (p === 'Alt') combo.alt = true;
    else if (p === 'Shift') combo.shift = true;
    else if (p === 'Meta' || p === 'Cmd') combo.meta = true;
    else return null;
  }
  if (combo.key.length !== 1 && !NAMED.has(combo.key)) return null;
  return combo;
}

const same = (a: Combo, b: Combo) =>
  a.ctrl === b.ctrl && a.alt === b.alt && a.shift === b.shift && a.meta === b.meta && a.key === b.key;

/** Writes a key press as a combination for this platform ("Mod+Shift+T"). */
export function comboFromEvent(e: { key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }, platform: string): string {
  const mac = platform === 'darwin';
  const parts: string[] = [];
  if (mac ? e.metaKey : e.ctrlKey) parts.push('Mod');
  if (mac ? e.ctrlKey : false) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (!mac && e.metaKey) parts.push('Meta');
  const k = keyName(e.key);
  parts.push(k.length === 1 ? k.toUpperCase() : k);
  return parts.join('+');
}

/** How a combination reads for this platform: "Ctrl+Shift+T" or "Cmd+Shift+T". */
export function describeCombo(text: string, platform: string): string {
  const mac = platform === 'darwin';
  return text
    .replace(/^Mod\b/, mac ? 'Cmd' : 'Ctrl')
    .replace(/Arrow(Left|Right|Up|Down)/, (_m, d: string) => ({ Left: '←', Right: '→', Up: '↑', Down: '↓' })[d] ?? d);
}

/** The combinations in force for each shortcut: the person's own, else the defaults. */
export function bindings(overrides: Readonly<Partial<Record<ShortcutName, string>>>, platform: string): Map<ShortcutName, string[]> {
  const out = new Map<ShortcutName, string[]>();
  for (const s of SHORTCUTS) {
    const own = overrides[s.name];
    out.set(s.name, own ? [own] : platform === 'darwin' && s.mac ? s.mac : s.keys);
  }
  return out;
}

/** The shortcut a key press means, or null. */
export function matchCombo(input: Omit<Combo, 'key'> & { key: string }, table: Map<ShortcutName, string[]>, platform: string): ShortcutName | null {
  const pressed: Combo = { ...input, key: keyName(input.key) };
  for (const [name, keys] of table) {
    for (const k of keys) {
      const combo = parseCombo(k, platform);
      if (combo && same(combo, pressed)) return name;
    }
  }
  return null;
}

/**
 * Checks the person's shortcuts: known actions, real combinations with a
 * modifier (or a function key), none reserved for editing text, and no
 * combination used twice (their own or another action's default).
 */
export function checkOverrides(value: unknown, platform: string): { overrides: Partial<Record<ShortcutName, string>> } | { error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { error: 'shortcuts must map actions to key combinations' };
  const overrides: Partial<Record<ShortcutName, string>> = {};
  for (const [name, combo] of Object.entries(value as Record<string, unknown>)) {
    if (!SHORTCUTS.some((s) => s.name === name)) return { error: `Unknown shortcut: ${name}` };
    if (typeof combo !== 'string') return { error: `${name}: not a key combination` };
    const parsed = parseCombo(combo, platform);
    if (!parsed) return { error: `${name}: "${combo}" is not a key combination` };
    const hasModifier = parsed.ctrl || parsed.alt || parsed.meta;
    if (!hasModifier && !/^F\d{1,2}$/.test(parsed.key)) return { error: `${combo} needs Ctrl, Alt, or ${platform === 'darwin' ? 'Cmd' : 'Meta'} (or a function key)` };
    if (RESERVED.some((r) => same(parseCombo(r, platform)!, parsed))) return { error: `${describeCombo(combo, platform)} is kept for editing text` };
    overrides[name as ShortcutName] = combo;
  }
  const table = bindings(overrides, platform);
  const seen = new Map<string, ShortcutName>();
  for (const [name, keys] of table) {
    for (const k of keys) {
      const c = parseCombo(k, platform)!;
      const id = `${c.ctrl}${c.alt}${c.shift}${c.meta}${c.key}`;
      const other = seen.get(id);
      if (other && other !== name) {
        const label = (n: ShortcutName) => SHORTCUTS.find((s) => s.name === n)!.label;
        return { error: `${describeCombo(k, platform)} is already used by ${label(other)}` };
      }
      seen.set(id, name);
    }
  }
  return { overrides };
}
