/**
 * Which tabs may sleep (milestone 10): a tab that has been out of view
 * long enough, unless it is in front, still starting or loading, making
 * sound, downloading, or holding text typed into a form. Pure, so the
 * rules are unit tested.
 */

export interface SleepCandidate {
  focused: boolean;
  /** A start tab or a page that has not finished loading. */
  busy: boolean;
  asleep: boolean;
  audible: boolean;
  downloading: boolean;
  typed: boolean;
  /** When it was last in front (ms). */
  lastSeen: number;
}

/** Minutes out of view before sleeping, from the setting and economy mode (at most 5 then); 0 is never. */
export function sleepMinutes(setting: number, economy: boolean): number {
  if (setting === 0) return 0;
  return economy ? Math.min(setting, 5) : setting;
}

export function shouldSleep(tab: SleepCandidate, now: number, minutes: number, minuteMs = 60_000): boolean {
  if (minutes <= 0) return false;
  if (tab.focused || tab.busy || tab.asleep || tab.audible || tab.downloading || tab.typed) return false;
  return now - tab.lastSeen >= minutes * minuteMs;
}
