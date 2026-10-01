import type { PagePanel, PageState, PageStatus } from '@hypersol/scene-core';
import type { WebviewTag } from 'electron';
import { BLOCKED_CARD, CRASHED_CARD, DNS_BLOCKED_CARD, describeLoadError, isLookupFailure, type LoadErrorCard } from '../load-errors';
import { PRIVATE_PARTITION, RESTORE_BLANK } from '../../shared/commands';
import { LAYERS_CHANNEL, PAGE_IMAGES_CHANNEL, parseImageReport, type LayersState, type PageImage } from '../../shared/layers';
import { PAGE_STATE_CHANNEL, parsePageState } from '../../shared/page-state';
import { HOLOML_COMMAND_CHANNEL, HOLOML_SHOWN_CHANNEL, HOLOML_STATE_CHANNEL } from '../../shared/holoml-page';
import { StartPanel, type StartData } from './start-panel';

/** Chromium's code for a load that was cancelled by a newer one. */
const ERR_ABORTED = -3;

export interface TabViewEvents {
  onStatus(status: PageStatus): void;
  onNavState(state: { canGoBack: boolean; canGoForward: boolean }): void;
  /** The page finished loading and has painted: a good time for a snapshot. */
  onSettled(): void;
  /** Text submitted in the start panel's search box. */
  onStartSubmit(text: string): void;
  /** A bookmark or history entry chosen on the start panel. */
  onStartOpen(url: string): void;
  /** "All HoloML examples" on the start panel (milestone 17). */
  onStartExamples(): void;
  /** "Open anyway" on a blocked page: let this address through once in this tab. */
  allowOnce(url: string): Promise<void>;
  /** After a failed lookup: true if encrypted DNS is blocked on this network. */
  isDnsBlocked(): Promise<boolean>;
  /** "Use this network's DNS for now". */
  useNetworkDns(): Promise<void>;
  /** A new document is ready in the page: time to tell it the layers view's state. */
  onPageReady(): void;
  /** Find in page results (milestone 8). */
  onFound?(result: { matches: number; active: number }): void;
  /**
   * Puts a closed or sleeping page's back and forward history into this
   * tab's new page (milestone 10); false when there was none to restore.
   */
  restoreHistory?(from: number, into: number): Promise<boolean>;
  /** The page became, or stopped being, a HoloML page (milestone 14). */
  onHoloml?(): void;
}

/**
 * What one tab shows: the start panel until the tab loads an address,
 * then a live Chromium view (an Electron <webview>). The element is
 * created once and never moved in the page: moving a webview reloads it.
 * The room places the element in 3D.
 */
export class TabView implements PagePanel {
  readonly kind = 'live';
  readonly element: HTMLDivElement;
  private webview: WebviewTag | null = null;
  private start: StartPanel | null;
  private readonly shimmer: HTMLDivElement;
  private readonly errorCard: HTMLDivElement;
  private ready = false;
  private pendingUrl: string | null = null;
  private failed = false;
  /** Counts page loads, so a late answer about an earlier failure is ignored. */
  private loadSeq = 0;
  /** The address of the document the page last loaded (not one still on its way, or one that failed). */
  private committed = '';
  private pageImages: PageImage[] = [];
  private currentStatus: PageStatus;
  private w = 0;
  private h = 0;
  /** Muted by the person (milestone 10); kept across sleeping and waking. */
  private mutedByUser = false;
  /** Text typed into a form on the page (milestone 10), from its preload. */
  private typedInForm = false;
  /** The page is capturing from the camera, microphone, or screen (GitHub issue #18). */
  private capturingMedia = false;
  /** The address of the HoloML page this tab shows, as its preload reported it (milestone 14). */
  private holomlUrl: string | null = null;
  /** The HoloML page is still loading models; its text view is on (milestone 15). */
  private holomlBusy = false;
  private holomlTextView = false;
  /**
   * A HoloML page stays muted until its first real click or key (HoloML
   * 0.2, milestone 17; owner, prompt 85, Q5 a): the address it is for, or
   * null. Its page preload, where the page's scripts cannot reach, says
   * when that input came; the tab's own mute is kept apart.
   */
  private soundGateUrl: string | null = null;
  /** The tab is the one in front (milestone 21: a HoloML page behind another draws nothing). */
  private inFront = true;
  /**
   * Asleep (milestone 10): the page is closed to save memory; the tab keeps
   * its address and title, and the page whose history comes back on waking.
   */
  private asleepFrom: { url: string; from: number | null } | null = null;
  /** A new page waiting for a closed page's history (reopening or waking). */
  private restoring: { url: string; from: number } | null = null;

