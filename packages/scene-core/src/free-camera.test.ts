import { describe, expect, it } from 'vitest';
import { DESK, FREE_LIMITS, FreeCamera, type FreeCameraRoom } from './free-camera.js';

const DEG = Math.PI / 180;
const ROOM: FreeCameraRoom = { deskDistance: 1000, floorY: -500, pageTurn: 10 * DEG, pageX: 150, pageZ: -40, slideX: 600, slideUp: 400 };

/** How far the camera is in front of the page's plane. */
function inFront(c: FreeCamera, room = ROOM): number {
  const p = c.pose().position;
  return (p.x - room.pageX) * Math.sin(room.pageTurn) + (p.z - room.pageZ) * Math.cos(room.pageTurn);
}

function settle(c: FreeCamera, ms: number, frame = 16): void {
  for (let t = 0; t < ms; t += frame) c.step(frame);
}

describe('FreeCamera (milestone 27, FC1 to FC4)', () => {
  it('starts at the desk, where the fixed camera is, and does not move until it is entered', () => {
    const c = new FreeCamera(ROOM);
    expect(c.active).toBe(false);
    expect(c.state).toEqual(DESK);
    expect(c.pose()).toEqual({ position: { x: 0, y: 0, z: 1000 }, lookAt: { x: 0, y: 0, z: 0 } });
    c.turn(1, 1);
    c.zoom(2);
    c.slide(100, 100);
    expect(c.goal).toEqual(DESK);
    expect(c.step(16)).toBe(false);
  });

  it('turns, comes closer, and slides, easing there in about 250 ms', () => {
    const c = new FreeCamera(ROOM, { settleMs: 250 });
    c.enter();
    c.turn(30 * DEG, 20 * DEG);
    c.zoom(0.8);
    c.slide(50, 30);
    expect(c.step(16)).toBe(true);
    const early = c.state;
    expect(early.yaw).toBeGreaterThan(0);
    expect(early.yaw).toBeLessThan(30 * DEG);
    settle(c, 500);
    expect(c.moving).toBe(false);
    expect(c.state.yaw).toBeCloseTo(30 * DEG, 6);
    expect(c.state.pitch).toBeCloseTo(20 * DEG, 6);
    expect(c.state.distance).toBeCloseTo(0.8, 6);
    expect(c.state.y).toBeCloseTo(30, 6);
    // From above and to the right, looking at the pivot.
    const { position, lookAt } = c.pose();
    expect(position.x).toBeGreaterThan(lookAt.x);
    expect(position.y).toBeGreaterThan(lookAt.y);
    const d = Math.hypot(position.x - lookAt.x, position.y - lookAt.y, position.z - lookAt.z);
    expect(d).toBeCloseTo(800, 6);
  });

  it('comes back to exactly the desk, and is then no longer active', () => {
    const c = new FreeCamera(ROOM);
    c.enter();
    c.turn(40 * DEG, 25 * DEG);
    c.zoom(1.7);
    c.slide(-120, 80);
    settle(c, 400);
    c.leave();
    expect(c.leaving).toBe(true);
    // Asked to move on the way back: nothing changes.
    c.turn(1, 1);
    expect(c.goal).toEqual(DESK);
    settle(c, 600);
    expect(c.active).toBe(false);
    expect(c.state).toEqual(DESK);
    expect(c.pose().position).toEqual({ x: 0, y: 0, z: 1000 });
  });

  it('comes back at once when asked, or with jump (reduced motion)', () => {
    const c = new FreeCamera(ROOM);
    c.enter();
    c.turn(20 * DEG, 0);
    c.jump();
    expect(c.state.yaw).toBeCloseTo(20 * DEG, 9);
    c.leave(true);
    expect(c.active).toBe(false);
    expect(c.state).toEqual(DESK);
    c.enter();
    c.turn(20 * DEG, 0);
    c.leave();
    c.jump();
    expect(c.active).toBe(false);
    expect(c.state).toEqual(DESK);
  });

  it('stays within the room however far it is pushed (Q6 a)', () => {
    const c = new FreeCamera(ROOM);
    c.enter();
    for (let i = 0; i < 1000; i++) {
      c.turn(5 * DEG, -5 * DEG);
      c.zoom(1.2);
      c.slide(100, -100);
    }
    c.jump();
    let s = c.state;
    // Never round to the page's back: at most 70° from its own facing.
    expect(s.yaw).toBeCloseTo(ROOM.pageTurn + FREE_LIMITS.maxTurn, 9);
    expect(s.distance).toBe(FREE_LIMITS.maxDistance);
    expect(s.x).toBe(ROOM.slideX);
    // Above the floor.
    expect(c.pose().position.y).toBeGreaterThanOrEqual(ROOM.floorY + FREE_LIMITS.floorClearance - 1e-6);
    for (let i = 0; i < 1000; i++) {
      c.turn(-5 * DEG, 5 * DEG);
      c.zoom(0.5);
      c.slide(-100, 100);
    }
    c.jump();
    s = c.state;
    // Near, high, and slid the other way: the turn is held back so the camera stays in front of the page's plane.
    expect(s.pitch).toBeCloseTo(FREE_LIMITS.maxPitch, 9);
    expect(s.distance).toBe(FREE_LIMITS.minDistance);
    expect(s.y).toBe(ROOM.slideUp);
    expect(s.yaw).toBeGreaterThanOrEqual(ROOM.pageTurn - FREE_LIMITS.maxTurn - 1e-9);
    expect(inFront(c)).toBeGreaterThanOrEqual(FREE_LIMITS.frontClearance * ROOM.deskDistance - 1e-6);
  });

  it('never passes the page\'s plane, even beyond its edge (FC4)', () => {
    // Turned fully left, near, level, and the pivot slid far left: without the limit the camera is behind the plane.
    const room = { ...ROOM, slideX: 1400 };
    const c = new FreeCamera(room);
    c.enter();
    for (let i = 0; i < 100; i++) {
      c.turn(-5 * DEG, 0);
      c.zoom(0.5);
      c.slide(-200, 0);
    }
    c.jump();
    expect(inFront(c, room)).toBeGreaterThanOrEqual(FREE_LIMITS.frontClearance * room.deskDistance - 1e-6);
    // And the desk itself is well in front.
    c.leave(true);
    expect(inFront(c, room)).toBeGreaterThan(900);
  });

  it('keeps the camera above the floor from a low pivot, raising the view from below', () => {
    const c = new FreeCamera({ ...ROOM, floorY: -200 });
    c.enter();
    for (let i = 0; i < 100; i++) c.slide(0, -100);
    c.turn(0, -90 * DEG);
    c.zoom(2.5);
    c.jump();
    expect(c.pose().position.y).toBeGreaterThanOrEqual(-200 + FREE_LIMITS.floorClearance - 1e-6);
    expect(c.state.pitch).toBeGreaterThanOrEqual(FREE_LIMITS.minPitch);
  });

  it('follows a room that changes, bringing the camera within its new limits', () => {
    const c = new FreeCamera(ROOM);
    c.enter();
    c.slide(600, 0);
    c.jump();
    expect(c.state.x).toBe(600);
    c.setRoom({ ...ROOM, slideX: 200 });
    expect(c.state.x).toBe(200);
    expect(c.goal.x).toBe(200);
  });

  it('ignores values that are not numbers', () => {
    const c = new FreeCamera(ROOM);
    c.enter();
    c.turn(Number.NaN, Number.POSITIVE_INFINITY);
    c.slide(Number.NaN, Number.NaN);
    c.zoom(Number.NaN);
    c.zoom(-1);
    c.zoom(0);
    expect(c.goal).toEqual(DESK);
  });
});
