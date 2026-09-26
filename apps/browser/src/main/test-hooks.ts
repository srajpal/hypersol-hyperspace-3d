import type { AttachRecord } from './security';

/**
 * Logs the end-to-end tests read through Playwright's main-process
 * evaluate. Installed only when HYPERSOL_TEST=1.
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
}

declare global {
  var __hypersolTest: TestLog | undefined;
}

export function installTestHooks(): TestLog {
  const log: TestLog = { attaches: [], requests: [], blockedPopups: [], menus: [], dataOps: {}, dnsApplied: [], opened: [] };
  globalThis.__hypersolTest = log;
  // log.requests is filled by the privacy shield's request listener
  // (main/privacy/index.ts): Electron allows one listener per session.
  return log;
}