  constructor(
    readonly tabId: number,
    url: string,
    private readonly events: TabViewEvents,
    /** A private tab: its page uses the in-memory private session (milestone 8). */
    readonly isPrivate = false,
    /** A reopened tab: the closed page whose back and forward history it gets (milestone 10). */
    restoreFrom?: number,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'hs-panel';
    this.element.dataset['testid'] = 'page-panel';
    this.element.dataset['tabId'] = String(tabId);

    this.shimmer = document.createElement('div');
    this.shimmer.className = 'hs-shimmer';
    this.errorCard = document.createElement('div');
    this.errorCard.className = 'hs-error-card-layer';
    this.errorCard.dataset['testid'] = 'page-overlay';

    if (url === '') {
      this.start = new StartPanel(
        (text) => this.events.onStartSubmit(text),
        (address) => this.events.onStartOpen(address),
        () => this.events.onStartExamples(),
      );
      if (isPrivate) {
        const note = document.createElement('p');
        note.className = 'hs-private-note';
        note.dataset['testid'] = 'private-note';
        note.textContent = 'Private tab: no history, cookies, or site data are kept. They go when the last private tab closes.';
        this.start.element.prepend(note);
      }
      this.element.append(this.start.element);
      this.currentStatus = { state: 'loaded', url: '' };
    } else {
      this.start = null;
      this.currentStatus = { state: 'loading', url };
      if (restoreFrom !== undefined) this.createRestored(url, restoreFrom);
      else this.createWebview(url);
    }
    this.element.append(this.shimmer, this.errorCard);
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }

  get status(): PageStatus {
    return { ...this.currentStatus };
  }

  get isStart(): boolean {
    return this.start !== null;
  }

  get isAsleep(): boolean {
    return this.asleepFrom !== null;
  }

  /** The address of the document the page last loaded; '' before the first (the site button's marker). */
  get committedUrl(): string {
    return this.webview ? this.committed : '';
  }

  /** The tab shows a HoloML page (milestone 14): its preload said so for the current address. */
  get isHoloml(): boolean {
    return this.holomlUrl !== null && this.webview !== null && this.holomlUrl === withoutHash(this.currentStatus.url);
  }

  /** A HoloML page still loading its models. */
  get sceneBusy(): boolean {
    return this.isHoloml && this.holomlBusy;
  }

  /** A HoloML page shown as text (milestone 15). */
  get textView(): boolean {
    return this.isHoloml && this.holomlTextView;
  }

  /** Switches a HoloML page's text view. */
  setTextView(on: boolean): void {
    if (this.isHoloml) this.sendHoloml(on ? 'text-view-on' : 'text-view-off');
  }

  /**
   * Whether the tab is the one in front (milestone 21). A HoloML page is
   * told, so that it draws no frames while behind another tab; a HoloML
   * page that arrives while its tab is behind is told when it shows.
   */
  setInFront(on: boolean): void {
    if (this.inFront === on) return;
    this.inFront = on;
    if (this.isHoloml) this.sendHoloml(on ? 'in-front' : 'behind');
  }

  /** Stops loading: the page's own load, or a HoloML page's models. */
  stop(): void {
    if (!this.webview || !this.ready) return;
    if (this.sceneBusy) this.sendHoloml('stop');
    else this.webview.stop();
  }

  private sendHoloml(command: string): void {
    try {
      this.webview?.send(HOLOML_COMMAND_CHANNEL, command).catch(() => undefined);
    } catch {
      // Between documents: nothing to stop or switch.
    }
  }

  /** Text typed into a form on the page, not yet sent. */
  get typed(): boolean {
    return this.typedInForm;
  }

  /** Live camera, microphone, or screen capture on the page. */
  get capturing(): boolean {
    return this.capturingMedia;
  }

  get muted(): boolean {
    return this.mutedByUser;
  }

  setMuted(muted: boolean): void {
    this.mutedByUser = muted;
    if (this.webview && this.ready) this.applyMute(this.webview);
  }

  /** The tab's mute, and a HoloML page's sound gate. */
  private applyMute(wv: WebviewTag): void {
    try {
      wv.setAudioMuted(this.mutedByUser || this.soundGateUrl !== null);
    } catch {
      // Not attached yet: dom-ready applies it.
    }
  }

