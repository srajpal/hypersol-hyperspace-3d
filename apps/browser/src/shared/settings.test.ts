import { describe, expect, it } from 'vitest';
import { applySettingsPatch, DEFAULT_SETTINGS, defaults, MAX_LAYERS_SITES, MAX_ZOOM_SITES, parseSettings, type Settings } from './settings';

describe('forgetting site permissions by name (review of 2026-09-30, R6)', () => {
  const current: Settings = {
    ...defaults(),
    sitePermissions: {
      'https://one.example': { camera: 'allow' },
      'https://two.example': { microphone: 'block', location: 'allow' },
    },
  };

  it('forgets the sites named and leaves the rest as they are now', () => {
    const result = applySettingsPatch(current, { forgetSitePermissions: ['https://one.example'] });
    expect(result).toEqual({
      settings: { ...current, sitePermissions: { 'https://two.example': { microphone: 'block', location: 'allow' } } },
    });
    // The settings it was given are not changed.
    expect(Object.keys(current.sitePermissions)).toHaveLength(2);
  });

  it('a site not remembered is nothing to forget', () => {
    expect(applySettingsPatch(current, { forgetSitePermissions: ['https://three.example'] })).toEqual({ settings: current });
    expect(applySettingsPatch(current, { forgetSitePermissions: [] })).toEqual({ settings: current });
  });

  it('refuses anything but a list of web origins', () => {
    for (const bad of ['https://one.example', ['one.example'], [7], ['https://one.example/path'], null]) {
      expect(applySettingsPatch(current, { forgetSitePermissions: bad })).toEqual({ error: 'forgetSitePermissions must be a list of web origins' });
    }
  });

  it('is a change, not a setting: it is never saved, and a file that has it still opens', () => {
    const result = applySettingsPatch(current, { forgetSitePermissions: ['https://one.example'] });
    expect('settings' in result && Object.keys(result.settings)).not.toContain('forgetSitePermissions');
    const read = parseSettings(JSON.stringify({ theme: 'daylight', forgetSitePermissions: ['https://one.example'] }));
    expect(read.problem).toBeUndefined();
    expect(read.settings.theme).toBe('daylight');
  });
});

describe('every setting is saved and read back (review of 2026-09-30, Sm5)', () => {
  /** Every setting at a value other than its default. A new setting is added here too: the first check says so. */
  const changed: Settings = {
    searchEngine: 'brave',
    onStartup: 'last-tabs',
    dnsMode: 'automatic',
    filterRefresh: false,
    pausedSites: ['paused.example'],
    layersOnOpen: false,
    layersSites: { 'layers.example': true },
    theme: 'daylight',
    pageTilt: 3,
    instruments: true,
    instrumentsReadouts: false,
    instrumentsGauges: false,
    instrumentsConsole: false,
    instrumentsNetwork: false,
    consoleLevel: 'errors',
    zoomSites: { 'zoom.example': 1.5 },
    sitePermissions: { 'https://site.example': { camera: 'allow' } },
    tabSize: 'large',
    tabDisplay: 'list',
    economy: 'on',
    tabSleep: 5,
    tiltDirection: 'left',
    parallax: 'subtle',
    pageMargin: 'roomy',
    shortcuts: { find: 'Mod+K' },
  };

  it('the example here has every setting, each away from its default', () => {
    expect(Object.keys(changed).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      expect(changed[key], key).not.toEqual(DEFAULT_SETTINGS[key]);
    }
  });

  it('a saved file comes back whole: no setting is dropped or changed', () => {
    const read = parseSettings(JSON.stringify(changed));
    expect(read.problem).toBeUndefined();
    expect(read.settings).toEqual(changed);
  });

  it('each setting alone comes back too', () => {
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const read = parseSettings(JSON.stringify({ [key]: changed[key] }));
      expect(read.problem, key).toBeUndefined();
      expect(read.settings, key).toEqual({ ...defaults(), [key]: changed[key] });
    }
  });

  it('the defaults themselves are a file that reads back as the defaults', () => {
    expect(parseSettings(JSON.stringify(DEFAULT_SETTINGS))).toEqual({ settings: defaults() });
  });

  it("sites with their own zoom have their own limit", () => {
    expect(MAX_ZOOM_SITES).toBe(1000);
    expect(MAX_ZOOM_SITES).toBe(MAX_LAYERS_SITES);
    const sites = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`site${i}.example`, 1.1]));
    expect(applySettingsPatch(defaults(), { zoomSites: sites(MAX_ZOOM_SITES) })).toHaveProperty('settings');
    expect(applySettingsPatch(defaults(), { zoomSites: sites(MAX_ZOOM_SITES + 1) })).toHaveProperty('error');
  });
});
