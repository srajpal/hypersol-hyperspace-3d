/**
 * Reading HoloML 0.1 attribute values (holoml SPEC.md, section 4), with the
 * spec's defaults. The checker has already reported bad values; here a bad
 * value simply falls back to the default, so the rest of the scene shows.
 */
import type { ElementNode, Problem } from '@hypersol/holoml';

export type Vec3 = [number, number, number];

// Digits, then at most one point: written so that a long run of digits is read once (review 134, L1).
const NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * How far from the middle of the scene anything may be placed, in metres
 * (and how many times anything may be scaled): a thousand kilometres.
 * Beyond it numbers lose the millimetres, and walls and walking stop
 * making sense, so a place farther away falls back to the default, and
 * the console says so (review 134, V5).
 */
export const REACH = 1e6;
/** The attributes that are places or sizes in metres: the reach applies to these (a turn of many degrees is only a turn). */
const PLACES = new Set(['position', 'look-at', 'size']);

/** A number the scene can use: written as one, and finite (1e999 is not; holoml issue #3). */
function finite(p: string): boolean {
  return NUMBER.test(p) && Number.isFinite(Number(p));
}

export function attr(el: ElementNode, name: string): string | null | undefined {
  return el.attributes.find((a) => a.name === name)?.value;
}

export function has(el: ElementNode, name: string): boolean {
  return el.attributes.some((a) => a.name === name);
}

export function num(el: ElementNode, name: string, fallback: number, min = -Infinity, max = Infinity): number {
  const v = attr(el, name)?.trim();
  if (!v || !finite(v)) return fallback;
  const n = Number(v);
  return n < min || n > max ? fallback : n;
}

const toldBeyond = new WeakSet<object>();

/** Whether every number is within reach; one that is not is said once, in the console, for its attribute. */
function withinReach(el: ElementNode, name: string, numbers: number[]): boolean {
  if (numbers.every((n) => Math.abs(n) <= REACH)) return true;
  const written = el.attributes.find((a) => a.name === name);
  if (written && !toldBeyond.has(written)) {
    toldBeyond.add(written);
    console.warn(`HoloML: line ${written.start.line}, column ${written.start.column}: "${name}" is beyond ${REACH.toLocaleString('en')}; the default is used instead.`);
  }
  return false;
}

export function vec3(el: ElementNode, name: string, fallback: Vec3): Vec3 {
  const parts = attr(el, name)?.trim().split(/\s+/);
  if (!parts || parts.length !== 3 || !parts.every(finite)) return fallback;
  const v = parts.map(Number) as Vec3;
  return !PLACES.has(name) || withinReach(el, name, v) ? v : fallback;
}

/** One number (the same on every axis) or three. */
export function scale(el: ElementNode, fallback: Vec3 = [1, 1, 1]): Vec3 {
  const parts = attr(el, 'scale')?.trim().split(/\s+/);
  if (!parts || !parts.every(finite) || (parts.length !== 1 && parts.length !== 3)) return fallback;
  const v: Vec3 = parts.length === 1 ? [Number(parts[0]), Number(parts[0]), Number(parts[0])] : (parts.map(Number) as Vec3);
  return withinReach(el, 'scale', v) ? v : fallback;
}

/** "#rgb" or "#rrggbb", as "#rrggbb"; null when absent or bad. */
export function color(el: ElementNode, name: string): string | null {
  const v = attr(el, name)?.trim() ?? '';
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join('')}`.toLowerCase();
  return null;
}

/** "2s" or "500ms", in milliseconds; null when absent or bad. */
export function duration(el: ElementNode, name: string): number | null {
  const m = /^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/.exec(attr(el, name)?.trim() ?? '');
  if (!m) return null;
  const ms = Number(m[1]) * (m[2] === 's' ? 1000 : 1);
  return ms > 0 && Number.isFinite(ms) ? ms : null;
}

/** How many runs: a whole number of 1 or more, or Infinity for "indefinite". */
export function repeat(el: ElementNode): number {
  const v = attr(el, 'repeat')?.trim();
  if (v === 'indefinite') return Infinity;
  return v && /^\d+$/.test(v) && Number(v) >= 1 && Number.isSafeInteger(Number(v)) ? Number(v) : 1;
}

/**
 * How many times a material's pictures tile (HoloML 0.2 `repeat`): one
 * number more than 0, the same both ways, or two; null when absent or bad.
 */
export function tiling(el: ElementNode): [number, number] | null {
  const parts = attr(el, 'repeat')?.trim().split(/\s+/);
  if (!parts || (parts.length !== 1 && parts.length !== 2) || !parts.every(finite)) return null;
  const [u, v] = [Number(parts[0]), Number(parts[1] ?? parts[0])];
  return u > 0 && v > 0 ? [u, v] : null;
}

/**
 * A rectangle of the ground (HoloML 0.2 `area`, a floor plan's): x0 z0
 * x1 z1, with x1 more than x0 and z1 more than z0; null when absent or bad.
 */
export function area(el: ElementNode, name = 'area'): [number, number, number, number] | null {
  const parts = attr(el, name)?.trim().split(/\s+/);
  if (!parts || parts.length !== 4 || !parts.every(finite)) return null;
  const [x0, z0, x1, z1] = parts.map(Number) as [number, number, number, number];
  return x1 > x0 && z1 > z0 ? [x0, z0, x1, z1] : null;
}

/**
 * A panel's text as paragraphs (HoloML 0.2 `panel`): a blank line starts
 * a new one, and within each, spaces and line breaks collapse as in a
 * label.
 */
export function paragraphs(value: string): string[] {
  return value
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t\f\v]*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p !== '');
}

/** An element's own text, as written (line breaks kept). */
export function rawText(el: ElementNode): string {
  return el.children.map((c) => (c.type === 'text' ? c.value : '')).join('');
}

/** Text content with whitespace collapsed, as in title and label. */
export function text(el: ElementNode): string {
  return el.children
    .map((c) => (c.type === 'text' ? c.value : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * An address from the page, resolved against the page's own; null unless
 * it is http, https, or the page's own scheme (a file opened from the
 * computer), as the spec allows.
 */
export function resolveAddress(value: string | null | undefined, base: string): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim(), base);
    const own = new URL(base).protocol;
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === own ? url : null;
  } catch {
    return null;
  }
}

/**
 * The problems the checker reported on one element itself: at its tag, at
 * one of its attributes, or at something written inside it. A problem of
 * another element that merely shares its line is not its own.
 */
export function ownProblems(el: ElementNode, problems: readonly Problem[]): Problem[] {
  const places = [el.start, ...el.attributes.map((a) => a.start), ...el.children.map((c) => c.start)];
  return problems.filter((p) => places.some((at) => at.line === p.line && at.column === p.column));
}

/** Light and contrasting text colours for a background, by its brightness. */
export function contrastText(background: string | null): string {
  if (!background) return '#f2f4ff';
  const n = parseInt(background.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? '#15171f' : '#f2f4ff';
}
