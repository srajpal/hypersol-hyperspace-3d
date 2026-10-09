/**
 * Requests the shell may make about the privacy shield, filter lists, and
 * encrypted DNS, answered by the main process (main/privacy/). Every
 * request is checked with parsePrivacyRequest before anything happens.
 */
import { isHostName } from './settings';

export const PRIVACY_CHANNEL = 'hypersol:privacy';

/** One request the shield stopped on a page. */
export interface BlockedItem {
  url: string;
  /** Chromium's resource type: script, image, subFrame, mainFrame, and so on. */
  type: string;
}

export interface ShieldReport {
  /** Host name of the tab's page, or '' for none. */
  site: string;
  paused: boolean;
  /** Everything blocked on the page, including any beyond the listed items. */
  count: number;
  /** The most recent blocked requests (at most MAX_BLOCKED_ITEMS). */
  items: BlockedItem[];
}

export interface FilterStatus {
  /** Where the lists in use came from. */
  source: 'starter' | 'downloaded';
  /** When the lists in use were built (milliseconds since 1970). */
  updatedAt: number;
  refreshing: boolean;
  /** Plain words about the last refresh that failed, if the latest one failed. */
  lastError?: string;
}

export interface DnsStatus {
  /** The resolver's address. */
  resolver: string;
  /** What is in effect now: the setting, unless "use this network's DNS" was chosen for this session. */
  effective: 'secure' | 'automatic';
  networkForSession: boolean;
}

export type PrivacyRequest =
  | { op: 'shield.report'; tab: number }
  | { op: 'shield.allow-once'; tab: number; url: string }
  /** The tab tells which session the choice belongs to: a private tab's is kept in memory only. */
  | { op: 'shield.pause'; tab: number; site: string; paused: boolean }
  | { op: 'filters.status' }
  | { op: 'filters.update' }
  | { op: 'dns.status' }
  | { op: 'dns.check' }
  | { op: 'dns.use-network' }
  /** The shell's last private tab closed (blank ones included): private data and choices go (PR #16 review). */
  | { op: 'private.ended' }
  /**
   * HTTPS-only (milestone 26, issue #24): a tab's page failed to load at
   * this https:// address; was it an upgrade (the answer is the http://
   * address it stood for, or null)?
   */
  | { op: 'https-only.failure'; tab: number; url: string }
  /** Continue to a site from the card: an exception until the browser closes, then the tab loads it. */
  | { op: 'https-only.continue'; tab: number; url: string }
  /** The site of a tab's page, for its site panel. */
  | { op: 'https-only.site'; tab: number }
  /** A site's exception, set on purpose: from a tab's site panel (its session), or from Settings (tab null: normal tabs). */
  | { op: 'https-only.set'; tab: number | null; host: string; exception: 'none' | 'session' | 'lasting' }
  /** The normal tabs' exceptions until the browser closes, for Settings. */
  | { op: 'https-only.sessions' }
  /** Per-site storage (milestone 26, issue #26): the sites that keep data in the normal profile. */
  | { op: 'sites.list' }
  /** Clears one site's cookies, site storage, and cached files, and reloads its open tabs. */
  | { op: 'sites.clear'; host: string };

export interface PrivacyResults {
  'shield.report': ShieldReport;
  'shield.allow-once': null;
  'shield.pause': null;
  'filters.status': FilterStatus;
  'filters.update': FilterStatus;
  'dns.status': DnsStatus;
  /** 'blocked' when the encrypted DNS resolver cannot be reached from this network. */
  'dns.check': 'reachable' | 'blocked' | 'not-secure';
  'dns.use-network': DnsStatus;
  'private.ended': null;
  'https-only.failure': string | null;
  'https-only.continue': null;
  'https-only.site': HttpsOnlySite;
  'https-only.set': null;
  'https-only.sessions': string[];
  'sites.list': SiteEntry[];
  'sites.clear': null;
}

