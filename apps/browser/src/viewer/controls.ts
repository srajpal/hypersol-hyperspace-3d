/**
 * How the viewer moves (holoml SPEC.md, viewpoint): orbit around a point,
 * or walk on the floor, with the mouse, the keyboard, and touch. Both draw
 * only while something moves: they call `changed` and say whether they are
 * still moving.
 */
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Solids, Walker } from './physics';

export interface ViewControls {
  /** Moves on by dt milliseconds; true while still moving (keys held). */
  step(dt: number): boolean;
  /** The point the orbit turns around, or the point ahead when walking. */
  readonly target: Vector3;
  readonly mode: 'orbit' | 'walk';
  /** Puts the viewer's eyes at a point (a script moved the viewer), looking the same way. */
  moveTo(eye: [number, number, number]): void;
  /** Turns the viewer toward a point. */
  lookAt(point: [number, number, number]): void;
  /** Walking: metres a second, and degrees a second for turning from the keyboard (orbit keeps them, unused). */
  speed: number;
  turnSpeed: number;
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
    if (e.altKey || e.ctrlKey || e.metaKey || keptByControl(e)) return;
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
  let speed = WALK_SPEED;
  let turnSpeed = TURN_SPEED;
  return {
    mode: 'orbit',
    target: controls.target,
    get speed() {
      return speed;
    },
    set speed(v: number) {
      speed = v;
    },
    get turnSpeed() {
      return turnSpeed;
    },
    set turnSpeed(v: number) {
      turnSpeed = v;
    },
    step: () => false,
    moveTo: (eye) => {
      camera.position.set(...eye);
      controls.update();
    },
    lookAt: (point) => {
      controls.target.set(...point);
      controls.update();
    },
    dispose: () => {
      window.removeEventListener('keydown', onKey);
      controls.dispose();
    },
  };
}

/** Walking, unless the page says otherwise (HoloML 0.2 `speed`): metres a second. */
export const WALK_SPEED = 2.2;
/** Turning, and looking up and down, from the keyboard (milestone 17; HoloML 0.2 `turn-speed`): degrees a second. */
export const TURN_SPEED = 90;
/** Shift held: walking goes this much faster (milestone 17). */
const RUN = 2;
const LOOK_SPEED = 0.005; // radians a pixel

/** Walls and gravity (HoloML 0.2): the walker, and the solid boxes around it. */
export interface WalkPhysics {
  walker: Walker;
  solids(): Solids;
}

/**
 * Walk: the eyes stay at the starting height. W, A, S, D, or the up and
 * down arrows, to move; drag to look around; on a touch screen, drag one
 * finger to look and two to move forward and back. Shift walks faster.
 * From the keyboard alone (milestone 17), the left and right arrows turn,
 * and Page Up and Page Down look up and down, so the crosshair can aim.
 * How fast it walks and turns is the page's to choose (HoloML 0.2 `speed`
 * and `turn-speed`, milestone 18), and a script can change it.
 *
 * With physics (HoloML 0.2), solid things stop the walker; with gravity
 * it falls and stands on them, and Space jumps if the page allows it.
 */
export function walkControls(
  camera: PerspectiveCamera,
  element: HTMLElement,
  lookAt: Vector3,
  changed: () => void,
  physics?: WalkPhysics,
  speeds?: { walk?: number; turn?: number },
): ViewControls {
  let walkSpeed = speeds?.walk ?? WALK_SPEED;
  let turnSpeed = speeds?.turn ?? TURN_SPEED;
  const eye = camera.position.y;
  const dir = new Vector3().subVectors(lookAt, camera.position);
  let yaw = Math.atan2(-dir.x, -dir.z);
  let pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
  const held = new Set<string>();
  const target = new Vector3();
  let running = false;
  /** The walker is falling or in a jump: keep stepping until it lands. */
  let airborne = physics?.walker.gravity ?? false;

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
    a: 'l',
    A: 'l',
    d: 'r',
    D: 'r',
    ArrowLeft: 'turn-left',
    ArrowRight: 'turn-right',
    PageUp: 'look-up',
    PageDown: 'look-down',
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') running = true;
    if (e.key === ' ' && physics && !e.altKey && !e.ctrlKey && !e.metaKey && !keptByControl(e)) {
      e.preventDefault();
      if (physics.walker.jump()) {
        airborne = true;
        changed();
      }
      return;
    }
    const k = KEYS[e.key];
    if (!k || e.altKey || e.ctrlKey || e.metaKey || keptByControl(e)) return;
    e.preventDefault();
    if (!held.has(k)) {
      held.add(k);
      changed();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') running = false;
    const k = KEYS[e.key];
    if (k) held.delete(k);
  };
  const onBlur = () => {
    held.clear();
    running = false;
  };

  /** Moves across the floor; with physics, walls stop it and gravity pulls (dt in seconds). */
  function move(forward: number, right: number, dt = 0) {
    const dx = -Math.sin(yaw) * forward + Math.cos(yaw) * right;
    const dz = -Math.cos(yaw) * forward - Math.sin(yaw) * right;
    if (physics) {
      airborne = physics.walker.step(dx, dz, dt, physics.solids());
      camera.position.set(...physics.walker.eye);
    } else {
      camera.position.x += dx;
      camera.position.z += dz;
      camera.position.y = eye;
    }
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
    get speed() {
      return walkSpeed;
    },
    set speed(v: number) {
      walkSpeed = v;
    },
    get turnSpeed() {
      return turnSpeed;
    },
    set turnSpeed(v: number) {
      turnSpeed = v;
    },
    step(dt) {
      // With gravity, every frame checks the ground: a block under the feet may be gone.
      if (held.size === 0 && !airborne && !physics?.walker.gravity) return false;
      const turn = (((turnSpeed * Math.PI) / 180) * dt) / 1000;
      yaw += (held.has('turn-left') ? turn : 0) - (held.has('turn-right') ? turn : 0);
      pitch = Math.max(-1.4, Math.min(1.4, pitch + (held.has('look-up') ? turn : 0) - (held.has('look-down') ? turn : 0)));
      const d = (walkSpeed * (running ? RUN : 1) * dt) / 1000;
      move((held.has('f') ? d : 0) - (held.has('b') ? d : 0), (held.has('r') ? d : 0) - (held.has('l') ? d : 0), dt / 1000);
      return held.size > 0 || airborne;
    },
    moveTo(eyeAt) {
      if (physics) {
        physics.walker.placeEye(eyeAt);
        airborne = physics.walker.gravity;
      }
      camera.position.set(...eyeAt);
      aim();
    },
    lookAt(point) {
      const d = new Vector3(...point).sub(camera.position);
      yaw = Math.atan2(-d.x, -d.z);
      pitch = Math.max(-1.4, Math.min(1.4, Math.atan2(d.y, Math.hypot(d.x, d.z))));
      aim();
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

/** The keys a slider uses while it has the keyboard (HoloML 0.2 `slider`, milestone 18). */
const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
/** The keys a choice's options use: the arrows move to another option, the space bar picks one (`choice`, milestone 18). */
const OPTION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']);

/**
 * A key that belongs to a control in the page, not to walking or the
 * page's scripts: any key in a text field, and a slider's or a choice's
 * own keys while it has the keyboard (other keys still walk, jump, and
 * reach scripts).
 */
export function keptByControl(e: KeyboardEvent): boolean {
  const t = e.target;
  if (t instanceof HTMLInputElement && t.type === 'range') return SLIDER_KEYS.has(e.key);
  if (t instanceof HTMLInputElement && t.type === 'radio') return OPTION_KEYS.has(e.key);
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
}
