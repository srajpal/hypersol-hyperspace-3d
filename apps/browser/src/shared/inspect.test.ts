import { describe, expect, it } from 'vitest';
import { parseInspectRequest, parseSceneReadout } from './inspect';

describe('scene requests (milestone 15)', () => {
  it('accepts the scene operations and checks their fields', () => {
    expect(parseInspectRequest({ op: 'inspect.scene', tab: 3 })).toEqual({ request: { op: 'inspect.scene', tab: 3 } });
    expect(parseInspectRequest({ op: 'inspect.scene-select', tab: 3, index: 5 })).toEqual({
      request: { op: 'inspect.scene-select', tab: 3, index: 5 },
    });
    expect(parseInspectRequest({ op: 'inspect.scene-pick', tab: 3, on: true })).toEqual({ request: { op: 'inspect.scene-pick', tab: 3, on: true } });
    expect(parseInspectRequest({ op: 'inspect.scene-select', tab: 3, index: 1.5 })).toHaveProperty('error');
    expect(parseInspectRequest({ op: 'inspect.scene-pick', tab: 3, on: 'yes' })).toHaveProperty('error');
    expect(parseInspectRequest({ op: 'inspect.scene-eval', tab: 3 })).toHaveProperty('error');
  });
});

describe('parseSceneReadout', () => {
  it('keeps known fields and drops the rest', () => {
    const r = parseSceneReadout({
      title: 'Room',
      entryCount: 1,
      entries: [{ index: 0, kind: 'model', name: 'car', depth: 1, line: 4, column: 3, state: 'left-out', reason: 'too big', extra: 'x' }],
      selected: 0,
      picking: true,
      detail: {
        line: 4,
        column: 3,
        source: '  <model id="car" src="car.glb">',
        bounds: [[-1, 0, -1], [1, 2, 1]],
        position: [0, 0, 0],
        rotation: [0, 1, 0],
        scale: [1, 1, 1],
        triangles: 1200,
        pictures: [{ width: 512, height: 256 }],
        script: 'alert(1)',
      },
      problems: [{ code: 'unknown-attribute', message: 'm', line: 2, column: 1 }],
      error: null,
      models: [{ src: 'car.glb', state: 'left-out', reason: 'too big', bytes: 10 }],
      totals: { bytes: 10, triangles: 1200 },
      leftOutElements: 0,
      other: 1,
    });
    expect(r).not.toBeNull();
    expect(r).not.toHaveProperty('other');
    expect(r!.entries[0]).toEqual({ index: 0, kind: 'model', name: 'car', depth: 1, line: 4, column: 3, state: 'left-out', reason: 'too big' });
    expect(r!.detail).not.toHaveProperty('script');
    expect(r!.detail!.bounds).toEqual([[-1, 0, -1], [1, 2, 1]]);
    expect(r!.picking).toBe(true);
  });

  it('caps sizes and replaces bad values', () => {
    const r = parseSceneReadout({
      title: 'x'.repeat(10_000),
      entries: Array.from({ length: 5000 }, (_, i) => ({ index: i, kind: 'group', name: 'n', depth: 0, line: 1, column: 1 })),
      selected: 'all',
      detail: { position: [Infinity, NaN, '3', 4], triangles: -5, pictures: 'lots', bounds: [1] },
      totals: { bytes: -1, triangles: 1e20 },
    });
    expect(r!.title.length).toBe(200);
    expect(r!.entries.length).toBe(2000);
    expect(r!.selected).toBe(-1);
    expect(r!.detail!.position).toEqual([0, 0, 0]);
    expect(r!.detail!.triangles).toBe(0);
    expect(r!.detail!.pictures).toEqual([]);
    expect(r!.detail!.bounds).toBeNull();
    expect(r!.totals).toEqual({ bytes: 0, triangles: 0 });
  });

  it('is null for anything that is not an object', () => {
    expect(parseSceneReadout(null)).toBeNull();
    expect(parseSceneReadout('scene')).toBeNull();
  });
});
