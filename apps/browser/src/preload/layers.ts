/**
 * The layers view inside a web page (TODO.md milestone 5), run from the
 * trusted page preload. It lifts the page's top-level sections and its
 * images into separate depths, and reports where the page's images are.
 *
 * Nothing is exposed to the page. The page can see the data-hs-layer
 * attribute and a CSS variable on lifted elements, and nothing else. The
 * styles go in through webFrame.insertCSS, so a page's content security
 * policy cannot block them.
 *
 * Work is bounded (GitHub issue #11): which elements are pinned (fixed or
 * sticky) is found once, in time slices that never hold the page for
 * long, and then kept current from the page's own changes; choosing
 * layers only looks at a bounded number of candidates, and only when a
 * change can affect the choice.
 */
import { ipcRenderer, webFrame } from 'electron';
import { LAYERS_CHANNEL, MAX_PAGE_IMAGES, PAGE_IMAGES_CHANNEL, parseLayersState, type PageImage } from '../shared/layers';
import { isHolomlDocument } from './holoml';
import { LAYERS, findSectionContainer, largest, liftTransform, liftable, sameExceptLift, vanishingPoint, type Box } from './layers-plan';

const ATTR = 'data-hs-layer';
const ANIMATING = 'data-hs-animating';
const ANIMATION_MS = 250;
/** Page changes settle this long before the layers are chosen again. */
const REPICK_MS = 400;
const REPORT_MS = 150;
/** Longest stretch of scanning before handing the page back, in milliseconds. */
const SLICE_MS = 6;
/** Above this many elements queued at once, one full scan is cheaper than many small ones. */
const RESCAN_ALL_OVER = 5000;
/** Most children of the section container looked at: a longer list is a list, not sections. */
const MAX_SECTION_CANDIDATES = 400;
/** Most images, videos, and canvases looked at, for lifting and for the report. */
const MAX_MEDIA_CANDIDATES = 2000;

const CSS = `
[${ATTR}] { transform: var(--hs-lift) !important; transform-origin: 0 0 !important; will-change: transform; }
[${ATTR}='section'] { box-shadow: 0 18px 40px rgb(0 0 0 / 30%), 0 0 0 1px var(--hs-layer-accent, #39e6ff) !important; }
[${ATTR}='image'] { box-shadow: 0 14px 30px rgb(0 0 0 / 38%) !important; }
html[${ANIMATING}] [${ATTR}] { transition: transform ${ANIMATION_MS}ms ease !important; }
@media print {
  /* Printing prints the page flat, as if the layers view were off (milestone 9, owner feedback on milestone 8). */
  [${ATTR}], [${ATTR}='section'], [${ATTR}='image'] {
    transform: none !important; box-shadow: none !important; will-change: auto !important; transition: none !important;
  }
}
@media (prefers-reduced-motion: reduce) { html[${ANIMATING}] [${ATTR}] { transition: none !important; } }
`;

interface Layer {
  kind: 'section' | 'image';
  depth: number;
  scale: number;
  /** Untransformed box in document coordinates. */
  box: Box;
}

const layers = new Map<HTMLElement, Layer>();
let on = false;
let parallax = { x: 0, y: 0 };
let cssAdded = false;
let repickTimer: number | undefined;
let reportTimer: number | undefined;
let frame = 0;
let offTimer: number | undefined;
let lastReport = '';
/** Animation in progress: the page's own styles are not checked while our transition runs. */
let animating = false;
/** The section container chosen last time, to tell which page changes matter. */
let container: HTMLElement | null = null;

// ---- Pinned elements, kept current without rescanning the page ------------

/** Elements whose own position is fixed or sticky. */
const pinned = new Set<Element>();
/** Elements waiting to be checked. */
let queue: Element[] = [];
let scanAll = true;
let scanning = false;
let scanned = false;
/** The pinned set changed in an incremental scan: the layers are chosen again once it ends (PR #16 review). */
let pinnedChanged = false;
const afterScan: (() => void)[] = [];