  /** A HoloML page that may not play sound yet (for the tests). */
  get soundGated(): boolean {
    return this.soundGateUrl !== null;
  }

  /**
   * Puts the tab to sleep (milestone 10): its page closes and its memory
   * goes; the tab keeps its address and title. Returns false if it has no
   * page to close.
   */
  sleep(): boolean {
    if (!this.webview || this.asleepFrom) return false;
    const from = this.webContentsId;
    const url = this.restoring?.url ?? this.currentStatus.url;
    this.webview.remove();
    this.webview = null;
    this.ready = false;
    this.restoring = null;
    this.typedInForm = false;
    this.capturingMedia = false;
    this.pageImages = [];
    this.shimmer.removeAttribute('data-visible');
    this.asleepFrom = { url, from };
    return true;
  }

  /** Wakes a sleeping tab: a new page, with the old one's back and forward history. */
  wake(): void {
    const asleep = this.asleepFrom;
    if (!asleep) return;
    this.asleepFrom = null;
    // A tab that slept on a failed load wakes to a fresh load, not under its old error card.
    this.hideError();
    this.failed = false;
    this.emit({ ...this.currentStatus, state: 'loading', url: asleep.url });
    if (asleep.from !== null) this.createRestored(asleep.url, asleep.from);
    else this.createWebview(asleep.url);
  }

  /** The page this tab had before it slept (for reopening a sleeping tab that was closed). */
  get sleepingFrom(): number | null {
    return this.asleepFrom?.from ?? null;
  }

  /** The address a sleeping or restoring tab stands for. */
  get pendingAddress(): string | null {
    return this.asleepFrom?.url ?? this.restoring?.url ?? null;
  }

  /** The <webview>, if the tab shows a page (for the room's pointer tracking). */
  get view(): HTMLElement | null {
    return this.webview;
  }

  /** Available once the page is attached, even if its first load was blocked (no dom-ready yet). */
  get webContentsId(): number | null {
    if (!this.webview) return null;
    try {
      return this.webview.getWebContentsId();
    } catch {
      return null;
    }
  }

  /** The page's images in view, as its preload last reported them (milestone 5). */
  get images(): PageImage[] {
    return this.pageImages.map((i) => ({ ...i }));
  }

  /** The page's zoom factor (1 is 100%). */
  get zoom(): number {
    if (!this.webview || !this.ready) return 1;
    try {
      return this.webview.getZoomFactor();
    } catch {
      return 1;
    }
  }

  setZoom(factor: number): void {
    if (this.webview && this.ready) this.webview.setZoomFactor(factor);
  }

  /**
   * Find in page; an empty text stops finding. `next` moves to the next or
   * previous match of the same search; otherwise a new search starts
   * (Electron's findNext is true for a new search).
   */
  find(text: string, forward: boolean, next: boolean): void {
    if (!this.webview || !this.ready) return;
    if (text === '') {
      this.webview.stopFindInPage('clearSelection');
      this.events.onFound?.({ matches: 0, active: 0 });
      return;
    }
    this.webview.findInPage(text, { forward, findNext: !next });
  }

  stopFind(): void {
    if (this.webview && this.ready) this.webview.stopFindInPage('clearSelection');
  }

  /** Opens the system's print dialog for the page. */
  print(): void {
    if (this.webview && this.ready) void this.webview.print().catch(() => undefined);
  }

  /** Tells the page's preload the layers view's state. */
  sendLayers(state: LayersState): void {
    if (!this.webview || !this.ready) return;
    try {
      this.webview.send(LAYERS_CHANNEL, state).catch(() => undefined);
    } catch {
      // The page is between documents; it asks again when ready.
    }
  }

  /** Bookmarks and recent history for the start panel, if this tab shows it. */
  setStartData(data: StartData): void {
    this.start?.setData(data);
  }

  focusContent(): void {
    if (this.webview) this.webview.focus();
    else this.start?.focus();
  }

  load(url: string): void {
    this.loadSeq += 1;
    this.hideError();
    if (!this.webview) {
      this.start?.element.remove();
      this.start = null;
      this.createWebview(url);
      this.emit({ state: 'loading', url });
      return;
    }
    if (!this.ready) {
      this.pendingUrl = url;
      this.webview.setAttribute('src', url);
      return;
    }
    void this.webview.loadURL(url).catch(() => {
      // Failures are reported through did-fail-load.
    });
  }

