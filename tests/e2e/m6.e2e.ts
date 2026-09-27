/**
 * Milestone 6 end-to-end checks H1 to H7 (TODO.md): the theme switch,
 * Settings > Theme (with "Match the system"), the room following the
 * theme, the window, page tilt, and the layers view's outline. H5
 * (contrast) and H8 (no hard-coded colours) are unit tests.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { daylight, nebula, type Theme } from '../../packages/themes/src/index';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  clickAt,
  describeMissedClick,
  inPage,
  launch,
  pressInShell,
  removeFolder,
  screenPointOf,
  shellCall,
  sleep,
  waitFor,
  waitForPage,
  type Harness,
  settingsTo,
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

const THEME_BUTTON = 'hs-theme-button [data-testid="theme"]';
const SET = (id: string) => `hs-settings [data-testid="${id}"]`;
const themeId = (h: Harness) => shellCall(h, 'theme');
const savedSettings = (profile: string) => JSON.parse(readFileSync(join(profile, 'settings.json'), 'utf8')) as Record<string, unknown>;

async function openSettings(h: Harness): Promise<void> {
  if ((await shellCall(h, 'openPanel')) !== 'settings') await pressInShell(h, ',', ['control']);
  await waitFor('settings open', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
}

/** The HUD's colours and the room's colours both come from `theme`. */
async function expectTheme(h: Harness, theme: Theme): Promise<void> {
  expect(await themeId(h)).toBe(theme.id);
  const css = await h.shell.evaluate(() => {
    const s = document.documentElement.style;
    return {
      accent: s.getPropertyValue('--hs-accent'),
      text: s.getPropertyValue('--hs-text'),
      glass: s.getPropertyValue('--hs-panel-glass'),
      scheme: s.colorScheme,
    };
  });
  expect(css).toEqual({ accent: theme.colors.accent, text: theme.colors.text, glass: theme.colors.panelGlass, scheme: theme.scheme });
  expect(await shellCall(h, 'sceneColors')).toEqual({
    accent: theme.colors.accent,
    desk: theme.colors.desk,
    floorGrid: theme.colors.floorGrid,
    horizon: theme.colors.horizon,
    fog: theme.colors.backgroundBottom,
    ambient: theme.lighting.ambient.color,
    key: theme.lighting.key.color,
    sun: theme.room.sun ? 'shown' : 'hidden',
  });
}

describe('H1, H3, H4, H7: switching themes', () => {
  let h: Harness;
  let profile: string;
  beforeAll(async () => {
    profile = newProfile();
    h = await launch(server.url('layers.html'), { userDataDir: profile });
    await waitForPage(h, 'layers.html');
  });
  afterAll(async () => h?.close());

  it('H1 and H3 the button switches Nebula and Daylight; the HUD and the room change together', async () => {
    await expectTheme(h, nebula);
    await h.shell.click(THEME_BUTTON);
    await waitFor('Daylight', () => themeId(h), (id) => id === 'daylight');
    await expectTheme(h, daylight);
    expect(await h.shell.locator(THEME_BUTTON).getAttribute('aria-label')).toBe('Theme: Daylight. Switch to Nebula');
    await waitFor('saved', async () => savedSettings(profile)['theme'], (t) => t === 'daylight');
  });

  it('H4 the window background and title bar follow the theme', async () => {
    const win = () =>
      h.app.evaluate(({ BrowserWindow, nativeTheme }) => ({
        background: BrowserWindow.getAllWindows()[0]!.getBackgroundColor().toLowerCase(),
        source: nativeTheme.themeSource,
      }));
    await waitFor('light window', win, (w) => w.source === 'light');
    expect((await win()).background).toBe(daylight.colors.backgroundBottom);
    await h.shell.click(THEME_BUTTON);
    await waitFor('dark window', win, (w) => w.source === 'dark' && w.background === nebula.colors.backgroundBottom);
  });

  it('H7 the layers view outlines sections in the theme accent', async () => {
    const accent = () => inPage<string>(h, `document.documentElement.style.getPropertyValue('--hs-layer-accent')`, 'layers.html');
    await waitFor('Nebula accent', accent, (a) => a === `${nebula.colors.accent}99`);
    await h.shell.click(THEME_BUTTON);
    await waitFor('Daylight accent', accent, (a) => a === `${daylight.colors.accent}99`);
  });
});

describe('H2: Settings > Theme', () => {
  it('applies each choice at once and after a restart, and "Match the system" follows the system', async () => {
    const profile = newProfile();
    let h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'link-a');
      await openSettings(h);
      await settingsTo(h, 'set-theme-nebula');
      expect(await h.shell.locator(SET('set-theme-nebula')).isChecked()).toBe(true);
      await settingsTo(h, 'set-theme-daylight');
      await h.shell.click(SET('set-theme-daylight'));
      await waitFor('Daylight', () => themeId(h), (id) => id === 'daylight');
      await settingsTo(h, 'set-theme-system');
      await h.shell.click(SET('set-theme-system'));
      // The system's setting, as the shell sees it, picks the theme.
      await h.shell.emulateMedia({ colorScheme: 'dark' });
      await waitFor('dark system: Nebula', () => themeId(h), (id) => id === 'nebula');
      await h.shell.emulateMedia({ colorScheme: 'light' });
      await waitFor('light system: Daylight', () => themeId(h), (id) => id === 'daylight');
      await settingsTo(h, 'set-theme-daylight');
      await h.shell.click(SET('set-theme-daylight'));
      await waitFor('saved', async () => savedSettings(profile)['theme'], (t) => t === 'daylight');
    } finally {
      await h.close();
    }
    h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'link-a');
      await expectTheme(h, daylight);
    } finally {
      await h.close();
    }
  });
});

