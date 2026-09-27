import type { ShellBridge } from '../shared/commands';
import { MAX_ENTRIES, type ConsoleEntry, type InspectOp, type InspectRequest, type InspectResults, type NetEntry } from '../shared/inspect';
import type { Settings } from '../shared/settings';
import type { PrivacyClient } from './data';
import type { HsInstruments } from './hud/instruments';
import { formatAge, formatDuration, mergeNet } from './inspect-format';

/** How often the panel asks for fresh readouts while it shows. */
export const POLL_MS = 1000;
/** Filter-list and DNS status change rarely: asked every this many polls. */
const SLOW_EVERY = 10;

export interface InstrumentsDeps {
  bridge: ShellBridge;
  privacy: PrivacyClient;
  /** The focused tab's page (web contents id), or null for a start tab. */
  focusedPage(): number | null;
  /** The focused tab shows a HoloML page (its scene is read for the Scene part, milestone 15). */
  focusedHoloml(): boolean;
  focusedHost(): string;
  tabCount(): number;
  /** Frames the room has drawn so far. */
  frames(): number;
  /** The page must leave this much room for the panels. */
  onInsets(insets: { right: number; bottom: number }): void;
  /** A change the panel makes to a setting (the console level). */
  saveSetting(patch: Partial<Settings>): void;
}

/**
 * Keeps the instrument panel (hud/instruments.ts) filled while it shows
 * (milestone 7): once a second it asks the main process for the focused
 * page's readouts and what is new in its console and network list, and
 * updates the browser gauges. While the panel is off it asks nothing.
 */
export class InstrumentsController {
  private timer: number | undefined;
  private page: number | null = null;
  private sinceNet = 0;
  private sinceConsole = 0;
  private net: NetEntry[] = [];
  private consoleEntries: ConsoleEntry[] = [];
  private polls = 0;
  private lastFrames = 0;
  private lastPollAt = 0;
  private busy = false;
  private insets = { right: 0, bottom: 0 };

  constructor(
    private readonly el: HsInstruments,
    private readonly deps: InstrumentsDeps,
  ) {
    el.addEventListener('hs-inspect-devtools', () => {
      const tab = deps.focusedPage();
      if (tab !== null) void this.ask({ op: 'inspect.devtools', tab });
    });
    el.addEventListener('hs-inspect-clear', () => {
      const tab = deps.focusedPage();
      this.consoleEntries = [];
      el.consoleEntries = [];
      if (tab !== null) void this.ask({ op: 'inspect.clear-console', tab });
    });
    // The Scene part (milestone 15): selecting in the tree, and picking in the scene.
    el.addEventListener('hs-scene-select', (e) => {
      const tab = deps.focusedPage();
      const index = (e as CustomEvent<number>).detail;
      if (tab !== null) void this.ask({ op: 'inspect.scene-select', tab, index }).then(() => this.refreshScene(tab));
    });
    el.addEventListener('hs-scene-pick', (e) => {
      const tab = deps.focusedPage();
      const on = (e as CustomEvent<boolean>).detail;
      if (tab !== null) void this.ask({ op: 'inspect.scene-pick', tab, on }).then(() => this.refreshScene(tab));
    });
    el.addEventListener('hs-console-level', (e) => deps.saveSetting({ consoleLevel: (e as CustomEvent<Settings['consoleLevel']>).detail }));
  }

  get running(): boolean {
    return this.timer !== undefined;
  }

  /** Applies Settings: shows or hides the panel and its parts, and starts or stops asking. */
  setSettings(s: Settings): void {
    const el = this.el;
    el.parts = {
      readouts: s.instrumentsReadouts,
      gauges: s.instrumentsGauges,
      console: s.instrumentsConsole,
      network: s.instrumentsNetwork,
    };
    el.consoleLevel = s.consoleLevel;
    const wasOpen = el.open;
    el.open = s.instruments;
    this.reportInsets();
    if (s.instruments && !wasOpen) this.start();
    if (!s.instruments && wasOpen) this.stop();
  }

  setRailShown(shown: boolean): void {
    this.el.railShown = shown;
  }

  /** Another tab is in front: its lists start afresh. */
  focusChanged(): void {
    this.resetLists();
    if (this.running) void this.poll();
  }

