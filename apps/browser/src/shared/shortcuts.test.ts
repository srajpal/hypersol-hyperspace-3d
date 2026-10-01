import { describe, expect, it } from 'vitest';
import { matchShortcut, shortcutIn, type KeyInput } from '../main/shortcuts';
import { applySettingsPatch, defaults, parseSettings } from './settings';
import { bindings, checkOverrides, comboFromEvent, describeCombo, holomlOnly, parseCombo, SHORTCUTS } from './shortcuts';

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({ type: 'keyDown', key: k, control: false, meta: false, shift: false, alt: false, ...mods });

describe('shortcut remapping (milestone 11)', () => {
  it('lists every shortcut once, with keys that read for the platform', () => {
    const names = SHORTCUTS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect(describeCombo('Mod+Shift+T', 'win32')).toBe('Ctrl+Shift+T');
    expect(describeCombo('Mod+Shift+T', 'darwin')).toBe('Cmd+Shift+T');
    expect(describeCombo('Alt+ArrowLeft', 'win32')).toBe('Alt+←');
    expect(bindings({}, 'darwin').get('back')).toEqual(['Mod+[']);
    expect(bindings({}, 'win32').get('back')).toEqual(['Alt+ArrowLeft']);
  });

  it('reads combinations, "+" as a key included', () => {
    expect(parseCombo('Mod++', 'win32')).toEqual({ ctrl: true, alt: false, shift: false, meta: false, key: '+' });
    expect(parseCombo('Ctrl+Shift+Tab', 'darwin')).toEqual({ ctrl: true, alt: false, shift: true, meta: false, key: 'Tab' });
    expect(parseCombo('Hyper+T', 'win32')).toBeNull();
    expect(parseCombo('Mod+Frobnicate', 'win32')).toBeNull();
  });

  it('writes a key press as a combination', () => {
    const ev = (key: string, m: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) => ({
      key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...m,
    });
    expect(comboFromEvent(ev('k', { ctrlKey: true, shiftKey: true }), 'win32')).toBe('Mod+Shift+K');
    expect(comboFromEvent(ev('k', { metaKey: true }), 'darwin')).toBe('Mod+K');
    expect(comboFromEvent(ev('F7'), 'win32')).toBe('F7');
  });

  it('a remapped shortcut replaces its defaults, and others stay', () => {
    const own = { 'reopen-tab': 'Mod+Alt+R' } as const;
    expect(matchShortcut(key('r', { control: true, alt: true }), 'win32', own)).toBe('reopen-tab');
    expect(matchShortcut(key('T', { control: true, shift: true }), 'win32', own)).toBeNull();
    expect(matchShortcut(key('t', { control: true }), 'win32', own)).toBe('new-tab');
  });

  it('refuses clashes, reserved keys, keys without a modifier, and unknown actions', () => {
    expect(checkOverrides({ 'reopen-tab': 'Mod+T' }, 'win32')).toMatchObject({ error: expect.stringMatching(/already used by New tab/) });
    expect(checkOverrides({ 'find': 'Mod+C' }, 'win32')).toMatchObject({ error: expect.stringMatching(/kept for editing/) });
    expect(checkOverrides({ 'find': 'K' }, 'win32')).toMatchObject({ error: expect.stringMatching(/needs Ctrl/) });
    expect(checkOverrides({ 'find': 'F3' }, 'win32')).toEqual({ overrides: { find: 'F3' } });
    expect(checkOverrides({ 'launch-rockets': 'Mod+K' }, 'win32')).toHaveProperty('error');
    // Swapping two shortcuts at once is fine.
    expect(checkOverrides({ 'new-tab': 'Mod+Shift+T', 'reopen-tab': 'Mod+T' }, 'win32')).toHaveProperty('overrides');
  });

  it('are kept in settings, checked there', () => {
    const ok = applySettingsPatch(defaults(), { shortcuts: { find: 'Mod+K' } });
    expect('settings' in ok && ok.settings.shortcuts).toEqual({ find: 'Mod+K' });
    expect(applySettingsPatch(defaults(), { shortcuts: { find: 'Mod+V' } })).toHaveProperty('error');
  });
});

