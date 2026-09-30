import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { PRIVATE_PARTITION, RESTORE_BLANK } from '../shared/commands';
import { USER_ACTIVATION_MS } from './popups';
import {
  decidePageNavigation,
  hardenShell,
  isAllowedPageNavigation,
  isAllowedPageUrl,
  isLocalHolomlUrl,
  lockDownWebPreferences,
  refuseClientCertificates,
  type AttachRecord,
} from './security';

const LOCAL = 'hypersol-file://0123456789abcdef/page.holoml';

describe('isLocalHolomlUrl', () => {
  it('is true only for the scheme of HoloML files opened from the computer', () => {
    expect(isLocalHolomlUrl(LOCAL)).toBe(true);
    expect(isLocalHolomlUrl('HYPERSOL-FILE://0123456789abcdef/page.holoml')).toBe(true);
    expect(isLocalHolomlUrl('https://site.example/page.holoml')).toBe(false);
    expect(isLocalHolomlUrl('hypersol-viewer://app/assets/viewer.js')).toBe(false);
    expect(isLocalHolomlUrl('file:///C:/page.holoml')).toBe(false);
    expect(isLocalHolomlUrl('not an address')).toBe(false);
    expect(isLocalHolomlUrl('')).toBe(false);
  });
});

describe('isAllowedPageNavigation', () => {
  it('lets a page go to the web or the blank page, from anywhere', () => {
    for (const from of ['https://a.example/', 'http://a.example/', LOCAL, '']) {
      expect(isAllowedPageNavigation(from, 'https://b.example/x?y#z')).toBe(true);
      expect(isAllowedPageNavigation(from, 'http://b.example/')).toBe(true);
      expect(isAllowedPageNavigation(from, 'about:blank')).toBe(true);
    }
  });

  it('refuses every other scheme', () => {
    for (const to of ['file:///C:/Windows/win.ini', 'javascript:alert(1)', 'data:text/html,hi', 'chrome://gpu', 'hypersol-viewer://app/assets/viewer.js', 'blob:https://a.example/1', 'not an address']) {
      expect(isAllowedPageNavigation('https://a.example/', to), to).toBe(false);
      expect(isAllowedPageNavigation(LOCAL, to), to).toBe(false);
    }
  });

  it('lets only a local HoloML page reach a local file, and only in its own opened folder', () => {
    expect(isAllowedPageNavigation(LOCAL, 'hypersol-file://0123456789abcdef/other/second.holoml')).toBe(true);
    expect(isAllowedPageNavigation(LOCAL, 'hypersol-file://fedcba9876543210/second.holoml')).toBe(false);
    expect(isAllowedPageNavigation('https://a.example/', LOCAL)).toBe(false);
    expect(isAllowedPageNavigation('about:blank', LOCAL)).toBe(false);
    expect(isAllowedPageNavigation('', LOCAL)).toBe(false);
  });
});

describe('decidePageNavigation (review of 2026-09-30, M6)', () => {
  it('leaves web pages as they were: web addresses go ahead, a click or not', () => {
    expect(decidePageNavigation('https://a.example/', 'https://b.example/x?secret=1#frag', null)).toBe('allow');
    expect(decidePageNavigation('https://a.example/', 'file:///C:/x', 0)).toBe('refuse');
    expect(decidePageNavigation('https://a.example/', LOCAL, 0)).toBe('refuse');
  });

  it('a local HoloML page moves freely inside its own folder, and to the blank page', () => {
    expect(decidePageNavigation(LOCAL, 'hypersol-file://0123456789abcdef/second.holoml?x=1#place', null)).toBe('allow');
    expect(decidePageNavigation(LOCAL, 'about:blank', null)).toBe('allow');
    expect(decidePageNavigation(LOCAL, 'hypersol-file://fedcba9876543210/second.holoml', 0)).toBe('refuse');
  });

  it('a local HoloML page leaves for the web only right after a real click or key press', () => {
    const to = 'https://b.example/page';
    expect(decidePageNavigation(LOCAL, to, null)).toBe('refuse');
    expect(decidePageNavigation(LOCAL, to, USER_ACTIVATION_MS + 1)).toBe('refuse');
    expect(decidePageNavigation(LOCAL, to, -5)).toBe('refuse');
    expect(decidePageNavigation(LOCAL, to, 0)).toBe('allow');
    expect(decidePageNavigation(LOCAL, to, USER_ACTIVATION_MS)).toBe('allow');
  });

  it('and then without the query string and the fragment, which could carry what it read', () => {
    expect(decidePageNavigation(LOCAL, 'https://b.example/collect?file=IMG_0001.jpg#more', 100)).toEqual({ load: 'https://b.example/collect' });
    expect(decidePageNavigation(LOCAL, 'http://b.example/?q=1', 100)).toEqual({ load: 'http://b.example/' });
    expect(decidePageNavigation(LOCAL, 'https://b.example/page#part', 100)).toEqual({ load: 'https://b.example/page' });
    expect(decidePageNavigation(LOCAL, 'https://b.example', 100)).toBe('allow'); // nothing to remove
    expect(decidePageNavigation(LOCAL, 'https://b.example/collect?file=IMG_0001.jpg', null)).toBe('refuse');
  });
});

