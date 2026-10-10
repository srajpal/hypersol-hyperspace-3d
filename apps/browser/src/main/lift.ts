/**
 * Lifting into the room, the main process's part (milestone 28; owner,
 * prompt 198). Three things, each only for the shell and only for a page
 * that shell hosts:
 *
 * - What a page's preload found where the page was right-clicked, so the
 *   menu can offer "Lift into the room" (main/guests.ts).
 * - A picture: one rectangle of the page captured as it is drawn (Q1 a).
 *   No request is made: it is what the page shows.
 * - A model (Q3 a): its file, and the files it names, fetched through the
 *   page's own session after the privacy shield (as the page's icon is),
 *   from the page's own site only (its origin), within the HoloML
 *   viewer's limits, read from the file's own description before anything
 *   else is fetched (viewer/budget.ts). The shell has them decoded in a
 *   sandboxed frame with no network (viewer/lift-host.ts). Made only when
 *   the person lifts the model.
 *
 * The pure parts are here, without Electron, for the unit tests; the
 * wiring is in main/index.ts.
 */
import { GLTF_EXTENSIONS, LIMITS, describe, headerSize } from '../viewer/budget';
import { discardBody, readLimited } from './favicon';

export const LIFT_LIMITS = {
  /** One file: the model, or a file it names (the viewer's). */
  fileBytes: LIMITS.fileBytes,
  /** A model with every file it names (the viewer's limit for a whole page). */
  modelBytes: LIMITS.totalBytes,
  /** The files a model names (the viewer's limit on a page's model files). */
  files: LIMITS.modelFiles,
  /** Triangles (the viewer's limit for a whole page). */
  triangles: LIMITS.triangles,
  /** A picture's width and height. */
  pictureSide: LIMITS.pictureSide,
  /** From asking to every file arrived. */
  ms: LIMITS.fileMs,
  /** A captured picture's longest side, in device pixels: larger ones are made smaller. */
  captureSide: 2048,
} as const;

/** A rectangle of the page to capture, in the page's CSS pixels, checked; null if it is not one. */
export function captureArea(raw: unknown): { x: number; y: number; width: number; height: number } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN);
  const [x, y, width, height] = [n(r['x']), n(r['y']), n(r['width']), n(r['height'])];
  if ([x, y, width, height].some(Number.isNaN) || width < 1 || height < 1 || x < -1 || y < -1) return null;
  if (x + width > 20_000 || y + height > 20_000) return null;
  return { x, y, width, height };
}

/**
 * The capture's rectangle in the page's own pixels (Electron's capturePage
 * takes them unzoomed): the CSS pixels times the page's zoom, whole, and
 * inside the page.
 */
export function zoomedArea(area: { x: number; y: number; width: number; height: number }, zoom: number): { x: number; y: number; width: number; height: number } {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const x = Math.max(0, Math.floor(area.x * z));
  const y = Math.max(0, Math.floor(area.y * z));
  return { x, y, width: Math.max(1, Math.ceil((area.x + area.width) * z) - x), height: Math.max(1, Math.ceil((area.y + area.height) * z) - y) };
}

/** Is `url` on the page's own site, its origin (the HoloML viewer's rule, `connect-src 'self'`)? Web addresses only. */
export function sameSite(pageUrl: string, url: string): boolean {
  try {
    const page = new URL(pageUrl);
    const file = new URL(url);
    if (page.protocol !== 'http:' && page.protocol !== 'https:') return false;
    return file.origin === page.origin;
  } catch {
    return false;
  }
}

/** What the model request asks for, checked; null if it is not one. */
export function modelRequest(raw: unknown): { webContentsId: number; url: string } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r['webContentsId'] !== 'number' || typeof r['url'] !== 'string' || r['url'].length > 2048) return null;
  try {
    const u = new URL(r['url']);
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !/\.(?:glb|gltf)$/i.test(u.pathname)) return null;
  } catch {
    return null;
  }
  return { webContentsId: r['webContentsId'], url: r['url'] };
}

export type ModelFetch = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

export type ModelResult =
  | { ok: true; url: string; main: Uint8Array; resources: { uri: string; bytes: Uint8Array }[]; skipped: string[] }
  | { ok: false; reason: string };

const MB = (n: number) => `${Math.round(n / (1024 * 1024))} MB`;