  reload(): void {
    if (!this.webview) return;
    this.hideError();
    this.failed = false;
    if (this.ready) this.webview.reload();
  }

  goBack(): void {
    if (this.webview && this.ready && this.webview.canGoBack()) {
      this.hideError();
      this.webview.goBack();
    }
  }

  goForward(): void {
    if (this.webview && this.ready && this.webview.canGoForward()) {
      this.hideError();
      this.webview.goForward();
    }
  }

  setSize(width: number, height: number): void {
    this.w = Math.round(width);
    this.h = Math.round(height);
    this.element.style.width = `${this.w}px`;
    this.element.style.height = `${this.h}px`;
  }

  dispose(): void {
    this.element.remove();
  }

  /**
   * A new page that takes a closed page's history (milestone 10): it starts
   * blank, and once it is ready the main process restores the history,
   * which loads the page that was showing. Without history, it loads the
   * address.
   */
  private createRestored(url: string, from: number): void {
    this.restoring = { url, from };
    // A marked blank address: the main process creates the page without
    // loading anything, since Electron restores history only into a page
    // that has never navigated.
    this.createWebview(RESTORE_BLANK);
  }

  private finishRestore(wv: WebviewTag, attempt = 0): void {
    const pending = this.restoring;
    if (!pending || this.webview !== wv) return;
    const into = this.webContentsId;
    // Just attached, the page's id can take a moment to become available.
    if (into === null && attempt < 40) {
      window.setTimeout(() => this.finishRestore(wv, attempt + 1), 25);
      return;
    }
    const fallback = () => {
      if (this.webview !== wv || this.restoring !== pending) return;
      this.restoring = null;
      // Without the old history: load the address itself.
      void wv.loadURL(pending.url).catch(() => wv.setAttribute('src', pending.url));
    };
    if (into === null || !this.events.restoreHistory) {
      fallback();
      return;
    }
    void this.events.restoreHistory(pending.from, into).then((done) => (done ? this.restored(wv, pending) : fallback()), fallback);
  }

  /**
   * The main process has started putting the history back; the page's own
   * events carry the load from here. If that load already finished while
   * the blank page stood in for it, the tab catches up now.
   */
  private restored(wv: WebviewTag, pending: { url: string; from: number }): void {
    if (this.webview !== wv || this.restoring !== pending) return;
    this.restoring = null;
    let url = '';
    try {
      url = wv.getURL();
    } catch {
      return; // not ready yet: its events will follow
    }
    if (url === '' || url.startsWith('about:') || wv.isLoading()) return;
    this.ready = true;
    this.shimmer.removeAttribute('data-visible');
    this.applyMute(wv);
    this.events.onNavState({ canGoBack: wv.canGoBack(), canGoForward: wv.canGoForward() });
    if (this.failed) return;
    const title = wv.getTitle();
    this.emit({ state: 'loaded', url, ...(title ? { title } : {}) });
    this.events.onPageReady();
    this.events.onSettled();
  }

  private createWebview(url: string): void {
    const wv = document.createElement('webview') as WebviewTag;
    // Without this Electron drops every new-window request before the main
    // process sees it; main/guests.ts decides and always opens a tab instead.
    wv.setAttribute('allowpopups', '');
    // Set before the first address: a webview's session cannot change afterwards.
    if (this.isPrivate) wv.setAttribute('partition', PRIVATE_PARTITION);
    wv.setAttribute('src', url);
    this.webview = wv;
    this.committed = '';
    this.shimmer.setAttribute('data-visible', '');
    // Before the error and shimmer layers, so they cover the page.
    this.element.prepend(wv);
    this.wireEvents(wv);
  }

