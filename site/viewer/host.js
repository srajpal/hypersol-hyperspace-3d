// The host of the HoloML viewer on an ordinary browser's page (the
// promotion plan's step 4, GitHub issue #91). It does what the browser's
// page preload (apps/browser/src/preload/holoml.ts) and HyperSpace 3D for
// Android (HolomlPage.kt) do for a HoloML page: fetches the page's text,
// keeps it in a hidden <pre>, adds the viewer's script, and answers the
// viewer's one request for its private line, over which it sends the
// viewer its commands (stop, the text view, behind or in front) and hears
// its state (busy, drawn, the text view, the description). Nothing is sent
// anywhere but the page's own address, and nothing is kept.
//
// What the page may load is the content policy's business (index.html).
// The <base> element gives the viewer the page's own address, so the page's
// relative paths resolve as in the browser, and "the page's own site" is
// the page's; the policy then lets scripts run only from this site's origin.

const VIEWER = new URL('assets/viewer.js', import.meta.url).href;
/** No more of a page is read than the viewer's own limit of text (SPEC.md, the limits; 2 MB). */
const TEXT_LIMIT = 2 * 1024 * 1024;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

const root = document.documentElement;
const bar = document.getElementById('bar');
const titleEl = document.getElementById('title');
const textViewButton = document.getElementById('text-view');
const stopButton = document.getElementById('stop');
const notice = document.getElementById('notice');
const note = document.getElementById('note');
const noteTitle = document.getElementById('note-title');
const noteText = document.getElementById('note-text');
const noteHelp = document.getElementById('note-help');

/** Shows why the page is not shown, with the help text. */
function refuse(title, text) {
  noteTitle.textContent = title;
  noteText.textContent = text;
  noteHelp.hidden = false;
  note.hidden = false;
  root.dataset.state = 'refused';
}

/** A line at the bottom of the scene, for the viewer's host to say something. */
function say(text) {
  notice.textContent = text;
  notice.hidden = text === '';
}

/** An address the host fetches: https, or http on this computer. */
function allowed(url) {
  return url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
}

// The private line to the viewer (apps/browser/src/preload/holoml.ts).
let line = null;
const waiting = [];
function send(command) {
  if (line) line.postMessage(command);
  else waiting.push(command);
}
function heard(e) {
  const data = e.data;
  if (typeof data !== 'object' || data === null) return;
  if (typeof data.busy === 'boolean') {
    root.dataset.busy = String(data.busy);
    stopButton.hidden = !data.busy;
  }
  if (typeof data.textView === 'boolean') {
    root.dataset.textView = String(data.textView);
    textViewButton.setAttribute('aria-pressed', String(data.textView));
  }
  if (data.drawn === true) {
    root.dataset.state = 'drawn';
    const facts = window.__holoml?.scene?.();
    if (facts && typeof facts.title === 'string' && facts.title) titleEl.textContent = facts.title;
  }
  if (typeof data.description === 'string') titleEl.title = data.description.slice(0, 500);
}
function asked(e) {
  if (e.source !== window || !e.data || e.data.hypersolHolomlViewer !== true) return;
  window.removeEventListener('message', asked);
  const channel = new MessageChannel();
  line = channel.port1;
  line.onmessage = heard;
  window.postMessage({ hypersolHolomlLine: true }, '*', [channel.port2]);
  for (const command of waiting.splice(0)) line.postMessage(command);
}

/** Reads a response's body up to the limit; null when it is larger. */
async function readUpTo(response, limit) {
  const reader = response.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    bytes.set(part, at);
    at += part.byteLength;
  }
  return bytes;
}

async function main() {
  const page = new URLSearchParams(location.search).get('page');
  if (page === null || page.trim() === '') return refuse('HoloML viewer', 'No page was given.');
  let url;
  try {
    url = new URL(page.trim());
  } catch {
    return refuse('Not an address', `"${page}" is not a web address.`);
  }
  if (!allowed(url)) return refuse('Not shown', `Only an https address, or an http one on this computer, is fetched; not ${url.protocol}//${url.host}.`);
  titleEl.textContent = url.href;
  noteText.textContent = `Fetching ${url.href}…`;
  let response;
  try {
    response = await fetch(url.href, { credentials: 'omit', redirect: 'follow' });
  } catch {
    return refuse('Not fetched', `${url.href} could not be fetched: the site may be down, or may not allow another site's page to read it (CORS).`);
  }
  if (!response.ok) return refuse('Not fetched', `${url.href} answered ${response.status}.`);
  const bytes = await readUpTo(response, TEXT_LIMIT);
  if (bytes === null) return refuse('Too large', `${url.href} is larger than 2 MB, the most a HoloML page may be.`);
  const text = new TextDecoder().decode(bytes);

  // The page is in: its address is the base of everything it names, and its
  // text waits in the document for the viewer, as in the browser.
  const base = document.createElement('base');
  base.href = response.url || url.href;
  document.head.append(base);
  if (url.hash && !location.hash) history.replaceState(null, '', `${location.pathname}${location.search}${url.hash}`);
  const pre = document.createElement('pre');
  pre.textContent = text;
  document.body.append(pre);
  note.hidden = true;
  bar.hidden = false;
  root.dataset.state = 'loading';

  // A browser without WebGL 2 cannot draw the page: the viewer says so in a
  // card of its own, and the host in its line. (The text view needs the
  // scene, which the viewer builds only once it can draw; offering it
  // without WebGL 2 is a change to the viewer, for its own approval.)
  const canvas = document.createElement('canvas');
  const webgl2 = canvas.getContext('webgl2') !== null;
  if (!webgl2) say('This browser has no WebGL 2, so the page cannot be drawn here. HyperSpace 3D, or a browser with WebGL 2, shows it.');
  // A script of another site is not run here: the policy refuses it, and the page shows without it.
  // (The viewer's own probe of whether code may be evaluated, decoders.ts, is refused the same way, and is not a script of the page.)
  document.addEventListener('securitypolicyviolation', (e) => {
    if (e.violatedDirective.startsWith('script-src') && e.blockedURI !== 'eval') say('A script of this page was not run: scripts run here only from this site. Open the page in HyperSpace 3D for the whole of it.');
  });

  window.addEventListener('message', asked);
  send(document.hidden ? 'behind' : 'in-front');
  document.addEventListener('visibilitychange', () => send(document.hidden ? 'behind' : 'in-front'));
  textViewButton.addEventListener('click', () => send(root.dataset.textView === 'true' ? 'text-view-off' : 'text-view-on'));
  stopButton.addEventListener('click', () => send('stop'));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.dataset.busy === 'true') send('stop');
    if (e.key.toLowerCase() === 'v' && e.ctrlKey && e.shiftKey && !e.altKey) {
      e.preventDefault();
      send(root.dataset.textView === 'true' ? 'text-view-off' : 'text-view-on');
    }
  });

  const script = document.createElement('script');
  script.type = 'module';
  script.src = VIEWER;
  document.head.append(script);
}

main().catch((e) => refuse('Not shown', String(e?.message ?? e)));
