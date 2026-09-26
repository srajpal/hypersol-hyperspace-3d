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
  | { op: 'private.ended' };

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
    default:
      return { error: `Unknown request: ${String(r['op'])}` };
  }
}
