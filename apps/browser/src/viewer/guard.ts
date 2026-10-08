/**
 * No peer connections from a HoloML page (the review of 2026-09-30, M6;
 * made to work in prompt 172).
 *
 * A peer connection is a way out for what a page's script can read: its
 * address for the servers that help connect (STUN and TURN) is any host,
 * and what it sends there, or to a peer, passes no content policy. That
 * matters most for a HoloML file opened from the computer, whose scripts
 * can read the files beside it. The review blocked them with a content
 * policy directive, `webrtc 'block'`, which Chromium does not know and
 * ignores; Electron has no switch to turn peer connections off for one
 * tab. So the viewer takes them out of the page's own JavaScript before
 * any script of the page runs (it adds the scripts itself, main.ts):
 *
 * - The RTC constructors (RTCPeerConnection and the rest) are deleted
 *   from the page's window.
 * - No frame can be made: a frame's window is a fresh one, with every
 *   constructor back. Making an iframe, frame, object, or embed element
 *   is refused, and so is putting one into any tree, or markup that
 *   holds one, whichever way the page tries (the DOM's insertion
 *   methods, innerHTML and its kin; document.write and pasting are
 *   refused altogether, as they can join markup). A HoloML page has
 *   no use for frames: its scene is the viewer's.
 * - The viewer's one frame, the KTX2 transcoder's host (decoders.ts), is
 *   made with the browser's own functions, kept here before the page
 *   could change them, inside a closed shadow root, and sandboxed: its
 *   window is of no origin the page shares, whatever the page has it
 *   load, so the page can neither reach it nor use it.
 * - A new window is refused by the browser already (main/guests.ts
 *   opens a link's tab itself, and gives the page nothing back).
 *
 * Workers have no RTCPeerConnection. The functions changed here cannot
 * be changed back: they are neither writable nor configurable.
 */

const apply = Reflect.apply;
const describe = Object.getOwnPropertyDescriptor;
const define = Object.defineProperty;

/** The elements that hold a window of their own. */
const FRAMES = new Set(['iframe', 'frame', 'frameset', 'object', 'embed', 'portal', 'fencedframe']);
const FRAME_SELECTOR = [...FRAMES].join(',');
/** Markup that opens one of them (with a namespace prefix too, as XML may write it). */
const FRAME_MARKUP = /<\s*(?:[\w.-]+:)?(?:iframe|frame|frameset|object|embed|portal|fencedframe)(?![\w.-])/i;

// The browser's own functions, kept before any script of the page exists (lockRealm, or the first use). Each
// checks what it is called on, so a node passed off as something else is still seen for what it is.
const getter = (proto: object, name: string): ((this: unknown) => unknown) => describe(proto, name)!.get!;
function keepNatives() {
  return {
    nodeType: getter(Node.prototype, 'nodeType'),
    localName: getter(Element.prototype, 'localName'),
    queryElement: Element.prototype.querySelector,
    queryFragment: DocumentFragment.prototype.querySelector,
    queryDocument: Document.prototype.querySelector,
    createElement: Document.prototype.createElement,
    attachShadow: Element.prototype.attachShadow,
    appendChild: Node.prototype.appendChild,
    addEventListener: EventTarget.prototype.addEventListener,
    setShadowHtml: describe(ShadowRoot.prototype, 'innerHTML')!.set!,
    firstElementChild: getter(DocumentFragment.prototype, 'firstElementChild'),
    documentElement: getter(Document.prototype, 'documentElement'),
    contentWindow: getter(HTMLIFrameElement.prototype, 'contentWindow'),
  };
}
let kept: ReturnType<typeof keepNatives> | null = null;
const natives = (): ReturnType<typeof keepNatives> => (kept ??= keepNatives());

/** Is this a frame element, or a tree that holds one? */
export function holdsFrame(node: unknown): boolean {
  if ((typeof node !== 'object' && typeof node !== 'function') || node === null) return false;
  const n = natives();
  let type: unknown;
  try {
    type = apply(n.nodeType, node, []);
  } catch {
    // Not a node: the DOM makes it text.
    return false;
  }
  if (type === 1) return FRAMES.has(String(apply(n.localName, node, [])).toLowerCase()) || apply(n.queryElement, node, [FRAME_SELECTOR]) !== null;
  if (type === 11) return apply(n.queryFragment, node, [FRAME_SELECTOR]) !== null;
  if (type === 9) return apply(n.queryDocument, node, [FRAME_SELECTOR]) !== null;
  return false;
}

/** Does this markup open a frame element? */
export function markupHasFrame(markup: string): boolean {
  return FRAME_MARKUP.test(markup);
}

/** Is this the name of a frame element (a qualified name's prefix aside)? */
export function isFrameName(name: string): boolean {
  return FRAMES.has(name.slice(name.indexOf(':') + 1).toLowerCase());
}

function refused(): DOMException {
  return new DOMException("HoloML pages cannot make frames, nor write markup that could: they would be a way around the page's limits.", 'NotSupportedError');
}

/** Text, once: an object's own toString runs here only, so what is checked is what the browser is given. */
const asText = (value: unknown): unknown => (typeof value === 'string' || value === undefined || value === null ? value : String(value));

/** Wraps a method so that a check of its arguments runs first; `prepare` turns them into what is checked and passed. */
function guardMethod(proto: object | undefined, name: string, refuse: (args: unknown[]) => boolean, prepare: (args: unknown[]) => unknown[] = (a) => a): void {
  const d = proto && describe(proto, name);
  if (!proto || !d || typeof d.value !== 'function') return;
  const native = d.value as (...args: unknown[]) => unknown;
  const wrapped = {
    [name](this: unknown, ...given: unknown[]): unknown {
      const args = prepare(given);
      if (refuse(args)) throw refused();
      return apply(native, this, args);
    },
  }[name]!;
  define(proto, name, { value: wrapped, writable: false, configurable: false, enumerable: d.enumerable ?? false });
}

