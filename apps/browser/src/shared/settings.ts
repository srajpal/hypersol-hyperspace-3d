/**
 * Settings shared by the main process (which stores them) and the shell
 * (which shows them). Pure, so both sides and the unit tests use it.
 */
import { isOrigin, MAX_PERMISSION_SITES, parseSiteChoices, type SiteChoices } from './permissions';
import type { ShortcutName } from './commands';
import { checkOverrides } from './shortcuts';

export const SEARCH_ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=%s' },
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/sp/search?query=%s' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=%s' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
} as const;

export type SearchEngineId = keyof typeof SEARCH_ENGINES;
export type StartupMode = 'new-tab' | 'last-tabs';
/**
 * Encrypted DNS (ARCHITECTURE.md section 4): 'secure' uses only the named
 * resolver; 'automatic' uses it where it can and falls back to the
 * network's own DNS.
 */
export type DnsMode = 'secure' | 'automatic';
/** A built-in theme, or follow the system's light or dark setting (milestone 6). */
export type ThemeChoice = 'nebula' | 'daylight' | 'system';
/** Which console messages the instrument panel shows (milestone 7). */
export type ConsoleFilter = 'all' | 'warnings' | 'errors';
/** Tab card size (milestone 10); medium is the size since milestone 6. */
export type TabSize = 'small' | 'medium' | 'large';
/** How tabs are shown: cards on the rail, or a list in the top bar (milestone 11: "cards that hide" removed). */
export type TabDisplay = 'cards' | 'list';
/** Which way the page leans (milestone 11): its right edge back, or its left edge back. */
export type TiltDirection = 'right' | 'left';
/** How much the room moves with the pointer (milestone 11). */
export type ParallaxAmount = 'off' | 'subtle' | 'normal';
/** Space kept around the page (milestone 11). */
export type PageMargin = 'compact' | 'normal' | 'roomy';
/** Economy mode: off, on, or on while the computer runs on battery. */
export type EconomyMode = 'off' | 'on' | 'battery';
/** Minutes a tab may stay out of view before it sleeps; 0 is never. */
export const TAB_SLEEP_CHOICES = [0, 5, 15, 30, 60] as const;
export type TabSleep = (typeof TAB_SLEEP_CHOICES)[number];
export const MIN_TILT = 0;
export const MAX_TILT = 20;

export interface Settings {
  searchEngine: SearchEngineId;
  onStartup: StartupMode;
  dnsMode: DnsMode;
  /** Refresh the filter lists from the internet once a day. */
  filterRefresh: boolean;
  /** Sites (host names) where the privacy shield is paused. */
  pausedSites: string[];
  /** Pages open in the layers view (milestone 5), unless the site has its own choice. */
  layersOnOpen: boolean;
  /** Per-site choice for the layers view, by host name; set when the view is switched on a page. */
  layersSites: Record<string, boolean>;
  theme: ThemeChoice;
  /** How far the page leans back, in whole degrees (less tilt, sharper text). */
  pageTilt: number;
  /** Show the instrument panel (milestone 7); off by default. */
  instruments: boolean;
  /** Its parts, each switchable. */
  instrumentsReadouts: boolean;
  instrumentsGauges: boolean;
  instrumentsConsole: boolean;
  instrumentsNetwork: boolean;
  consoleLevel: ConsoleFilter;
  /** Zoom factor per site (host name), when not 100% (milestone 8). */
  zoomSites: Record<string, number>;
  /** Remembered camera, microphone, and location answers, by origin (milestone 9). */
  sitePermissions: Record<string, SiteChoices>;
  /** Tabs and economy (milestone 10). */
  tabSize: TabSize;
  tabDisplay: TabDisplay;
  economy: EconomyMode;
  tabSleep: TabSleep;
  /** Milestone 11: the view, and the person's own shortcut keys. */
  tiltDirection: TiltDirection;
  parallax: ParallaxAmount;
  pageMargin: PageMargin;
  shortcuts: Partial<Record<ShortcutName, string>>;
}

/**
 * A change to settings: new values for some of them, and, not a setting
 * itself, sites (origins) whose remembered permissions to forget. Naming
 * the sites means a sender whose copy of the choices is out of date
 * cannot write an old one back (review of 2026-09-30, R6).
 */
