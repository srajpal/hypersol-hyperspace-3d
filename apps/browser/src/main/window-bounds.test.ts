import { describe, expect, it } from 'vitest';
import type { WindowBounds } from '../shared/settings';
import { DEFAULT_WINDOW, isOnADisplay, openingBounds, sameBounds, type Rect } from './window-bounds';

/** One display of 1920 by 1080 with a 40-pixel taskbar, and a second one to its right. */
const MAIN: Rect = { x: 0, y: 0, width: 1920, height: 1040 };
const SECOND: Rect = { x: 1920, y: 0, width: 2560, height: 1400 };

const saved = (over: Partial<WindowBounds> = {}): WindowBounds => ({ x: 100, y: 80, width: 1400, height: 900, maximized: false, ...over });

describe('where the window opens (review of 2026-09-30, D7)', () => {
  it('as it was last left, while that place is on a connected display', () => {
    expect(openingBounds(saved(), [MAIN])).toEqual({ x: 100, y: 80, width: 1400, height: 900, maximized: false });
    expect(openingBounds(saved({ maximized: true }), [MAIN])).toMatchObject({ x: 100, y: 80, maximized: true });
    // On the second display.
    expect(openingBounds(saved({ x: 2200, y: 200 }), [MAIN, SECOND])).toMatchObject({ x: 2200, y: 200, width: 1400, height: 900 });
  });

  it('at the default size, centred, when nothing is remembered', () => {
    expect(openingBounds(null, [MAIN])).toEqual({ ...DEFAULT_WINDOW, maximized: false });
    expect(DEFAULT_WINDOW).toEqual({ width: 1280, height: 800 });
  });

  it('at the default size, centred, when the remembered place is on no display any more', () => {
    // The second display has been unplugged.
    const opened = openingBounds(saved({ x: 2200, y: 200, maximized: true }), [MAIN]);
    expect(opened).toEqual({ width: 1280, height: 800, maximized: false });
    expect('x' in opened || 'y' in opened).toBe(false);
    // No display at all (a session without one).
    expect(openingBounds(saved(), [])).toEqual({ ...DEFAULT_WINDOW, maximized: false });
  });
});

describe('still on a display', () => {
  it('when enough of the top strip shows to see the window and take hold of it', () => {
    expect(isOnADisplay({ x: 0, y: 0, width: 900, height: 600 }, [MAIN])).toBe(true);
    // Hanging off the left, the right, and the bottom, with 120 pixels of the strip still showing.
    expect(isOnADisplay({ x: -780, y: 100, width: 900, height: 600 }, [MAIN])).toBe(true);
    expect(isOnADisplay({ x: 1800, y: 100, width: 900, height: 600 }, [MAIN])).toBe(true);
    expect(isOnADisplay({ x: 100, y: 1016, width: 900, height: 600 }, [MAIN])).toBe(true);
    // A little above the top, as a window snapped to it sits.
    expect(isOnADisplay({ x: 100, y: -8, width: 900, height: 600 }, [MAIN])).toBe(true);
  });

  it('not when the strip is off every display, even if the rest of the window shows', () => {
    expect(isOnADisplay({ x: -781, y: 100, width: 900, height: 600 }, [MAIN])).toBe(false);
    expect(isOnADisplay({ x: 1801, y: 100, width: 900, height: 600 }, [MAIN])).toBe(false);
    expect(isOnADisplay({ x: 100, y: 1017, width: 900, height: 600 }, [MAIN])).toBe(false);
    // The title bar above the top of the display: the window's body shows, but it cannot be moved.
    expect(isOnADisplay({ x: 100, y: -300, width: 900, height: 600 }, [MAIN])).toBe(false);
    expect(isOnADisplay({ x: 5000, y: 5000, width: 900, height: 600 }, [MAIN, SECOND])).toBe(false);
  });

  it('on any one of the displays: the parts on two displays are not added up', () => {
    // 100 pixels on the first display and 100 on the second: reachable on neither.
    expect(isOnADisplay({ x: 1820, y: 1100, width: 200, height: 600 }, [MAIN, SECOND])).toBe(false);
    expect(isOnADisplay({ x: 1820, y: 100, width: 900, height: 600 }, [MAIN, SECOND])).toBe(true);
  });
});

describe('sameBounds', () => {
  it('is true only for the same size, place, and state', () => {
    expect(sameBounds(saved(), saved())).toBe(true);
    expect(sameBounds(null, saved())).toBe(false);
    expect(sameBounds(saved(), saved({ width: 1401 }))).toBe(false);
    expect(sameBounds(saved(), saved({ maximized: true }))).toBe(false);
  });
});
