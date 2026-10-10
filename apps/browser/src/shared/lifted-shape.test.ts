import { describe, expect, it } from 'vitest';
import { LIFT_DECODE_LIMITS, parseLiftedShape, type LiftedMaterial } from './lifted-shape';

/**
 * Milestone 28 (checks LT4 and LT5): what the decoding frame hands the
 * shell is checked before anything of it is drawn. (Its pictures are
 * ImageBitmaps, which Node has not: these shapes have none; the check
 * that refuses anything else is below.)
 */

const material = (over: Partial<LiftedMaterial> = {}): LiftedMaterial => ({
  color: [1, 0.5, 0.25],
  emissive: [0, 0, 0],
  metalness: 0,
  roughness: 1,
  opacity: 1,
  transparent: false,
  alphaTest: 0,
  doubleSided: false,
  vertexColors: false,
  map: null,
  mapTransform: null,
  ...over,
});

const square = () => ({
  positions: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
  uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
  colors: null,
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  material: 0,
});

const shape = (over: Record<string, unknown> = {}) => ({ meshes: [square()], materials: [material()], pictures: [], ...over });

describe('parseLiftedShape', () => {
  it('takes plain shapes and materials as they are', () => {
    const parsed = parseLiftedShape(shape());
    expect(parsed).not.toBeNull();
    expect(parsed!.meshes[0]!.indices).toEqual(new Uint32Array([0, 1, 2, 0, 2, 3]));
    expect(parsed!.materials[0]!.color).toEqual([1, 0.5, 0.25]);
    // Without indices, each three corners in turn are a triangle; a mesh may have no material (-1).
    expect(parseLiftedShape(shape({ meshes: [{ ...square(), indices: null, positions: new Float32Array(9), normals: null, uvs: null, material: -1 }] }))).not.toBeNull();
  });

  it('refuses shapes that are not as they should be', () => {
    const bad: Record<string, unknown>[] = [
      { meshes: [] },
      { meshes: 'square' },
      { meshes: [{ ...square(), positions: [0, 0, 0] }] },
      { meshes: [{ ...square(), positions: new Float32Array(10) }] },
      { meshes: [{ ...square(), positions: new Float32Array([Number.NaN, 0, 0, 0, 0, 0, 0, 0, 0]), indices: null, normals: null, uvs: null }] },
      { meshes: [{ ...square(), normals: new Float32Array(9) }] },
      { meshes: [{ ...square(), uvs: new Float32Array(6) }] },
      { meshes: [{ ...square(), indices: new Uint32Array([0, 1, 4]) }] },
      { meshes: [{ ...square(), indices: new Uint32Array([0, 1]) }] },
      { meshes: [{ ...square(), indices: [0, 1, 2] }] },
      { meshes: [{ ...square(), indices: null }] },
      { meshes: [{ ...square(), material: 1 }] },
      { meshes: [{ ...square(), material: 0.5 }] },
      { materials: [material({ map: 0 })] },
      { materials: [material({ metalness: 2 })] },
      { materials: [material({ color: [1, 1] as unknown as [number, number, number] })] },
      { materials: [material({ mapTransform: [0, 0, 1, 1, 0, 0] as unknown as LiftedMaterial['mapTransform'] })] },
      { materials: [{ ...material(), transparent: 'yes' }] },
      { pictures: [{ width: 10, height: 10 }] },
    ];
    for (const b of bad) expect(parseLiftedShape(shape(b)), JSON.stringify(Object.keys(b))).toBeNull();
    expect(parseLiftedShape(null)).toBeNull();
  });

  it("refuses a model past the viewer's limits on triangles and corners", () => {
    // Triangles: one corner used many times over.
    const triangles = (n: number) => ({ ...square(), positions: new Float32Array(3), normals: null, uvs: null, indices: new Uint32Array(n * 3) });
    expect(parseLiftedShape(shape({ meshes: [triangles(LIFT_DECODE_LIMITS.triangles)] }))).not.toBeNull();
    expect(parseLiftedShape(shape({ meshes: [triangles(LIFT_DECODE_LIMITS.triangles), triangles(1)] }))).toBeNull();
    // Corners: many, used by few triangles.
    const corners = (n: number) => ({ ...square(), positions: new Float32Array(n * 3), normals: null, uvs: null, indices: new Uint32Array(3) });
    expect(parseLiftedShape(shape({ meshes: [corners(LIFT_DECODE_LIMITS.vertices + 1)] }))).toBeNull();
    expect(parseLiftedShape(shape({ meshes: Array.from({ length: LIFT_DECODE_LIMITS.meshes + 1 }, square) }))).toBeNull();
  });
});
