import type { WindowBounds } from '../shared/settings';

/**
 * Where the window opens (review of 2026-09-30, D7): its size and place
 * are remembered in settings.json, and used again only while the place
 * is still on a connected display. Pure, so it is unit tested directly;
 * main/index.ts reads the displays and listens to the window.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The window's size when nothing is remembered, or what is remembered cannot be used. */
export const DEFAULT_WINDOW = { width: 1280, height: 800 } as const;

/**
 * How much of the window's top strip (where its title bar is) must be on
 * a display for the window to count as reachable there: enough to see it
 * and take hold of it.
 */
export const REACHABLE = { strip: 40, across: 120, down: 24 } as const;

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

/**
 * Is a window at this rectangle still on a connected display? It is when
 * its top strip shows on one display's work area (the display without
 * the taskbar or dock) by at least REACHABLE. A window remembered on a
 * display that has since been unplugged, or off to one side, is not.
 */
export function isOnADisplay(bounds: Rect, workAreas: readonly Rect[]): boolean {
  return workAreas.some(
    (area) =>
      overlap(bounds.x, bounds.x + bounds.width, area.x, area.x + area.width) >= REACHABLE.across &&
      overlap(bounds.y, bounds.y + REACHABLE.strip, area.y, area.y + area.height) >= REACHABLE.down,
  );
}

/** How a new window is made: its size, its place (none: centred by the system), and whether it is then maximised. */
export interface Opening {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

/**
 * Where the window opens: as it was last left, if that place is still on
 * a connected display; otherwise at the default size, centred.
 *
 * @param saved What settings.json remembers, or null.
 * @param workAreas Each connected display's work area.
 */
export function openingBounds(saved: WindowBounds | null, workAreas: readonly Rect[]): Opening {
  if (!saved || !isOnADisplay(saved, workAreas)) return { ...DEFAULT_WINDOW, maximized: false };
  return { x: saved.x, y: saved.y, width: saved.width, height: saved.height, maximized: saved.maximized };
}

/** The same size, place, and state (nothing to save again). */
export function sameBounds(a: WindowBounds | null, b: WindowBounds): boolean {
  return a !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.maximized === b.maximized;
}
