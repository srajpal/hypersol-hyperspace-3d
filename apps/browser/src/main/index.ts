import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, powerMonitor, protocol, safeStorage, screen, session, webContents, type Session, type WebContents } from 'electron';
import { daylight, nebula, themeById, type Theme } from '@hypersol/themes';
import type { ThemeChoice } from '../shared/settings';
import {
  CAPTURE_KEYS_CHANNEL,
  CAPTURE_TAB_CHANNEL,
  CLOSE_READY_CHANNEL,
  OPEN_FILE_CHANNEL,
  PRIVATE_PARTITION,
  SHELL_COMMAND_CHANNEL,
  type ShellCommand,
} from '../shared/commands';
import { DOWNLOADS_CHANNEL } from '../shared/downloads';
import { PERMISSIONS_CHANNEL } from '../shared/permissions';
import { PASSWORDS_CHANNEL } from '../shared/passwords';
import { PAGE_PASSWORDS_CHANNEL } from '../shared/page-passwords';
import { Passwords } from './passwords';
import { PasswordVault, type Keychain } from './passwords/vault';
import { Permissions } from './permissions';
import { SIGN_IN_CHANNEL } from '../shared/sign-in';
import { SignIns } from './sign-in';
import { TabHistory } from './tab-history';
import { TABS_CHANNEL } from '../shared/tabs';
import { Downloads } from './downloads';
import { DATA_CHANNEL } from '../shared/data';
import { PRIVACY_CHANNEL } from '../shared/privacy';
import { INSPECT_CHANNEL } from '../shared/inspect';
import { Inspector } from './inspect';
import { wireGuest, wireShortcuts } from './guests';
import { parseLaunchOptions } from './launch-options';
import { DEFAULT_WINDOW, openingBounds, sameBounds, type Opening } from './window-bounds';
import { chooseProfileFolder } from './profile-folder';
import { Privacy } from './privacy';
import { hardenShell, isAcceptableDrop, refuseClientCertificates } from './security';
import { confirmLeave } from './leave-page';
import { afterShellCrash, SHELL_FAILED_MESSAGE, SHELL_FAILED_TITLE, START_FAILED_TITLE, startFailedMessage } from './start-up';
import { shellOnly } from './ipc';
import { HolomlPages } from './holoml';
import { HOLOML_DROP_CHANNEL, LOCAL_SCHEME, VIEWER_SCHEME } from '../shared/holoml-page';
import { StorageService } from './storage/service';
import { inProcess, WorkerHistory } from './storage/history-backend';
import { Worker } from 'node:worker_threads';
import { installTestHooks, type TestLog } from './test-hooks';

const options = parseLaunchOptions(process.argv, process.env, app.isPackaged);

// Development and test runs never use a real profile (AGENTS.md rule 1).
if (options.userDataDir) {
  app.setPath('userData', options.userDataDir);
} else if (!app.isPackaged) {
  app.setPath('userData', join(app.getAppPath(), '..', '..', 'userData', 'dev'));
} else {
  // The data folder follows the product name; an install from before the
  // rename to HyperSpace 3D keeps its folder, and with it its bookmarks,
  // history, and settings (main/profile-folder.ts).
  app.setPath('userData', chooseProfileFolder(app.getPath('appData'), app.getName(), existsSync));
}

if (options.testBackground) {
  // Test windows sit off screen, behind everything. Chromium normally stops
  // drawing windows nobody can see; these switches keep it drawing, so the
  // checks see the same frames as a visible window.
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
}

if (options.testMode) {
  // A stand-in camera and microphone for the permission checks (milestone
  // 9, K6): pages get a test picture and tone, never a real device. The
  // prompt itself still appears and must be answered.
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
}

const PAGE_PRELOAD = join(__dirname, '../preload/page.js');
const SHELL_PRELOAD = join(__dirname, '../preload/shell.js');

