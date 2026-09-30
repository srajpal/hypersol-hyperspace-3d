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
 *
 * Review 134: a page of a version the viewer does not know is refused
 * (V2); the browser's commands come in, and the scene's state goes out,
 * over a line the page's scripts cannot reach (V10); and the hooks the
 * browser's tests use are on the page only in a test run (D12).
 */
import { HoloParseError, check, parse, type ElementNode, type Problem } from '@hypersol/holoml';
import { HolomlView } from './scene';
import { installApi } from './api';
import { LIMITS } from './budget';
import { attr, ownProblems, text } from './values';
import { VERSIONS, atLeast, pageVersion } from './versions';

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
 * The test run's mark (review 134, D12). The page's preload, which the
 * page cannot touch, puts it on the viewer's own script element in the
 * browser's test runs; it is read here, before any script of the page
 * can run, and taken off again.
 */
const mark = document.querySelector('script[data-hypersol-holoml-test]');
const testRun = mark !== null;
mark?.removeAttribute('data-hypersol-holoml-test');

/**
 * The private line to the page's preload (review 134, V10): the browser's
 * commands come in over it (stop, the text view, behind another tab), and
 * the scene's state goes out (loading, the text view, drawn). The viewer
 * asks for it as it starts, before any script of the page exists, and the
 * page's scripts run only once it is here, so a page's script can neither
 * take its place nor post the browser's commands itself: a message on
 * the window is no longer a command.
 */
const line = new Promise<MessagePort>((resolve) => {
  const heard = (e: MessageEvent) => {
    const port = e.ports[0];
    if (e.source !== window || (e.data as { hypersolHolomlLine?: unknown } | null)?.hypersolHolomlLine !== true || !port) return;
    window.removeEventListener('message', heard);
    resolve(port);
  };
  window.addEventListener('message', heard);
  window.postMessage({ hypersolHolomlViewer: true }, '*');
});

/** Tells the browser of the scene's state, over the private line (in order, once it is there). */
function tell(what: { busy: boolean } | { textView: boolean } | { drawn: true }): void {
  void line.then((port) => port.postMessage(what));
}

/**
 * The instrument panel's Scene part (issue #28): the inspector's picture
 * of the scene, read-only facts that the main process reads only from
 * pages it marked as HoloML, and checks field by field (a 0.2 page's own
 * scripts run in this same page).
 */
function sceneFacts(): unknown {
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
}

/**
 * What every HoloML page has on its window, in every run (review 134,
 * D12): only what the instrument panel's Scene part uses. `scene` is
 * read-only. `select` and `pick` act, on the page's own scene alone (they
 * outline a thing, and make the next click choose one): the main process
 * calls them by name in the page (main/inspect), so they stay here until
 * it sends them over the private line instead. The object is frozen: a
 * page's script cannot put its own answers in their place.
 */
const inspector = {
  scene: sceneFacts,
  select: (index: number) => state.view?.select(index),
  pick: (on: boolean) => state.view?.setPicking(on),
};

/**
 * Read-only facts for the browser's own tests, and a few things they do.
 * On the page only in a test run (HYPERSOL_TEST=1), never in a normal one.
 */
