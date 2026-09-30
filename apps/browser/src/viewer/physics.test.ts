import { describe, expect, it } from 'vitest';
import { BODY, SolidGrid, Walker, type Box, type Vec3 } from './physics';

/** A 1 m block with its lowest corner at (x, y, z). */
const block = (x: number, y: number, z: number): Box => ({ min: [x, y, z], max: [x + 1, y + 1, z + 1] });

/** Steps a walker for some seconds at 60 frames a second. */
function run(w: Walker, seconds: number, solids: SolidGrid, dx = 0, dz = 0): void {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) w.step(dx * dt, dz * dt, dt, solids);
}

describe('walking with walls and gravity (HoloML 0.2)', () => {
  it('falls to the floor, and stands with its eyes 1.6 m up', () => {
    const w = new Walker([0, 10, 0], true, false);
    run(w, 3, new SolidGrid([]));
    expect(w.feet[1]).toBe(0);
    expect(w.eye[1]).toBeCloseTo(BODY.eye, 5);
    expect(w.onGround).toBe(true);
  });

  it('lands on top of a solid block', () => {
    const w = new Walker([0.5, 8, 0.5], true, false);
    run(w, 3, new SolidGrid([block(0, 0, 0), block(0, 1, 0)]));
    expect(w.feet[1]).toBeCloseTo(2, 3);
    expect(w.onGround).toBe(true);
  });

  it('is stopped by a wall, and slides along it', () => {
    const wall = new SolidGrid([block(2, 0, -3), block(2, 0, -2), block(2, 0, -1), block(2, 0, 0), block(2, 0, 1)]);
    const w = new Walker([0, 1.6, 0.5], true, false);
    run(w, 3, wall, 2, 0); // toward +x, into the wall
    expect(w.feet[0]).toBeLessThanOrEqual(2 - BODY.half);
    expect(w.feet[0]).toBeGreaterThan(2 - BODY.half - 0.01);
    run(w, 1, wall, 1, 1); // along it
    expect(w.feet[2]).toBeGreaterThan(1);
    expect(w.feet[0]).toBeLessThanOrEqual(2 - BODY.half);
  });

  it('climbs onto a block only by jumping', () => {
    // A step three blocks deep, so the jumper lands on it rather than going over.
    const step = new SolidGrid([-1, 0, 1].flatMap((z) => [1, 2, 3].map((x) => block(x, 0, z))));
    const walking = new Walker([0, 1.6, 0.5], true, true);
    run(walking, 2, step, 2, 0);
    expect(walking.feet[1]).toBe(0);
    expect(walking.feet[0]).toBeLessThan(1);

    const jumper = new Walker([0, 1.6, 0.5], true, true);
    run(jumper, 0.2, step);
    expect(jumper.jump()).toBe(true);
    run(jumper, 1.5, step, 2, 0);
    expect(jumper.feet[1]).toBeCloseTo(1, 3);
    expect(jumper.feet[0]).toBeGreaterThan(1);
  });

  it('cannot jump without the jump flag, nor in the air', () => {
    const w = new Walker([0, 1.6, 0], true, false);
    run(w, 0.2, new SolidGrid([]));
    expect(w.jump()).toBe(false);
    const air = new Walker([0, 5, 0], true, true);
    expect(air.jump()).toBe(false);
  });

  it('without gravity keeps its height, and walls still stop it', () => {
    const w = new Walker([0, 1.6, 0.5], false, false);
    run(w, 2, new SolidGrid([block(2, 0, 0)]), 2, 0);
    expect(w.eye[1]).toBeCloseTo(1.6, 5);
    expect(w.feet[0]).toBeLessThanOrEqual(2 - BODY.half);
  });

  it('can walk out of a block it starts inside', () => {
    const w = new Walker([0.5, 1.6, 0.5], false, false);
    run(w, 2, new SolidGrid([block(0, 0, 0)]), -1, 0);
    expect(w.feet[0]).toBeLessThan(-0.5);
  });

  it('is not carried through a thin floor by a fast fall', () => {
    const w = new Walker([0.5, 300, 0.5], true, false);
    const floor: Box = { min: [-5, 49.9, -5] as Vec3, max: [5, 50, 5] as Vec3 };
    run(w, 10, new SolidGrid([floor]));
    expect(w.feet[1]).toBeCloseTo(50, 3);
  });

  it('asks the grid only about nearby boxes', () => {
    const boxes = Array.from({ length: 2000 }, (_, i) => block(i % 50, 0, Math.floor(i / 50)));
    const grid = new SolidGrid(boxes);
    expect(grid.size).toBe(2000);
    const near = [...grid.near([10, 0, 10], [11, 2, 11])];
    expect(near.length).toBeGreaterThan(0);
    expect(near.length).toBeLessThan(40);
  });

  it('a solid kilometres across, or one far beyond the scene, takes no time to add and still stops the walker (review 134, V5)', () => {
    const start = performance.now();
    // A floor 100 km by 100 km, a wall scaled to 1e15 m, and a box out where numbers no longer count by ones.
    const floor: Box = { min: [-50_000, 0.9, -50_000], max: [50_000, 1, 50_000] };
    const wall: Box = { min: [3, 0, -1e15], max: [4, 1e15, 1e15] };
    const beyond: Box = { min: [1e17, 0, 1e17], max: [1e17 + 64, 1, 1e17 + 64] };
    const nothing: Box = { min: [0, NaN, 0], max: [1, 1, 1] };
    const grid = new SolidGrid([floor, wall, beyond, nothing, block(2, 1, -3)]);
    expect(grid.size).toBe(5);
    const w = new Walker([0.5, 8, 0.5], true, false);
    run(w, 3, grid);
    expect(w.feet[1]).toBeCloseTo(1, 3);
    run(w, 3, grid, 2, 0);
    expect(w.feet[0]).toBeLessThanOrEqual(3 - BODY.half);
    expect(w.feet[0]).toBeGreaterThan(3 - BODY.half - 0.01);
    run(w, 3, grid, 0, -2);
    expect(w.feet[2]).toBeGreaterThan(-2 + BODY.half - 0.01);
    expect(performance.now() - start).toBeLessThan(500);
  });

  it('a walker placed beyond any sane place steps without hanging (a viewpoint at 1e17)', () => {
    const grid = new SolidGrid([block(0, 0, 0), block(1, 0, 0)]);
    const start = performance.now();
    for (const at of [1e17, -1e17, 1e300, 3e9]) {
      const w = new Walker([at, 2, 0], true, false);
      run(w, 0.5, grid, 2, 2);
      expect([...grid.near(w.body().min, w.body().max)].length).toBeLessThanOrEqual(2);
    }
    expect(performance.now() - start).toBeLessThan(500);
  });
});
