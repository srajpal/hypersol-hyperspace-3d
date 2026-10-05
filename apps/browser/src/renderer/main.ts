// The end-to-end tests read this file for the type of the test hooks (at
// the end), outside the app's own type check: the types for the styles
// and pictures imported here and below come with it.
/// <reference types="vite/client" />
import './styles.css';
import './hud/toolbar';
import './hud/about';
import './hud/examples';
import './hud/library';
import './hud/settings';
import './hud/shield';
import './hud/theme-button';
import './hud/instruments';
import './hud/find-bar';
import './hud/downloads';
import './hud/prompts';
import './hud/site-panel';
import './hud/notice';
import './hud/tab-strip';
import './hud/tab-search';
import './hud/room-message';
import { DEFAULT_TILT_DEG, clampTilt } from '@hypersol/scene-core';
import { defaultTheme } from '@hypersol/themes';
import type { ShellBridge } from '../shared/commands';
import { App } from './app';
import { SEARCH_PAUSE_MS } from './hud/library';
import { setExampleUrl, setExamplesBase } from './examples';
import type { CardPart } from './scene/tab-card';
import { applyThemeCss } from './themes/apply';

const params = new URLSearchParams(location.search);
const tiltParam = params.get('tilt');
const bridge = (window as unknown as { hypersol: ShellBridge }).hypersol;

applyThemeCss(document.documentElement, defaultTheme);

const toolbar = document.querySelector('hs-toolbar')!;
const about = document.querySelector('hs-about')!;
about.appVersion = params.get('appVersion') ?? '';
about.electron = bridge.versions.electron;
about.chrome = bridge.versions.chrome;
// Closing puts the focus back where it was; when that is gone (a menu entry), the page takes it.
about.addEventListener('hs-about-closed', (e) => {
  if (!(e as CustomEvent<boolean>).detail) app.focusPage();
});

// Test runs only: the HoloML examples (or just the showroom) from local copies.
if (params.get('examplesBase')) setExamplesBase(params.get('examplesBase')!);
if (params.get('showroomUrl')) setExampleUrl('showroom', params.get('showroomUrl')!);
const examples = document.querySelector('hs-examples')!;
examples.addEventListener('hs-examples-closed', (e) => {
  if (!(e as CustomEvent<boolean>).detail) app.focusPage();
});

const app = new App({
  startUrl: params.get('startUrl') ?? '',
  tiltDeg: tiltParam === null ? DEFAULT_TILT_DEG : clampTilt(Number(tiltParam)),
  // A tilt from the command line wins over Settings > Page tilt.
  tiltFixed: tiltParam !== null,
  ...(params.get('searchUrl') ? { searchUrlOverride: params.get('searchUrl')! } : {}),
  theme: defaultTheme,
  bridge,
  roomElement: document.getElementById('room') as HTMLElement,
  toolbar,
  about,
  examples,
  library: document.querySelector('hs-library')!,
  settingsPanel: document.querySelector('hs-settings')!,
  shield: document.querySelector('hs-shield')!,
  themeButton: document.querySelector('hs-theme-button')!,
  instruments: document.querySelector('hs-instruments')!,
  findBar: document.querySelector('hs-find-bar')!,
  downloads: document.querySelector('hs-downloads')!,
  prompts: document.querySelector('hs-prompts')!,
  sitePanel: document.querySelector('hs-site-panel')!,
  notice: document.querySelector('hs-notice')!,
  tabStrip: document.querySelector('hs-tab-strip')!,
  tabSearch: document.querySelector('hs-tab-search')!,
  ...(params.get('test') === '1' && params.get('sleepMinuteMs') ? { sleepMinuteMs: Number(params.get('sleepMinuteMs')) } : {}),
  testMode: params.get('test') === '1',
  tabList: document.getElementById('tab-list') as HTMLElement,
});
void app.start();
// Without WebGL 2 the room is not drawn; say so plainly (owner, prompt 60).
if (!app.room.drawsRoom) document.querySelector('hs-room-message')!.open = true;

/**
 * Read-only hooks for the end-to-end tests. Made only in test runs (the
 * main process says when, with "test=1" in the shell's address), and put
 * on the window as __hypersolShellTest.
 */
