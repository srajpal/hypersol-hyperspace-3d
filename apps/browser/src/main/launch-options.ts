import { DEFAULT_TILT_DEG, clampTilt } from '@hypersol/scene-core';
import { isAllowedPageUrl } from './security';

export interface LaunchOptions {
  /** First page to show; '' opens a start tab. */
  startUrl: string;
  /** Page tilt in degrees, 0 to 20. */
  tiltDeg: number;
  /** Profile folder for this run, if given on the command line. */
  userDataDir?: string;
  /** Set by the end-to-end tests: records logs and exposes test hooks. */
  testMode: boolean;
  /** Test mode only: search address with %s, in place of DuckDuckGo. */
  searchUrl?: string;
  /**
   * Test mode only (HYPERSOL_TEST_BACKGROUND=1): the window opens off
   * screen, without taking focus or a taskbar button, so test runs do
   * not get in the way of whoever is using the computer.
   */
  testBackground: boolean;
  /**
   * Test mode only (HYPERSOL_TEST_KEEP_RUNNING=1): keep running when the
   * last window closes, as the app does on macOS, to test quitting on any
   * platform.
   */
  testKeepRunning: boolean;
  /** Test mode only: download filter lists from this local address, and refresh on schedule. */
  filtersBase?: string;
  /** Test mode only: where the encrypted DNS reachability check asks (a local stand-in resolver). */
  dnsProbeUrl?: string;
  /** Test mode only: the start panel's HoloML showroom link goes to this local copy (milestone 16). */
  showroomUrl?: string;
  /** Test mode only: every HoloML example from local copies under this address (milestone 17). */
  examplesBase?: string;
  /** Test mode only: save downloads here instead of the Downloads folder. */
  downloadsDir?: string;
  /** Test mode only (--test-no-keychain): act as if the system keychain were unavailable (milestone 9, K5). */
  testNoKeychain: boolean;
  /** Test mode only (--test-no-webgl): the shell without WebGL, as on a computer that cannot draw the room (milestone 12, N7). */
  testNoWebGL: boolean;
  /** Test mode only (--test-sleep-minute-ms=N): a "minute" for sleeping tabs, so the checks need not wait (milestone 10). */
  testSleepMinuteMs?: number;
}

function switchValue(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = argv.find((a) => a.startsWith(prefix));
  return hit === undefined ? undefined : hit.slice(prefix.length);
}

/** Test-only addresses must point at this machine. */
function localAddress(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname === '127.0.0.1' ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads the launch options:
 *   --start-url=<http(s) address>   first page (default: a start tab)
 *   --tilt=<degrees>                page tilt, clamped to 0..20 (default 10)
 *   --hypersol-user-data=<folder>   profile folder for this run
 *   --search-url=<address with %s>  search engine, test mode only
 *   --filters-base=<address>        filter list downloads, test mode only (127.0.0.1)
 *   --dns-probe=<address>           DNS reachability check, test mode only (127.0.0.1)
 *   --test-no-keychain              passwords act as if the keychain were missing, test mode only
 *   --test-no-webgl                 the shell without WebGL (no 3D room), test mode only
 * and HYPERSOL_TEST=1 for test mode, HYPERSOL_TEST_BACKGROUND=1 for
 * test windows that stay out of the way.
 */
export function parseLaunchOptions(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): LaunchOptions {
  const url = switchValue(argv, 'start-url');
  const tilt = switchValue(argv, 'tilt');
  const userDataDir = switchValue(argv, 'hypersol-user-data');
  const testMode = env['HYPERSOL_TEST'] === '1';
  const search = switchValue(argv, 'search-url');
  const filtersBase = testMode ? localAddress(switchValue(argv, 'filters-base')) : undefined;
  const dnsProbeUrl = testMode ? localAddress(switchValue(argv, 'dns-probe')) : undefined;
  const showroomUrl = testMode ? localAddress(switchValue(argv, 'showroom-url')) : undefined;
  const examplesBase = testMode ? localAddress(switchValue(argv, 'examples-base')) : undefined;
  const downloadsDir = testMode ? switchValue(argv, 'downloads-dir') : undefined;
  const sleepMinuteText = testMode ? switchValue(argv, 'test-sleep-minute-ms') : undefined;
  const sleepMinute = sleepMinuteText !== undefined && /^\d{2,6}$/.test(sleepMinuteText) ? Number(sleepMinuteText) : undefined;
  const searchUrl =
    testMode && search !== undefined && search.includes('%s') && isAllowedPageUrl(search) && search !== ''
      ? search
      : undefined;
  return {
    startUrl: url !== undefined && url !== '' && url !== 'about:blank' && isAllowedPageUrl(url) ? url : '',
    tiltDeg: tilt === undefined || tilt.trim() === '' ? DEFAULT_TILT_DEG : clampTilt(Number(tilt)),
    ...(userDataDir ? { userDataDir } : {}),
    testMode,
    ...(searchUrl ? { searchUrl } : {}),
    testBackground: testMode && env['HYPERSOL_TEST_BACKGROUND'] === '1',
    testKeepRunning: testMode && env['HYPERSOL_TEST_KEEP_RUNNING'] === '1',
    ...(filtersBase ? { filtersBase } : {}),
    ...(dnsProbeUrl ? { dnsProbeUrl } : {}),
    ...(showroomUrl ? { showroomUrl } : {}),
    ...(examplesBase ? { examplesBase } : {}),
    ...(downloadsDir ? { downloadsDir } : {}),
    testNoKeychain: testMode && argv.includes('--test-no-keychain'),
    testNoWebGL: testMode && argv.includes('--test-no-webgl'),
    ...(sleepMinute !== undefined ? { testSleepMinuteMs: sleepMinute } : {}),
  };
}
