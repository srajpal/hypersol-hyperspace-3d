import type { PageStatus } from '@hypersol/scene-core';
import { daylight, nebula, themeById, type Theme } from '@hypersol/themes';
import type { ShellBridge, ShellCommand, ShortcutName } from '../shared/commands';
import { DEFAULT_SETTINGS, defaults, searchUrlFor, type Settings } from '../shared/settings';
import { DataClient, PrivacyClient } from './data';
import type { HsAbout } from './hud/about';
import type { HsLibrary } from './hud/library';
import type { HsSettings } from './hud/settings';
import type { HsShield } from './hud/shield';
import type { HsThemeButton } from './hud/theme-button';
import type { HsInstruments } from './hud/instruments';
import type { HsFindBar } from './hud/find-bar';
import type { HsDownloads } from './hud/downloads';
import { stepZoom } from './zoom';
import type { DownloadInfo } from '../shared/downloads';
import { InstrumentsController } from './instruments';
import { applyThemeCss } from './themes/apply';
import type { LayersState } from '../shared/layers';
import type { HsToolbar, MenuAction } from './hud/toolbar';
import { Room } from './scene/room';
import type { StartData } from './scene/start-panel';
import { TabView } from './scene/tab-view';
import { TabStore, type Tab, type TabState } from './state/tabs';
import { resolveInput } from './url';

export interface AppOptions {
  startUrl: string;
  tiltDeg: number;
  /** The tilt came from the command line, so Settings > Page tilt does not change it. */
  tiltFixed?: boolean;
  /** Test runs only: replaces DuckDuckGo's address with a local stand-in. */
  searchUrlOverride?: string;
  theme: Theme;
  bridge: ShellBridge;
  roomElement: HTMLElement;
  toolbar: HsToolbar;
  about: HsAbout;
  library: HsLibrary;
  settingsPanel: HsSettings;
  shield: HsShield;
  themeButton: HsThemeButton;
  instruments: HsInstruments;
  findBar: HsFindBar;
  downloads: HsDownloads;
  /** Test runs: printing is counted instead of opening the system's dialog. */
  testMode?: boolean;
  tabList: HTMLElement;
}

type PanelName = 'library' | 'settings' | 'downloads';

const SNAPSHOT_DELAY_MS = 400;
const SESSION_SAVE_DELAY_MS = 400;
const isWeb = (url: string) => /^https?:\/\//i.test(url);

/** Same page apart from the #fragment (an in-page jump keeps the favicon). */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isSamePage(a: string, b: string): boolean {
  return a.split('#')[0] === b.split('#')[0];
}

/**
 * The shell's controller: keeps the tab list, the pages, the room, the
 * top bar, and the panels in step, and acts on commands from the main
 * process.
 */
export class App {
  readonly store = new TabStore();
  readonly room: Room;
  readonly data: DataClient;
  readonly privacy: PrivacyClient;
  /** True once saved settings and tabs have been loaded. */
  ready = false;
  /** The theme in use (Settings > Theme, resolved for "Match the system"). */
  theme: Theme;
  private readonly systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  readonly instruments: InstrumentsController;
  /** Test runs only: ignore prepare-close, to test the main process's timeout. */
  testIgnorePrepareClose = false;
  private settings: Settings = defaults();
  private readonly views = new Map<number, TabView>();
  private shownFocus = -1;
  private readonly snapshotTimers = new Map<number, number>();
  /** Requests the shield blocked on each tab's page, by tab id. */
  private readonly shieldCounts = new Map<number, number>();
  /** Whether each tab's page is in the layers view, by tab id. */
  private readonly layersOn = new Map<number, boolean>();
  /**
   * Layers choices made in private tabs, by site: in memory only, shared by
   * the private tabs while any is open, forgotten with the last one
   * (GitHub issue #8).
   */
  private readonly privateLayersSites = new Map<string, boolean>();
  private hadPrivate = false;
  /** Test runs: print requests, counted instead of opening the dialog. */
  testPrints = 0;
  private downloadItems: DownloadInfo[] = [];
  /** The room's parallax as the pages see it (-1 to 1, y down). */
  private parallax = { x: 0, y: 0 };
  private sessionTimer: number | undefined;
  /** Whether the Enter key is held down in the shell. */
  private enterDown = false;
  private dataChangeTimer: number | undefined;
  /** Why the open tabs could not be saved last time, if they could not. */
  private sessionProblem = '';
  private starUrl = '';
  private openPanelName: PanelName | null = null;
  private focusBeforePanel: Element | null = null;

