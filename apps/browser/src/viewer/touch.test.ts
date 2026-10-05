// Touch controls for walking (milestone 24): the pad's arithmetic, when the
// pad shows, and what it does to the walker.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { SolidGrid, Walker } from './physics';

// The pad itself is a few elements; here it is stood in for, to hear what the walk controls give it.
const made: { onStick: (s: { x: number; y: number }) => void; onJump?: () => void; element: { hidden: boolean }; disposed: boolean }[] = [];
let coarse = false;
vi.mock('./touch', async (actual) => {
  const real = await actual<typeof import('./touch')>();
  return {
    ...real,
    touchScreen: () => coarse,
    createTouchPad: (_parent: unknown, onStick: (s: { x: number; y: number }) => void, onJump?: () => void) => {
      const pad = { onStick, onJump, element: { hidden: false }, disposed: false, dispose: () => (pad.disposed = true) };
      made.push(pad);
      return pad;
    },
  };
});

const { stickFrom, touchScreen: realTouchScreen } = await vi.importActual<typeof import('./touch')>('./touch');
const { walkControls } = await import('./controls');

function canvas() {
  return {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    setPointerCapture: () => undefined,
    parentElement: {},
  };
}

function walking(gravity: boolean, canJump: boolean) {
  vi.stubGlobal('window', { addEventListener: () => undefined, removeEventListener: () => undefined });
  const camera = new PerspectiveCamera();
  camera.position.set(0, 2.6, 0);
  const changed = vi.fn();
  const walker = new Walker([0, 2.6, 0], gravity, canJump);
  const grid = new SolidGrid([{ min: [-50, 0, -50], max: [50, 1, 50] }]);
  const controls = walkControls(camera, canvas() as unknown as HTMLElement, new Vector3(0, 2.6, -10), changed, { walker, solids: () => grid });
  return { camera, changed, walker, controls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  made.length = 0;
  coarse = false;
});

describe('the pad', () => {
  it('turns a finger on the pad into a walk: nothing near the middle, full speed at its edge, and no faster beyond', () => {
    expect(stickFrom(0, 0)).toEqual({ x: 0, y: 0 });
    expect(stickFrom(5, -5, 48)).toEqual({ x: 0, y: 0 });
    // Up the screen is forward.
    const ahead = stickFrom(0, -48, 48);
    expect(ahead.x).toBeCloseTo(0, 9);
    expect(ahead.y).toBeCloseTo(1, 9);
    expect(stickFrom(48, 0, 48).x).toBeCloseTo(1, 9);
    const far = stickFrom(300, 400, 48);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(1, 9);
    expect(far.y).toBeLessThan(0);
    // Halfway past the dead zone, half speed.
    const half = stickFrom(0, -(0.15 + 0.85 / 2) * 48, 48);
    expect(half.y).toBeCloseTo(0.5, 9);
  });

  it('shows only where the main pointer is a finger', () => {
    vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: q === '(pointer: coarse)' }) });
    expect(realTouchScreen()).toBe(true);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(realTouchScreen()).toBe(false);
    vi.stubGlobal('window', {});
    expect(realTouchScreen()).toBe(false);
  });
});

describe('walking with the pad', () => {
  it('makes no pad on a computer with a mouse', () => {
    walking(false, false);
    expect(made).toEqual([]);
  });

  it('walks forward with the pad held up, and stops when the finger lifts', () => {
    coarse = true;
    const { camera, changed, controls } = walking(false, false);
    expect(made).toHaveLength(1);
    expect(made[0]!.onJump).toBeUndefined();
    made[0]!.onStick({ x: 0, y: 1 });
    expect(changed).toHaveBeenCalled();
    const z = camera.position.z;
    expect(controls.step(500)).toBe(true);
    // Forward is the way it looks: towards -z, at the walking speed (2.2 m a second).
    expect(camera.position.z).toBeCloseTo(z - 1.1, 5);
    made[0]!.onStick({ x: 0, y: 0 });
    expect(controls.step(16)).toBe(false);
  });

  it('jumps from the button where the page lets the walker jump, and hides the pad behind the text view', () => {
    coarse = true;
    const { walker, controls } = walking(true, true);
    for (let i = 0; i < 300 && controls.step(16); i++);
    expect(walker.onGround).toBe(true);
    made[0]!.onJump!();
    expect(walker.onGround).toBe(false);
    controls.paused = true;
    expect(made[0]!.element.hidden).toBe(true);
    controls.paused = false;
    expect(made[0]!.element.hidden).toBe(false);
    controls.dispose();
    expect(made[0]!.disposed).toBe(true);
  });

  it('offers no jump where the page does not allow one', () => {
    coarse = true;
    walking(true, false);
    expect(made[0]!.onJump).toBeUndefined();
  });
});
