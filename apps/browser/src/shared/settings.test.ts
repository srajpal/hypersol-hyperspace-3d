import { describe, expect, it } from 'vitest';
import { applySettingsPatch, defaults, parseSettings, type Settings } from './settings';

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
