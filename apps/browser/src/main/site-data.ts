/**
 * Per-site storage (milestone 26, GitHub issue #26; owner, prompt 178):
 * the sites that keep data in the normal profile, and clearing one of
 * them without touching the others.
 *
 * What is listed is what the browser can count without guessing (Q5 a):
 * a site's cookies (how many, and their size), counted by the site they
 * are set for (Q6 a: by host name; a cookie set for `.example.com` is
 * listed under example.com, and kept when one of its sub-sites is
 * cleared, which the list says). Electron reports neither which other
 * kinds of storage a site has (local storage, IndexedDB, service workers,
 * cache storage, file systems) nor their size, nor the size of its cached
 * files: the Library says so, and Clear removes them all. A site with an
 * open tab is listed even without cookies, so that it can be cleared.
 * Private tabs keep their data in memory, cleared when the last one
 * closes; they are never listed, and the list itself is never saved.
 */
import type { Cookie, Session, WebContents } from 'electron';
import type { SiteEntry } from '../shared/privacy';

/** The site a cookie is for: its domain, without the dot that lets sub-sites read it. */
export function cookieSite(cookie: Pick<Cookie, 'domain'>): string {
  return (cookie.domain ?? '').replace(/^\./, '').toLowerCase();
}

/** The sites above a host that are listed too (a.b.example.com: b.example.com, example.com), whose cookies it also receives. */
export function parentSites(host: string, listed: ReadonlySet<string>): string[] {
  const parts = host.split('.');
  const out: string[] = [];
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (listed.has(parent)) out.push(parent);
  }
  return out;
}

/** Groups cookies by site and adds the sites of open tabs; sorted by name. */
export function siteList(cookies: Pick<Cookie, 'domain' | 'name' | 'value'>[], openHosts: string[]): SiteEntry[] {
  const sites = new Map<string, { cookies: number; cookieBytes: number; openTabs: number }>();
  const get = (host: string) => {
    let s = sites.get(host);
    if (!s) sites.set(host, (s = { cookies: 0, cookieBytes: 0, openTabs: 0 }));
    return s;
  };
  for (const c of cookies) {
    const host = cookieSite(c);
    if (!host) continue;
    const s = get(host);
    s.cookies += 1;
    s.cookieBytes += Buffer.byteLength(c.name, 'utf8') + Buffer.byteLength(c.value, 'utf8');
  }
  for (const host of openHosts) if (host) get(host).openTabs += 1;
  const listed = new Set(sites.keys());
  return [...sites.entries()]
    .map(([host, s]) => ({ host, ...s, parents: parentSites(host, listed) }))
    .sort((a, b) => a.host.localeCompare(b.host));
}

/** Kinds of site storage cleared with a site (Electron's names for clearStorageData). */
const SITE_STORAGE = ['localstorage', 'indexdb', 'serviceworkers', 'cachestorage', 'filesystem'] as const;

export class SiteData {
  constructor(
    private readonly ses: Session,
    /** The normal tabs' pages (private tabs are another session, never listed). */
    private readonly tabs: () => WebContents[],
  ) {}

  private hostsOfTabs(): { host: string; contents: WebContents }[] {
    return this.tabs()
      .filter((c) => !c.isDestroyed() && c.session === this.ses)
      .flatMap((contents) => {
        try {
          const url = new URL(contents.getURL());
          return url.protocol === 'http:' || url.protocol === 'https:' ? [{ host: url.hostname, contents }] : [];
        } catch {
          return [];
        }
      });
  }

  async list(): Promise<SiteEntry[]> {
    const cookies = await this.ses.cookies.get({});
    return siteList(cookies, this.hostsOfTabs().map((t) => t.host));
  }

  /**
   * Clears one site: its cookies (those set for it, not for a site above
   * it), its site storage, and its cached files, over http and https;
   * then reloads its open tabs, so that a page does not write back what
   * it still holds in memory. Bookmarks, history, and saved passwords are
   * not touched.
   */
  async clear(host: string): Promise<void> {
    const cookies = (await this.ses.cookies.get({ domain: host })).filter((c) => cookieSite(c) === host);
    for (const c of cookies) {
      const url = `${c.secure ? 'https' : 'http'}://${host}${c.path ?? '/'}`;
      await this.ses.cookies.remove(url, c.name);
    }
    const origins = [`https://${host}`, `http://${host}`];
    for (const origin of origins) await this.ses.clearStorageData({ origin, storages: [...SITE_STORAGE] });
    await this.ses.clearData({ dataTypes: ['cache', 'fileSystems', 'indexedDB', 'localStorage', 'serviceWorkers', 'webSQL', 'backgroundFetch'], origins });
    for (const t of this.hostsOfTabs()) if (t.host === host) t.contents.reload();
  }
}
