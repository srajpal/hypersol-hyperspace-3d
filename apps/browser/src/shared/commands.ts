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
/** Shell tells the main process Settings is waiting for a shortcut's new keys (milestone 11). */
export const CAPTURE_KEYS_CHANNEL = 'hypersol:capture-keys';
/** Open a HoloML file from the computer (milestone 14): a dropped file's path, or null to choose one. */
export const OPEN_FILE_CHANNEL = 'hypersol:open-file';
/** Lifting into the room (milestone 28, shared/lift.ts): the shell asks for one rectangle of one of its tabs' pages, captured (Q1 a). */
export const LIFT_CAPTURE_CHANNEL = 'hypersol:lift-capture';
/** And for a model's files, from that page's own site (Q3 a). */
export const LIFT_MODEL_CHANNEL = 'hypersol:lift-model';
/** Full screen and pointer lock (GitHub issue #75): the shell asks the main process to take one of its tabs' pages out of both. */
export const LEAVE_FULLSCREEN_CHANNEL = 'hypersol:leave-fullscreen';

import type { DataOp, DataReply, DataRequest } from './data';
import type { PrivacyOp, PrivacyReply, PrivacyRequest } from './privacy';
import type { InspectOp, InspectReply, InspectRequest } from './inspect';
import type { DownloadInfo, DownloadOp, DownloadReply, DownloadRequest } from './downloads';
import type { PermissionKind, PermissionOp, PermissionPrompt, PermissionReply, PermissionRequest } from './permissions';
import type { PasswordOffer, PasswordOp, PasswordReply, PasswordRequest } from './passwords';
import type { SignInOp, SignInPrompt, SignInReply, SignInRequest } from './sign-in';
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
  | 'lift'
  | 'look-around'
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
  | 'forward'
  | 'open-file'
  | 'examples'
  | 'text-view';

export type ShellCommand =
  | { type: 'shortcut'; name: ShortcutName }
  | { type: 'open-tab'; url: string; background: boolean; openerWebContentsId?: number }
  /** A page's favicon, for the page at `page` (the tab may have left it meanwhile). */
  | { type: 'favicon'; webContentsId: number; page: string; dataUrl: string }
  | { type: 'data-changed'; what: 'bookmarks' | 'history' | 'settings' | 'passwords' }
  /** A page asks for the camera, microphone, or location: show the prompt for its tab (milestone 9). */
  | { type: 'permission-prompt'; prompt: PermissionPrompt }
  /** A prompt is no longer wanted (the tab left the site or closed). */
  | { type: 'permission-ended'; id: number }
  /** What a tab's page has been given access to (the in-use marker); [] clears it. */
  | { type: 'site-access'; webContentsId: number; kinds: PermissionKind[] }
  /** A site or a proxy asks for a user name and password: show the sign-in prompt for its tab (shared/sign-in.ts). */
  | { type: 'sign-in-prompt'; prompt: SignInPrompt }
  /** A sign-in prompt is no longer wanted (answered, or the tab left the page or closed). */
  | { type: 'sign-in-ended'; id: number }
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
  /** HTTPS-only (milestone 26): the site sent its upgraded page back to plain HTTP; the tab shows the card for that address. */
  | { type: 'https-only-refused'; webContentsId: number; url: string }
  /** The downloads list changed (milestone 8). */
  | { type: 'downloads'; items: DownloadInfo[] }
  /** The filter lists changed (refreshed, or a refresh started or failed). */
  | { type: 'filters-changed' }
  /** The window is closing: save the open tabs now, then call closeReady(). */
  | { type: 'prepare-close' }
  /**
   * "Lift into the room" in a page's right-click menu (milestone 28): what
   * the page's preload found where it was clicked, unchecked (the shell
   * checks it, shared/lift.ts parseLiftItem).
   */
  | { type: 'lift'; webContentsId: number; item: unknown }
  /** A page filled the screen, or left it (GitHub issue #75). */
  | { type: 'page-fullscreen'; webContentsId: number; on: boolean }
  /** A page took the pointer, or gave it back. */
  | { type: 'pointer-lock'; webContentsId: number; on: boolean }
  /** In full screen, the pointer reached the top of the screen: the notice shows again. */
  | { type: 'fullscreen-top-edge'; webContentsId: number };

/** A rectangle of a page, in its CSS pixels (shared/lift.ts LiftRect; repeated here, as the shell's preload may not share a file with the page's). */
export interface LiftArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A model's files for lifting (milestone 28, Q3 a), from the page's own site, within the viewer's limits; or why not. */
export type LiftModelReply =
  | {
      ok: true;
      /** The model's address, after any redirect. */
      url: string;
      /** The model file itself. */
      main: Uint8Array;
      /** The files it names, by the address it names them with. */
      resources: { uri: string; bytes: Uint8Array }[];
      /** Files it names that were not fetched: from another site, or past a limit. It is shown without them. */
      skipped: string[];
    }
  | { ok: false; reason: string };

/** What the shell's preload exposes as window.hypersol. */
export interface ShellBridge {
  platform: string;
  versions: { electron: string; chrome: string };
  onCommand(listener: (command: ShellCommand) => void): () => void;
  /** A JPEG data: URL of a tab's page, or null if it cannot be captured. */
  captureTab(webContentsId: number): Promise<string | null>;
  /** Lifting (milestone 28): one rectangle of a tab's page as drawn, as PNG bytes at the screen's resolution, or null. */
  liftCapture(webContentsId: number, area: LiftArea): Promise<Uint8Array | null>;
  /** Lifting (milestone 28): a model's files, from the tab's page's own site. */
  liftModel(webContentsId: number, url: string): Promise<LiftModelReply>;
  /** Takes a tab's page out of full screen and gives the pointer back (GitHub issue #75: a tab switch, a closing tab). */
  leaveFullscreen(webContentsId: number): Promise<void>;
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
  /** HTTP sign-in: what was typed into a sign-in prompt, or its cancelling (shared/sign-in.ts). */
  signIn<K extends SignInOp>(request: Extract<SignInRequest, { op: K }>): Promise<SignInReply<K>>;
  /** A closed or sleeping tab's history into a new page (shared/tabs.ts). */
  tabs<K extends TabsOp>(request: Extract<TabsRequest, { op: K }>): Promise<TabsReply<K>>;
  /** Answer to prepare-close: saving is done (or has failed), the window may close. */
  closeReady(): void;
  /** While true, key presses reach Settings instead of acting as shortcuts (remapping, milestone 11). */
  captureKeys(on: boolean): void;
  /**
   * Opens a HoloML file from the computer (milestone 14): a file dropped on
   * the window, or with none, the system's file chooser. Resolves to the
   * address to load, or null.
   */
  openFile(file?: File): Promise<string | null>;
}
