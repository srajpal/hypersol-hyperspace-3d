/**
 * Milestone 7 end-to-end checks I1 to I9 (TODO.md): the instrument
 * panel, switched on and off, its page readouts, certificate, console,
 * network list, browser gauges, the settings per part, DevTools, and
 * efficiency.
 */
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIXTURES_DIR, startFixtureServer, startHttpsFixtureServer, type FixtureServer } from './fixture-server';
import { formatAge } from '../../apps/browser/src/renderer/inspect-format';

const STARTER_DIR = join(FIXTURES_DIR, '..', '..', 'apps', 'browser', 'resources', 'filters');
import {
  clickAt,
  focusedPage,
  inPage,
  launch,
  navigateTo,
  pressInShell,
  removeFolder,
  screenPointOf,
  shellCall,
  sleep,
  waitFor,
  waitForPage,
  type Harness,
  settingsTo,
  setContentSize,
} from './harness';

let server: FixtureServer;
const profiles: string[] = [];

function newProfile(settings?: object): string {
  const dir = mkdtempSync(join(tmpdir(), 'hypersol-e2e-profile-'));
  profiles.push(dir);
  if (settings) writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings));
  return dir;
}

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
  for (const dir of profiles) await removeFolder(dir);
});

const PAGE = 'inspect.html';
const BUTTON = 'hs-toolbar [data-testid="instruments"]';
const INST = (id: string) => `hs-instruments [data-testid="${id}"]`;
const SET = (id: string) => `hs-settings [data-testid="${id}"]`;
const inst = (h: Harness) => shellCall(h, 'instruments');
const saved = (profile: string) => JSON.parse(readFileSync(join(profile, 'settings.json'), 'utf8')) as Record<string, unknown>;
const panelWidth = async (h: Harness) => (await shellCall(h, 'layout')).panelWidth;
const inspectOps = (h: Harness) =>
  h.app.evaluate(() => (globalThis as unknown as { __hypersolTest: { dataOps: Record<string, number> } }).__hypersolTest.dataOps['inspect.snapshot'] ?? 0);

