/**
 * Reading HoloML attribute values (holoml SPEC.md, section 6), with the
 * spec's defaults. The checker has already reported bad values; here a bad
 * value simply falls back to the default, so the rest of the scene shows.
 *
 * What a number, a time, and whitespace are is what the checker says
 * they are (review 134): the patterns are the checker's own, from its
 * rules, and whitespace is the syntax's four characters, so that a value
 * the checker takes is read here, and one it reports falls back.
 */
import type { ElementNode, Problem } from '@hypersol/holoml';
// The checker's patterns of values. The package's own entry does not pass them on, so they are read from its rules.
import { COUNT_PATTERN, DURATION_PATTERN, INDEFINITE, NUMBER_PATTERN, whole } from '@hypersol/holoml';

export type Vec3 = [number, number, number];

// Written so that a long run of digits is read once (review 134, L1).
const NUMBER = whole(NUMBER_PATTERN);
const DURATION = whole(DURATION_PATTERN);
const COUNT = whole(COUNT_PATTERN);

/**
 * Whitespace is four characters (SPEC.md section 5): the space, the tab,
 * the line feed, and the carriage return. Any other space, such as the
 * no-break space, is a character like any other: it separates no
 * numbers, and is not dropped from around a value or from text.
 */
const SPACES = /[ \t\n\r]+/;
const isSpace = (c: number) => c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;

/** A value without the whitespace around it. */
export function trimSpace(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && isSpace(s.charCodeAt(start))) start += 1;
  while (end > start && isSpace(s.charCodeAt(end - 1))) end -= 1;
  return s.slice(start, end);
}

/** Text on one line: runs of whitespace as one space, and none at its start and end. */
export function collapse(s: string): string {
  return trimSpace(s).split(SPACES).join(' ');
}

/** The numbers of a value, which whitespace separates; undefined when the attribute is absent or written alone. */
function numbers(value: string | null | undefined): string[] | undefined {
  return typeof value === 'string' ? trimSpace(value).split(SPACES) : undefined;
}

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
  const v = trimSpace(attr(el, name) ?? '');
  if (!v || !finite(v)) return fallback;
  const n = Number(v);
  return n < min || n > max ? fallback : n;
}

const toldBeyond = new WeakSet<object>();

/** Whether every number is within reach; one that is not is said once, in the console, for its attribute. */
function withinReach(el: ElementNode, name: string, values: number[]): boolean {
  if (values.every((n) => Math.abs(n) <= REACH)) return true;
  const written = el.attributes.find((a) => a.name === name);
  if (written && !toldBeyond.has(written)) {
    toldBeyond.add(written);
    console.warn(`HoloML: line ${written.start.line}, column ${written.start.column}: "${name}" is beyond ${REACH.toLocaleString('en')}; the default is used instead.`);
  }
  return false;
}

export function vec3(el: ElementNode, name: string, fallback: Vec3): Vec3 {
  const parts = numbers(attr(el, name));
  if (!parts || parts.length !== 3 || !parts.every(finite)) return fallback;
  const v = parts.map(Number) as Vec3;
  return !PLACES.has(name) || withinReach(el, name, v) ? v : fallback;
}

/** One number (the same on every axis) or three. */
export function scale(el: ElementNode, fallback: Vec3 = [1, 1, 1]): Vec3 {
  const parts = numbers(attr(el, 'scale'));
  if (!parts || !parts.every(finite) || (parts.length !== 1 && parts.length !== 3)) return fallback;
  const v: Vec3 = parts.length === 1 ? [Number(parts[0]), Number(parts[0]), Number(parts[0])] : (parts.map(Number) as Vec3);
  return withinReach(el, 'scale', v) ? v : fallback;
}

