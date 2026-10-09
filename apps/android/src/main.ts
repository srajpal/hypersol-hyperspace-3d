/**
 * The room's page in HyperSpace 3D for Android (milestone 24): the
 * desktop's own 3D room, top bar, start panel, and HoloML examples, with
 * the tabs kept by the app. Where the desktop puts a Chromium view, the
 * room places a stand-in (stand-in.ts), and after each frame the page's
 * outline goes to the app, which draws the real page over it.
 */
import '../../browser/src/renderer/styles.css';
import './android.css';
import '../../browser/src/renderer/hud/toolbar';
import '../../browser/src/renderer/hud/examples';
import { DEFAULT_TILT_DEG } from '@hypersol/scene-core';
import { daylight, nebula, type Theme } from '@hypersol/themes';
import type { HsExamples } from '../../browser/src/renderer/hud/examples';
import type { HsToolbar, MenuAction } from '../../browser/src/renderer/hud/toolbar';
import { Room } from '../../browser/src/renderer/scene/room';
import { StartPanel } from '../../browser/src/renderer/scene/start-panel';
import { applyThemeCss } from '../../browser/src/renderer/themes/apply';
import { DEFAULT_SEARCH_URL, resolveInput } from '../../browser/src/renderer/url';
import { parseFromApp, post, quadChanged, type TabState, type ToApp } from './bridge';
import { StandIn } from './stand-in';

/** What the top bar leaves out on Android until a later milestone brings it (bookmarks, zoom, the instruments, and so on). */
const NOT_YET: readonly string[] = [
  'new-tab-more',
  'zoom',
  'instruments',
  'layers',
  'look-around',
  'star',
  'private-tab',
  'open-file',
  'search-tabs',
  'mute-tab',
  'downloads',
  'print',
  'library',
  'settings',
  'shortcuts',
  'about',
];

const dark = window.matchMedia('(prefers-color-scheme: dark)');
const themeNow = (): Theme => (dark.matches ? nebula : daylight);
let theme = themeNow();
applyThemeCss(document.documentElement, theme);

const toolbar = document.querySelector('hs-toolbar') as HsToolbar;
const examples = document.querySelector('hs-examples') as HsExamples;
toolbar.omit = NOT_YET;

const room = new Room(document.getElementById('room')!, theme, {
  tiltDeg: DEFAULT_TILT_DEG,
  callbacks: {
    onCardClick: (key) => post(key === 'plus' ? { type: 'new-tab' } : { type: 'focus', id: key }),
    onCardClose: (key) => post({ type: 'close', id: key }),
  },
  economyFullResolution: true,
  // Looking around the room is the desktop's for now (milestone 27, owner, prompt 192, Q4 a).
  lookAround: false,
});
// The tablet draws the room lighter: at most 30 frames a second, no glow; at
// the display's own resolution, as half of it blurred the cards (prompt 160).
room.setEconomy(true);
dark.addEventListener('change', () => {
  theme = themeNow();
  applyThemeCss(document.documentElement, theme);
  room.setTheme(theme);
});

const views = new Map<number, StandIn>();
const starts = new Map<number, StartPanel>();
let tabs: TabState[] = [];
let focused: number | null = null;
let lighter = true;

const focusedTab = (): TabState | undefined => tabs.find((t) => t.id === focused);

/** Typed text or an address: opened in the tab in front, or searched for. */
function go(text: string, newTab = false): void {
  const result = resolveInput(text, DEFAULT_SEARCH_URL);
  if (result) post({ type: 'open', url: result.url, newTab });
}

function startPanel(id: number): StartPanel {
  let panel = starts.get(id);
  if (!panel) {
    panel = new StartPanel(
      (text) => go(text),
      (url) => post({ type: 'open', url }),
      () => (examples.open = true),
    );
    panel.element.append(lighterSwitch());
    starts.set(id, panel);
  }
  return panel;
}

/** The start panel's switch for the HoloML viewer's lighter drawing (on by default). */
function lighterSwitch(): HTMLElement {
  const label = document.createElement('label');
  label.className = 'hs-start-lighter';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = lighter;
  box.dataset['setting'] = 'lighter';
  box.addEventListener('change', () => {
    lighter = box.checked;
    for (const other of document.querySelectorAll<HTMLInputElement>('input[data-setting="lighter"]')) other.checked = lighter;
    post({ type: 'lighter', on: lighter });
  });
  label.append(box, ' Lighter 3D drawing for HoloML pages: smoother on a tablet, less sharp');
  return label;
}