  private wireEvents(wv: WebviewTag): void {
    const navState = () => {
      if (!this.ready) return;
      this.events.onNavState({ canGoBack: wv.canGoBack(), canGoForward: wv.canGoForward() });
    };
    // A blank page waiting for history never reports ready; once it is
    // attached, the main process can put the old page's history in.
    wv.addEventListener('did-attach', () => {
      if (this.restoring) this.finishRestore(wv);
    });
    wv.addEventListener('dom-ready', () => {
      this.applyMute(wv);
      if (!this.ready) {
        this.ready = true;
        if (this.pendingUrl && this.pendingUrl !== wv.getURL()) {
          const url = this.pendingUrl;
          this.pendingUrl = null;
          this.load(url);
        }
      }
      if (this.restoring) return;
      this.shimmer.removeAttribute('data-visible');
      navState();
      this.events.onPageReady();
    });
    wv.addEventListener('found-in-page', (e) => {
      const r = e.result;
      if (r.finalUpdate !== false) this.events.onFound?.({ matches: r.matches ?? 0, active: r.activeMatchOrdinal ?? 0 });
    });
    wv.addEventListener('ipc-message', (e) => {
      if (e.channel === HOLOML_SHOWN_CHANNEL) {
        this.holomlUrl = typeof e.args[0] === 'string' ? withoutHash(e.args[0]) : null;
        this.holomlBusy = false;
        this.holomlTextView = false;
        // A new HoloML document: no sound until its first click or key.
        this.soundGateUrl = this.holomlUrl;
        this.applyMute(wv);
        if (!this.inFront) this.sendHoloml('behind');
        this.events.onHoloml?.();
        return;
      }
      if (e.channel === HOLOML_STATE_CHANNEL) {
        const change = e.args[0] as { busy?: unknown; textView?: unknown; activated?: unknown; drawn?: unknown } | undefined;
        // The document finished loading before its models did: the card's
        // picture is taken again once the viewer has drawn the scene with
        // nothing left to load (prompt 89).
        if (change?.drawn === true) this.events.onSettled();
        if (typeof change?.busy === 'boolean') this.holomlBusy = change.busy;
        if (typeof change?.textView === 'boolean') this.holomlTextView = change.textView;
        if (change?.activated === true && this.soundGateUrl !== null) {
          this.soundGateUrl = null;
          this.applyMute(wv);
        }
        this.events.onHoloml?.();
        return;
      }
      if (e.channel === PAGE_STATE_CHANNEL) {
        const state = parsePageState(e.args[0]);
        if (state) {
          this.typedInForm = state.typed;
          this.capturingMedia = state.capturing;
        }
        return;
      }
      if (e.channel !== PAGE_IMAGES_CHANNEL) return;
      const images = parseImageReport(e.args[0]);
      if (images) this.pageImages = images;
    });
    wv.addEventListener('did-start-loading', () => {
      this.loadSeq += 1;
      this.pageImages = [];
      this.failed = false;
      // Whatever started the load (the page itself, the right-click menu's
      // Back or Reload), an earlier failure's card does not stay over it.
      this.hideError();
      this.emit({ ...this.currentStatus, state: 'loading', message: undefined });
    });
    wv.addEventListener('did-navigate', (e) => {
      // Another document: a HoloML page's sound gate goes with the page it was for.
      if (this.soundGateUrl !== null && withoutHash(e.url) !== this.soundGateUrl) {
        this.soundGateUrl = null;
        this.applyMute(wv);
      }
      if (this.restoring && e.url !== 'about:blank' && e.url !== RESTORE_BLANK) this.restoring = null;
      // A new document starts with nothing typed and nothing captured.
      this.typedInForm = false;
      this.capturingMedia = false;
      const wasHoloml = this.isHoloml;
      this.committed = e.url;
      this.emit({ ...this.currentStatus, url: e.url });
      if (wasHoloml !== this.isHoloml) this.events.onHoloml?.();
      navState();
    });
    wv.addEventListener('did-navigate-in-page', (e) => {
      if (e.isMainFrame) {
        this.committed = e.url;
        this.emit({ ...this.currentStatus, url: e.url });
      }
      navState();
    });
    wv.addEventListener('page-title-updated', (e) => {
      this.emit({ ...this.currentStatus, title: e.title });
    });
    wv.addEventListener('did-fail-load', (e) => {
      if (!e.isMainFrame || e.errorCode === ERR_ABORTED) return;
      this.failed = true;
      this.shimmer.removeAttribute('data-visible');
      const card = describeLoadError(e.errorCode, e.errorDescription);
      this.showError(card, e.validatedURL);
      this.emit({ state: 'failed', url: e.validatedURL, title: this.currentStatus.title, message: card.title });
      navState();
      if (isLookupFailure(e.errorCode)) void this.checkDns(e.validatedURL);
    });
    wv.addEventListener('did-stop-loading', () => {
      navState();
      if (this.restoring || this.failed || this.currentStatus.state === 'crashed') return;
      this.emit({ ...this.currentStatus, state: 'loaded' });
      this.events.onSettled();
    });
    wv.addEventListener('render-process-gone', () => {
      this.shimmer.removeAttribute('data-visible');
      this.showError(CRASHED_CARD, this.currentStatus.url);
      this.emit({ ...this.currentStatus, state: 'crashed', message: CRASHED_CARD.title });
    });
  }

