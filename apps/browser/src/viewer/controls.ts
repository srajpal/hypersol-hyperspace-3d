/**
 * How the viewer moves (holoml SPEC.md, viewpoint): orbit around a point,
 * or walk on the floor, with the mouse, the keyboard, and touch. Both draw
 * only while something moves: they call `changed` and say whether they are
 * still moving.
 */
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface ViewControls {
  /** Moves on by dt milliseconds; true while still moving (keys held). */
  step(dt: number): boolean;
  /** The point the orbit turns around, or the point ahead when walking. */
  readonly target: Vector3;
  readonly mode: 'orbit' | 'walk';
  dispose(): void;
}

const KEY_TURN = (5 * Math.PI) / 180;

/** Orbit: drag to go around the point, wheel or pinch to come closer; arrow keys and + and - too. */
export function orbitControls(camera: PerspectiveCamera, element: HTMLElement, target: Vector3, changed: () => void): ViewControls {
  const controls = new OrbitControls(camera, element);
  controls.target.copy(target);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 0.2;
  controls.maxDistance = 500;
  controls.update();
  controls.addEventListener('change', changed);

  const spherical = new Spherical();
  const offset = new Vector3();
  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e)) return;
    offset.copy(camera.position).sub(controls.target);
    spherical.setFromVector3(offset);
    switch (e.key) {
      case 'ArrowLeft':
        spherical.theta -= KEY_TURN;
        break;
      case 'ArrowRight':
        spherical.theta += KEY_TURN;
        break;
      case 'ArrowUp':
        spherical.phi = Math.max(0.05, spherical.phi - KEY_TURN);
        break;
      case 'ArrowDown':
        spherical.phi = Math.min(Math.PI - 0.05, spherical.phi + KEY_TURN);
        break;
      case '+':
      case '=':
        spherical.radius = Math.max(controls.minDistance, spherical.radius * 0.9);
        break;
      case '-':
      case '_':
        spherical.radius = Math.min(controls.maxDistance, spherical.radius / 0.9);
        break;
      default:
        return;
    }
    e.preventDefault();
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  };
  window.addEventListener('keydown', onKey);
  return {
    mode: 'orbit',
    target: controls.target,
    step: () => false,
    dispose: () => {
      window.removeEventListener('keydown', onKey);
      controls.dispose();
    },
  };
}

const WALK_SPEED = 2.2; // metres a second
const LOOK_SPEED = 0.005; // radians a pixel

/**
 * Walk: the eyes stay at the starting height. Arrow keys or W, A, S, D to
 * move, drag to look around; on a touch screen, drag one finger to look
 * and two to move forward and back.
 */
export function walkControls(camera: PerspectiveCamera, element: HTMLElement, lookAt: Vector3, changed: () => void): ViewControls {
  const eye = camera.position.y;
  const dir = new Vector3().subVectors(lookAt, camera.position);
  let yaw = Math.atan2(-dir.x, -dir.z);
  let pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
  const held = new Set<string>();
  const target = new Vector3();

  const aim = () => {
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    target.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).add(camera.position);
    changed();
  };
  aim();

  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: number | null = null;
  const onDown = (e: PointerEvent) => {
    element.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch = null;
  };
  const onMove = (e: PointerEvent) => {
    const last = pointers.get(e.pointerId);
    if (!last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last.x = e.clientX;
    last.y = e.clientY;
    if (pointers.size >= 2) {
      // Two fingers: forward and back, by how the average height moves.
      const ys = [...pointers.values()].map((p) => p.y);
      const mid = ys.reduce((a, b) => a + b, 0) / ys.length;
      if (pinch !== null) move((pinch - mid) * 0.01, 0);
      pinch = mid;
      return;
    }
    yaw -= dx * LOOK_SPEED;
    pitch = Math.max(-1.4, Math.min(1.4, pitch - dy * LOOK_SPEED));
    aim();
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinch = null;
  };
  const KEYS: Record<string, string> = {
    ArrowUp: 'f',
    w: 'f',
    W: 'f',
    ArrowDown: 'b',
    s: 'b',
    S: 'b',
    ArrowLeft: 'l',
    a: 'l',
    A: 'l',
    ArrowRight: 'r',
    d: 'r',
    D: 'r',
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const k = KEYS[e.key];
    if (!k || e.altKey || e.ctrlKey || e.metaKey || isTyping(e)) return;
    e.preventDefault();
    if (!held.has(k)) {
      held.add(k);
      changed();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const k = KEYS[e.key];
    if (k) held.delete(k);
  };
  const onBlur = () => held.clear();

  function move(forward: number, right: number) {
    camera.position.x += -Math.sin(yaw) * forward + Math.cos(yaw) * right;
    camera.position.z += -Math.cos(yaw) * forward - Math.sin(yaw) * right;
    camera.position.y = eye;
    aim();
  }

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return {
    mode: 'walk',
    target,
    step(dt) {
      if (held.size === 0) return false;
      const d = (WALK_SPEED * dt) / 1000;
      move((held.has('f') ? d : 0) - (held.has('b') ? d : 0), (held.has('r') ? d : 0) - (held.has('l') ? d : 0));
      return true;
    },
    dispose() {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target;
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
}
