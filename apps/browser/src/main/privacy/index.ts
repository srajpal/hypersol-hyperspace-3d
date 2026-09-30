import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, ipcMain, net, webContents, type IpcMainInvokeEvent, type Session, type WebContents } from 'electron';
import { ElectronBlocker, Request, type RequestType } from '@ghostery/adblocker-electron';
import { SHELL_COMMAND_CHANNEL, type ShellCommand } from '../../shared/commands';
import {
  parsePrivacyRequest,
  type PrivacyOp,
  type PrivacyReply,
  type PrivacyRequest,
} from '../../shared/privacy';
import type { DnsMode } from '../../shared/settings';
import { readLimited } from '../favicon';
import type { StorageService } from '../storage/service';
import { readTextIfExists, writeFileAtomic } from '../storage/files';
import { DnsControl, QUAD9 } from './dns';
import { FilterService, type ListManifest } from './filters';
import { OwnRequests } from './own-requests';
import { hostOf, Shield, type Matcher } from './shield';
import createBuildWorker from './filters-worker?nodeWorker';

/** The blocker's page script asks on these channels (@ghostery/adblocker-electron-preload). */
const COSMETICS_CHANNEL = '@ghostery/adblocker/inject-cosmetic-filters';
const MUTATION_OBSERVER_CHANNEL = '@ghostery/adblocker/is-mutation-observer-enabled';

/** Largest list a refresh accepts; the biggest today (EasyList) is about 2 MB. */
const MAX_LIST_BYTES = 20 * 1024 * 1024;
const LIST_TIMEOUT_MS = 60_000;
/** Shield counts are sent to the shell at most this often per tab. */
const COUNT_INTERVAL_MS = 100;
const HOUR_MS = 60 * 60 * 1000;

export interface PrivacyOptions {
  /** resources/filters: lists.json and the starter copy. */
  filtersDir: string;
  /** Where refreshed lists are saved (in the app data folder). */
  savedDir: string;
  /** Test mode: download lists from here instead of the manifest's address. */
  filtersBase?: string;
  /** Wait this long after start before the first scheduled refresh; null: no schedule. */
  refreshDelayMs: number | null;
  /** Test mode: where the DNS reachability check asks; null skips the check. */
  dnsProbeUrl?: string | null;
  /** Every request the session makes (test log). */
  observe?: (url: string) => void;
  /**
   * Last word on a response's headers (HoloML pages, main/holoml.ts):
   * Electron allows one onHeadersReceived listener per session, so others
   * adjust what the shield decided here.
   */
  adjustHeaders?: (
    details: Electron.OnHeadersReceivedListenerDetails,
    response: Electron.HeadersReceivedResponse,
  ) => Electron.HeadersReceivedResponse;
  /** A web page's request is starting (the instrument panel's monitor, main/inspect). */
  onTabRequest?: (tab: number, details: { id: number; url: string; resourceType: string; method: string; timestamp: number }) => void;
  /** Every DNS mode put into effect (test log). */
  onDnsApplied?: (mode: 'secure' | 'automatic', resolver: string) => void;
  /** Is this the app's own shell (it is told when the filter lists change)? */
  isShell(contents: WebContents): boolean;
  /** The shell's last private tab closed: forget everything private (main/index.ts). */
  onPrivateEnded?: () => Promise<void>;
}

