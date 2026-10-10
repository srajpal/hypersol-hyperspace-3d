/**
 * The decoding frame for lifted models (milestone 28; owner, prompt 198,
 * Q3 a): a page of the HoloML viewer's own address, framed unseen and
 * sandboxed (scripts only, of no origin) by the shell. The shell sends it
 * a model's files, which the main process fetched from the page's own
 * site; it decodes them with three.js's glTF loader and the viewer's own
 * decoders (Draco, meshopt, and KTX2: decoders.ts), and sends back plain
 * shapes and pictures: lists of numbers and picture bitmaps, nothing that
 * runs. The shell checks them again and draws them in the room.
 *
 * Its content policy (main/holoml.ts, LIFT_HOST_CSP) lets it read only
 * the viewer's own files and what it makes itself (blob: and data:): it
 * can reach no network, so a model that names an outside address gets
 * nothing from it (check LT5). It holds nothing of any page, and is
 * removed once its answer is sent.
 */
import { InstancedMesh, LoadingManager, Matrix3, Matrix4, Texture, Vector3, type Material, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACO_GLTF_CONFIG, DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { LIFT_DECODE_LIMITS, type LiftedMaterial, type LiftedMesh, type LiftedShape } from '../shared/lifted-shape';

/** The viewer's own files (the decoders'), as decoders.ts finds them. */
const here = new URL(import.meta.url);
const VIEWER_FILES = import.meta.env.DEV ? `${here.protocol}//${here.host}/` : new URL('.', import.meta.url).href;

interface Request {
  hypersolLift: true;
  url: string;
  main: ArrayBuffer;
  resources: { uri: string; bytes: ArrayBuffer }[];
}

/** A picture's pixels, whatever kind of texture holds them. */
function pixelsOf(texture: Texture): { source: ImageBitmapSource; width: number; height: number } | null {
  const img = texture.image as { width?: number; height?: number; data?: ArrayBufferView } | null;
  // KTX2 (decoded to plain RGBA here, as no graphics card's formats are asked for): the largest level.
  const level = (texture as Texture & { mipmaps?: { data?: ArrayBufferView; width: number; height: number }[] }).mipmaps?.[0];
  const raw = (level?.data ? level : img?.data ? img : null) as { data: ArrayBufferView; width: number; height: number } | null;
  if (raw) {
    const bytes = new Uint8ClampedArray(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength);
    if (bytes.length !== raw.width * raw.height * 4) return null;
    return { source: new ImageData(bytes.slice(), raw.width, raw.height), width: raw.width, height: raw.height };
  }
  if (img && typeof img.width === 'number' && typeof img.height === 'number' && (img instanceof ImageBitmap || img instanceof HTMLImageElement || img instanceof HTMLCanvasElement)) {
    return { source: img, width: img.width, height: img.height };
  }
  return null;
}

/** The model as plain shapes and pictures, every mesh in place (its transforms applied), within the limits. */
async function plain(scene: Object3D): Promise<{ shape: LiftedShape; transfer: Transferable[] }> {
  scene.updateMatrixWorld(true);
  const meshes: LiftedMesh[] = [];
  const materials: LiftedMaterial[] = [];
  const materialIndex = new Map<Material, number>();
  const textures = new Map<Texture, number>();
  const pictureJobs: Promise<ImageBitmap>[] = [];
  let triangles = 0;
  let vertices = 0;
  const transfer: Transferable[] = [];

  const picture = (texture: Texture | null | undefined): number | null => {
    if (!texture) return null;
    const known = textures.get(texture);
    if (known !== undefined) return known;
    const pixels = pixelsOf(texture);
    if (!pixels) return null;
    if (pixels.width > LIFT_DECODE_LIMITS.pictureSide || pixels.height > LIFT_DECODE_LIMITS.pictureSide) {
      throw new Error(`a picture of ${pixels.width} by ${pixels.height} pixels is larger than ${LIFT_DECODE_LIMITS.pictureSide} by ${LIFT_DECODE_LIMITS.pictureSide}`);
    }
    if (pictureJobs.length >= LIFT_DECODE_LIMITS.pictures) return null;
    // Made no larger than the room needs.
    const scale = Math.min(1, LIFT_DECODE_LIMITS.shownSide / Math.max(pixels.width, pixels.height));
    const index = pictureJobs.length;
    pictureJobs.push(
      createImageBitmap(pixels.source, {
        resizeWidth: Math.max(1, Math.round(pixels.width * scale)),
        resizeHeight: Math.max(1, Math.round(pixels.height * scale)),
        resizeQuality: 'high',
      }),
    );
    textures.set(texture, index);
    return index;
  };

  const material = (m: Material): number => {
    const known = materialIndex.get(m);
    if (known !== undefined) return known;
    const s = m as Material & {
      color?: { r: number; g: number; b: number };
      emissive?: { r: number; g: number; b: number };
      metalness?: number;
      roughness?: number;
      map?: Texture | null;
      vertexColors?: boolean;
    };
    const map = picture(s.map);
    const t = s.map;
    const out: LiftedMaterial = {
      color: s.color ? [s.color.r, s.color.g, s.color.b] : [1, 1, 1],
      emissive: s.emissive ? [s.emissive.r, s.emissive.g, s.emissive.b] : [0, 0, 0],
      metalness: typeof s.metalness === 'number' ? s.metalness : 0,
      roughness: typeof s.roughness === 'number' ? s.roughness : 1,
      opacity: m.opacity,
      transparent: m.transparent,
      alphaTest: m.alphaTest,
      doubleSided: m.side === 2,
      vertexColors: s.vertexColors === true,
      map,
      mapTransform: t && map !== null ? [t.offset.x, t.offset.y, t.repeat.x, t.repeat.y, t.rotation, t.center.x, t.center.y] : null,
    };
    materials.push(out);
    materialIndex.set(m, materials.length - 1);
    return materials.length - 1;
  };

  const p = new Vector3();
  const normalMatrix = new Matrix3();
  const each = new Matrix4();
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || !o.visible) return;
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    if (!position) return;
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    const color = geometry.getAttribute('color');
    const index = geometry.index;
    const instanced = (o as InstancedMesh).isInstancedMesh ? (o as InstancedMesh) : null;
    const copies = instanced ? instanced.count : 1;
    const corners = index ? index.count : position.count;
    for (let c = 0; c < copies; c++) {
      triangles += Math.floor(corners / 3);
      vertices += position.count;
      if (triangles > LIFT_DECODE_LIMITS.triangles) throw new Error(`it has more than ${LIFT_DECODE_LIMITS.triangles.toLocaleString('en')} triangles`);
      if (vertices > LIFT_DECODE_LIMITS.vertices) throw new Error(`it has more than ${LIFT_DECODE_LIMITS.vertices.toLocaleString('en')} corners`);
      const world = instanced ? new Matrix4().multiplyMatrices(mesh.matrixWorld, (instanced.getMatrixAt(c, each), each)) : mesh.matrixWorld;
      normalMatrix.getNormalMatrix(world);
      const positions = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        p.fromBufferAttribute(position, i).applyMatrix4(world);
        positions.set([p.x, p.y, p.z], i * 3);
      }
      let normals: Float32Array | null = null;
      if (normal) {
        normals = new Float32Array(normal.count * 3);
        for (let i = 0; i < normal.count; i++) {
          p.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
          normals.set([p.x, p.y, p.z], i * 3);
        }
      }
      let uvs: Float32Array | null = null;
      if (uv) {
        uvs = new Float32Array(uv.count * 2);
        for (let i = 0; i < uv.count; i++) uvs.set([uv.getX(i), uv.getY(i)], i * 2);
      }
      let colors: Float32Array | null = null;
      if (color) {
        colors = new Float32Array(color.count * 3);
        for (let i = 0; i < color.count; i++) colors.set([color.getX(i), color.getY(i), color.getZ(i)], i * 3);
      }
      const indices = index ? Uint32Array.from({ length: index.count }, (_, i) => index.getX(i)) : null;
      const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      meshes.push({ positions, normals, uvs, colors, indices, material: m ? material(m) : -1 });
      for (const a of [positions, normals, uvs, colors, indices]) if (a) transfer.push(a.buffer);
    }
  });
  if (meshes.length === 0) throw new Error('it has no shapes to show');
  const pictures = await Promise.all(pictureJobs);
  transfer.push(...pictures);
  return { shape: { meshes, materials, pictures }, transfer };
}

