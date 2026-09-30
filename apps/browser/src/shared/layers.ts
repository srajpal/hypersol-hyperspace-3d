/**
 * Messages between the shell and a web page's trusted preload for the
 * layers view (TODO.md milestone 5). They travel over the webview's own
 * channel (webview.send and ipcRenderer.sendToHost), so the main process
 * is not involved and the page's own scripts cannot see them.
 */

/** Shell to page: the layers view's state. */
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

/** One image on the page, in CSS pixels relative to the page's view, without the layers view's lift. */
export interface PageImage {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The image's address (http or https only; '' otherwise). */
  src: string;
  alt: string;
  kind: 'img' | 'video' | 'canvas';
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
    if (kind !== 'img' && kind !== 'video' && kind !== 'canvas') return null;
    const src = typeof r['src'] === 'string' && r['src'].length <= 2048 && /^https?:\/\//i.test(r['src']) ? r['src'] : '';
    const alt = typeof r['alt'] === 'string' ? r['alt'].slice(0, 200) : '';
    out.push({ x: r['x'], y: r['y'], width: r['width'], height: r['height'], src, alt, kind });
  }
  return out;
}
