/**
 * Touch controls for walking (milestone 24, Q4 a): on a device whose main
 * pointer is a finger (a tablet or a phone), a pad on the screen walks the
 * viewer, and, where the page lets the walker jump, a button jumps. Drag
 * anywhere else to look around; tap to click; press and hold for what a
 * right-click does (scene.ts). On a computer with a mouse nothing here
 * shows, so the desktop is as it was.
 */

/** The pad's size in CSS pixels, and how far from the middle a finger may go before the pad counts it as full speed. */
export const PAD_SIZE = 132;
const PAD_REACH = PAD_SIZE / 2 - 18;
/** Near the middle, a finger's small wobbles do not walk. */
const DEAD_ZONE = 0.15;

/** Is this a device whose main pointer is a finger? */
export function touchScreen(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Where a finger on the pad points, as a walk: x to the right and y
 * forward, each from -1 to 1, no longer than 1 together, and nothing near
 * the middle. `dx` and `dy` are the finger's offset from the pad's middle
 * in pixels, y down, as the screen counts.
 */
export function stickFrom(dx: number, dy: number, reach = PAD_REACH): { x: number; y: number } {
  const length = Math.hypot(dx, dy);
  const amount = Math.min(1, length / reach);
  if (amount < DEAD_ZONE) return { x: 0, y: 0 };
  // Past the dead zone the walk grows from nothing, not from where the zone ends.
  const t = (amount - DEAD_ZONE) / (1 - DEAD_ZONE);
  return { x: (dx / length) * t, y: (-dy / length) * t };
}

export interface TouchPad {
  readonly element: HTMLElement;
  dispose(): void;
}

/**
 * The pad, in the bottom right corner of `parent`, and the jump button
 * beside it when `onJump` is given. `onStick` hears the walk as it
 * changes, and { x: 0, y: 0 } when the finger lifts.
 */
export function createTouchPad(parent: HTMLElement, onStick: (stick: { x: number; y: number }) => void, onJump?: () => void): TouchPad {
  const root = document.createElement('div');
  root.className = 'holoml-touch';
  root.style.cssText = 'position:fixed;right:20px;bottom:20px;display:flex;align-items:flex-end;gap:14px;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none';

  if (onJump) {
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.textContent = 'Jump';
    jump.setAttribute('aria-label', 'Jump');
    jump.style.cssText =
      'width:64px;height:64px;border-radius:50%;border:2px solid rgba(255,255,255,0.55);background:rgba(10,14,30,0.45);color:#fff;font:600 14px system-ui,sans-serif;touch-action:none';
    jump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onJump();
    });
    root.append(jump);
  }

  const pad = document.createElement('div');
  pad.setAttribute('role', 'application');
  pad.setAttribute('aria-label', 'Walk: drag inside the circle');
  pad.style.cssText = `position:relative;width:${PAD_SIZE}px;height:${PAD_SIZE}px;border-radius:50%;border:2px solid rgba(255,255,255,0.55);background:rgba(10,14,30,0.35);touch-action:none`;
  const knob = document.createElement('div');
  knob.style.cssText = 'position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,0.75);pointer-events:none';
  pad.append(knob);
  root.append(pad);

  let finger: number | null = null;
  const place = (e: PointerEvent) => {
    const box = pad.getBoundingClientRect();
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = e.clientY - (box.top + box.height / 2);
    const length = Math.hypot(dx, dy);
    const k = length > PAD_REACH ? PAD_REACH / length : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    onStick(stickFrom(dx, dy));
  };
  const release = () => {
    finger = null;
    knob.style.transform = '';
    onStick({ x: 0, y: 0 });
  };
  pad.addEventListener('pointerdown', (e) => {
    if (finger !== null) return;
    e.preventDefault();
    e.stopPropagation();
    finger = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    place(e);
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === finger) place(e);
  });
  pad.addEventListener('pointerup', (e) => {
    if (e.pointerId === finger) release();
  });
  pad.addEventListener('pointercancel', (e) => {
    if (e.pointerId === finger) release();
  });

  parent.append(root);
  return {
    element: root,
    dispose() {
      root.remove();
    },
  };
}