function isPinned(el: Element): boolean {
  const position = getComputedStyle(el).position;
  return position === 'fixed' || position === 'sticky';
}

/** Checks queued elements in slices, handing the page back between them. */
function runScan(): void {
  if (scanning) return;
  scanning = true;
  const step = () => {
    if (scanAll) {
      scanAll = false;
      // A full scan follows many changes: choose again afterwards too.
      pinnedChanged = true;
      pinned.clear();
      queue = document.body ? [...document.body.getElementsByTagName('*')] : [];
    }
    const until = performance.now() + SLICE_MS;
    while (queue.length > 0 && performance.now() < until) {
      // A slice checks elements in batches between clock reads.
      for (let i = 0; i < 64 && queue.length > 0; i++) {
        const el = queue.pop()!;
        if (!el.isConnected) {
          if (pinned.delete(el)) pinnedChanged = true;
          continue;
        }
        const now = isPinned(el);
        if (now !== pinned.has(el)) pinnedChanged = true;
        if (now) pinned.add(el);
        else pinned.delete(el);
      }
    }
    if (queue.length > 0 || scanAll) {
      window.setTimeout(step, 0);
      return;
    }
    scanning = false;
    const wasScanned = scanned;
    scanned = true;
    // Something became pinned or stopped being pinned (a fixed element added
    // inside a lifted section, or restyled by a parent's class): choose again.
    if (pinnedChanged && wasScanned && on) scheduleRepick();
    pinnedChanged = false;
    for (const done of afterScan.splice(0)) done();
  };
  step();
}

/** Queues an element and its descendants; too many at once means one full scan. */
function queueSubtree(el: Element): void {
  if (scanAll) return;
  queue.push(el);
  const inside = el.getElementsByTagName('*');
  if (queue.length + inside.length > RESCAN_ALL_OVER) {
    scanAll = true;
    queue = [];
    return;
  }
  for (const child of inside) queue.push(child);
}

/** Runs `next` once every queued element has been checked. */
function whenScanned(next: () => void): void {
  if (!scanning && queue.length === 0 && !scanAll && scanned) {
    next();
    return;
  }
  afterScan.push(next);
  runScan();
}

/** True if the element is pinned or contains a pinned element (lifting it would unpin that part). */
function holdsPinned(el: Element): boolean {
  for (const p of pinned) {
    if (!p.isConnected) {
      pinned.delete(p);
      continue;
    }
    if (el === p || el.contains(p)) return true;
  }
  return false;
}

// ---- Choosing layers --------------------------------------------------------

/** The element's box without transforms, in document coordinates (offsets ignore transforms). */
function documentBox(el: HTMLElement): Box {
  let x = 0;
  let y = 0;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  // Scrolled containers between the element and the page move it too.
  const root = document.scrollingElement;
  for (let node = el.parentElement; node && node !== document.body && node !== root; node = node.parentElement) {
    x -= node.scrollLeft;
    y -= node.scrollTop;
  }
  return { x, y, width: el.offsetWidth, height: el.offsetHeight };
}

/**
 * The page's own transform and animation for elements, without the lift
 * we add (GitHub issue #9): our rule applies only while the element has
 * the data-hs-layer attribute, so it is taken off the lifted ones for one
 * style read, in one batch, and put back in the same task (nothing is
 * drawn in between).
 */
function ownMotion(elements: HTMLElement[]): Map<HTMLElement, boolean> {
  const moving = new Map<HTMLElement, boolean>();
  const marked = elements.filter((el) => el.hasAttribute(ATTR)).map((el) => [el, el.getAttribute(ATTR)!] as const);
  for (const [el] of marked) el.removeAttribute(ATTR);
  for (const el of elements) {
    const style = getComputedStyle(el);
    moving.set(el, style.transform !== 'none' || style.animationName !== 'none');
  }
  for (const [el, kind] of marked) el.setAttribute(ATTR, kind);
  return moving;
}