  constructor(private readonly options: AppOptions) {
    this.theme = options.theme;
    this.data = new DataClient(options.bridge);
    this.privacy = new PrivacyClient(options.bridge);
    options.library.client = this.data;
    options.settingsPanel.client = this.data;
    options.settingsPanel.privacy = this.privacy;
    options.shield.client = this.privacy;
    options.shield.tab = () => this.focusedView?.webContentsId ?? null;
    // Pausing or resuming the shield on a site takes effect on a fresh load.
    options.shield.addEventListener('hs-shield-paused', () => this.focusedView?.reload());
    this.room = new Room(options.roomElement, options.theme, {
      tiltDeg: options.tiltDeg,
      callbacks: {
        onCardClick: (key) => (key === 'plus' ? this.store.open() : this.store.focus(key)),
        onCardClose: (key) => this.store.close(key),
      },
    });
    this.store.subscribe(() => this.sync());
    options.themeButton.addEventListener('hs-theme-toggle', () => void this.toggleTheme());
    options.downloads.bridge = options.bridge;
    this.wireFind();
    this.instruments = new InstrumentsController(options.instruments, {
      bridge: options.bridge,
      privacy: this.privacy,
      focusedPage: () => (this.focusedView?.isStart === false ? this.focusedView.webContentsId : null),
      focusedHost: () => hostOf(this.store.focusedTab?.url ?? ''),
      tabCount: () => this.store.tabs.length,
      frames: () => this.room.frames,
      onInsets: (insets) => this.room.setExtraInsets(insets),
      saveSetting: (patch) => void this.saveSettings(patch),
    });
    // "Match the system" follows the system's light or dark setting as it changes.
    this.systemDark.addEventListener('change', () => this.applyLook());
    // The layers view's vanishing point follows the room's parallax.
    this.room.onCameraMove = (offset) => {
      this.parallax = { x: offset.x, y: -offset.y };
      this.instruments.drift(this.parallax);
      const id = this.store.focusedId;
      if (this.layersOn.get(id)) this.views.get(id)?.sendLayers(this.layersState(id, false));
    };
    document.addEventListener('keydown', (e) => e.key === 'Enter' && (this.enterDown = true), true);
    document.addEventListener('keyup', (e) => e.key === 'Enter' && (this.enterDown = false), true);
    this.wireToolbar();
    this.wirePanels();
    options.bridge.onCommand((command) => this.onCommand(command));
  }

  /** Loads settings, then opens the first tabs: the saved ones if asked, else a start tab. */
  async start(): Promise<void> {
    this.settings = await this.data.get({ op: 'settings.get' }).catch(() => defaults());
    this.applyLook();
    const saved = this.options.startUrl === '' ? await this.data.get({ op: 'startup' }).catch(() => null) : null;
    if (saved) {
      saved.tabs.forEach((url, i) => this.store.open({ url, background: i !== saved.focused }));
      const focused = this.store.tabs[saved.focused];
      if (focused) this.store.focus(focused.id);
    } else {
      this.store.open(this.options.startUrl === '' ? {} : { url: this.options.startUrl });
    }
    this.ready = true;
    void this.refreshStartData();
  }

  get focusedView(): TabView | undefined {
    return this.views.get(this.store.focusedId);
  }

  get openPanel(): PanelName | null {
    return this.openPanelName;
  }

  /** Test hook: whether a tab's page is in the layers view. */
  layersState(tabId: number): boolean;
  /** The state to send a tab's page. */
  layersState(tabId: number, animate: boolean): LayersState;
  layersState(tabId: number, animate?: boolean): boolean | LayersState {
    const on = this.layersOn.get(tabId) ?? false;
    if (animate === undefined) return on;
    return { on, animate, parallax: this.parallax, accent: this.theme.colors.accent };
  }

