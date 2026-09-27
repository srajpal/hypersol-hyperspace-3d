import { describe, expect, it } from 'vitest';
import { matchShortcut, type KeyInput } from '../main/shortcuts';
import { applySettingsPatch, defaults, parseSettings } from './settings';
import { bindings, checkOverrides, comboFromEvent, describeCombo, parseCombo, SHORTCUTS } from './shortcuts';

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