async function openSettings(h: Harness): Promise<void> {
  if ((await shellCall(h, 'openPanel')) !== 'settings') await pressInShell(h, ',', ['control']);
  await waitFor('settings open', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
}

async function readyPage(h: Harness): Promise<void> {
  await waitForPage(h, PAGE);
  await waitFor('the test page done', () => inPage<string>(h, 'document.title', PAGE), (t) => t === 'Inspect test ready');
}

describe('I1 and I7: switching the panel and its parts', () => {
  it('is off by default; the button, the shortcut, and Settings switch it; the page gives and takes back room; remembered', async () => {
    const profile = newProfile({ layersOnOpen: false });
    let h = await launch(server.url(PAGE), { userDataDir: profile });
    try {
      await readyPage(h);
      expect(await inst(h)).toMatchObject({ open: false, polling: false });
      const full = await panelWidth(h);
      await h.shell.click(BUTTON);
      await waitFor('panel open', () => inst(h), (s) => s.open && s.polling);
      expect(await h.shell.locator(BUTTON).getAttribute('aria-pressed')).toBe('true');
      await waitFor('page makes room', () => panelWidth(h), (w) => w < full);
      expect(await h.shell.locator(INST('inst-column')).isVisible()).toBe(true);
      expect(await h.shell.locator(INST('inst-strip')).isVisible()).toBe(true);

      await pressInShell(h, 'I', ['control', 'shift']);
      await waitFor('panel closed', () => inst(h), (s) => !s.open && !s.polling);
      await waitFor('page takes the room back', () => panelWidth(h), (w) => w === full);

      await openSettings(h);
      await settingsTo(h, 'set-instruments');
      await h.shell.click(SET('set-instruments'));
      await waitFor('open from Settings', () => inst(h), (s) => s.open);
      await waitFor('saved', async () => saved(profile)['instruments'], (v) => v === true);
    } finally {
      await h.close();
    }
    h = await launch(server.url(PAGE), { userDataDir: profile });
    try {
      await readyPage(h);
      await waitFor('still open after a restart', () => inst(h), (s) => s.open);
    } finally {
      await h.close();
    }
  });

  it('I7 each part hides and shows on its own, and is remembered', async () => {
    const profile = newProfile({ layersOnOpen: false, instruments: true });
    let h = await launch(server.url(PAGE), { userDataDir: profile });
    try {
      await readyPage(h);
      await waitFor('open', () => inst(h), (s) => s.open);
      const withStrip = await shellCall(h, 'layout');
      await openSettings(h);
      await settingsTo(h, 'set-instrumentsConsole');
      await h.shell.click(SET('set-instrumentsConsole'));
      await waitFor('console gone', () => h.shell.locator(INST('inst-console')).count(), (n) => n === 0);
      expect(await h.shell.locator(INST('inst-network')).count()).toBe(1);
      await settingsTo(h, 'set-instrumentsNetwork');
      await h.shell.click(SET('set-instrumentsNetwork'));
      await waitFor('strip gone', () => h.shell.locator(INST('inst-strip')).count(), (n) => n === 0);
      await waitFor('page taller', () => shellCall(h, 'layout'), (l) => l.panelHeight > withStrip.panelHeight);
      await settingsTo(h, 'set-instrumentsReadouts');
      await h.shell.click(SET('set-instrumentsReadouts'));
      await waitFor('page readouts gone', () => h.shell.locator(INST('inst-page')).count(), (n) => n === 0);
      expect(await h.shell.locator(INST('inst-browser')).count()).toBe(1);
      await waitFor('saved', async () => saved(profile), (s) =>
        s['instrumentsConsole'] === false && s['instrumentsNetwork'] === false && s['instrumentsReadouts'] === false);
    } finally {
      await h.close();
    }
    h = await launch(server.url(PAGE), { userDataDir: profile });
    try {
      await readyPage(h);
      await waitFor('parts kept', () => inst(h), (s) => s.open && !s.parts.console && !s.parts.network && !s.parts.readouts && s.parts.gauges);
    } finally {
      await h.close();
    }
  });
});

/** The header controls of an instrument panel that stick out of it or are covered. */
function reachProblems(h: Harness, panel: string): Promise<string[]> {
  return h.shell.evaluate((id) => {
    const root = document.querySelector('hs-instruments')!.shadowRoot!;
    const section = root.querySelector(`[data-testid="${id}"]`)!;
    const box = section.getBoundingClientRect();
    const out: string[] = [];
    for (const el of section.querySelectorAll('header button, header select, header input')) {
      const r = el.getBoundingClientRect();
      const hit = root.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const label = el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.tagName;
      if (r.width < 1 || r.left < box.left - 1 || r.right > box.right + 1) out.push(`${label} outside`);
      else if (hit !== el && !el.contains(hit)) out.push(`${label} covered`);
    }
    return out;
  }, panel);
}

describe('I2, I4 to I6, I8: the readouts on a test page', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await launch(server.url(PAGE), { userDataDir: newProfile({ layersOnOpen: false, instruments: true }) });
    await readyPage(h);
  });
  afterAll(async () => h?.close());

  it('I2 page readouts match what happened, and follow the tab in front', async () => {
    const size = statSync(join(FIXTURES_DIR, PAGE)).size;
    // A request is counted when it starts and its bytes when it completes,
    // so the wait is for the bytes too, not for the count alone.
    const s = await waitFor('readouts', () => inst(h), (x) => (x.page?.requests ?? 0) >= 4 && x.page!.loadMs >= 0 && x.net >= 4 && x.page!.bytes >= size);
    expect(s.page).toMatchObject({ url: server.url(PAGE), secure: false, requests: 4, blocked: 1, failed: 0, cert: null });
    // The page, the icon (sizes declared), a 404 with its own size, and the blocked ad.
    expect(s.page!.bytes).toBeGreaterThanOrEqual(size);
    expect(s.page!.loadMs).toBeGreaterThan(0);
    expect(s.page!.memoryKB).toBeGreaterThan(0);
    expect(await h.shell.locator(`${INST('inst-secure')}`).getAttribute('tone')).toBe('warn');

    await pressInShell(h, 'T', ['control']);
    await navigateTo(h, server.url('link-a.html'));
    await waitForPage(h, 'link-a');
    await waitFor('follows the new tab', () => inst(h), (x) => x.page?.url === server.url('link-a.html'));
    await pressInShell(h, 'Tab', ['control']);
    await waitFor('back to the test page', () => inst(h), (x) => x.page?.url === server.url(PAGE) && x.page.requests === 4);
  });

  it('I4 the console shows the log, warning, and error; the level setting and Clear work', async () => {
    const s = await waitFor('console', () => inst(h), (x) => x.console.length >= 3);
    expect(s.console).toEqual(
      expect.arrayContaining(['info:hello from the page', 'warning:a warning from the page', 'error:an error from the page']),
    );
    const rows = () => h.shell.locator(`${INST('inst-console-list')} li`).count();
    await waitFor('three rows', rows, (n) => n === 3);
    await openSettings(h);
    await settingsTo(h, 'set-console-level');
    await h.shell.selectOption(SET('set-console-level'), 'errors');
    await pressInShell(h, 'Escape');
    await waitFor('errors only', rows, (n) => n === 1);
    await h.shell.selectOption(INST('inst-level'), 'warnings'); // the same setting, from the panel
    await waitFor('warnings and errors', rows, (n) => n === 2);
    await h.shell.click(INST('inst-clear'));
    await waitFor('cleared', rows, (n) => n === 0);
    await sleep(1500);
    expect(await rows()).toBe(0); // stays cleared after the next readouts
  });

  it('I5 the network list shows each request with its status, and filters', async () => {
    const list = () => h.shell.locator(`${INST('inst-net-list')} li`).allTextContents();
    const all = await waitFor('four requests', list, (l) => l.length === 4);
    const joined = all.join('\n');
    expect(joined).toContain('inspect.html');
    expect(joined).toMatch(/404\s+xhr\s+missing-file\.js/);
    expect(joined).toMatch(/BLOCKED\s+image\s+ad\.gif/);
    await h.shell.click(INST('inst-kind-image'));
    await waitFor('images only', list, (l) => l.length === 1 && l[0]!.includes('ad.gif'));
    await h.shell.click(INST('inst-kind-all'));
    await h.shell.fill(INST('inst-net-filter'), 'missing');
    await waitFor('text filter', list, (l) => l.length === 1 && l[0]!.includes('missing-file.js'));
    expect(await h.shell.locator(INST('inst-net-totals')).textContent()).toMatch(/^1 requests · .+ · 0 blocked$/);
    await h.shell.fill(INST('inst-net-filter'), '');
  });

  it('I5b the console and network list maximize for reading, and Escape restores them (owner, prompt 36)', async () => {
    await h.shell.click(INST('inst-max-network'));
    const big = () => h.shell.locator(`${INST('inst-net-list-max')} li`).allTextContents();
    const rows = await waitFor('network list large', big, (l) => l.length === 4);
    expect(rows.join(' ')).toContain(server.url(PAGE)); // full addresses when large
    expect(await h.shell.locator('hs-instruments').getAttribute('maximized')).toBe('network');
    await pressInShell(h, 'Escape');
    await waitFor('restored', () => h.shell.locator('hs-instruments').getAttribute('maximized'), (m) => m === null || m === '');
    await h.shell.click(INST('inst-max-console'));
    await waitFor('console large', () => h.shell.locator(INST('inst-console-max')).count(), (n) => n === 1);
    await h.shell.click(INST('inst-console-max') + ' [data-testid="inst-max-console"]');
    await waitFor('console back in the strip', () => h.shell.locator(INST('inst-console-max')).count(), (n) => n === 0);
  });

  it('I5c in a small window with the tab rail showing, every control in the console and network headers stays inside its panel and takes clicks', async () => {
    // Found by GitHub's Windows test machine (a 1024x768 screen, milestone
    // 12): the console's buttons ran under the network panel.
    const [w0, h0] = await h.shell.evaluate(() => [window.innerWidth, window.innerHeight]);
    const tabs = (await shellCall(h, 'tabs')).length;
    if (tabs < 2) {
      // A second tab shows the rail; then back to the test page.
      await pressInShell(h, 'T', ['control']);
      await waitFor('two tabs', async () => (await shellCall(h, 'tabs')).length, (n) => n >= 2);
      await pressInShell(h, 'Tab', ['control', 'shift']);
      await waitFor('the test page in front', () => focusedPage(h).then(() => true, () => false), (ok) => ok);
    }
    try {
      await setContentSize(h, 1000, 640);
      for (const panel of ['inst-console', 'inst-network']) {
        const ok = await waitFor(`${panel} controls reachable`, () => reachProblems(h, panel), (l) => l.length === 0, 5000).catch(() => null);
        // After a timeout, read once more so the failure names the controls.
        expect(ok ?? (await reachProblems(h, panel))).toEqual([]);
      }
      await h.shell.click(INST('inst-max-console'));
      await waitFor('console large', () => h.shell.locator(INST('inst-console-max')).count(), (n) => n === 1);
      await h.shell.click(INST('inst-console-max') + ' [data-testid="inst-max-console"]');
      await waitFor('console back in the strip', () => h.shell.locator(INST('inst-console-max')).count(), (n) => n === 0);
    } finally {
      await setContentSize(h, w0!, h0!);
      if (tabs < 2) {
        await pressInShell(h, 'Tab', ['control']);
        await waitFor('the new tab in front', () => focusedPage(h).then(() => false, () => true), (blank) => blank);
        await pressInShell(h, 'W', ['control']);
        await waitFor('tabs as before', async () => (await shellCall(h, 'tabs')).length, (n) => n === tabs);
      }
    }
  });

  it('I6 the browser gauges show tabs, memory, filter lists, and DNS', async () => {
    // Every gauge filled in, including the tab count (GitHub issue #20: it could still be 0).
    const s = await waitFor('gauges', () => inst(h), (x) => x.gauges.dns !== '' && x.gauges.filtersAge !== '' && x.gauges.tabs > 0);
    expect(s.gauges.tabs).toBe((await shellCall(h, 'tabs')).length);
    expect(s.gauges.dns).toBe('SECURE · QUAD9');
    // The built-in lists' age follows their build date, not today's (issue #20).
    const built = Date.parse((JSON.parse(readFileSync(join(STARTER_DIR, 'starter.json'), 'utf8')) as { built: string }).built);
    expect(s.gauges.filtersAge).toBe(`${formatAge(built, Date.now())} (built in)`);
    expect(s.gauges.clock).toMatch(/^\d{1,2}:\d{2}:\d{2}/);
    expect(await h.shell.locator(`${INST('inst-memory')}`).getAttribute('aria-valuenow')).not.toBe('0');
  });

  it('I8 "DevTools" opens the page\'s DevTools', async () => {
    const page = await focusedPage(h);
    await h.shell.click(INST('inst-devtools'));
    const open = () => h.app.evaluate(({ webContents }, id) => webContents.fromId(id)!.isDevToolsOpened(), page.id);
    await waitFor('DevTools open', open, (o) => o);
    await h.app.evaluate(({ webContents }, id) => webContents.fromId(id)!.closeDevTools(), page.id);
  });
});