let mainWindow: BrowserWindow | null = null;
/**
 * Set when the application is asked to quit (Quit, Cmd+Q, app.quit()),
 * as opposed to one window closing. Holding a window open to save the
 * tabs cancels that quit, so it is resumed afterwards (PR #7 review).
 */
let quitting = false;
let testLog: TestLog | null = null;
let storage: StorageService | null = null;
let privacy: Privacy | null = null;
let inspector: Inspector | null = null;
let permissions: Permissions | null = null;
let signIns: SignIns | null = null;
let passwords: Passwords | null = null;
let tabHistory: TabHistory | null = null;
let holoml: HolomlPages | null = null;
/** Settings is waiting for a shortcut's new keys (milestone 11). */
let capturingKeys = false;
/** The person's own shortcut keys, from settings. */
const shortcutKeys = () => storage?.settingsFile.settings.shortcuts ?? {};
/** The private tabs' in-memory session. */
let privateSession: Session | null = null;

/** The app's own shell: the only sender the privileged request channels answer (main/ipc.ts). */
const isShell = (contents: WebContents) => mainWindow !== null && contents === mainWindow.webContents;
const handleFromShell = shellOnly(isShell);

/**
 * The app cannot go on (main/start-up.ts): say so in plain words and end,
 * so no process without a window is left holding the single-instance
 * lock. Test runs open no box: the message goes to the log.
 */
function giveUp(title: string, message: string): void {
  if (options.testMode) console.error(`${title}\n${message}`);
  else dialog.showErrorBox(title, message);
  // app.exit() skips will-quit, where saved data is otherwise closed: close
  // it here, so the history worker's thread has stopped before the process
  // ends (ending under a running worker crashed now and then, seen in the
  // start-up check).
  const saved = storage;
  storage = null;
  const end = () => app.exit(1);
  if (saved) void saved.closed().then(end, end);
  else setImmediate(end);
}

/**
 * Windows and Linux: no menu bar; shortcuts are handled per web contents
 * (main/guests.ts) and clipboard keys work natively. macOS needs an app
 * menu with the standard Edit roles for copy and paste to work.
 */
function setAppMenu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]),
  );
}

/**
 * The window follows the theme (milestone 6): its background (shown while
 * the shell loads) and the title bar's light or dark scheme. "Match the
 * system" leaves the scheme to the system.
 */
function windowTheme(choice: ThemeChoice): Theme {
  nativeTheme.themeSource = choice === 'system' ? 'system' : themeById(choice).scheme;
  return themeFor(choice);
}

/** The theme a choice stands for: itself, or for "Match the system" the one for the system's scheme. */
function themeFor(choice: ThemeChoice): Theme {
  return choice === 'system' ? (nativeTheme.shouldUseDarkColors ? nebula : daylight) : themeById(choice);
}

function applyWindowTheme(): void {
  const theme = windowTheme(storage?.settingsFile.settings.theme ?? 'nebula');
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setBackgroundColor(theme.colors.backgroundBottom);
}

/** A spot to the right of every display, for background test windows. */
function offScreenPosition(): { x: number; y: number } {
  const right = Math.max(...screen.getAllDisplays().map((d) => d.bounds.x + d.bounds.width));
  return { x: right + 200, y: 0 };
}

/**
 * Where the window opens (main/window-bounds.ts): as it was last left, if
 * that is remembered and still on a connected display. A background test
 * window sits off every display by design, so only its size is taken.
 */
function windowOpening(): Opening {
  const saved = options.rememberWindow ? (storage?.settingsFile.settings.windowBounds ?? null) : null;
  if (options.testBackground) return { width: saved?.width ?? DEFAULT_WINDOW.width, height: saved?.height ?? DEFAULT_WINDOW.height, maximized: false };
  return openingBounds(
    saved,
    screen.getAllDisplays().map((d) => d.workArea),
  );
}

/** How long the window's size and place must hold still before they are saved. */
const WINDOW_SAVE_DELAY_MS = 500;

