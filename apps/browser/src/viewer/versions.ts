/**
 * The HoloML versions this viewer reads (holoml SPEC.md, section 11). A
 * page's version is read once, here, and every feature asks "is the page
 * at least 0.2?" through `atLeast`, so a later version keeps what the
 * earlier ones have. A version the viewer does not know is refused, not
 * guessed at, and so is a page that names none.
 */
import { VERSIONS, atLeast, type ElementNode } from '@hypersol/holoml';

/** A version this viewer knows. */
export type Version = (typeof VERSIONS)[number];

export { VERSIONS, atLeast };

/**
 * The version a page declares, from its root element: one this viewer
 * knows, or null. Null is a version it does not know, or none at all (no
 * `version`, or the word alone without a value): either way the page is
 * refused and not drawn, as the specification's owner settled for
 * section 11 (2026-09-30). A reader does not guess which version a page
 * that does not say was written for.
 */
export function pageVersion(root: ElementNode): Version | null {
  const declared = root.attributes.find((a) => a.name === 'version')?.value;
  // Written exactly: spaces around it make it another word (SPEC.md section 4).
  return typeof declared === 'string' && (VERSIONS as readonly string[]).includes(declared) ? (declared as Version) : null;
}
