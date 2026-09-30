import {
  MAX_BATCH,
  MAX_CERTS,
  MAX_ENTRIES,
  MAX_PENDING,
  type CertInfo,
  type ConsoleEntry,
  type ConsoleLevel,
  type NetEntry,
  type PageReadout,
} from '../../shared/inspect';

interface TabRecord {
  url: string;
  /** Counts page loads: the shell starts its lists afresh when it changes. */
  page: number;
  startedAt: number;
  finishedAt: number;
  net: NetEntry[];
  /** Requests still waiting, by Chromium's request id. */
  waiting: Map<number, { entry: NetEntry; at: number }>;
  console: ConsoleEntry[];
  totals: { requests: number; bytes: number; blocked: number; failed: number };
}

/** A tab's numbers, which keep rising from page to page. */
interface Numbers {
  page: number;
  netSeq: number;
  netRev: number;
  consoleSeq: number;
}

const withoutHash = (url: string) => url.split('#', 1)[0];

const BLOCKED = 'net::ERR_BLOCKED_BY_CLIENT';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** A response's declared size, or -1. */
export function declaredBytes(headers: Record<string, string[]> | undefined): number {
  if (!headers) return -1;
  for (const [name, values] of Object.entries(headers)) {
    if (name.toLowerCase() === 'content-length') {
      const n = Number(values[0]);
      return Number.isFinite(n) && n >= 0 ? n : -1;
    }
  }
  return -1;
}

/**
 * What the instrument panel shows about each tab's page (milestone 7):
 * its requests, console messages, and load time, from events the main
 * process already sees. No Electron imports, so it can be unit tested.
 * In memory only, capped, and forgotten when the tab closes.
 *
 * A tab's record covers the page it shows. A request for a new page
 * starts a record that waits: it becomes the tab's record when the page
 * arrives (pageCommitted), and is dropped if it never does, as when a
 * link leads to a download (pageFinished). Until the review of 2026-09-30
 * (M8) the record changed at the request, so a download link emptied the
 * showing page's readouts. While a page is on its way, requests are kept
 * for the showing page and for the waiting record: a request in that
 * moment can be either page's.
 */
export class PageMonitor {
  private readonly tabs = new Map<number, TabRecord>();
  /** Each tab's page on its way: requested, not yet arrived. */
  private readonly pending = new Map<number, TabRecord>();
  private readonly numbers = new Map<number, Numbers>();
  private readonly certs = new Map<string, CertInfo>();
  /** Certificates checked for private tabs: kept apart, forgotten with the last private tab. */
  private readonly privateCerts = new Map<string, CertInfo>();

  private numbersOf(tab: number): Numbers {
    let n = this.numbers.get(tab);
    if (!n) this.numbers.set(tab, (n = { page: 0, netSeq: 0, netRev: 0, consoleSeq: 0 }));
    return n;
  }

  private newRecord(tab: number, url: string, at: number): TabRecord {
    const n = this.numbersOf(tab);
    n.page += 1;
    return { url, page: n.page, startedAt: at, finishedAt: -1, net: [], waiting: new Map(), console: [], totals: { requests: 0, bytes: 0, blocked: 0, failed: 0 } };
  }

  /** The record of the page the tab shows; for a new tab, of its first page on its way. */
  private showing(tab: number): TabRecord | undefined {
    return this.tabs.get(tab) ?? this.pending.get(tab);
  }

  /** The showing page's record and the waiting one, when both exist. */
  private records(tab: number): TabRecord[] {
    const shown = this.showing(tab);
    const waiting = this.pending.get(tab);
    return shown ? (waiting && waiting !== shown ? [shown, waiting] : [shown]) : [];
  }

  /** A tab starts loading a page (its main-frame request): the page's record waits for it to arrive. */
  pageStart(tab: number, url: string, at: number): void {
    this.pending.set(tab, this.newRecord(tab, url, at));
  }

  /** The tab arrived at a page: the record that waited for it becomes the tab's (a new one, if it came without a request). */
  pageCommitted(tab: number, url: string, at: number): void {
    const waiting = this.pending.get(tab);
    this.pending.delete(tab);
    if (waiting && withoutHash(waiting.url) === withoutHash(url)) {
      this.tabs.set(tab, waiting);
      return;
    }
    const shown = this.tabs.get(tab);
    if (shown && withoutHash(shown.url) === withoutHash(url)) return;
    this.tabs.set(tab, this.newRecord(tab, url, at));
  }

  /** The tab stopped loading. A page still on its way never arrived (a download, "no content", a failed or stopped load). */
  pageFinished(tab: number, at: number): void {
    if (this.tabs.has(tab)) this.pending.delete(tab);
    const r = this.showing(tab);
    if (r && r.finishedAt < 0) r.finishedAt = at;
  }

