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
  const addViewer = () => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = VIEWER_ENTRY;
    (document.head ?? document.documentElement).append(script);
  };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', addViewer, { once: true });
  else addViewer();
  // The viewer's state out to the shell (loading models, the text view),
  // and the shell's commands in (milestone 15).
  window.addEventListener('message', (e) => {
    if (e.source !== window || typeof e.data !== 'object' || e.data === null) return;
    const data = e.data as { hypersolHolomlBusy?: unknown; hypersolHolomlTextView?: unknown; hypersolHolomlDrawn?: unknown };
    if (typeof data.hypersolHolomlBusy === 'boolean') ipcRenderer.sendToHost(HOLOML_STATE_CHANNEL, { busy: data.hypersolHolomlBusy });
    if (typeof data.hypersolHolomlTextView === 'boolean') ipcRenderer.sendToHost(HOLOML_STATE_CHANNEL, { textView: data.hypersolHolomlTextView });
    if (data.hypersolHolomlDrawn === true) ipcRenderer.sendToHost(HOLOML_STATE_CHANNEL, { drawn: true });
  });
  ipcRenderer.on(HOLOML_COMMAND_CHANNEL, (_event, command: unknown) => {
    if (command === 'stop' || command === 'text-view-on' || command === 'text-view-off') window.postMessage({ hypersolHolomlCommand: command }, '*');
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