/** Why a fetch failed, in words for the notice, of the model (`what` is "it") or of a file it names. */
function failure(e: unknown, timedOut: boolean, what: string, limits: typeof LIFT_LIMITS): string {
  if (timedOut) return `it took longer than ${limits.ms / 1000} seconds to arrive`;
  if (e instanceof Error && e.message === 'too large') return `${what} is larger than ${MB(limits.fileBytes)}`;
  if (e instanceof Error && /shield/i.test(e.message)) return `the privacy shield blocks ${what === 'it' ? 'its address' : `the address of ${what}`}`;
  return `${what} could not be fetched`;
}

/**
 * Fetches a model for lifting: its file from the page's own site, checked
 * against the viewer's limits by what it says of itself, then the files
 * it names, each within the limits: those on the same site must all come,
 * and those elsewhere are left out (named in `skipped`; the model shows
 * without them). Never throws.
 */
export async function fetchModel(pageUrl: string, url: string, fetchFn: ModelFetch, limits: typeof LIFT_LIMITS = LIFT_LIMITS): Promise<ModelResult> {
  if (!sameSite(pageUrl, url)) return { ok: false, reason: "it is not on this page's own site" };
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, limits.ms);
  /** One file: the model's own ("it"), or one it names. */
  const get = async (address: string, what: string): Promise<{ url: string; bytes: Uint8Array } | { error: string }> => {
    let response: Response;
    try {
      response = await fetchFn(address, { signal: controller.signal });
    } catch (e) {
      return { error: failure(e, timedOut, what, limits) };
    }
    // A redirect may not take the model to another site.
    const arrived = response.url || address;
    if (!sameSite(pageUrl, arrived)) {
      await discardBody(response);
      return { error: `${what} is not on this page's own site` };
    }
    if (!response.ok) {
      await discardBody(response);
      return { error: `the site answered ${response.status} for ${what}` };
    }
    try {
      return { url: arrived, bytes: new Uint8Array(await readLimited(response, limits.fileBytes)) };
    } catch (e) {
      return { error: failure(e, timedOut, what, limits) };
    }
  };
  try {
    const main = await get(url, 'it');
    if ('error' in main) return { ok: false, reason: main.error };
    let about: ReturnType<typeof describe>;
    try {
      about = describe(main.bytes.buffer.slice(main.bytes.byteOffset, main.bytes.byteOffset + main.bytes.byteLength) as ArrayBuffer);
    } catch {
      return { ok: false, reason: 'it is not a glTF model' };
    }
    const missing = about.needs.filter((name) => !GLTF_EXTENSIONS.has(name));
    if (missing.length > 0) return { ok: false, reason: `it needs ${missing.join(', ')}, which the browser does not read` };
    if (about.triangles > limits.triangles) return { ok: false, reason: `it has more than ${limits.triangles.toLocaleString('en')} triangles` };
    if (about.embeddedPictures.some((p) => p.width > limits.pictureSide || p.height > limits.pictureSide)) {
      return { ok: false, reason: `a picture in it is larger than ${limits.pictureSide} pixels` };
    }
    const uris = [...new Set(about.externalUris)];
    if (uris.length > limits.files) return { ok: false, reason: `it names more than ${limits.files} files` };
    let total = main.bytes.byteLength;
    const resources: { uri: string; bytes: Uint8Array }[] = [];
    const skipped: string[] = [];
    for (const uri of uris) {
      let address: string;
      try {
        address = new URL(uri, main.url).href;
      } catch {
        skipped.push(uri);
        continue;
      }
      // Only from the page's own site: a file elsewhere is left out (the model shows without it).
      if (!sameSite(pageUrl, address)) {
        skipped.push(uri);
        continue;
      }
      // A file on its own site that does not come is a model that cannot be shown whole: it is not lifted.
      const file = await get(address, `a file it names (${uri.slice(0, 80)})`);
      if ('error' in file) return { ok: false, reason: file.error };
      if (about.pictureUris.has(uri)) {
        const size = headerSize(file.bytes.subarray(0, 65_536));
        if (size && (size.width > limits.pictureSide || size.height > limits.pictureSide)) {
          return { ok: false, reason: `a picture of it is larger than ${limits.pictureSide} pixels` };
        }
      }
      total += file.bytes.byteLength;
      if (total > limits.modelBytes) return { ok: false, reason: `it and its files are larger than ${MB(limits.modelBytes)}` };
      resources.push({ uri, bytes: file.bytes });
    }
    return { ok: true, url: main.url, main: main.bytes, resources, skipped };
  } finally {
    clearTimeout(timer);
  }
}
