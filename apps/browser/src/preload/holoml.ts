/**
 * HoloML pages, the page side (milestone 14; main/holoml.ts has the rest).
 *
 * A HoloML page arrives as plain text under HoloML's content policy. Here,
 * once the main process confirms that this document is one, the text is
 * hidden and the browser's HoloML viewer script is added to the page: it
 * reads the text and draws the scene, inside this sandboxed page process.
 * The shell is told, so the tab can show the scene across the window.
 *
 * Every page also accepts a dropped .holoml file: it opens in the tab.
 */
import { ipcRenderer, webFrame, webUtils } from 'electron';
import { HOLOML_COMMAND_CHANNEL, HOLOML_DOCUMENT_CHANNEL, HOLOML_DROP_CHANNEL, HOLOML_SHOWN_CHANNEL, HOLOML_STATE_CHANNEL, VIEWER_ENTRY } from '../shared/holoml-page';
import { isTestRun } from '../shared/test-run';

function detect(): boolean {
  // Only a main frame's plain-text document can be one; ask no more for others.
  if (window !== window.top || document.contentType !== 'text/plain') return false;
  try {
    return ipcRenderer.sendSync(HOLOML_DOCUMENT_CHANNEL, location.href) === true;
  } catch {
    return false;
  }
}

/** This document is a HoloML page (the layers view leaves it alone). */
export const isHolomlDocument = detect();

if (isHolomlDocument) {
  // The source stays in the page for the viewer, hidden from the start.
  webFrame.insertCSS('html, body { margin: 0; height: 100%; overflow: hidden; background: #0b0f1e; } body > pre { display: none; }');
  ipcRenderer.sendToHost(HOLOML_SHOWN_CHANNEL, location.href);
  // The browser's own tests read the scene through hooks the viewer puts on the page only when it finds
  // this mark on its script element (review 134, D12); a normal run has no mark, and no hooks. Whether
  // this is a test run is the main process's to say (shared/test-run.ts), not the environment's.
  const testRun = isTestRun(process.argv);
  const addViewer = () => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = VIEWER_ENTRY;
    if (testRun) script.dataset['hypersolHolomlTest'] = '';
    (document.head ?? document.documentElement).append(script);
  };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', addViewer, { once: true });
  else addViewer();
  // The viewer's state out to the shell (loading models, the text view),
  // and the shell's commands in (milestone 15), over a private line
  // (review 134, V10): a message channel whose other end is handed to the
  // viewer when it asks, as it starts, before any script of the page
  // exists. Only the first asking is answered, and messages on the window
  // are neither state nor commands any more, so a page's script cannot
  // tell the shell the scene is drawn or loading, nor tell the viewer its
  // tab is in front.
  let line: MessagePort | null = null;
  const waiting: string[] = [];
  const asked = (e: MessageEvent) => {
    if (e.source !== window || (e.data as { hypersolHolomlViewer?: unknown } | null)?.hypersolHolomlViewer !== true) return;
    window.removeEventListener('message', asked);
    const channel = new MessageChannel();
    line = channel.port1;
    line.onmessage = (m) => {
      const data = m.data as { busy?: unknown; textView?: unknown; drawn?: unknown } | null;
      if (typeof data !== 'object' || data === null) return;
      if (typeof data.busy === 'boolean') ipcRenderer.sendToHost(HOLOML_STATE_CHANNEL, { busy: data.busy });
      if (typeof data.textView === 'boolean') ipcRenderer.sendToHost(HOLOML_STATE_CHANNEL, { textView: data.textView });
      if (data.drawn === true) ipcRenderer.sendToHost(HOLOML_STATE_CHANNEL, { drawn: true });
    };
    window.postMessage({ hypersolHolomlLine: true }, '*', [channel.port2]);
    for (const command of waiting.splice(0)) line.postMessage(command);
  };
  window.addEventListener('message', asked);
  // The instrument panel's Scene part can choose a thing and switch picking the same way ("select:<index>",
  // "pick-on", "pick-off"), so that nothing on the page's window need act for it.
  const commands = /^(?:stop|text-view-on|text-view-off|behind|in-front|pick-on|pick-off|select:-?\d{1,7})$/;
  ipcRenderer.on(HOLOML_COMMAND_CHANNEL, (_event, command: unknown) => {
    if (typeof command !== 'string' || !commands.test(command)) return;
    // A command that comes before the viewer has asked for the line waits for it.
    if (line) line.postMessage(command);
    else waiting.push(command);
  });
  // The first real click, tap, or key on the page lets it play sound (HoloML
  // 0.2, milestone 17). Heard here, in the preload's own world: a page's
  // script cannot make a trusted event, nor reach this message.
  const activated = (e: Event) => {
    if (!e.isTrusted) return;
    window.removeEventListener('pointerdown', activated, true);
    window.removeEventListener('keydown', activated, true);
    ipcRenderer.sendToHost(HOLOML_STATE_CHANNEL, { activated: true });
  };
  window.addEventListener('pointerdown', activated, true);
  window.addEventListener('keydown', activated, true);
}

if (window === window.top) {
  // Dropping a .holoml file from the computer onto a page opens it here.
  // Only a real dropped file has a path; the main process checks the rest.
  window.addEventListener(
    'drop',
    (e) => {
      const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.name.toLowerCase().endsWith('.holoml'));
      if (!file) return;
      const path = webUtils.getPathForFile(file);
      if (!path) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      ipcRenderer.send(HOLOML_DROP_CHANNEL, path);
    },
    true,
  );
  window.addEventListener(
    'dragover',
    (e) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    },
    true,
  );
}
