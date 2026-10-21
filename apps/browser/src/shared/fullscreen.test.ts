import { describe, expect, it } from 'vitest';
import { ALLOWED_WITH_NOTICE, LEAVE_SCRIPT, escapeLeaves, holdNotice, noticeSite, windowShouldLeave } from './fullscreen';

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

  it('FS9 the window leaves full screen by itself only when a page started it and nothing of a page holds it (issue #87; the person\'s own full screen stays, the review of 2026-10-21)', () => {
    const page = { byPerson: false };
    // A tab closed in full screen: the page gone, its element gone with it, the window still full.
    expect(windowShouldLeave({ ...page, windowFull: true, pageFull: false, shellHoldsElement: false })).toBe(true);
    // A page full screen, by Electron's word or by its element in the browser's own page (one may come before the other).
    expect(windowShouldLeave({ ...page, windowFull: true, pageFull: true, shellHoldsElement: true })).toBe(false);
    expect(windowShouldLeave({ ...page, windowFull: true, pageFull: true, shellHoldsElement: false })).toBe(false);
    expect(windowShouldLeave({ ...page, windowFull: true, pageFull: false, shellHoldsElement: true })).toBe(false);
    // A window that is not full has nothing to leave.
    expect(windowShouldLeave({ ...page, windowFull: false, pageFull: false, shellHoldsElement: false })).toBe(false);
    expect(windowShouldLeave({ ...page, windowFull: false, pageFull: true, shellHoldsElement: true })).toBe(false);
    // The person's own full screen (the window's control): it stays with no page in it, and after one leaves.
    const person = { byPerson: true };
    expect(windowShouldLeave({ ...person, windowFull: true, pageFull: false, shellHoldsElement: false })).toBe(false);
    expect(windowShouldLeave({ ...person, windowFull: true, pageFull: true, shellHoldsElement: true })).toBe(false);
  });

  it('the way out is the document\'s own, run apart from the page (it cannot be replaced there)', () => {
    expect(LEAVE_SCRIPT).toContain('document.exitPointerLock()');
    expect(LEAVE_SCRIPT).toContain('document.exitFullscreen()');
  });
});
