/**
 * Tells the shell when the person has typed into a form on this page and
 * not sent it (milestone 10), so the tab is never put to sleep with unsent
 * text. The typed text itself never leaves the page.
 *
 * GitHub issue #17: edits count wherever the person makes them that this
 * page can see: in the page, in frames of the same site inside it (at any
 * depth), and in shadow roots (an open one's field precisely; typing into
 * a closed one, whose fields cannot be read, counts as an edit until the
 * page changes). A field counts while it still differs from how the page
 * first showed it, so sending or resetting the form (or the page clearing
 * the field) ends it; a submit that the page stops keeps the text, and so
 * keeps the tab awake. Frames from other sites cannot be seen from here.
 */
import { tellShell } from './page-state';

/** Fields typed into since the page loaded. */
const edited = new Set<Element>();
/** Typed into something this page cannot read (a closed shadow root). */
let opaque = false;

/** An element, from this page or a frame inside it (frames are other realms, so no instanceof). */
function isElement(el: unknown): el is Element {
  return typeof el === 'object' && el !== null && (el as Node).nodeType === 1;
}

function isField(el: EventTarget | null | undefined): el is Element {
  if (!isElement(el)) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !['button', 'submit', 'reset', 'image', 'hidden'].includes((el as HTMLInputElement).type);
  return (el as HTMLElement).isContentEditable === true;
}

/** Still different from how the page first showed it (a removed field's text is gone). */
function unsent(el: Element): boolean {
  if (!el.isConnected) return false;
  const tag = el.tagName;
  if (tag === 'INPUT') {
    const input = el as HTMLInputElement;
    if (input.type === 'checkbox' || input.type === 'radio') return input.checked !== input.defaultChecked;
    return input.value !== input.defaultValue;
  }
  if (tag === 'TEXTAREA') {
    const area = el as HTMLTextAreaElement;
    return area.value !== area.defaultValue;
  }
  if (tag === 'SELECT') return [...(el as HTMLSelectElement).options].some((o) => o.selected !== o.defaultSelected);
  return true; // editable text has no first value to compare with
}

function update(): void {
  tellShell({ typed: opaque || [...edited].some(unsent) });
}

function onInput(e: Event): void {
  if (!e.isTrusted) return;
  // The field itself, even inside an open shadow root (the event's target
  // outside it is the shadow root's host).
  const origin = e.composedPath()[0];
  if (isField(origin)) edited.add(origin);
  else if (isElement(origin) && origin.shadowRoot === null && origin.tagName.includes('-')) opaque = true;
  update();
}

/** After the page's own handlers: a stopped submit keeps its text; a sent or reset form does not. */
function later(): void {
  setTimeout(update, 0);
}

/**
 * Documents being watched. A frame keeps its window when its first, blank
 * document is replaced, but not what was listening in it: so each new
 * document is watched, not each window.
 */
const watched = new WeakSet<Document>();

function watch(doc: Document): void {
  if (watched.has(doc)) return;
  watched.add(doc);
  doc.addEventListener('input', onInput, true);
  doc.addEventListener('submit', later, true);
  doc.addEventListener('reset', later, true);
  doc.addEventListener('focusout', later, true);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => observeFrames(doc), { once: true });
  else observeFrames(doc);
}

/** A document's frames, now and as they are added. */
function observeFrames(doc: Document): void {
  if (!doc.documentElement) return;
  doc.querySelectorAll('iframe, frame').forEach((f) => frame(f as HTMLIFrameElement));
  // Frames added later (only added nodes are looked at).
  new MutationObserver((records) => {
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (!isElement(node)) continue;
        if (node.tagName === 'IFRAME' || node.tagName === 'FRAME') frame(node as HTMLIFrameElement);
        else if (node.firstElementChild) node.querySelectorAll('iframe, frame').forEach((f) => frame(f as HTMLIFrameElement));
      }
    }
  }).observe(doc.documentElement, { childList: true, subtree: true });
}

const hooked = new WeakSet<Element>();

/** A frame of the same site: watch its document now and after each load. */
function frame(f: HTMLIFrameElement): void {
  const hook = () => {
    try {
      const doc = f.contentDocument;
      if (doc) watch(doc);
    } catch {
      // Another site's frame: not readable from this page.
    }
  };
  if (!hooked.has(f)) {
    hooked.add(f);
    f.addEventListener('load', hook);
  }
  hook();
}

if (window === window.top) watch(document);
