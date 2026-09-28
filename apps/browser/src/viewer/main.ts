/**
 * The HoloML viewer (milestone 14). The page preload (preload/holoml.ts)
 * adds this script to a HoloML page, which Chromium shows as plain text:
 * it reads the text, checks it, and draws the scene. It runs in the tab's
 * own sandboxed page process, like any page's script, and the page's
 * content policy lets it load only from the page's own site.
 *
 * Mistakes (owner, prompt 65, Q5 a): a syntax error shows a card with its
 * line and column; problems the checker finds go to the console (the
 * instrument panel's console lists them), and the rest of the scene shows.
 *
 * HoloML 0.2 (milestone 17): the page's own scripts run after the scene is
 * built, with the scene API (api.ts), from the page's own site only.
 */
import { HoloParseError, check, parse, type ElementNode, type Problem } from '@hypersol/holoml';
import { HolomlView } from './scene';
import { installApi } from './api';
import { LIMITS } from './budget';
import { attr, text } from './values';

interface ViewerState {
  ready: boolean;
  error: { code: string; message: string; line: number; column: number } | null;
  problems: Problem[];
  noWebGL: boolean;
  view: HolomlView | null;
  textView: boolean;
  source: string[];
  title: string;
}

const state: ViewerState = { ready: false, error: null, problems: [], noWebGL: false, view: null, textView: false, source: [], title: '' };

/**
 * Read-only facts for the browser's own tests and for the instrument
 * panel's Scene part (the main process reads them only from pages it
 * marked as HoloML, and checks what it reads: a 0.2 page's own scripts
 * run in this same page).
 */
Object.defineProperty(window, '__holoml', {
  value: {
    get ready() {
      return state.ready;
    },
    get error() {
      return state.error;
    },
    get problems() {
      return state.problems.map((p) => ({ ...p }));
    },
    get noWebGL() {
      return state.noWebGL;
    },
    get frames() {
      return state.view?.frames ?? 0;
    },
    get busy() {
      return state.view?.busy ?? false;
    },
    view: () => state.view?.view ?? null,
    models: () => JSON.parse(JSON.stringify(state.view?.models.map(({ src, state: s, materials, animation }) => ({ src, state: s, materials, animation })) ?? [])),
    labels: () => state.view?.labels.map((l) => l.text) ?? [],
    links: () => state.view?.links.map((l) => l.href) ?? [],
    object: (id: string) => state.view?.objectInfo(id) ?? null,
    point: (which: string | number) => state.view?.screenPoint(which) ?? null,
    linkAt: (x: number, y: number) => state.view?.linkHrefAt(x, y) ?? null,
    lights: () => state.view?.lightsInfo() ?? [],
    leftOut: () => state.view?.leftOut ?? [],
    highlight: () => state.view?.highlightInfo ?? null,
    /** HoloML 0.2 (milestone 17): sounds, whether sound may play yet, screen text, the walker, and how the scene is drawn. */
    sounds: () => JSON.parse(JSON.stringify(state.view?.sounds.reports ?? [])),
    get soundsActive() {
      return state.view?.sounds.active ?? false;
    },
    huds: () => [...document.querySelectorAll<HTMLElement>('.holoml-hud')].map((h) => ({ id: h.dataset['id'] ?? null, text: h.innerText, hidden: h.hidden })),
    /** The sliders (HoloML 0.2, milestone 18): label, value, range, and corner. */
    sliders: () =>
      [...document.querySelectorAll<HTMLElement>('.holoml-slider')].map((s) => {
        const input = s.querySelector('input')!;
        return {
          id: s.dataset['id'] ?? null,
          label: s.querySelector('span')?.textContent ?? '',
          value: Number(input.value),
          min: Number(input.min),
          max: Number(input.max),
          step: Number(input.step),
          corner: (s.parentElement as HTMLElement | null)?.dataset['corner'] ?? null,
        };
      }),
    walker: () => state.view?.walkerInfo ?? null,
    stats: () => state.view?.stats ?? null,
    get version() {
      return state.view?.pageVersion ?? null;
    },
    get textView() {
      return state.textView;
    },
    /** The Tab order: each outline item's kind of element and its text. */
    outline: () => [...document.querySelectorAll('#holoml-outline li > a, #holoml-outline li > button')].map((e) => `${e.tagName.toLowerCase()}:${e.textContent}`),
    /** The inspector's picture of the scene (issue #28). */
    scene: () => {
      const v = state.view;
      const sel = v?.selectedIndex ?? -1;
      const e = v?.entries[sel];
      return JSON.parse(
        JSON.stringify({
          title: state.title,
          // The first 2,000 go to the inspector's tree each second; the rest are counted.
          entryCount: v?.entries.length ?? 0,
          entries: (v?.entries ?? []).slice(0, 2_000).map((x, i) => ({
            index: i,
            kind: x.kind,
            name: x.name,
            depth: x.depth,
            line: x.el.start.line,
            column: x.el.start.column,
            state: x.report?.state,
            reason: x.report?.reason,
          })),
          selected: sel,
          picking: v?.pickingNow ?? false,
          detail: e
            ? { ...v!.entryInfo(sel), line: e.el.start.line, column: e.el.start.column, source: state.source[e.el.start.line - 1] ?? '' }
            : null,
          problems: state.problems,
          error: state.error,
          models: (v?.models ?? []).map(({ src, state: st, reason, bytes, triangles }) => ({ src, state: st, reason, bytes, triangles })),
          totals: { bytes: v?.budget.bytes ?? 0, triangles: v?.budget.triangles ?? 0 },
          leftOutElements: v?.leftOutElements ?? 0,
        }),
      );
    },
    select: (index: number) => state.view?.select(index),
    pick: (on: boolean) => state.view?.setPicking(on),
  },
});

