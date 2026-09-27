/**
 * Drawing the same model many times cheaply (HoloML 0.2 draft; HyperSpace
 * 3D milestone 17). A model file is loaded once; every model element
 * that uses it without changing it (no materials of its own, no
 * animation) is one instance of an InstancedMesh per mesh of the file,
 * so an island of thousands of blocks is a handful of draw calls.
 *
 * Each such element keeps an empty Object3D (its "holder") in the scene
 * tree, for its place, its id, and its parent's moves; the pool copies
 * the holders' world matrices into the instances when told they moved.
 */
import { Box3, InstancedMesh, Matrix4, Mesh, Object3D, Vector3, type Material, type Scene } from 'three';

/** A model file, loaded and decoded once. */
export interface Template {
  /** The file's scene, never shown itself: elements get instances or clones of it. */
  scene: Object3D;
  /** Its bounding box in its own space (for outlines and walls). */
  box: Box3;
  /** Triangles in one copy. */
  triangles: number;
  bytes: number;
  pictures: { width: number; height: number }[];
  /** Whether it can be instanced: no skins and no animations. */
  instanceable: boolean;
}

const HIDDEN = new Matrix4().makeScale(0, 0, 0);

export class InstancePool {
  readonly slots: Object3D[] = [];
  private readonly parts: { mesh: InstancedMesh; local: Matrix4 }[] = [];
  private capacity = 0;
  dirty = false;

  constructor(
    private readonly template: Template,
    private readonly scene: Scene,
    /** The file's address, for the tests and the inspector. */
    readonly src = '',
  ) {
    template.scene.updateMatrixWorld(true);
    this.grow(16);
  }

  /** How many elements it draws. */
  get count(): number {
    return this.slots.length;
  }

  /** The meshes it draws with (for the renderer's raycasts). */
  get meshes(): InstancedMesh[] {
    return this.parts.map((p) => p.mesh);
  }

  add(holder: Object3D): void {
    if (this.slots.length === this.capacity) this.grow(this.capacity * 2);
    holder.userData['pool'] = this;
    holder.userData['slot'] = this.slots.length;
    this.slots.push(holder);
    for (const p of this.parts) p.mesh.count = this.slots.length;
    this.dirty = true;
  }

  remove(holder: Object3D): void {
    const slot = holder.userData['slot'] as number | undefined;
    if (slot === undefined || this.slots[slot] !== holder) return;
    // The last slot takes the removed one's place.
    const last = this.slots.pop()!;
    if (last !== holder) {
      this.slots[slot] = last;
      last.userData['slot'] = slot;
    }
    delete holder.userData['pool'];
    delete holder.userData['slot'];
    for (const p of this.parts) p.mesh.count = this.slots.length;
    this.dirty = true;
  }

  /** Copies every holder's world matrix into the instances (the scene's world matrices must be up to date). */
  sync(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const m = new Matrix4();
    for (let i = 0; i < this.slots.length; i++) {
      const holder = this.slots[i]!;
      const shown = isShown(holder);
      for (const p of this.parts) {
        if (shown) p.mesh.setMatrixAt(i, m.multiplyMatrices(holder.matrixWorld, p.local));
        else p.mesh.setMatrixAt(i, HIDDEN);
      }
    }
    for (const p of this.parts) p.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const p of this.parts) {
      this.scene.remove(p.mesh);
      p.mesh.dispose();
    }
    this.parts.length = 0;
  }

  private grow(capacity: number): void {
    const old = this.parts.splice(0);
    this.template.scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const mesh = new InstancedMesh(o.geometry, o.material as Material | Material[], capacity);
      // Many instances spread over the scene: cull none (a few draw calls either way).
      mesh.frustumCulled = false;
      mesh.userData['pool'] = this;
      mesh.count = this.slots.length;
      this.parts.push({ mesh, local: o.matrixWorld.clone() });
      this.scene.add(mesh);
    });
    for (const p of old) {
      this.scene.remove(p.mesh);
      p.mesh.dispose();
    }
    this.capacity = capacity;
    this.dirty = true;
  }
}

/** Whether an object and every parent of it are shown. */
function isShown(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** A template's box placed by a holder's world matrix: the model's bounding box in the world. */
export function worldBox(template: Template, holder: Object3D, into = new Box3()): Box3 {
  return into.copy(template.box).applyMatrix4(holder.matrixWorld);
}

/** Triangles in a model (each mesh counted as drawn). */
export function countTriangles(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const g = o.geometry;
    n += (g.index ? g.index.count : (g.getAttribute('position')?.count ?? 0)) / 3;
  });
  return Math.round(n);
}

/** The centre of a box, or of an empty one's owner. */
export function centreOf(box: Box3, fallback: Object3D): Vector3 {
  return box.isEmpty() ? fallback.getWorldPosition(new Vector3()) : box.getCenter(new Vector3());
}
