import { describe, expect, it } from 'vitest';
import { Parallax } from './parallax.js';

function settle(p: Parallax, ms: number, frame = 16): void {
  for (let t = 0; t < ms; t += frame) p.step(frame);
}

describe('Parallax', () => {
  it('starts centred and still', () => {
    const p = new Parallax();
    expect(p.offset).toEqual({ x: 0, y: 0 });
    expect(p.moving).toBe(false);
    expect(p.step(16)).toBe(false);
  });

  it('follows the pointer and caps the offset', () => {
    const p = new Parallax({ maxOffset: 24 });
    p.setPointer(5, -5); // far outside the window: capped
    settle(p, 1000);
    expect(p.offset).toEqual({ x: 24, y: -24 });
    p.setPointer(0.5, 0.25);
    settle(p, 1000);
    expect(p.offset.x).toBeCloseTo(12, 6);
    expect(p.offset.y).toBeCloseTo(6, 6);
  });

  it('eases to a new target in about 250 ms, without jumping', () => {
    const p = new Parallax({ maxOffset: 24, settleMs: 250 });
    p.setPointer(1, 0);
    p.step(16);
    expect(p.offset.x).toBeGreaterThan(0);
    expect(p.offset.x).toBeLessThan(24 * 0.4); // no jump on the first frame
    settle(p, 250);
    expect(p.offset.x).toBeGreaterThan(24 * 0.95);
    settle(p, 500);
    expect(p.offset.x).toBe(24);
    expect(p.moving).toBe(false);
  });

  it('holds still while paused, even if the pointer moves', () => {
    const p = new Parallax();
    p.setPointer(1, 1);
    settle(p, 100);
    const frozen = p.offset;
    p.setPaused(true);
    p.setPointer(-1, -1);
    expect(p.step(16)).toBe(false);
    settle(p, 1000);
    expect(p.offset).toEqual(frozen);
    expect(p.moving).toBe(false);
  });

  it('resumes smoothly from where it paused', () => {
    const p = new Parallax({ maxOffset: 24 });
    p.setPointer(1, 0);
    settle(p, 1000);
    p.setPaused(true);
    p.setPaused(false);
    p.setPointer(-1, 0);
    p.step(16);
    expect(p.offset.x).toBeLessThan(24);
    expect(p.offset.x).toBeGreaterThan(0); // no jump to -24
    settle(p, 1000);
    expect(p.offset.x).toBe(-24);
  });

  it('reset() centres the camera at once, even while paused', () => {
    const p = new Parallax({ maxOffset: 24 });
    p.setPointer(1, -1);
    settle(p, 1000);
    expect(p.offset).toEqual({ x: 24, y: -24 });
    p.setPaused(true);
    p.setPointer(0, 0); // ignored: the pointer is over the page
    expect(p.offset).toEqual({ x: 24, y: -24 });
    p.reset();
    expect(p.offset).toEqual({ x: 0, y: 0 });
    // Nothing is left to ease towards when the pointer leaves the page.
    p.setPaused(false);
    expect(p.moving).toBe(false);
    expect(p.step(16)).toBe(false);
    expect(p.offset).toEqual({ x: 0, y: 0 });
  });

  it('ignores non-numeric pointer values', () => {
    const p = new Parallax();
    p.setPointer(Number.NaN, Number.POSITIVE_INFINITY);
    settle(p, 1000);
    expect(p.offset.x).toBe(0);
    expect(p.offset.y).toBe(0);
  });
});
