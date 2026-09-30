import { describe, expect, it } from 'vitest';
import { parseLaunchOptions } from './launch-options';
import { isAllowedPageUrl } from './security';

describe('parseLaunchOptions', () => {
  it('has safe defaults', () => {
    expect(parseLaunchOptions(['electron', '.'], {}, false)).toEqual({
      startUrl: '',
      tiltDeg: 10,
      testMode: false,
      testBackground: false,
      testKeepRunning: false,
      testNoKeychain: false,
      testNoWebGL: false,
    });
  });

  it('reads start address, tilt, profile folder, and test mode', () => {
    const opts = parseLaunchOptions(
      ['electron', '.', '--start-url=http://127.0.0.1:4000/a.html', '--tilt=20', '--hypersol-user-data=C:\\tmp\\x'],
      { HYPERSOL_TEST: '1' },
      false,
    );
    expect(opts).toEqual({
      startUrl: 'http://127.0.0.1:4000/a.html',
      tiltDeg: 20,
      userDataDir: 'C:\\tmp\\x',
      testMode: true,
      testBackground: false,
      testKeepRunning: false,
      testNoKeychain: false,
      testNoWebGL: false,
    });
  });

  it('turns the keychain off only in test mode (milestone 9, K5)', () => {
    expect(parseLaunchOptions(['--test-no-keychain'], {}, false).testNoKeychain).toBe(false);
    expect(parseLaunchOptions(['--test-no-keychain'], { HYPERSOL_TEST: '1' }, false).testNoKeychain).toBe(true);
    expect(parseLaunchOptions(['--test-no-webgl'], {}, false).testNoWebGL).toBe(false);
    expect(parseLaunchOptions(['--test-no-webgl'], { HYPERSOL_TEST: '1' }, false).testNoWebGL).toBe(true);
  });

  it('shortens the sleeping-tab minute only in test mode (milestone 10)', () => {
    expect(parseLaunchOptions(['--test-sleep-minute-ms=200'], {}, false).testSleepMinuteMs).toBeUndefined();
    expect(parseLaunchOptions(['--test-sleep-minute-ms=200'], { HYPERSOL_TEST: '1' }, false).testSleepMinuteMs).toBe(200);
    expect(parseLaunchOptions(['--test-sleep-minute-ms=abc'], { HYPERSOL_TEST: '1' }, false).testSleepMinuteMs).toBeUndefined();
  });

  it('keeps test windows in the background only in test mode', () => {
    expect(parseLaunchOptions([], { HYPERSOL_TEST_BACKGROUND: '1' }, false).testBackground).toBe(false);
    expect(parseLaunchOptions([], { HYPERSOL_TEST: '1', HYPERSOL_TEST_BACKGROUND: '1' }, false).testBackground).toBe(true);
  });

  it('keeps running after the last window closes only in test mode', () => {
    expect(parseLaunchOptions([], { HYPERSOL_TEST_KEEP_RUNNING: '1' }, false).testKeepRunning).toBe(false);
    expect(parseLaunchOptions([], { HYPERSOL_TEST: '1', HYPERSOL_TEST_KEEP_RUNNING: '1' }, false).testKeepRunning).toBe(true);
  });

  it('clamps tilt and refuses non-web start addresses', () => {
    expect(parseLaunchOptions(['--tilt=90'], {}, false).tiltDeg).toBe(20);
    expect(parseLaunchOptions(['--tilt=-3'], {}, false).tiltDeg).toBe(0);
    expect(parseLaunchOptions(['--tilt=abc'], {}, false).tiltDeg).toBe(10);
    expect(parseLaunchOptions(['--start-url=file:///etc/passwd'], {}, false).startUrl).toBe('');
    expect(parseLaunchOptions(['--start-url=javascript:alert(1)'], {}, false).startUrl).toBe('');
    expect(parseLaunchOptions(['--start-url=about:blank'], {}, false).startUrl).toBe('');
  });

  it('accepts a search address only in test mode', () => {
    const arg = '--search-url=http://127.0.0.1:5000/search?q=%s';
    expect(parseLaunchOptions([arg], {}, false).searchUrl).toBeUndefined();
    expect(parseLaunchOptions([arg], { HYPERSOL_TEST: '1' }, false).searchUrl).toBe('http://127.0.0.1:5000/search?q=%s');
    expect(parseLaunchOptions(['--search-url=http://x.example/'], { HYPERSOL_TEST: '1' }, false).searchUrl).toBeUndefined();
    expect(parseLaunchOptions(['--search-url=file:///%s'], { HYPERSOL_TEST: '1' }, false).searchUrl).toBeUndefined();
    // The showroom link's local stand-in (milestone 16): test mode and 127.0.0.1 only.
    const showroom = '--showroom-url=http://127.0.0.1:5000/holoml/showroom/index.holoml';
    expect(parseLaunchOptions([showroom], {}, false).showroomUrl).toBeUndefined();
    expect(parseLaunchOptions([showroom], { HYPERSOL_TEST: '1' }, false).showroomUrl).toBe('http://127.0.0.1:5000/holoml/showroom/index.holoml');
    expect(parseLaunchOptions(['--showroom-url=https://x.example/index.holoml'], { HYPERSOL_TEST: '1' }, false).showroomUrl).toBeUndefined();
    // Every example's local stand-in (milestone 17): the same rules.
    expect(parseLaunchOptions(['--examples-base=http://127.0.0.1:5000/holoml/'], { HYPERSOL_TEST: '1' }, false).examplesBase).toBe('http://127.0.0.1:5000/holoml/');
    expect(parseLaunchOptions(['--examples-base=http://127.0.0.1:5000/holoml/'], {}, false).examplesBase).toBeUndefined();
    expect(parseLaunchOptions(['--examples-base=https://srajpal.github.io/holoml/'], { HYPERSOL_TEST: '1' }, false).examplesBase).toBeUndefined();
  });
});

