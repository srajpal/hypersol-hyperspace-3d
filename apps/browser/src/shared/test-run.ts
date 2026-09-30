/**
 * How a web page's preload learns that this is a test run (review of
 * 2026-09-30, D11). The main process decides whether test mode is on
 * (never in a packaged build, main/launch-options.ts) and, only then,
 * starts each page's process with this argument (main/security.ts). The
 * page preload looks for it in place of reading HYPERSOL_TEST itself,
 * which a packaged app started with that variable would have obeyed.
 *
 * Used by the main process and the page preload only: the two preloads
 * share no module (preload/preload-graph.test.ts).
 */
export const TEST_RUN_ARGUMENT = '--hypersol-test-run';

/** Whether this process was started for a test run: the argument is among its arguments. */
export function isTestRun(argv: readonly string[]): boolean {
  return argv.includes(TEST_RUN_ARGUMENT);
}