function visibleChildren(el: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const c of el.children) {
    if (out.length >= MAX_SECTION_CANDIDATES + 1) break;
    if (c instanceof HTMLElement && !['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE'].includes(c.tagName) && c.offsetHeight > 0) {
      out.push(c);
    }
  }
  return out;
}

function shown(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.display !== 'contents' && el.offsetWidth > 0 && el.offsetHeight > 0;
}

/** Chooses the sections and images to lift, from a bounded set of candidates. */
function pick(): Map<HTMLElement, Layer> {
  const chosen = new Map<HTMLElement, Layer>();
  const body = document.body;
  if (!body) return chosen;
  const at = (path: number[]): HTMLElement => path.reduce<HTMLElement>((el, i) => visibleChildren(el)[i]!, body);
  const path = findSectionContainer(
    (p) => visibleChildren(at(p)).map((c) => ({ x: 0, y: 0, width: c.offsetWidth, height: c.offsetHeight })),
    body.scrollWidth * Math.max(body.scrollHeight, 1),
  );
  container = at(path);
  const children = visibleChildren(container);
  // Too large to draw as one lifted layer: it stays flat (milestone 22).
  const fits = (el: HTMLElement) => liftable(el.offsetWidth, el.offsetHeight, devicePixelRatio);
  // A very long run of children is a list (a feed, a table), not a few sections.
  const sectionCandidates =
    children.length > MAX_SECTION_CANDIDATES
      ? []
      : children.filter((c) => c.offsetHeight >= LAYERS.minSectionHeight && fits(c) && !holdsPinned(c) && shown(c));
  const media: HTMLElement[] = [];
  for (const el of body.querySelectorAll<HTMLElement>('img, video, canvas')) {
    if (media.length >= MAX_MEDIA_CANDIDATES) break;
    if (el.offsetWidth >= LAYERS.minImageSide && el.offsetHeight >= LAYERS.minImageSide && fits(el)) media.push(el);
  }
  const imageCandidates = media.filter((el) => !holdsPinned(el) && shown(el));
  // The page's own transforms and animations are left alone, even ones it adds after an element was lifted.
  const moving = ownMotion([...sectionCandidates, ...imageCandidates]);
  const sections = largest(
    sectionCandidates.filter((c) => !moving.get(c)),
    (c) => c.offsetWidth * c.offsetHeight,
    LAYERS.maxSections,
  );
  for (const el of sections) {
    chosen.set(el, { kind: 'section', depth: LAYERS.sectionDepth, scale: LAYERS.sectionScale, box: documentBox(el) });
  }
  const images = largest(
    imageCandidates.filter((el) => !moving.get(el)),
    (el) => el.offsetWidth * el.offsetHeight,
    LAYERS.maxImages,
  );
  for (const el of images) {
    // An image inside a lifted section rises further above it; one outside rises from the page.
    const inSection = sections.some((s) => s.contains(el));
    chosen.set(el, {
      kind: 'image',
      depth: inSection ? LAYERS.imageDepth : LAYERS.sectionDepth + LAYERS.imageDepth,
      scale: 1,
      box: documentBox(el),
    });
  }
  return chosen;
}

function apply(lifted: boolean): void {
  const view = vanishingPoint({ width: innerWidth, height: innerHeight }, parallax);
  const vp = { x: view.x + scrollX, y: view.y + scrollY };
  for (const [el, layer] of layers) {
    el.style.setProperty('--hs-lift', liftTransform(layer.box, vp, lifted ? layer.depth : 0, lifted ? layer.scale : 1));
  }
}

function release(el: HTMLElement): void {
  el.removeAttribute(ATTR);
  el.style.removeProperty('--hs-lift');
}

function clear(): void {
  for (const el of layers.keys()) release(el);
  layers.clear();
}

