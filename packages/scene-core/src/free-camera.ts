import type { Vec3 } from './layout.js';

/**
 * Looking around the room (milestone 27, owner, prompt 192, Q1 a): the
 * camera moves around the desk. It turns around a point in front of the
 * page (the pivot, the page's middle at first), comes closer or goes
 * further, and slides sideways and up and down, within the room's limits
 * (Q6 a). At the desk the state is DESK, and the camera is exactly where
 * the fixed desk camera is: at the pixel-sharp distance, looking at the
 * page's middle, so coming back leaves the page as sharp as before.
 */
export interface OrbitState {
  /** Turn around the pivot, left and right, in radians (0 faces the page; positive moves the camera to the right). */
  yaw: number;
  /** Height of the view, in radians (0 level; positive looks down from above). */
  pitch: number;
  /** Distance from the pivot, as a share of the desk's. */
  distance: number;
  /** The pivot's place: sideways and up, in world units. */
  x: number;
  y: number;
}

export const DESK: Readonly<OrbitState> = Object.freeze({ yaw: 0, pitch: 0, distance: 1, x: 0, y: 0 });

/** What the limits need to know of the room (Q6 a). */
export interface FreeCameraRoom {
  /** The desk camera's distance from the page's middle (the pixel-sharp distance). */
  deskDistance: number;
  /** The floor's height: the camera stays above it. */
  floorY: number;
  /** The page's turn about y, in radians: the camera never goes round to its back. */
  pageTurn: number;
  /** The page's middle, sideways and in depth (world units): the camera stays in front of the page's plane. */
  pageX: number;
  pageZ: number;
  /** How far the pivot may slide sideways (either way) and up, in world units. */
  slideX: number;
  slideUp: number;
}

const DEG = Math.PI / 180;

export const FREE_LIMITS = {
  /** Furthest turn either side of the page's own facing: well short of seeing its back. */
  maxTurn: 70 * DEG,
  minPitch: -15 * DEG,
  maxPitch: 60 * DEG,
  minDistance: 0.6,
  maxDistance: 2.5,
  /** Height kept between the camera and the floor, in world units. */
  floorClearance: 40,
  /** Distance kept in front of the page's plane, as a share of the desk's distance: never level with it, never behind. */
  frontClearance: 0.2,
} as const;

export interface FreeCameraOptions {
  /** Time to reach a new place, in milliseconds: the return to the desk takes about this long. */
  settleMs: number;
}

// Close enough to stop, and then placed exactly: a last step this small moves the page by under half a pixel.
const SNAP_ANGLE = 5e-4;
const SNAP_DISTANCE = 5e-4;
const SNAP_UNITS = 0.25;

export class FreeCamera {
  readonly options: FreeCameraOptions;
  private room: FreeCameraRoom;
  private readonly current: OrbitState = { ...DESK };
  private readonly target: OrbitState = { ...DESK };
  private isActive = false;
  private returning = false;

  constructor(room: FreeCameraRoom, options: Partial<FreeCameraOptions> = {}) {
    this.room = { ...room };
    this.options = { settleMs: 250, ...options };
  }

  /** Away from the desk, or on the way back to it. */
  get active(): boolean {
    return this.isActive;
  }

  /** On the way back to the desk. */
  get leaving(): boolean {
    return this.returning;
  }

  get state(): OrbitState {
    return { ...this.current };
  }

  get goal(): OrbitState {
    return { ...this.target };
  }

  /** The room changed size or shape: the limits follow, and a place now outside them is brought in. */
  setRoom(room: FreeCameraRoom): void {
    this.room = { ...room };
    if (!this.isActive) return;
    this.clampInto(this.target);
    this.clampInto(this.current);
  }

  /** Leaves the desk: from now on the camera moves as asked. */
  enter(): void {
    this.isActive = true;
    this.returning = false;
  }

  /**
   * Back to the desk: over about settleMs, or at once (reduced motion, or
   * a view that must be flat and still now). It is home, exactly DESK,
   * when step() says so or at once.
   */
  leave(instant = false): void {
    if (!this.isActive) return;
    Object.assign(this.target, DESK);
    this.returning = true;
    if (instant) this.home();
  }

  /** Turns around the pivot by these angles, in radians. */
  turn(dYaw: number, dPitch: number): void {
    if (!this.movable()) return;
    this.target.yaw += finite(dYaw);
    this.target.pitch += finite(dPitch);
    this.clampInto(this.target);
  }

