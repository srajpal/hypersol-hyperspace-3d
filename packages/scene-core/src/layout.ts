/**
 * Room layout maths. World units equal CSS pixels at depth 0: the camera
 * sits at the distance where a panel facing it at z = 0 appears at exactly
 * its pixel size. That keeps an untilted page pixel-sharp.
 *
 * Axes follow Three.js: x right, y up, z toward the viewer.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutInput {
  /** Window content size in CSS pixels. */
  viewportWidth: number;
  viewportHeight: number;
  /** Vertical field of view of the camera, in degrees. */
  fovDeg: number;
  /** Page tilt around the vertical axis, in degrees (0 to 20). */
  tiltDeg: number;
  /** Which edge goes back: 1 the right edge (the default), -1 the left edge (milestone 11). */
  direction?: 1 | -1;
  /** Space kept free around the page, in CSS pixels. */
  insets: Insets;
}

export interface PanelLayout {
  /** Page size in CSS pixels (and world units). */
  panelWidth: number;
  panelHeight: number;
  /** Centre of the page in world units. */
  position: Vec3;
  /** Rotation around the y axis, in radians. */
  rotationY: number;
  /** Camera distance from z = 0. */
  cameraZ: number;
  fovDeg: number;
  viewportWidth: number;
  viewportHeight: number;
}

export const MIN_TILT_DEG = 0;
export const MAX_TILT_DEG = 20;
export const DEFAULT_TILT_DEG = 10;

