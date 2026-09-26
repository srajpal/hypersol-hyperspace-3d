import { describe, expect, it } from 'vitest';
import { ClosedTabs, MAX_CLOSED } from './closed-tabs';
import { shouldSleep, sleepMinutes, type SleepCandidate } from './sleep';

const idle: SleepCandidate = { focused: false, busy: false, asleep: false, audible: false, downloading: false, typed: false, lastSeen: 0 };

describe('sleeping tabs (milestone 10)', () => {
  it('sleep after the chosen minutes out of view', () => {
    expect(shouldSleep(idle, 29 * 60_000, 30)).toBe(false);
    expect(shouldSleep(idle, 30 * 60_000, 30)).toBe(true);
    expect(shouldSleep(idle, 10 ** 9, 0)).toBe(false);
    expect(shouldSleep(idle, 1000, 5, 200)).toBe(true);
  });

  it('never the tab in front, a busy, sounding, downloading, or typed-in tab, or one already asleep', () => {
    const late = 10 ** 9;
    for (const key of ['focused', 'busy', 'asleep', 'audible', 'downloading', 'typed'] as const) {
      expect(shouldSleep({ ...idle, [key]: true }, late, 5), key).toBe(false);
    }
  });

  it('economy mode shortens the wait to 5 minutes at most', () => {
    expect(sleepMinutes(30, false)).toBe(30);
    expect(sleepMinutes(30, true)).toBe(5);
    expect(sleepMinutes(5, true)).toBe(5);
    expect(sleepMinutes(0, true)).toBe(0);
  });
});

describe('closed tabs (milestone 10)', () => {
  it('reopen newest first and keep the last 25', () => {
    const closed = new ClosedTabs();
    for (let i = 0; i < MAX_CLOSED + 5; i++) closed.push({ url: `https://t${i}.example/`, title: `T${i}`, index: i, from: i + 1 });
    expect(closed.size).toBe(MAX_CLOSED);
    expect(closed.pop()?.title).toBe(`T${MAX_CLOSED + 4}`);
    expect(closed.pop()?.title).toBe(`T${MAX_CLOSED + 3}`);
    let last;
    while (closed.size > 0) last = closed.pop();
    expect(last?.title).toBe('T5');
    expect(closed.pop()).toBeUndefined();
  });
});
