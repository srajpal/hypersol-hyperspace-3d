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
import { HOLOML_DOCUMENT_CHANNEL, HOLOML_DROP_CHANNEL, HOLOML_SHOWN_CHANNEL, VIEWER_ENTRY } from '../shared/holoml-page';

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