describe('the text view of a HoloML page (review of 2026-09-30, St4)', () => {
  const pressed = key('V', { control: true, shift: true });

  it('is in the table with its old keys, so it can be changed and is checked for clashes', () => {
    expect(bindings({}, 'win32').get('text-view')).toEqual(['Mod+Shift+V']);
    expect(bindings({}, 'darwin').get('text-view')).toEqual(['Mod+Shift+V']);
    expect(matchShortcut(pressed, 'win32')).toBe('text-view');
    expect(matchShortcut(key('v', { meta: true, shift: true }), 'darwin')).toBe('text-view');
    // Another action cannot take its keys while it has them, and it cannot take another's.
    expect(checkOverrides({ find: 'Mod+Shift+V' }, 'win32')).toMatchObject({ error: expect.stringMatching(/already used by Text view of a HoloML page/) });
    expect(checkOverrides({ 'text-view': 'Mod+T' }, 'win32')).toMatchObject({ error: expect.stringMatching(/already used by New tab/) });
    // Plain paste stays reserved.
    expect(checkOverrides({ 'text-view': 'Mod+V' }, 'win32')).toMatchObject({ error: expect.stringMatching(/kept for editing/) });
    // Moved to other keys, the old ones are free again.
    expect(checkOverrides({ 'text-view': 'Mod+Alt+V', find: 'Mod+Shift+V' }, 'win32')).toHaveProperty('overrides');
  });

  it('is the only shortcut for HoloML pages only', () => {
    expect(SHORTCUTS.filter((s) => holomlOnly(s.name)).map((s) => s.name)).toEqual(['text-view']);
  });

  it('acts in a HoloML page only: anywhere else its keys are left alone', () => {
    expect(shortcutIn(pressed, 'win32', {}, true)).toBe('text-view');
    // In another page (or the shell) Ctrl+Shift+V stays "paste as plain text".
    expect(shortcutIn(pressed, 'win32', {}, false)).toBeNull();
    // Every other shortcut acts in both.
    expect(shortcutIn(key('t', { control: true }), 'win32', {}, true)).toBe('new-tab');
    expect(shortcutIn(key('t', { control: true }), 'win32', {}, false)).toBe('new-tab');
  });

  it('follows its own keys once changed: the old ones then do nothing', () => {
    const own = { 'text-view': 'Mod+Alt+V' } as const;
    expect(shortcutIn(key('v', { control: true, alt: true }), 'win32', own, true)).toBe('text-view');
    expect(shortcutIn(key('v', { control: true, alt: true }), 'win32', own, false)).toBeNull();
    expect(shortcutIn(pressed, 'win32', own, true)).toBeNull();
  });
});

describe('view and tab settings (milestone 11)', () => {
  it('have their defaults and checks', () => {
    const d = defaults();
    expect([d.tiltDirection, d.parallax, d.pageMargin, d.tabDisplay]).toEqual(['right', 'normal', 'normal', 'cards']);
    expect(applySettingsPatch(d, { tiltDirection: 'left', parallax: 'off', pageMargin: 'roomy' })).toHaveProperty('settings');
    expect(applySettingsPatch(d, { parallax: 'wild' })).toHaveProperty('error');
    expect(applySettingsPatch(d, { tabDisplay: 'autohide' })).toHaveProperty('error');
  });

  it('read a saved "cards that hide" as cards', () => {
    const { settings, problem } = parseSettings(JSON.stringify({ tabDisplay: 'autohide', tabSize: 'large' }));
    expect(problem).toBeUndefined();
    expect(settings.tabDisplay).toBe('cards');
    expect(settings.tabSize).toBe('large');
  });
});
