import { describe, expect, it } from 'vitest';
import { matchShortcut, type KeyInput } from './shortcuts';

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  type: 'keyDown',
  key: k,
  control: false,
  meta: false,
  shift: false,
  alt: false,
  ...mods,
});

describe('matchShortcut on Windows and Linux', () => {
  const m = (input: KeyInput) => matchShortcut(input, 'win32');
  it('maps the tab and address shortcuts', () => {
    expect(m(key('t', { control: true }))).toBe('new-tab');
    expect(m(key('T', { control: true }))).toBe('new-tab');
    expect(m(key('w', { control: true }))).toBe('close-tab');
    expect(m(key('l', { control: true }))).toBe('focus-address');
    expect(m(key('d', { alt: true }))).toBe('focus-address');
    expect(m(key('Tab', { control: true }))).toBe('next-tab');
    expect(m(key('Tab', { control: true, shift: true }))).toBe('prev-tab');
    expect(m(key('PageDown', { control: true }))).toBe('next-tab');
    expect(m(key('PageUp', { control: true }))).toBe('prev-tab');
  });
  it('maps bookmark, library, and settings', () => {
    expect(m(key('d', { control: true }))).toBe('bookmark');
    expect(m(key('O', { control: true, shift: true }))).toBe('library');
    expect(m(key('L', { control: true, shift: true }))).toBe('layers');
    expect(m(key('I', { control: true, shift: true }))).toBe('instruments');
    expect(m(key('N', { control: true, shift: true }))).toBe('private-tab');
    expect(m(key('T', { control: true, shift: true }))).toBe('reopen-tab');
    expect(m(key('A', { control: true, shift: true }))).toBe('search-tabs');
    expect(m(key('a', { control: true }))).toBeNull(); // Ctrl+A stays select-all
    expect(m(key('=', { control: true }))).toBe('zoom-in');
    expect(m(key('+', { control: true, shift: true }))).toBe('zoom-in');
    expect(m(key('-', { control: true }))).toBe('zoom-out');
    expect(m(key('0', { control: true }))).toBe('zoom-reset');
    expect(m(key('f', { control: true }))).toBe('find');
    expect(m(key('p', { control: true }))).toBe('print');
    expect(m(key('j', { control: true }))).toBe('downloads');
    expect(m(key('l', { control: true }))).toBe('focus-address');
    expect(m(key(',', { control: true }))).toBe('settings');
    expect(m(key('o', { control: true }))).toBeNull();
  });
  it('maps reload, back, and forward', () => {
    expect(m(key('r', { control: true }))).toBe('reload');
    expect(m(key('F5'))).toBe('reload');
    expect(m(key('ArrowLeft', { alt: true }))).toBe('back');
    expect(m(key('ArrowRight', { alt: true }))).toBe('forward');
  });
  it('ignores ordinary typing and other combinations', () => {
    expect(m(key('t'))).toBeNull();
    // Ctrl+Shift+T reopens a closed tab since milestone 10; Ctrl+Alt+T is still nothing.
    expect(m(key('t', { control: true, alt: true }))).toBeNull();
    expect(m(key('t', { meta: true }))).toBeNull();
    expect(m(key('ArrowLeft'))).toBeNull();
    expect(m(key('ArrowLeft', { control: true }))).toBeNull();
    expect(m({ ...key('t', { control: true }), type: 'keyUp' })).toBeNull();
  });
});

describe('matchShortcut on macOS', () => {
  const m = (input: KeyInput) => matchShortcut(input, 'darwin');
  it('uses Cmd, but Ctrl+Tab for tabs', () => {
    expect(m(key('t', { meta: true }))).toBe('new-tab');
    expect(m(key('t', { control: true }))).toBeNull();
    expect(m(key('Tab', { control: true }))).toBe('next-tab');
    expect(m(key('[', { meta: true }))).toBe('back');
    expect(m(key(']', { meta: true }))).toBe('forward');
    expect(m(key('ArrowLeft', { alt: true }))).toBeNull(); // word-jump in text on macOS
    expect(m(key('d', { alt: true }))).toBeNull();
  });
});