/** Chooses the layers again (the page changed) and lifts them, without animating. */
function repick(): void {
  window.clearTimeout(repickTimer);
  if (!on) return;
  if (animating) {
    scheduleRepick();
    return;
  }
  whenScanned(() => {
    if (!on) return;
    const next = pick();
    for (const el of layers.keys()) if (!next.has(el)) release(el);
    layers.clear();
    for (const [el, layer] of next) {
      layers.set(el, layer);
      el.setAttribute(ATTR, layer.kind);
    }
    apply(true);
  });
}

function setOn(next: boolean, animate: boolean): void {
  window.clearTimeout(offTimer);
  const root = document.documentElement;
  if (animate) root.setAttribute(ANIMATING, '');
  else root.removeAttribute(ANIMATING);
  animating = animate;
  if (next) {
    if (!cssAdded) {
      void webFrame.insertCSS(CSS, { cssOrigin: 'author' });
      cssAdded = true;
    }
    on = true;
    if (layers.size === 0) {
      whenScanned(() => {
        if (!on || layers.size > 0) return;
        for (const [el, layer] of pick()) {
          layers.set(el, layer);
          el.setAttribute(ATTR, layer.kind);
        }
        if (animate) {
          apply(false);
          void root.offsetWidth; // start from flat, so the lift animates
        }
        apply(true);
      });
    } else {
      apply(true);
    }
  } else {
    on = false;
    if (animate && layers.size > 0) {
      apply(false);
      offTimer = window.setTimeout(clear, ANIMATION_MS + 50);
    } else {
      clear();
    }
  }
  if (animate) {
    window.setTimeout(() => {
      root.removeAttribute(ANIMATING);
      animating = false;
    }, ANIMATION_MS + 50);
  }
}

// ---- Image report -------------------------------------------------------------

/** Reports the images in view (without the lift) to the shell, when they change. */
function report(): void {
  window.clearTimeout(reportTimer);
  const images: PageImage[] = [];
  let looked = 0;
  for (const el of document.querySelectorAll<HTMLElement>('img, video, canvas')) {
    if (images.length >= MAX_PAGE_IMAGES || ++looked > MAX_MEDIA_CANDIDATES) break;
    if (el.offsetWidth < 16 || el.offsetHeight < 16) continue;
    const box = documentBox(el);
    const x = box.x - scrollX;
    const y = box.y - scrollY;
    if (x + box.width <= 0 || y + box.height <= 0 || x >= innerWidth || y >= innerHeight) continue;
    const kind = el.tagName === 'IMG' ? 'img' : el.tagName === 'VIDEO' ? 'video' : 'canvas';
    const src = el instanceof HTMLImageElement ? el.currentSrc || el.src : el instanceof HTMLVideoElement ? el.currentSrc : '';
    images.push({
      x,
      y,
      width: box.width,
      height: box.height,
      src: /^https?:\/\//i.test(src) ? src.slice(0, 2048) : '',
      alt: el instanceof HTMLImageElement ? el.alt.slice(0, 200) : '',
      kind,
    });
  }
  const text = JSON.stringify(images);
  if (text === lastReport) return;
  lastReport = text;
  ipcRenderer.sendToHost(PAGE_IMAGES_CHANNEL, images);
}

function scheduleRepick(): void {
  window.clearTimeout(repickTimer);
  repickTimer = window.setTimeout(repick, REPICK_MS);
}

function scheduleReport(): void {
  window.clearTimeout(reportTimer);
  reportTimer = window.setTimeout(report, REPORT_MS);
}

// ---- Page changes -------------------------------------------------------------

const MEDIA = new Set(['IMG', 'VIDEO', 'CANVAS', 'PICTURE']);

function holdsMedia(node: Node): boolean {
  return node instanceof Element && (MEDIA.has(node.tagName) || node.querySelector('img, video, canvas') !== null);
}

