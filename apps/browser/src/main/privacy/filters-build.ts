import { createHash } from 'node:crypto';
import { FiltersEngine } from '@ghostery/adblocker';

/** starter.json, as far as the app reads it: written by scripts/filters-update.mjs. */
export interface StarterInfo {
  /** When the starter copy was built (an ISO date). */
  built: string;
  /** The SHA-256 of starter.bin. */
  engineSha256?: string;
  /** The page scripts file the starter copy was built with. */
  resources: { sha256: string };
}

export function sha256(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Checks the starter copy against what was recorded when it was built
 * (review of 2026-09-30, M5): before a refresh takes the page scripts
 * from it, the file must be the one `pnpm filters:update` wrote. Throws
 * in plain words if it is not.
 */
export function verifyStarter(bin: Uint8Array, info: StarterInfo): void {
  if (typeof info.engineSha256 !== 'string' || sha256(bin) !== info.engineSha256) {
    throw new Error("the lists included with the app don't match their recorded checksum");
  }
}

/**
 * Builds an engine from list texts, with the page scripts of the starter
 * copy included in the app: a refresh brings new rules, never new
 * scripts. `scripts` is the SHA-256 of the scripts file as recorded in
 * starter.json; the starter copy carries the same value, or nothing is
 * built. Returns the engine's saved form.
 */
export function buildEngine(lists: string[], starter: Uint8Array, scripts: string): Uint8Array {
  const included = FiltersEngine.deserialize(starter).resources;
  if (scripts === '' || included.checksum !== scripts) {
    throw new Error("the page scripts included with the app don't match their recorded checksum");
  }
  const engine = FiltersEngine.parse(lists.join('\n'));
  engine.resources = included;
  return engine.serialize();
}