  /**
   * The privacy shield blocked a page load in this tab. Electron drops a
   * cancelled page load without a failure event, so the main process says
   * so directly; the tab stays on its current page behind the card.
   */
  showBlocked(url: string): void {
    this.failed = true;
    this.shimmer.removeAttribute('data-visible');
    this.showError(BLOCKED_CARD, url);
    this.emit({ state: 'failed', url, title: this.currentStatus.title, message: BLOCKED_CARD.title });
  }

  /** A lookup failed: if encrypted DNS is blocked on this network, say so instead of "not found". */
  private async checkDns(url: string): Promise<void> {
    const seq = this.loadSeq;
    const blocked = await this.events.isDnsBlocked().catch(() => false);
    if (!blocked || seq !== this.loadSeq || !this.failed) return;
    this.showError(DNS_BLOCKED_CARD, url);
    this.emit({ ...this.currentStatus, message: DNS_BLOCKED_CARD.title });
  }

  private showError(card: LoadErrorCard, url: string): void {
    const box = document.createElement('div');
    box.className = 'hs-error-card';
    box.dataset['kind'] = card.kind;
    // Announced by screen readers when it appears, under its heading.
    box.setAttribute('role', 'alert');
    box.setAttribute('aria-labelledby', `hs-error-title-${this.tabId}`);
    const title = document.createElement('h2');
    title.id = `hs-error-title-${this.tabId}`;
    title.textContent = card.title;
    const message = document.createElement('p');
    message.textContent = card.message;
    const address = document.createElement('p');
    address.className = 'hs-error-address';
    address.textContent = url;
    const actions = document.createElement('div');
    actions.className = 'hs-error-actions';
    if (card.canRetry) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.id = 'panel-reload';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => {
        if (card.kind === 'crashed' || !this.webview) this.reload();
        else this.load(url);
      });
      actions.append(retry);
    }
    if (card.action) {
      const through = document.createElement('button');
      through.type = 'button';
      through.id = card.action === 'open-anyway' ? 'panel-open-anyway' : 'panel-use-network-dns';
      through.textContent = card.action === 'open-anyway' ? 'Open anyway' : "Use this network's DNS for now";
      through.addEventListener('click', () => {
        const done = card.action === 'open-anyway' ? this.events.allowOnce(url) : this.events.useNetworkDns();
        void done.then(
          () => this.load(url),
          (e: unknown) => console.warn(e instanceof Error ? e.message : String(e)),
        );
      });
      // The way through comes first: it is what the card is for.
      actions.prepend(through);
    }
    const stayedOn = card.kind === 'blocked' && this.webview && this.ready ? this.webview.getURL() : '';
    if (stayedOn && stayedOn !== url) {
      // A blocked page never replaced the one the tab is on: going back
      // means closing the card and showing that page again.
      const back = document.createElement('button');
      back.type = 'button';
      back.id = 'panel-back';
      back.textContent = 'Go back';
      back.addEventListener('click', () => {
        this.hideError();
        this.failed = false;
        this.emit({ ...this.currentStatus, state: 'loaded', url: stayedOn, message: undefined });
      });
      actions.append(back);
    } else if (this.webview && this.ready && this.webview.canGoBack()) {
      const back = document.createElement('button');
      back.type = 'button';
      back.id = 'panel-back';
      back.textContent = 'Go back';
      back.addEventListener('click', () => this.goBack());
      actions.append(back);
    }
    box.append(title, message, address, actions);
    this.errorCard.replaceChildren(box);
    this.errorCard.setAttribute('data-visible', '');
  }

  private hideError(): void {
    this.errorCard.removeAttribute('data-visible');
    this.errorCard.replaceChildren();
  }

  private emit(status: PageStatus): void {
    // A blank page waiting for its history stands for the page to come.
    if (this.restoring && (status.url === 'about:blank' || status.url === '' || status.url === RESTORE_BLANK)) {
      status = { ...status, url: this.restoring.url, state: 'loading' };
    }
    this.currentStatus = status;
    this.events.onStatus(this.status);
  }
}

/** The address without its fragment. */
function withoutHash(url: string): string {
  const i = url.indexOf('#');
  return i < 0 ? url : url.slice(0, i);
}

export type { PageState };