export type SettingsPatch = Partial<Settings> & { forgetSitePermissions?: string[] };

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  searchEngine: 'duckduckgo',
  onStartup: 'new-tab',
  dnsMode: 'secure',
  filterRefresh: true,
  pausedSites: Object.freeze([]) as unknown as string[],
  layersOnOpen: true,
  layersSites: Object.freeze({}) as Record<string, boolean>,
  theme: 'nebula',
  pageTilt: 10,
  instruments: false,
  instrumentsReadouts: true,
  instrumentsGauges: true,
  instrumentsConsole: true,
  instrumentsNetwork: true,
  consoleLevel: 'all',
  zoomSites: Object.freeze({}) as Record<string, number>,
  sitePermissions: Object.freeze({}) as Record<string, SiteChoices>,
  tabSize: 'medium',
  tabDisplay: 'cards',
  economy: 'battery',
  tabSleep: 30,
  tiltDirection: 'right',
  parallax: 'normal',
  pageMargin: 'normal',
  shortcuts: Object.freeze({}) as Partial<Record<ShortcutName, string>>,
});

const SETTING_KEYS = ['searchEngine', 'onStartup', 'dnsMode', 'filterRefresh', 'pausedSites', 'layersOnOpen', 'layersSites', 'theme', 'pageTilt',
  'instruments', 'instrumentsReadouts', 'instrumentsGauges', 'instrumentsConsole', 'instrumentsNetwork', 'consoleLevel', 'zoomSites',
  'sitePermissions', 'tabSize', 'tabDisplay', 'economy', 'tabSleep', 'tiltDirection', 'parallax', 'pageMargin', 'shortcuts'] as const;

/** The platform shortcut keys are checked for (the main process saves settings). */
const platform = typeof process !== 'undefined' && typeof process.platform === 'string' ? process.platform : 'win32';
const INSTRUMENT_SWITCHES = ['instruments', 'instrumentsReadouts', 'instrumentsGauges', 'instrumentsConsole', 'instrumentsNetwork'] as const;
export const MAX_PAUSED_SITES = 1000;
export const MAX_LAYERS_SITES = 1000;

/** A host name as URL.hostname gives it: letters, digits, dots, hyphens, or a bracketed IPv6 address. */
export function isHostName(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 255 && /^([a-z0-9.-]+|\[[0-9a-f:.]+\])$/i.test(v);
}

const isEngine = (v: unknown): v is SearchEngineId => typeof v === 'string' && Object.hasOwn(SEARCH_ENGINES, v);
const isStartup = (v: unknown): v is StartupMode => v === 'new-tab' || v === 'last-tabs';
const isDnsMode = (v: unknown): v is DnsMode => v === 'secure' || v === 'automatic';

/**
 * Applies a change to settings. Unknown keys and bad values are refused
 * with a reason, so neither a damaged file nor a bad request can put a
 * wrong value in place.
 */
