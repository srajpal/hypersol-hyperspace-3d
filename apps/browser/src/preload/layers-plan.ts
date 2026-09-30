/**
 * The layers view's arithmetic, without the DOM, so it can be unit
 * tested (TODO.md milestone 5). preload/layers.ts measures the page and
 * applies the results.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** How far the layers view pulls things apart. */
export const LAYERS = {
  /** CSS perspective distance, in CSS pixels. */
  perspective: 1400,
  /** Depth of a lifted section, in CSS pixels. */
  sectionDepth: 70,
  /** Extra depth of a lifted image, above its section. */
  imageDepth: 60,
  /** Sections shrink a little about their own centre, so gaps open between them. */
  sectionScale: 0.94,
  /** How far the vanishing point moves with the room's parallax, as a share of the view. */
  parallaxShift: 0.35,
  maxSections: 24,
  maxImages: 24,
  /** Smallest section and image worth lifting, in CSS pixels. */
  minSectionHeight: 40,
  minImageSide: 48,
  /**
   * Largest width or height of a lifted section or image, in device
   * pixels (CSS pixels times the device pixel ratio). A lifted element is
   * drawn as one 3D-transformed layer, and Chromium draws nothing of a
   * layer larger than the graphics card can hold: a long page's main
   * section went blank (milestone 22; HoloML's specification is 52,000
   * pixels tall). A larger element stays flat, and the rest still lift.
   * Well under where drawing failed on the development machine (about
   * 14,000 device pixels, with a graphics card), for other graphics cards
   * and for drawing in software.
   */
  maxLiftDevicePixels: 8192,
  /** A child covering this share of its parent is a wrapper: look inside it. */
  wrapperShare: 0.8,
  maxWrapperDepth: 6,
} as const;

/**
 * Picks where a page's top-level sections are. Starting at the body, a
 * container whose only sizeable child covers most of it is just a
 * wrapper, so the search goes one level down. Returns the index path of
 * the container whose children are the sections. `children(path)` gives
 * the boxes of the visible element children of the element at that path.
 */
export function findSectionContainer(children: (path: number[]) => Box[], rootArea: number): number[] {
  const path: number[] = [];
  let area = rootArea;
  for (let depth = 0; depth < LAYERS.maxWrapperDepth; depth++) {
    const sizeable = children(path)
      .map((b, i) => ({ i, a: b.width * b.height }))
      .filter((k) => k.a >= area * 0.05);
    const only = sizeable.length === 1 ? sizeable[0]! : null;
    if (!only || only.a < area * LAYERS.wrapperShare) return path;
    path.push(only.i);
    area = only.a;
  }
  return path;
}

/** Whether an element of this size, in CSS pixels, can be lifted at this device pixel ratio (see maxLiftDevicePixels). */
export function liftable(width: number, height: number, devicePixelRatio: number): boolean {
  const scale = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return width * scale <= LAYERS.maxLiftDevicePixels && height * scale <= LAYERS.maxLiftDevicePixels;
}

/**
 * The CSS transform that lifts an element `depth` pixels toward the
 * viewer, as seen from a vanishing point shared by every layer, and
 * optionally shrinks it about its own centre. Each lifted element gets
 * its own perspective, so no ancestor needs a transform (an ancestor's
 * transform would unpin the page's fixed parts). Used with
 * transform-origin 0 0; `box` is the element's untransformed box and
 * `vp` the vanishing point, both in the same coordinates. At depth 0 and
 * scale 1 it is the identity, with the same functions, so the change
 * animates.
 */
export function liftTransform(box: Box, vp: Point, depth: number, scale = 1): string {
  const ox = round(vp.x - box.x);
  const oy = round(vp.y - box.y);
  const cx = round(box.width / 2);
  const cy = round(box.height / 2);
  return (
    `translate(${ox}px, ${oy}px) perspective(${LAYERS.perspective}px) translateZ(${round(depth)}px) ` +
    `translate(${-ox}px, ${-oy}px) translate(${cx}px, ${cy}px) scale(${scale}) translate(${-cx}px, ${-cy}px)`
  );
}

/** The vanishing point for a view of the given size, moved by the room's parallax (each axis -1 to 1). */
export function vanishingPoint(view: { width: number; height: number }, parallax: Point): Point {
  const clamp = (v: number) => Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));
  return {
    x: view.width / 2 + clamp(parallax.x) * LAYERS.parallaxShift * view.width,
    y: view.height / 2 + clamp(parallax.y) * LAYERS.parallaxShift * view.height,
  };
}

/** Largest first, then the first `max`, keeping page order for the result. */
export function largest<T>(items: T[], area: (t: T) => number, max: number): T[] {
  if (items.length <= max) return items;
  const keep = new Set(
    items
      .map((t, i) => ({ i, a: area(t) }))
      .sort((p, q) => q.a - p.a)
      .slice(0, max)
      .map((p) => p.i),
  );
  return items.filter((_, i) => keep.has(i));
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/** A style attribute without our own --hs-lift declaration, for comparing. */
export function withoutLift(style: string): string {
  return style
    .replace(/--hs-lift\s*:[^;]*;?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when two style attributes differ only in our --hs-lift (a change we made, not the page). */
export function sameExceptLift(before: string, after: string): boolean {
  return withoutLift(before) === withoutLift(after);
}