describe('refuseClientCertificates (review of 2026-09-30, M2)', () => {
  it('answers a site that asks for a client certificate with none, and stops Electron choosing the first', () => {
    const app = new EventEmitter();
    refuseClientCertificates(app as never);
    const event = { preventDefault: vi.fn() };
    const callback = vi.fn();
    app.emit('select-client-certificate', event, {}, 'https://site.example/', [{ subjectName: 'A person' }, { subjectName: 'Another' }], callback);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(); // no certificate
  });
});

describe('lockDownWebPreferences', () => {
  it('forces safe settings, whatever the webview asked for', () => {
    const prefs: Record<string, unknown> = {
      preload: 'C:\\evil\\preload.js',
      nodeIntegration: true,
      nodeIntegrationInSubFrames: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      spellcheck: true,
      webviewTag: true,
      safeDialogs: false,
    };
    expect(lockDownWebPreferences(prefs as never, '/app/preload/page.js')).toBe('C:\\evil\\preload.js');
    expect(prefs).toEqual({
      preload: '/app/preload/page.js',
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false,
      webviewTag: false,
      // A page's alerts can be stopped after the second in a row (review of 2026-09-30, M10).
      safeDialogs: true,
    });
  });

  it('replaces a preload given as an address too, and says nothing was asked for when it was the trusted one', () => {
    const asked = { preloadURL: 'file:///C:/evil/preload.js' };
    expect(lockDownWebPreferences(asked as never, '/app/preload/page.js')).toBe('file:///C:/evil/preload.js');
    expect(asked).toMatchObject({ preload: '/app/preload/page.js' });
    expect('preloadURL' in asked).toBe(false);
    expect(lockDownWebPreferences({ preload: '/app/preload/page.js' } as never, '/app/preload/page.js')).toBeNull();
    expect(lockDownWebPreferences({} as never, '/app/preload/page.js')).toBeNull();
  });

  it('switches WebGL off only when asked (test mode)', () => {
    const plain: Record<string, unknown> = {};
    lockDownWebPreferences(plain as never, '/p.js');
    expect('webgl' in plain).toBe(false);
    const without: Record<string, unknown> = {};
    lockDownWebPreferences(without as never, '/p.js', true);
    expect(without['webgl']).toBe(false);
  });
});

describe('hardenShell', () => {
  function shell() {
    const contents = Object.assign(new EventEmitter(), { opened: null as unknown, setWindowOpenHandler: (h: () => unknown) => void (contents.opened = h()) });
    const records: AttachRecord[] = [];
    hardenShell(contents as never, '/app/preload/page.js', (r) => records.push(r));
    const attach = (params: Record<string, string>) => {
      const event = { preventDefault: vi.fn() };
      const prefs: Record<string, unknown> = {};
      contents.emit('will-attach-webview', event, prefs, params);
      return { refused: event.preventDefault.mock.calls.length > 0, prefs, params };
    };
    return { contents, records, attach };
  }

  it('attaches web pages and local HoloML files in the two web sessions, with the trusted preload', () => {
    const { attach, records } = shell();
    for (const src of ['https://site.example/', 'http://site.example/', 'about:blank', '', LOCAL]) {
      const a = attach({ src });
      expect(a.refused, src).toBe(false);
      expect(a.prefs['preload']).toBe('/app/preload/page.js');
    }
    expect(attach({ src: 'https://site.example/', partition: PRIVATE_PARTITION }).refused).toBe(false);
    expect(records.every((r) => r.allowed && r.appliedPreload === '/app/preload/page.js')).toBe(true);
  });

  it('refuses a webview with another scheme or another session, and records a preload it asked for', () => {
    const { attach, records } = shell();
    for (const src of ['file:///C:/Windows/win.ini', 'javascript:alert(1)', 'chrome://gpu', 'data:text/html,hi']) expect(attach({ src }).refused, src).toBe(true);
    expect(attach({ src: 'https://site.example/', partition: 'persist:other' }).refused).toBe(true);
    attach({ src: 'https://site.example/', preload: 'file:///C:/evil.js' });
    expect(records.at(-1)).toEqual({ requestedPreload: 'file:///C:/evil.js', appliedPreload: '/app/preload/page.js', src: 'https://site.example/', allowed: true });
  });

  it('a page that will take a closed page\'s history starts with no address', () => {
    const { attach } = shell();
    const a = attach({ src: RESTORE_BLANK });
    expect(a.refused).toBe(false);
    expect(a.params['src']).toBe('');
  });

  it('the shell itself never navigates or opens windows', () => {
    const { contents } = shell();
    const event = { preventDefault: vi.fn() };
    contents.emit('will-navigate', event, 'https://elsewhere.example/');
    expect(event.preventDefault).toHaveBeenCalled();
    expect(contents.opened).toEqual({ action: 'deny' });
  });
});

describe('isAllowedPageUrl', () => {
  it('is the web and the blank page only', () => {
    expect(isAllowedPageUrl('https://site.example/')).toBe(true);
    expect(isAllowedPageUrl('http://127.0.0.1:4000/a.html')).toBe(true);
    expect(isAllowedPageUrl('about:blank')).toBe(true);
    expect(isAllowedPageUrl('')).toBe(true);
    expect(isAllowedPageUrl(LOCAL)).toBe(false);
    expect(isAllowedPageUrl('ftp://site.example/')).toBe(false);
  });
});