function showTabs(next: TabState[], nextFocused: number | null, canReopen: boolean): void {
  tabs = next;
  for (const t of next) {
    if (views.has(t.id)) continue;
    const view = new StandIn(t.id);
    views.set(t.id, view);
    room.addView(view);
  }
  for (const id of [...views.keys()]) {
    if (next.some((t) => t.id === id)) continue;
    room.removeView(id);
    views.delete(id);
    starts.delete(id);
  }
  for (const t of next) views.get(t.id)!.setContent(t.url === '' ? startPanel(t.id).element : null);
  room.setCards(
    next.map((t) => ({
      key: t.id,
      title: t.crashed ? 'This page stopped working' : t.title || (t.url === '' ? 'New tab' : t.url),
      loading: t.loading,
      focused: t.id === nextFocused,
    })),
  );
  if (nextFocused !== null && nextFocused !== focused) room.focus(nextFocused, focused !== null);
  focused = nextFocused;
  const tab = focusedTab();
  toolbar.url = tab?.url ?? '';
  toolbar.canGoBack = tab?.canGoBack ?? false;
  toolbar.canGoForward = tab?.canGoForward ?? false;
  toolbar.canReload = (tab?.url ?? '') !== '';
  toolbar.loading = tab?.loading ?? false;
  toolbar.site = tab?.url.startsWith('https://') ? 'secure' : tab?.url.startsWith('http://') ? 'insecure' : 'none';
  toolbar.canReopen = canReopen;
  if (tab?.url === '') starts.get(tab.id)?.focus();
  room.requestRender();
}

// ---- The page's outline, for the app -----------------------------------------

let covered = false;
let lastQuad: Extract<ToApp, { type: 'quad' }> | null = null;

function sendQuad(): void {
  const tab = focusedTab();
  const showsPage = tab !== undefined && tab.url !== '' && !tab.crashed;
  const layout = room.layoutInfo;
  const quad = showsPage ? room.screenQuad().flatMap((p) => [p.x, p.y]) : [];
  const next: Extract<ToApp, { type: 'quad' }> = {
    type: 'quad',
    id: tab?.id ?? -1,
    visible: showsPage && quad.every(Number.isFinite),
    quad,
    width: layout.panelWidth,
    height: layout.panelHeight,
    dpr: window.devicePixelRatio,
  };
  if (!quadChanged(lastQuad, next)) return;
  lastQuad = next;
  post(next);
}
room.onDrawn = sendQuad;

/** A menu, the suggestions, or a dialog over the page: the app hides the page, and its picture shows instead. */
function watchCover(): void {
  const check = () => {
    const shadow = toolbar.shadowRoot;
    const open = examples.open || (shadow !== null && shadow.querySelector('[role="menu"], #suggestions') !== null);
    if (open === covered) return;
    covered = open;
    post({ type: 'covered', on: open });
  };
  void toolbar.updateComplete.then(() => {
    if (toolbar.shadowRoot) new MutationObserver(check).observe(toolbar.shadowRoot, { childList: true, subtree: true });
  });
  new MutationObserver(check).observe(examples, { attributes: true, attributeFilter: ['open'] });
}
watchCover();

// ---- The top bar and the examples ------------------------------------------------

toolbar.addEventListener('hs-navigate', (e) => go((e as CustomEvent<string>).detail));
toolbar.addEventListener('hs-search', (e) => post({ type: 'open', url: DEFAULT_SEARCH_URL.replace('%s', encodeURIComponent((e as CustomEvent<string>).detail)) }));
toolbar.addEventListener('hs-back', () => post({ type: 'back' }));
toolbar.addEventListener('hs-forward', () => post({ type: 'forward' }));
toolbar.addEventListener('hs-reload', () => post({ type: 'reload' }));
toolbar.addEventListener('hs-stop', () => post({ type: 'stop' }));
toolbar.addEventListener('hs-new-tab', () => post({ type: 'new-tab' }));
toolbar.addEventListener('hs-menu', (e) => {
  const action = (e as CustomEvent<MenuAction>).detail;
  if (action === 'new-tab') post({ type: 'new-tab' });
  else if (action === 'close-tab' && focused !== null) post({ type: 'close', id: focused });
  else if (action === 'reopen-tab') post({ type: 'reopen' });
  else if (action === 'examples') examples.open = true;
});
examples.addEventListener('hs-open-example', (e) => post({ type: 'open', url: (e as CustomEvent<string>).detail }));

// ---- A swipe to the left on a tab's card closes it ---------------------------------

const canvas = document.querySelector('#room canvas');
let swipe: { x: number; y: number; key: number } | null = null;
canvas?.addEventListener('pointerdown', (e) => {
  const p = e as PointerEvent;
  const hit = room.cardHit(p.clientX, p.clientY);
  swipe = hit && hit.key !== 'plus' ? { x: p.clientX, y: p.clientY, key: hit.key } : null;
});
canvas?.addEventListener('pointerup', (e) => {
  const p = e as PointerEvent;
  if (swipe && swipe.x - p.clientX > 70 && Math.abs(p.clientY - swipe.y) < 50) post({ type: 'close', id: swipe.key });
  swipe = null;
});

// ---- Messages from the app ---------------------------------------------------------

(window as unknown as { hyperspace: { receive(message: unknown): void } }).hyperspace = {
  receive(message: unknown) {
    const m = parseFromApp(message);
    if (!m) return;
    if (m.type === 'tabs') showTabs(m.tabs, m.focused, m.canReopen);
    else if (m.type === 'snapshot') {
      views.get(m.id)?.setPicture(m.dataUrl);
      room.setSnapshot(m.id, m.dataUrl);
    } else if (m.type === 'tilt') {
      room.parallax.setPointer(m.x, -m.y);
      room.requestRender();
    } else if (m.type === 'settings') {
      lighter = m.lighter;
      for (const box of document.querySelectorAll<HTMLInputElement>('input[data-setting="lighter"]')) box.checked = lighter;
    }
  },
};
post({ type: 'ready' });
