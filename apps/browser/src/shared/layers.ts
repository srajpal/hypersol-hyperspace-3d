/**
 * Messages between the shell and a web page's trusted preload for the
 * layers view (TODO.md milestone 5). They travel over the webview's own
 * channel (webview.send and ipcRenderer.sendToHost), so the main process
 * is not involved and the page's own scripts cannot see them.
 */

import { isModelAddress } from './lift';

/** Shell to page: the layers view's state. */
/**
 * Test runs only: the page preload tells the main process each time the
 * layers view has settled after a change to the page, with no scan of
 * the page and no choice of layers still to come (preload/layers.ts,
 * main/test-hooks.ts). A check that the view keeps a changing page
 * responsive waits for this instead of a fixed time (GitHub issue #11).
 */
export const LAYERS_SETTLED_CHANNEL = 'hypersol:layers-settled';

export const LAYERS_CHANNEL = 'hypersol:layers';
/** Page to shell: the rectangles of the page's images. */
export const PAGE_IMAGES_CHANNEL = 'hypersol:page-images';

export interface LayersState {
  on: boolean;
  /** Animate the change (a person switched it); page loads apply it at once. */
  animate: boolean;
  /** The room's parallax, each axis -1 to 1: the layers' vanishing point follows it. */
  parallax: { x: number; y: number };
  /** The theme's accent, for the layers' outline (#rrggbb); '' when none was given: the outline then takes the page's own text colour. */
  accent: string;
}

/**
 * One image on the page, in CSS pixels relative to the page's view,
 * without the layers view's lift; or (milestone 28) a 3D model: a
 * `<model-viewer>` or `<model>` element, or a link to a .glb or .gltf file.
 */
export interface PageImage {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The image's address (http or https only; '' otherwise); a model's file (always there). */
  src: string;
  /** A picture's text; a model's name. */
  alt: string;
  kind: 'img' | 'video' | 'canvas' | 'model';
}

export const MAX_PAGE_IMAGES = 100;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e6;

/** Checks a state message (the page side does not trust its input either). */
export function parseLayersState(raw: unknown): LayersState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const p = r['parallax'] as Record<string, unknown> | undefined;
  if (typeof r['on'] !== 'boolean' || typeof r['animate'] !== 'boolean' || !p || !isNum(p['x']) || !isNum(p['y'])) {
    return null;
  }
  // Every colour comes from the theme in use (ARCHITECTURE.md section 9): there is no colour of this file's own to fall back on.
  const accent = typeof r['accent'] === 'string' && /^#[0-9a-f]{6}$/i.test(r['accent']) ? r['accent'] : '';
  return { on: r['on'], animate: r['animate'], parallax: { x: p['x'], y: p['y'] }, accent };
}

/** Checks an image report from a page. Anything malformed is refused whole. */
export function parseImageReport(raw: unknown): PageImage[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PAGE_IMAGES) return null;
  const out: PageImage[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const r = item as Record<string, unknown>;
    if (!isNum(r['x']) || !isNum(r['y']) || !isNum(r['width']) || !isNum(r['height'])) return null;
    if (r['width'] < 0 || r['height'] < 0) return null;
    const kind = r['kind'];
    if (kind !== 'img' && kind !== 'video' && kind !== 'canvas' && kind !== 'model') return null;
    const src = typeof r['src'] === 'string' && r['src'].length <= 2048 && /^https?:\/\//i.test(r['src']) ? r['src'] : '';
    // A model is its file: one that names none, or another kind of file, is refused with the report.
    if (kind === 'model' && !isModelAddress(src)) return null;
    const alt = typeof r['alt'] === 'string' ? r['alt'].slice(0, 200) : '';
    out.push({ x: r['x'], y: r['y'], width: r['width'], height: r['height'], src, alt, kind });
  }
  return out;
}
