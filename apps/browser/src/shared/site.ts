/**
 * What the main process and the shell must read the same way in an
 * address, written once (review of 2026-09-30, Sm7): the key the address
 * bar completes by, and a page's site for the per-site settings. Pure, so
 * both sides and the unit tests share it.
 */

/**
 * An address as the address bar matches it: without the scheme or "www.",
 * in lower case. History keeps each address under this key (the same
 * rule in SQL, main/storage/history.ts), and the address bar looks up
 * what was typed, and what it offered, by it.
 */
export function siteKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
}

/** An address's host name in lower case; '' for anything that is not an address. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}
