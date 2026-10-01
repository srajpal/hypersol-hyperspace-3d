import type { Vec2 } from './layout.js';

export interface ParallaxOptions {
  /** Largest camera offset from centre on each axis, in world units. */
  maxOffset: number;
  /** Time for the camera to reach a new target, in milliseconds. */
  settleMs: number;
}

export const DEFAULT_PARALLAX: ParallaxOptions = { maxOffset: 24, settleMs: 250 };

const SNAP = 0.01;

/**
 * Subtle camera parallax that follows the pointer over the room.
 *
 * While the pointer is over the page the parallax is paused: the camera
 * holds still, so click targets never move under the cursor. When the
 * pointer returns to the room the camera eases to its new target over
 * about settleMs, without jumping.
 */
export class Parallax {
  readonly options: ParallaxOptions;
  private readonly current: Vec2 = { x: 0, y: 0 };
  private readonly target: Vec2 = { x: 0, y: 0 };
  private isPaused = false;

  constructor(options: Partial<ParallaxOptions> = {}) {
    this.options = { ...DEFAULT_PARALLAX, ...options };
  }

  get offset(): Vec2 {
    return { ...this.current };
  }

  get paused(): boolean {
    return this.isPaused;
  }

  /**
   * Sets the target from the pointer position, normalised so that -1 is
   * the left or bottom edge of the window and 1 the right or top edge.
   * Ignored while paused.
   */
  setPointer(nx: number, ny: number): void {
    if (this.isPaused) return;
    const clamp = (n: number) => Math.max(-1, Math.min(1, Number.isFinite(n) ? n : 0));
    this.target.x = clamp(nx) * this.options.maxOffset;
    this.target.y = clamp(ny) * this.options.maxOffset;
  }

  setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  /**
   * Puts the camera back at the centre at once, paused or not: for views
   * that must be flat and still (a page that fills the window, economy
   * mode, movement switched off), where the pointer is usually over the
   * page and setPointer would be ignored.
   */
  reset(): void {
    this.current.x = 0;
    this.current.y = 0;
    this.target.x = 0;
    this.target.y = 0;
  }

  /** True when the camera still has somewhere to go. */
  get moving(): boolean {
    return (
      !this.isPaused &&
      (Math.abs(this.target.x - this.current.x) > SNAP ||
        Math.abs(this.target.y - this.current.y) > SNAP)
    );
  }

  /** Advances the camera by dtMs. Returns true if it is still moving. */
  step(dtMs: number): boolean {
    if (!this.moving) return false;
    // Exponential ease: about 98% of the way after settleMs.
    const tau = this.options.settleMs / 4;
    const k = 1 - Math.exp(-Math.max(0, dtMs) / tau);
    this.current.x += (this.target.x - this.current.x) * k;
    this.current.y += (this.target.y - this.current.y) * k;
    if (Math.abs(this.target.x - this.current.x) <= SNAP) this.current.x = this.target.x;
    if (Math.abs(this.target.y - this.current.y) <= SNAP) this.current.y = this.target.y;
    return this.moving;
  }
}
