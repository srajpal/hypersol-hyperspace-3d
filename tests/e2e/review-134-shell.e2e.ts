/**
 * Checks for the shell's findings in the review of 2026-09-30 (prompts
 * 134 and 135): R1 to R7, each named in its check. The room, the top bar,
 * the panels, and the prompts; the main process's and the viewer's
 * findings have their own files.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  focusedTab,
  launch,
  navigateTo,
  project,
  removeFolder,
  shellCall,
  sleep,
  waitFor,
  type Harness,
} from './harness';

let server: FixtureServer;
const folders: string[] = [];

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
  for (const f of folders) await removeFolder(f);
});

/** A fresh profile; economy mode off, so a laptop on battery runs the same checks. */
function newProfile(settings: object = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'hypersol-e2e-profile-'));
  folders.push(dir);
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ economy: 'off', ...settings }));
  return dir;
}

/** Moves the pointer into the room's bottom-left corner and waits for the camera to settle off-centre. */
async function cameraOffCentre(h: Harness): Promise<{ x: number; y: number }> {
  const height = await h.shell.evaluate(() => window.innerHeight);
  await h.shell.mouse.move(52, height - 52);
  await h.shell.mouse.move(12, height - 12, { steps: 8 });
  const moved = await waitFor(
    'the camera to settle off-centre',
    async () => {
      const a = await shellCall(h, 'cameraOffset');
      await sleep(100);
      return { a, b: await shellCall(h, 'cameraOffset') };
    },
    ({ a, b }) => a.x === b.x && a.y === b.y && (a.x !== 0 || a.y !== 0),
  );
  return moved.b;
}

describe('R4: a HoloML page that fills the window is flat', () => {
  it('the camera goes back to the centre though the pointer is over the page', async () => {
    const h = await launch('', { userDataDir: newProfile() });
    try {
      await waitFor('the start tab', () => focusedTab(h), (t) => t.state === 'start');
      const off = await cameraOffCentre(h);
      expect(Math.abs(off.x)).toBeGreaterThan(1);
      // Onto the page (the start panel): the parallax pauses with the camera still off-centre.
      const onPage = await project(h, 300, 200);
      await h.shell.mouse.move(onPage.x, onPage.y, { steps: 4 });
      await waitFor('the parallax paused', () => shellCall(h, 'parallaxPaused'), (p) => p);
      expect(await shellCall(h, 'cameraOffset')).not.toEqual({ x: 0, y: 0 });
      // A HoloML page arrives under the resting pointer.
      await navigateTo(h, server.url('holoml/still.holoml'));
      await waitFor('the page to fill the window', () => shellCall(h, 'holoml'), (s) => s.fill && s.shown);
      expect(await shellCall(h, 'cameraOffset')).toEqual({ x: 0, y: 0 });
      // Flat: the page's outline is a rectangle with level edges.
      const [tl, tr, br, bl] = await shellCall(h, 'panelQuad');
      expect(Math.abs(tl!.y - tr!.y)).toBeLessThan(0.01);
      expect(Math.abs(bl!.y - br!.y)).toBeLessThan(0.01);
      expect(Math.abs(tl!.x - bl!.x)).toBeLessThan(0.01);
      expect(Math.abs(tr!.x - br!.x)).toBeLessThan(0.01);
    } finally {
      await h.close();
    }
  });
});