  viewOf(tabId: number): TabView | undefined {
    return this.views.get(tabId);
  }

  get searchUrl(): string {
    const override = this.options.searchUrlOverride;
    if (override && this.settings.searchEngine === DEFAULT_SETTINGS.searchEngine) return override;
    return searchUrlFor(this.settings);
  }

  /** Loads typed text in a tab: an address, or a search. */
  navigate(tabId: number, text: string): void {
    const result = resolveInput(text, this.searchUrl);
    const view = this.views.get(tabId);
    if (!result || !view) return;
    this.store.update(tabId, { url: result.url, state: 'loading', title: result.url });
    view.load(result.url);
    if (tabId === this.store.focusedId) this.focusPageAfterEnter(view);
  }

  /**
   * Moves the keyboard into the page, but only once the Enter key that
   * started the navigation has been released (or after half a second):
   * otherwise the key's release lands in the page. That stray key-up also
   * stalled the test tool, which waits for the shell to acknowledge it
   * (found 2026-09-25).
   */
  private focusPageAfterEnter(view: TabView): void {
    if (!this.enterDown) {
      view.focusContent();
      return;
    }
    const go = () => {
      window.clearTimeout(timer);
      document.removeEventListener('keyup', onUp, true);
      if (this.focusedView === view) view.focusContent();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter') go();
    };
    const timer = window.setTimeout(go, 500);
    document.addEventListener('keyup', onUp, true);
  }

  // ---- Tabs ---------------------------------------------------------------

  private sync(): void {
    const { store } = this;
    let newStart = false;
    for (const tab of store.tabs) {
      if (!this.views.has(tab.id)) {
        this.createView(tab);
        if (tab.url === '') newStart = true;
      }
    }
    const open = new Set(store.tabs.map((t) => t.id));
    for (const id of [...this.views.keys()]) {
      if (!open.has(id)) {
        this.room.removeView(id);
        this.views.delete(id);
        window.clearTimeout(this.snapshotTimers.get(id));
        this.snapshotTimers.delete(id);
        this.shieldCounts.delete(id);
        this.layersOn.delete(id);
        if (!store.tabs.some((t) => t.private)) this.privateLayersSites.clear();
      }
    }

    this.room.setCards(
      store.tabs.map((t) => ({
        key: t.id,
        title: t.title,
        loading: t.state === 'loading',
        ...(t.favicon ? { favicon: t.favicon } : {}),
        focused: t.id === store.focusedId,
        private: t.private,
      })),
    );

    // The last private tab closed (blank ones count): private data and choices go.
    const hasPrivate = store.tabs.some((t) => t.private);
    if (this.hadPrivate && !hasPrivate) void this.privacy.get({ op: 'private.ended' }).catch(() => undefined);
    this.hadPrivate = hasPrivate;
    this.updateToolbar();
    this.updateShield(store.focusedId !== this.shownFocus);
    this.instruments.setRailShown(this.room.railVisible);
    if (store.focusedId !== this.shownFocus) {
      this.instruments.focusChanged();
      this.options.findBar.close();
    }
    if (store.focusedId !== this.shownFocus) {
      const previous = this.shownFocus;
      if (this.views.has(previous)) this.captureSnapshot(previous);
      this.shownFocus = store.focusedId;
      this.room.focus(store.focusedId, previous !== -1);
      if (!this.openPanelName) {
        const view = this.focusedView;
        if (view?.isStart) this.options.toolbar.focusAddress();
        else view?.focusContent();
      }
    }
    this.renderTabList();
    void this.updateStar();
    if (newStart && this.ready) void this.refreshStartData();
    this.scheduleSessionSave();
  }

