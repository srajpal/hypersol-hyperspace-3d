/**
 * HTTPS-only browsing (milestone 26, GitHub issue #24; owner, prompt 178).
 *
 * A page's address that starts with http:// is tried over HTTPS first,
 * the rest of the address unchanged, whether it was typed, followed as a
 * link, or reached by a redirect. A site that cannot be reached that way
 * gets a card in place of the page (renderer/load-errors.ts), and nothing
 * goes over plain HTTP until the person continues from it, which makes
 * an exception for the site until the browser closes (Q2 a). A lasting
 * exception is made on purpose, in the site panel or Settings, and kept
 * in settings.json. Private tabs keep their own exceptions, in memory
 * only. Addresses that cannot have a certificate are never upgraded
 * (Q4 a): localhost, loopback and private network addresses, and
 * single-word host names.
 *
 * This file decides; main/privacy/index.ts asks it from the shield's one
 * request listener. No Electron imports, so it can be unit tested.
 */

/** Is this IPv4 address (four numbers) loopback, private, or link-local? */
function isLocalIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return false;
  const [a, b] = parts.map(Number) as [number, number];
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0;
}

/** Is this IPv6 address (in its brackets, as a URL's host has it) loopback, unique local, or link-local? */
function isLocalIpv6(host: string): boolean {
  if (!host.startsWith('[') || !host.endsWith(']')) return false;
  const address = host.slice(1, -1).toLowerCase();
  if (address === '::1' || address === '::') return true;
  // IPv4 written in IPv6 (::ffff:127.0.0.1, which URL writes as ::ffff:7f00:1).
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);
  if (mapped) {
    const n = (parseInt(mapped[1]!, 16) << 16) | parseInt(mapped[2]!, 16);
    return isLocalIpv4([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'));
  }
  const first = parseInt(address.split(':')[0] || '0', 16);
  // fc00::/7 (unique local) and fe80::/10 (link-local).
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80;
}

/** An address that cannot have a certificate, so is never upgraded (Q4 a). `host` is a URL's host name, lower case. */
export function isLocalHost(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (isLocalIpv4(host) || isLocalIpv6(host)) return true;
  // A single word (router, nas): a name only a local network knows.
  return !host.includes('.') && !host.startsWith('[');
}

/** The address over HTTPS, or null when it is not an http:// address to upgrade. */
export function httpsFor(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' || isLocalHost(parsed.hostname)) return null;
  parsed.protocol = 'https:';
  // HTTP's own port means HTTPS's own port; any other is kept.
  if (parsed.port === '80') parsed.port = '';
  return parsed.href;
}

const hostOfUrl = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

const withoutFragment = (url: string): string => url.split('#')[0]!;

export type HttpsDecision =
  /** Load it over HTTPS instead. */
  | { redirectURL: string }
  /** The site sent the upgraded page back to the very address asked for over HTTP: stop, and show the card for it. */
  | { refuse: string }
  /** Load it as asked. */
  | null;

export type ExceptionKind = 'session' | 'lasting';

export interface HttpsOnlyOptions {
  /** The setting (on by default, Q1 a). */
  enabled(): boolean;
  /** The lasting exceptions, from settings.json. */
  lasting(): readonly string[];
  /**
   * Test mode only: host names the test server answers over plain HTTP
   * only, treated as local addresses are (never upgraded), so that the
   * earlier milestones' checks on them are checks of what they check.
   */
  plainHosts?: readonly string[];
}

/**
 * What HTTPS-only knows: the exceptions made this run (normal and
 * private), and each tab's page load that was upgraded and has not yet
 * been shown, so that a failure or a redirect back to HTTP is known for
 * what it is.
 */
export class HttpsOnly {
  private readonly session = new Set<string>();
  private readonly privateSession = new Set<string>();
  /** Per tab: the address asked for over HTTP, and the HTTPS one loaded instead. */
  private readonly upgrades = new Map<number, { http: string; https: string }>();
  /** Per tab: where the page load is being redirected to (main frames only). */
  private readonly redirects = new Map<number, string>();

  constructor(private readonly options: HttpsOnlyOptions) {}

  /** The exception a site has: one kept in settings, one for this run, or none. Private tabs' are their own. */
  exception(host: string, isPrivate: boolean): ExceptionKind | null {
    if (isPrivate) return this.privateSession.has(host) ? 'session' : null;
    if (this.options.lasting().includes(host)) return 'lasting';
    return this.session.has(host) ? 'session' : null;
  }

  /** A tab's page load (main frame) is starting: load it as asked, over HTTPS instead, or not at all. */
  decide(tab: number, url: string, isPrivate: boolean): HttpsDecision {
    const redirected = this.redirects.get(tab) === url;
    this.redirects.delete(tab);
    const https = httpsFor(url);
    if (https === null || !this.options.enabled()) return null;
    const host = hostOfUrl(url);
    if (this.exception(host, isPrivate) !== null || this.options.plainHosts?.includes(host)) return null;
    const last = this.upgrades.get(tab);
    // The HTTPS page redirected back to the address asked for over HTTP: upgrading it again would go round for ever.
    // A redirect to another http:// address is upgraded too; a chain of them ends at Chromium's limit on redirects,
    // a failure of the last upgrade, which gets the card.
    if (redirected && last && withoutFragment(last.http) === withoutFragment(url)) return { refuse: url };
    this.upgrades.set(tab, { http: url, https: withoutFragment(https) });
    return { redirectURL: https };
  }

  /** A tab's page load is being redirected (main frames only): the next request is that redirect. */
  redirecting(tab: number, to: string): void {
    this.redirects.set(tab, to);
  }

  /** A tab showed a page: whatever it upgraded before is settled. */
  committed(tab: number): void {
    this.upgrades.delete(tab);
    this.redirects.delete(tab);
  }

  /** A tab's page failed to load at this address: the HTTP address it stood for, when it was an upgrade. */
  failedUpgrade(tab: number, url: string): string | null {
    const last = this.upgrades.get(tab);
    return last && last.https === withoutFragment(url) ? last.http : null;
  }

  /**
   * Continuing to a site from the card: an exception until the browser
   * closes (a private tab's until the last private tab closes).
   */
  allowForSession(host: string, isPrivate: boolean): void {
    (isPrivate ? this.privateSession : this.session).add(host);
  }

  /** Ends a site's exception for this run (a lasting one is ended in settings). */
  removeSession(host: string, isPrivate: boolean): void {
    (isPrivate ? this.privateSession : this.session).delete(host);
  }

  /** The normal tabs' exceptions made this run, for Settings. */
  sessionHosts(): string[] {
    return [...this.session].sort();
  }

  /** The last private tab closed: its exceptions go. */
  forgetPrivate(): void {
    this.privateSession.clear();
  }

  forget(tab: number): void {
    this.upgrades.delete(tab);
    this.redirects.delete(tab);
  }
}
