import { describe, expect, it } from 'vitest';
import { ALLOWED_WITH_NOTICE, LEAVE_SCRIPT, escapeLeaves, holdNotice, noticeSite } from './fullscreen';

/** GitHub issue #75: the rules of full screen and pointer lock. */

describe('full screen and pointer lock', () => {
  it('are the two names a page may have with the notice', () => {
    expect([...ALLOWED_WITH_NOTICE].sort()).toEqual(['fullscreen', 'pointerLock']);
  });

  it('the notice names the site as the address bar does, and how to leave', () => {
    expect(holdNotice('fullscreen', 'video.example')).toBe('video.example is full screen. Press Esc to leave.');
    expect(holdNotice('pointer', 'game.example:8080')).toBe('game.example:8080 has the pointer. Press Esc to get it back.');
    expect(holdNotice('fullscreen', '')).toBe('This page is full screen. Press Esc to leave.');
    expect(noticeSite('https://video.example/watch?v=1')).toBe('video.example');
    expect(noticeSite('http://127.0.0.1:8080/a')).toBe('127.0.0.1:8080');
    expect(noticeSite('hypersol-file://abc/room.holoml')).toBe('');
    expect(noticeSite('nonsense')).toBe('');
  });

  it('Escape, pressed with any other keys, leaves while a page holds either; nothing else does', () => {
    expect(escapeLeaves({ type: 'keyDown', key: 'Escape' }, true)).toBe(true);
    expect(escapeLeaves({ type: 'keyDown', key: 'Escape' }, false)).toBe(false);
    expect(escapeLeaves({ type: 'keyUp', key: 'Escape' }, true)).toBe(false);
    expect(escapeLeaves({ type: 'keyDown', key: 'q' }, true)).toBe(false);
  });

  it('the way out is the document\'s own, run apart from the page (it cannot be replaced there)', () => {
    expect(LEAVE_SCRIPT).toContain('document.exitPointerLock()');
    expect(LEAVE_SCRIPT).toContain('document.exitFullscreen()');
  });
});