  private createView(tab: Tab): void {
    const id = tab.id;
    const view = new TabView(
      id,
      tab.url,
      {
      onStatus: (status) => this.onStatus(id, status),
      onNavState: (nav) => this.store.update(id, nav),
      onSettled: () => this.scheduleSnapshot(id),
      onStartSubmit: (text) => this.navigate(id, text),
      onStartOpen: (url) => this.navigate(id, url),
      allowOnce: async (url) => {
        const page = this.views.get(id)?.webContentsId;
        if (page === null || page === undefined) throw new Error('The page is not ready');
        await this.privacy.get({ op: 'shield.allow-once', tab: page, url });
      },
      isDnsBlocked: async () => (await this.privacy.get({ op: 'dns.check' })) === 'blocked',
      useNetworkDns: async () => {
        await this.privacy.get({ op: 'dns.use-network' });
      },
      onPageReady: () => {
        this.applyLayersOnOpen(id);
        this.applyZoomOnOpen(id);
      },
      onFound: (r) => {
        if (id !== this.store.focusedId) return;
        this.options.findBar.matchCount = r.matches;
        this.options.findBar.active = r.active;
      },
      },
      tab.private,
    );
    this.views.set(id, view);
    this.room.addView(view);
  }

  private onStatus(tabId: number, status: PageStatus): void {
    const tab = this.store.get(tabId);
    const view = this.views.get(tabId);
    if (!tab || !view) return;
    const state: TabState = view.isStart ? 'start' : status.state;
    // A different page starts without the previous page's favicon.
    const newPage = Boolean(status.url) && status.url !== tab.url && !isSamePage(status.url, tab.url);
    this.store.update(tabId, {
      state,
      ...(newPage ? { favicon: undefined } : {}),
      ...(status.url ? { url: status.url } : {}),
      ...(status.title ? { title: status.title } : status.url && tab.title === tab.url ? { title: status.url } : {}),
    });
  }

  private scheduleSnapshot(tabId: number): void {
    window.clearTimeout(this.snapshotTimers.get(tabId));
    this.snapshotTimers.set(
      tabId,
      window.setTimeout(() => this.captureSnapshot(tabId), SNAPSHOT_DELAY_MS),
    );
  }

  private captureSnapshot(tabId: number): void {
    const id = this.views.get(tabId)?.webContentsId;
    if (id === null || id === undefined) return;
    void this.options.bridge.captureTab(id).then((dataUrl) => {
      if (dataUrl && this.views.has(tabId)) this.room.setSnapshot(tabId, dataUrl);
    });
  }

  /** Saves the open web tabs soon, once changes settle. */
  private scheduleSessionSave(): void {
    if (!this.ready) return;
    window.clearTimeout(this.sessionTimer);
    this.sessionTimer = window.setTimeout(() => void this.saveSessionNow(), SESSION_SAVE_DELAY_MS);
  }

  /**
   * Saves the open web tabs now, for "reopen your tabs from last time".
   * A failure is kept and shown in Settings, not swallowed (GitHub issue #3).
   */
  private async saveSessionNow(): Promise<void> {
    window.clearTimeout(this.sessionTimer);
    if (!this.ready) return;
    // Private tabs are never kept for "reopen your tabs" (milestone 8).
    const web = this.store.tabs.filter((t) => isWeb(t.url) && !t.private);
    const focused = web.findIndex((t) => t.id === this.store.focusedId);
    try {
      await this.data.get({ op: 'session.save', tabs: web.map((t) => t.url), focused });
      this.setSessionProblem('');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(message);
      this.setSessionProblem(message);
    }
  }

  private setSessionProblem(message: string): void {
    this.sessionProblem = message;
    this.options.settingsPanel.sessionProblem = message;
  }

  // ---- Saved data ---------------------------------------------------------

  /** Refreshes every start panel with bookmarks and recent history. */
  private async refreshStartData(): Promise<void> {
    const starts = [...this.views.values()].filter((v) => v.isStart);
    if (starts.length === 0) return;
    let data: StartData;
    try {
      const status = await this.data.get({ op: 'status' });
      if (!status.available) throw new Error(status.message ?? "Couldn't open your saved data");
      const [bookmarks, recent] = await Promise.all([
        this.data.get({ op: 'bookmarks.list' }),
        this.data.get({ op: 'history.recent', limit: 8 }),
      ]);
      data = { bookmarks, recent };
    } catch (e) {
      data = { bookmarks: [], recent: [], unavailable: e instanceof Error ? e.message : String(e) };
    }
    for (const view of this.views.values()) view.setStartData(data);
  }