describe('I3: certificates', () => {
  it('shows the certificate Chromium checked, and an invalid one still fails', async () => {
    const https = await startHttpsFixtureServer();
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ layersOnOpen: false, instruments: true }) });
    try {
      await waitForPage(h, 'link-a');
      await navigateTo(h, https.url('link-b.html'));
      await waitFor('certificate card', () => h.shell.locator('[data-testid="page-panel"][aria-hidden="false"] .hs-error-card').getAttribute('data-kind'), (k) => k === 'certificate');
      const s = await waitFor('certificate readout', () => inst(h), (x) => x.page?.cert !== null && x.page?.cert !== undefined);
      expect(s.page!.secure).toBe(true);
      expect(s.page!.cert!.issuer).toBe('127.0.0.1'); // the test certificate names itself
      expect(s.page!.cert!.verification).not.toBe('OK');
    } finally {
      await h.close();
      await https.close();
    }
  });
});

describe('I9: efficiency and input', () => {
  it('asks nothing while off; while on, idle stays quiet and clicks still land', async () => {
    const h = await launch(server.url('form.html'), { userDataDir: newProfile({ layersOnOpen: false }) });
    try {
      await waitForPage(h, 'form');
      const before = await inspectOps(h);
      await sleep(3000);
      expect(await inspectOps(h)).toBe(before); // off: no asking

      await pressInShell(h, 'I', ['control', 'shift']);
      await waitFor('on', () => inst(h), (s) => s.polling);
      await sleep(1500);
      const ops = await inspectOps(h);
      const frames = await shellCall(h, 'frames');
      await sleep(3000);
      const asked = (await inspectOps(h)) - ops;
      expect(asked).toBeGreaterThanOrEqual(2); // about once a second
      expect(asked).toBeLessThanOrEqual(4);
      expect(await shellCall(h, 'frames')).toBe(frames); // the 3D room draws nothing while idle

      await clickAt(h, await screenPointOf(h, '#name', 'form'));
      await waitFor('field focused', () => inPage<string>(h, 'document.activeElement.id', 'form'), (id) => id === 'name');
    } finally {
      await h.close();
    }
  });
});
