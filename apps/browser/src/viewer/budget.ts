/**
 * The HoloML viewer's resource limits (milestone 15, GitHub issue #23;
 * owner, prompt 77, Q1 a and Q2 a). Every model is fetched here, with the
 * files its glTF names, byte by byte against the page's limits, and its
 * pictures' sizes and triangles are read from the file's own description
 * before anything is decoded. A model that crosses a limit is left out;
 * the rest of the scene shows.
 *
 * Milestone 17 (HoloML 0.2): a model file is loaded once however
 * many models use it, so the limit is on model files; each model drawn
 * counts its triangles; sound files count like model files.
 *
 * Milestone 20 (loading by area): what a page lets go stops counting, so
 * the limits count only what is loaded now.
 *
 * Review 134 (V3, V4, V6): what a load holds of the page's totals is kept
 * in one place, its claim, and given back whole when the load fails, is
 * refused, or is let go; a model's triangles are counted again once it is
 * decoded; and the limits cover what files become (the pixels of decoded
 * pictures, the seconds of decoded sound, the lights), not only their bytes.
 */

export const LIMITS = {
  /** The page's own text. */
  pageBytes: 2 * 1024 * 1024,
  /** Elements shown; later ones are left out. */
  elements: 10_000,
  /** Different model files (a file used by many models is loaded once). */
  modelFiles: 64,
  /** One file: a model, a file it names, a sound, or a picture. */
  fileBytes: 32 * 1024 * 1024,
  /** All of a page's model, sound, and picture files together. */
  totalBytes: 128 * 1024 * 1024,
  /** A picture's width and height. */
  pictureSide: 4096,
  /**
   * The pixels of all the page's pictures together, decoded: its own and
   * those in its models. Eight pictures of the largest size, which is half
   * a gigabyte on the graphics card before their smaller copies.
   */
  picturePixels: 8 * 4096 * 4096,
  /** Triangles in all the page's models, each model counted as drawn. */
  triangles: 2_000_000,
  /**
   * The seconds of all the page's sounds together, decoded: ten minutes,
   * about 230 MB of samples in memory (two channels at 48,000 a second).
   */
  soundSeconds: 600,
  /** Lights that shine from a place or a direction (ambient lights cost nothing), those in model files included; later ones are left out. */
  lights: 32,
  /** Lights that cast shadows (each draws the scene once more, and takes a picture of its own in every material); later ones light the scene without shadows. */
  shadowLights: 4,
  /** One file (a model with the files it names, or a sound), from asking to arrived. */
  fileMs: 30_000,
} as const;

/**
 * Why a model was left out, in words for the notice and the inspector.
 * overTotal: it would pass the page's totals (bytes, triangles, pixels, or
 * seconds), which fall again as models are let go, so a model that loads
 * by area can wait for room (milestone 20).
 */
export class LeftOut extends Error {
  constructor(
    readonly reason: string,
    readonly overTotal = false,
  ) {
    super(reason);
    this.name = 'LeftOut';
  }
}

/**
 * A file that arrived and cannot be read as what it should be (a model
 * that is not glTF, a picture that is not a picture). It would read no
 * better a second time, so it is not fetched again on the same page.
 */
export class Unreadable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Unreadable';
  }
}

const MB = (n: number) => `${Math.round(n / (1024 * 1024))} MB`;
const count = (n: number) => Math.round(n).toLocaleString('en');

/**
 * What one load holds of the page's totals: the bytes of its files, the
 * triangles of one copy of a model, the pixels of its pictures, the
 * seconds of a sound. Whatever is charged to the page is charged here, and
 * `release` gives all of it back, once, so what is charged and what is
 * released are always the same numbers (review 134, V3 and V4).
 */
export class Claim {
  bytes = 0;
  triangles = 0;
  pixels = 0;
  seconds = 0;

  constructor(private readonly budget: Budget) {}

