import { basename } from 'node:path';
import { defaults, parseSettings, type Settings } from '../../shared/settings';
import type { SavedSession } from '../../shared/data';
import { readTextIfExists, setAside, writeFileAtomic } from './files';

/** File operations SettingsFile uses; replaceable in tests to simulate failures. */
export interface SettingsFileSystem {
  read(path: string): string | null;
  setAside(path: string): string;
  write(path: string, text: string): void;
}

const realFiles: SettingsFileSystem = { read: readTextIfExists, setAside, write: writeFileAtomic };

/** The error's code (EISDIR, EACCES, ...) or message, for plain explanations. */
function reason(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e && typeof e.code === 'string') return e.code;
  return e instanceof Error ? e.message : String(e);
}

/**
 * settings.json. Nothing here can stop the app from starting:
 * - unreadable file: defaults, an explanation, and the file left alone;
 * - damaged file: set aside (kept, renamed) and defaults used; if it
 *   cannot be moved, it is left alone and defaults are used.
 * While an old file could not be preserved, a save first tries again to
 * set it aside and refuses rather than overwrite it. The settings in use
 * change only after a save has been written (GitHub issue #2).
 */
export class SettingsFile {
  private current: Settings = defaults();
  private setAsideName: string | null = null;
  private problemText: string | null = null;
  /** True while an existing file must be preserved before writing over it. */
  private mustPreserve = false;

  constructor(
    private readonly path: string,
    private readonly fs: SettingsFileSystem = realFiles,
  ) {
    let text: string | null;
    try {
      text = fs.read(path);
    } catch (e) {
      this.problemText = `Your settings couldn't be read (${reason(e)}), so the defaults are in use. The settings file was left as it is.`;
      this.mustPreserve = true;
      return;
    }
    if (text === null) return;
    const parsed = parseSettings(text);
    this.current = parsed.settings;
    if (!parsed.problem) return;
    try {
      this.setAsideName = fs.setAside(path);
      this.problemText = `Your settings file was damaged (${parsed.problem}), so the defaults are in use. The old file was kept as ${basename(this.setAsideName)}.`;
    } catch (e) {
      this.problemText = `Your settings file was damaged (${parsed.problem}) and couldn't be moved aside (${reason(e)}), so the defaults are in use. The file was left as it is.`;
      this.mustPreserve = true;
    }
  }

  get settings(): Settings {
    return {
      ...this.current,
      pausedSites: [...this.current.pausedSites],
      layersSites: { ...this.current.layersSites },
      zoomSites: { ...this.current.zoomSites },
      windowBounds: this.current.windowBounds ? { ...this.current.windowBounds } : null,
    };
  }

  /** Where a damaged file was moved, if one was. */
  get setAsideAs(): string | null {
    return this.setAsideName;
  }

  /** A plain explanation when the saved settings could not be used, else null. */
  get problem(): string | null {
    return this.problemText;
  }

  /** Writes the settings; only then do they take effect. Throws with a plain message on failure. */
  save(settings: Settings): void {
    try {
      if (this.mustPreserve && this.fs.read(this.path) !== null) {
        this.setAsideName = this.fs.setAside(this.path);
      }
      this.fs.write(this.path, `${JSON.stringify(settings, null, 2)}\n`);
    } catch (e) {
      throw new Error(`Couldn't save your settings (${reason(e)}). Nothing was changed.`);
    }
    this.current = {
      ...settings,
      pausedSites: [...settings.pausedSites],
      layersSites: { ...settings.layersSites },
      zoomSites: { ...settings.zoomSites },
    };
    this.mustPreserve = false;
    this.problemText = null;
  }
}

/** Reads a session file's text: web addresses only; anything else gives null. */
export function parseSession(text: string | null): SavedSession | null {
  if (text === null) return null;
  try {
    const data = JSON.parse(text) as unknown;
    if (typeof data !== 'object' || data === null) return null;
    const { tabs, focused } = data as Record<string, unknown>;
    if (!Array.isArray(tabs)) return null;
    const urls = tabs.filter((t): t is string => typeof t === 'string' && /^https?:\/\//i.test(t));
    if (urls.length === 0) return null;
    const f = Number.isInteger(focused) && (focused as number) >= 0 && (focused as number) < urls.length ? (focused as number) : 0;
    return { tabs: urls, focused: f };
  } catch {
    return null;
  }
}

/** session.json: the open tabs, for "reopen your tabs from last time". */
export class SessionFile {
  constructor(private readonly path: string) {}

  load(): SavedSession | null {
    try {
      return parseSession(readTextIfExists(this.path));
    } catch {
      return null;
    }
  }

  /** Throws with a plain message if the tabs could not be saved. */
  save(session: SavedSession): void {
    try {
      writeFileAtomic(this.path, `${JSON.stringify(session)}\n`);
    } catch (e) {
      throw new Error(`Couldn't save your open tabs (${reason(e)}).`);
    }
  }
}