const STYLE = `
  :root { color-scheme: dark; font-family: system-ui, "Segoe UI", sans-serif; }
  #holoml-root { position: fixed; inset: 0; }
  #holoml-root canvas { display: block; width: 100%; height: 100%; touch-action: none; outline: none; }
  .holoml-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .holoml-hidden a:focus { outline: none; }
  .holoml-card { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); max-width: min(680px, calc(100vw - 48px));
    background: #161a2e; color: #eef1ff; border: 1px solid #ff6b81; border-radius: 12px; padding: 20px 24px; box-shadow: 0 16px 48px #0008; }
  .holoml-card h1 { font-size: 18px; margin: 0 0 8px; color: #ff9aaa; }
  .holoml-card p { margin: 6px 0; line-height: 1.45; }
  .holoml-card pre { background: #0b0e1c; padding: 10px 12px; border-radius: 8px; overflow-x: auto; font-size: 13px; }
  #holoml-notice { position: fixed; left: 16px; bottom: 16px; max-width: min(520px, calc(100vw - 32px)); background: #161a2ee6; color: #eef1ff;
    border: 1px solid #ffb36b; border-radius: 10px; padding: 10px 14px; font-size: 13px; line-height: 1.4; }
  #holoml-notice[hidden] { display: none; }
  #holoml-notice ul { margin: 6px 0 0; padding-left: 18px; }
  /* HoloML 0.2: screen text in the corners, and the crosshair. */
  #holoml-hud-layer { position: fixed; inset: 0; pointer-events: none; }
  .holoml-hud-corner { position: absolute; display: flex; flex-direction: column; gap: 8px; max-width: min(46vw, 520px); }
  .holoml-hud-corner[data-corner="top-left"] { left: 16px; top: 16px; }
  .holoml-hud-corner[data-corner="top-right"] { right: 16px; top: 16px; align-items: flex-end; text-align: right; }
  .holoml-hud-corner[data-corner="bottom-left"] { left: 16px; bottom: 16px; }
  /* Clear of HyperSpace 3D's own buttons, which sit over the page's lower right corner. */
  .holoml-hud-corner[data-corner="bottom-right"] { right: 16px; bottom: 72px; align-items: flex-end; text-align: right; }
  .holoml-hud { color: #f2f4ff; font-weight: 600; line-height: 1.35; text-shadow: 0 1px 3px #000c, 0 0 1px #000; }
  .holoml-hud[hidden] { display: none; }
  .holoml-slider { pointer-events: auto; display: flex; align-items: center; gap: 10px; color: #f2f4ff; font-weight: 600; font-size: 16px;
    text-shadow: 0 1px 3px #000c, 0 0 1px #000; }
  .holoml-slider input { width: 150px; margin: 0; accent-color: #7fd8ff; cursor: pointer; }
  .holoml-slider input:focus-visible { outline: 2px solid #7fd8ff; outline-offset: 4px; border-radius: 4px; }
  .holoml-crosshair { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; transform: translate(-50%, -50%); }
  .holoml-crosshair::before, .holoml-crosshair::after { content: ''; position: absolute; background: #ffffffd9; box-shadow: 0 0 2px #000; }
  .holoml-crosshair::before { left: 10px; top: 0; width: 2px; height: 22px; }
  .holoml-crosshair::after { left: 0; top: 10px; width: 22px; height: 2px; }
  .holoml-crosshair[hidden] { display: none; }
  /* The text view (issue #25): the outline as a plain page, no 3D. */
  body.holoml-text-view #holoml-root { display: none; }
  body.holoml-text-view #holoml-outline-nav { position: static; width: auto; height: auto; overflow: visible; clip-path: none; white-space: normal;
    max-width: 760px; margin: 32px auto; padding: 0 24px; color: #eef1ff; font-size: 17px; line-height: 1.6; }
  body.holoml-text-view { overflow: auto !important; }
  body.holoml-text-view #holoml-outline-nav h1 { font-size: 26px; }
  body.holoml-text-view #holoml-outline-nav button { all: unset; cursor: default; }
  body.holoml-text-view #holoml-outline-nav a { color: #7fd8ff; }
  body.holoml-text-view #holoml-hud-layer { position: static; max-width: 760px; margin: 0 auto 32px; padding: 0 24px; }
  body.holoml-text-view .holoml-hud-corner { position: static; max-width: none; align-items: flex-start; text-align: left; }
  body.holoml-text-view .holoml-hud { color: #eef1ff !important; text-shadow: none; font-size: 17px !important; }
  body.holoml-text-view .holoml-crosshair { display: none; }
`;