  /**
   * Its triangles become `n` (first as the file describes itself, then as
   * counted once decoded). Throws LeftOut, holding what it held, if the
   * page's triangles would pass their limit.
   */
  setTriangles(n: number): void {
    const next = this.budget.triangles - this.triangles + n;
    if (next > LIMITS.triangles) throw new LeftOut(`${count(n)} triangles would pass the page's ${count(LIMITS.triangles)}`, true);
    this.budget.triangles = next;
    this.triangles = n;
  }

  /** The pixels of its pictures become `n`; throws LeftOut past the page's limit. */
  setPixels(n: number): void {
    const next = this.budget.pixels - this.pixels + n;
    if (next > LIMITS.picturePixels) {
      throw new LeftOut(`pictures of ${count(n)} pixels would pass the page's ${count(LIMITS.picturePixels)} pixels of pictures in all`, true);
    }
    this.budget.pixels = next;
    this.pixels = n;
  }

  /** The seconds of its sound become `n`; throws LeftOut past the page's limit. */
  setSeconds(n: number): void {
    const next = this.budget.seconds - this.seconds + n;
    if (next > LIMITS.soundSeconds) {
      throw new LeftOut(`${count(n)} seconds of sound would pass the page's ${count(LIMITS.soundSeconds)} seconds of sound in all`, true);
    }
    this.budget.seconds = next;
    this.seconds = n;
  }

  /** Bytes that arrived for it (counted as they come, by the budget). */
  addBytes(n: number): void {
    this.budget.bytes += n;
    this.bytes += n;
  }

  /** Gives back everything it holds. Safe to ask twice: the second time it holds nothing. */
  release(): void {
    this.budget.bytes = Math.max(0, this.budget.bytes - this.bytes);
    this.budget.triangles = Math.max(0, this.budget.triangles - this.triangles);
    this.budget.pixels = Math.max(0, this.budget.pixels - this.pixels);
    this.budget.seconds = Math.max(0, this.budget.seconds - this.seconds);
    this.bytes = this.triangles = this.pixels = this.seconds = 0;
  }
}

export interface LoadedFiles {
  /** The model file itself. */
  main: ArrayBuffer;
  /** Every other file it names, by its resolved address, as blob: addresses to hand to the loader. */
  blobs: Map<string, string>;
  bytes: number;
  triangles: number;
  pictures: { width: number; height: number }[];
  /** What the load holds of the page's totals: released if decoding fails, and when the file is let go. */
  claim: Claim;
}

/** The page's running totals, and a way to stop everything. */
export class Budget {
  bytes = 0;
  triangles = 0;
  /** The pixels of the page's pictures, its own and its models' (review 134, V6). */
  pixels = 0;
  /** The seconds of the page's sounds. */
  seconds = 0;
  private readonly controllers = new Set<AbortController>();
  private stopped = false;

  /**
   * Stops every load in progress (Esc, the stop button). Leaving the page
   * stops for good (permanent): nothing starts after it. A plain stop lets
   * a script's later additions load.
   */
  stop(permanent = false): void {
    if (permanent) this.stopped = true;
    for (const c of this.controllers) c.abort(new LeftOut('stopped before it finished loading'));
    this.controllers.clear();
  }

  get busy(): boolean {
    return this.controllers.size > 0;
  }

