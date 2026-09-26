/**
 * Messages from the main process to the 3D shell. The main process sees
 * keyboard shortcuts, new-window requests, and favicons for every web
 * page; the shell owns the tabs and acts on these.
 */

export const SHELL_COMMAND_CHANNEL = 'hypersol:command';
/** Shell asks the main process for a snapshot of one of its tabs. */
export const CAPTURE_TAB_CHANNEL = 'hypersol:capture-tab';
/** Shell tells the main process it has saved what it must before the window closes. */
export const CLOSE_READY_CHANNEL = 'hypersol:close-ready';

import type { DataOp, DataReply, DataRequest } from './data';
import type { PrivacyOp, PrivacyReply, PrivacyRequest } from './privacy';
import type { InspectOp, InspectReply, InspectRequest } from './inspect';
import type { DownloadInfo, DownloadOp, DownloadReply, DownloadRequest } from './downloads';
import type { PermissionKind, PermissionOp, PermissionPrompt, PermissionReply, PermissionRequest } from './permissions';
import type { PasswordOffer, PasswordOp, PasswordReply, PasswordRequest } from './passwords';
import type { TabsOp, TabsReply, TabsRequest } from './tabs';

/**
 * The private tabs' session (milestone 8): in memory only, since the name
 * has no "persist:" prefix, so nothing reaches the disk.
 */
export const PRIVATE_PARTITION = 'hypersol-private';

/**
 * The address a new page gets when it will take a closed page's history
 * (milestone 10). The main process creates such a page without loading
 * anything, since Electron restores history only into a page that has
 * never navigated.
 */
export const RESTORE_BLANK = 'about:blank#hypersol-restore';

export type ShortcutName =
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'find'
  | 'print'
  | 'downloads'
  | 'private-tab'
  | 'reopen-tab'
  | 'search-tabs'
  | 'instruments'
  | 'layers'
  | 'bookmark'
  | 'library'
  | 'settings'
  | 'new-tab'
  | 'close-tab'
  | 'focus-address'
  | 'next-tab'
  | 'prev-tab'
  | 'reload'
  | 'back'
  | 'forward';

export type ShellCommand =
  | { type: 'shortcut'; name: ShortcutName }
  | { type: 'open-tab'; url: string; background: boolean; openerWebContentsId?: number }
  | { type: 'favicon'; webContentsId: number; dataUrl: string }
  | { type: 'data-changed'; what: 'bookmarks' | 'history' | 'settings' | 'passwords' }
  /** A page asks for the camera, microphone, or location: show the prompt for its tab (milestone 9). */
  | { type: 'permission-prompt'; prompt: PermissionPrompt }
  /** A prompt is no longer wanted (the tab left the site or closed). */
  | { type: 'permission-ended'; id: number }
  /** What a tab's page has been given access to (the in-use marker); [] clears it. */
  | { type: 'site-access'; webContentsId: number; kinds: PermissionKind[] }
  /** Offer to save or update a password for a tab (milestone 9). */
  | { type: 'password-offer'; offer: PasswordOffer }
  /** A tab's page started or stopped making sound (milestone 10). */
  | { type: 'audio'; webContentsId: number; audible: boolean }
  /** The computer is running on battery, or not (economy mode, milestone 10). */
  | { type: 'power'; onBattery: boolean }
  /** How many requests the privacy shield has blocked on a tab's page. */
  | { type: 'shield'; webContentsId: number; count: number }
  /** The shield blocked a whole page in a tab (the tab shows the blocked card). */
  | { type: 'page-blocked'; webContentsId: number; url: string }
  /** The downloads list changed (milestone 8). */
  | { type: 'downloads'; items: DownloadInfo[] }
  /** The filter lists changed (refreshed, or a refresh started or failed). */
  | { type: 'filters-changed' }
  /** The window is closing: save the open tabs now, then call closeReady(). */
  | { type: 'prepare-close' };

/** What the shell's preload exposes as window.hypersol. */
export interface ShellBridge {
  platform: string;
  versions: { electron: string; chrome: string };
  onCommand(listener: (command: ShellCommand) => void): () => void;
  /** A JPEG data: URL of a tab's page, or null if it cannot be captured. */
  captureTab(webContentsId: number): Promise<string | null>;
  /** Saved data: bookmarks, history, settings, session (shared/data.ts). */
  data<K extends DataOp>(request: Extract<DataRequest, { op: K }>): Promise<DataReply<K>>;
  /** Privacy shield, filter lists, and encrypted DNS (shared/privacy.ts). */
  privacy<K extends PrivacyOp>(request: Extract<PrivacyRequest, { op: K }>): Promise<PrivacyReply<K>>;
  /** The instrument panel's readouts (shared/inspect.ts). */
  inspect<K extends InspectOp>(request: Extract<InspectRequest, { op: K }>): Promise<InspectReply<K>>;
  /** Downloads (shared/downloads.ts). */
  downloads<K extends DownloadOp>(request: Extract<DownloadRequest, { op: K }>): Promise<DownloadReply<K>>;
  /** Site permissions: prompt answers and the site panel (shared/permissions.ts). */
  permissions<K extends PermissionOp>(request: Extract<PermissionRequest, { op: K }>): Promise<PermissionReply<K>>;
  /** Saved passwords: the Library tab and save offers (shared/passwords.ts). */
  passwords<K extends PasswordOp>(request: Extract<PasswordRequest, { op: K }>): Promise<PasswordReply<K>>;
  /** A closed or sleeping tab's history into a new page (shared/tabs.ts). */
  tabs<K extends TabsOp>(request: Extract<TabsRequest, { op: K }>): Promise<TabsReply<K>>;
  /** Answer to prepare-close: saving is done (or has failed), the window may close. */
  closeReady(): void;
}