/** "#rgb" or "#rrggbb", as "#rrggbb"; null when absent or bad. */
export function color(el: ElementNode, name: string): string | null {
  const v = trimSpace(attr(el, name) ?? '');
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join('')}`.toLowerCase();
  return null;
}

/**
 * A time, in milliseconds: a number more than 0, in any of a number's
 * forms, followed at once by "s" or "ms" ("2s", "500ms", "1.5e3ms",
 * "1.s"); null when absent or bad.
 */
export function duration(el: ElementNode, name: string): number | null {
  const v = trimSpace(attr(el, name) ?? '');
  if (!DURATION.test(v)) return null;
  const unit = v.endsWith('ms') ? 'ms' : 's';
  const n = Number(v.slice(0, -unit.length));
  if (!Number.isFinite(n) || !(n > 0)) return null;
  // A time the checker takes is a time here too, however long: seconds whose milliseconds are too many to write are the longest time there is.
  return Math.min(Number.MAX_VALUE, n * (unit === 's' ? 1000 : 1));
}

/** How many runs: a whole number of 1 or more, or Infinity for "indefinite". */
export function repeat(el: ElementNode): number {
  const v = trimSpace(attr(el, 'repeat') ?? '');
  if (v === INDEFINITE) return Infinity;
  return COUNT.test(v) && Number.isSafeInteger(Number(v)) ? Number(v) : 1;
}

/**
 * How many times a material's pictures tile (HoloML 0.2 `repeat`): one
 * number more than 0, the same both ways, or two; null when absent or bad.
 */
export function tiling(el: ElementNode): [number, number] | null {
  const parts = numbers(attr(el, 'repeat'));
  if (!parts || (parts.length !== 1 && parts.length !== 2) || !parts.every(finite)) return null;
  const [u, v] = [Number(parts[0]), Number(parts[1] ?? parts[0])];
  return u > 0 && v > 0 ? [u, v] : null;
}

/**
 * A rectangle of the ground (HoloML 0.2 `area`, a floor plan's): x0 z0
 * x1 z1, with x1 more than x0 and z1 more than z0; null when absent or bad.
 */
export function area(el: ElementNode, name = 'area'): [number, number, number, number] | null {
  const parts = numbers(attr(el, name));
  if (!parts || parts.length !== 4 || !parts.every(finite)) return null;
  const [x0, z0, x1, z1] = parts.map(Number) as [number, number, number, number];
  return x1 > x0 && z1 > z0 ? [x0, z0, x1, z1] : null;
}

/**
 * A panel's text as paragraphs (HoloML 0.2 `panel`): a blank line starts
 * a new one, and within each, whitespace collapses as in a label.
 */
export function paragraphs(value: string): string[] {
  return value
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map(collapse)
    .filter((p) => p !== '');
}

/** An element's own text, as written (line breaks kept). */
export function rawText(el: ElementNode): string {
  return el.children.map((c) => (c.type === 'text' ? c.value : '')).join('');
}

/** Text content with whitespace collapsed, as in title and label. */
export function text(el: ElementNode): string {
  return collapse(rawText(el));
}

/**
 * An address from the page, resolved against the page's own; null unless
 * it is http, https, or the page's own scheme (a file opened from the
 * computer), as the spec allows.
 */
export function resolveAddress(value: string | null | undefined, base: string): URL | null {
  if (!value) return null;
  try {
    const url = new URL(trimSpace(value), base);
    const own = new URL(base).protocol;
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === own ? url : null;
  } catch {
    return null;
  }
}

/**
 * The problems the checker reported on one element itself: at its tag, at
 * one of its attributes, or at something written inside it (text is
 * reported where its first character that is not whitespace stands). A
 * problem of another element that merely shares its line is not its own.
 */
export function ownProblems(el: ElementNode, problems: readonly Problem[]): Problem[] {
  const places = [el.start, ...el.attributes.map((a) => a.start), ...el.children.map((c) => (c.type === 'text' ? c.visible : c.start))];
  return problems.filter((p) => places.some((at) => at.line === p.line && at.column === p.column));
}

/** Light and contrasting text colours for a background, by its brightness. */
export function contrastText(background: string | null): string {
  if (!background) return '#f2f4ff';
  const n = parseInt(background.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? '#15171f' : '#f2f4ff';
}
