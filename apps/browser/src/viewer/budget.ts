/**
 * The HoloML viewer's resource limits (milestone 15, GitHub issue #23;
 * owner, prompt 77, Q1 a and Q2 a). Every model is fetched here, with the
 * files its glTF names, byte by byte against the page's limits, and its
 * pictures' sizes and triangles are read from the file's own description
 * before anything is decoded. A model that crosses a limit is left out;
 * the rest of the scene shows.
 */

export const LIMITS = {
  /** The page's own text. */
  pageBytes: 2 * 1024 * 1024,
  /** Elements shown; later ones are left out. */
  elements: 10_000,
  models: 64,
  /** One file: a model or a file it names. */
  fileBytes: 32 * 1024 * 1024,
  /** All of a page's model files together. */
  totalBytes: 128 * 1024 * 1024,
  /** A picture's width and height. */
  pictureSide: 4096,
  /** Triangles in all the page's models. */
  triangles: 2_000_000,
  /** One model, from asking to shown. */
  modelMs: 30_000,
} as const;

/** Why a model was left out, in words for the notice and the inspector. */
export class LeftOut extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'LeftOut';
  }
}

const MB = (n: number) => `${Math.round(n / (1024 * 1024))} MB`;

export interface LoadedFiles {
  /** The model file itself. */
  main: ArrayBuffer;
  /** Every other file it names, by its resolved address, as blob: addresses to hand to the loader. */
  blobs: Map<string, string>;
  bytes: number;
  triangles: number;
  pictures: { width: number; height: number }[];
}

/** The page's running totals, and a way to stop everything. */
export class Budget {
  bytes = 0;
  triangles = 0;
  private readonly controllers = new Set<AbortController>();
  private stopped = false;

  /** Stops every load in progress (Esc, the stop button, leaving the page). */
  stop(): void {
    this.stopped = true;
    for (const c of this.controllers) c.abort(new LeftOut('stopped before it finished loading'));
    this.controllers.clear();
  }

  get busy(): boolean {
    return this.controllers.size > 0;
  }