async function decode(r: Request): Promise<{ shape: LiftedShape; transfer: Transferable[] }> {
  // The loader reads only the files it was given, and the viewer's own decoders: nothing else, anywhere.
  const blobs = new Map<string, string>();
  for (const f of r.resources) {
    try {
      blobs.set(new URL(f.uri, r.url).href, URL.createObjectURL(new Blob([f.bytes])));
    } catch {
      // A name that is no address: the model shows without that file.
    }
  }
  const manager = new LoadingManager();
  manager.setURLModifier((u) => {
    if (u.startsWith('blob:') || u.startsWith('data:')) return u;
    if (u.startsWith(VIEWER_FILES)) return u;
    try {
      return blobs.get(new URL(u, r.url).href) ?? 'blob:uncounted';
    } catch {
      return 'blob:uncounted';
    }
  });
  const draco = new DRACOLoader(manager).setDecoderPath(DRACO_GLTF_CONFIG as unknown as string).setWorkerLimit(1);
  const ktx2 = new KTX2Loader(manager).setWorkerLimit(1);
  // No graphics card here: its pictures are made plain RGBA, which the room's own pictures are made from.
  (ktx2 as unknown as { workerConfig: Record<string, boolean> }).workerConfig = {
    astcSupported: false,
    astcHDRSupported: false,
    etc1Supported: false,
    etc2Supported: false,
    dxtSupported: false,
    bptcSupported: false,
    pvrtcSupported: false,
  };
  const loader = new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  try {
    // What the loader says of a file it cannot read is for programmers: the notice says it in words.
    const gltf = await loader.parseAsync(r.main, r.url.slice(0, r.url.lastIndexOf('/') + 1)).catch(() => {
      throw new Error('it could not be read as a glTF model');
    });
    const scene = gltf.scene as Object3D | undefined;
    if (!scene) throw new Error('it has no scene');
    return await plain(scene);
  } finally {
    draco.dispose();
    ktx2.dispose();
    for (const b of blobs.values()) URL.revokeObjectURL(b);
  }
}

window.addEventListener('message', (e: MessageEvent) => {
  const port = e.ports[0];
  const r = e.data as Partial<Request> | null;
  if (e.source !== window.parent || r?.hypersolLift !== true || !port || typeof r.url !== 'string' || !(r.main instanceof ArrayBuffer) || !Array.isArray(r.resources)) return;
  decode(r as Request).then(
    ({ shape, transfer }) => port.postMessage({ ok: true, shape }, transfer),
    (err: unknown) => port.postMessage({ ok: false, reason: err instanceof Error ? err.message : 'it could not be read' }),
  );
});
