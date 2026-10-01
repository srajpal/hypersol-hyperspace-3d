import { ipcMain, type IpcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';

/** What any sender but the shell is answered, on channels that answer { ok, value } or { ok, error }. */
export const NOT_ALLOWED = { ok: false, error: 'Not allowed' } as const;

export type ShellHandler = (event: IpcMainInvokeEvent, request: unknown) => unknown;

/**
 * "Only the shell may ask" in one place (review of 2026-09-30, Sm4). The
 * function this returns registers a request handler on a channel and
 * answers every sender that is not the shell with the refusal, without
 * calling the handler: a web page, or anything else that finds the
 * channel's name, learns nothing and changes nothing. Every privileged
 * request channel is registered through it (main/index.ts). The two
 * one-way event channels (the shell says its keys are being captured,
 * or that it is ready to close) are plain listeners that compare the
 * sender with the shell's window themselves.
 */
export function shellOnly(isShell: (contents: WebContents) => boolean, ipc: Pick<IpcMain, 'handle'> = ipcMain) {
  return function handleFromShell(channel: string, handler: ShellHandler, refusal: unknown = NOT_ALLOWED): void {
    ipc.handle(channel, (event, request: unknown) => (isShell(event.sender) ? handler(event, request) : refusal));
  };
}