function start(): void {
  const source = document.querySelector('body > pre')?.textContent ?? '';
  document.querySelector('body > pre')?.remove();
  state.source = source.split(/\r\n|\r|\n/);
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);
  const root = document.createElement('div');
  root.id = 'holoml-root';
  // The outline (issue #25): the scene's title, links, and named things in
  // page order. Tab moves through it; screen readers read it; the text
  // view shows it as a page.
  const nav = document.createElement('nav');
  nav.id = 'holoml-outline-nav';
  nav.className = 'holoml-hidden';
  nav.setAttribute('aria-label', 'Scene outline');
  nav.dataset['testid'] = 'holoml-links';
  const heading = document.createElement('h1');
  const list = document.createElement('ul');
  list.id = 'holoml-outline';
  nav.append(heading, list);
  const labels = document.createElement('div');
  labels.id = 'holoml-labels';
  labels.className = 'holoml-hidden';
  const notice = document.createElement('section');
  notice.id = 'holoml-notice';
  notice.setAttribute('role', 'status');
  notice.dataset['testid'] = 'holoml-notice';
  notice.hidden = true;
  // HoloML 0.2: screen text and the crosshair, over the scene.
  const hudLayer = document.createElement('div');
  hudLayer.id = 'holoml-hud-layer';
  document.body.append(root, nav, hudLayer, labels, notice);

  // The page's own text, over its limit, is not read at all (issue #23).
  const bytes = new TextEncoder().encode(source).length;
  if (bytes > LIMITS.pageBytes) {
    document.title = 'HoloML page too large';
    showCard('This HoloML page is too large', [`It is ${(bytes / 1048576).toFixed(1)} MB; a HoloML page may be at most ${LIMITS.pageBytes / 1048576} MB.`], null);
    state.error = { code: 'page-too-large', message: 'The page is larger than 2 MB', line: 1, column: 1 };
    state.ready = true;
    return;
  }

  let doc;
  try {
    doc = parse(source);
  } catch (e) {
    if (!(e instanceof HoloParseError)) throw e;
    state.error = { code: e.code, message: e.detail, line: e.position.line, column: e.position.column };
    document.title = 'HoloML page with a mistake';
    showSyntaxError(e, source);
    state.ready = true;
    return;
  }
  // A checker failure must not blank the page: the scene still shows
  // (holoml issue #1, fixed in HoloML 0.1.1).
  try {
    state.problems = check(doc);
  } catch (e) {
    console.warn(`HoloML: the page could not be fully checked (${e instanceof Error ? e.message : String(e)}).`);
  }
  for (const p of state.problems) console.warn(`HoloML: line ${p.line}, column ${p.column}: ${p.message}`);

  const title = doc.root.children.find((c): c is ElementNode => c.type === 'element' && c.name === 'head')
    ?.children.find((c): c is ElementNode => c.type === 'element' && c.name === 'title');
  if (title && text(title)) document.title = text(title);
  state.title = document.title;
  heading.textContent = title && text(title) ? text(title) : 'HoloML scene';

  try {
    state.view = new HolomlView(doc.root, root, list, hudLayer);
  } catch (e) {
    state.noWebGL = true;
    showCard(
      "This computer can't draw 3D scenes",
      [
        'HoloML pages need WebGL 2, and Chromium could not start it here. This happens without a graphics driver, in some virtual machines, or when WebGL is switched off.',
        e instanceof Error ? e.message : '',
      ],
      null,
    );
    state.ready = true;
    return;
  }
  const view = state.view;
  let whenReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => (whenReady = resolve));
  // The tab card's picture (prompt 89): the shell takes it once the scene
  // has been drawn with nothing left to load and the view still (a walker
  // that starts in the air has landed), after it is ready and after each
  // later loading (a script's models). The first frame can take a while
  // to draw, so being ready is not enough.
  let drawnToTell = false;
  view.onReady = () => {
    state.ready = true;
    whenReady();
    showLeftOut(view, notice);
    drawnToTell = true;
  };
  view.onDrawn = () => {
    if (!drawnToTell || view.busy || !view.viewSettled) return;
    drawnToTell = false;
    window.postMessage({ hypersolHolomlDrawn: true }, '*');
  };
  view.onLeftOut = () => showLeftOut(view, notice);
  // Loading a moment (a script adding a block) is not "loading" for the top
  // bar: busy is told only when it lasts.
  let busyTimer: number | undefined;
  let told = false;
  view.onBusy = (busy) => {
    window.clearTimeout(busyTimer);
    if (busy) {
      busyTimer = window.setTimeout(() => {
        told = true;
        window.postMessage({ hypersolHolomlBusy: true }, '*');
      }, 150);
    } else if (told) {
      told = false;
      window.postMessage({ hypersolHolomlBusy: false }, '*');
    }
  };
  if (view.busy) view.onBusy(true);
  showLeftOut(view, notice);
  if (view.pageVersion === '0.2') {
    installApi(view, ready);
    runScripts(doc.root, state.problems);
  }
  // Esc stops whatever is still loading (issue #23).
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && view.busy) view.stop();
    // Ctrl+Shift+V (Cmd+Shift+V on macOS): the text view, on HoloML pages only.
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      setTextView(!state.textView);
    }
  });
  // From the browser, through the page's preload: stop, and the text view.
  window.addEventListener('message', (e) => {
    const command = (e.data as { hypersolHolomlCommand?: unknown } | null)?.hypersolHolomlCommand;
    if (e.source !== window || typeof command !== 'string') return;
    if (command === 'stop') view.stop();
    else if (command === 'text-view-on' || command === 'text-view-off') setTextView(command === 'text-view-on');
  });
}

