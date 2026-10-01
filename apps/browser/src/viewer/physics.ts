/**
 * Walls and gravity for walking (HoloML 0.2, SPEC.md "Walls and
 * gravity"): the walker is a box 0.6 m wide and 1.8 m tall, with its eyes
 * 1.6 m above its feet. It cannot move into a solid box; with gravity it
 * falls and stands on solid boxes or on the floor (y = 0). Plain numbers
 * only, so it is tested without a scene (physics.test.ts).
 */

export type Vec3 = [number, number, number];

export interface Box {
  min: Vec3;
  max: Vec3;
}

/** The solid boxes near a region (a larger answer is fine; it is only slower). */
export interface Solids {
  near(min: Vec3, max: Vec3): Iterable<Box>;
}

export const BODY = { half: 0.3, height: 1.8, eye: 1.6 } as const;
/** m/s², as on Earth (the spec says so). */
export const GRAVITY = 9.8;
/** Up speed for a jump of about 1.2 m. */
export const JUMP_SPEED = Math.sqrt(2 * GRAVITY * 1.2);
/** Falling is capped, and every move is taken in steps no longer than this, so thin things are not passed through. */
const MAX_FALL = 40;
const STEP = 0.2;
const EPS = 1e-4;

function overlaps(a: Box, b: Box): boolean {
  return a.min[0] < b.max[0] - EPS && a.max[0] > b.min[0] + EPS && a.min[1] < b.max[1] - EPS && a.max[1] > b.min[1] + EPS && a.min[2] < b.max[2] - EPS && a.max[2] > b.min[2] + EPS;
}

export class Walker {
  /** Where the feet are (the middle of the body's base). */
  readonly feet: Vec3;
  vy = 0;
  onGround = false;

  constructor(
    eye: Vec3,
    readonly gravity: boolean,
    readonly canJump: boolean,
  ) {
    this.feet = [eye[0], eye[1] - BODY.eye, eye[2]];
  }

  get eye(): Vec3 {
    return [this.feet[0], this.feet[1] + BODY.eye, this.feet[2]];
  }

  /** Puts the walker's eyes at a point (a script moved the viewer). */
  placeEye(eye: Vec3): void {
    this.feet[0] = eye[0];
    this.feet[1] = eye[1] - BODY.eye;
    this.feet[2] = eye[2];
    this.vy = 0;
    this.onGround = false;
  }

  body(feet: Vec3 = this.feet): Box {
    return {
      min: [feet[0] - BODY.half, feet[1], feet[2] - BODY.half],
      max: [feet[0] + BODY.half, feet[1] + BODY.height, feet[2] + BODY.half],
    };
  }

  /** Starts a jump, if the walker may and stands on something. */
  jump(): boolean {
    if (!this.gravity || !this.canJump || !this.onGround) return false;
    this.vy = JUMP_SPEED;
    this.onGround = false;
    return true;
  }

  /**
   * Moves by (dx, dz) across the floor and, with gravity, falls for dt
   * seconds. Returns true while the walker is still moving on its own
   * (falling or in a jump).
   */
  step(dx: number, dz: number, dt: number, solids: Solids): boolean {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / STEP));
    for (let i = 0; i < steps; i++) {
      this.moveAxis(0, dx / steps, solids);
      this.moveAxis(2, dz / steps, solids);
    }
    if (!this.gravity) return false;
    this.vy = Math.max(-MAX_FALL, this.vy - GRAVITY * dt);
    const dy = this.vy * dt;
    const fall = Math.max(1, Math.ceil(Math.abs(dy) / STEP));
    const wasGround = this.onGround;
    this.onGround = false;
    for (let i = 0; i < fall; i++) {
      if (this.moveAxis(1, dy / fall, solids)) break;
    }
    // The floor is solid everywhere.
    if (this.feet[1] <= 0) {
      this.feet[1] = 0;
      this.vy = 0;
      this.onGround = true;
    }
    // Standing still on something is not moving; falling or rising is.
    return !(this.onGround && wasGround && this.vy === 0);
  }

  /** Moves along one axis; stops at the first solid box it would enter. True if stopped. */
  private moveAxis(axis: 0 | 1 | 2, delta: number, solids: Solids): boolean {
    if (delta === 0) return false;
    const before = this.body();
    const next: Vec3 = [...this.feet];
    next[axis] += delta;
    const after = this.body(next);
    const region = {
      min: [Math.min(before.min[0], after.min[0]), Math.min(before.min[1], after.min[1]), Math.min(before.min[2], after.min[2])] as Vec3,
      max: [Math.max(before.max[0], after.max[0]), Math.max(before.max[1], after.max[1]), Math.max(before.max[2], after.max[2])] as Vec3,
    };
    let stop: number | null = null;
    for (const b of solids.near(region.min, region.max)) {
      // Only boxes it would enter: one it is already inside does not hold it (it can walk out).
      if (!overlaps(after, b) || overlaps(before, b)) continue;
      const offset = axis === 1 ? (delta > 0 ? BODY.height : 0) : BODY.half;
      const limit = delta > 0 ? b.min[axis] - offset - EPS : b.max[axis] + (axis === 1 ? 0 : offset) + EPS;
      stop = stop === null ? limit : delta > 0 ? Math.min(stop, limit) : Math.max(stop, limit);
    }
    if (stop === null) {
      this.feet[axis] = next[axis];
      return false;
    }
    this.feet[axis] = stop;
    if (axis === 1) {
      if (delta < 0) this.onGround = true;
      this.vy = 0;
    }
    return true;
  }
}

