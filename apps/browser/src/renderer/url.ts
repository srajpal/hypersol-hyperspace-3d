/** DuckDuckGo, the default search engine (ARCHITECTURE.md section 4). */
export const DEFAULT_SEARCH_URL = 'https://duckduckgo.com/?q=%s';

/**
 * Turns typed text into a web address, or null if it is not one.
 * Only http, https, and the blank page are accepted.
 */
export function normalizeAddress(input: string): string | null {
  const text = input.trim();
  if (text === '') return null;
  if (text === 'about:blank') return text;
  if (/\s/.test(text)) return null;
  if (/^https?:\/\//i.test(text)) return parse(text);
  // Any other scheme (file:, javascript:, chrome:, ...) is refused.
  // "host:port" is not a scheme, so a colon followed by a digit is allowed.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(text)) return null;
  const host = text.split(/[/?#]/, 1)[0] ?? '';
  const hostname = host.replace(/:\d+$/, '');
  const local = /^(localhost|127\.0\.0\.1)$/i.test(hostname);
  if (!local && !hostname.includes('.')) return null;
  return parse(`${local ? 'http' : 'https'}://${text}`);
}

function parse(text: string): string | null {
  try {
    const url = new URL(text);
    return url.hostname === '' ? null : url.href;
  } catch {
    return null;
  }
}

export type AddressResult =
  | { kind: 'address'; url: string }
  | { kind: 'search'; url: string; query: string };

/**
 * What the address bar does with typed text: load it if it is a web
 * address, otherwise search for it. Null for empty text.
 * searchUrl contains %s where the encoded query goes.
 */
export function resolveInput(input: string, searchUrl = DEFAULT_SEARCH_URL): AddressResult | null {
  const query = input.trim();
  if (query === '') return null;
  const url = normalizeAddress(query);
  if (url !== null) return { kind: 'address', url };
  return { kind: 'search', url: searchUrl.replace('%s', encodeURIComponent(query)), query };
}

/** How an address's start is judged to fit the bar when it cannot be measured: by its length. */
const fitsByLength = (start: string) => start.length <= 60;

/**
 * An address as the address bar shows it while the keyboard is elsewhere
 * (review of 2026-09-30, R5). The end of the host is what says whose page
 * it is, so it is always in view: when the scheme and host do not fit
 * (`fits` measures them), labels are left out from the host's left, never
 * its right: "https://…google.com.long.evil.example/". A user name and
 * password in the address are never shown. The full address shows when
 * the bar takes the keyboard.
 */
export function displayAddress(address: string, fits: (start: string) => boolean = fitsByLength): string {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return address;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return address;
  const scheme = `${url.protocol}//`;
  const rest = `${url.pathname}${url.search}${url.hash}`;
  const port = url.port ? `:${url.port}` : '';
  const whole = `${scheme}${url.host}`;
  if (fits(whole)) return url.username || url.password ? `${whole}${rest}` : address;
  const labels = url.hostname.split('.');
  // A numeric address has no left to leave out.
  if (url.hostname.startsWith('[') || /^[\d.]+$/.test(url.hostname)) return `${whole}${rest}`;
  // At least the site's own name stays: two labels, or three under a
  // two-letter country's short second level ("example.co.uk").
  const last = labels[labels.length - 1] ?? '';
  const second = labels[labels.length - 2] ?? '';
  const least = last.length === 2 && second.length <= 3 ? 3 : 2;
  for (let from = 1; labels.length - from >= least; from++) {
    const start = `${scheme}…${labels.slice(from).join('.')}${port}`;
    if (fits(start) || labels.length - from === least) return `${start}${rest}`;
  }
  return `${whole}${rest}`;
}

/** The page's state as the top bar's site button shows it. */
export type SiteMarker = 'secure' | 'insecure' | 'none';

const originOf = (address: string): string | null => {
  try {
    const url = new URL(address);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
};

/**
 * What the site button says about the tab in front (review of
 * 2026-09-30, R5): "secure" only for a page that really loaded over
 * https, "insecure" for one that loaded over plain http, and nothing
 * otherwise: for a start tab, for a failed or crashed page (a
 * certificate error's card is no secure page), and while another site's
 * address is still on its way in. `shown` is the address in the bar,
 * `committed` the address of the document the page last loaded.
 */
export function siteMarker(state: string, shown: string, committed: string): SiteMarker {
  if (state !== 'loaded' && state !== 'loading') return 'none';
  const origin = originOf(committed);
  if (origin === null || origin !== originOf(shown)) return 'none';
  return origin.startsWith('https:') ? 'secure' : 'insecure';
}