/**
 * The page's scripts (HoloML 0.2): JavaScript modules from the page's own
 * site, in document order. A script element with a problem (no src, not
 * a .js or .mjs file, code written inside it) is not run, and no script
 * from another site is (the page's content policy refuses it too).
 */
function runScripts(root: ElementNode, problems: Problem[]): void {
  const head = root.children.find((c): c is ElementNode => c.type === 'element' && c.name === 'head');
  const scripts = head?.children.filter((c): c is ElementNode => c.type === 'element' && c.name === 'script') ?? [];
  const origin = new URL(document.baseURI).origin;
  for (const el of scripts) {
    const at = `line ${el.start.line}, column ${el.start.column}`;
    const src = attr(el, 'src');
    const flawed = problems.some((p) => p.line === el.start.line || (el.children.length > 0 && p.code === 'text-not-allowed'));
    if (!src || flawed || el.children.some((c) => c.type === 'text' && c.value.trim() !== '')) {
      console.warn(`HoloML: the script at ${at} was not run: a script is a file named in "src", with nothing written inside it.`);
      continue;
    }
    let url: URL;
    try {
      url = new URL(src.trim(), document.baseURI);
    } catch {
      console.warn(`HoloML: the script "${src}" was not run: its address is not valid.`);
      continue;
    }
    if (url.origin !== origin) {
      console.warn(`HoloML: the script "${src}" was not run: scripts load only from the page's own site.`);
      continue;
    }
    if (!/\.(m?js)$/i.test(url.pathname)) {
      console.warn(`HoloML: the script "${src}" was not run: a script must be a .js or .mjs file.`);
      continue;
    }
    const script = document.createElement('script');
    script.type = 'module';
    // Added one after another, they run in document order.
    script.async = false;
    script.src = url.href;
    document.head.append(script);
  }
}

