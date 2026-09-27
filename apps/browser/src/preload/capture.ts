/**
 * Live camera, microphone, and screen capture in this page (GitHub issues
 * #18 and #22). A small script in the page's own world counts the tracks
 * that getUserMedia and getDisplayMedia hand out, until they end or are
 * stopped, and says so by a window message; this preload passes it to the
 * shell, so a tab that is capturing is not put to sleep (#18). When the
 * person blocks the camera or microphone for the site, the main process
 * asks here to stop those tracks at once (#22).
 *
 * The page could send the same message itself; all it could do with it is
 * keep its own tab awake, which is not worth guarding.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { CAPTURE_STOP_CHANNEL } from '../shared/page-state';
import { tellShell } from './page-state';

/** Runs in the page's world, before the page's own scripts. */
function tracker(): void {
  const md = navigator.mediaDevices as MediaDevices | undefined;
  if (!md) return;
  const live = new Set<MediaStreamTrack>();
  const report = () => {
    let audio = false;
    let video = false;
    for (const t of live) {
      if (t.readyState !== 'live') continue;
      if (t.kind === 'audio') audio = true;
      else video = true;
    }
    window.postMessage({ hypersolCapture: { audio, video } }, '*');
  };
  const follow = (stream: MediaStream): MediaStream => {
    for (const t of stream.getTracks()) {
      live.add(t);
      t.addEventListener('ended', () => {
        live.delete(t);
        report();
      });
      const stop = t.stop.bind(t);
      t.stop = () => {
        stop();
        live.delete(t);
        report();
      };
    }
    report();
    return stream;
  };
  for (const name of ['getUserMedia', 'getDisplayMedia'] as const) {
    const original = md[name] as ((...args: unknown[]) => Promise<MediaStream>) | undefined;
    if (typeof original !== 'function') continue;
    Object.defineProperty(md, name, {
      configurable: true,
      writable: true,
      value: function (this: MediaDevices, ...args: unknown[]) {
        return original.apply(this, args).then(follow);
      },
    });
  }
  window.addEventListener('message', (e) => {
    const kinds = (e.data as { hypersolCaptureStop?: unknown } | null)?.hypersolCaptureStop;
    if (e.source !== window || !Array.isArray(kinds)) return;
    for (const t of [...live]) if (kinds.includes(t.kind)) t.stop();
  });
}

if (window === window.top) {
  try {
    contextBridge.executeInMainWorld({ func: tracker });
  } catch {
    // Without it, capture is not counted: the tab may sleep as before.
  }
  window.addEventListener('message', (e) => {
    const state = (e.data as { hypersolCapture?: { audio?: unknown; video?: unknown } } | null)?.hypersolCapture;
    if (e.source !== window || !state) return;
    tellShell({ capturing: state.audio === true || state.video === true });
  });
  ipcRenderer.on(CAPTURE_STOP_CHANNEL, (_event, kinds: unknown) => {
    if (!Array.isArray(kinds)) return;
    const tracks = kinds.filter((k) => k === 'audio' || k === 'video');
    window.postMessage({ hypersolCaptureStop: tracks }, '*');
  });
}