  /**
   * Fetches a model and the files it names, within the limits. Resolves
   * with the bytes to decode; rejects with LeftOut for a limit or a stop,
   * with Unreadable when the file is not glTF, or with an Error when a
   * file cannot be fetched. A load that rejects holds nothing.
   */
  async load(url: URL, origin: string): Promise<LoadedFiles> {
    if (this.stopped) throw new LeftOut('stopped before it finished loading');
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(new LeftOut(`still loading after ${LIMITS.fileMs / 1000} s`)), LIMITS.fileMs);
    const blobs = new Map<string, string>();
    // This model's share of the page's totals (the file and those it names).
    const claim = new Claim(this);
    try {
      const main = await this.fetchCounted(url, controller.signal, claim);
      let parsed: Description;
      try {
        parsed = describe(main);
      } catch (e) {
        throw new Unreadable(e instanceof Error ? e.message : String(e));
      }
      // Triangles are known from the file's own description: refuse before decoding.
      // Held at once, so models loading side by side cannot pass the limit together.
      claim.setTriangles(parsed.triangles);
      const pictures = [...parsed.embeddedPictures];
      for (const uri of parsed.externalUris) {
        const target = new URL(uri, url);
        if (target.origin !== origin) throw new LeftOut(`it names a file from another site (${target.origin})`);
        const data = new Uint8Array(await this.fetchCounted(target, controller.signal, claim));
        const size = parsed.pictureUris.has(uri) ? headerSize(data) : null;
        if (size) pictures.push(size);
        // Pictures kept inside this file (a .gltf's images in its .bin): their sizes too, before anything is decoded.
        for (const at of parsed.picturesIn.get(uri) ?? []) {
          const inside = headerSize(data.subarray(at.offset, at.offset + Math.min(at.length, HEAD)));
          if (inside) pictures.push(inside);
        }
        blobs.set(target.href, URL.createObjectURL(new Blob([data])));
      }
      for (const p of pictures) {
        if (p.width > LIMITS.pictureSide || p.height > LIMITS.pictureSide) {
          throw new LeftOut(`a picture of ${p.width} by ${p.height} pixels is larger than ${LIMITS.pictureSide} by ${LIMITS.pictureSide}`);
        }
      }
      claim.setPixels(pictures.reduce((sum, p) => sum + p.width * p.height, 0));
      return { main, blobs, bytes: claim.bytes, triangles: parsed.triangles, pictures, claim };
    } catch (e) {
      for (const b of blobs.values()) URL.revokeObjectURL(b);
      claim.release();
      const reason = controller.signal.aborted ? controller.signal.reason : e;
      // A limit or a stop leaves the model out; anything else (a missing file, a broken answer) is a failure.
      throw reason instanceof LeftOut || reason instanceof Error ? reason : new Error(String(reason));
    } finally {
      clearTimeout(timer);
      this.controllers.delete(controller);
    }
  }

  /**
   * Another model drawn from a file already loaded: its triangles count
   * again (they are drawn again). Throws LeftOut past the limit.
   */
  useTriangles(n: number): void {
    if (this.triangles + n > LIMITS.triangles) {
      throw new LeftOut(`${n.toLocaleString('en')} more triangles would pass the page's ${LIMITS.triangles.toLocaleString('en')}`, true);
    }
    this.triangles += n;
  }

  /** A model removed by a script, or let go (loading by area): its triangles no longer count. */
  releaseTriangles(n: number): void {
    this.triangles = Math.max(0, this.triangles - n);
  }

  /** A picture left out after it arrived (too large, or not a picture), or a file let go (loading by area): its bytes no longer count. */
  releaseBytes(n: number): void {
    this.bytes = Math.max(0, this.bytes - n);
  }

  /**
   * A file other than a model (a sound, or a picture the page names),
   * counted like a model's files.
   * Rejects with LeftOut for a limit or a stop, or with an Error when it
   * cannot be fetched; then it holds nothing. What it holds once it has
   * arrived is its claim, for the caller to release when the file is left
   * out after all, or let go.
   */
  async file(url: URL, origin: string): Promise<{ data: ArrayBuffer; bytes: number; claim: Claim }> {
    if (this.stopped) throw new LeftOut('stopped before it finished loading');
    if (url.origin !== origin) throw new LeftOut(`it is from another site (${url.origin})`);
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(new LeftOut(`still loading after ${LIMITS.fileMs / 1000} s`)), LIMITS.fileMs);
    const claim = new Claim(this);
    try {
      const data = await this.fetchCounted(url, controller.signal, claim);
      return { data, bytes: claim.bytes, claim };
    } catch (e) {
      claim.release();
      const reason = controller.signal.aborted ? controller.signal.reason : e;
      throw reason instanceof LeftOut || reason instanceof Error ? reason : new Error(String(reason));
    } finally {
      clearTimeout(timer);
      this.controllers.delete(controller);
    }
  }

  /** A file's bytes, counted as they arrive against the file and page limits. */
  private async fetchCounted(url: URL, signal: AbortSignal, claim: Claim): Promise<ArrayBuffer> {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`${url.pathname.split('/').pop()} answered ${res.status}`);
    const declared = Number(res.headers.get('content-length') ?? NaN);
    if (declared > LIMITS.fileBytes) throw new LeftOut(`a file of ${MB(declared)} is larger than ${MB(LIMITS.fileBytes)}`);
    const reader = res.body?.getReader();
    // No body (an empty answer): nothing to count.
    if (!reader) return new ArrayBuffer(0);
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.byteLength;
      claim.addBytes(value.byteLength);
      // Released before anything else runs, so models loading side by side see the page's true total.
      if (got > LIMITS.fileBytes) {
        void reader.cancel();
        claim.release();
        throw new LeftOut(`a file larger than ${MB(LIMITS.fileBytes)}`);
      }
      if (this.bytes > LIMITS.totalBytes) {
        void reader.cancel();
        claim.release();
        throw new LeftOut(`the page's files would pass ${MB(LIMITS.totalBytes)} in all`, true);
      }
      chunks.push(value);
    }
    const out = new Uint8Array(got);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.byteLength;
    }
    return out.buffer;
  }
}