/** A site that keeps data in the normal profile (milestone 26), by host name. */
export interface SiteEntry {
  host: string;
  /** Its cookies (those set for this host), and their names' and values' size in bytes. */
  cookies: number;
  cookieBytes: number;
  /** Normal tabs open on it. */
  openTabs: number;
  /** Listed sites above it, whose cookies it also receives (they stay when it is cleared). */
  parents: string[];
}

/** HTTPS-only for the site of a tab's page (milestone 26). */
export interface HttpsOnlySite {
  /** The page's host name, or '' for none (a blank tab, a page of the browser's own). */
  host: string;
  /** The page is shown over plain HTTP. */
  http: boolean;
  /** Whether the setting is on. */
  on: boolean;
  /** Its exception: until the browser closes, kept, or none. */
  exception: 'session' | 'lasting' | null;
  /** A private tab: its exceptions are its own, in memory, and none is kept. */
  private: boolean;
}

export type PrivacyOp = PrivacyRequest['op'];
export type PrivacyReply<K extends PrivacyOp> = { ok: true; value: PrivacyResults[K] } | { ok: false; error: string };

export const MAX_BLOCKED_ITEMS = 200;

const isTabId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isWebUrl = (v: unknown): v is string => typeof v === 'string' && v.length <= 8192 && /^https?:\/\//i.test(v);

/** Checks a request from the shell. Returns the request, or why it was refused. */
export function parsePrivacyRequest(raw: unknown): { request: PrivacyRequest } | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'Not a request' };
  const r = raw as Record<string, unknown>;
  const bad = (why: string) => ({ error: `${String(r['op'])}: ${why}` });
  switch (r['op']) {
    case 'filters.status':
    case 'filters.update':
    case 'https-only.sessions':
    case 'sites.list':
    case 'dns.status':
    case 'dns.check':
    case 'dns.use-network':
    case 'private.ended':
      return { request: { op: r['op'] } };
    case 'shield.report':
      if (!isTabId(r['tab'])) return bad('tab must be a tab id');
      return { request: { op: 'shield.report', tab: r['tab'] } };
    case 'shield.allow-once':
      if (!isTabId(r['tab'])) return bad('tab must be a tab id');
      if (!isWebUrl(r['url'])) return bad('url must be a web address');
      return { request: { op: 'shield.allow-once', tab: r['tab'], url: r['url'] } };
    case 'shield.pause':
      if (!isTabId(r['tab'])) return bad('tab must be a tab id');
      if (!isHostName(r['site'])) return bad('site must be a host name');
      if (typeof r['paused'] !== 'boolean') return bad('paused must be true or false');
      return { request: { op: 'shield.pause', tab: r['tab'], site: r['site'].toLowerCase(), paused: r['paused'] } };
    case 'https-only.failure':
    case 'https-only.continue':
      if (!isTabId(r['tab'])) return bad('tab must be a tab id');
      if (!isWebUrl(r['url'])) return bad('url must be a web address');
      return { request: { op: r['op'], tab: r['tab'], url: r['url'] } };
    case 'sites.clear':
      if (!isHostName(r['host'])) return bad('host must be a host name');
      return { request: { op: 'sites.clear', host: r['host'].toLowerCase() } };
    case 'https-only.site':
      if (!isTabId(r['tab'])) return bad('tab must be a tab id');
      return { request: { op: 'https-only.site', tab: r['tab'] } };
    case 'https-only.set': {
      const tab = r['tab'];
      if (tab !== null && !isTabId(tab)) return bad('tab must be a tab id or null');
      if (!isHostName(r['host'])) return bad('host must be a host name');
      const exception = r['exception'];
      if (exception !== 'none' && exception !== 'session' && exception !== 'lasting') return bad('exception must be none, session, or lasting');
      return { request: { op: 'https-only.set', tab, host: r['host'].toLowerCase(), exception } };
    }
    default:
      return { error: `Unknown request: ${String(r['op'])}` };
  }
}
