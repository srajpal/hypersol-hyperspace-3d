import type { PageStatus } from '@hypersol/scene-core';
import { daylight, nebula, themeById, type Theme } from '@hypersol/themes';
import type { ShellBridge, ShellCommand, ShortcutName } from '../shared/commands';
import { DEFAULT_SETTINGS, defaults, SEARCH_ENGINES, searchUrlFor, type Settings } from '../shared/settings';
import { bindings, describeCombo, holomlOnly, matchCombo } from '../shared/shortcuts';
import { DataClient, PasswordsClient, PermissionsClient, PrivacyClient } from './data';
import type { HsPrompts, SignInAnswer } from './hud/prompts';
import type { SignInPrompt } from '../shared/sign-in';
import type { HsSitePanel } from './hud/site-panel';
import type { HsNotice } from './hud/notice';
import { originOf, type PermissionKind, type PermissionPrompt, type PromptAnswer } from '../shared/permissions';
import type { OfferAnswer, PasswordOffer } from '../shared/passwords';
import type { HsTabStrip } from './hud/tab-strip';
import { STRIP_HEIGHT } from './hud/tab-strip';
import type { HsTabSearch } from './hud/tab-search';
import { CARD_SCALES } from './scene/room';
import { ClosedTabs } from './state/closed-tabs';
import { shouldSleep, sleepMinutes } from './state/sleep';
import type { HsAbout } from './hud/about';
import type { HsExamples } from './hud/examples';
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
import { hostOf } from '../shared/site';
import { resolveInput, siteMarker } from './url';

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
  examples: HsExamples;
  library: HsLibrary;
  settingsPanel: HsSettings;
  shield: HsShield;
  themeButton: HsThemeButton;
  instruments: HsInstruments;
  findBar: HsFindBar;
  downloads: HsDownloads;
  /** Permission prompts and password offers under the top bar (milestone 9). */
  prompts: HsPrompts;
  sitePanel: HsSitePanel;
  notice: HsNotice;
  /** Milestone 10: the list of tabs in the top bar, and tab search. */
  tabStrip: HsTabStrip;
  tabSearch: HsTabSearch;
  /** Test runs: how long a "minute" is for sleeping tabs, so the checks need not wait. */
  sleepMinuteMs?: number;
  /** Test runs: printing is counted instead of opening the system's dialog. */
  testMode?: boolean;
  tabList: HTMLElement;
}

type PanelName = 'library' | 'settings' | 'downloads';

const SNAPSHOT_DELAY_MS = 400;
const SESSION_SAVE_DELAY_MS = 400;
const isWeb = (url: string) => /^https?:\/\//i.test(url);

/** Same page apart from the #fragment (an in-page jump keeps the favicon). */
function isSamePage(a: string, b: string): boolean {
  return a.split('#')[0] === b.split('#')[0];
}

/**
 * What the shell keeps about a tab besides its view: one record per tab,
 * made with the view and dropped with it (review of 2026-09-30: nine
 * maps by tab id, each cleaned by hand when a tab closed).
 */
interface TabRecord {
  /** The timer for the card's next picture. */
  snapshotTimer: number | undefined;
  /** Requests the shield blocked on the tab's page. */
  shieldCount: number;
  /** Whether the tab's page is in the layers view. */
  layersOn: boolean;
  /** Permission prompts waiting for the tab, oldest first (milestone 9). */
  permissionQueue: PermissionPrompt[];
  /** An offer to save a password. */
  offer: PasswordOffer | null;
  /** The sign-in prompt of the tab's page (the main process sends a tab one at a time). */
  signIn: SignInPrompt | null;
  /** What the tab's page was given (camera, microphone, location): the in-use marker. */
  access: PermissionKind[];
  /** When the tab was last in front (milestone 10); null until it has left the front. */
  lastSeen: number | null;
  /**
   * An address typed or chosen for the tab, until its page arrives or
   * fails: the address the page was on, and the one asked for.
   */
  typedLoad: { from: string; to: string } | null;
}

