import { MAX_BLOCKED_ITEMS, type BlockedItem, type ShieldReport } from '../../shared/privacy';
import { hostOf } from '../../shared/site';

/** What the shield needs to know about one request. */
export interface RequestInfo {
  url: string;
  /** Chromium's resource type: mainFrame, subFrame, script, image, webSocket, and so on. */
  resourceType: string;
  /** The tab (web page) that made the request. */
  tab: number;
}

/** A request no tab made: a service worker's or a shared worker's. */
export interface UntabbedRequest {
  url: string;
  resourceType: string;
  /** The address the request names as its referrer ('' when it names none): the page, as far as it is known. */
  referrer: string;
}

/** The filter lists' answer for one request. */
export interface MatchResult {
  blocked: boolean;
  /** A harmless stand-in (a data: address) to serve in place of the request. */
  redirect?: string;
}

/** Asks the filter lists about a request; `pageUrl` is the tab's page ('' for a page load itself). */
export type Matcher = (url: string, resourceType: string, pageUrl: string) => MatchResult;

export type Decision = { cancel: true } | { redirectURL: string } | Record<string, never>;

interface TabRecord {
  /** The page the tab is on. */
  pageUrl: string;
  site: string;
  count: number;
  items: BlockedItem[];
}

const withoutHash = (url: string) => url.split('#', 1)[0];

/** What the lists are asked about: web addresses, and WebSockets, which trackers use too (review of 2026-09-30, M3). */
const LISTED_SCHEMES = /^(?:https?|wss?):/i;

/**
 * The privacy shield's decisions, without Electron, so it can be unit
 * tested. For each web page request it asks the filter lists, keeps a
 * per-tab record of what was blocked, and applies the two ways through:
 * "open anyway" (one page address, once, in one tab) and a paused site
 * (nothing blocked while a tab is on it).
 *
 * A tab's record covers the page it shows. A request for a new page
 * starts a record that waits: it becomes the tab's record when the page
 * arrives (committed), and is dropped if it never does, as when a link
 * leads to a download or the server answers "no content" (settled). So
 * the site, the count, and what "pause" offers stay the showing page's
 * (review of 2026-09-30, M8). While a page is on its way, what is blocked
 * counts for the showing page and for the waiting record: a request in
 * that moment can be either page's.
 */
export class Shield {
  private readonly tabs = new Map<number, TabRecord>();
  /** Each tab's page on its way: requested, not yet arrived. */
  private readonly pending = new Map<number, TabRecord>();
  private readonly allowOnce = new Map<number, string>();

  constructor(
    private readonly matcher: () => Matcher | null,
    /** Whether the shield is paused on a site for this tab (private tabs have their own, in-memory choices). */
    private readonly isPaused: (site: string, tab: number) => boolean,
    private readonly onCount: (tab: number, count: number) => void,
    /** A whole page was blocked. Electron drops a cancelled page load without a failure event, so the shell is told. */
    private readonly onPageBlocked: (tab: number, url: string) => void = () => undefined,
  ) {}

  decide(request: RequestInfo): Decision {
    const { url, resourceType, tab } = request;
    if (!LISTED_SCHEMES.test(url)) return {};
    if (resourceType === 'mainFrame') return this.pageLoad(tab, url);

    const record = this.showing(tab);
    const pageUrl = record?.pageUrl ?? '';
    if (record && this.isPaused(record.site, tab)) return {};
    const match = this.matcher()?.(url, resourceType, pageUrl);
    if (!match?.blocked) return {};
    this.record(tab, { url, type: resourceType });
    return match.redirect ? { redirectURL: match.redirect } : { cancel: true };
  }

  /**
   * A request that comes from no tab (a service worker's, say) is asked
   * about like any other, with the address it names as its referrer as
   * the page; until the review of 2026-09-30 (M3) such requests passed
   * unseen. Nothing is counted: there is no tab to count it for.
   */
  decideUntabbed(request: UntabbedRequest, isPaused: (site: string) => boolean): Decision {
    const { url, resourceType, referrer } = request;
    if (!LISTED_SCHEMES.test(url) || resourceType === 'mainFrame') return {};
    if (referrer !== '' && isPaused(hostOf(referrer))) return {};
    return this.matcher()?.(url, resourceType, referrer)?.blocked ? { cancel: true } : {};
  }

  /**
   * A tab arrived at a page. The record that waited for it becomes the
   * tab's; arriving by a way that made no request (history) starts a
   * record afresh, unless the tab is on that page already.
   */
  committed(tab: number, url: string): void {
    const waiting = this.pending.get(tab);
    this.pending.delete(tab);
    if (waiting && withoutHash(waiting.pageUrl) === withoutHash(url)) {
      const before = this.tabs.get(tab)?.count ?? 0;
      this.tabs.set(tab, waiting);
      if (waiting.count !== before) this.onCount(tab, waiting.count);
      return;
    }
    const record = this.tabs.get(tab);
    if (record && withoutHash(record.pageUrl) === withoutHash(url)) return;
    this.fresh(tab, url);
  }

  /** The tab stopped loading: a page still on its way never arrived (a download, "no content", a failed or stopped load). */
  settled(tab: number): void {
    if (this.tabs.has(tab)) this.pending.delete(tab);
  }

  /** "Open anyway": the next load of exactly this address in this tab is let through. */
  allow(tab: number, url: string): void {
    this.allowOnce.set(tab, url);
  }

  report(tab: number): ShieldReport {
    const record = this.showing(tab);
    if (!record) return { site: '', paused: false, count: 0, items: [] };
    return { site: record.site, paused: this.isPaused(record.site, tab), count: record.count, items: [...record.items] };
  }

  forget(tab: number): void {
    this.tabs.delete(tab);
    this.pending.delete(tab);
    this.allowOnce.delete(tab);
  }

  /** The record of the page the tab shows; for a new tab, of its first page on its way. */
  private showing(tab: number): TabRecord | undefined {
    return this.tabs.get(tab) ?? this.pending.get(tab);
  }

  private pageLoad(tab: number, url: string): Decision {
    const record: TabRecord = { pageUrl: url, site: hostOf(url), count: 0, items: [] };
    this.pending.set(tab, record);
    if (this.allowOnce.get(tab) === url) {
      this.allowOnce.delete(tab);
      return {};
    }
    if (this.isPaused(record.site, tab)) return {};
    const match = this.matcher()?.(url, 'mainFrame', '');
    if (!match?.blocked) return {};
    // A blocked page never arrives: the tab shows the blocked card for this
    // address, so the record is the tab's at once.
    this.pending.delete(tab);
    this.tabs.set(tab, record);
    this.record(tab, { url, type: 'mainFrame' });
    this.onPageBlocked(tab, url);
    return { cancel: true };
  }

  private fresh(tab: number, url: string): TabRecord {
    const had = (this.tabs.get(tab)?.count ?? 0) > 0;
    const record: TabRecord = { pageUrl: url, site: hostOf(url), count: 0, items: [] };
    this.tabs.set(tab, record);
    if (had) this.onCount(tab, 0);
    return record;
  }

  private record(tab: number, item: BlockedItem): void {
    const record = this.showing(tab) ?? this.fresh(tab, '');
    const waiting = this.pending.get(tab);
    for (const r of waiting && waiting !== record ? [record, waiting] : [record]) {
      r.count += 1;
      r.items.push(item);
      if (r.items.length > MAX_BLOCKED_ITEMS) r.items.shift();
    }
    this.onCount(tab, record.count);
  }
}
