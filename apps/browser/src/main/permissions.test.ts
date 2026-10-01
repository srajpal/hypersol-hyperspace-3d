import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { ShellCommand } from '../shared/commands';
import type { SiteChoices } from '../shared/permissions';

const all = new Map<number, unknown>();
vi.mock('electron', () => ({ webContents: { fromId: (id: number) => all.get(id) } }));
const { ALLOWED_WITHOUT_ASKING, LEFT_SITE, Permissions } = await import('./permissions');

type Check = (contents: unknown, permission: string, origin: string, details: { requestingUrl?: string; mediaType?: string }) => boolean;
type Request = (contents: unknown, permission: string, callback: (granted: boolean) => void, details: { requestingUrl: string; mediaTypes?: string[] }) => void;
type Prompt = Extract<ShellCommand, { type: 'permission-prompt' }>;

const SITE = 'https://site.example';

/** A stand-in for a web page's WebContents. */
function fakePage(id: number, session: object, url = `${SITE}/page`) {
  const page = Object.assign(new EventEmitter(), {
    id,
    session,
    hostWebContents: {},
    reloads: 0,
    getType: (): string => 'webview',
    getURL: () => url,
    isDestroyed: () => false,
    send: vi.fn(),
    reload: () => void (page.reloads += 1),
  });
  all.set(id, page);
  return page;
}

function setup(saved: Record<string, SiteChoices> = {}) {
  let check!: Check;
  let request!: Request;
  const session = {
    setPermissionCheckHandler: (h: Check) => void (check = h),
    setPermissionRequestHandler: (h: Request) => void (request = h),
  };
  const sent: ShellCommand[] = [];
  const refused: string[] = [];
  const state = { saved };
  const permissions = new Permissions({
    isPrivate: () => false,
    saved: () => state.saved,
    save: (sites) => void (state.saved = sites),
    send: (_contents, command) => void sent.push(command),
    refused: (permission) => void refused.push(permission),
  });
  permissions.protect(session as never);
  const page = fakePage(1, session);
  permissions.trackTab(page as never);
  /** Asks as a page would; answers with what the page is told, or "asked" while a prompt waits. */
  const ask = (permission: string, mediaTypes?: string[], from = page): boolean | 'asked' => {
    const told: boolean[] = [];
    request(from, permission, (granted) => void told.push(granted), { requestingUrl: `${SITE}/page`, ...(mediaTypes ? { mediaTypes } : {}) });
    return told[0] ?? 'asked';
  };
  const looks = (permission: string, mediaType?: string) => check(page, permission, SITE, { requestingUrl: `${SITE}/page`, ...(mediaType ? { mediaType } : {}) });
  const prompt = () => (sent.filter((c) => c.type === 'permission-prompt').at(-1) as Prompt).prompt;
  return { permissions, session, page, sent, refused, state, ask, looks, check, prompt };
}

const fromShell = (page: { hostWebContents: object }) => ({ sender: page.hostWebContents }) as never;

describe('what a page may do without asking (review of 2026-09-30, M1)', () => {
  // Every name Electron 44 knows besides the one allowed and the two asked about, and one it does not know.
  const REFUSED = [
    'ar',
    'automatic-fullscreen',
    'background-fetch',
    'background-sync',
    'captured-surface-control',
    'clipboard-read',
    'deprecated-sync-clipboard-read',
    'display-capture',
    'fileSystem',
    'fullscreen',
    'geolocation-approximate',
    'hand-tracking',
    'hid',
    'idle-detection',
    'keyboardLock',
    'local-fonts',
    'local-network',
    'local-network-access',
    'loopback-network',
    'mediaKeySystem',
    'midi',
    'midiSysex',
    'nfc',
    'notifications',
    'openExternal',
    'payment-handler',
    'periodic-background-sync',
    'persistent-storage',
    'pointerLock',
    'screen-wake-lock',
    'sensors',
    'serial',
    'smart-card',
    'speaker-selection',
    'storage-access',
    'system-wake-lock',
    'top-level-storage-access',
    'usb',
    'vr',
    'web-app-installation',
    'web-printing',
    'window-management',
    'unknown',
    'a-name-from-a-later-chromium',
  ];

  it('a page that only looks is told "no" for every name but copying text', () => {
    const { looks } = setup();
    for (const name of REFUSED) expect(looks(name), name).toBe(false);
    expect([...ALLOWED_WITHOUT_ASKING]).toEqual(['clipboard-sanitized-write']);
    for (const name of ALLOWED_WITHOUT_ASKING) expect(looks(name), name).toBe(true);
  });

  it('a page that asks is refused the same names at once, full screen and the pointer among them, and may copy text without a prompt', () => {
    const { ask, sent, refused } = setup();
    for (const name of REFUSED) expect(ask(name), name).toBe(false);
    for (const name of ALLOWED_WITHOUT_ASKING) expect(ask(name), name).toBe(true);
    expect(sent).toEqual([]);
    // Test runs are told of each refusal (a page refused full screen is told nothing).
    expect(refused).toEqual(REFUSED);
  });

  it('a check with no page (a worker) gets the same answers', () => {
    const { check } = setup();
    expect(check(null, 'notifications', SITE, {})).toBe(false);
    expect(check(null, 'media', SITE, { mediaType: 'video' })).toBe(false);
    expect(check(null, 'clipboard-sanitized-write', SITE, {})).toBe(true);
  });
});