  /** Slides the pivot sideways and up, in world units, as seen from the camera (sideways follows its turn). */
  slide(dx: number, dy: number): void {
    if (!this.movable()) return;
    const yaw = this.target.yaw;
    this.target.x += finite(dx) * Math.cos(yaw);
    this.target.y += finite(dy);
    this.clampInto(this.target);
  }

  /** Comes closer (factor below 1) or goes further (above 1). */
  zoom(factor: number): void {
    if (!this.movable() || !(factor > 0) || !Number.isFinite(factor)) return;
    this.target.distance *= factor;
    this.clampInto(this.target);
  }

  /** Puts the camera where it is going at once (reduced motion). */
  jump(): void {
    Object.assign(this.current, this.target);
    if (this.returning) this.home();
  }

  /** True while the camera still has somewhere to go. */
  get moving(): boolean {
    const c = this.current;
    const t = this.target;
    return (
      this.isActive &&
      (Math.abs(t.yaw - c.yaw) > SNAP_ANGLE ||
        Math.abs(t.pitch - c.pitch) > SNAP_ANGLE ||
        Math.abs(t.distance - c.distance) > SNAP_DISTANCE ||
        Math.abs(t.x - c.x) > SNAP_UNITS ||
        Math.abs(t.y - c.y) > SNAP_UNITS)
    );
  }

  /** Advances the camera by dtMs. Returns true if it is still moving. */
  step(dtMs: number): boolean {
    if (!this.isActive) return false;
    if (!this.moving) {
      if (this.returning) this.home();
      return false;
    }
    // Exponential ease, as the parallax's: about 98% of the way after settleMs.
    const k = 1 - Math.exp(-Math.max(0, dtMs) / (this.options.settleMs / 4));
    const c = this.current;
    const t = this.target;
    c.yaw += (t.yaw - c.yaw) * k;
    c.pitch += (t.pitch - c.pitch) * k;
    c.distance += (t.distance - c.distance) * k;
    c.x += (t.x - c.x) * k;
    c.y += (t.y - c.y) * k;
    if (!this.moving) {
      Object.assign(c, t);
      if (this.returning) this.home();
      return false;
    }
    return true;
  }

  /** Where the camera is now, and the point it looks at. */
  pose(state: OrbitState = this.current): { position: Vec3; lookAt: Vec3 } {
    const d = state.distance * this.room.deskDistance;
    return {
      position: {
        x: state.x + d * Math.sin(state.yaw) * Math.cos(state.pitch),
        y: state.y + d * Math.sin(state.pitch),
        z: d * Math.cos(state.yaw) * Math.cos(state.pitch),
      },
      lookAt: { x: state.x, y: state.y, z: 0 },
    };
  }

  private movable(): boolean {
    return this.isActive && !this.returning;
  }

  private home(): void {
    Object.assign(this.current, DESK);
    Object.assign(this.target, DESK);
    this.isActive = false;
    this.returning = false;
  }

  /** Brings a place inside the room's limits (Q6 a). */
  private clampInto(s: OrbitState): void {
    const L = FREE_LIMITS;
    const r = this.room;
    s.yaw = clamp(s.yaw, r.pageTurn - L.maxTurn, r.pageTurn + L.maxTurn);
    s.distance = clamp(s.distance, L.minDistance, L.maxDistance);
    s.x = clamp(s.x, -r.slideX, r.slideX);
    const lowest = r.floorY + L.floorClearance;
    s.y = clamp(s.y, Math.min(0, lowest), Math.max(0, r.slideUp));
    // Above the floor: a view from below is raised until the camera clears it.
    const d = s.distance * r.deskDistance;
    const minPitch = d > 0 ? Math.asin(clamp((lowest - s.y) / d, -1, 1)) : L.minPitch;
    s.pitch = clamp(s.pitch, Math.max(L.minPitch, minPitch), L.maxPitch);
    // In front of the page's plane, even beyond its edge: turned far to one side with the
    // pivot slid the other way, the camera could pass the plane and see the page's back.
    // The turn comes back towards the page's facing, then the pivot towards its middle.
    const enough = L.frontClearance * r.deskDistance;
    for (let i = 0; i < 40 && this.inFront(s) < enough; i++) {
      if (i < 20) s.yaw += (r.pageTurn - s.yaw) * 0.25;
      else s.x += (r.pageX - s.x) * 0.25;
    }
  }

  /** How far a place's camera is in front of the page's plane, in world units. */
  private inFront(s: OrbitState): number {
    const { position } = this.pose(s);
    const r = this.room;
    return (position.x - r.pageX) * Math.sin(r.pageTurn) + (position.z - r.pageZ) * Math.cos(r.pageTurn);
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}