/** Enough of a file's start for any picture's header. */
const HEAD = 65_536;

interface Description {
  triangles: number;
  externalUris: string[];
  /** Those of the files it names that are pictures (the others hold its meshes). */
  pictureUris: Set<string>;
  embeddedPictures: { width: number; height: number }[];
  /** Pictures kept inside a file the glTF names (by that file's address as written): where each starts, and how long it is. */
  picturesIn: Map<string, { offset: number; length: number }[]>;
}

interface GltfJson {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: { mesh?: number; children?: number[]; extensions?: { EXT_mesh_gpu_instancing?: { attributes?: Record<string, number> } } }[];
  meshes?: { primitives?: { indices?: number; attributes?: Record<string, number>; mode?: number }[] }[];
  accessors?: { count?: number }[];
  buffers?: { uri?: string }[];
  images?: { uri?: string; bufferView?: number }[];
  bufferViews?: { buffer?: number; byteOffset?: number; byteLength?: number }[];
}

/** A count as a file wrote it: a whole number of 0 or more, or 0 for anything else. */
function whole(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function list<T>(v: T[] | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

/**
 * What a glTF file says about itself: its triangles (each mesh counted as
 * often as the scene uses it, and as often as the file asks for it to be
 * repeated), the files it names, and the sizes of the pictures stored
 * inside it. An estimate, for refusing a model before decoding it: the
 * triangles are counted again once it is decoded (review 134, V4).
 */
export function describe(file: ArrayBuffer): Description {
  const bytes = new Uint8Array(file);
  let json: GltfJson;
  let bin: Uint8Array | null = null;
  const view = new DataView(file);
  if (bytes.byteLength >= 20 && view.getUint32(0, true) === 0x46546c67 /* glTF */) {
    const jsonLength = view.getUint32(12, true);
    json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as GltfJson;
    const binStart = 20 + jsonLength;
    if (bytes.byteLength >= binStart + 8) {
      const binLength = view.getUint32(binStart, true);
      bin = bytes.subarray(binStart + 8, binStart + 8 + binLength);
    }
  } else {
    json = JSON.parse(new TextDecoder().decode(bytes)) as GltfJson;
  }
  if (typeof json !== 'object' || json === null) throw new Error('not a glTF file');
  const named = (files: { uri?: string }[]) => files.map((x) => x?.uri).filter((u): u is string => typeof u === 'string' && !u.startsWith('data:'));
  const pictureUris = new Set(named(list(json.images)));
  const externalUris = [...named(list(json.buffers)), ...pictureUris];

  // Triangles in one copy of each mesh: lists of triangles, strips, and fans (a strip or fan of n corners is n - 2 triangles).
  const accessors = list(json.accessors);
  const meshTriangles = list(json.meshes).map((m) =>
    list(m?.primitives).reduce((sum, p) => {
      const mode = p?.mode ?? 4;
      if (mode !== 4 && mode !== 5 && mode !== 6) return sum;
      const corners = whole(accessors[p?.indices ?? p?.attributes?.['POSITION'] ?? -1]?.count);
      return sum + (mode === 4 ? Math.floor(corners / 3) : Math.max(0, corners - 2));
    }, 0),
  );
  // A node's own triangles: its mesh, as many times as the file has it drawn (EXT_mesh_gpu_instancing).
  const nodes = list(json.nodes);
  const own = (index: number): number => {
    const node = nodes[index];
    const copies = node?.extensions?.EXT_mesh_gpu_instancing?.attributes;
    const times = copies && typeof copies === 'object' ? Math.max(1, ...Object.values(copies).map((a) => whole(accessors[a]?.count))) : 1;
    return (meshTriangles[whole(node?.mesh)] ?? 0) * (node?.mesh === undefined ? 0 : times);
  };
  // Every node of the default scene with what it holds, as often as it appears: each node is counted once and
  // remembered, so nodes that share their children (not allowed, but a hostile file may) cost no more than a tree
  // (64 levels of two shared children each would otherwise be 2^64 steps; review 134, V5).
  const total = new Array<number>(nodes.length).fill(0);
  const state = new Uint8Array(nodes.length); // 0 not yet, 1 being counted, 2 counted
  const counted = (root: number): number => {
    if (!Number.isInteger(root) || root < 0 || root >= nodes.length || state[root] === 1) return 0;
    if (state[root] === 2) return total[root]!;
    const open: { index: number; next: number }[] = [];
    const enter = (index: number) => {
      state[index] = 1;
      total[index] = own(index);
      open.push({ index, next: 0 });
    };
    enter(root);
    while (open.length > 0) {
      const top = open[open.length - 1]!;
      const children = list(nodes[top.index]?.children);
      if (top.next < children.length) {
        const child = children[top.next++]!;
        // Out of range, or a node that holds itself: nothing more to count.
        if (!Number.isInteger(child) || child < 0 || child >= nodes.length || state[child] === 1) continue;
        if (state[child] === 2) total[top.index]! += total[child]!;
        else enter(child);
      } else {
        state[top.index] = 2;
        open.pop();
        const parent = open[open.length - 1];
        if (parent) total[parent.index]! += total[top.index]!;
      }
    }
    return total[root]!;
  };
  const roots = list(list(json.scenes)[whole(json.scene)]?.nodes ?? nodes.map((_, i) => i));
  const triangles = roots.reduce((sum, r) => sum + counted(r), 0);

  // Pictures stored in the file: in data: addresses, in a buffer of a .glb, or in a buffer the file names or holds.
  const embeddedPictures: { width: number; height: number }[] = [];
  const picturesIn = new Map<string, { offset: number; length: number }[]>();
  const views = list(json.bufferViews);
  for (const image of list(json.images)) {
    let head: Uint8Array | null = null;
    if (typeof image?.uri === 'string') {
      if (image.uri.startsWith('data:')) head = dataBytes(image.uri, HEAD);
    } else if (image?.bufferView !== undefined) {
      const v = views[image.bufferView];
      const [offset, length] = [whole(v?.byteOffset), whole(v?.byteLength)];
      const uri = list(json.buffers)[whole(v?.buffer)]?.uri;
      if (!v) continue;
      if (typeof uri !== 'string') head = bin ? bin.subarray(offset, offset + Math.min(length, HEAD)) : null;
      else if (uri.startsWith('data:')) head = dataBytes(uri, offset + Math.min(length, HEAD))?.subarray(offset) ?? null;
      else picturesIn.set(uri, [...(picturesIn.get(uri) ?? []), { offset, length }]);
    }
    const size = head ? headerSize(head) : null;
    if (size) embeddedPictures.push(size);
  }
  return { triangles, externalUris, pictureUris, embeddedPictures, picturesIn };
}

/** The first bytes (at most `most`) of a base64 data: address. */
function dataBytes(uri: string, most: number): Uint8Array | null {
  const comma = uri.indexOf(',');
  if (comma < 0 || !uri.slice(0, comma).endsWith(';base64')) return null;
  try {
    // base64 is read in fours, each four giving three bytes.
    const part = uri.slice(comma + 1, comma + 1 + Math.ceil(most / 3) * 4 + 8).replace(/[^A-Za-z0-9+/=]/g, '');
    const text = atob(part.slice(0, part.length - (part.length % 4)));
    return Uint8Array.from(text, (c) => c.charCodeAt(0)).subarray(0, most);
  } catch {
    return null;
  }
}

/** A PNG's, JPEG's, or WebP's width and height, from its header; null if unknown. */
export function pictureSize(b: Uint8Array): { width: number; height: number } | null {
  const u32 = (at: number) => ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
  const u16 = (at: number) => (b[at]! << 8) | b[at + 1]!;
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { width: u32(16), height: u32(20) };
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1]!;
      const length = u16(i + 2);
      // Start of frame (baseline, progressive, and the rest), not DHT, JPG, or DAC.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: u16(i + 7), height: u16(i + 5) };
      }
      i += 2 + length;
    }
    return null;
  }
  if (b.length >= 30 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') {
    const kind = String.fromCharCode(...b.subarray(12, 16));
    if (kind === 'VP8X') return { width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
    if (kind === 'VP8 ') return { width: (b[26]! | (b[27]! << 8)) & 0x3fff, height: (b[28]! | (b[29]! << 8)) & 0x3fff };
    if (kind === 'VP8L') {
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

/**
 * The width and height of a picture inside a model file, from its
 * header: a PNG, JPEG, or WebP as above, and the other kinds Chromium
 * would decode there (GIF, BMP, AVIF), so that none is decoded before its
 * size is known (review 134, V10). Null if unknown; what is decoded is
 * measured again afterwards.
 */
export function headerSize(b: Uint8Array): { width: number; height: number } | null {
  const known = pictureSize(b);
  if (known) return known;
  const le16 = (at: number) => b[at]! | (b[at + 1]! << 8);
  const le32 = (at: number) => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) | 0;
  const be32 = (at: number) => ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
  const tag = (at: number, word: string) => b.length >= at + word.length && [...word].every((c, i) => b[at + i] === c.charCodeAt(0));
  if (b.length >= 10 && (tag(0, 'GIF87a') || tag(0, 'GIF89a'))) return { width: le16(6), height: le16(8) };
  // A BMP's height is written below zero when its rows run from the top.
  if (b.length >= 26 && tag(0, 'BM')) return { width: Math.abs(le32(18)), height: Math.abs(le32(22)) };
  if (b.length >= 12 && tag(4, 'ftyp')) {
    // AVIF: the largest "ispe" (a picture's width and height); smaller ones are its tiles and its thumbnail.
    let size: { width: number; height: number } | null = null;
    for (let i = 12; i + 16 <= b.length; i++) {
      if (!tag(i, 'ispe')) continue;
      const [width, height] = [be32(i + 8), be32(i + 12)];
      if (!size || width * height > size.width * size.height) size = { width, height };
    }
    return size;
  }
  return null;
}

/**
 * A Radiance HDR picture's width and height, from the text at its start
 * (the line "-Y height +X width" after a blank line); null if it is not
 * there. Read before the picture is, so a huge one is never unpacked.
 */
export function hdrSize(b: Uint8Array): { width: number; height: number } | null {
  const head = new TextDecoder('latin1').decode(b.subarray(0, 4096));
  const m = /\n\s*-Y\s+(\d{1,9})\s+\+X\s+(\d{1,9})\s*\n/.exec(head);
  return m ? { width: Number(m[2]), height: Number(m[1]) } : null;
}

/**
 * How long a sound plays, in seconds, from its file's own header, for a
 * WAV, an Ogg (Vorbis or Opus), or an MP3 file; null if it cannot be
 * told. An estimate, for leaving a long sound out before it is decoded
 * (an hour of quiet speech fits in 32 MB, and is gigabytes once decoded);
 * what is decoded is measured again (review 134, V6).
 */
export function soundSeconds(b: Uint8Array): number | null {
  const tag = (at: number, word: string) => at >= 0 && b.length >= at + word.length && [...word].every((c, i) => b[at + i] === c.charCodeAt(0));
  const le32 = (at: number) => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;
  const be32 = (at: number) => ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
  const sane = (seconds: number) => (Number.isFinite(seconds) && seconds >= 0 ? seconds : null);

  if (tag(0, 'RIFF') && tag(8, 'WAVE')) {
    // Its parts, one after another: "fmt " says how many bytes make a second, "data" holds the sound.
    let bytesASecond = 0;
    for (let at = 12; at + 8 <= b.length; ) {
      const size = le32(at + 4);
      if (tag(at, 'fmt ') && at + 20 <= b.length) bytesASecond = le32(at + 16);
      if (tag(at, 'data')) return bytesASecond > 0 ? sane(Math.min(size, b.length - at - 8) / bytesASecond) : null;
      at += 8 + size + (size % 2);
    }
    return null;
  }

  if (tag(0, 'OggS') && b.length >= 28) {
    // The first page holds the codec's header; the last page's position is the length, in samples.
    const first = 27 + b[26]!;
    let rate = 0;
    if (tag(first, '\u0001vorbis')) rate = le32(first + 12);
    else if (tag(first, 'OpusHead')) rate = 48_000;
    if (rate === 0) return null;
    for (let at = b.length - 14; at >= Math.max(0, b.length - HEAD); at--) {
      // A page on which no sound ends says so with all ones: the one before it has the length.
      if (!tag(at, 'OggS') || (le32(at + 6) === 0xffffffff && le32(at + 10) === 0xffffffff)) continue;
      return sane((le32(at + 6) + le32(at + 10) * 2 ** 32) / rate);
    }
    return null;
  }

  // MP3: past any ID3 tag, the first frame may hold a "Xing" or "Info" part that says how many frames there are.
  // Without one the length is not told (the frames may differ in size), and the sound is measured once decoded.
  let at = 0;
  if (tag(0, 'ID3') && b.length >= 10) at = 10 + ((b[6]! & 0x7f) << 21) + ((b[7]! & 0x7f) << 14) + ((b[8]! & 0x7f) << 7) + (b[9]! & 0x7f);
  for (const end = Math.min(b.length - 4, at + HEAD); at < end; at++) {
    if (b[at] !== 0xff || (b[at + 1]! & 0xe0) !== 0xe0) continue;
    const version = (b[at + 1]! >> 3) & 3; // 3: MPEG 1, 2: MPEG 2, 0: MPEG 2.5
    const layer = (b[at + 1]! >> 1) & 3; // 1: layer III
    const rateIndex = (b[at + 2]! >> 2) & 3;
    if (version === 1 || layer !== 1 || rateIndex === 3) continue;
    const rate = [44_100, 48_000, 32_000][rateIndex]! / (version === 3 ? 1 : version === 2 ? 2 : 4);
    const samplesAFrame = version === 3 ? 1152 : 576;
    const mono = b[at + 3]! >> 6 === 3;
    const side = at + 4 + (version === 3 ? (mono ? 17 : 32) : mono ? 9 : 17);
    if ((tag(side, 'Xing') || tag(side, 'Info')) && b.length >= side + 12 && (b[side + 7]! & 1) === 1) return sane((be32(side + 8) * samplesAFrame) / rate);
    return null;
  }
  return null;
}
