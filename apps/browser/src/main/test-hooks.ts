import { ipcMain } from 'electron';
import { LAYERS_SETTLED_CHANNEL } from '../shared/layers';
import type { FaviconEnd } from './favicon';
import type { AttachRecord } from './security';

/**
 * Logs the end-to-end tests read through Playwright's main-process
 * evaluate. Installed only when HYPERSOL_TEST=1, and never in a packaged
 * build (main/launch-options.ts).
 */
export interface TestLog {
  attaches: AttachRecord[];
  requests: string[];
  /** Requests of the private session held while its old data was cleared (GHSA-h34m-3f58-vj6h). */
  heldRequests: string[];
  /** Addresses of new-window requests that were blocked. */
  blockedPopups: string[];
  /** Right-click menus, in order; run() picks an entry by label. */
  menus: { labels: string[]; run(label: string): void }[];
  /** Saved-data requests from the shell, counted by op. */
  dataOps: Record<string, number>;
  /** Every encrypted DNS mode put into effect, in order. */
  dnsApplied: { mode: string; resolver: string }[];
  /** Downloads that would have been opened or shown in their folder. */
  opened: { what: string; path: string }[];
  /** Whether history runs in its worker thread (milestone 10). */
  historyWorker?: () => boolean;
  /** Opens a HoloML file from the computer as Ctrl+O would, without the file chooser (milestone 14). */
  openLocal?: (path: string) => Promise<string | null>;
  /**
   * "Leave this page?" (main/leave-page.ts): test runs open no native box.
   * Each ask is recorded by the page's address, and answered with
   * leaveAnswer, which a check may set to 'stay'.
   */
  leaveAsks: string[];
  leaveAnswer: 'leave' | 'stay';
  /** How each attempt at a favicon address ended (main/favicon.ts). */
  faviconEnds: { url: string; why: FaviconEnd }[];
  /** How often each page's layers view has settled after a change, by web contents id (preload/layers.ts). */
  layersSettled: Record<number, number>;
  /** How many sign-in prompts are showing or waiting, in all tabs (main/sign-in.ts). */
  signInsWaiting?: () => number;
  /**
   * Permissions refused to a page that asked, without a prompt, by
   * Electron's names (main/permissions.ts). A refused request for full
   * screen tells the page nothing, so a check can only see it here.
   */
  refusedPermissions: string[];
  /**
   * The addresses of tabs whose card picture was asked for, as each
   * capture ends, a picture or none (a tab behind others has none): a
   * capture shows the page to Chromium for a moment, and a check aims a
   * click once it has ended (prompt 172, D8).
   */
  captures: string[];
  /**
   * The file the next file dialog would give (milestone 26, bookmark
   * files): a test run shows no dialog. Used once; null is a dialog
   * closed without a choice, and nothing set is the same.
   */
  nextFile?: string | null;
}

declare global {
  var __hypersolTest: TestLog | undefined;
}

export function installTestHooks(): TestLog {
  const log: TestLog = { attaches: [], requests: [], heldRequests: [], blockedPopups: [], menus: [], dataOps: {}, dnsApplied: [], opened: [], leaveAsks: [], leaveAnswer: 'leave', refusedPermissions: [], layersSettled: {}, faviconEnds: [], captures: [] };
  globalThis.__hypersolTest = log;
  // log.requests is filled by the privacy shield's request listener
  // (main/privacy/index.ts): Electron allows one listener per session.
  // The layers preload's word that a page has settled, counted per page.
  ipcMain.on(LAYERS_SETTLED_CHANNEL, (event) => {
    if (event.sender.getType() !== 'webview') return;
    log.layersSettled[event.sender.id] = (log.layersSettled[event.sender.id] ?? 0) + 1;
  });
  return log;
}