/**
 * Solid boxes in a grid of 2 m cells, so a walker asks only about the
 * boxes near it (thousands of blocks stay cheap).
 */
export class SolidGrid implements Solids {
  private readonly cells = new Map<string, Box[]>();
  private readonly cell = 2;
  /** Solids too large for the grid (a floor a kilometre wide), or beyond it: each is one box, asked about every time. */
  private readonly large: Box[] = [];
  private readonly all: Box[] = [];
  size = 0;

  constructor(boxes: Iterable<Box>) {
    for (const b of boxes) this.add(b);
  }

  private add(b: Box): void {
    this.size += 1;
    // A box with no inside (or a number that is not one) is never walked into.
    if (!b.min.every((v, i) => v <= b.max[i]!)) return;
    this.all.push(b);
    const span = cellsOf(b.min, b.max, this.cell);
    if (!span) {
      this.large.push(b);
      return;
    }
    const [x0, y0, z0, x1, y1, z1] = span;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          const key = `${x},${y},${z}`;
          const list = this.cells.get(key);
          if (list) list.push(b);
          else this.cells.set(key, [b]);
        }
      }
    }
  }

  *near(min: Vec3, max: Vec3): Iterable<Box> {
    const span = cellsOf(min, max, this.cell);
    if (!span) {
      // A region too large for the grid, or beyond it: every box is the answer (larger, and only slower).
      yield* this.all;
      return;
    }
    yield* this.large;
    const [x0, y0, z0, x1, y1, z1] = span;
    const seen = new Set<Box>();
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          for (const b of this.cells.get(`${x},${y},${z}`) ?? []) {
            if (seen.has(b)) continue;
            seen.add(b);
            yield b;
          }
        }
      }
    }
  }
}

/** The most cells one solid may fill, or one question may look in (review 134, V5): a wall 60 m long and 8 m high fills 120. */
const MAX_CELLS = 4096;
/** Cells are counted this far from the middle; beyond it whole numbers stop being exact, and counting would never end. */
const MAX_CELL = 2 ** 31;

/**
 * The grid cells a region touches, as the first and last on each axis;
 * null when it is too large for the grid, too far out, or not a region
 * at all (a number that is not finite), so that no loop over cells can
 * be long or endless, whatever the page's numbers.
 */
function cellsOf(min: Vec3, max: Vec3, cell: number): [number, number, number, number, number, number] | null {
  const lo = min.map((v) => Math.floor(v / cell));
  const hi = max.map((v) => Math.floor(v / cell));
  let count = 1;
  for (let i = 0; i < 3; i++) {
    const [a, b] = [lo[i]!, hi[i]!];
    if (!(Math.abs(a) <= MAX_CELL && Math.abs(b) <= MAX_CELL) || b < a) return null;
    count *= b - a + 1;
  }
  return count <= MAX_CELLS ? [lo[0]!, lo[1]!, lo[2]!, hi[0]!, hi[1]!, hi[2]!] : null;
}
