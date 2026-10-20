/**
 * Where a link leads (issue #125). In HyperSpace 3D and its Android app
 * the document is the HoloML page itself, at the page's own address, and
 * a link is followed as it is. On a plain page of an ordinary browser
 * (the viewer on the web, site/viewer/host.js) the document is the
 * host's, `…/viewer/?page=<address>`, with a `<base>` of the page's
 * address: following a link to another HoloML page as it is would lead
 * to the `.holoml` file itself, which a site such as GitHub Pages sends
 * as a download. There the host marks the document, and such a link
 * opens at the host's own address with `?page=`, as the next page's own
 * link to the viewer would.
 */

/** Where the viewer runs, for its links. */
export interface Here {
  /** The document's address (location.href). */
  document: string;
  /** The page's address: the document's in HyperSpace 3D and its Android app; on a plain page, the one the host gave (its `<base>`). */
  page: string;
  /** On a plain page whose host opens a HoloML page by its own address with `?page=` (site/viewer/host.js marks it). */
  web: boolean;
}

/** The hosts whose plain http addresses the host on the web fetches, as it does (host.js). */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** A HoloML page, by its address. */
export function isHolomlPage(url: URL): boolean {
  return /\.holoml$/i.test(url.pathname);
}

/** Two addresses of one document (they differ at most after #). */
export function sameDocument(a: URL, b: URL): boolean {
  return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search;
}

/** An address the host on the web fetches: https, or http on this computer. */
function fetchable(url: URL): boolean {
  return url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
}

/** An address as the value of `?page=`: readable, with only what would end or change the value escaped. */
function pageValue(href: string): string {
  return encodeURI(href).replace(/[&#+]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** The address a link opens at: its own, except on the web, where a HoloML page opens in the viewer by `?page=`. */
export function linkAddress(href: string, here: Here): string {
  if (!here.web) return href;
  let to: URL;
  try {
    to = new URL(href);
  } catch {
    return href;
  }
  if (!isHolomlPage(to) || !fetchable(to)) return href;
  const at = new URL(here.document);
  // A place on this page: the document's own address with its name, so the viewer goes there without leaving.
  if (to.hash.length > 1 && sameDocument(to, new URL(here.page))) {
    at.hash = to.hash;
    return at.href;
  }
  return `${at.origin}${at.pathname}?page=${pageValue(to.href)}`;
}

/** Whether a link leads to another HoloML page of the page's own site (the fade is for those). */
export function toAnotherPage(href: string, here: Here): boolean {
  try {
    const to = new URL(href);
    const page = new URL(here.page);
    return to.origin === page.origin && isHolomlPage(to) && !sameDocument(to, page);
  } catch {
    return false;
  }
}

/**
 * Whether the page was opened from another HoloML page of its own site,
 * by the address it came from (document.referrer): that page's own, or
 * on the web, the host's with that page's `?page=`.
 */
export function cameFromAnotherPage(referrer: string, here: Here): boolean {
  try {
    let from = new URL(referrer);
    if (here.web) {
      const at = new URL(here.document);
      const page = from.searchParams.get('page');
      if (from.origin !== at.origin || from.pathname !== at.pathname || page === null) return false;
      from = new URL(page);
    }
    return toAnotherPage(from.href, here);
  } catch {
    return false;
  }
}
