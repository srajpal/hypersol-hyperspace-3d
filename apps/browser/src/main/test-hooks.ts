import type { AttachRecord } from './security';

/**
 * Logs the end-to-end tests read through Playwright's main-process
 * evaluate. Installed only when HYPERSOL_TEST=1, and never in a packaged
 * build (main/launch-options.ts).
 */
export interface TestLog {
  attaches: AttachRecord[];
  requests: string[];
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
  /**
   * Permissions refused to a page that asked, without a prompt, by
   * Electron's names (main/permissions.ts). A refused request for full
   * screen tells the page nothing, so a check can only see it here.
   */
  refusedPermissions: string[];
}

declare global {
  var __hypersolTest: TestLog | undefined;
}

export function installTestHooks(): TestLog {
  const log: TestLog = { attaches: [], requests: [], blockedPopups: [], menus: [], dataOps: {}, dnsApplied: [], opened: [], leaveAsks: [], leaveAnswer: 'leave', refusedPermissions: [] };
  globalThis.__hypersolTest = log;
  // log.requests is filled by the privacy shield's request listener
  // (main/privacy/index.ts): Electron allows one listener per session.
  return log;
}