/** Downloads one list through Chromium's network stack, so encrypted DNS applies. */
async function downloadList(url: string): Promise<string> {
  const response = await net.fetch(url, { signal: AbortSignal.timeout(LIST_TIMEOUT_MS), cache: 'no-store' });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${url} answered ${response.status}`);
  }
  const text = (await readLimited(response, MAX_LIST_BYTES)).toString('utf8');
  // A captive portal or error page instead of a list.
  if (text.trimStart().startsWith('<')) throw new Error(`${url} did not send a filter list`);
  return text;
}

/** Builds the engine in a worker thread (filters-worker.ts). */
function buildInWorker(lists: string[], resources: string): Promise<Uint8Array> {
  const checksum = createHash('sha256').update(resources).digest('hex');
  return new Promise((resolve, reject) => {
    const worker = createBuildWorker({});
    worker.once('message', (reply: { bin?: Uint8Array; error?: string }) => {
      void worker.terminate();
      if (reply.bin) resolve(reply.bin);
      else reject(new Error(reply.error ?? 'the lists could not be built'));
    });
    worker.once('error', (e) => {
      void worker.terminate();
      reject(e);
    });
    worker.postMessage({ lists, resources, checksum });
  });
}

/**
 * The privacy features in the main process (TODO.md milestone 4): the
 * shield on every web page request, element hiding, the filter lists
 * and their refresh, and encrypted DNS. Web pages and the shell share the
 * default session; requests from web pages (webview tabs) are filtered,
 * and so are requests that come from no tab at all (a service worker's);
 * never the shell's own, nor the app's (OwnRequests).
 */
export class Privacy {
  readonly filters: FilterService<ElectronBlocker>;
  readonly dns: DnsControl;
  readonly shield: Shield;
  private readonly tabs = new Set<number>();
  private paused = new Set<string>();
  /**
   * Private tabs (milestone 8, GitHub issue #8): their pages, and the sites
   * paused from them, which are kept in memory only, shared by the private
   * tabs while any is open, and forgotten when the last one closes.
   */
  private readonly privateTabs = new Set<number>();
  private readonly privatePaused = new Set<string>();
  private privateSession: Session | null = null;
  private readonly pendingCounts = new Map<number, number>();
  private readonly countTimers = new Map<number, NodeJS.Timeout>();
  private readonly own = new OwnRequests();

  constructor(
    private readonly ses: Session,
    private readonly storage: StorageService,
    private readonly options: PrivacyOptions,
  ) {
    const manifest = JSON.parse(readFileSync(join(options.filtersDir, 'lists.json'), 'utf8')) as ListManifest;
    mkdirSync(options.savedDir, { recursive: true });
    const saved = { bin: join(options.savedDir, 'engine.bin'), meta: join(options.savedDir, 'engine.json') };
    this.filters = new FilterService<ElectronBlocker>(
      manifest,
      {
        files: {
          readSaved: () => {
            const meta = readTextIfExists(saved.meta);
            return meta === null ? null : { bin: new Uint8Array(readFileSync(saved.bin)), meta };
          },
          writeSaved: (bin, meta) => {
            writeFileAtomic(saved.bin, bin);
            writeFileAtomic(saved.meta, meta);
          },
          readStarter: () => {
            const info = JSON.parse(readFileSync(join(options.filtersDir, 'starter.json'), 'utf8')) as { built: string };
            return { bin: new Uint8Array(readFileSync(join(options.filtersDir, 'starter.bin'))), built: Date.parse(info.built) };
          },
        },
        download: (url) => this.own.run(url, () => downloadList(url)),
        build: buildInWorker,
        load: (bin) => ElectronBlocker.deserialize(bin),
        now: () => Date.now(),
      },
      options.filtersBase,
    );
    if (this.filters.problem) console.warn(this.filters.problem);

    this.dns = new DnsControl(
      (mode, resolver) => {
        app.configureHostResolver({ secureDnsMode: mode, secureDnsServers: [resolver] });
        options.onDnsApplied?.(mode, resolver);
      },
      (url, init) => this.own.run(url, () => net.fetch(url, { ...init, cache: 'no-store' })),
      QUAD9,
      options.dnsProbeUrl === undefined ? QUAD9 : options.dnsProbeUrl,
    );

    const matcher: Matcher = (url, type, pageUrl) => {
      const request = Request.fromRawDetails({ url, type: type as RequestType, sourceUrl: pageUrl });
      const { match, redirect } = this.filters.engine.match(request);
      // Stand-in scripts from the lists (a redirect to a data: address) did
      // not load in Electron in the F1 check, so listed requests are
      // blocked outright rather than redirected.
      return { blocked: match || redirect !== undefined };
    };
    this.shield = new Shield(
      () => matcher,
      (site, tab) => this.isPausedFor(tab, site),
      (tab, count) => this.queueCount(tab, count),
      (tab, url) => this.sendToHost(tab, { type: 'page-blocked', webContentsId: tab, url }),
    );
  }

  /** Call once the app is ready, before any window opens. */
  start(): void {
    const settings = this.storage.settingsFile.settings;
    this.paused = new Set(settings.pausedSites);
    this.dns.setMode(settings.dnsMode);
    let dnsMode: DnsMode = settings.dnsMode;
    this.storage.onChange((what) => {
      if (what !== 'settings') return;
      const next = this.storage.settingsFile.settings;
      this.paused = new Set(next.pausedSites);
      if (next.dnsMode !== dnsMode) {
        dnsMode = next.dnsMode;
        this.dns.setMode(dnsMode);
      }
    });

    this.protect(this.ses);

    // Element hiding: the page preload (preload/page.ts) runs the blocker's
    // page script, which asks here for the styles to apply.
    this.handleCosmetics();

    this.filters.onChange(() => this.broadcast({ type: 'filters-changed' }));
    this.schedule();
  }

  /**
   * The shield for one session's web pages: the default session, and the
   * private tabs' in-memory session (milestone 8), which get the same
   * protection.
   */
  protect(ses: Session): void {
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
      this.options.observe?.(details.url);
      const tab = details.webContentsId;
      if (tab === undefined) {
        // No tab made this request: the app itself, or a service worker
        // (review of 2026-09-30, M3). The site's pause is its session's.
        const paused = ses === this.privateSession ? this.privatePaused : this.paused;
        callback(this.own.has(details.url) ? {} : this.shield.decideUntabbed(details, (site) => paused.has(site)));
        return;
      }
      // The shell's own requests, and its developer tools'.
      if (!this.tabs.has(tab)) {
        callback({});
        return;
      }
      this.options.onTabRequest?.(tab, details);
      callback(this.shield.decide({ url: details.url, resourceType: details.resourceType, tab }));
    });
    // Filter lists can add a content security policy to pages (for example to stop pop-unders).
    ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, done) => {
      const adjust = this.options.adjustHeaders;
      const callback = (response: Electron.HeadersReceivedResponse) => done(adjust ? adjust(details, response) : response);
      const tab = details.webContentsId;
      const page = details.resourceType === 'mainFrame' ? details.url : details.frame?.top?.url ?? '';
      if (tab === undefined || !this.tabs.has(tab) || this.isPausedFor(tab, hostOf(page))) {
        callback({});
        return;
      }
      this.filters.engine.onHeadersReceived(details, callback);
    });
  }

  private handleCosmetics(): void {
    ipcMain.handle(COSMETICS_CHANNEL, (event, _url: unknown, msg: unknown) => {
      const page = this.cosmeticsPage(event);
      if (page === null) return undefined;
      return this.filters.engine.onInjectCosmeticFilters(event, page, msg as Parameters<ElectronBlocker['onInjectCosmeticFilters']>[2]);
    });
    ipcMain.handle(MUTATION_OBSERVER_CHANNEL, (event) =>
      this.cosmeticsPage(event) === null ? false : this.filters.engine.config.enableMutationObserver,
    );
  }

  /** The private tabs' session: pauses made from its pages stay in memory. */
  setPrivateSession(ses: Session): void {
    this.privateSession = ses;
  }

  /** The last private tab closed: its paused sites are forgotten. */
  forgetPrivate(): void {
    this.privatePaused.clear();
  }

  /**
   * Fetches a tab's favicon for the browser's own interface. The address
   * is the page's choice, so the shield is asked first, as for the page's
   * own requests, and a listed address is not fetched (and is counted);
   * until the review of 2026-09-30 (M3) it was fetched unseen, with the
   * site's cookies.
   */
  fetchFavicon(contents: WebContents, url: string, init: { signal: AbortSignal }): Promise<Response> {
    if (this.tabs.has(contents.id)) {
      const decision = this.shield.decide({ url, resourceType: 'image', tab: contents.id });
      if ('cancel' in decision || 'redirectURL' in decision) return Promise.reject(new Error('Blocked by the privacy shield'));
    }
    return this.own.run(url, () => contents.session.fetch(url, init));
  }

  private isPausedFor(tab: number, site: string): boolean {
    return this.privateTabs.has(tab) ? this.privatePaused.has(site) : this.paused.has(site);
  }

  /** A web page (webview tab) was created: its requests are filtered from now on. */
  trackTab(contents: WebContents): void {
    const id = contents.id;
    this.tabs.add(id);
    if (this.privateSession !== null && contents.session === this.privateSession) this.privateTabs.add(id);
    contents.on('did-navigate', (_event, url) => this.shield.committed(id, url));
    // A page that failed to load: the tab shows its error card, so the record is that page's.
    // A load given up or turned into a download (-3, aborted) is not a failure.
    contents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
      if (isMainFrame && code !== -3) this.shield.committed(id, url);
    });
    contents.on('did-stop-loading', () => this.shield.settled(id));
    contents.once('destroyed', () => {
      this.tabs.delete(id);
      this.privateTabs.delete(id);
      this.shield.forget(id);
      clearTimeout(this.countTimers.get(id));
      this.countTimers.delete(id);
      this.pendingCounts.delete(id);
    });
  }

  /** Answers one request from the shell (registered with handleFromShell, main/ipc.ts). Never throws. */
  async handle(event: IpcMainInvokeEvent, raw: unknown): Promise<PrivacyReply<PrivacyOp>> {
    const parsed = parsePrivacyRequest(raw);
    if ('error' in parsed) return { ok: false, error: parsed.error };
    try {
      return { ok: true, value: await this.run(event.sender, parsed.request) } as PrivacyReply<PrivacyOp>;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async run(shell: WebContents, r: PrivacyRequest): Promise<unknown> {
    switch (r.op) {
      case 'shield.report':
        this.ownTab(shell, r.tab);
        return this.shield.report(r.tab);
      case 'shield.allow-once':
        this.ownTab(shell, r.tab);
        this.shield.allow(r.tab, r.url);
        return null;
      case 'shield.pause': {
        this.ownTab(shell, r.tab);
        if (this.privateTabs.has(r.tab)) {
          // From a private tab: nothing reaches settings.json (GitHub issue #8).
          if (r.paused) this.privatePaused.add(r.site);
          else this.privatePaused.delete(r.site);
          return null;
        }
        const sites = new Set(this.storage.settingsFile.settings.pausedSites);
        if (r.paused) sites.add(r.site);
        else sites.delete(r.site);
        const reply = await this.storage.handle({ op: 'settings.set', patch: { pausedSites: [...sites] } });
        if (!reply.ok) throw new Error(reply.error);
        return null;
      }
      case 'filters.status':
        return this.filters.status();
      case 'filters.update':
        return this.filters.refresh();
      case 'dns.status':
        return this.dns.status();
      case 'dns.check':
        return this.dns.check();
      case 'dns.use-network':
        return this.dns.useNetwork();
      case 'private.ended':
        await this.options.onPrivateEnded?.();
        return null;
    }
  }

  /** The page asking for element hiding, if it is a tab and not paused; else null. */
  private cosmeticsPage(event: IpcMainInvokeEvent): string | null {
    if (!this.tabs.has(event.sender.id)) return null;
    const page = event.senderFrame?.url ?? event.sender.getURL();
    return this.isPausedFor(event.sender.id, hostOf(page)) ? null : page;
  }

  private ownTab(shell: WebContents, tab: number): void {
    const contents = webContents.fromId(tab);
    if (!contents || !this.tabs.has(tab) || contents.hostWebContents !== shell) throw new Error('Not one of your tabs');
  }

  private queueCount(tab: number, count: number): void {
    this.pendingCounts.set(tab, count);
    if (this.countTimers.has(tab)) return;
    this.countTimers.set(
      tab,
      setTimeout(() => {
        this.countTimers.delete(tab);
        const latest = this.pendingCounts.get(tab);
        this.pendingCounts.delete(tab);
        if (latest !== undefined) this.sendToHost(tab, { type: 'shield', webContentsId: tab, count: latest });
      }, COUNT_INTERVAL_MS),
    );
  }

  /** Sends a command to the shell hosting a tab. */
  private sendToHost(tab: number, command: ShellCommand): void {
    const host = webContents.fromId(tab)?.hostWebContents;
    if (host && !host.isDestroyed()) host.send(SHELL_COMMAND_CHANNEL, command);
  }

  private broadcast(command: ShellCommand): void {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed() && this.options.isShell(contents)) contents.send(SHELL_COMMAND_CHANNEL, command);
    }
  }

  /** Refresh once a day while the setting is on; checked an hour apart after the first wait. */
  private schedule(): void {
    if (this.options.refreshDelayMs === null) return;
    const check = () => {
      if (this.storage.settingsFile.settings.filterRefresh && this.filters.due()) void this.filters.refresh();
    };
    setTimeout(() => {
      check();
      setInterval(check, HOUR_MS).unref();
    }, this.options.refreshDelayMs).unref();
  }
}
