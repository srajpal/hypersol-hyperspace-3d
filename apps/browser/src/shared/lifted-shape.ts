/**
 * A lifted model as the decoding frame hands it to the shell (milestone
 * 28, viewer/lift-host.ts): plain shapes and pictures, every mesh already
 * in its place in the model. The frame is the viewer's own code, but it
 * decoded a file from the web: the shell checks what comes back before it
 * draws it (parseLiftedShape).
 */

/** The viewer's limits for one model (viewer/budget.ts), and the room's for its pictures. */
export const LIFT_DECODE_LIMITS = {
  triangles: 2_000_000,
  /** Corners, with the triangles: a file could have few triangles and many unused corners. */
  vertices: 6_000_000,
  pictureSide: 4096,
  /** Pictures in one model. */
  pictures: 64,
  /** A picture's longest side in the room: larger ones are made smaller. */
  shownSide: 1024,
  /** Materials in one model. */
  materials: 1024,
  /** Meshes in one model. */
  meshes: 4096,
} as const;

export interface LiftedMesh {
  /** x, y, z of each corner, in the model's space. */
  positions: Float32Array;
  normals: Float32Array | null;
  /** u, v of each corner. */
  uvs: Float32Array | null;
  /** r, g, b of each corner (with a material that uses them). */
  colors: Float32Array | null;
  /** Three corners to a triangle; null when each three corners in turn are one. */
  indices: Uint32Array | null;
  /** Its material's number, or -1 for none. */
  material: number;
}

export interface LiftedMaterial {
  /** Linear r, g, b. */
  color: [number, number, number];
  emissive: [number, number, number];
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
  alphaTest: number;
  doubleSided: boolean;
  vertexColors: boolean;
  /** Its picture's number, or null. */
  map: number | null;
  /** The picture's offset x and y, repeat x and y, rotation, and centre x and y (KHR_texture_transform), or null. */
  mapTransform: [number, number, number, number, number, number, number] | null;
}

export interface LiftedShape {
  meshes: LiftedMesh[];
  materials: LiftedMaterial[];
  pictures: ImageBitmap[];
}

const finite = (v: unknown, lo = -1e9, hi = 1e9): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const triple = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((x) => finite(x, 0, 100));

function floats(v: unknown, per: number, count: number | null): Float32Array | null | false {
  if (v === null) return null;
  if (!(v instanceof Float32Array) || v.length % per !== 0) return false;
  if (count !== null && v.length / per !== count) return false;
  return v;
}

/** Checks a decoded model; null if anything in it is not as it should be, or it passes a limit. */
export function parseLiftedShape(raw: unknown): LiftedShape | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const pictures = r['pictures'];
  const materials = r['materials'];
  const meshes = r['meshes'];
  if (!Array.isArray(pictures) || !Array.isArray(materials) || !Array.isArray(meshes)) return null;
  if (pictures.length > LIFT_DECODE_LIMITS.pictures || materials.length > LIFT_DECODE_LIMITS.materials || meshes.length > LIFT_DECODE_LIMITS.meshes || meshes.length === 0) return null;
  const side = LIFT_DECODE_LIMITS.shownSide;
  if (!pictures.every((p) => typeof ImageBitmap !== 'undefined' && p instanceof ImageBitmap && p.width <= side && p.height <= side)) return null;
  const outMaterials: LiftedMaterial[] = [];
  for (const m of materials as unknown[]) {
    if (typeof m !== 'object' || m === null) return null;
    const x = m as Record<string, unknown>;
    if (!triple(x['color']) || !triple(x['emissive'])) return null;
    if (!finite(x['metalness'], 0, 1) || !finite(x['roughness'], 0, 1) || !finite(x['opacity'], 0, 1) || !finite(x['alphaTest'], 0, 1)) return null;
    if (typeof x['transparent'] !== 'boolean' || typeof x['doubleSided'] !== 'boolean' || typeof x['vertexColors'] !== 'boolean') return null;
    const map = x['map'];
    if (map !== null && !(Number.isInteger(map) && (map as number) >= 0 && (map as number) < pictures.length)) return null;
    const t = x['mapTransform'];
    if (t !== null && !(Array.isArray(t) && t.length === 7 && t.every((v) => finite(v)))) return null;
    outMaterials.push({
      color: x['color'],
      emissive: x['emissive'],
      metalness: x['metalness'],
      roughness: x['roughness'],
      opacity: x['opacity'],
      transparent: x['transparent'],
      alphaTest: x['alphaTest'],
      doubleSided: x['doubleSided'],
      vertexColors: x['vertexColors'],
      map: map as number | null,
      mapTransform: t as LiftedMaterial['mapTransform'],
    });
  }
  const outMeshes: LiftedMesh[] = [];
  let triangles = 0;
  let vertices = 0;
  for (const m of meshes as unknown[]) {
    if (typeof m !== 'object' || m === null) return null;
    const x = m as Record<string, unknown>;
    const positions = floats(x['positions'], 3, null);
    if (!positions) return null;
    const count = positions.length / 3;
    const normals = floats(x['normals'], 3, count);
    const uvs = floats(x['uvs'], 2, count);
    const colors = floats(x['colors'], 3, count);
    if (normals === false || uvs === false || colors === false) return null;
    if (!positions.every((v) => Number.isFinite(v))) return null;
    const indices = x['indices'];
    if (indices !== null && !(indices instanceof Uint32Array && indices.length % 3 === 0 && indices.every((i) => i < count))) return null;
    if (indices === null && count % 3 !== 0) return null;
    const material = x['material'];
    if (!Number.isInteger(material) || (material as number) < -1 || (material as number) >= outMaterials.length) return null;
    triangles += (indices === null ? count : (indices as Uint32Array).length) / 3;
    vertices += count;
    if (triangles > LIFT_DECODE_LIMITS.triangles || vertices > LIFT_DECODE_LIMITS.vertices) return null;
    outMeshes.push({ positions, normals, uvs, colors, indices: indices as Uint32Array | null, material: material as number });
  }
  return { meshes: outMeshes, materials: outMaterials, pictures: pictures as ImageBitmap[] };
}
