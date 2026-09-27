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
 */
import { HoloParseError, check, parse, type ElementNode, type Problem } from '@hypersol/holoml';
import { HolomlView } from './scene';
import { text } from './values';

interface ViewerState {
  ready: boolean;
  error: { code: string; message: string; line: number; column: number } | null;
  problems: Problem[];
  noWebGL: boolean;
  view: HolomlView | null;
}

const state: ViewerState = { ready: false, error: null, problems: [], noWebGL: false, view: null };

/** Read-only facts for the browser's own tests; the page has no scripts of its own. */
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
    lights: () => state.view?.lightsInfo() ?? [],
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
`;

function start(): void {
  const source = document.querySelector('body > pre')?.textContent ?? '';
  document.querySelector('body > pre')?.remove();
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);
  const root = document.createElement('div');
  root.id = 'holoml-root';
  const links = document.createElement('nav');
  links.className = 'holoml-hidden';
  links.setAttribute('aria-label', 'Links in this scene');
  links.dataset['testid'] = 'holoml-links';
  const labels = document.createElement('div');
  labels.id = 'holoml-labels';
  labels.className = 'holoml-hidden';
  document.body.append(root, links, labels);

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

  try {
    state.view = new HolomlView(doc.root, root, links);
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
  state.view.onReady = () => {
    state.ready = true;
  };
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
