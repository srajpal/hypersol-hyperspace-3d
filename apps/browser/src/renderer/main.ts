import './styles.css';
import './hud/toolbar';
import './hud/about';
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
import { DEFAULT_TILT_DEG, clampTilt } from '@hypersol/scene-core';
import { defaultTheme } from '@hypersol/themes';
import type { ShellBridge } from '../shared/commands';
import { App } from './app';
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
about.addEventListener('hs-about-closed', () => app.focusedView?.focusContent());

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

// Read-only hooks for the end-to-end tests; present only in test runs.
if (params.get('test') === '1') {
  const { room, store } = app;
  Object.assign(window, {
    __hypersolShellTest: {
      get ready() {
        return app.ready;
      },
      openPanel: () => app.openPanel,
      ignorePrepareClose: () => {
        app.testIgnorePrepareClose = true;
      },
      frames: () => room.frames,
      layout: () => room.layoutInfo,
      cameraOffset: () => room.parallax.offset,
      parallaxPaused: () => room.parallax.paused,
      pointerLog: () => room.pointerLog,
      projectPagePoint: (u: number, v: number) => room.projectPagePoint(u, v),
      panelQuad: () => room.screenQuad(),
      sceneColors: () => room.sceneColors(),
      status: () => app.focusedView?.status ?? null,
      tabs: () =>
        store.tabs.map((t) => ({
          id: t.id,
          url: t.url,
          title: t.title,
          state: t.state,
          focused: t.id === store.focusedId,
          hasSnapshot: room.hasSnapshot(t.id),
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
      tabDisplay: () => ({ ...room.display_, railVisible: room.railVisible, strip: document.querySelector('hs-tab-strip')!.open }),
      revealRail: () => room.reveal(),
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
        return { permission: p.permission, offer: p.offer };
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
    },
  });
}
