/**
 * The HoloML versions this viewer reads (holoml SPEC.md, section 11). A
 * page's version is read once, here, and every feature asks "is the page
 * at least 0.2?" through `atLeast`, so a later version keeps what the
 * earlier ones have. A version the viewer does not know is refused, not
 * guessed at.
 */
import { VERSIONS, atLeast, type ElementNode } from '@hypersol/holoml';

/** A version this viewer knows. */
export type Version = (typeof VERSIONS)[number];

export { VERSIONS, atLeast };

/**
 * The version a page declares, from its root element: one this viewer
 * knows, or null for one it does not (the page is refused). A page that
 * declares none has a problem the checker reports (the attribute is
 * required); there is no version to refuse, so it is read as the first.
 */
export function pageVersion(root: ElementNode): Version | null {
  const declared = root.attributes.find((a) => a.name === 'version')?.value;
  if (declared === undefined || declared === null) return VERSIONS[0];
  // Written exactly: spaces around it make it another word (SPEC.md section 4).
  return (VERSIONS as readonly string[]).includes(declared) ? (declared as Version) : null;
}
