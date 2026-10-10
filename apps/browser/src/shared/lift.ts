/**
 * Lifting into the room (milestone 28; owner, prompt 198): what on a web
 * page can be lifted, as its trusted preload finds it, and the messages
 * that lift it. Pictures (img, video, canvas) are captured from the page
 * as it is drawn (Q1 a); 3D models (a `<model-viewer>` element, a `<model>`
 * element, or a link to a .glb or .gltf file) are fetched, when lifted,
 * from the page's own site only (Q3 a).
 *
 * Everything a page's preload says is checked here before the shell or
 * the main process uses it: the page's own scripts cannot reach the
 * preload, but the page's document is the page's to shape.
 */

/** Shell to page: what can be lifted now (with `at`, at that point of the page only). Carries a number the answer repeats. */
export const LIFT_QUERY_CHANNEL = 'hypersol:lift-query';
/** Page to shell: the answer, `{ seq, items }`. */
export const LIFT_ANSWER_CHANNEL = 'hypersol:lift-answer';
/** Page to main process (sent and answered at once, before the right-click menu shows): what can be lifted where the page was right-clicked. */
export const LIFT_TARGET_CHANNEL = 'hypersol:lift-target';
// The shell's two requests to the main process (a picture's capture, a model's files) are named in
// shared/commands.ts, beside the cards' capture: the shell's preload may not share a file with the page's.

/** Most objects lifted from one page (owner, prompt 198, Q2 a). */
export const MAX_LIFTED = 12;
/** A picture's shown part must be at least this many CSS pixels each way to lift. */
export const MIN_LIFT_SIDE = 48;
/** Most things one answer may name. */
export const MAX_LIFT_ITEMS = 100;

export type LiftKind = 'img' | 'video' | 'canvas' | 'model';

export interface LiftRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One thing on the page that can be lifted. */
export interface LiftItem {
  /** The preload's number for the element, the same while the document lasts. */
  id: number;
  kind: LiftKind;
  /** Where it is drawn now in the page's view, in CSS pixels (the layers view's lift included), as far as it shows. */
  rect: LiftRect;
  /** A model's file (http or https, ending in .glb or .gltf); '' for a picture. */
  src: string;
  /** Its name: a picture's text, or a model's own name or file name. */
  name: string;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e6;

/** Is this address a model file this milestone lifts: http or https, its path ending in .glb or .gltf? */
export function isModelAddress(url: string): boolean {
  if (url.length > 2048) return false;
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') && /\.(?:glb|gltf)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** A name for a model from its address: the file's name, without its folder. */
export function modelFileName(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    return name.slice(0, 200);
  } catch {
    return '';
  }
}

/** Checks one item; null if it is malformed. */
export function parseLiftItem(raw: unknown): LiftItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const rect = r['rect'] as Record<string, unknown> | undefined;
  if (!rect || typeof rect !== 'object') return null;
  if (!isNum(rect['x']) || !isNum(rect['y']) || !isNum(rect['width']) || !isNum(rect['height'])) return null;
  if (rect['width'] <= 0 || rect['height'] <= 0) return null;
  if (typeof r['id'] !== 'number' || !Number.isInteger(r['id']) || r['id'] < 0) return null;
  const kind = r['kind'];
  if (kind !== 'img' && kind !== 'video' && kind !== 'canvas' && kind !== 'model') return null;
  let src = '';
  if (kind === 'model') {
    if (typeof r['src'] !== 'string' || !isModelAddress(r['src'])) return null;
    src = r['src'];
  }
  const name = typeof r['name'] === 'string' ? r['name'].replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  return { id: r['id'], kind, rect: { x: rect['x'], y: rect['y'], width: rect['width'], height: rect['height'] }, src, name };
}

/** Checks a list of items. Anything malformed refuses the whole list, as the picture report does. */
export function parseLiftItems(raw: unknown): LiftItem[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_LIFT_ITEMS) return null;
  const out: LiftItem[] = [];
  for (const item of raw) {
    const parsed = parseLiftItem(item);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

/** A page's answer to a query: its number and its items, or null. */
export function parseLiftAnswer(raw: unknown): { seq: number; items: LiftItem[] } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r['seq'] !== 'number' || !Number.isInteger(r['seq'])) return null;
  const items = parseLiftItems(r['items']);
  return items ? { seq: r['seq'], items } : null;
}

/** The part of a rectangle inside the page's view of this size, or null when too little of it shows to lift (a model's link may be small). */
export function shownPart(rect: LiftRect, view: { width: number; height: number }, minSide: number): LiftRect | null {
  const x = Math.max(0, rect.x);
  const y = Math.max(0, rect.y);
  const right = Math.min(view.width, rect.x + rect.width);
  const bottom = Math.min(view.height, rect.y + rect.height);
  if (right - x < minSide || bottom - y < minSide) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * What to lift of what is in view: pictures whose shown part is at least
 * MIN_LIFT_SIDE each way and models, not those already lifted, and no
 * more than the room for them (MAX_LIFTED in all): the models first, then
 * the pictures, each in the page's order (the order the preload found
 * them in, its document's). They come back in that order, so the arc
 * reads as the page does.
 */
export function chooseToLift(items: LiftItem[], lifted: ReadonlySet<number>, room: number): LiftItem[] {
  const seen = new Set<number>();
  const fresh = items.filter((i) => {
    if (lifted.has(i.id) || seen.has(i.id)) return false;
    seen.add(i.id);
    return i.kind === 'model' || (i.rect.width >= MIN_LIFT_SIDE && i.rect.height >= MIN_LIFT_SIDE);
  });
  const order = new Map(fresh.map((item, i) => [item, i]));
  const chosen = [...fresh.filter((i) => i.kind === 'model'), ...fresh.filter((i) => i.kind !== 'model')].slice(0, Math.max(0, room));
  return chosen.sort((a, b) => order.get(a)! - order.get(b)!);
}
