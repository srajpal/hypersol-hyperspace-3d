import { MAX_BLOCKED_ITEMS, type BlockedItem, type ShieldReport } from '../../shared/privacy';

/** What the shield needs to know about one request. */
export interface RequestInfo {
  url: string;
  /** Chromium's resource type: mainFrame, subFrame, script, image, and so on. */
  resourceType: string;
  /** The tab (web page) that made the request. */
  tab: number;
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
  /** The page the tab is on, or loading. */
  pageUrl: string;
  site: string;
  count: number;
  items: BlockedItem[];
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

const withoutHash = (url: string) => url.split('#', 1)[0];

/**
 * The privacy shield's decisions, without Electron, so it can be unit
 * tested. For each web page request it asks the filter lists, keeps a
 * per-tab record of what was blocked, and applies the two ways through:
 * "open anyway" (one page address, once, in one tab) and a paused site
 * (nothing blocked while a tab is on it). Page loads start a fresh
 * record, so a tab's count covers its current page.
 */
export class Shield {
  private readonly tabs = new Map<number, TabRecord>();
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
    if (!/^https?:/i.test(url)) return {};
    if (resourceType === 'mainFrame') return this.pageLoad(tab, url);

    const record = this.tabs.get(tab);
    const pageUrl = record?.pageUrl ?? '';
    if (record && this.isPaused(record.site, tab)) return {};
    const match = this.matcher()?.(url, resourceType, pageUrl);
    if (!match?.blocked) return {};
    this.record(tab, { url, type: resourceType });
    return match.redirect ? { redirectURL: match.redirect } : { cancel: true };
  }

  /** A tab arrived at a page by a way that made no request (history, same page): start its record afresh if it changed. */
  committed(tab: number, url: string): void {
    const record = this.tabs.get(tab);
    if (record && withoutHash(record.pageUrl) === withoutHash(url)) return;
    this.fresh(tab, url);
  }

  /** "Open anyway": the next load of exactly this address in this tab is let through. */
  allow(tab: number, url: string): void {
    this.allowOnce.set(tab, url);
  }

  report(tab: number): ShieldReport {
    const record = this.tabs.get(tab);
    if (!record) return { site: '', paused: false, count: 0, items: [] };
    return { site: record.site, paused: this.isPaused(record.site, tab), count: record.count, items: [...record.items] };
  }

  forget(tab: number): void {
    this.tabs.delete(tab);
    this.allowOnce.delete(tab);
  }

  private pageLoad(tab: number, url: string): Decision {
    const record = this.fresh(tab, url);
    if (this.allowOnce.get(tab) === url) {
      this.allowOnce.delete(tab);
      return {};
    }
    if (this.isPaused(record.site, tab)) return {};
    const match = this.matcher()?.(url, 'mainFrame', '');
    if (!match?.blocked) return {};
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
    const record = this.tabs.get(tab) ?? this.fresh(tab, '');
    record.count += 1;
    record.items.push(item);
    if (record.items.length > MAX_BLOCKED_ITEMS) record.items.shift();
    this.onCount(tab, record.count);
  }
}
