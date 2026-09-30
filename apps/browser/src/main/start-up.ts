/**
 * When the app cannot go on (review of 2026-09-30, M9 and M10): a throw
 * during start-up, which used to leave a process with no window holding
 * the single-instance lock, so that every later launch quit at once; and
 * a shell that crashes, which used to leave a dead window. No Electron
 * imports, so it can be unit tested; main/index.ts shows the message and
 * ends the app.
 */

/** A crashed shell is reloaded once; a second crash within this long ends the app. */
export const SHELL_CRASH_WINDOW_MS = 60_000;

/** What to do when the shell's process has gone: reload it, or, if it went this soon after the last time, stop. */
export function afterShellCrash(lastCrashAt: number | null, now: number): 'reload' | 'quit' {
  return lastCrashAt !== null && now - lastCrashAt >= 0 && now - lastCrashAt < SHELL_CRASH_WINDOW_MS ? 'quit' : 'reload';
}

export const START_FAILED_TITLE = "HyperSpace 3D couldn't start";
export const SHELL_FAILED_TITLE = 'HyperSpace 3D has stopped';

/** Why start-up failed, in plain words, with where to look. */
export function startFailedMessage(error: unknown, dataFolder: string): string {
  const reason = error instanceof Error ? error.message : String(error);
  return [
    'Something the browser needs at start could not be read or written:',
    reason,
    `Its data folder is ${dataFolder}. Check that the folder can be written to and that the disk is not full, then start HyperSpace 3D again.`,
  ].join('\n\n');
}

export const SHELL_FAILED_MESSAGE =
  "The browser's window stopped working twice within a minute, so HyperSpace 3D has closed. Your bookmarks, history, and settings are saved. Start it again to carry on.";
