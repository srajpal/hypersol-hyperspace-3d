import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ ipcMain: {} }));
const { NOT_ALLOWED, shellOnly } = await import('./ipc');

type Listener = (event: { sender: object }, request: unknown) => unknown;

function setup() {
  const shell = {};
  const listeners = new Map<string, Listener>();
  const ipc = { handle: (channel: string, listener: Listener) => void listeners.set(channel, listener) };
  const handleFromShell = shellOnly((contents) => contents === shell, ipc as never);
  const ask = (channel: string, sender: object, request: unknown) => listeners.get(channel)!({ sender }, request);
  return { shell, handleFromShell, ask };
}

describe('handleFromShell (review of 2026-09-30, Sm4)', () => {
  it('passes the shell\'s requests to the handler and answers with what it returns', async () => {
    const { shell, handleFromShell, ask } = setup();
    const handler = vi.fn(async (_event: unknown, request: unknown) => ({ ok: true, value: request }));
    handleFromShell('hypersol:test', handler);
    expect(await ask('hypersol:test', shell, { op: 'list' })).toEqual({ ok: true, value: { op: 'list' } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('refuses every other sender without calling the handler', () => {
    const { handleFromShell, ask } = setup();
    const handler = vi.fn(() => ({ ok: true, value: 'secret' }));
    handleFromShell('hypersol:test', handler);
    expect(ask('hypersol:test', {}, { op: 'list' })).toEqual({ ok: false, error: 'Not allowed' });
    expect(ask('hypersol:test', {}, { op: 'list' })).toBe(NOT_ALLOWED);
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers with a channel\'s own refusal where its replies have another shape', () => {
    const { shell, handleFromShell, ask } = setup();
    handleFromShell('hypersol:open-file', () => 'hypersol-file://abc/page.holoml', null);
    expect(ask('hypersol:open-file', {}, 'C:\page.holoml')).toBeNull();
    expect(ask('hypersol:open-file', shell, 'C:\page.holoml')).toBe('hypersol-file://abc/page.holoml');
  });
});
