import { join } from 'node:path';

/**
 * Names the app's data folder had before (the folder follows the product
 * name). "HyperSol WebSurfer 3D" was this browser's name until
 * 2026-09-26, when it became HyperSol HyperSpace 3D (owner, prompt 42).
 */
export const EARLIER_PROFILE_FOLDERS = ['HyperSol WebSurfer 3D'] as const;

/**
 * The profile folder for an installed app: the folder under the current
 * name when it exists; otherwise one from an earlier name that exists, so
 * bookmarks, history, and settings survive the rename; otherwise the
 * current name (a first start).
 */
export function chooseProfileFolder(appData: string, currentName: string, exists: (path: string) => boolean): string {
  const current = join(appData, currentName);
  if (exists(current)) return current;
  for (const name of EARLIER_PROFILE_FOLDERS) {
    const earlier = join(appData, name);
    if (exists(earlier)) return earlier;
  }
  return current;
}
