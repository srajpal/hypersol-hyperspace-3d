import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  CAPTURE_TAB_CHANNEL,
  CLOSE_READY_CHANNEL,
  SHELL_COMMAND_CHANNEL,
  type ShellBridge,
  type ShellCommand,
} from '../shared/commands';
import { DATA_CHANNEL } from '../shared/data';
import { PRIVACY_CHANNEL } from '../shared/privacy';
import { INSPECT_CHANNEL } from '../shared/inspect';
import { DOWNLOADS_CHANNEL } from '../shared/downloads';
import { PERMISSIONS_CHANNEL } from '../shared/permissions';
import { PASSWORDS_CHANNEL } from '../shared/passwords';
import { TABS_CHANNEL } from '../shared/tabs';

/**
 * The narrow bridge the 3D shell sees: read-only facts, commands from the
 * main process (shortcuts, new tabs, favicons, data changes, shield
 * counts), and requests: a snapshot of one of its own tabs, saved-data requests, and
 * privacy requests, which the main process checks one by one
 * (shared/data.ts, shared/privacy.ts).
 */
const bridge: ShellBridge = {
  platform: process.platform,
  versions: {
    electron: process.versions['electron'] ?? '',
    chrome: process.versions['chrome'] ?? '',
  },
  onCommand(listener) {
    const handler = (_event: IpcRendererEvent, command: ShellCommand) => listener(command);
    ipcRenderer.on(SHELL_COMMAND_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(SHELL_COMMAND_CHANNEL, handler);
    };
  },
  captureTab(webContentsId) {
    return ipcRenderer.invoke(CAPTURE_TAB_CHANNEL, webContentsId) as Promise<string | null>;
  },
  data(request) {
    return ipcRenderer.invoke(DATA_CHANNEL, request);
  },
  privacy(request) {
    return ipcRenderer.invoke(PRIVACY_CHANNEL, request);
  },
  inspect(request) {
    return ipcRenderer.invoke(INSPECT_CHANNEL, request);
  },
  downloads(request) {
    return ipcRenderer.invoke(DOWNLOADS_CHANNEL, request);
  },
  permissions(request) {
    return ipcRenderer.invoke(PERMISSIONS_CHANNEL, request);
  },
  passwords(request) {
    return ipcRenderer.invoke(PASSWORDS_CHANNEL, request);
  },
  tabs(request) {
    return ipcRenderer.invoke(TABS_CHANNEL, request);
  },
  closeReady() {
    ipcRenderer.send(CLOSE_READY_CHANNEL);
  },
};

contextBridge.exposeInMainWorld('hypersol', bridge);