describe('the camera, the microphone, and the location (milestone 9)', () => {
  it('are refused to a page that only looks, until the person allows them', async () => {
    const { permissions, page, ask, looks, prompt } = setup();
    expect(looks('media', 'video')).toBe(false);
    expect(looks('geolocation')).toBe(false);
    expect(ask('media', ['video'])).toBe('asked');
    expect(prompt()).toMatchObject({ origin: SITE, kinds: ['camera'] });
    expect(await permissions.handle(fromShell(page), { op: 'answer', id: prompt().id, answer: 'allow' })).toEqual({ ok: true, value: null });
    expect(looks('media', 'video')).toBe(true);
    expect(looks('media', 'audio')).toBe(false);
    expect(ask('media', ['video'])).toBe(true); // remembered: no second prompt
  });

  it('a remembered Block answers at once, and "this time" ends when the tab leaves the site', async () => {
    const { permissions, page, ask, looks, prompt, state } = setup({ [SITE]: { location: 'block' } });
    expect(ask('geolocation')).toBe(false);
    expect(ask('media', ['audio'])).toBe('asked');
    await permissions.handle(fromShell(page), { op: 'answer', id: prompt().id, answer: 'once' });
    expect(looks('media', 'audio')).toBe(true);
    expect(state.saved).toEqual({ [SITE]: { location: 'block' } }); // "this time" is not saved
    page.emit('did-navigate', {}, 'https://other.example/');
    expect(looks('media', 'audio')).toBe(false);
  });

  it('Block reloads every page on the site that holds the camera, so capture really ends (review of 2026-09-30, M7)', async () => {
    const { permissions, session, page, ask, prompt, sent } = setup();
    ask('media', ['video']);
    await permissions.handle(fromShell(page), { op: 'answer', id: prompt().id, answer: 'allow' });
    // A second tab on the site, given the camera by the remembered choice; a third that never asked.
    const second = fakePage(2, session);
    second.hostWebContents = page.hostWebContents;
    permissions.trackTab(second as never);
    expect(ask('media', ['video'], second)).toBe(true);
    const third = fakePage(3, session);
    permissions.trackTab(third as never);
    // A tab of another session (a private one) holding the camera is left alone.
    const elsewhere = fakePage(4, {});
    permissions.trackTab(elsewhere as never);
    expect(ask('media', ['video'], elsewhere)).toBe(true);
    sent.length = 0;

    const reply = await permissions.handle(fromShell(page), { op: 'site.set', tab: 1, origin: SITE, kind: 'camera', state: 'block' });
    expect(reply).toMatchObject({ ok: true, value: { states: { camera: 'block' }, given: [] } });
    expect([page.reloads, second.reloads, third.reloads, elsewhere.reloads]).toEqual([1, 1, 0, 0]);
    // A page that asks to be kept is not asked about while this reload is under way.
    expect([page, second, third].map((p) => permissions.endingCapture(p as never))).toEqual([true, true, false]);
    page.emit('did-navigate', {}, `${SITE}/page`);
    second.emit('did-stop-loading');
    expect([page, second].map((p) => permissions.endingCapture(p as never))).toEqual([false, false]);
    // The marker goes out for the pages that held it.
    expect(sent.filter((c) => c.type === 'site-access')).toEqual([
      { type: 'site-access', webContentsId: 1, kinds: [] },
      { type: 'site-access', webContentsId: 2, kinds: [] },
    ]);
    expect(ask('media', ['video'])).toBe(false);
  });

  it('Block for a page that holds nothing, or for the location, reloads nothing', async () => {
    const { permissions, page, ask, prompt } = setup();
    await permissions.handle(fromShell(page), { op: 'site.set', tab: 1, origin: SITE, kind: 'microphone', state: 'block' });
    expect(page.reloads).toBe(0);
    ask('geolocation');
    await permissions.handle(fromShell(page), { op: 'answer', id: prompt().id, answer: 'allow' });
    await permissions.handle(fromShell(page), { op: 'site.set', tab: 1, origin: SITE, kind: 'location', state: 'block' });
    expect(page.reloads).toBe(0);
    expect(ask('geolocation')).toBe(false);
  });

  it('a change from the site panel is for the site it names: a tab that has gone elsewhere is left alone (review of 2026-09-30, R6)', async () => {
    const OTHER = 'https://other.example';
    const { permissions, session, state } = setup();
    // The panel showed site.example; its tab is on other.example by the time the change arrives.
    const moved = fakePage(5, session, `${OTHER}/page`);
    permissions.trackTab(moved as never);
    const late = await permissions.handle(fromShell(moved), { op: 'site.set', tab: 5, origin: SITE, kind: 'camera', state: 'allow' });
    expect(late).toEqual({ ok: false, error: LEFT_SITE });
    expect(state.saved).toEqual({});
    // Named for the site the tab is on, it is taken.
    const now = await permissions.handle(fromShell(moved), { op: 'site.set', tab: 5, origin: OTHER, kind: 'camera', state: 'allow' });
    expect(now).toMatchObject({ ok: true, value: { origin: OTHER, states: { camera: 'allow' } } });
    expect(state.saved).toEqual({ [OTHER]: { camera: 'allow' } });
  });

  it('only web pages are asked about: anything else is refused', () => {
    const { session, ask } = setup();
    const other = fakePage(9, session);
    other.getType = () => 'window';
    expect(ask('media', ['video'], other)).toBe(false);
  });
});