  /** Shows whether the focused page is bookmarked. */
  private async updateStar(): Promise<void> {
    const tab = this.store.focusedTab;
    const t = this.options.toolbar;
    const url = tab && isWeb(tab.url) && tab.state !== 'failed' ? tab.url : '';
    this.starUrl = url;
    if (!url) {
      t.canBookmark = false;
      t.bookmarked = false;
      return;
    }
    try {
      const [status, has] = await Promise.all([
        this.data.get({ op: 'status' }),
        this.data.get({ op: 'bookmarks.has', url }),
      ]);
      if (this.starUrl !== url) return;
      t.canBookmark = status.available;
      t.bookmarked = has;
    } catch {
      if (this.starUrl === url) t.canBookmark = false;
    }
  }

  private async toggleBookmark(): Promise<void> {
    const tab = this.store.focusedTab;
    if (!tab || !isWeb(tab.url) || !this.options.toolbar.canBookmark) return;
    try {
      if (await this.data.get({ op: 'bookmarks.has', url: tab.url })) {
        await this.data.get({ op: 'bookmarks.remove', url: tab.url });
      } else {
        await this.data.get({ op: 'bookmarks.add', url: tab.url, title: tab.title, favicon: tab.favicon ?? null });
      }
    } catch {
      // The star shows the real state after the refresh below.
    }
    await this.updateStar();
  }

  // ---- Panels -------------------------------------------------------------

  private togglePanel(name: PanelName): void {
    if (this.openPanelName === name) {
      this.panel(name).close();
      return;
    }
    if (this.openPanelName) {
      const other = this.openPanelName;
      this.openPanelName = null; // switching panels: keep the focus to return to
      this.panel(other).open = false;
    } else {
      this.focusBeforePanel = document.activeElement;
    }
    this.openPanelName = name;
    if (name === 'library') this.options.library.show();
    else if (name === 'downloads') this.options.downloads.show();
    else this.options.settingsPanel.show();
  }

  private panel(name: PanelName): HsLibrary | HsSettings | HsDownloads {
    return name === 'library' ? this.options.library : name === 'downloads' ? this.options.downloads : this.options.settingsPanel;
  }

  /** Focus goes back where it was before the panel opened. */
  private onPanelClosed(): void {
    this.openPanelName = null;
    const before = this.focusBeforePanel;
    this.focusBeforePanel = null;
    if (before === this.options.toolbar) this.options.toolbar.focusAddress();
    else if (before instanceof HTMLElement && before.isConnected && before !== document.body) before.focus();
    else this.focusedView?.focusContent();
  }