/** The notice of what was left out, and why (issue #23). */
function showLeftOut(view: HolomlView, notice: HTMLElement): void {
  const items = view.leftOut;
  notice.hidden = items.length === 0;
  if (items.length === 0) return;
  const head = document.createElement('strong');
  head.textContent = items.length === 1 ? 'One thing on this page was left out' : `${items.length} things on this page were left out`;
  const list = document.createElement('ul');
  for (const { what, why } of items.slice(0, 20)) {
    const li = document.createElement('li');
    li.textContent = `${what}: ${why}`;
    list.append(li);
  }
  notice.replaceChildren(head, list);
}

/** The text view (issue #25): the outline as a plain page. */
function setTextView(on: boolean): void {
  state.textView = on;
  document.body.classList.toggle('holoml-text-view', on);
  state.view?.requestFrame();
  window.postMessage({ hypersolHolomlTextView: on }, '*');
}

function showSyntaxError(e: HoloParseError, source: string): void {
  const line = source.split(/\r\n|\r|\n/)[e.position.line - 1] ?? '';
  const caret = `${' '.repeat(Math.max(0, e.position.column - 1))}^`;
  showCard('This HoloML page has a mistake', [e.detail, `Line ${e.position.line}, column ${e.position.column}:`], `${line}\n${caret}`);
}

function showCard(heading: string, lines: string[], code: string | null): void {
  const card = document.createElement('section');
  card.className = 'holoml-card';
  card.setAttribute('role', 'alert');
  card.dataset['testid'] = 'holoml-error';
  const h = document.createElement('h1');
  h.textContent = heading;
  card.append(h);
  for (const l of lines.filter(Boolean)) {
    const p = document.createElement('p');
    p.textContent = l;
    card.append(p);
  }
  if (code !== null) {
    const pre = document.createElement('pre');
    pre.textContent = code;
    card.append(pre);
  }
  document.body.append(card);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
