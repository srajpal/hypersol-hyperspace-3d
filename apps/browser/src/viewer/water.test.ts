import { describe, expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry } from 'three';
import { distanceGain } from './sound';
import { Water, waterPath } from './water';

// A tank 10 m wide, 4 m high, and 20 m deep, its floor's middle at the origin.
const MIN: [number, number, number] = [-5, 0, -10];
const MAX: [number, number, number] = [5, 4, 10];

describe('water (milestone 21)', () => {
  it('measures the way through the water: all of it from inside, only the part inside from outside', () => {
    // Inside, looking 6 m along: all 6 m.
    expect(waterPath([0, 2, 0], [0, 2, -6], MIN, MAX)).toBeCloseTo(6);
    // From outside the glass at z = 10, 3 m away, to a fish 4 m inside: only the 4 m in the water.
    expect(waterPath([0, 2, 13], [0, 2, 6], MIN, MAX)).toBeCloseTo(4);
    // Past the tank: through it, 20 m, and out the far side.
    expect(waterPath([0, 2, 13], [0, 2, -15], MIN, MAX)).toBeCloseTo(20);
    // Beside it, never in it.
    expect(waterPath([8, 2, 13], [8, 2, -15], MIN, MAX)).toBe(0);
    // Above the surface.
    expect(waterPath([0, 5, 0], [3, 6, -2], MIN, MAX)).toBe(0);
    // At a slant, in through the surface: from y = 4 down to y = 2 of a 2-2-0 way (half its length).
    expect(waterPath([0, 6, 0], [0, 2, 4], MIN, MAX)).toBeCloseTo(Math.hypot(2, 2) / 1, 5);
  });

  it('fades evenly: fully at its clarity, half at half, from where the viewer is', () => {
    const w = new Water({ position: [0, 0, 0], size: [10, 4, 20], color: '#1f6f8b', clarity: 12, caustics: true }, true);
    expect(w.min).toEqual(MIN);
    expect(w.max).toEqual(MAX);
    expect(w.fadeAt([0, 2, 0], [0, 2, -6])).toBeCloseTo(0.5);
    expect(w.fadeAt([0, 2, 0], [0, 2, -9])).toBeCloseTo(0.75);
    expect(w.fadeAt([0, 2, 10], [0, 2, -10])).toBe(1);
    expect(w.fadeAt([0, 2, 13], [0, 2, 12])).toBe(0);
  });

  it('moves its light on only when it is drawn and motion is not reduced', () => {
    const on = new Water({ position: [0, 0, 0], size: [1, 1, 1], color: '#1f6f8b', clarity: 5, caustics: true }, true);
    expect(on.causticsShown).toBe(true);
    expect(on.step(1000, false)).toBe(true);
    const t = on.causticsTime;
    expect(t).toBeGreaterThan(0);
    expect(on.step(1000, true)).toBe(false);
    expect(on.causticsTime).toBe(t);
    // Drawing in software: left out, and nothing moves.
    const software = new Water({ position: [0, 0, 0], size: [1, 1, 1], color: '#1f6f8b', clarity: 5, caustics: true }, false);
    expect(software.causticsShown).toBe(false);
    expect(software.step(1000, false)).toBe(false);
    // Without caustics the water is still.
    const plain = new Water({ position: [0, 0, 0], size: [1, 1, 1], color: '#1f6f8b', clarity: 5, caustics: false }, true);
    expect(plain.step(1000, false)).toBe(false);
  });

  it('goes over model materials once, and leaves text alone', () => {
    const w = new Water({ position: [0, 0, 0], size: [1, 1, 1], color: '#1f6f8b', clarity: 5, caustics: true }, true);
    const root = new Object3D();
    const fish = new MeshStandardMaterial();
    root.add(new Mesh(new PlaneGeometry(), fish));
    const board = new Object3D();
    board.userData['holomlText'] = true;
    const words = new MeshBasicMaterial();
    board.add(new Mesh(new PlaneGeometry(), words));
    root.add(board);
    const before = fish.onBeforeCompile;
    w.hook(root);
    expect(fish.onBeforeCompile).not.toBe(before);
    expect(fish.customProgramCacheKey()).toContain('holoml-water-lit');
    expect(words.customProgramCacheKey()).not.toContain('holoml-water');
    const once = fish.onBeforeCompile;
    w.hook(root);
    expect(fish.onBeforeCompile).toBe(once);
  });
});

describe('sounds from a place (milestone 21)', () => {
  it('play at their volume within 1 metre, quieter evenly, and silent from their range on', () => {
    expect(distanceGain(0.5, 20)).toBe(1);
    expect(distanceGain(1, 20)).toBe(1);
    expect(distanceGain(10.5, 20)).toBeCloseTo(0.5);
    expect(distanceGain(20, 20)).toBe(0);
    expect(distanceGain(35, 20)).toBe(0);
    // A range under 1 metre: full up to it... and silent past it.
    expect(distanceGain(0.3, 0.5)).toBe(1);
    expect(distanceGain(0.6, 0.5)).toBe(0);
  });
});
