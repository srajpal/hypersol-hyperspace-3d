import { describe, expect, it } from 'vitest';
import { parseLaunchOptions } from './launch-options';
import { isAllowedPageUrl } from './security';

describe('parseLaunchOptions', () => {
  it('has safe defaults', () => {
    expect(parseLaunchOptions(['electron', '.'], {})).toEqual({
      startUrl: '',
      tiltDeg: 10,
      testMode: false,
      testBackground: false,
      testKeepRunning: false,
      testNoKeychain: false,
    });
  });

  it('reads start address, tilt, profile folder, and test mode', () => {
    const opts = parseLaunchOptions(
      ['electron', '.', '--start-url=http://127.0.0.1:4000/a.html', '--tilt=20', '--hypersol-user-data=C:\\tmp\\x'],
      { HYPERSOL_TEST: '1' },
    );
    expect(opts).toEqual({
      startUrl: 'http://127.0.0.1:4000/a.html',
      tiltDeg: 20,
      userDataDir: 'C:\\tmp\\x',
      testMode: true,
      testBackground: false,
      testKeepRunning: false,
      testNoKeychain: false,
    });
  });

  it('turns the keychain off only in test mode (milestone 9, K5)', () => {
    expect(parseLaunchOptions(['--test-no-keychain'], {}).testNoKeychain).toBe(false);
    expect(parseLaunchOptions(['--test-no-keychain'], { HYPERSOL_TEST: '1' }).testNoKeychain).toBe(true);
  });

  it('keeps test windows in the background only in test mode', () => {
    expect(parseLaunchOptions([], { HYPERSOL_TEST_BACKGROUND: '1' }).testBackground).toBe(false);
    expect(parseLaunchOptions([], { HYPERSOL_TEST: '1', HYPERSOL_TEST_BACKGROUND: '1' }).testBackground).toBe(true);
  });

  it('keeps running after the last window closes only in test mode', () => {
    expect(parseLaunchOptions([], { HYPERSOL_TEST_KEEP_RUNNING: '1' }).testKeepRunning).toBe(false);
    expect(parseLaunchOptions([], { HYPERSOL_TEST: '1', HYPERSOL_TEST_KEEP_RUNNING: '1' }).testKeepRunning).toBe(true);
  });

  it('clamps tilt and refuses non-web start addresses', () => {
    expect(parseLaunchOptions(['--tilt=90'], {}).tiltDeg).toBe(20);
    expect(parseLaunchOptions(['--tilt=-3'], {}).tiltDeg).toBe(0);
    expect(parseLaunchOptions(['--tilt=abc'], {}).tiltDeg).toBe(10);
    expect(parseLaunchOptions(['--start-url=file:///etc/passwd'], {}).startUrl).toBe('');
    expect(parseLaunchOptions(['--start-url=javascript:alert(1)'], {}).startUrl).toBe('');
    expect(parseLaunchOptions(['--start-url=about:blank'], {}).startUrl).toBe('');
  });

  it('accepts a search address only in test mode', () => {
    const arg = '--search-url=http://127.0.0.1:5000/search?q=%s';
    expect(parseLaunchOptions([arg], {}).searchUrl).toBeUndefined();
    expect(parseLaunchOptions([arg], { HYPERSOL_TEST: '1' }).searchUrl).toBe('http://127.0.0.1:5000/search?q=%s');
    expect(parseLaunchOptions(['--search-url=http://x.example/'], { HYPERSOL_TEST: '1' }).searchUrl).toBeUndefined();
    expect(parseLaunchOptions(['--search-url=file:///%s'], { HYPERSOL_TEST: '1' }).searchUrl).toBeUndefined();
  });
});

describe('isAllowedPageUrl', () => {
  it('allows only web addresses and the blank page', () => {
    expect(isAllowedPageUrl('https://example.com/')).toBe(true);
    expect(isAllowedPageUrl('http://127.0.0.1:3000/')).toBe(true);
    expect(isAllowedPageUrl('about:blank')).toBe(true);
    expect(isAllowedPageUrl('file:///C:/x.html')).toBe(false);
    expect(isAllowedPageUrl('chrome://settings')).toBe(false);
    expect(isAllowedPageUrl('not a url')).toBe(false);
  });
});