describe('H6: page tilt', () => {
  it('re-tilts the page at once and after a restart, and clicks land at 0 and 20 degrees', async () => {
    const profile = newProfile({ layersOnOpen: false });
    let h = await launch(server.url('form.html'), { userDataDir: profile });
    const clickField = async () => {
      await inPage(h, 'document.activeElement && document.activeElement.blur()', 'form');
      const p = await screenPointOf(h, '#name', 'form');
      await clickAt(h, p);
      const focused = async () => (await inPage<string>(h, 'document.activeElement.id', 'form')) === 'name';
      await waitFor('field focused', focused, (f) => f).catch(async (e: unknown) => {
        throw new Error(`${String(e)}\n${await describeMissedClick(h, p, focused)}`);
      });
    };
    try {
      await waitForPage(h, 'form');
      expect(await shellCall(h, 'tilt')).toBe(10);
      await openSettings(h);
      await settingsTo(h, 'set-tilt');
      await h.shell.locator(SET('set-tilt')).fill('0');
      await waitFor('flat', () => shellCall(h, 'tilt'), (t) => t === 0);
      expect(await shellCall(h, 'layout')).toMatchObject({ rotationY: 0 });
      await pressInShell(h, 'Escape');
      await sleep(300);
      await clickField();
      await openSettings(h);
      await settingsTo(h, 'set-tilt');
      await h.shell.locator(SET('set-tilt')).fill('20');
      await waitFor('tilted', () => shellCall(h, 'tilt'), (t) => t === 20);
      await pressInShell(h, 'Escape');
      await sleep(300);
      await clickField();
      await waitFor('saved', async () => savedSettings(profile)['pageTilt'], (t) => t === 20);
    } finally {
      await h.close();
    }
    h = await launch(server.url('form.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'form');
      await waitFor('tilt kept', () => shellCall(h, 'tilt'), (t) => t === 20);
    } finally {
      await h.close();
    }
  });

  it('a tilt given on the command line wins over the setting', async () => {
    const h = await launch(server.url('form.html'), { userDataDir: newProfile({ pageTilt: 3 }), tilt: 15 });
    try {
      await waitForPage(h, 'form');
      await sleep(300);
      expect(await shellCall(h, 'tilt')).toBe(15);
    } finally {
      await h.close();
    }
  });
});

describe('GitHub issue #12: a graphics reset', () => {
  it('the room draws again by itself when the WebGL context comes back, cards included', async () => {
    const h = await launch(server.url('link-a.html'), { userDataDir: newProfile({ layersOnOpen: false }) });
    try {
      await waitForPage(h, 'link-a');
      await pressInShell(h, 'T', ['control']); // two tabs: the rail and its cards show
      await sleep(1500);
      const snap = () =>
        h.app.evaluate(async ({ BrowserWindow }) => {
          const image = await BrowserWindow.getAllWindows()[0]!.webContents.capturePage();
          return image.toBitmap().toString('base64');
        });
      const before = Buffer.from(await snap(), 'base64');
      const frames = await shellCall(h, 'frames');
      const supported = await h.shell.evaluate(() => {
        const canvas = document.querySelector('#room canvas') as HTMLCanvasElement;
        const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
        const ext = gl?.getExtension('WEBGL_lose_context');
        if (!ext) return false;
        const w = window as unknown as { __restored: boolean };
        w.__restored = false;
        canvas.addEventListener('webglcontextrestored', () => (w.__restored = true), { once: true });
        ext.loseContext();
        setTimeout(() => ext.restoreContext(), 200);
        return true;
      });
      expect(supported).toBe(true);
      await h.shell.waitForFunction(() => (window as unknown as { __restored: boolean }).__restored);
      await waitFor('drawn again without input', () => shellCall(h, 'frames'), (n) => n > frames, 3000);
      await sleep(800);
      const after = Buffer.from(await snap(), 'base64');
      // The room, the sun, the grid, and the tab cards are back: the window looks as it did.
      let differing = 0;
      for (let i = 0; i < Math.min(before.length, after.length); i += 4) {
        const d = Math.abs(before[i]! - after[i]!) + Math.abs(before[i + 1]! - after[i + 1]!) + Math.abs(before[i + 2]! - after[i + 2]!);
        if (d > 30) differing++;
      }
      expect(differing / (before.length / 4)).toBeLessThan(0.02);
      expect(h.errors).toEqual([]);
    } finally {
      await h.close();
    }
  });
});