/**
 * Saves the window's size and place in settings.json as they change,
 * once they have settled, and at once when the window closes (review of
 * 2026-09-30, D7). The bounds saved are the ones it has while not
 * maximised, with whether it is maximised beside them, so leaving the
 * maximised state goes back to the size it had. A failed save is logged
 * and tried again at the next change.
 */
function rememberWindow(win: BrowserWindow): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(timer);
    const saved = storage;
    if (!saved || win.isDestroyed() || win.isFullScreen()) return;
    const { x, y, width, height } = win.getNormalBounds();
    const now = { x, y, width, height, maximized: win.isMaximized() };
    if (sameBounds(saved.settingsFile.settings.windowBounds, now)) return;
    try {
      saved.updateSettings({ windowBounds: now }, false);
    } catch (e) {
      console.warn(`Couldn't save the window's size: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(save, WINDOW_SAVE_DELAY_MS);
  };
  win.on('resize', soon);
  win.on('move', soon);
  win.on('maximize', soon);
  win.on('unmaximize', soon);
  win.on('close', save);
  win.on('closed', () => clearTimeout(timer));
}

function createWindow(): void {
  const opening = windowOpening();
  const win = new BrowserWindow({
    width: opening.width,
    height: opening.height,
    ...(opening.x !== undefined && opening.y !== undefined ? { x: opening.x, y: opening.y } : {}),
    ...(options.testBackground ? { ...offScreenPosition(), skipTaskbar: true } : {}),
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'HyperSpace 3D',
    backgroundColor: windowTheme(storage?.settingsFile.settings.theme ?? 'nebula').colors.backgroundBottom,
    autoHideMenuBar: true,
    webPreferences: {
      preload: SHELL_PRELOAD,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: true,
      spellcheck: false,
      // Test mode only: as on a computer where Chromium cannot start WebGL.
      ...(options.testNoWebGL ? { webgl: false } : {}),
    },
  });
  mainWindow = win;

  const send = (command: ShellCommand) => {
    if (!win.isDestroyed()) win.webContents.send(SHELL_COMMAND_CHANNEL, command);
  };
  hardenShell(win.webContents, PAGE_PRELOAD, (record) => testLog?.attaches.push(record), options.testNoWebGL, options.testMode);
  wireShortcuts(win.webContents, { send, platform: process.platform, shortcutKeys, capturingKeys: () => capturingKeys });
  if (!app.isPackaged) {
    // Developer tools for the shell in development runs only.
    win.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
    });
  }
  // Background test windows appear without taking focus. A window that
  // was left maximised opens maximised.
  win.once('ready-to-show', () => {
    if (options.testBackground) win.showInactive();
    else if (opening.maximized) win.maximize();
    else win.show();
  });
  if (options.rememberWindow) rememberWindow(win);
  win.on('closed', () => {
    mainWindow = null;
    // Every tab went with the window, private ones included: clear the
    // private session now, from the main process, since the shell can no
    // longer say so. On macOS the app keeps running, and a reopened window
    // must not find the old private data (PR #16 review).
    endPrivate();
  });
  // A crashed shell takes its tabs with it too. It is reloaded once; if it
  // goes again within a minute the app says so and ends (main/start-up.ts).
  let lastCrashAt: number | null = null;
  win.webContents.on('render-process-gone', (_event, details) => {
    endPrivate();
    if (details.reason === 'clean-exit' || win.isDestroyed()) return;
    const now = Date.now();
    if (afterShellCrash(lastCrashAt, now) === 'quit') {
      giveUp(SHELL_FAILED_TITLE, SHELL_FAILED_MESSAGE);
      return;
    }
    lastCrashAt = now;
    win.webContents.reload();
  });
  // Economy mode can follow the power source (milestone 10).
  // Test runs start as if on mains power, so a laptop on battery runs the
  // same checks; the economy checks switch the power source themselves.
  win.webContents.on('did-finish-load', () => send({ type: 'power', onBattery: options.testMode ? false : powerMonitor.isOnBatteryPower() }));
  flushBeforeClose(win);

  const query: Record<string, string> = {
    startUrl: options.startUrl,
    appVersion: app.getVersion(),
  };
  // A tilt given on the command line wins over Settings > Page tilt (tests, development).
  if (process.argv.some((a) => a.startsWith('--tilt='))) query['tilt'] = String(options.tiltDeg);
  if (options.testMode) query['test'] = '1';
  if (options.searchUrl) query['searchUrl'] = options.searchUrl;
  if (options.showroomUrl) query['showroomUrl'] = options.showroomUrl;
  if (options.examplesBase) query['examplesBase'] = options.examplesBase;
  if (options.testSleepMinuteMs) query['sleepMinuteMs'] = String(options.testSleepMinuteMs);

  const devServer = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devServer) {
    void win.loadURL(`${devServer}?${new URLSearchParams(query).toString()}`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { query });
  }
}

/** A clearing of the private session in progress; a new window waits for it. */
let privateClearing: Promise<void> | null = null;

/** Starts clearing the private session (window closed, shell gone); a new window waits for it. */
function endPrivate(): void {
  const clearing = forgetPrivateData().catch((e: unknown) => console.warn(`Couldn't clear private data: ${String(e)}`));
  privateClearing = clearing;
  void clearing.finally(() => {
    if (privateClearing === clearing) privateClearing = null;
  });
}

/** The last private tab closed: its session's cookies, storage, and cache go. */
async function forgetPrivateData(): Promise<void> {
  const s = privateSession;
  if (!s) return;
  privacy?.forgetPrivate();
  inspector?.forgetPrivate();
  permissions?.forgetPrivate();
  tabHistory?.forgetPrivate();
  await s.clearStorageData();
  await s.clearCache();
  await s.clearAuthCache();
}

/** The first scheduled filter refresh waits this long, so it does not compete with the first pages. */
const FIRST_REFRESH_DELAY_MS = 30_000;

/** How long a closing window waits for the shell to save the open tabs. */
const CLOSE_FLUSH_MS = 2000;

/**
 * Before the window closes, the shell saves the open tabs at once (its
 * usual save waits for changes to settle) and confirms; the window then
 * closes. If the shell does not answer within CLOSE_FLUSH_MS, or has
 * crashed, it closes anyway (GitHub issue #3). When the application was
 * quitting, the quit is resumed rather than only closing the window, so
 * on macOS, where closing the last window keeps the app running, Quit
 * still quits.
 */
function flushBeforeClose(win: BrowserWindow): void {
  let ready = false;
  let waiting = false;
  win.on('close', (event) => {
    if (ready || win.webContents.isCrashed() || win.webContents.isDestroyed()) return;
    event.preventDefault();
    if (waiting) return;
    waiting = true;
    const finish = () => {
      ipcMain.removeListener(CLOSE_READY_CHANNEL, onReady);
      clearTimeout(timer);
      ready = true;
      waiting = false;
      if (quitting) app.quit();
      else if (!win.isDestroyed()) win.close();
    };
    const onReady = (e: Electron.IpcMainEvent) => {
      if (e.sender === win.webContents) finish();
    };
    const timer = setTimeout(finish, CLOSE_FLUSH_MS);
    ipcMain.on(CLOSE_READY_CHANNEL, onReady);
    win.webContents.send(SHELL_COMMAND_CHANNEL, { type: 'prepare-close' } satisfies ShellCommand);
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'webview') return;
    privacy?.trackTab(contents);
    inspector?.trackTab(contents);
    permissions?.trackTab(contents);
    signIns?.trackTab(contents);
    passwords?.trackTab(contents);
    tabHistory?.track(contents);
    const guestId = contents.id;
    contents.once('destroyed', () => {
      holoml?.forget(guestId);
      signIns?.forget(contents);
    });
    holoml?.track(contents);
    // Sound, for the speaker on the tab and for keeping it awake (milestone 10).
    contents.on('audio-state-changed', (event) => {
      const host = contents.hostWebContents;
      if (host && !host.isDestroyed()) {
        host.send(SHELL_COMMAND_CHANNEL, { type: 'audio', webContentsId: contents.id, audible: event.audible } satisfies ShellCommand);
      }
    });
    // A private tab keeps nothing: no history, and its session's data goes
    // when the last private tab closes (milestone 8). The shell says when
    // that is, since a blank private tab has no page yet (PR #16 review).
    const isPrivate = privateSession !== null && contents.session === privateSession;
    wireGuest(contents, {
      send: (command) => {
        const host = contents.hostWebContents;
        if (host && !host.isDestroyed()) host.send(SHELL_COMMAND_CHANNEL, command);
      },
      platform: process.platform,
      shortcutKeys,
      capturingKeys: () => capturingKeys,
      holomlPage: () => !contents.isDestroyed() && (holoml?.isDocument(contents.id, contents.getURL()) ?? false),
      get testLog() {
        return testLog;
      },
      // Files opened from the computer are not history: their addresses last one run (milestone 14).
      recordVisit: (url, title) => (isPrivate || url.startsWith(`${LOCAL_SCHEME}:`) ? null : (storage?.recordVisit(url, title) ?? null)),
      updateVisitTitle: (id, title) => void storage?.updateVisitTitle(id, title),
      confirmLeave: (url) => {
        // Block for the camera or microphone reloads the page whatever it says (main/permissions.ts).
        if (permissions?.endingCapture(contents)) return true;
        // Test runs open no native box: the ask is recorded and answered by the check.
        if (testLog) {
          testLog.leaveAsks.push(url);
          return testLog.leaveAnswer === 'leave';
        }
        const win = mainWindow;
        return win === null || win.isDestroyed() ? true : confirmLeave((box) => dialog.showMessageBoxSync(win, box));
      },
      fetchFavicon: (url, init) => (privacy ? privacy.fetchFavicon(contents, url, init) : contents.session.fetch(url, init)),
    });
  });

  refuseClientCertificates(app);

  // HoloML pages (milestone 14): the viewer's script, and files opened
  // from the computer. Registered before the app is ready, as Electron asks.
  protocol.registerSchemesAsPrivileged([
    { scheme: VIEWER_SCHEME, privileges: { standard: true, secure: true, corsEnabled: true, supportFetchAPI: true } },
    { scheme: LOCAL_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  ]);

  const start = (): void => {
    if (options.testMode) testLog = installTestHooks();

    const ses = session.defaultSession;
    const privateSes = session.fromPartition(PRIVATE_PARTITION);
    privateSession = privateSes;
    for (const s of [ses, privateSes]) {
      // No dictionary downloads (privacy statement, ARCHITECTURE.md section 8).
      s.setSpellCheckerEnabled(false);
    }

    // Downloads go straight to the Downloads folder (milestone 8, Q2 a).
    const downloadsFolder = options.downloadsDir ?? app.getPath('downloads');
    // Folders that hold many unrelated files: a HoloML file opened from one
    // reads the files beside it only (main/holoml.ts).
    const sharedFolders = [downloadsFolder];
    for (const name of ['desktop', 'documents', 'home'] as const) {
      try {
        sharedFolders.push(app.getPath(name));
      } catch {
        // A system without that folder has nothing to share from it.
      }
    }

    // HoloML pages (milestone 14, main/holoml.ts).
    const devServer = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined;
    const pages = new HolomlPages({
      viewerFiles: devServer ? null : join(__dirname, '../renderer'),
      ...(devServer ? { devServer, viewerSource: join(__dirname, '../../src/viewer/main.ts') } : {}),
      sharedFolders,
    });
    holoml = pages;
    pages.register(ses);
    pages.register(privateSes);
    pages.wire();
    handleFromShell(
      OPEN_FILE_CHANNEL,
      async (_event, path) => {
        if (!mainWindow) return null;
        if (typeof path === 'string') return pages.openFile(path);
        const chosen = await dialog.showOpenDialog(mainWindow, {
          title: 'Open a HoloML file',
          properties: ['openFile'],
          filters: [{ name: 'HoloML pages', extensions: ['holoml'] }],
        });
        return chosen.canceled || !chosen.filePaths[0] ? null : pages.openFile(chosen.filePaths[0]);
      },
      null,
    );
    // A .holoml file dropped onto a page opens in that tab. The message is
    // held to what the main process can know about it (isAcceptableDrop).
    const dropping = new Set<number>();
    ipcMain.on(HOLOML_DROP_CHANNEL, (event, path: unknown) => {
      const guest = event.sender;
      const drop = {
        path,
        senderType: guest.getType(),
        fromMainFrame: event.senderFrame !== null && event.senderFrame === guest.mainFrame,
        hostedByShell: guest.hostWebContents !== null && guest.hostWebContents !== undefined && isShell(guest.hostWebContents),
        alreadyOpening: dropping.has(guest.id),
      };
      if (!isAcceptableDrop(drop) || typeof path !== 'string') return;
      dropping.add(guest.id);
      void pages
        .openFile(path)
        .then((url) => (url && !guest.isDestroyed() ? guest.loadURL(url) : undefined))
        .catch(() => undefined)
        .finally(() => dropping.delete(guest.id));
    });
    if (testLog) testLog.openLocal = (path) => pages.openFile(path);

    // A copy for the closures below: testLog is a variable of the module, so
    // inside them TypeScript cannot know it is still set.
    const downloadsLog = testLog;
    const downloads = new Downloads({
      folder: () => downloadsFolder,
      onChange: (items) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(SHELL_COMMAND_CHANNEL, { type: 'downloads', items } satisfies ShellCommand);
        }
      },
      ...(downloadsLog ? { opened: (what: string, path: string) => downloadsLog.opened.push({ what, path }) } : {}),
    });
    downloads.watch(ses);
    downloads.watch(privateSes);
    handleFromShell(DOWNLOADS_CHANNEL, (_event, request) => downloads.handle(request));

    // Settings captures a shortcut's new keys: they must not act meanwhile.
    ipcMain.on(CAPTURE_KEYS_CHANNEL, (event, on: unknown) => {
      if (mainWindow && event.sender === mainWindow.webContents) capturingKeys = on === true;
    });

    // Tab snapshots for the cards: only for a web page the asking shell hosts.
    ipcMain.handle(CAPTURE_TAB_CHANNEL, async (event, id: unknown) => {
      if (typeof id !== 'number') return null;
      const guest = webContents.fromId(id);
      if (!guest || guest.isDestroyed() || guest.getType() !== 'webview') return null;
      if (guest.hostWebContents !== event.sender) return null;
      try {
        const image = await guest.capturePage();
        if (image.isEmpty()) return null;
        return `data:image/jpeg;base64,${image.resize({ width: 400, quality: 'good' }).toJPEG(80).toString('base64')}`;
      } catch {
        return null;
      }
    });

    // Saved data lives in the app data folder (a throwaway one in dev and tests).
    storage = new StorageService(
      app.getPath('userData'),
      {
        clearCookiesAndSiteData: () =>
          ses.clearStorageData({
            storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage', 'filesystem'],
          }),
        clearCache: () => ses.clearCache(),
      },
      {
        // History searches and writes run in a worker thread, so a long
        // history never holds up the main process (milestone 10, GitHub
        // issue #4); the main thread takes over if the worker fails.
        historyBackend: (store, path) => {
          const fallback = inProcess(store.history);
          try {
            const worker = new Worker(join(__dirname, 'history-worker.js'), { workerData: { path } });
            return new WorkerHistory(worker, fallback, (message) => console.warn(message));
          } catch (e) {
            console.warn(`History worker could not start: ${String(e)}`);
            return fallback;
          }
        },
      },
    );
    if (storage.problem) console.warn(`Saved data unavailable: ${storage.problem}`);
    handleFromShell(DATA_CHANNEL, (_event, request) => {
      if (testLog && typeof request === 'object' && request !== null) {
        const op = String((request as { op?: unknown }).op);
        testLog.dataOps[op] = (testLog.dataOps[op] ?? 0) + 1;
      }
      return storage!.handle(request);
    });
    // Site permissions (milestone 9): the camera, microphone, and location
    // ask first; everything else is refused, as before.
    const saved = storage;
    const isPrivateTab = (contents: WebContents) => contents.session === privateSes;
    const sendToHost = (contents: WebContents, command: ShellCommand) => {
      const host = contents.hostWebContents;
      if (host && !host.isDestroyed()) host.send(SHELL_COMMAND_CHANNEL, command);
    };
    const perms = new Permissions({
      isPrivate: isPrivateTab,
      saved: () => saved.settingsFile.settings.sitePermissions,
      save: (sites) => saved.updateSettings({ sitePermissions: sites }),
      send: sendToHost,
      ...(testLog ? { refused: (permission: string) => testLog?.refusedPermissions.push(permission) } : {}),
    });
    permissions = perms;
    perms.protect(ses);
    perms.protect(privateSes);
    handleFromShell(PERMISSIONS_CHANNEL, (event, request) => perms.handle(event, request));

    // HTTP sign-in (main/sign-in.ts): a site or a proxy that asks for a user
    // name and password is answered through a prompt in the tab's shell.
    // With no listener Electron cancels every such request.
    const asking = new SignIns({
      isTab: (contents) => {
        const host = contents.hostWebContents;
        return host !== null && host !== undefined && isShell(host);
      },
      send: sendToHost,
    });
    signIns = asking;
    app.on('login', (event, contents, details, authInfo, callback) => {
      event.preventDefault();
      asking.ask(
        contents,
        { url: details.url, isProxy: authInfo.isProxy, host: authInfo.host, port: authInfo.port, realm: authInfo.realm, forNavigation: details.isRequestForNavigation },
        callback,
      );
    });
    handleFromShell(SIGN_IN_CHANNEL, (event, request) => asking.handle(event, request));
    if (testLog) testLog.signInsWaiting = () => asking.waiting;

    // Saved passwords (milestone 9), encrypted with the system's keychain.
    const noKeychain = options.testNoKeychain;
    const keychain: Keychain = {
      problem: () => {
        const missing = "Passwords can't be saved: this computer's keychain isn't available.";
        if (noKeychain || !safeStorage.isEncryptionAvailable()) return missing;
        // On Linux without a keyring Electron falls back to a fixed key, which protects nothing.
        if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') return missing;
        return null;
      },
      encrypt: (text) => safeStorage.encryptString(text),
      decrypt: (bytes) => safeStorage.decryptString(Buffer.from(bytes)),
    };
    const pw = new Passwords(new PasswordVault(() => saved.database, keychain), {
      isPrivate: isPrivateTab,
      send: sendToHost,
      writeClipboard: (text) => clipboard.writeText(text),
      onChange: () => saved.notify('passwords'),
      colors: () => {
        const { text, textMuted, panelGlass, accent } = themeFor(saved.settingsFile.settings.theme).colors;
        return { text, textMuted, surface: panelGlass, accent };
      },
    });
    passwords = pw;
    ipcMain.handle(PAGE_PASSWORDS_CHANNEL, (event, request: unknown) => pw.handlePage(event, request));
    handleFromShell(PASSWORDS_CHANNEL, (_event, request) => pw.handleShell(request));

    // Back and forward history for reopened and waking tabs (milestone 10).
    const tabsHistory = new TabHistory({ isPrivate: isPrivateTab });
    tabHistory = tabsHistory;
    handleFromShell(TABS_CHANNEL, (event, request) => tabsHistory.handle(event, request));
    const sendPower = (onBattery: boolean) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(SHELL_COMMAND_CHANNEL, { type: 'power', onBattery } satisfies ShellCommand);
    };
    powerMonitor.on('on-battery', () => sendPower(true));
    powerMonitor.on('on-ac', () => sendPower(false));
    if (testLog) {
      const kept = storage;
      testLog.historyWorker = () => kept.historyInWorker;
    }

    storage.onChange((what) => {
      if (what === 'settings') applyWindowTheme();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(SHELL_COMMAND_CHANNEL, { type: 'data-changed', what } satisfies ShellCommand);
      }
    });

    // Ad and tracker blocking, element hiding, filter lists, and encrypted
    // DNS (TODO.md milestone 4). Set up before the window, so the first
    // page is already protected. Test runs have no internet: lists are
    // refreshed on schedule only from a local address given with
    // --filters-base, and the DNS check asks a local stand-in (--dns-probe)
    // or is skipped.
    const log = testLog;
    // The instrument panel's readouts (milestone 7): in memory only.
    const inspect = new Inspector(ses, { isHolomlPage: (c) => pages.isDocument(c.id, c.getURL()) });
    inspector = inspect;
    inspect.setPrivateSession(privateSes);
    inspect.start();
    inspect.watch(privateSes);
    handleFromShell(INSPECT_CHANNEL, (event, request) => {
      if (testLog && typeof request === 'object' && request !== null) {
        const op = String((request as { op?: unknown }).op);
        testLog.dataOps[op] = (testLog.dataOps[op] ?? 0) + 1;
      }
      return inspect.handle(event, request);
    });
    privacy = new Privacy(ses, storage, {
      onTabRequest: (tab, details) => inspect.requestStarted(tab, details),
      adjustHeaders: (details, response) => pages.adjust(details, response),
      filtersDir: join(app.getAppPath(), 'resources', 'filters'),
      savedDir: join(app.getPath('userData'), 'filters'),
      ...(options.filtersBase ? { filtersBase: options.filtersBase } : {}),
      refreshDelayMs: options.testMode ? (options.filtersBase ? 1000 : null) : FIRST_REFRESH_DELAY_MS,
      ...(options.testMode ? { dnsProbeUrl: options.dnsProbeUrl ?? null } : {}),
      ...(log
        ? {
            observe: (url: string) => log.requests.push(url),
            onDnsApplied: (mode: string, resolver: string) => log.dnsApplied.push({ mode, resolver }),
          }
        : {}),
      isShell,
      onPrivateEnded: forgetPrivateData,
    });
    privacy.start();
    privacy.protect(privateSes);
    privacy.setPrivateSession(privateSes);
    const shield = privacy;
    handleFromShell(PRIVACY_CHANNEL, (event, request) => shield.handle(event, request));

    setAppMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length > 0) return;
      // A window reopened while the old one's private data is still being
      // cleared waits, so its first private tab starts clean.
      if (privateClearing) void privateClearing.then(() => BrowserWindow.getAllWindows().length === 0 && createWindow());
      else createWindow();
    });
  };

  // A throw while starting (a full disk, a data folder that cannot be
  // written) ends the app with a message, where it used to stay running
  // without a window (review of 2026-09-30, M9).
  void app
    .whenReady()
    .then(start)
    .catch((e: unknown) => giveUp(START_FAILED_TITLE, startFailedMessage(e, app.getPath('userData'))));

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('window-all-closed', () => {
    // macOS keeps the app running with no windows; tests can ask for the same.
    if (process.platform !== 'darwin' && !options.testKeepRunning) app.quit();
  });

  app.on('will-quit', () => storage?.close());
}
