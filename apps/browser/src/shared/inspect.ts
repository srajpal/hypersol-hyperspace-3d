/**
 * The instrument panel's requests (milestone 7): live readouts about the
 * page in front and the browser, answered by the main process
 * (main/inspect/). Every request is checked with parseInspectRequest.
 * Everything here is kept in memory only, per tab.
 */

export const INSPECT_CHANNEL = 'hypersol:inspect';

export interface NetEntry {
  /** The request's number in its tab (its identity in the list). */
  seq: number;
  /** Increases whenever any request in the tab starts or finishes, so the shell can ask for what changed. */
  rev: number;
  url: string;
  /** Chromium's resource type: mainFrame, script, image, xhr, and so on. */
  type: string;
  method: string;
  /** HTTP status; 0 while waiting or when it failed. */
  status: number;
  /** Response size from its content-length, or -1 when the server did not say. */
  bytes: number;
  fromCache: boolean;
  /** Milliseconds from start to finish; -1 while waiting. */
  ms: number;
  blocked: boolean;
  /** Chromium's error name when it failed (net::ERR_...), else ''. */
  error: string;
}

export type ConsoleLevel = 'debug' | 'info' | 'warning' | 'error';

export interface ConsoleEntry {
  seq: number;
  level: ConsoleLevel;
  message: string;
  /** Where it came from: the script's address and line. */
  source: string;
  line: number;
  /** Milliseconds since 1970. */
  at: number;
}

export interface CertInfo {
  host: string;
  subject: string;
  issuer: string;
  /** Seconds since 1970, as Chromium reports it. */
  validExpiry: number;
  /** Chromium's verdict: 'OK' or an error like 'CERT_DATE_INVALID'. */
  verification: string;
}

export interface PageReadout {
  url: string;
  secure: boolean;
  /** Milliseconds from the start of the page load to its end; -1 while loading. */
  loadMs: number;
  requests: number;
  /** Bytes the page's responses declared (content-length). */
  bytes: number;
  blocked: number;
  failed: number;
  /** The certificate for the page's host, when it was fetched over HTTPS in this run. */
  cert: CertInfo | null;
  /** The page's own process, when known. */
  cpuPercent: number;
  memoryKB: number;
}

export interface BrowserReadout {
  /** The whole browser: every process's working set. */
  memoryKB: number;
  processes: number;
  cpuPercent: number;
  /** Seconds since the app started. */
  uptime: number;
}

export interface InspectSnapshot {
  page: PageReadout;
  /** New since the numbers the shell asked with (at most MAX_BATCH each). */
  net: NetEntry[];
  console: ConsoleEntry[];
  /** Set when the page changed since last asked: the shell starts its lists afresh. */
  reset: boolean;
  browser: BrowserReadout;
}

/** One element of a HoloML scene, for the instrument panel's Scene part (milestone 15, GitHub issue #28). */
export interface SceneEntry {
  index: number;
  kind: string;
  name: string;
  depth: number;
  line: number;
  column: number;
  /** For models: loaded, left-out, refused, failed, loading. */
  state?: string;
  reason?: string;
}

export interface SceneDetail {
  line: number;
  column: number;
  /** That line of the page's text. */
  source: string;
  bounds: [number[], number[]] | null;
  position: number[];
  /** In degrees. */
  rotation: number[];
  scale: number[];
  triangles: number | null;
  pictures: { width: number; height: number }[];
}

export interface SceneReadout {
  title: string;
  /** All the scene's elements; entries holds the first of them. */
  entryCount: number;
  entries: SceneEntry[];
  selected: number;
  picking: boolean;
  detail: SceneDetail | null;
  problems: { code: string; message: string; line: number; column: number }[];
  error: { code: string; message: string; line: number; column: number } | null;
  models: { src: string; state: string; reason?: string; bytes?: number; triangles?: number }[];
  totals: { bytes: number; triangles: number };
  leftOutElements: number;
}

export type InspectRequest =
  /** sinceNet is the last request `rev` seen; sinceConsole the last console `seq`. */
  | { op: 'inspect.snapshot'; tab: number; sinceNet: number; sinceConsole: number }
  | { op: 'inspect.clear-console'; tab: number }
  | { op: 'inspect.devtools'; tab: number }
  /** A HoloML page's scene (null for other pages). */
  | { op: 'inspect.scene'; tab: number }
  | { op: 'inspect.scene-select'; tab: number; index: number }
  | { op: 'inspect.scene-pick'; tab: number; on: boolean };

export interface InspectResults {
  'inspect.snapshot': InspectSnapshot;
  'inspect.clear-console': null;
  'inspect.devtools': null;
  'inspect.scene': SceneReadout | null;
  'inspect.scene-select': null;
  'inspect.scene-pick': null;
}

export type InspectOp = InspectRequest['op'];
export type InspectReply<K extends InspectOp> = { ok: true; value: InspectResults[K] } | { ok: false; error: string };

/** Most requests and console messages kept per tab. */
export const MAX_ENTRIES = 300;
/**
 * Most requests followed while still waiting for an answer, per tab
 * (GitHub issue #13). Beyond this the oldest waiting one is no longer
 * followed: it stays counted, but its end is not recorded.
 */