export function applySettingsPatch(current: Settings, patch: unknown): { settings: Settings } | { error: string } {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) return { error: 'Not a settings object' };
  const next: Settings = {
    ...current,
    pausedSites: [...current.pausedSites],
    layersSites: { ...current.layersSites },
    zoomSites: { ...current.zoomSites },
    sitePermissions: { ...current.sitePermissions },
    shortcuts: { ...current.shortcuts },
  };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'searchEngine') {
      if (!isEngine(value)) return { error: `Unknown search engine: ${String(value)}` };
      next.searchEngine = value;
    } else if (key === 'onStartup') {
      if (!isStartup(value)) return { error: `Unknown startup choice: ${String(value)}` };
      next.onStartup = value;
    } else if (key === 'dnsMode') {
      if (!isDnsMode(value)) return { error: `Unknown DNS mode: ${String(value)}` };
      next.dnsMode = value;
    } else if (key === 'filterRefresh') {
      if (typeof value !== 'boolean') return { error: 'filterRefresh must be true or false' };
      next.filterRefresh = value;
    } else if (key === 'pausedSites') {
      if (!Array.isArray(value) || value.length > MAX_PAUSED_SITES || !value.every(isHostName)) {
        return { error: 'pausedSites must be a list of host names' };
      }
      next.pausedSites = [...new Set(value.map((h: string) => h.toLowerCase()))];
    } else if ((INSTRUMENT_SWITCHES as readonly string[]).includes(key)) {
      if (typeof value !== 'boolean') return { error: `${key} must be true or false` };
      next[key as (typeof INSTRUMENT_SWITCHES)[number]] = value;
    } else if (key === 'zoomSites') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return { error: 'zoomSites must map host names to zoom factors' };
      const entries = Object.entries(value as Record<string, unknown>);
      const ok = (v: unknown) => typeof v === 'number' && v >= 0.25 && v <= 5;
      if (entries.length > MAX_LAYERS_SITES || !entries.every(([h, v]) => isHostName(h) && ok(v))) {
        return { error: 'zoomSites must map host names to zoom factors from 0.25 to 5' };
      }
      next.zoomSites = Object.fromEntries(entries.map(([h, v]) => [h.toLowerCase(), v as number]));
    } else if (key === 'sitePermissions') {
      const sites = parseSiteChoices(value);
      if (!sites) return { error: 'sitePermissions must map web origins to camera, microphone, and location choices' };
      next.sitePermissions = sites;
    } else if (key === 'forgetSitePermissions') {
      if (!Array.isArray(value) || value.length > MAX_PERMISSION_SITES || !value.every(isOrigin)) {
        return { error: 'forgetSitePermissions must be a list of web origins' };
      }
      for (const origin of value) delete next.sitePermissions[origin];
    } else if (key === 'tabSize') {
      if (value !== 'small' && value !== 'medium' && value !== 'large') return { error: `Unknown tab size: ${String(value)}` };
      next.tabSize = value;
    } else if (key === 'tabDisplay') {
      if (value !== 'cards' && value !== 'list') return { error: `Unknown way to show tabs: ${String(value)}` };
      next.tabDisplay = value;
    } else if (key === 'tiltDirection') {
      if (value !== 'right' && value !== 'left') return { error: `Unknown tilt direction: ${String(value)}` };
      next.tiltDirection = value;
    } else if (key === 'parallax') {
      if (value !== 'off' && value !== 'subtle' && value !== 'normal') return { error: `Unknown movement: ${String(value)}` };
      next.parallax = value;
    } else if (key === 'pageMargin') {
      if (value !== 'compact' && value !== 'normal' && value !== 'roomy') return { error: `Unknown page margin: ${String(value)}` };
      next.pageMargin = value;
    } else if (key === 'shortcuts') {
      const checked = checkOverrides(value, platform);
      if ('error' in checked) return { error: checked.error };
      next.shortcuts = checked.overrides;
    } else if (key === 'economy') {
      if (value !== 'off' && value !== 'on' && value !== 'battery') return { error: `Unknown economy mode: ${String(value)}` };
      next.economy = value;
    } else if (key === 'tabSleep') {
      if (!(TAB_SLEEP_CHOICES as readonly unknown[]).includes(value)) return { error: `tabSleep must be one of ${TAB_SLEEP_CHOICES.join(', ')} minutes` };
      next.tabSleep = value as TabSleep;
    } else if (key === 'consoleLevel') {
      if (value !== 'all' && value !== 'warnings' && value !== 'errors') return { error: `Unknown console level: ${String(value)}` };
      next.consoleLevel = value;
    } else if (key === 'theme') {
      if (value !== 'nebula' && value !== 'daylight' && value !== 'system') return { error: `Unknown theme: ${String(value)}` };
      next.theme = value;
    } else if (key === 'pageTilt') {
      if (!Number.isInteger(value) || (value as number) < MIN_TILT || (value as number) > MAX_TILT) {
        return { error: `pageTilt must be a whole number from ${MIN_TILT} to ${MAX_TILT}` };
      }
      next.pageTilt = value as number;
    } else if (key === 'layersOnOpen') {
      if (typeof value !== 'boolean') return { error: 'layersOnOpen must be true or false' };
      next.layersOnOpen = value;
    } else if (key === 'layersSites') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return { error: 'layersSites must map host names to true or false' };
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length > MAX_LAYERS_SITES || !entries.every(([h, v]) => isHostName(h) && typeof v === 'boolean')) {
        return { error: 'layersSites must map host names to true or false' };
      }
      next.layersSites = Object.fromEntries(entries.map(([h, v]) => [h.toLowerCase(), v as boolean]));
    } else {
      return { error: `Unknown setting: ${key}` };
    }
  }
  return { settings: next };
}

/** A fresh copy of the defaults (the list inside is never shared). */
export function defaults(): Settings {
  return { ...DEFAULT_SETTINGS, pausedSites: [], layersSites: {}, zoomSites: {}, sitePermissions: {}, shortcuts: {} };
}

/**
 * Reads a settings file's text. Anything unreadable gives the defaults and
 * a problem to report; unknown keys in an otherwise good file are ignored,
 * so a newer file still opens.
 */
export function parseSettings(text: string): { settings: Settings; problem?: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { settings: defaults(), problem: 'not valid JSON' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { settings: defaults(), problem: 'not a settings object' };
  }
  const known = Object.fromEntries(
    Object.entries(data).filter(([k]) => (SETTING_KEYS as readonly string[]).includes(k)),
  );
  // "Cards that hide" was removed in milestone 11 (owner, prompt 50): it reads as cards.
  if (known['tabDisplay'] === 'autohide') known['tabDisplay'] = 'cards';
  const result = applySettingsPatch(defaults(), known);
  if ('error' in result) return { settings: defaults(), problem: result.error };
  return { settings: result.settings };
}

export function searchUrlFor(settings: Settings): string {
  return SEARCH_ENGINES[settings.searchEngine].url;
}
