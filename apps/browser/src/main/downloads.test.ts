import { EventEmitter } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ shell: {} }));
const { Downloads } = await import('./downloads');

/** A stand-in for Electron's DownloadItem. */
function fakeItem(name: string) {
  const item = Object.assign(new EventEmitter(), {
    path: '',
    received: 0,
    getFilename: () => name,
    getURL: () => `http://127.0.0.1/${name}`,
    getTotalBytes: () => 1000,
    getReceivedBytes: () => item.received,
    cancel: vi.fn(),
    setSavePath(path: string) {
      item.path = path;
    },
  });
  return item;
}

function setup() {
  const folder = mkdtempSync(join(tmpdir(), 'hypersol-unit-downloads-'));
  const ses = new EventEmitter();
  const downloads = new Downloads({ folder: () => folder, onChange: () => undefined });
  downloads.watch(ses as never);
  const start = (name: string) => {
    const item = fakeItem(name);
    ses.emit('will-download', {}, item);
    return item;
  };
  return { downloads, start };
}

describe('Downloads list (GitHub issue #10)', () => {
  it('keeps a running download after 100 later ones finish: listed, cancellable, its name reserved', async () => {
    const { downloads, start } = setup();
    const slow = start('collision.bin');
    for (let i = 0; i < 100; i++) start(`small-${i}.txt`).emit('done', {}, 'completed');
    const list = downloads.list();
    expect(list).toHaveLength(100); // the list is still trimmed, of finished ones only
    expect(list[0]).toMatchObject({ id: 1, state: 'progressing' });
    expect(await downloads.handle({ op: 'downloads.cancel', id: 1 })).toEqual({ ok: true, value: null });
    expect(slow.cancel).toHaveBeenCalled();
    const same = start('collision.bin'); // the running one still holds its name
    expect(same.path).not.toBe(slow.path);
    expect(same.path.endsWith('collision (1).bin')).toBe(true);
  });

  it('keeps a download interrupted but able to resume (not done): listed and cancellable (PR #16 review)', async () => {
    const { downloads, start } = setup();
    const first = start('resumable.bin');
    first.emit('updated', {}, 'interrupted');
    expect(downloads.list()[0]).toMatchObject({ id: 1, state: 'interrupted', finished: false });
    for (let i = 0; i < 100; i++) start(`small-${i}.txt`).emit('done', {}, 'completed');
    expect(downloads.list().some((d) => d.id === 1)).toBe(true);
    expect(await downloads.handle({ op: 'downloads.cancel', id: 1 })).toEqual({ ok: true, value: null });
    expect(first.cancel).toHaveBeenCalled();
    // Once done for good, it is finished and "Clear list" removes it.
    first.emit('done', {}, 'interrupted');
    expect(downloads.list().find((d) => d.id === 1)).toMatchObject({ finished: true });
    await downloads.handle({ op: 'downloads.clear' });
    expect(downloads.list()).toEqual([]);
  });

  it('never drops running downloads, even more than the list holds', () => {
    const { downloads, start } = setup();
    for (let i = 0; i < 102; i++) start(`busy-${i}.bin`);
    expect(downloads.active).toBe(102);
    expect(downloads.list()).toHaveLength(102);
  });
});