const newTabRecord = (): TabRecord => ({
  snapshotTimer: undefined,
  shieldCount: 0,
  layersOn: false,
  permissionQueue: [],
  offer: null,
  signIn: null,
  access: [],
  lastSeen: null,
  typedLoad: null,
});

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
  readonly permissions: PermissionsClient;
  readonly passwords: PasswordsClient;
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
  /** Each open tab's record (TabRecord), by tab id. */
  private readonly records = new Map<number, TabRecord>();
  private shownFocus = -1;
  /**
   * Layers choices made in private tabs, by site: in memory only, shared by
   * the private tabs while any is open, forgotten with the last one
   * (GitHub issue #8).
   */
  private readonly privateLayersSites = new Map<string, boolean>();
  /** Zoom set in private tabs, by site: kept the same way, never saved. */
  private readonly privateZoomSites = new Map<string, number>();
  private hadPrivate = false;
  /** Test runs: print requests, counted instead of opening the dialog. */
  testPrints = 0;
  private downloadItems: DownloadInfo[] = [];
  /** The notice each download last got (milestone 9), so each outcome is told once. */
  private readonly downloadNotices = new Map<number, 'done' | 'failed'>();
  /** Milestone 10: recently closed tabs, and the power source. */
  private readonly closedTabs = new ClosedTabs();
  private onBattery = false;
  private economyActive = false;
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
  /** One panel is closing because another is opening: the focus stays for the new one. */
  private switchingPanels = false;

  constructor(private readonly options: AppOptions) {
    this.theme = options.theme;
    this.data = new DataClient(options.bridge);
    this.privacy = new PrivacyClient(options.bridge);
    this.permissions = new PermissionsClient(options.bridge);
    this.passwords = new PasswordsClient(options.bridge);
    options.library.client = this.data;
    options.library.passwords = this.passwords;
    options.sitePanel.client = this.permissions;
    options.sitePanel.tab = () => (this.focusedView?.isStart === false ? this.focusedView.webContentsId : null);
    options.settingsPanel.client = this.data;
    options.settingsPanel.platform = options.bridge.platform;
    options.settingsPanel.captureKeys = (on) => options.bridge.captureKeys(on);
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
        onCardAudio: (key) => this.toggleMute(key),
      },
    });
    this.store.subscribe(() => this.sync());
    // A closed tab can be reopened (milestone 10): not private ones, nor start tabs.
    this.store.onClosed = (tab, index) => {
      const view = this.views.get(tab.id);
      const url = view?.pendingAddress ?? tab.url;
      if (tab.private || !isWeb(url)) return;
      this.closedTabs.push({
        url,
        title: tab.title,
        ...(tab.favicon ? { favicon: tab.favicon } : {}),
        index,
        from: view?.webContentsId ?? view?.sleepingFrom ?? null,
      });
    };
    options.themeButton.addEventListener('hs-theme-toggle', () => void this.toggleTheme());
    // A shortcut for HoloML pages only (the text view, Ctrl+Shift+V unless
    // changed in Settings > Shortcuts), pressed while the shell has the
    // keyboard. Pressed in the page it arrives as a command, like every
    // shortcut; pressed here the main process leaves the keys to the
    // shell (main/shortcuts.ts), which knows what it cannot: whether a
    // text field has the keyboard, where they keep their usual meaning
    // ("paste as plain text").
    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || !this.focusedView?.isHoloml) return;
      const platform = options.bridge.platform;
      const pressed = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, key: e.key };
      const name = matchCombo(pressed, bindings(this.settings.shortcuts, platform), platform);
      if (name === null || !holomlOnly(name)) return;
      const typing = e.composedPath().some((n) => n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement);
      if (typing) return;
      e.preventDefault();
      this.onShortcut(name);
    });
    // A .holoml file dropped on the window outside the page opens in the tab in front.
    document.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    });
    document.addEventListener('drop', (e) => {
      const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.name.toLowerCase().endsWith('.holoml'));
      e.preventDefault();
      if (file) void this.openFile(file);
    });
    options.downloads.bridge = options.bridge;
    this.wireFind();
    this.instruments = new InstrumentsController(options.instruments, {
      bridge: options.bridge,
      privacy: this.privacy,
      focusedPage: () => (this.focusedView?.isStart === false ? this.focusedView.webContentsId : null),
      focusedHoloml: () => this.focusedView?.isHoloml ?? false,
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
      if (this.tab(id).layersOn) this.views.get(id)?.sendLayers(this.layersState(id, false));
    };
    document.addEventListener('keydown', (e) => e.key === 'Enter' && (this.enterDown = true), true);
    document.addEventListener('keyup', (e) => e.key === 'Enter' && (this.enterDown = false), true);
    this.wireToolbar();
    this.wirePanels();
    this.wirePrompts();
    this.wireTabs();
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

  /** A tab's record; for a tab that is not open (gone, or never was), a fresh one that nothing keeps. */
  private tab(tabId: number): TabRecord {
    return this.records.get(tabId) ?? newTabRecord();
  }

  get openPanel(): PanelName | null {
    return this.openPanelName;
  }

  /** Test hook: whether a tab's page is in the layers view. */
  layersState(tabId: number): boolean;
  /** The state to send a tab's page. */
  layersState(tabId: number, animate: boolean): LayersState;
  layersState(tabId: number, animate?: boolean): boolean | LayersState {
    const on = this.tab(tabId).layersOn;
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

  /** A HoloML page in front fills the window; other pages lean back (milestone 14). */
  private updateFill(): void {
    this.room.setFill(this.focusedView?.isHoloml ?? false);
  }

  /**
   * Opens a HoloML file from the computer in the tab in front (milestone
   * 14, Q3 a): a dropped file, or one chosen with Ctrl+O or the menu.
   */
  async openFile(file?: File): Promise<void> {
    const url = await this.options.bridge.openFile(file).catch(() => null);
    if (url) this.showUrl(url);
  }

  /** Loads an address the browser itself chose (an opened file) in the tab in front. */
  showUrl(url: string): void {
    const id = this.store.focusedId;
    const view = this.views.get(id);
    if (!view) return;
    this.startLoad(id, view, url);
    this.focusPage(view);
  }

  /**
   * Puts the keyboard in a tab's page. While a sign-in prompt for the tab
   * in front is up, the prompt keeps it: a page that has just asked for a
   * password must not get what is typed next.
   */
  focusPage(view: TabView | undefined = this.focusedView): void {
    if (view !== undefined && view === this.focusedView && this.options.prompts.signIn) this.options.prompts.focusSignIn();
    else view?.focusContent();
  }

  /**
   * Shows an address in a tab and starts loading it. The tab shows the
   * address asked for from now until its page arrives or fails.
   */
  private startLoad(tabId: number, view: TabView, url: string): void {
    const from = view.status.url;
    // The same address again has no other address to flash back to.
    this.tab(tabId).typedLoad = from === url ? null : { from, to: url };
    // Another page: the favicon of the one being left goes.
    this.store.update(tabId, { url, state: 'loading', title: url, ...(isSamePage(from, url) ? {} : { favicon: undefined }) });
    view.load(url);
  }

  /** Loads typed text in a tab: an address, or a search. */
  navigate(tabId: number, text: string): void {
    const result = resolveInput(text, this.searchUrl);
    const view = this.views.get(tabId);
    if (!result || !view) return;
    this.startLoad(tabId, view, result.url);
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
      this.focusPage(view);
      return;
    }
    const go = () => {
      window.clearTimeout(timer);
      document.removeEventListener('keyup', onUp, true);
      if (this.focusedView === view) this.focusPage(view);
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
        window.clearTimeout(this.records.get(id)?.snapshotTimer);
        this.records.delete(id);
        if (!store.tabs.some((t) => t.private)) {
          this.privateLayersSites.clear();
          this.privateZoomSites.clear();
        }
      }
    }

    this.updateCards();

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
      this.options.sitePanel.close();
    }
    this.updatePrompts();
    if (store.focusedId !== this.shownFocus) {
      const previous = this.shownFocus;
      const left = this.records.get(previous);
      if (left) left.lastSeen = Date.now();
      // Opening a sleeping tab wakes it (milestone 10).
      const next = this.views.get(store.focusedId);
      if (next?.isAsleep) {
        next.wake();
        store.update(store.focusedId, { asleep: false });
      }
      if (this.views.has(previous)) this.captureSnapshot(previous);
      this.shownFocus = store.focusedId;
      this.room.focus(store.focusedId, previous !== -1);
      this.updateFill();
      if (!this.openPanelName) {
        const view = this.focusedView;
        if (view?.isStart) this.options.toolbar.focusAddress();
        else this.focusPage(view);
      }
    }
    this.renderTabList();
    void this.updateStar();
    if (newStart && this.ready) void this.refreshStartData();
    this.scheduleSessionSave();
  }

  private updateCards(): void {
    const { store } = this;
    this.room.setCards(
      store.tabs.map((t) => ({
        key: t.id,
        title: t.title,
        loading: t.state === 'loading',
        ...(t.favicon ? { favicon: t.favicon } : {}),
        focused: t.id === store.focusedId,
        private: t.private,
        access: this.tab(t.id).access.length > 0,
        audible: t.audible,
        muted: t.muted,
        asleep: t.asleep,
      })),
    );
    const strip = this.options.tabStrip;
    if (strip.open) strip.tabs = this.tabModels();
    if (this.options.tabSearch.open) this.options.tabSearch.tabs = this.tabModels();
  }

  /** The tabs as the list in the top bar and tab search show them. */
  private tabModels() {
    return this.store.tabs.map((t) => ({
      id: t.id,
      title: t.title,
      url: this.views.get(t.id)?.pendingAddress ?? t.url,
      ...(t.favicon ? { favicon: t.favicon } : {}),
      focused: t.id === this.store.focusedId,
      private: t.private,
      audible: t.audible,
      muted: t.muted,
      asleep: t.asleep,
    }));
  }

  // ---- Tabs and economy (milestone 10) --------------------------------------

  private wireTabs(): void {
    const { tabStrip, tabSearch } = this.options;
    tabStrip.addEventListener('hs-strip-focus', (e) => this.store.focus((e as CustomEvent<number>).detail));
    tabStrip.addEventListener('hs-strip-close', (e) => this.store.close((e as CustomEvent<number>).detail));
    tabStrip.addEventListener('hs-strip-mute', (e) => this.toggleMute((e as CustomEvent<number>).detail));
    tabStrip.addEventListener('hs-new-tab', () => this.store.open());
    tabSearch.addEventListener('hs-tab-pick', (e) => this.store.focus((e as CustomEvent<number>).detail));
    tabSearch.addEventListener('hs-tab-close', (e) => this.store.close((e as CustomEvent<number>).detail));
    tabSearch.addEventListener('hs-tab-search-closed', () => {
      if (!this.openPanelName) this.focusPage();
    });
    const minute = this.options.sleepMinuteMs ?? 60_000;
    window.setInterval(() => this.sleepUnused(), Math.min(30_000, Math.max(100, minute / 2)));
  }

  /** Mutes or unmutes a tab (the speaker on its card or in the lists, or the menu). */
  toggleMute(tabId: number): void {
    const tab = this.store.get(tabId);
    const view = this.views.get(tabId);
    if (!tab || !view) return;
    view.setMuted(!tab.muted);
    this.store.update(tabId, { muted: !tab.muted });
    this.updateToolbar();
  }

  /** Reopens the most recently closed tab where it was, with its back and forward history. */
  reopenClosed(): void {
    const closed = this.closedTabs.pop();
    if (!closed) return;
    this.store.open({
      url: closed.url,
      title: closed.title,
      index: closed.index,
      ...(closed.favicon ? { favicon: closed.favicon } : {}),
      ...(closed.from !== null ? { restoreFrom: closed.from } : {}),
    });
  }

  get closedCount(): number {
    return this.closedTabs.size;
  }

  private searchTabs(): void {
    const search = this.options.tabSearch;
    if (search.open) {
      search.close();
      return;
    }
    search.tabs = this.tabModels();
    search.show();
  }

  /** Card size, how tabs are shown, and economy mode, from Settings and the power source. */
  private applyTabsAndEconomy(): void {
    const s = this.settings;
    const list = s.tabDisplay !== 'cards';
    this.room.setTabLayout({ scale: CARD_SCALES[s.tabSize], display: s.tabDisplay, topExtra: list ? STRIP_HEIGHT : 0 });
    const strip = this.options.tabStrip;
    strip.open = list;
    if (list) strip.tabs = this.tabModels();
    this.economyActive = s.economy === 'on' || (s.economy === 'battery' && this.onBattery);
    this.room.setEconomy(this.economyActive);
    document.documentElement.toggleAttribute('data-economy', this.economyActive);
    this.options.toolbar.economy = this.economyActive;
  }

  /** Test hook: whether economy mode is in effect. */
  get economy(): boolean {
    return this.economyActive;
  }

  /**
   * Puts tabs to sleep that have been out of view long enough (Settings >
   * Economy), except the tab in front and tabs that are loading, making
   * sound, downloading, or holding typed text.
   */
  sleepUnused(): number {
    const minutes = sleepMinutes(this.settings.tabSleep, this.economyActive);
    if (minutes === 0) return 0;
    const now = Date.now();
    let slept = 0;
    for (const tab of this.store.tabs) {
      const view = this.views.get(tab.id);
      if (!view) continue;
      const record = this.tab(tab.id);
      // A tab never out of view counts from now.
      record.lastSeen ??= now;
      const page = view.webContentsId;
      const candidate = {
        focused: tab.id === this.store.focusedId,
        busy: view.isStart || tab.state === 'loading' || tab.state === 'start',
        asleep: view.isAsleep,
        audible: tab.audible,
        downloading: page !== null && this.downloadItems.some((d) => !d.finished && d.webContentsId === page),
        typed: view.typed,
        capturing: view.capturing,
        lastSeen: record.lastSeen,
      };
      if (!shouldSleep(candidate, now, minutes, this.options.sleepMinuteMs)) continue;
      if (view.sleep()) {
        this.store.update(tab.id, { asleep: true, audible: false });
        slept += 1;
      }
    }
    return slept;
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
      onStartExamples: () => this.showExamples(),
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
      restoreHistory: async (from, into) => {
        const reply = await this.options.bridge.tabs({ op: 'restore', tab: into, from });
        return reply.ok && reply.value;
      },
      onHoloml: () => {
        if (id !== this.store.focusedId) return;
        this.updateFill();
        this.updateToolbar();
      },
      },
      tab.private,
      tab.restoreFrom,
    );
    this.views.set(id, view);
    this.records.set(id, newTabRecord());
    this.room.addView(view);
  }

  private onStatus(tabId: number, status: PageStatus): void {
    const tab = this.store.get(tabId);
    const view = this.views.get(tabId);
    if (!tab || !view) return;
    const state: TabState = view.isStart ? 'start' : status.state;
    // An address just typed stays in the bar while it loads: until the new
    // page arrives or fails, the page's "loading" still names the page it
    // is leaving, which flashed the old address back (review of 2026-09-30, R6).
    const record = this.tab(tabId);
    const typed = record.typedLoad;
    if (typed && status.state === 'loading' && status.url === typed.from) {
      status = { state: 'loading', url: typed.to };
    } else if (typed) {
      record.typedLoad = null;
    }
    // A different page starts without the previous page's favicon.
    const newPage = Boolean(status.url) && status.url !== tab.url && !isSamePage(status.url, tab.url);
    this.store.update(tabId, {
      state,
      ...(newPage ? { favicon: undefined } : {}),
      ...(status.url ? { url: status.url } : {}),
      ...(status.title ? { title: status.title } : status.url && tab.title === tab.url ? { title: status.url } : {}),
    });
    if (tabId !== this.store.focusedId) return;
    // The page may have loaded the address the tab already shows: nothing
    // in the tab changed, but the site button's marker did.
    this.updateToolbar();
    // The site panel's choices are for the site it names: it closes when
    // the tab leaves that site, so a change never lands on another one.
    const panel = this.options.sitePanel;
    const left = state === 'failed' || state === 'crashed' || originOf(view.committedUrl) !== panel.site?.origin;
    if (panel.open && panel.site && left) panel.close();
  }

  private scheduleSnapshot(tabId: number): void {
    const record = this.records.get(tabId);
    if (!record) return;
    window.clearTimeout(record.snapshotTimer);
    record.snapshotTimer = window.setTimeout(() => this.captureSnapshot(tabId), SNAPSHOT_DELAY_MS);
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

  private togglePanel(name: PanelName, settingsSection?: 'shortcuts'): void {
    if (this.openPanelName === name && !settingsSection) {
      this.panel(name).close();
      return;
    }
    if (this.openPanelName) {
      // Switching panels: the open one closes itself, so what closing does
      // is done (a shown password is hidden again, a shortcut waiting for
      // its keys stops waiting); the focus to return to is kept.
      this.switchingPanels = true;
      this.panel(this.openPanelName).close();
      this.switchingPanels = false;
    } else {
      this.focusBeforePanel = document.activeElement;
    }
    this.openPanelName = name;
    if (name === 'library') this.options.library.show();
    else if (name === 'downloads') this.options.downloads.show();
    else this.options.settingsPanel.show(settingsSection);
  }

  private panel(name: PanelName): HsLibrary | HsSettings | HsDownloads {
    return name === 'library' ? this.options.library : name === 'downloads' ? this.options.downloads : this.options.settingsPanel;
  }

  /** Focus goes back where it was before the panel opened. */
  private onPanelClosed(): void {
    this.openPanelName = null;
    if (this.switchingPanels) return;
    const before = this.focusBeforePanel;
    this.focusBeforePanel = null;
    if (before === this.options.toolbar) this.options.toolbar.focusAddress();
    else if (before instanceof HTMLElement && before.isConnected && before !== document.body) before.focus();
    else this.focusPage();
  }

  /** The HoloML examples (milestone 17), over everything; again to close. */
  private showExamples(): void {
    const examples = this.options.examples;
    if (examples.open) examples.close();
    else examples.open = true;
  }

  private wirePanels(): void {
    const { library, settingsPanel, downloads, examples } = this.options;
    // An example opens in the tab in front, as a bookmark does.
    examples.addEventListener('hs-open-example', (e) => this.navigate(this.store.focusedId, (e as CustomEvent<string>).detail));
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
    // Settings > Privacy > Passwords opens the Library's Passwords tab.
    settingsPanel.addEventListener('hs-open-passwords', () => {
      library.view = 'passwords';
      this.togglePanel('library');
    });
    // Escape closes an open panel even when the focus is elsewhere in the shell.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.openPanelName) this.panel(this.openPanelName).close();
    });
    // With nothing open for it to close, Escape in the shell stops a loading
    // page, as the Stop button's hint says. What is open is noted before
    // anything handles the key, since closing is what handling it does.
    let free = false;
    document.addEventListener('keydown', (e) => e.key === 'Escape' && (free = !this.escapeTaken), true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && free && !e.defaultPrevented && (this.options.toolbar.loading || this.options.prompts.signIn)) this.stop();
    });
  }

  /**
   * Stop (the button, or Escape with nothing else to close). While a
   * sign-in prompt for the page in front is up, Stop is the prompt's
   * Cancel: the request goes on without a password, and the page that
   * arrives is the site's own "401" page. A prompt too new to take an
   * answer stays (hud/arm.ts). Otherwise whatever is still loading stops.
   */
  private stop(): void {
    if (this.options.prompts.signIn) this.options.prompts.cancelSignIn();
    else this.focusedView?.stop();
  }

  /** Something is open that Escape closes. */
  private get escapeTaken(): boolean {
    const o = this.options;
    return (
      this.openPanelName !== null ||
      o.toolbar.escapeTaken ||
      o.sitePanel.open ||
      o.shield.open ||
      o.findBar.open ||
      o.tabSearch.open ||
      o.about.open ||
      o.examples.open ||
      o.instruments.maximized !== ''
    );
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
    // A HoloML page still loading its models counts as loading: Stop stops them (milestone 15).
    t.loading = tab.state === 'loading' || (this.focusedView?.sceneBusy ?? false);
    t.layers = this.tab(tab.id).layersOn;
    t.private = tab.private;
    // A HoloML page is a 3D scene: no page zoom or layers view (milestone 14).
    const scene = this.focusedView?.isHoloml ?? false;
    t.canZoom = isWeb(tab.url) && tab.state !== 'start' && !scene;
    t.zoom = this.focusedView?.zoom ?? 1;
    t.canLayers = isWeb(tab.url) && tab.state !== 'start' && tab.state !== 'failed' && !scene;
    t.holoml = scene;
    t.textView = this.focusedView?.textView ?? false;
    // The lock is for a page that really loaded over https, not for an
    // address still on its way in or one that failed (a certificate error).
    t.site = siteMarker(tab.state, tab.url, this.focusedView?.committedUrl ?? '');
    t.access = this.tab(tab.id).access;
    t.muted = tab.muted;
    t.canReopen = this.closedTabs.size > 0;
  }

  // ---- Permission prompts, password offers, notices (milestone 9) ----------

  /** Shows the focused tab's first permission prompt, its password offer, and its sign-in prompt. */
  private updatePrompts(): void {
    const record = this.tab(this.store.focusedId);
    this.options.prompts.permission = record.permissionQueue[0] ?? null;
    this.options.prompts.offer = record.offer;
    this.options.prompts.signIn = record.signIn;
  }

  /** A sign-in prompt is over (answered here, or ended by the main process): it leaves its tab. */
  private dropSignIn(id: number): void {
    for (const record of this.records.values()) if (record.signIn?.id === id) record.signIn = null;
    this.updatePrompts();
  }

  private dropPrompt(id: number): void {
    for (const record of this.records.values()) record.permissionQueue = record.permissionQueue.filter((p) => p.id !== id);
    this.updatePrompts();
  }

  /** A password offer is over (answered, or dismissed): it leaves its tab. */
  private dropOffer(id: number): void {
    for (const record of this.records.values()) if (record.offer?.id === id) record.offer = null;
    this.updatePrompts();
  }

  private wirePrompts(): void {
    const { prompts, sitePanel, notice } = this.options;
    prompts.addEventListener('hs-permission-answer', (e) => {
      const { id, answer } = (e as CustomEvent<{ id: number; answer: PromptAnswer }>).detail;
      this.dropPrompt(id);
      void this.permissions.get({ op: 'answer', id, answer }).catch((err: unknown) => console.warn(String(err)));
      this.focusPage();
    });
    // What was typed goes to the main process and on to Chromium; nothing of it is kept here.
    prompts.addEventListener('hs-sign-in-answer', (e) => {
      const { id, typed } = (e as CustomEvent<SignInAnswer>).detail;
      this.dropSignIn(id);
      const request = typed ? ({ op: 'answer', id, ...typed } as const) : ({ op: 'cancel', id } as const);
      void this.options.bridge.signIn(request).then(
        (reply) => {
          if (!reply.ok) console.warn(reply.error);
        },
        (err: unknown) => console.warn(String(err)),
      );
      // Enter in the prompt signs in: the page takes the keyboard once the key is up.
      const view = this.focusedView;
      if (view) this.focusPageAfterEnter(view);
    });
    prompts.addEventListener('hs-password-answer', (e) => {
      const { id, answer } = (e as CustomEvent<{ id: number; answer: OfferAnswer }>).detail;
      this.dropOffer(id);
      void this.passwords.get({ op: 'answer', offer: id, answer }).catch((err: unknown) => console.warn(String(err)));
    });
    prompts.addEventListener('hs-offer-dismissed', (e) => {
      this.dropOffer((e as CustomEvent<number>).detail);
    });
    sitePanel.addEventListener('hs-site-closed', () => this.focusPage());
    notice.addEventListener('hs-notice-action', (e) => {
      const [action, id] = (e as CustomEvent<string>).detail.split(':');
      if (action === 'downloads') this.togglePanel('downloads');
      else if (action === 'open' || action === 'show') {
        void this.options.bridge.downloads({ op: action === 'open' ? 'downloads.open' : 'downloads.show', id: Number(id) });
      }
    });
  }

  /**
   * One notice when a download finishes, and one when it fails (a cancelled
   * one needs none). A broken connection leaves a download interrupted but
   * able to resume; that is told as a failure at once, and if it resumes
   * and completes, that is told too.
   */
  private noticeDownloads(items: DownloadInfo[]): void {
    for (const d of items) {
      const told = this.downloadNotices.get(d.id);
      if (d.state === 'completed' && told !== 'done') {
        this.downloadNotices.set(d.id, 'done');
        this.options.notice.show({
          kind: 'done',
          text: `Downloaded ${d.filename}`,
          actions: [
            { id: `open:${d.id}`, label: 'Open' },
            { id: `show:${d.id}`, label: 'Show in folder' },
          ],
        });
      } else if (d.state === 'interrupted' && told === undefined) {
        this.downloadNotices.set(d.id, 'failed');
        this.options.notice.show({
          kind: 'failed',
          text: `Download failed: ${d.filename}`,
          actions: [{ id: 'downloads', label: 'Downloads' }],
        });
      }
    }
  }

  /** Test hook: what a tab's page was given (the marker). */
  accessOf(tabId: number): PermissionKind[] {
    return this.tab(tabId).access;
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
      if (this.tab(id).layersOn) this.views.get(id)?.sendLayers(this.layersState(id, false));
    }
    this.options.toolbar.searchName = SEARCH_ENGINES[this.settings.searchEngine].name;
    // The menus' key hints follow the person's own shortcuts (milestone 11).
    const platform = this.options.bridge.platform;
    const keys: Record<string, string> = {};
    for (const [name, combos] of bindings(this.settings.shortcuts, platform)) keys[name] = combos[0] ? describeCombo(combos[0], platform) : '';
    this.options.toolbar.keys = keys;
    this.options.themeButton.scheme = theme.scheme;
    this.options.themeButton.themeName = theme.name;
    if (!this.options.tiltFixed) this.room.setTilt(this.settings.pageTilt);
    // The view (milestone 11): which way the page leans, space around it, movement.
    this.room.setView({
      direction: this.settings.tiltDirection === 'left' ? -1 : 1,
      margin: this.settings.pageMargin,
      parallax: this.settings.parallax,
    });
    this.instruments.setSettings(this.settings);
    this.options.toolbar.instruments = this.settings.instruments;
    this.applyTabsAndEconomy();
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

  /**
   * A page opens at its site's saved zoom. A private tab's own changes are
   * not saved: they are kept in memory, per site, while any private tab is
   * open, as its layers choices are.
   */
  private applyZoomOnOpen(tabId: number): void {
    const view = this.views.get(tabId);
    const url = view?.status.url ?? '';
    if (!view || !isWeb(url) || view.isHoloml) return;
    const site = hostOf(url);
    const privateZoom = this.store.get(tabId)?.private ? this.privateZoomSites.get(site) : undefined;
    view.setZoom(privateZoom ?? this.settings.zoomSites[site] ?? 1);
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
    const site = hostOf(tab.url);
    if (tab.private) {
      this.privateZoomSites.set(site, factor);
      return;
    }
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
      // The tab find was running on: when the bar closes for a tab switch,
      // that is still the tab shown, not the one the switch goes to.
      this.views.get(this.shownFocus)?.stopFind();
      this.focusPage();
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
    if (!view || !isWeb(url) || view.isHoloml) return;
    const site = hostOf(url);
    const privateChoice = this.store.get(tabId)?.private ? this.privateLayersSites.get(site) : undefined;
    const on = privateChoice ?? this.settings.layersSites[site] ?? this.settings.layersOnOpen;
    this.tab(tabId).layersOn = on;
    view.sendLayers(this.layersState(tabId, false));
    if (tabId === this.store.focusedId) this.updateToolbar();
  }

  /** The layers button and shortcut: switch the view for the page in front, and remember it for the site. */
  private async toggleLayers(): Promise<void> {
    const tab = this.store.focusedTab;
    const view = this.focusedView;
    if (!tab || !view || view.isStart || !isWeb(tab.url)) return;
    const record = this.tab(tab.id);
    const on = !record.layersOn;
    record.layersOn = on;
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
    shield.count = tab ? this.tab(tab.id).shieldCount : 0;
    if (focusChanged && shield.open) void shield.refresh();
  }

  private wireToolbar(): void {
    const t = this.options.toolbar;
    t.addEventListener('hs-navigate', (e) => this.navigate(this.store.focusedId, (e as CustomEvent<string>).detail));
    // Address bar completion (milestone 11): suggestions from history (in its
    // worker) and bookmarks; "Search ... for" always searches, even for text
    // that looks like an address.
    t.suggest = (text) => this.data.get({ op: 'history.suggest', text, limit: 6 });
    t.forget = async (url) => {
      await this.data.get({ op: 'history.forget-url', url });
    };
    t.addEventListener('hs-search', (e) => {
      const text = (e as CustomEvent<string>).detail;
      this.navigate(this.store.focusedId, this.searchUrl.replace('%s', encodeURIComponent(text)));
    });
    t.addEventListener('hs-back', () => this.focusedView?.goBack());
    t.addEventListener('hs-forward', () => this.focusedView?.goForward());
    t.addEventListener('hs-reload', () => this.focusedView?.reload());
    t.addEventListener('hs-bookmark', () => void this.toggleBookmark());
    t.addEventListener('hs-new-tab', () => this.store.open());
    t.addEventListener('hs-zoom', (e) => void this.zoom((e as CustomEvent<1 | -1 | 0>).detail));
    t.addEventListener('hs-instruments', () => void this.saveSettings({ instruments: !this.settings.instruments }));
    t.addEventListener('hs-layers', () => void this.toggleLayers());
    t.addEventListener('hs-stop', () => this.stop());
    t.addEventListener('hs-text-view', () => {
      const view = this.focusedView;
      view?.setTextView(!view.textView);
    });
    t.addEventListener('hs-menu', (e) => this.onMenu((e as CustomEvent<MenuAction>).detail));
    t.addEventListener('hs-site', () => {
      const panel = this.options.sitePanel;
      if (panel.open) panel.close();
      else void panel.show();
    });
  }

  private onMenu(action: MenuAction): void {
    if (action === 'new-tab') this.store.open();
    else if (action === 'private-tab') this.store.open({ private: true });
    else if (action === 'open-file') void this.openFile();
    else if (action === 'downloads') this.togglePanel('downloads');
    else if (action === 'print') this.print();
    else if (action === 'close-tab') this.store.close(this.store.focusedId);
    else if (action === 'reopen-tab') this.reopenClosed();
    else if (action === 'search-tabs') this.searchTabs();
    else if (action === 'mute-tab') this.toggleMute(this.store.focusedId);
    else if (action === 'library' || action === 'settings') this.togglePanel(action);
    else if (action === 'shortcuts') this.togglePanel('settings', 'shortcuts');
    else if (action === 'examples') this.showExamples();
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
        const tab = tabId === undefined ? undefined : this.store.get(tabId);
        // Only for the page the tab shows: one it has left keeps no favicon of the page before.
        if (tabId !== undefined && tab && isSamePage(command.page, tab.url)) this.store.update(tabId, { favicon: command.dataUrl });
        break;
      }
      case 'shield': {
        const tabId = this.tabForWebContents(command.webContentsId);
        if (tabId === undefined) break;
        this.tab(tabId).shieldCount = command.count;
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
      case 'permission-prompt': {
        const tabId = this.tabForWebContents(command.prompt.webContentsId);
        if (tabId === undefined) break;
        this.tab(tabId).permissionQueue.push(command.prompt);
        this.updatePrompts();
        break;
      }
      case 'permission-ended':
        this.dropPrompt(command.id);
        break;
      case 'sign-in-prompt': {
        const tabId = this.tabForWebContents(command.prompt.webContentsId);
        if (tabId === undefined) {
          // No tab to ask in: the request is cancelled, not left waiting.
          void this.options.bridge.signIn({ op: 'cancel', id: command.prompt.id }).catch(() => undefined);
          break;
        }
        this.tab(tabId).signIn = command.prompt;
        this.updatePrompts();
        break;
      }
      case 'sign-in-ended':
        this.dropSignIn(command.id);
        break;
      case 'audio': {
        const tabId = this.tabForWebContents(command.webContentsId);
        if (tabId !== undefined) this.store.update(tabId, { audible: command.audible });
        break;
      }
      case 'power':
        this.onBattery = command.onBattery;
        this.applyTabsAndEconomy();
        break;
      case 'site-access': {
        const tabId = this.tabForWebContents(command.webContentsId);
        if (tabId === undefined) break;
        this.tab(tabId).access = command.kinds;
        this.updateCards();
        this.updateToolbar();
        if (this.options.sitePanel.open) void this.options.sitePanel.refresh();
        break;
      }
      case 'password-offer': {
        const tabId = this.tabForWebContents(command.offer.webContentsId);
        if (tabId === undefined) break;
        this.tab(tabId).offer = command.offer;
        this.updatePrompts();
        break;
      }
      case 'downloads':
        this.noticeDownloads(command.items);
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
          if (this.options.sitePanel.open) void this.options.sitePanel.refresh();
          // Settings shows what is saved now, not what was when it opened.
          if (this.openPanelName === 'settings') void this.options.settingsPanel.load();
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
      case 'reopen-tab':
        this.reopenClosed();
        break;
      case 'search-tabs':
        this.searchTabs();
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
      case 'open-file':
        void this.openFile();
        break;
      case 'private-tab':
        s.open({ private: true });
        break;
      case 'library':
      case 'settings':
        this.togglePanel(name);
        break;
      case 'examples':
        this.showExamples();
        break;
      case 'text-view': {
        // For a HoloML page only: the main process and the listener above send it for nothing else.
        const view = this.focusedView;
        if (view?.isHoloml) view.setTextView(!view.textView);
        break;
      }
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
   * mirroring the 3D cards. Each tab keeps its button as the list
   * changes (a title, a tab opened or closed), so the keyboard stays on
   * the button it is on; rebuilt each time, the list dropped the focus
   * whenever any page changed its title.
   */
  private renderTabList(): void {
    const list = this.options.tabList;
    const had = new Map<number, HTMLButtonElement>();
    for (const b of list.querySelectorAll<HTMLButtonElement>('button[data-tab-id]')) had.set(Number(b.dataset['tabId']), b);
    const buttons = this.store.tabs.map((tab) => {
      let b = had.get(tab.id);
      had.delete(tab.id);
      if (!b) {
        b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.dataset['tabId'] = String(tab.id);
        b.addEventListener('click', () => this.store.focus(tab.id));
      }
      const selected = tab.id === this.store.focusedId ? 'true' : 'false';
      if (b.getAttribute('aria-selected') !== selected) b.setAttribute('aria-selected', selected);
      const title = tab.title || 'Untitled';
      if (b.textContent !== title) b.textContent = title;
      return b;
    });
    for (const closed of had.values()) closed.remove();
    // Only a button out of place is moved: moving one takes the keyboard off it.
    buttons.forEach((b, i) => {
      if (list.children[i] !== b) list.insertBefore(b, list.children[i] ?? null);
    });
  }
}