/** True if a layer is, or is inside, the node. */
function holdsLayer(node: Node): boolean {
  for (const el of layers.keys()) if (node === el || node.contains(el)) return true;
  return false;
}

/**
 * The page changed. Only changes that can affect the choice of layers
 * lead to choosing again: the section container's own children, images
 * added or removed, lifted elements or their ancestors restyled, and
 * elements becoming pinned. Our own style changes are ignored.
 */
function onMutations(records: MutationRecord[]): void {
  let choose = false;
  let reportAgain = false;
  for (const r of records) {
    if (r.type === 'childList') {
      reportAgain = true;
      for (const node of r.addedNodes) if (node instanceof Element) queueSubtree(node);
      if (container && (r.target === container || r.target.contains(container))) choose = true;
      for (const node of [...r.addedNodes, ...r.removedNodes]) if (holdsMedia(node) || holdsLayer(node)) choose = true;
    } else if (r.type === 'attributes' && r.target instanceof Element) {
      const el = r.target;
      // Only our --hs-lift changed: not the page's doing.
      if (r.attributeName === 'style' && sameExceptLift(r.oldValue ?? '', el.getAttribute('style') ?? '')) continue;
      // A restyle can pin the element or, through a selector like
      // ".open .menu", anything inside it. Where layers are involved (the
      // element is, holds, or sits in a layer) its whole subtree is checked
      // again, in slices; elsewhere only the element itself, so pages that
      // animate by restyling do not cause rescans.
      const nearLayer = holdsLayer(el) || [...layers.keys()].some((l) => l.contains(el));
      if (nearLayer) queueSubtree(el);
      else if (!scanAll) queue.push(el);
      if (nearLayer) choose = true;
    }
  }
  if (queue.length > 0 || scanAll) runScan();
  if (choose && on) scheduleRepick();
  if (reportAgain) scheduleReport();
}

/** Scrolling of the page, or of a box inside it (GitHub issue #14). */
function onScroll(event: Event): void {
  scheduleReport();
  if (!on) return;
  const target = event.target;
  const inner = target instanceof Element && target !== document.documentElement && target !== document.body ? target : null;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    // A scrolled box moves the layers inside it: measure those again.
    if (inner) for (const [el, layer] of layers) if (inner.contains(el)) layer.box = documentBox(el);
    apply(true);
  });
}

function onResize(): void {
  scheduleReport();
  if (!on) return;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    for (const [el, layer] of layers) layer.box = documentBox(el);
    apply(true);
  });
  scheduleRepick();
}

// A HoloML page (milestone 14) is a 3D scene, not a page to lift apart.
if (window === window.top && !isHolomlDocument) {
  ipcRenderer.on(LAYERS_CHANNEL, (_event, raw: unknown) => {
    const state = parseLayersState(raw);
    if (!state) return;
    const moved = state.parallax.x !== parallax.x || state.parallax.y !== parallax.y;
    parallax = state.parallax;
    // The theme's accent outlines the lifted sections.
    document.documentElement?.style.setProperty('--hs-layer-accent', `${state.accent}99`);
    const run = () => {
      if (state.on !== on) setOn(state.on, state.animate);
      else if (on && moved) apply(true);
    };
    if (document.body) run();
    else window.addEventListener('DOMContentLoaded', run, { once: true });
  });

  window.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(onMutations).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
      attributeOldValue: true,
    });
    runScan();
    scheduleReport();
  });
  window.addEventListener('load', () => {
    scheduleRepick();
    scheduleReport();
  });
  // Images that finish loading change the layout.
  document.addEventListener(
    'load',
    (e) => {
      if (e.target instanceof HTMLElement && MEDIA.has(e.target.tagName)) {
        scheduleRepick();
        scheduleReport();
      }
    },
    true,
  );
  // Capture: scrolling inside boxes does not bubble up to the window.
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener('resize', onResize, { passive: true });
}
