/**
 * Pointer lock (GitHub issue #75), the page side: tells the main process
 * when the page takes the pointer and gives it back, so Escape gives it
 * back and the shell shows its notice (main/fullscreen.ts). Full screen
 * needs nothing here: Electron reports it itself. Nothing is exposed to
 * the page.
 */
import { ipcRenderer } from 'electron';
import { POINTER_LOCK_CHANNEL } from '../shared/fullscreen';

if (window === window.top) {
  let locked = false;
  document.addEventListener('pointerlockchange', () => {
    const now = document.pointerLockElement !== null;
    if (now === locked) return;
    locked = now;
    ipcRenderer.send(POINTER_LOCK_CHANNEL, now);
  });
}