  request(tab: number, id: number, url: string, type: string, method: string, at: number): void {
    if (type === 'mainFrame') this.pageStart(tab, url, at);
    const records = this.records(tab);
    if (records.length === 0) return;
    const n = this.numbersOf(tab);
    n.netSeq += 1;
    n.netRev += 1;
    const entry: NetEntry = { seq: n.netSeq, rev: n.netRev, url, type, method, status: 0, bytes: -1, fromCache: false, ms: -1, blocked: false, error: '' };
    for (const r of records) {
      r.net.push(entry);
      if (r.net.length > MAX_ENTRIES) r.net.shift();
      r.waiting.set(id, { entry, at });
      // Bounded like the list (GitHub issue #13): the oldest waiting request is no longer followed.
      if (r.waiting.size > MAX_PENDING) r.waiting.delete(r.waiting.keys().next().value!);
      r.totals.requests += 1;
    }
  }

  /** Settles a waiting request in every record that follows it; `update` changes its entry, once. */
  private settle(tab: number, id: number, at: number, update: (entry: NetEntry) => void, count: (r: TabRecord) => void): void {
    let entry: NetEntry | undefined;
    for (const r of this.records(tab)) {
      const w = r.waiting.get(id);
      if (!w) continue;
      r.waiting.delete(id);
      if (!entry) {
        entry = w.entry;
        const n = this.numbersOf(tab);
        n.netRev += 1;
        Object.assign(entry, { ms: Math.max(0, Math.round(at - w.at)), rev: n.netRev });
        update(entry);
      }
      count(r);
    }
  }

  completed(tab: number, id: number, status: number, bytes: number, fromCache: boolean, at: number): void {
    this.settle(
      tab,
      id,
      at,
      (entry) => Object.assign(entry, { status, bytes, fromCache }),
      (r) => {
        if (bytes > 0) r.totals.bytes += bytes;
      },
    );
  }

  failed(tab: number, id: number, error: string, at: number): void {
    const blocked = error === BLOCKED;
    this.settle(
      tab,
      id,
      at,
      (entry) => Object.assign(entry, { error, blocked }),
      (r) => {
        if (blocked) r.totals.blocked += 1;
        else r.totals.failed += 1;
      },
    );
  }

  console(tab: number, level: ConsoleLevel, message: string, source: string, line: number, at: number): void {
    const r = this.showing(tab);
    if (!r) return;
    const n = this.numbersOf(tab);
    n.consoleSeq += 1;
    r.console.push({ seq: n.consoleSeq, level, message: message.slice(0, 2000), source: source.slice(0, 500), line, at });
    if (r.console.length > MAX_ENTRIES) r.console.shift();
  }

  clearConsole(tab: number): void {
    const r = this.showing(tab);
    if (r) r.console = [];
  }

  /** Records the certificate Chromium checked for a host (the verdict itself is left to Chromium). */
  certificate(info: CertInfo, isPrivate = false): void {
    const certs = isPrivate ? this.privateCerts : this.certs;
    certs.delete(info.host.toLowerCase());
    certs.set(info.host.toLowerCase(), info);
    if (certs.size > MAX_CERTS) certs.delete(certs.keys().next().value!);
  }

  /** The last private tab closed: what was checked for private tabs goes. */
  forgetPrivateCerts(): void {
    this.privateCerts.clear();
  }

  /** How many requests a tab is still following (for tests of the bound). */
  pendingCount(tab: number): number {
    return this.showing(tab)?.waiting.size ?? 0;
  }

  forget(tab: number): void {
    this.tabs.delete(tab);
    this.pending.delete(tab);
    this.numbers.delete(tab);
  }

  /** The page's readout and what changed since the given numbers; `pageNumber` tells the shell when to start afresh. */
  snapshot(tab: number, sinceNet: number, sinceConsole: number, isPrivate = false): {
    page: Omit<PageReadout, 'cpuPercent' | 'memoryKB'>;
    pageNumber: number;
    net: NetEntry[];
    console: ConsoleEntry[];
  } {
    const r = this.showing(tab);
    if (!r) {
      return {
        page: { url: '', secure: false, loadMs: -1, requests: 0, bytes: 0, blocked: 0, failed: 0, cert: null },
        pageNumber: 0,
        net: [],
        console: [],
      };
    }
    const secure = r.url.startsWith('https:');
    return {
      page: {
        url: r.url,
        secure,
        loadMs: r.finishedAt < 0 ? -1 : Math.round(r.finishedAt - r.startedAt),
        ...r.totals,
        cert: secure ? ((isPrivate ? this.privateCerts : this.certs).get(hostOf(r.url)) ?? null) : null,
      },
      pageNumber: r.page,
      // Oldest changes first, so a long list arrives over a few snapshots.
      net: r.net.filter((e) => e.rev > sinceNet).sort((a, b) => a.rev - b.rev).slice(0, MAX_BATCH),
      console: r.console.filter((e) => e.seq > sinceConsole).slice(0, MAX_BATCH),
    };
  }
}