  /**
   * Fetches a model and the files it names, within the limits. Resolves
   * with the bytes to decode; rejects with LeftOut for a limit or a stop,
   * or with an Error when a file cannot be fetched.
   */
  async load(url: URL, origin: string): Promise<LoadedFiles> {
    if (this.stopped) throw new LeftOut('stopped before it finished loading');
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(new LeftOut(`still loading after ${LIMITS.modelMs / 1000} s`)), LIMITS.modelMs);
    const blobs = new Map<string, string>();
    // This model's bytes so far (the file and those it names).
    const tally = { bytes: 0 };
    let reserved = 0;
    try {
      const main = await this.fetchCounted(url, controller.signal, tally);
      const parsed = describe(main);
      // Triangles are known from the file's own description: refuse before decoding.
      if (this.triangles + parsed.triangles > LIMITS.triangles) {
        throw new LeftOut(`${parsed.triangles.toLocaleString('en')} triangles would pass the page's ${LIMITS.triangles.toLocaleString('en')}`);
      }
      // Held at once, so models loading side by side cannot pass the limit together.
      this.triangles += parsed.triangles;
      reserved = parsed.triangles;
      const pictures = [...parsed.embeddedPictures];
      for (const uri of parsed.externalUris) {
        const target = new URL(uri, url);
        if (target.origin !== origin) throw new LeftOut(`it names a file from another site (${target.origin})`);
        const data = await this.fetchCounted(target, controller.signal, tally);
        const size = pictureSize(new Uint8Array(data));
        if (size) pictures.push(size);
        blobs.set(target.href, URL.createObjectURL(new Blob([data])));
      }
      for (const p of pictures) {
        if (p.width > LIMITS.pictureSide || p.height > LIMITS.pictureSide) {
          throw new LeftOut(`a picture of ${p.width} by ${p.height} pixels is larger than ${LIMITS.pictureSide} by ${LIMITS.pictureSide}`);
        }
      }
      return { main, blobs, bytes: tally.bytes, triangles: parsed.triangles, pictures };
    } catch (e) {
      for (const b of blobs.values()) URL.revokeObjectURL(b);
      this.release(tally);
      this.triangles -= reserved;
      const reason = controller.signal.aborted ? controller.signal.reason : e;
      // A limit or a stop leaves the model out; anything else (a missing file, a broken answer) is a failure.
      throw reason instanceof LeftOut || reason instanceof Error ? reason : new Error(String(reason));
    } finally {
      clearTimeout(timer);
      this.controllers.delete(controller);
    }
  }

  /** A model left out keeps none of its bytes: they stop counting against the page at once. */
  private release(tally: { bytes: number }): void {
    this.bytes -= tally.bytes;
    tally.bytes = 0;
  }

  /** A file's bytes, counted as they arrive against the file and page limits. */
  private async fetchCounted(url: URL, signal: AbortSignal, tally: { bytes: number }): Promise<ArrayBuffer> {
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
      this.bytes += value.byteLength;
      tally.bytes += value.byteLength;
      // Released before anything else runs, so models loading side by side see the page's true total.
      if (got > LIMITS.fileBytes) {
        void reader.cancel();
        this.release(tally);
        throw new LeftOut(`a file larger than ${MB(LIMITS.fileBytes)}`);
      }
      if (this.bytes > LIMITS.totalBytes) {
        void reader.cancel();
        this.release(tally);
        throw new LeftOut(`the page's model files would pass ${MB(LIMITS.totalBytes)} in all`);
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

interface Description {
  triangles: number;
  externalUris: string[];
  embeddedPictures: { width: number; height: number }[];
}

interface GltfJson {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: { mesh?: number; children?: number[] }[];
  meshes?: { primitives?: { indices?: number; attributes?: Record<string, number>; mode?: number }[] }[];
  accessors?: { count?: number }[];
  buffers?: { uri?: string }[];
  images?: { uri?: string; bufferView?: number }[];
  bufferViews?: { buffer?: number; byteOffset?: number; byteLength?: number }[];
}

/**
 * What a glTF file says about itself: its triangles (each mesh counted as
 * often as the scene uses it), the files it names, and the sizes of the
 * pictures stored inside it.
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
  const externalUris = [...(json.buffers ?? []), ...(json.images ?? [])]
    .map((x) => x.uri)
    .filter((u): u is string => typeof u === 'string' && !u.startsWith('data:'));

  // Triangles: every node of the default scene that holds a mesh, as often as it appears.
  const meshTriangles = (json.meshes ?? []).map((m) =>
    (m.primitives ?? []).reduce((sum, p) => {
      if (p.mode !== undefined && p.mode !== 4 && p.mode !== 5 && p.mode !== 6) return sum;
      const count = p.indices !== undefined ? json.accessors?.[p.indices]?.count : json.accessors?.[p.attributes?.['POSITION'] ?? -1]?.count;
      return sum + Math.max(0, Math.floor((count ?? 0) / 3));
    }, 0),
  );
  let triangles = 0;
  const walk = (index: number, depth: number) => {
    const node = json.nodes?.[index];
    if (!node || depth > 64) return;
    if (node.mesh !== undefined) triangles += meshTriangles[node.mesh] ?? 0;
    for (const c of node.children ?? []) walk(c, depth + 1);
  };
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? json.nodes?.map((_, i) => i) ?? [];
  for (const r of roots) walk(r, 0);

  // Pictures stored in the file: in data: addresses, or in a buffer of a .glb.
  const embeddedPictures: { width: number; height: number }[] = [];
  for (const image of json.images ?? []) {
    let head: Uint8Array | null = null;
    if (image.uri?.startsWith('data:')) head = dataHead(image.uri);
    else if (image.bufferView !== undefined && bin) {
      const v = json.bufferViews?.[image.bufferView];
      if (v) head = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + Math.min(v.byteLength ?? 0, 65_536));
    }
    const size = head ? pictureSize(head) : null;
    if (size) embeddedPictures.push(size);
  }
  return { triangles, externalUris, embeddedPictures };
}

/** The first bytes of a base64 data: address. */
function dataHead(uri: string): Uint8Array | null {
  const comma = uri.indexOf(',');
  if (comma < 0 || !uri.slice(0, comma).endsWith(';base64')) return null;
  try {
    // About 64 KB of the start is enough for any header; base64 is read in fours.
    const part = uri.slice(comma + 1, comma + 1 + 87_384).replace(/[^A-Za-z0-9+/=]/g, '');
    const text = atob(part.slice(0, part.length - (part.length % 4)));
    return Uint8Array.from(text, (c) => c.charCodeAt(0));
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