const testHooks = {
  ...inspector,
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
  models: () => JSON.parse(JSON.stringify(state.view?.models.map(({ src, state: s, materials, animation, standsInFor }) => ({ src, state: s, materials, animation, standsInFor })) ?? [])),
  labels: () => state.view?.labels.map((l) => l.text) ?? [],
  links: () => state.view?.links.map((l) => l.href) ?? [],
  object: (id: string) => state.view?.objectInfo(id) ?? null,
  point: (which: string | number) => state.view?.screenPoint(which) ?? null,
  rect: (id: string) => state.view?.screenRect(id) ?? null,
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
  /** The choices (milestone 18): label, corner, options, and the chosen value. */
  choices: () => JSON.parse(JSON.stringify(state.view?.choicesInfo ?? [])),
  /** Shadows: the lights and meshes that cast them, and why a page's were left out, if they were. */
  shadows: () => state.view?.shadowsInfo ?? null,
  /** HoloML 0.2's third part (milestone 19): panels, click actions, places, the sky, the floor plan, and the fade. */
  panels: () => JSON.parse(JSON.stringify(state.view?.panelsInfo ?? [])),
  actions: () => JSON.parse(JSON.stringify(state.view?.actionsInfo ?? [])),
  places: () => JSON.parse(JSON.stringify(state.view?.placesInfo ?? null)),
  sky: () => state.view?.skyInfo ?? null,
  plan: () => JSON.parse(JSON.stringify(state.view?.planInfo ?? null)),
  fade: () => JSON.parse(JSON.stringify(state.view?.fadeInfo ?? null)),
  /** Loading by area (milestone 20): the groups, their models and stand-ins; every model with a stand-in; and what the page's files count now. */
  areas: () => JSON.parse(JSON.stringify(state.view?.areasInfo ?? [])),
  standIns: () => JSON.parse(JSON.stringify(state.view?.standInsInfo ?? [])),
  totals: () => state.view?.totals ?? null,
  /** Water and sounds from a place (milestone 21): the water's box, look, and moving light; how much a point has faded into it from where the viewer is; and how loud a sound from a place is in each ear now. */
  water: () => JSON.parse(JSON.stringify(state.view?.waterInfo ?? null)),
  waterFadeAt: (point: [number, number, number]) => state.view?.waterFadeAt(point) ?? 0,
  soundLevels: (id: string) => state.view?.soundLevels(id) ?? null,
  /** Whether the page's tab is behind another (milestone 21): it draws nothing then. */
  get behind() {
    return state.view?.isBehind ?? false;
  },
  /** New shaders compile without blocking the page (milestone 21): true until the scene is drawn with them. */
  get compiling() {
    return state.view?.shadersCompiling ?? false;
  },
  /** The page's panorama of the surroundings: its address, whether it arrived, and how brightly it lights the scene. */
  environment: () => state.view?.environmentInfo ?? null,
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
  /** Review 134: how the scene is drawn (in software: at half its sharpness, without smoothed edges), and what is past the limits on lights. */
  drawing: () => state.view?.drawingInfo ?? null,
  lightLimits: () => state.view?.lightLimitsInfo ?? null,
};