/** The same for a setter (innerHTML and outerHTML). */
function guardSetter(proto: object | undefined, name: string): void {
  const d = proto && describe(proto, name);
  if (!proto || !d?.set) return;
  const native = d.set;
  define(proto, name, {
    get: d.get,
    set(this: unknown, value: unknown) {
      const text = asText(value);
      if (typeof text === 'string' && markupHasFrame(text)) throw refused();
      apply(native, this, [text]);
    },
    configurable: false,
    enumerable: d.enumerable ?? false,
  });
}

const anyNodeHoldsFrame = (args: unknown[]): boolean => args.some(holdsFrame);
const anyMarkupHasFrame = (args: unknown[]): boolean => args.some((a) => typeof a === 'string' && markupHasFrame(a));
/** Turns the arguments at these places into text once (the markup or a name; options stay as they are). */
const textAt =
  (...places: number[]) =>
  (args: unknown[]): unknown[] =>
    args.map((a, i) => (places.includes(i) ? asText(a) : a));

let locked = false;

/** Takes peer connections and frames out of this page's JavaScript. Run once, before any script of the page. */
export function lockRealm(): void {
  // Only in a page (the viewer's unit tests load it without one).
  if (locked || typeof Node === 'undefined') return;
  locked = true;
  natives();
  const win = window;
  const g = win as unknown as Record<string, unknown>;
  // The constructors: RTCPeerConnection, webkitRTCPeerConnection, and every other RTC interface.
  for (const name of Object.getOwnPropertyNames(win)) {
    if (/^(?:webkit)?RTC/.test(name)) delete g[name];
  }
  // A Picture-in-Picture window of a document is a window of the page's own, with constructors of its own.
  delete g['documentPictureInPicture'];

  // Making a frame element.
  guardMethod(win.Document.prototype, 'createElement', (args) => typeof args[0] === 'string' && isFrameName(args[0]), textAt(0));
  guardMethod(win.Document.prototype, 'createElementNS', (args) => typeof args[1] === 'string' && isFrameName(args[1]), textAt(1));

  // Putting one into a tree.
  for (const name of ['appendChild', 'insertBefore', 'replaceChild']) guardMethod(win.Node.prototype, name, anyNodeHoldsFrame);
  for (const proto of [win.Element.prototype, win.Document.prototype, win.DocumentFragment.prototype]) {
    for (const name of ['append', 'prepend', 'replaceChildren', 'moveBefore']) guardMethod(proto, name, anyNodeHoldsFrame);
  }
  for (const proto of [win.Element.prototype, win.CharacterData.prototype, win.DocumentType.prototype]) {
    for (const name of ['before', 'after', 'replaceWith']) guardMethod(proto, name, anyNodeHoldsFrame);
  }
  guardMethod(win.Element.prototype, 'insertAdjacentElement', anyNodeHoldsFrame);
  guardMethod(win.Range.prototype, 'insertNode', anyNodeHoldsFrame);
  guardMethod(win.Range.prototype, 'surroundContents', anyNodeHoldsFrame);

  // Markup that holds one.
  for (const proto of [win.Element.prototype, win.ShadowRoot.prototype]) {
    guardSetter(proto, 'innerHTML');
    guardMethod(proto, 'setHTMLUnsafe', anyMarkupHasFrame, textAt(0));
    guardMethod(proto, 'setHTML', anyMarkupHasFrame, textAt(0));
  }
  guardSetter(win.Element.prototype, 'outerHTML');
  guardMethod(win.Element.prototype, 'insertAdjacentHTML', anyMarkupHasFrame, textAt(1));
  // document.write joins what it is given across calls ("<ifr", then "ame>"), and once the page has loaded it
  // would replace the viewer's scene: a HoloML page has no use for it.
  for (const name of ['write', 'writeln', 'open']) guardMethod(win.Document.prototype, name, () => true);
  // Pasting puts in whatever markup the clipboard holds.
  guardMethod(win.Document.prototype, 'execCommand', (args) => /^paste$/i.test(String(args[0])) || anyMarkupHasFrame(args), textAt(0, 2));
  guardMethod(win.Range.prototype, 'createContextualFragment', anyMarkupHasFrame, textAt(0));
  guardMethod(win.DOMParser.prototype, 'parseFromString', anyMarkupHasFrame, textAt(0));
  guardMethod(win.Document, 'parseHTMLUnsafe', anyMarkupHasFrame, textAt(0));
}

/**
 * The viewer's own hidden frame (the KTX2 transcoder's host): sandboxed (scripts only, of no origin the page
 * shares), inside a closed shadow root, made and watched with the functions kept above. `onLoad` is given its
 * window when it first loads.
 */
export function hiddenFrame(src: string, title: string, onLoad: (win: Window) => void): void {
  const n = natives();
  const host = apply(n.createElement, document, ['hypersol-frame']) as HTMLElement;
  const root = apply(n.attachShadow, host, [{ mode: 'closed' }]) as ShadowRoot;
  const attribute = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  apply(n.setShadowHtml, root, [`<iframe sandbox="allow-scripts" hidden tabindex="-1" aria-hidden="true" title="${attribute(title)}" src="${attribute(src)}"></iframe>`]);
  const frame = apply(n.firstElementChild, root, []) as HTMLIFrameElement;
  apply(n.addEventListener, frame, [
    'load',
    () => {
      const win = apply(n.contentWindow, frame, []) as Window | null;
      if (win) onLoad(win);
    },
    { once: true },
  ]);
  apply(n.appendChild, apply(n.documentElement, document, []), [host]);
}