describe('parseLaunchOptions in a packaged build (review of 2026-09-30, D11)', () => {
  const env = { HYPERSOL_TEST: '1', HYPERSOL_TEST_BACKGROUND: '1', HYPERSOL_TEST_KEEP_RUNNING: '1' };
  const argv = [
    '--start-url=http://127.0.0.1:4000/a.html',
    '--tilt=20',
    '--hypersol-user-data=C:\\tmp\\x',
    '--search-url=http://127.0.0.1:5000/search?q=%s',
    '--filters-base=http://127.0.0.1:5000/filters/',
    '--dns-probe=http://127.0.0.1:5000/dns-query',
    '--showroom-url=http://127.0.0.1:5000/holoml/showroom/index.holoml',
    '--examples-base=http://127.0.0.1:5000/holoml/',
    '--downloads-dir=C:\\tmp\\downloads',
    '--test-no-keychain',
    '--test-no-webgl',
    '--test-sleep-minute-ms=200',
  ];

  it('has no test mode and no test-only switch, whatever the environment and the command line say', () => {
    expect(parseLaunchOptions(argv, env, true)).toEqual({
      // The three switches any run may use.
      startUrl: 'http://127.0.0.1:4000/a.html',
      tiltDeg: 20,
      userDataDir: 'C:\\tmp\\x',
      testMode: false,
      testBackground: false,
      testKeepRunning: false,
      testNoKeychain: false,
      testNoWebGL: false,
    });
  });

  it('the same launch in a build that is not packaged turns every one of them on', () => {
    expect(parseLaunchOptions(argv, env, false)).toEqual({
      startUrl: 'http://127.0.0.1:4000/a.html',
      tiltDeg: 20,
      userDataDir: 'C:\\tmp\\x',
      testMode: true,
      searchUrl: 'http://127.0.0.1:5000/search?q=%s',
      testBackground: true,
      testKeepRunning: true,
      filtersBase: 'http://127.0.0.1:5000/filters/',
      dnsProbeUrl: 'http://127.0.0.1:5000/dns-query',
      showroomUrl: 'http://127.0.0.1:5000/holoml/showroom/index.holoml',
      examplesBase: 'http://127.0.0.1:5000/holoml/',
      downloadsDir: 'C:\\tmp\\downloads',
      testNoKeychain: true,
      testNoWebGL: true,
      testSleepMinuteMs: 200,
    });
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