  private wirePanels(): void {
    const { library, settingsPanel, downloads } = this.options;
    for (const panel of [library, settingsPanel, downloads]) {
      panel.addEventListener('hs-panel-closed', () => this.onPanelClosed());
    }
    library.addEventListener('hs-open-url', (e) => {
      const url = (e as CustomEvent<string>).detail;
      library.close();
      this.navigate(this.store.focusedId, url);
    });
    settingsPanel.addEventListener('hs-settings-changed', (e) => {
      this.settings = (e as CustomEvent<Settings>).detail;
      this.applyLook();
    });
    // Escape closes an open panel even when the focus is elsewhere in the shell.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.openPanelName) this.panel(this.openPanelName).close();
    });
  }

  // ---- Top bar and commands ----------------------------------------------

  private updateToolbar(): void {
    const tab = this.store.focusedTab;
    const t = this.options.toolbar;
    if (!tab) return;
    t.url = tab.state === 'start' ? '' : tab.url;
    t.canGoBack = tab.canGoBack;
    t.canGoForward = tab.canGoForward;
    t.canReload = tab.state !== 'start';
    t.loading = tab.state === 'loading';
    t.layers = this.layersOn.get(tab.id) ?? false;
    t.private = tab.private;
    t.canZoom = isWeb(tab.url) && tab.state !== 'start';
    t.zoom = this.focusedView?.zoom ?? 1;
    t.canLayers = isWeb(tab.url) && tab.state !== 'start' && tab.state !== 'failed';
  }

  // ---- Theme and tilt (milestone 6) ------------------------------------------

  /** Puts the theme and page tilt from Settings into effect: HUD, room, cards, and the layers' outline. */
  private applyLook(): void {
    const choice = this.settings.theme;
    const theme = choice === 'system' ? (this.systemDark.matches ? nebula : daylight) : themeById(choice);
    if (theme !== this.theme) {
      this.theme = theme;
      applyThemeCss(document.documentElement, theme);
      this.room.setTheme(theme);
      const id = this.store.focusedId;
      if (this.layersOn.get(id)) this.views.get(id)?.sendLayers(this.layersState(id, false));
    }
    this.options.themeButton.scheme = theme.scheme;
    this.options.themeButton.themeName = theme.name;
    if (!this.options.tiltFixed) this.room.setTilt(this.settings.pageTilt);
    this.instruments.setSettings(this.settings);
    this.options.toolbar.instruments = this.settings.instruments;
  }

  /** Saves a change to Settings and puts it into effect. */
  private async saveSettings(patch: Partial<Settings>): Promise<void> {
    try {
      this.settings = await this.data.get({ op: 'settings.set', patch });
    } catch (e) {
      console.warn(e instanceof Error ? e.message : String(e));
      return;
    }
    this.applyLook();
  }

  /** The theme button: Nebula and Daylight in turn. */
  private async toggleTheme(): Promise<void> {
    const next = this.theme.id === 'nebula' ? 'daylight' : 'nebula';
    try {
      this.settings = await this.data.get({ op: 'settings.set', patch: { theme: next } });
    } catch (e) {
      console.warn(e instanceof Error ? e.message : String(e));
      return;
    }
    this.applyLook();
  }

  // ---- Zoom, find, print (milestone 8) --------------------------------------

  /** A page opens at its site's saved zoom (private tabs too; their changes are not saved). */
  private applyZoomOnOpen(tabId: number): void {
    const view = this.views.get(tabId);
    const url = view?.status.url ?? '';
    if (!view || !isWeb(url)) return;
    view.setZoom(this.settings.zoomSites[hostOf(url)] ?? 1);
    if (tabId === this.store.focusedId) this.updateToolbar();
  }

  /** Zoom buttons and shortcuts: one step in or out, or 0 for 100%; remembered for the site. */
  private async zoom(direction: 1 | -1 | 0): Promise<void> {
    const tab = this.store.focusedTab;
    const view = this.focusedView;
    if (!tab || !view || view.isStart || !isWeb(tab.url)) return;
    const factor = direction === 0 ? 1 : stepZoom(view.zoom, direction);
    view.setZoom(factor);
    this.options.toolbar.zoom = factor;
    if (tab.private) return;
    const site = hostOf(tab.url);
    const sites = { ...this.settings.zoomSites };
    if (factor === 1) delete sites[site];
    else sites[site] = factor;
    try {
      this.settings = await this.data.get({ op: 'settings.set', patch: { zoomSites: sites } });
    } catch (e) {
      console.warn(e instanceof Error ? e.message : String(e));
    }
  }

  private wireFind(): void {
    const bar = this.options.findBar;
    bar.addEventListener('hs-find', (e) => {
      const { text, forward, next } = (e as CustomEvent<{ text: string; forward: boolean; next: boolean }>).detail;
      this.focusedView?.find(text, forward, next);
    });
    bar.addEventListener('hs-find-closed', () => {
      this.focusedView?.stopFind();
      this.focusedView?.focusContent();
    });
  }

  private print(): void {
    const view = this.focusedView;
    if (!view || view.isStart) return;
    if (this.options.testMode) this.testPrints += 1;
    else view.print();
  }

  /** Test hook: this session's downloads as the shell knows them. */
  get downloadsList(): DownloadInfo[] {
    return this.downloadItems;
  }

  // ---- Layers view (milestone 5) -------------------------------------------

  /** A new page opens in the layers view if its site's choice, or the global setting, says so. */
  private applyLayersOnOpen(tabId: number): void {
    const view = this.views.get(tabId);
    const url = view?.status.url ?? '';
    if (!view || !isWeb(url)) return;
    const site = hostOf(url);
    const privateChoice = this.store.get(tabId)?.private ? this.privateLayersSites.get(site) : undefined;
    const on = privateChoice ?? this.settings.layersSites[site] ?? this.settings.layersOnOpen;
    this.layersOn.set(tabId, on);
    view.sendLayers(this.layersState(tabId, false));
    if (tabId === this.store.focusedId) this.updateToolbar();
  }

  /** The layers button and shortcut: switch the view for the page in front, and remember it for the site. */
  private async toggleLayers(): Promise<void> {
    const tab = this.store.focusedTab;
    const view = this.focusedView;
    if (!tab || !view || view.isStart || !isWeb(tab.url)) return;
    const on = !(this.layersOn.get(tab.id) ?? false);
    this.layersOn.set(tab.id, on);
    view.sendLayers(this.layersState(tab.id, true));
    this.updateToolbar();
    const site = hostOf(tab.url);
    if (!site) return;
    if (tab.private) {
      this.privateLayersSites.set(site, on);
      return;
    }
    try {
      this.settings = await this.data.get({
        op: 'settings.set',
        patch: { layersSites: { ...this.settings.layersSites, [site]: on } },
      });
    } catch (e) {
      console.warn(e instanceof Error ? e.message : String(e));
    }
  }

  /** The shield shows the focused page's count; a start tab has none. */
  private updateShield(focusChanged: boolean): void {
    const tab = this.store.focusedTab;
    const shield = this.options.shield;
    shield.disabled = !tab || !isWeb(tab.url) || this.focusedView?.isStart !== false;
    shield.count = tab ? (this.shieldCounts.get(tab.id) ?? 0) : 0;
    if (focusChanged && shield.open) void shield.refresh();
  }

  private wireToolbar(): void {
    const t = this.options.toolbar;
    t.addEventListener('hs-navigate', (e) => this.navigate(this.store.focusedId, (e as CustomEvent<string>).detail));
    t.addEventListener('hs-back', () => this.focusedView?.goBack());
    t.addEventListener('hs-forward', () => this.focusedView?.goForward());
    t.addEventListener('hs-reload', () => this.focusedView?.reload());
    t.addEventListener('hs-bookmark', () => void this.toggleBookmark());
    t.addEventListener('hs-new-tab', () => this.store.open());
    t.addEventListener('hs-zoom', (e) => void this.zoom((e as CustomEvent<1 | -1 | 0>).detail));
    t.addEventListener('hs-instruments', () => void this.saveSettings({ instruments: !this.settings.instruments }));
    t.addEventListener('hs-layers', () => void this.toggleLayers());
    t.addEventListener('hs-menu', (e) => this.onMenu((e as CustomEvent<MenuAction>).detail));
  }

  private onMenu(action: MenuAction): void {
    if (action === 'new-tab') this.store.open();
    else if (action === 'private-tab') this.store.open({ private: true });
    else if (action === 'downloads') this.togglePanel('downloads');
    else if (action === 'print') this.print();
    else if (action === 'close-tab') this.store.close(this.store.focusedId);
    else if (action === 'library' || action === 'settings') this.togglePanel(action);
    else if (action === 'about') this.options.about.open = true;
  }

  private onCommand(command: ShellCommand): void {
    switch (command.type) {
      case 'shortcut':
        this.onShortcut(command.name);
        break;
      case 'open-tab': {
        const opener = this.tabForWebContents(command.openerWebContentsId);
        this.store.open({
          url: command.url,
          background: command.background,
          // A link from a private tab opens in a private tab.
          private: opener !== undefined && (this.store.get(opener)?.private ?? false),
          ...(opener !== undefined ? { afterId: opener } : {}),
        });
        break;
      }
      case 'favicon': {
        const tabId = this.tabForWebContents(command.webContentsId);
        if (tabId !== undefined) this.store.update(tabId, { favicon: command.dataUrl });
        break;
      }
      case 'shield': {
        const tabId = this.tabForWebContents(command.webContentsId);
        if (tabId === undefined) break;
        this.shieldCounts.set(tabId, command.count);
        if (tabId === this.store.focusedId) {
          this.options.shield.count = command.count;
          if (this.options.shield.open) void this.options.shield.refresh();
        }
        break;
      }
      case 'page-blocked': {
        const tabId = this.tabForWebContents(command.webContentsId);
        if (tabId !== undefined) this.views.get(tabId)?.showBlocked(command.url);
        break;
      }
      case 'downloads':
        this.downloadItems = command.items;
        this.options.downloads.items = command.items;
        this.options.toolbar.downloading = command.items.some((d) => !d.finished);
        break;
      case 'filters-changed':
        if (this.openPanelName === 'settings') void this.options.settingsPanel.loadPrivacy();
        break;
      case 'prepare-close':
        if (this.testIgnorePrepareClose) break;
        void this.saveSessionNow().finally(() => this.options.bridge.closeReady());
        break;
      case 'data-changed':
        if (command.what === 'settings') {
          void this.data
            .get({ op: 'settings.get' })
            .then((s) => {
              this.settings = s;
              this.applyLook();
            })
            .catch(() => undefined);
          break;
        }
        // Visits and title changes come in bursts; answer once per burst.
        window.clearTimeout(this.dataChangeTimer);
        this.dataChangeTimer = window.setTimeout(() => {
          void this.refreshStartData();
          void this.updateStar();
          if (this.openPanelName === 'library') void this.options.library.refresh();
        }, 100);
        break;
    }
  }

  private onShortcut(name: ShortcutName): void {
    const s = this.store;
    switch (name) {
      case 'new-tab':
        s.open();
        break;
      case 'close-tab':
        s.close(s.focusedId);
        break;
      case 'focus-address':
        this.options.toolbar.focusAddress();
        break;
      case 'next-tab':
        s.cycle(1);
        break;
      case 'prev-tab':
        s.cycle(-1);
        break;
      case 'reload':
        this.focusedView?.reload();
        break;
      case 'back':
        this.focusedView?.goBack();
        break;
      case 'forward':
        this.focusedView?.goForward();
        break;
      case 'bookmark':
        void this.toggleBookmark();
        break;
      case 'layers':
        void this.toggleLayers();
        break;
      case 'instruments':
        void this.saveSettings({ instruments: !this.settings.instruments });
        break;
      case 'zoom-in':
        void this.zoom(1);
        break;
      case 'zoom-out':
        void this.zoom(-1);
        break;
      case 'zoom-reset':
        void this.zoom(0);
        break;
      case 'find':
        if (this.focusedView && !this.focusedView.isStart) this.options.findBar.show();
        break;
      case 'print':
        this.print();
        break;
      case 'downloads':
        this.togglePanel('downloads');
        break;
      case 'private-tab':
        s.open({ private: true });
        break;
      case 'library':
      case 'settings':
        this.togglePanel(name);
        break;
    }
  }

  private tabForWebContents(webContentsId: number | undefined): number | undefined {
    if (webContentsId === undefined) return undefined;
    for (const [tabId, view] of this.views) {
      if (view.webContentsId === webContentsId) return tabId;
    }
    return undefined;
  }

  /**
   * An off-screen list of tabs for keyboard and screen-reader users,
   * mirroring the 3D cards.
   */
  private renderTabList(): void {
    const list = this.options.tabList;
    const buttons = this.store.tabs.map((tab) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', tab.id === this.store.focusedId ? 'true' : 'false');
      b.textContent = tab.title || 'Untitled';
      b.addEventListener('click', () => this.store.focus(tab.id));
      return b;
    });
    list.replaceChildren(...buttons);
  }
}
