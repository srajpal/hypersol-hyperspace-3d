/**
 * Reading HoloML 0.1 attribute values (holoml SPEC.md, section 4), with the
 * spec's defaults. The checker has already reported bad values; here a bad
 * value simply falls back to the default, so the rest of the scene shows.
 */
import type { ElementNode } from '@hypersol/holoml';

export type Vec3 = [number, number, number];

const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

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

export function vec3(el: ElementNode, name: string, fallback: Vec3): Vec3 {
  const parts = attr(el, name)?.trim().split(/\s+/);
  if (!parts || parts.length !== 3 || !parts.every(finite)) return fallback;
  return parts.map(Number) as Vec3;
}

/** One number (the same on every axis) or three. */
export function scale(el: ElementNode, fallback: Vec3 = [1, 1, 1]): Vec3 {
  const parts = attr(el, 'scale')?.trim().split(/\s+/);
  if (!parts || !parts.every(finite)) return fallback;
  if (parts.length === 1) return [Number(parts[0]), Number(parts[0]), Number(parts[0])];
  return parts.length === 3 ? (parts.map(Number) as Vec3) : fallback;
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

/** Light and contrasting text colours for a background, by its brightness. */
export function contrastText(background: string | null): string {
  if (!background) return '#f2f4ff';
  const n = parseInt(background.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? '#15171f' : '#f2f4ff';
}
