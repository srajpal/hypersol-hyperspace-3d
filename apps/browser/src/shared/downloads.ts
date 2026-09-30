/**
 * Downloads (milestone 8): files are saved straight to the Downloads
 * folder (owner, prompt 37, Q2 a); the Downloads panel lists them for the
 * session. Requests from the shell are checked with parseDownloadRequest.
 */

export const DOWNLOADS_CHANNEL = 'hypersol:downloads';

export type DownloadState = 'progressing' | 'completed' | 'cancelled' | 'interrupted';

export interface DownloadInfo {
  id: number;
  filename: string;
  url: string;
  /** Where it is saved. */
  path: string;
  received: number;
  /** Total size, or 0 when the server did not say. */
  total: number;
  state: DownloadState;
  /**
   * Electron said it is done (completed, cancelled, or interrupted for good).
   * An interruption before that can still resume, so it is not finished.
   */
  finished: boolean;
  /** Milliseconds since 1970. */
  startedAt: number;
  /** The page that started it, if known: its tab stays awake while it runs (milestone 10). */
  webContentsId: number | null;
}

export type DownloadRequest =
  | { op: 'downloads.list' }
  | { op: 'downloads.clear' }
  | { op: 'downloads.open'; id: number }
  | { op: 'downloads.show'; id: number }
  | { op: 'downloads.cancel'; id: number };

/**
 * File types the system would run or install rather than show, by
 * extension in lower case (review of 2026-09-30, R3). "Open" never starts
 * one of these: a page can start a download by itself and the notice's
 * Open is one click away, so a program is shown in its folder instead,
 * where starting it is the person's own act.
 */
export const PROGRAM_EXTENSIONS: ReadonlySet<string> = new Set([
  // Windows
  '.exe', '.msi', '.msp', '.bat', '.cmd', '.com', '.scr', '.pif', '.cpl', '.msc', '.hta', '.ps1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.lnk', '.reg',
  // macOS
  '.app', '.command', '.dmg', '.pkg',
  // Linux
  '.sh', '.desktop', '.appimage', '.deb', '.rpm',
  // Anywhere Java is installed
  '.jar',
]);

/** Is this file (a name or a path) one the system would run? Windows ignores dots and spaces at a name's end, so they are too. */
export function isProgramFile(name: string): boolean {
  const trimmed = name.replace(/[. ]+$/, '');
  const dot = trimmed.lastIndexOf('.');
  return dot >= 0 && PROGRAM_EXTENSIONS.has(trimmed.slice(dot).toLowerCase());
}

export interface DownloadResults {
  'downloads.list': DownloadInfo[];
  'downloads.clear': null;
  /** null when the file was opened; 'shown' when it is a program (isProgramFile) and was shown in its folder instead. */
  'downloads.open': null | 'shown';
  'downloads.show': null;
  'downloads.cancel': null;
}

export type DownloadOp = DownloadRequest['op'];
export type DownloadReply<K extends DownloadOp> = { ok: true; value: DownloadResults[K] } | { ok: false; error: string };

export function parseDownloadRequest(raw: unknown): { request: DownloadRequest } | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'Not a request' };
  const r = raw as Record<string, unknown>;
  switch (r['op']) {
    case 'downloads.list':
    case 'downloads.clear':
      return { request: { op: r['op'] } };
    case 'downloads.open':
    case 'downloads.show':
    case 'downloads.cancel':
      if (!Number.isInteger(r['id']) || (r['id'] as number) < 1) return { error: `${r['op']}: id must be a download id` };
      return { request: { op: r['op'], id: r['id'] as number } };
    default:
      return { error: `Unknown request: ${String(r['op'])}` };
  }
}

/**
 * A free file name in a folder: "report.pdf", else "report (1).pdf",
 * "report (2).pdf", and so on, the way browsers do it.
 */
export function uniqueName(name: string, taken: (candidate: string) => boolean): string {
  const safe = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '_').slice(0, 200) || 'download';
  if (!taken(safe)) return safe;
  const dot = safe.lastIndexOf('.');
  const [stem, ext] = dot > 0 ? [safe.slice(0, dot), safe.slice(dot)] : [safe, ''];
  for (let n = 1; n < 10_000; n++) {
    const candidate = `${stem} (${n})${ext}`;
    if (!taken(candidate)) return candidate;
  }
  return `${stem} (${Date.now()})${ext}`;
}
