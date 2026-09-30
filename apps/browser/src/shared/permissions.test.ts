import { describe, expect, it } from 'vitest';
import {
  decide,
  describeKinds,
  isOrigin,
  mediaKinds,
  originOf,
  parsePermissionRequest,
  parseSiteChoices,
} from './permissions';
import { applySettingsPatch, defaults, parseSettings } from './settings';

describe('site permissions (milestone 9)', () => {
  it('knows a web origin when it sees one', () => {
    expect(isOrigin('https://example.com')).toBe(true);
    expect(isOrigin('http://127.0.0.1:8123')).toBe(true);
    expect(isOrigin('https://example.com/')).toBe(false);
    expect(isOrigin('https://EXAMPLE.com')).toBe(false);
    expect(isOrigin('https://example.com:443')).toBe(false);
    expect(isOrigin('file:///c:/x')).toBe(false);
    expect(isOrigin('javascript:alert(1)')).toBe(false);
    expect(originOf('https://Example.com:443/a?b#c')).toBe('https://example.com');
    expect(originOf('http://127.0.0.1:8123/x.html')).toBe('http://127.0.0.1:8123');
    expect(originOf('about:blank')).toBeNull();
    expect(originOf('not a url')).toBeNull();
  });

  it('grants only when every kind is allowed, refuses when any is blocked, else asks', () => {
    expect(decide(['camera'], undefined, undefined)).toBe('ask');
    expect(decide(['camera'], { camera: 'allow' }, undefined)).toBe('grant');
    expect(decide(['camera', 'microphone'], { camera: 'allow' }, undefined)).toBe('ask');
    expect(decide(['camera', 'microphone'], { camera: 'allow' }, new Set(['microphone'] as const))).toBe('grant');
    expect(decide(['camera', 'microphone'], { microphone: 'block', camera: 'allow' }, undefined)).toBe('deny');
    expect(decide(['location'], { location: 'block' }, new Set(['location'] as const))).toBe('deny');
    expect(decide([], { camera: 'allow' }, undefined)).toBe('deny');
  });

  it('maps media requests and words prompts', () => {
    expect(mediaKinds(['video', 'audio'])).toEqual(['camera', 'microphone']);
    expect(mediaKinds(['audio'])).toEqual(['microphone']);
    expect(mediaKinds(undefined)).toEqual([]);
    expect(describeKinds(['camera'])).toBe('your camera');
    expect(describeKinds(['camera', 'microphone'])).toBe('your camera and microphone');
    expect(describeKinds(['camera', 'microphone', 'location'])).toBe('your camera, microphone and location');
  });

  it('checks remembered choices', () => {
    expect(parseSiteChoices({ 'https://a.example': { camera: 'allow', location: 'block' } })).toEqual({
      'https://a.example': { camera: 'allow', location: 'block' },
    });
    expect(parseSiteChoices({ 'https://a.example': {} })).toEqual({});
    expect(parseSiteChoices({ 'a.example': { camera: 'allow' } })).toBeNull();
    expect(parseSiteChoices({ 'https://a.example': { camera: 'maybe' } })).toBeNull();
    expect(parseSiteChoices({ 'https://a.example': { notifications: 'allow' } })).toBeNull();
    expect(parseSiteChoices([])).toBeNull();
  });

  it('are kept in settings, and a bad value is refused', () => {
    const ok = applySettingsPatch(defaults(), { sitePermissions: { 'http://127.0.0.1:9000': { microphone: 'block' } } });
    expect('settings' in ok && ok.settings.sitePermissions).toEqual({ 'http://127.0.0.1:9000': { microphone: 'block' } });
    expect(applySettingsPatch(defaults(), { sitePermissions: { 'http://x': { camera: 'yes' } } })).toHaveProperty('error');
    expect(defaults().sitePermissions).toEqual({});
    // A file with a damaged entry falls back to the defaults and says why.
    expect(parseSettings(JSON.stringify({ sitePermissions: { nope: 1 } })).problem).toMatch(/sitePermissions/);
  });

  it('checks requests from the shell', () => {
    expect(parsePermissionRequest({ op: 'answer', id: 3, answer: 'once' })).toEqual({ request: { op: 'answer', id: 3, answer: 'once' } });
    expect(parsePermissionRequest({ op: 'answer', id: 3, answer: 'always' })).toHaveProperty('error');
    expect(parsePermissionRequest({ op: 'answer', id: 0, answer: 'allow' })).toHaveProperty('error');
    expect(parsePermissionRequest({ op: 'site', tab: 7 })).toEqual({ request: { op: 'site', tab: 7 } });
    const site = 'https://site.example';
    expect(parsePermissionRequest({ op: 'site.set', tab: 7, origin: site, kind: 'location', state: 'ask' })).toHaveProperty('request');
    expect(parsePermissionRequest({ op: 'site.set', tab: 7, origin: site, kind: 'usb', state: 'allow' })).toHaveProperty('error');
    expect(parsePermissionRequest({ op: 'site.set', tab: 7, origin: site, kind: 'camera', state: 'once' })).toHaveProperty('error');
    // A change names the site it is for (its origin, as URL.origin writes it).
    expect(parsePermissionRequest({ op: 'site.set', tab: 7, kind: 'location', state: 'ask' })).toEqual({ error: 'site.set: origin must be a web origin' });
    expect(parsePermissionRequest({ op: 'site.set', tab: 7, origin: `${site}/page`, kind: 'location', state: 'ask' })).toHaveProperty('error');
    expect(parsePermissionRequest({ op: 'site.set', tab: 7, origin: 'file:///C:/', kind: 'location', state: 'ask' })).toHaveProperty('error');
    expect(parsePermissionRequest({ op: 'grant-everything' })).toHaveProperty('error');
    expect(parsePermissionRequest(null)).toHaveProperty('error');
  });
});