  /** The room's parallax, so the panels drift with it (-1 to 1, y down). */
  drift(offset: { x: number; y: number }): void {
    this.el.style.setProperty('--hs-drift-x', offset.x.toFixed(3));
    this.el.style.setProperty('--hs-drift-y', offset.y.toFixed(3));
  }

  private start(): void {
    this.stop();
    this.resetLists();
    this.polls = 0;
    this.lastFrames = this.deps.frames();
    this.lastPollAt = performance.now();
    this.timer = window.setInterval(() => void this.poll(), POLL_MS);
    void this.poll();
  }

  private stop(): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private resetLists(): void {
    this.page = null;
    this.sinceNet = 0;
    this.sinceConsole = 0;
    this.net = [];
    this.consoleEntries = [];
    this.el.net = [];
    this.el.consoleEntries = [];
    this.el.scene = null;
  }

  private reportInsets(): void {
    const next = this.el.insets;
    if (next.right === this.insets.right && next.bottom === this.insets.bottom) return;
    this.insets = next;
    this.deps.onInsets(next);
  }

  private async poll(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.pollOnce();
    } finally {
      this.busy = false;
    }
  }

  private async pollOnce(): Promise<void> {
    const el = this.el;
    const { deps } = this;
    const now = performance.now();
    const frames = deps.frames();
    const seconds = Math.max(0.001, (now - this.lastPollAt) / 1000);
    el.gauges = {
      ...el.gauges,
      tabs: deps.tabCount(),
      fps: Math.round((frames - this.lastFrames) / seconds),
      clock: new Date().toLocaleTimeString(undefined, { hour12: false }),
    };
    this.lastFrames = frames;
    this.lastPollAt = now;

    if (this.polls % SLOW_EVERY === 0) void this.slowGauges();
    this.polls += 1;

    const tab = deps.focusedPage();
    el.host = deps.focusedHost();
    if (tab === null) {
      el.page = null;
      el.scene = null;
      return;
    }
    if (tab !== this.page) {
      this.resetLists();
      this.page = tab;
    }
    const snap = await this.ask({ op: 'inspect.snapshot', tab, sinceNet: this.sinceNet, sinceConsole: this.sinceConsole });
    if (!snap || this.page !== tab) return;
    if (snap.reset) {
      this.net = [];
      this.consoleEntries = [];
    }
    this.net = mergeNet(this.net, snap.net, MAX_ENTRIES);
    this.consoleEntries = [...this.consoleEntries, ...snap.console].slice(-MAX_ENTRIES);
    this.sinceNet = Math.max(this.sinceNet, ...snap.net.map((e) => e.rev));
    this.sinceConsole = Math.max(this.sinceConsole, ...snap.console.map((e) => e.seq));
    el.page = snap.page;
    el.browser = snap.browser;
    el.net = this.net;
    el.consoleEntries = this.consoleEntries;
    el.gauges = { ...el.gauges, uptime: formatDuration(snap.browser.uptime) };
    await this.refreshScene(tab);
  }

  /** The Scene part: read from the page only while it is a HoloML page and the part shows. */
  private async refreshScene(tab: number): Promise<void> {
    if (!this.deps.focusedHoloml() || !this.el.parts.readouts) {
      this.el.scene = null;
      return;
    }
    const scene = await this.ask({ op: 'inspect.scene', tab });
    if (this.page === tab) this.el.scene = scene;
  }

  private async slowGauges(): Promise<void> {
    try {
      const [filters, dns] = await Promise.all([
        this.deps.privacy.get({ op: 'filters.status' }),
        this.deps.privacy.get({ op: 'dns.status' }),
      ]);
      this.el.gauges = {
        ...this.el.gauges,
        filtersAge: `${formatAge(filters.updatedAt, Date.now())}${filters.source === 'starter' ? ' (built in)' : ''}`,
        dns: dns.networkForSession ? 'NETWORK DNS' : dns.effective === 'secure' ? 'SECURE · QUAD9' : 'AUTO · QUAD9',
      };
    } catch {
      // Shown as a dash until the next try.
    }
  }

  private async ask<K extends InspectOp>(request: Extract<InspectRequest, { op: K }>): Promise<InspectResults[K] | null> {
    const reply = await this.deps.bridge.inspect(request).catch(() => null);
    return reply && reply.ok ? (reply.value as InspectResults[K]) : null;
  }
}