function testHooks() {
  const { room, store } = app;
  return {
    get ready() {
      return app.ready;
    },
    openPanel: () => app.openPanel,
    ignorePrepareClose: () => {
      app.testIgnorePrepareClose = true;
    },
    frames: () => room.frames,
    drawsRoom: () => room.drawsRoom,
    holoml: () => ({ fill: room.filling, shown: app.focusedView?.isHoloml ?? false }),
    showUrl: (url: string) => app.showUrl(url),
    layout: () => room.layoutInfo,
    cameraOffset: () => room.parallax.offset,
    parallaxPaused: () => room.parallax.paused,
    pointerLog: () => room.pointerLog,
    projectPagePoint: (u: number, v: number) => room.projectPagePoint(u, v),
    panelQuad: () => room.screenQuad(),
    sceneColors: () => room.sceneColors(),
    status: () => app.focusedView?.status ?? null,
    cardPicture: (tabId: number) => room.snapshotSrc(tabId),
    tabs: () =>
      store.tabs.map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        state: t.state,
        focused: t.id === store.focusedId,
        hasSnapshot: room.hasSnapshot(t.id),
        snapshotAt: room.snapshotAt(t.id),
        hasFavicon: Boolean(t.favicon),
        canGoBack: t.canGoBack,
        private: t.private,
        canGoForward: t.canGoForward,
        audible: t.audible,
        muted: t.muted,
        asleep: t.asleep,
      })),
    closedCount: () => app.closedCount,
    sleepNow: () => app.sleepUnused(),
    economy: () => ({ on: app.economy, pixelRatio: room.pixelRatio, devicePixelRatio: window.devicePixelRatio, frames: room.frames }),
    tabDisplay: () => ({ ...room.tabLayout, railVisible: room.railVisible, strip: document.querySelector('hs-tab-strip')!.open }),
    view: () => room.view,
    showSetting: (id: string) => document.querySelector('hs-settings')!.reveal(id),
    librarySearchTimes: () => {
      const library = document.querySelector('hs-library')!;
      return { pauseMs: SEARCH_PAUSE_MS, times: library.searchTimes, busy: library.busy };
    },
    focusedTabId: () => store.focusedId,
    cardPoint: (key: number | 'plus', part: CardPart) => room.cardPoint(key, part),
    rail: () => room.rail,
    railVisible: () => room.railVisible,
    animating: () => room.animating,
    webContentsIdOf: (tabId: number) => app.viewOf(tabId)?.webContentsId ?? null,
    layersOf: (tabId: number) => app.layersState(tabId),
    theme: () => app.theme.id,
    zoom: () => ({ factor: app.focusedView?.zoom ?? 1, label: document.querySelector('hs-toolbar')!.zoom }),
    find: () => {
      const bar = document.querySelector('hs-find-bar')!;
      return { open: bar.open, matches: bar.matchCount, active: bar.active };
    },
    prints: () => app.testPrints,
    prompts: () => {
      const p = document.querySelector('hs-prompts')!;
      return { permission: p.permission, offer: p.offer, signIn: p.signIn, signInArmed: p.signInArmed };
    },
    accessOf: (tabId: number) => app.accessOf(tabId),
    notice: () => document.querySelector('hs-notice')!.notice,
    sitePanel: () => {
      const p = document.querySelector('hs-site-panel')!;
      return { open: p.open, site: p.site };
    },
    downloads: () => app.downloadsList,
    instruments: () => {
      const el = document.querySelector('hs-instruments')!;
      return {
        open: el.open,
        polling: app.instruments.running,
        parts: el.parts,
        page: el.page,
        net: el.net.length,
        console: el.consoleEntries.map((e) => `${e.level}:${e.message}`),
        gauges: el.gauges,
      };
    },
    tilt: () => room.tiltDeg,
    layers: () => {
      const id = store.focusedId;
      return { on: app.layersState(id), images: app.focusedView?.images ?? [] };
    },
    shield: () => {
      const s = document.querySelector('hs-shield')!;
      return { count: s.count, disabled: s.disabled, open: s.open };
    },
  };
}

/** The hooks the end-to-end tests call, for their types (tests/e2e/harness.ts). */
export type ShellTestHooks = ReturnType<typeof testHooks>;

if (params.get('test') === '1') {
  document.querySelector('hs-library')!.keepSearchTimes = true;
  Object.assign(window, { __hypersolShellTest: testHooks() });
}
