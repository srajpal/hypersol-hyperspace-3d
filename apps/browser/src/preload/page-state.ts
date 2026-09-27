/**
 * What this page's preload tells the shell about the page (shared/page-state.ts):
 * typed text not yet sent (form-state.ts) and live capture (capture.ts).
 * Each part says only what changed; the shell keeps the rest.
 */
import { ipcRenderer } from 'electron';
import { PAGE_STATE_CHANNEL, type PageState } from '../shared/page-state';

const current: PageState = { typed: false, capturing: false };

export function tellShell(change: Partial<PageState>): void {
  let changed = false;
  for (const key of ['typed', 'capturing'] as const) {
    const value = change[key];
    if (value !== undefined && value !== current[key]) {
      current[key] = value;
      changed = true;
    }
  }
  if (changed) ipcRenderer.sendToHost(PAGE_STATE_CHANNEL, { ...current });
}
