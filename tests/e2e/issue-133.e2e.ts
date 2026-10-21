/**
 * GitHub issue #133, checks BS1 to BS3 (TODO.md, "Issue #133"): the ad
 * blocker's page scripts. On YouTube four of the lists' scripts declared the
 * same class at their top level, so all but the first failed; each script
 * waited for the page to load with a listener of its own (past Node's
 * warning at ten); a failure was an unhandled rejection in the main process;
 * and each ran with a user gesture. Here a local list does the same to a
 * local page: two scripts that declare `class JSONPath` (json-edit, twice,
 * each taking a key out of what JSON.parse gives)
 * and twelve that set a constant.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildEngine } from '../../apps/browser/src/main/privacy/filters-build';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import { APP_DIR, caughtUp, inPage, launch, navigateTo, newProfile, waitFor, waitForPage } from './harness';

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

const FILTERS_DIR = join(APP_DIR, 'resources', 'filters');

/** A profile whose blocker has only these rules, with the page scripts included in the app; no list refresh. */
function profileWith(rules: string[]): string {
  const profile = newProfile({ layersOnOpen: false, filterRefresh: false });
  const scripts = (JSON.parse(readFileSync(join(FILTERS_DIR, 'starter.json'), 'utf8')) as { resources: { sha256: string } }).resources.sha256;
  mkdirSync(join(profile, 'filters'));
  writeFileSync(join(profile, 'filters', 'engine.bin'), buildEngine([rules.join('\n')], new Uint8Array(readFileSync(join(FILTERS_DIR, 'starter.bin'))), scripts));
  writeFileSync(join(profile, 'filters', 'engine.json'), JSON.stringify({ updatedAt: Date.now(), urls: [], scripts }));
  return profile;
}

describe("BS1 to BS3: the blocker's page scripts (issue #133)", () => {
  it('BS1 two scripts that declare the same class both run; BS2 many scripts bring no listener warning and no unhandled rejection; BS3 no user gesture', async () => {
    const host = new URL(server.base).hostname;
    const rules = [`${host}##+js(json-edit, .c)`, `${host}##+js(json-edit, .d)`];
    for (let i = 1; i <= 12; i++) rules.push(`${host}##+js(set-constant, hs${i}, true)`);
    const h = await launch(server.url('link-a.html'), { userDataDir: profileWith(rules) });
    // What the main process prints from here on: Node's warnings go there.
    const printed: string[] = [];
    h.proc.stderr?.on('data', (d: Buffer) => printed.push(d.toString()));
    try {
      await waitForPage(h, 'link-a');
      await navigateTo(h, server.url('scriptlets.html'));
      await waitForPage(h, 'scriptlets');
      const page = await waitFor('the page read what the scripts did', () => inPage<{ parsed: Record<string, number>; constants: Record<string, unknown>; activated: boolean } | null>(h, 'window.__fixture ?? null', 'scriptlets'), (f) => f !== null);
      // BS1: the second json-edit ran too (before, it failed: "Identifier 'JSONPath' has already been declared").
      expect(page!.parsed).toEqual({ a: 0 });
      expect(Object.values(page!.constants).every((v) => v === true), JSON.stringify(page!.constants)).toBe(true);
      // BS3: the scripts gave the page no user gesture.
      expect(page!.activated).toBe(false);
      // BS2: fourteen scripts while the page loaded, and, once the app has dealt with all the page sent, the main
      // process said nothing of listeners or rejections.
      await caughtUp(h, 'scriptlets');
      const said = printed.join('');
      expect(said).not.toMatch(/MaxListenersExceededWarning/);
      expect(said).not.toMatch(/UnhandledPromiseRejection/);
    } finally {
      await h.close();
    }
  });
});
