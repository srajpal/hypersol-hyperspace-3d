/**
 * Requests the shell may make for saved data, answered by the main
 * process (main/storage/service.ts). Every request is checked there with
 * parseDataRequest before anything is read or written.
 */
import type { Settings, SettingsPatch } from './settings';

export const DATA_CHANNEL = 'hypersol:data';

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  favicon: string | null;
  createdAt: number;
}

export interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  visitedAt: number;
}

/** One of the address bar's suggestions (milestone 11). */
export interface Suggestion {
  url: string;
  title: string;
  kind: 'history' | 'bookmark';
}

/** What the address bar offers for typed text: an address to complete to (its key and its real address) and the list. */
export interface Suggestions {
  inline: { key: string; url: string } | null;
  items: Suggestion[];
}

export interface SavedSession {
  tabs: string[];
  focused: number;
}

export type DataRequest =
  | { op: 'status' }
  | { op: 'bookmarks.list' }
  | { op: 'bookmarks.has'; url: string }
  | { op: 'bookmarks.add'; url: string; title: string; favicon: string | null }
  | { op: 'bookmarks.remove'; url: string }
  | { op: 'history.search'; query: string; limit: number }
  | { op: 'history.recent'; limit: number }
  | { op: 'history.delete'; id: number }
  | { op: 'history.clear' }
  | { op: 'history.suggest'; text: string; limit: number }
  | { op: 'history.forget-url'; url: string }
  | { op: 'settings.get' }
  /** A change to settings; what it may hold is checked when it is applied (shared/settings.ts). */
  | { op: 'settings.set'; patch: SettingsPatch }
  | { op: 'session.save'; tabs: string[]; focused: number }
  | { op: 'startup' }
  | { op: 'data.clear'; history: boolean; cookies: boolean; cache: boolean; passwords?: boolean };

export interface DataResults {
  /** message: why history and bookmarks are unavailable; settingsProblem: why saved settings are not in use. */
  status: { available: boolean; message?: string; settingsProblem?: string };
  'bookmarks.list': Bookmark[];
  'bookmarks.has': boolean;
  'bookmarks.add': Bookmark | null;
  'bookmarks.remove': null;
  'history.search': HistoryEntry[];
  'history.recent': HistoryEntry[];
  'history.delete': null;
  'history.clear': null;
  'history.suggest': Suggestions;
  'history.forget-url': null;
  'settings.get': Settings;
  'settings.set': Settings;
  'session.save': null;
  /** Tabs to reopen, when the startup setting asks for them. */
  startup: SavedSession | null;
  'data.clear': null;
}

export type DataOp = DataRequest['op'];

/** Every reply is either a value or a plain-language error. */
export type DataReply<K extends DataOp> = { ok: true; value: DataResults[K] } | { ok: false; error: string };

const MAX_URL = 8192;
const MAX_TEXT = 1024;
const MAX_FAVICON = 64 * 1024;
const MAX_TABS = 500;

const isWebUrl = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= MAX_URL && /^https?:\/\//i.test(v);
const isText = (v: unknown, max = MAX_TEXT): v is string => typeof v === 'string' && v.length <= max;
const isCount = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
const isFlag = (v: unknown): v is boolean => typeof v === 'boolean';

/** Checks a request from the shell. Returns the request, or why it was refused. */
export function parseDataRequest(raw: unknown): { request: DataRequest } | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'Not a request' };
  const r = raw as Record<string, unknown>;
  const bad = (why: string) => ({ error: `${String(r['op'])}: ${why}` });
  switch (r['op']) {
    case 'status':
    case 'bookmarks.list':
    case 'history.clear':
    case 'settings.get':
    case 'startup':
      return { request: { op: r['op'] } };
    case 'bookmarks.has':
    case 'bookmarks.remove':
      if (!isWebUrl(r['url'])) return bad('url must be a web address');
      return { request: { op: r['op'], url: r['url'] } };
    case 'bookmarks.add': {
      if (!isWebUrl(r['url'])) return bad('url must be a web address');
      if (!isText(r['title'])) return bad('title must be text');
      const favicon = r['favicon'];
      if (favicon !== null && !(isText(favicon, MAX_FAVICON) && favicon.startsWith('data:image/'))) {
        return bad('favicon must be an image data address or null');
      }
      return { request: { op: 'bookmarks.add', url: r['url'], title: r['title'], favicon } };
    }
    case 'history.search':
      if (!isText(r['query'])) return bad('query must be text');
      if (!isCount(r['limit'], 1000)) return bad('limit must be 0 to 1000');
      return { request: { op: 'history.search', query: r['query'], limit: r['limit'] } };
    case 'history.recent':
      if (!isCount(r['limit'], 1000)) return bad('limit must be 0 to 1000');
      return { request: { op: 'history.recent', limit: r['limit'] } };
    case 'history.suggest':
      if (!isText(r['text'], 2048)) return bad('text must be text');
      if (!isCount(r['limit'], 20)) return bad('limit must be 0 to 20');
      return { request: { op: 'history.suggest', text: r['text'], limit: r['limit'] } };
    case 'history.forget-url':
      if (!isWebUrl(r['url'])) return bad('url must be a web address');
      return { request: { op: 'history.forget-url', url: r['url'] } };
    case 'history.delete':
      if (!isCount(r['id'], Number.MAX_SAFE_INTEGER)) return bad('id must be a whole number');
      return { request: { op: 'history.delete', id: r['id'] } };
    case 'settings.set':
      if (typeof r['patch'] !== 'object' || r['patch'] === null) return bad('patch must be an object');
      return { request: { op: 'settings.set', patch: r['patch'] as SettingsPatch } };
    case 'session.save': {
      const tabs = r['tabs'];
      if (!Array.isArray(tabs) || tabs.length > MAX_TABS || !tabs.every(isWebUrl)) {
        return bad('tabs must be a list of web addresses');
      }
      if (!Number.isInteger(r['focused']) || (r['focused'] as number) < -1 || (r['focused'] as number) >= tabs.length) {
        return bad('focused must point at one of the tabs, or be -1');
      }
      return { request: { op: 'session.save', tabs, focused: r['focused'] as number } };
    }
    case 'data.clear':
      if (!isFlag(r['history']) || !isFlag(r['cookies']) || !isFlag(r['cache'])) return bad('choices must be true or false');
      if (r['passwords'] !== undefined && !isFlag(r['passwords'])) return bad('choices must be true or false');
      return {
        request: { op: 'data.clear', history: r['history'], cookies: r['cookies'], cache: r['cache'], passwords: r['passwords'] === true },
      };
    default:
      return { error: `Unknown request: ${String(r['op'])}` };
  }
}
