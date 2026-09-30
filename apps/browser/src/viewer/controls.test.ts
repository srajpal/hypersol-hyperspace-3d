import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { orbitControls, walkControls } from './controls';
import { SolidGrid, Walker } from './physics';

type Listener = (e: unknown) => void;

/** Something that takes listeners, as the window and the canvas do, and can send them an event. */
function target() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener: (type: string, l: Listener) => void (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(l),
    removeEventListener: (type: string, l: Listener) => void listeners.get(type)?.delete(l),
    send: (type: string, e: unknown) => [...(listeners.get(type) ?? [])].forEach((l) => l(e)),
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
    getRootNode: () => ({ addEventListener: () => undefined, removeEventListener: () => undefined }),
    style: {} as Record<string, string>,
    ownerDocument: { addEventListener: () => undefined, removeEventListener: () => undefined },
  };
}

let win: ReturnType<typeof target>;

/** A key press as the page sees it; `prevented` says whether the scene kept it from the page. */
function key(name: string) {
  const e = { key: name, altKey: false, ctrlKey: false, metaKey: false, target: null, prevented: false, preventDefault: () => (e.prevented = true) };
  return e;
}

beforeEach(() => {
  win = target();
  vi.stubGlobal('window', win);
  for (const name of ['HTMLInputElement', 'HTMLButtonElement', 'HTMLTextAreaElement']) vi.stubGlobal(name, class {});
});

afterEach(() => vi.unstubAllGlobals());

function walking(gravity: boolean) {
  const camera = new PerspectiveCamera();
  camera.position.set(0, 5, 0);
  const canvas = target();
  const changed = vi.fn();
  const walker = new Walker([0, 5, 0], gravity, true);
  const grid = new SolidGrid([{ min: [-2, 0, -2], max: [2, 1, 2] }]);
  const controls = walkControls(camera, canvas as unknown as HTMLElement, new Vector3(0, 5, -10), changed, { walker, solids: () => grid });
  return { camera, canvas, changed, walker, controls };
}

describe('a walker with gravity that stands still (review 134, V7)', () => {
  it('falls, lands, and then asks for no more frames: the scene is told only when the eyes or the view change', () => {
    const { changed, walker, controls, camera } = walking(true);
    let moving = true;
    for (let i = 0; i < 300 && moving; i++) moving = controls.step(16);
    expect(moving).toBe(false);
    expect(walker.onGround).toBe(true);
    expect(camera.position.y).toBeCloseTo(1 + 1.6, 3);
    // Every frame still checks the ground under the feet, and none of them changes anything.
    changed.mockClear();
    for (let i = 0; i < 100; i++) expect(controls.step(16)).toBe(false);
    expect(changed).not.toHaveBeenCalled();
    // A key held moves it again, and the scene is told.
    win.send('keydown', key('w'));
    expect(controls.step(16)).toBe(true);
    expect(changed).toHaveBeenCalled();
    win.send('keyup', key('w'));
    controls.step(16);
    changed.mockClear();
    for (let i = 0; i < 10; i++) controls.step(16);
    expect(changed).not.toHaveBeenCalled();
    // Turned to look where it already looks, or put where it already is: nothing to draw.
    controls.moveTo([camera.position.x, camera.position.y, camera.position.z]);
    controls.step(16);
    expect(changed).not.toHaveBeenCalled();
  });
});

describe('the scene behind the text view (review 134, V8)', () => {
  it('walking: paused, it keeps no key from the page and does not move; shown again, it does', () => {
    const { controls, camera } = walking(false);
    controls.paused = true;
    for (const name of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', ' ', 'w']) {
      const e = key(name);
      win.send('keydown', e);
      expect(e.prevented, name).toBe(false);
    }
    const before = camera.position.clone();
    expect(controls.step(100)).toBe(false);
    expect(camera.position.equals(before)).toBe(true);
    controls.paused = false;
    const e = key('PageDown');
    win.send('keydown', e);
    expect(e.prevented).toBe(true);
    const up = key('ArrowUp');
    win.send('keydown', up);
    expect(controls.step(100)).toBe(true);
    expect(camera.position.equals(before)).toBe(false);
  });

  it('walking: a key held when the text view comes up is let go', () => {
    const { controls } = walking(false);
    win.send('keydown', key('w'));
    expect(controls.step(16)).toBe(true);
    controls.paused = true;
    expect(controls.step(16)).toBe(false);
  });

  it('orbit: paused, the arrow keys are the page\'s and the view holds still', () => {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 1, 5);
    const changed = vi.fn();
    const controls = orbitControls(camera, target() as unknown as HTMLElement, new Vector3(0, 1, 0), changed);
    changed.mockClear();
    controls.paused = true;
    const before = camera.position.clone();
    for (const name of ['ArrowLeft', 'ArrowUp', '+', '-']) {
      const e = key(name);
      win.send('keydown', e);
      expect(e.prevented, name).toBe(false);
    }
    expect(camera.position.equals(before)).toBe(true);
    expect(changed).not.toHaveBeenCalled();
    controls.paused = false;
    const e = key('ArrowLeft');
    win.send('keydown', e);
    expect(e.prevented).toBe(true);
    expect(camera.position.equals(before)).toBe(false);
  });
});