export function clampTilt(deg: number): number {
  if (!Number.isFinite(deg)) return DEFAULT_TILT_DEG;
  return Math.min(MAX_TILT_DEG, Math.max(MIN_TILT_DEG, deg));
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Camera distance at which one world unit at z = 0 is one CSS pixel. */
export function pixelPerfectDistance(viewportHeight: number, fovDeg: number): number {
  return viewportHeight / 2 / Math.tan(degToRad(fovDeg) / 2);
}

/** A point on the page, in page pixels from its top-left corner, to world space. */
export function panelPointToWorld(layout: PanelLayout, u: number, v: number): Vec3 {
  const lx = u - layout.panelWidth / 2;
  const ly = layout.panelHeight / 2 - v;
  const c = Math.cos(layout.rotationY);
  const s = Math.sin(layout.rotationY);
  return {
    x: layout.position.x + lx * c,
    y: layout.position.y + ly,
    z: layout.position.z - lx * s,
  };
}

/**
 * Projects a world point to viewport CSS pixels (origin top-left) for a
 * camera at (camera.x, camera.y, cameraZ) looking straight down -z.
 */
export function projectToViewport(
  layout: Pick<PanelLayout, 'cameraZ' | 'viewportWidth' | 'viewportHeight'>,
  p: Vec3,
  camera: Vec2 = { x: 0, y: 0 },
): Vec2 {
  const depth = layout.cameraZ - p.z;
  if (depth <= 0) throw new Error('Point is behind the camera');
  const k = layout.cameraZ / depth;
  return {
    x: layout.viewportWidth / 2 + (p.x - camera.x) * k,
    y: layout.viewportHeight / 2 - (p.y - camera.y) * k,
  };
}

/** The page's four corners on screen: top-left, top-right, bottom-right, bottom-left. */
export function panelScreenQuad(layout: PanelLayout, camera: Vec2 = { x: 0, y: 0 }): Vec2[] {
  const { panelWidth: w, panelHeight: h } = layout;
  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  return corners.map(([u, v]) => projectToViewport(layout, panelPointToWorld(layout, u, v), camera));
}

function build(input: LayoutInput, scale: number): PanelLayout {
  const { viewportWidth: vw, viewportHeight: vh, insets } = input;
  const availW = Math.max(1, vw - insets.left - insets.right);
  const availH = Math.max(1, vh - insets.top - insets.bottom);
  const cameraZ = pixelPerfectDistance(vh, input.fovDeg);
  // Centre of the free area, relative to the viewport centre, y up.
  const cx = insets.left + availW / 2 - vw / 2;
  const cy = vh / 2 - (insets.top + availH / 2);
  return {
    panelWidth: Math.round(availW * scale),
    panelHeight: Math.round(availH * scale),
    position: { x: cx, y: cy, z: 0 },
    rotationY: degToRad(clampTilt(input.tiltDeg)) * (input.direction ?? 1),
    cameraZ,
    fovDeg: input.fovDeg,
    viewportWidth: vw,
    viewportHeight: vh,
  };
}

/**
 * Where a tilted page of this size can sit so its outline stays in the
 * free area: the range of centres (x) that keep both side edges inside,
 * or null if none does (it is too wide, or too tall at its near edge).
 */
function centreRange(input: LayoutInput, rotationY: number, w: number, h: number): { lo: number; hi: number } | null {
  const { viewportWidth: vw, viewportHeight: vh, insets } = input;
  const d = pixelPerfectDistance(vh, input.fovDeg);
  const c = Math.cos(rotationY);
  const sn = Math.sin(rotationY);
  // Screen scale of the left edge (x = -w/2 on the page) and the right edge.
  const zLeft = (w / 2) * sn;
  const zRight = -(w / 2) * sn;
  if (d - zLeft <= 1 || d - zRight <= 1) return null;
  const kLeft = d / (d - zLeft);
  const kRight = d / (d - zRight);
  const availH = Math.max(1, vh - insets.top - insets.bottom);
  const cy = vh / 2 - (insets.top + availH / 2);
  for (const k of [kLeft, kRight]) {
    if (vh / 2 - (cy + h / 2) * k < insets.top - 0.5) return null;
    if (vh / 2 - (cy - h / 2) * k > vh - insets.bottom + 0.5) return null;
  }
  const lo = (insets.left - vw / 2) / kLeft + (w / 2) * c;
  const hi = (vw / 2 - insets.right) / kRight - (w / 2) * c;
  return lo <= hi + 1e-6 ? { lo, hi } : null;
}

/**
 * Lays out the focused page: as large as the free area allows, tilted by
 * tiltDeg. At 0 degrees it fills the free area at exactly 1:1. Tilted, its
 * near edge comes toward the camera and grows while the far edge recedes;
 * the page takes the tallest size whose near edge still fits, then widens
 * and shifts until its outline reaches both sides of the free area
 * (milestone 11: before, it shrank around its centre and left a gap on the
 * far side).
 */
export function computePanelLayout(input: LayoutInput): PanelLayout {
  const base = build(input, 1);
  if (clampTilt(input.tiltDeg) === 0) return base;
  const rot = base.rotationY;
  const availW = base.panelWidth;
  const availH = base.panelHeight;
  /** The widest page of this height that fits, with its range of centres. */
  const widest = (h: number): { w: number; range: { lo: number; hi: number } } | null => {
    let lo = 1;
    let hi = availW * 4;
    if (!centreRange(input, rot, lo, h)) return null;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (centreRange(input, rot, mid, h)) lo = mid;
      else hi = mid;
    }
    const w = Math.floor(lo);
    const range = centreRange(input, rot, w, h);
    return range ? { w, range } : null;
  };
  // The tallest height whose widest page reaches both sides (no room left
  // across); taller than that, the near edge would stop it short.
  const reachesSides = (h: number) => {
    const fit = widest(h);
    return fit !== null && fit.range.hi - fit.range.lo < 2;
  };
  let hLo = availH * 0.1;
  let hHi = availH;
  if (reachesSides(hHi)) hLo = hHi;
  else {
    for (let i = 0; i < 40; i++) {
      const mid = (hLo + hHi) / 2;
      if (reachesSides(mid)) hLo = mid;
      else hHi = mid;
    }
  }
  const h = Math.floor(hLo);
  const fit = widest(h);
  if (!fit) return build(input, 0.5);
  const x = (fit.range.lo + fit.range.hi) / 2;
  return { ...base, panelWidth: fit.w, panelHeight: h, position: { ...base.position, x } };
}

/** Whether a point lies inside a polygon (even-odd rule). */
export function pointInPolygon(pt: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}