export const MAX_PENDING = 300;
/** Most certificates remembered (per host), for normal and for private tabs each. */
export const MAX_CERTS = 500;
/** Most entries sent in one snapshot. */
export const MAX_BATCH = 100;

const isTabId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isSeq = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

export function parseInspectRequest(raw: unknown): { request: InspectRequest } | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'Not a request' };
  const r = raw as Record<string, unknown>;
  const op = r['op'];
  if (
    op !== 'inspect.snapshot' &&
    op !== 'inspect.clear-console' &&
    op !== 'inspect.devtools' &&
    op !== 'inspect.scene' &&
    op !== 'inspect.scene-select' &&
    op !== 'inspect.scene-pick'
  ) {
    return { error: `Unknown request: ${String(op)}` };
  }
  if (!isTabId(r['tab'])) return { error: `${op}: tab must be a tab id` };
  if (op === 'inspect.snapshot') {
    if (!isSeq(r['sinceNet']) || !isSeq(r['sinceConsole'])) return { error: `${op}: since must be a whole number` };
    return { request: { op, tab: r['tab'], sinceNet: r['sinceNet'], sinceConsole: r['sinceConsole'] } };
  }
  if (op === 'inspect.scene-select') {
    const index = r['index'];
    if (!Number.isInteger(index) || (index as number) < -1 || (index as number) > 100_000) return { error: `${op}: index must be a whole number` };
    return { request: { op, tab: r['tab'], index: index as number } };
  }
  if (op === 'inspect.scene-pick') {
    if (typeof r['on'] !== 'boolean') return { error: `${op}: on must be true or false` };
    return { request: { op, tab: r['tab'], on: r['on'] } };
  }
  return { request: { op, tab: r['tab'] } };
}

// ---- Reading a scene from a page (the page's own facts: checked, never trusted)

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v: unknown, lo: number, hi: number): number => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : lo);
const fin = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const vec = (v: unknown): number[] => (Array.isArray(v) ? v.slice(0, 3).map(fin) : [0, 0, 0]);
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});
const where = (v: unknown) => {
  const o = obj(v);
  return { code: str(o['code'], 60), message: str(o['message'], 300), line: int(o['line'], 1, 10_000_000), column: int(o['column'], 1, 10_000_000) };
};

/** A scene readout as the page gave it, reduced to known fields and sizes; null if it is not one. */
export function parseSceneReadout(raw: unknown): SceneReadout | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = obj(raw);
  const d = r['detail'] === null || r['detail'] === undefined ? null : obj(r['detail']);
  const bounds = d && Array.isArray(d['bounds']) && d['bounds'].length === 2 ? ([vec(d['bounds'][0]), vec(d['bounds'][1])] as [number[], number[]]) : null;
  return {
    title: str(r['title'], 200),
    entryCount: int(r['entryCount'], 0, 10_000_000),
    entries: list(r['entries'], 2_000).map((e) => {
      const o = obj(e);
      return {
        index: int(o['index'], 0, 100_000),
        kind: str(o['kind'], 20),
        name: str(o['name'], 200),
        depth: int(o['depth'], 0, 300),
        line: int(o['line'], 1, 10_000_000),
        column: int(o['column'], 1, 10_000_000),
        ...(typeof o['state'] === 'string' ? { state: str(o['state'], 20) } : {}),
        ...(typeof o['reason'] === 'string' ? { reason: str(o['reason'], 300) } : {}),
      };
    }),
    selected: int(r['selected'], -1, 100_000),
    picking: r['picking'] === true,
    detail: d
      ? {
          line: int(d['line'], 1, 10_000_000),
          column: int(d['column'], 1, 10_000_000),
          source: str(d['source'], 500),
          bounds,
          position: vec(d['position']),
          rotation: vec(d['rotation']),
          scale: vec(d['scale']),
          triangles: d['triangles'] === null ? null : int(d['triangles'], 0, 1e12),
          pictures: list(d['pictures'], 64).map((p) => ({ width: int(obj(p)['width'], 0, 1e6), height: int(obj(p)['height'], 0, 1e6) })),
        }
      : null,
    problems: list(r['problems'], 1000).map(where),
    error: r['error'] ? where(r['error']) : null,
    models: list(r['models'], 1000).map((m) => {
      const o = obj(m);
      return {
        src: str(o['src'], 300),
        state: str(o['state'], 20),
        ...(typeof o['reason'] === 'string' ? { reason: str(o['reason'], 300) } : {}),
        ...(typeof o['bytes'] === 'number' ? { bytes: int(o['bytes'], 0, 1e12) } : {}),
        ...(typeof o['triangles'] === 'number' ? { triangles: int(o['triangles'], 0, 1e12) } : {}),
      };
    }),
    totals: { bytes: int(obj(r['totals'])['bytes'], 0, 1e12), triangles: int(obj(r['totals'])['triangles'], 0, 1e12) },
    leftOutElements: int(r['leftOutElements'], 0, 10_000_000),
  };
}
