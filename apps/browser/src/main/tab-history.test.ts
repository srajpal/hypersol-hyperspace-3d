import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { KEPT_HISTORIES } from '../shared/tabs';

const all = new Map<number, unknown>();
vi.mock('electron', () => ({ webContents: { fromId: (id: number) => all.get(id) } }));
const { TabHistory } = await import('./tab-history');

interface Entry {
  url: string;
  title: string;
}

const shell = {};
const privatePages = new Set<object>();

/** A stand-in for a web page's WebContents, with its back and forward history. */
function fakePage(id: number, entries: Entry[] = [], active = entries.length - 1) {
  const page = Object.assign(new EventEmitter(), {
    id,
    hostWebContents: shell as object,
    destroyed: false,
    loading: false,
    restored: null as { entries: Entry[]; index: number } | null,
    getType: (): string => 'webview',
    isDestroyed: () => page.destroyed,
    isLoading: () => page.loading,
    navigationHistory: {
      getAllEntries: () => entries,
      getActiveIndex: () => active,
      restore: (to: { entries: Entry[]; index: number }) => {
        if (page.destroyed) throw new Error('Object has been destroyed');
        page.restored = to;
        return Promise.resolve();
      },
    },
    /** The tab closes. */
    close: () => {
      page.destroyed = true;
      all.delete(id);
      page.emit('destroyed');
    },
  });
  all.set(id, page);
  return page;
}

function setup() {
  const history = new TabHistory({ isPrivate: (contents) => privatePages.has(contents) });
  const restore = (tab: number, from: number) => history.handle({ sender: shell } as never, { op: 'restore', tab, from });
  return { history, restore };
}

const A = { url: 'https://a.example/', title: 'A' };
const B = { url: 'https://b.example/', title: 'B' };

describe('TabHistory (milestone 10)', () => {
  it('gives a closed page\'s back and forward history to a new page, once', async () => {
    const { history, restore } = setup();
    const old = fakePage(1, [A, B], 0);
    history.track(old as never);
    old.emit('did-navigate');
    old.close();
    const fresh = fakePage(2);
    expect(await restore(2, 1)).toEqual({ ok: true, value: true });
    expect(fresh.restored).toEqual({ entries: [A, B], index: 0 });
    expect(await restore(2, 1)).toEqual({ ok: true, value: false }); // used up
  });

  it('gives an open (sleeping) page\'s history too, and keeps only web addresses', async () => {
    const { history, restore } = setup();
    const blank = { url: 'about:blank', title: '' };
    const local = { url: 'hypersol-file://0123456789abcdef/page.holoml', title: 'Local' };
    const asleep = fakePage(1, [blank, A, local, B], 3);
    history.track(asleep as never);
    asleep.emit('page-title-updated');
    const fresh = fakePage(2);
    expect(await restore(2, 1)).toEqual({ ok: true, value: true });
    expect(fresh.restored).toEqual({ entries: [A, B], index: 1 });
  });

  it('answers "nothing to restore" for a page that never went anywhere, and refuses a page that is not the shell\'s', async () => {
    const { history, restore } = setup();
    const never = fakePage(1, [{ url: 'about:blank', title: '' }]);
    history.track(never as never);
    never.emit('did-navigate');
    never.close();
    fakePage(2);
    expect(await restore(2, 1)).toEqual({ ok: true, value: false });
    const elsewhere = fakePage(3);
    elsewhere.hostWebContents = {};
    expect(await restore(3, 1)).toEqual({ ok: false, error: 'No such page' });
    expect(await restore(99, 1)).toEqual({ ok: false, error: 'No such page' });
    expect(await history.handle({ sender: shell } as never, { op: 'restore', tab: 0, from: 1 })).toHaveProperty('error');
  });

  it('never mixes private and normal tabs, and forgets private histories with the last private tab', async () => {
    const { history, restore } = setup();
    const secret = fakePage(1, [A]);
    privatePages.add(secret);
    history.track(secret as never);
    secret.emit('did-navigate');
    secret.close();
    fakePage(2);
    expect(await restore(2, 1)).toEqual({ ok: true, value: false }); // a normal page does not get it
    const alsoSecret = fakePage(3);
    privatePages.add(alsoSecret);
    history.forgetPrivate();
    expect(await restore(3, 1)).toEqual({ ok: true, value: false });
    expect(alsoSecret.restored).toBeNull();
  });

  it(`keeps the last ${KEPT_HISTORIES} closed pages' histories`, async () => {
    const { history, restore } = setup();
    for (let id = 1; id <= KEPT_HISTORIES + 1; id++) {
      const page = fakePage(id, [A]);
      history.track(page as never);
      page.emit('did-navigate');
      page.close();
    }
    fakePage(500);
    expect(await restore(500, 1)).toEqual({ ok: true, value: false }); // the oldest has gone
    expect(await restore(500, 2)).toEqual({ ok: true, value: true });
  });

  it('waits for the new page\'s first load, and does not throw when the tab closes meanwhile (review of 2026-09-30, M10)', async () => {
    const { history, restore } = setup();
    const old = fakePage(1, [A, B]);
    history.track(old as never);
    old.emit('did-navigate');
    old.close();
    // The new page is still loading its blank start when the tab is closed.
    const doomed = fakePage(2);
    doomed.loading = true;
    const waiting = restore(2, 1);
    doomed.close();
    expect(await waiting).toEqual({ ok: false, error: 'No such page' });
    expect(doomed.restored).toBeNull();
    // The history was not used up: the next page gets it, once its first load is done.
    const next = fakePage(3);
    next.loading = true;
    const second = restore(3, 1);
    expect(next.restored).toBeNull();
    next.loading = false;
    next.emit('did-stop-loading');
    expect(await second).toEqual({ ok: true, value: true });
    expect(next.restored).toEqual({ entries: [A, B], index: 1 });
  });
});
