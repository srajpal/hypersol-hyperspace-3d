import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, SkinnedMesh } from 'three';
import { canInstance, countTriangles, isShown } from './instances';

/** A model as a file gives it: a box (12 triangles), and a mesh without indices (2 triangles). */
function model(): Object3D {
  const root = new Object3D();
  root.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
  const plain = new BufferGeometry();
  plain.setAttribute('position', new Float32BufferAttribute(new Float32Array(18), 3));
  const inner = new Object3D();
  inner.add(new Mesh(plain, new MeshStandardMaterial()));
  root.add(inner);
  return root;
}

describe("a decoded model's triangles, as drawn (review 134, V4)", () => {
  it('counts every mesh, with or without indices', () => {
    expect(countTriangles(model())).toBe(14);
  });

  it('counts a mesh the file draws many times (EXT_mesh_gpu_instancing) that many times', () => {
    const root = model();
    root.add(new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial(), 500));
    expect(countTriangles(root)).toBe(14 + 12 * 500);
  });
});

describe('which model files are drawn as instances', () => {
  it('a plain model is; one with an animation, a skin, or meshes it draws many times itself is not', () => {
    expect(canInstance(model(), false)).toBe(true);
    expect(canInstance(model(), true)).toBe(false);
    const skinned = model();
    skinned.add(new SkinnedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    expect(canInstance(skinned, false)).toBe(false);
    // An instance of it would lose the file's own copies (each would be drawn once).
    const repeated = model();
    repeated.add(new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial(), 50));
    expect(canInstance(repeated, false)).toBe(false);
  });
});

describe('what is shown (review 134, V10)', () => {
  it('a thing is shown only if it and everything that holds it are', () => {
    const group = new Object3D();
    const thing = new Object3D();
    group.add(thing);
    expect(isShown(thing)).toBe(true);
    group.visible = false;
    expect(isShown(thing)).toBe(false);
    group.visible = true;
    thing.visible = false;
    expect(isShown(thing)).toBe(false);
    expect(isShown(group)).toBe(true);
  });
});