Object.defineProperty(window, '__holoml', { value: Object.freeze(testRun ? testHooks : inspector) });

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
  /* Choices (milestone 18): a group of radio buttons, drawn as a row of options; the buttons themselves stay for the keyboard and screen readers. */
  .holoml-choice { pointer-events: auto; min-width: 0; margin: 0; padding: 8px 10px 10px; border: 1px solid #ffffff2e; border-radius: 12px;
    background: #0d1124c7; color: #f2f4ff; font-size: 14px; backdrop-filter: blur(6px); }
  .holoml-choice legend { float: left; width: 100%; padding: 0; margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #c9d3ff; }
  .holoml-choice legend[hidden] { display: none; }
  .holoml-options { clear: both; display: flex; flex-wrap: wrap; gap: 6px; }
  .holoml-options label { position: relative; display: inline-flex; align-items: center; padding: 5px 12px; border: 1px solid #ffffff40;
    border-radius: 999px; font-weight: 600; cursor: pointer; user-select: none; }
  .holoml-options label:hover { border-color: #ffffffa0; }
  .holoml-options input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  .holoml-options label:has(input:checked) { background: #7fd8ff; border-color: #7fd8ff; color: #0b0f1e; }
  .holoml-options label:has(input:focus-visible) { outline: 2px solid #7fd8ff; outline-offset: 2px; }
  /* Milestone 19: the floor plan, with the viewer's place and the way they face; and the fade between places and pages. */
  .holoml-plan { position: relative; margin: 0; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 4px 18px #0007; }
  .holoml-plan[hidden] { display: none; }
  .holoml-plan img { display: block; width: 100%; height: auto; }
  .holoml-plan-marker { position: absolute; left: 0; top: 0; width: 28px; height: 28px; transform: translate(-50%, -50%); }
  .holoml-plan-marker[hidden] { display: none; }
  .holoml-plan-marker::before { content: ''; position: absolute; left: 5px; top: -4px; border-left: 9px solid transparent; border-right: 9px solid transparent;
    border-bottom: 18px solid #e8453cb3; }
  .holoml-plan-marker::after { content: ''; position: absolute; left: 8px; top: 8px; width: 8px; height: 8px; border-radius: 50%; background: #e8453c;
    border: 2px solid #fff; box-shadow: 0 0 2px #000a; }
  #holoml-fade { position: fixed; inset: 0; background: #000; opacity: 0; pointer-events: none; }
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
  /* The window itself scrolls the text, so Page Down, the arrows, and the space bar scroll it with nothing in focus (review 134, V8). */
  html:has(> body.holoml-text-view) { overflow: visible !important; }
  body.holoml-text-view #holoml-outline-nav h1 { font-size: 26px; }
  body.holoml-text-view #holoml-outline-nav button { all: unset; cursor: default; }
  body.holoml-text-view #holoml-outline-nav a { color: #7fd8ff; }
  body.holoml-text-view #holoml-hud-layer { position: static; max-width: 760px; margin: 0 auto 32px; padding: 0 24px; }
  body.holoml-text-view .holoml-hud-corner { position: static; max-width: none; align-items: flex-start; text-align: left; }
  body.holoml-text-view .holoml-hud { color: #eef1ff !important; text-shadow: none; font-size: 17px !important; }
  body.holoml-text-view .holoml-crosshair { display: none; }
  body.holoml-text-view .holoml-choice { background: none; backdrop-filter: none; font-size: 16px; }
  body.holoml-text-view .holoml-panel-words p { margin: 4px 0 12px; }
  body.holoml-text-view #holoml-fade, body.holoml-text-view .holoml-plan-marker { display: none; }
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

  // A version this viewer does not know is refused, not guessed at (SPEC.md section 11; review 134, V2).
  const version = pageVersion(doc.root);
  if (version === null) {
    const written = doc.root.attributes.find((a) => a.name === 'version')!;
    const known = VERSIONS.join(' and ');
    state.error = { code: 'unsupported-version', message: `This browser reads HoloML ${known}, not "${written.value}"`, line: written.start.line, column: written.start.column };
    document.title = 'HoloML page of another version';
    showCard(
      'This HoloML page is written for another version',
      [`The page is written in HoloML "${written.value}", which this browser does not read yet. It reads HoloML ${known}.`, 'A newer HyperSpace 3D may show it.'],
      null,
    );
    state.ready = true;
    return;
  }

  try {
    state.view = new HolomlView(doc.root, root, list, hudLayer, version);
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
    // Not while the page is dark in a fade (milestone 19): the card shows the scene.
    if (!drawnToTell || view.busy || !view.viewSettled || view.fading) return;
    drawnToTell = false;
    tell({ drawn: true });
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
        tell({ busy: true });
      }, 150);
    } else if (told) {
      told = false;
      tell({ busy: false });
    }
  };
  if (view.busy) view.onBusy(true);
  showLeftOut(view, notice);
  if (atLeast(view.pageVersion, '0.2')) {
    installApi(view, ready);
    // Once the private line is here: no script of the page runs before the viewer has it.
    void line.then(() => runScripts(doc.root, state.problems));
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
  // From the browser, through the page's preload, over the private line: stop, the text view, and whether
  // its tab is behind another (milestone 21). Commands sent before the scene was built waited in the line.
  void line.then((port) => {
    port.onmessage = (e) => {
      const command: unknown = e.data;
      if (command === 'stop') view.stop();
      else if (command === 'text-view-on' || command === 'text-view-off') setTextView(command === 'text-view-on');
      else if (command === 'behind' || command === 'in-front') view.setBehind(command === 'behind');
    };
  });
}

/**
 * The page's scripts (HoloML 0.2): JavaScript modules from the page's own
 * site, in document order. A script element with a problem (no src, not
 * a .js or .mjs file, code written inside it) is not run, and no script
 * from another site is (the page's content policy refuses it too). Only
 * a problem of the script element itself counts: one of another element
 * on the same line does not stop it (review 134, V10).
 */
function runScripts(root: ElementNode, problems: Problem[]): void {
  const head = root.children.find((c): c is ElementNode => c.type === 'element' && c.name === 'head');
  const scripts = head?.children.filter((c): c is ElementNode => c.type === 'element' && c.name === 'script') ?? [];
  const origin = new URL(document.baseURI).origin;
  for (const el of scripts) {
    const at = `line ${el.start.line}, column ${el.start.column}`;
    const src = attr(el, 'src');
    const flawed = ownProblems(el, problems).length > 0;
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
  // The scene stops while it is hidden: it takes no keys, so they scroll the text, and draws nothing (review 134, V8).
  state.view?.setTextView(on);
  // Back in the scene, which fills the window, the text's place is forgotten.
  if (!on) window.scrollTo(0, 0);
  tell({ textView: on });
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
