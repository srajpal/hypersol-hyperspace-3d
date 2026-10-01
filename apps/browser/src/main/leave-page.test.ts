import { describe, expect, it } from 'vitest';
import { confirmLeave, LEAVE_PAGE } from './leave-page';

describe('"Leave this page?" (review of 2026-09-30, M4)', () => {
  it('asks in plain words, with Leave and Stay', () => {
    expect(LEAVE_PAGE).toMatchObject({
      message: 'Leave this page?',
      detail: 'Changes you made may not be saved.',
      buttons: ['Leave', 'Stay'],
    });
  });

  it('leaves only when Leave is pressed: Stay, Escape, and closing the box keep the page', () => {
    const shown: unknown[] = [];
    expect(confirmLeave((options) => (shown.push(options), 0))).toBe(true);
    expect(shown).toEqual([LEAVE_PAGE]);
    expect(confirmLeave(() => 1)).toBe(false);
    expect(confirmLeave(() => LEAVE_PAGE.cancelId!)).toBe(false);
  });
});
