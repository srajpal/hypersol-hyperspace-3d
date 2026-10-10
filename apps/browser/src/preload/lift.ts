/**
 * Lifting into the room, the page side (milestone 28; owner, prompt 198).
 * Finds what on the page can be lifted: pictures (img, video, canvas) and
 * 3D models (a `<model-viewer>` element, a `<model>` element, or a link to
 * a .glb or .gltf file), where they are drawn now (the layers view's lift
 * included), and as far as they show.
 *
 * The shell asks over the webview's own channel (all in view, or what is
 * at one point); the right-click menu learns what was clicked before it
 * shows (main/lift.ts). Nothing is exposed to the page, and nothing here
 * changes it. A HoloML page (milestone 14) lifts nothing: its scene is
 * already 3D.
 */
import { ipcRenderer } from 'electron';
import { LIFT_ANSWER_CHANNEL, LIFT_QUERY_CHANNEL, LIFT_TARGET_CHANNEL, MAX_LIFT_ITEMS, isModelAddress, modelFileName, type LiftItem, type LiftKind } from '../shared/lift';
import { isHolomlDocument } from './holoml';

/** Most elements looked at in one search, as the layers view's (preload/layers.ts). */
const MAX_CANDIDATES = 2000;
const SELECTOR = 'img, video, canvas, model-viewer, model, a[href]';
/** The media types of a `<model>` element's sources that are glTF. */
const GLTF_TYPES = /^model\/gltf(?:-binary|\+json)$/i;

/** Each element's number, the same while the document lasts. */
const ids = new WeakMap<Element, number>();
let nextId = 1;
function idOf(el: Element): number {
  let id = ids.get(el);
  if (id === undefined) {
    id = nextId++;
    ids.set(el, id);
  }
  return id;
}

function absolute(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url, document.baseURI).href;
  } catch {
    return '';
  }
}

/** A model element's file: its src, or (a `<model>`) the first of its sources that is glTF. */
function modelSource(el: Element): string {
  const own = absolute(el.getAttribute('src'));
  if (isModelAddress(own)) return own;
  if (el.localName !== 'model') return '';
  for (const source of el.querySelectorAll(':scope > source')) {
    const src = absolute(source.getAttribute('src'));
    const type = source.getAttribute('type') ?? '';
    if (isModelAddress(src) && (type === '' || GLTF_TYPES.test(type))) return src;
  }
  return '';
}

function label(el: Element): string {
  return (el.getAttribute('aria-label') ?? el.getAttribute('title') ?? '').trim();
}

/** What an element is, if it can be lifted: its kind, a model's file, and its name. */
export function liftable(el: Element): { kind: LiftKind; src: string; name: string } | null {
  switch (el.localName) {
    case 'img': {
      const img = el as HTMLImageElement;
      const fileName = modelFileName(img.currentSrc || img.src);
      return { kind: 'img', src: '', name: img.alt.trim() || label(el) || fileName || 'Picture' };
    }
    case 'video':
      return { kind: 'video', src: '', name: label(el) || 'Video' };
    case 'canvas':
      return { kind: 'canvas', src: '', name: label(el) || 'Drawing' };
    case 'model-viewer':
    case 'model': {
      const src = modelSource(el);
      return src ? { kind: 'model', src, name: (el.getAttribute('alt') ?? '').trim() || label(el) || modelFileName(src) } : null;
    }
    case 'a': {
      const src = absolute(el.getAttribute('href'));
      return isModelAddress(src) ? { kind: 'model', src, name: (el.textContent ?? '').trim() || label(el) || modelFileName(src) } : null;
    }
    default:
      return null;
  }
}

function shown(el: Element): boolean {
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
}

/** The item for an element, where it is drawn now, as far as it shows in the view; null if it cannot be lifted or does not show. */
function itemOf(el: Element): LiftItem | null {
  const what = liftable(el);
  // A picture inside a model element is the model's stand-in, not a picture of the page.
  if (!what || (what.kind !== 'model' && el.parentElement?.closest('model-viewer, model'))) return null;
  const box = el.getBoundingClientRect();
  const x = Math.max(0, box.left);
  const y = Math.max(0, box.top);
  const right = Math.min(innerWidth, box.right);
  const bottom = Math.min(innerHeight, box.bottom);
  if (right - x < 1 || bottom - y < 1 || !shown(el)) return null;
  return { id: idOf(el), kind: what.kind, rect: { x, y, width: right - x, height: bottom - y }, src: what.src, name: what.name.replace(/\s+/g, ' ').slice(0, 200) };
}

/** Everything in view that can be lifted, in the page's order. */
export function liftableInView(): LiftItem[] {
  const items: LiftItem[] = [];
  let looked = 0;
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (items.length >= MAX_LIFT_ITEMS || ++looked > MAX_CANDIDATES) break;
    const item = itemOf(el);
    if (item) items.push(item);
  }
  return items;
}

/** What can be lifted at a point of the view: the topmost such element there, or one it is inside. */
export function liftableAt(x: number, y: number): LiftItem | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const own = el.closest('model-viewer, model, a[href]');
    for (const candidate of own ? [own, el] : [el]) {
      const item = itemOf(candidate);
      if (item) return item;
    }
  }
  return null;
}

if (window === window.top && !isHolomlDocument) {
  ipcRenderer.on(LIFT_QUERY_CHANNEL, (_event, raw: unknown) => {
    const q = raw as { seq?: unknown; at?: { x?: unknown; y?: unknown } } | null;
    if (typeof q?.seq !== 'number') return;
    const at = q.at;
    const items =
      at && typeof at.x === 'number' && typeof at.y === 'number'
        ? [liftableAt(at.x, at.y)].filter((i): i is LiftItem => i !== null)
        : liftableInView();
    ipcRenderer.sendToHost(LIFT_ANSWER_CHANNEL, { seq: q.seq, items });
  });
  // Before the right-click menu shows, the main process learns what was clicked (it offers "Lift into the room"
  // only then): sent and answered at once, so it is there before the menu is made. Only the person's own clicks.
  window.addEventListener(
    'contextmenu',
    (e) => {
      if (!e.isTrusted) return;
      try {
        ipcRenderer.sendSync(LIFT_TARGET_CHANNEL, liftableAt(e.clientX, e.clientY));
      } catch {
        // The menu then offers no lifting.
      }
    },
    true,
  );
}
