import { describe, expect, it } from 'vitest';
import { afterShellCrash, SHELL_CRASH_WINDOW_MS, startFailedMessage } from './start-up';

describe('a crashed shell (review of 2026-09-30, M10)', () => {
  it('is reloaded the first time, and again when it has run for a minute since', () => {
    expect(afterShellCrash(null, 5000)).toBe('reload');
    expect(afterShellCrash(5000, 5000 + SHELL_CRASH_WINDOW_MS)).toBe('reload');
    expect(afterShellCrash(5000, 5000 + 10 * SHELL_CRASH_WINDOW_MS)).toBe('reload');
  });

  it('ends the app when it crashes again within the minute', () => {
    expect(afterShellCrash(5000, 5001)).toBe('quit');
    expect(afterShellCrash(5000, 5000 + SHELL_CRASH_WINDOW_MS - 1)).toBe('quit');
  });

  it('a clock set back is not taken for a quick second crash', () => {
    expect(afterShellCrash(5000, 1000)).toBe('reload');
  });
});

describe('a failed start (review of 2026-09-30, M9)', () => {
  it('says why in plain words, and where the data folder is', () => {
    const message = startFailedMessage(new Error("EACCES: permission denied, mkdir 'C:\\data\\filters'"), 'C:\\data');
    expect(message).toContain("EACCES: permission denied, mkdir 'C:\\data\\filters'");
    expect(message).toContain('Its data folder is C:\\data.');
    expect(message).not.toMatch(/\n\s+at /); // no stack
    expect(startFailedMessage('disk full', '/data')).toContain('disk full');
  });
});
