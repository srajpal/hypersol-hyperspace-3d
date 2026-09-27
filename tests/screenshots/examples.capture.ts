/**
 * The pictures on the HoloML examples cards (milestone 17): one of each
 * example site, from the local copies (tests/fixtures/holoml, copied by
 * pnpm holoml:sync), so this run uses no network.
 *
 *   pnpm screenshots:examples
 *
 * They are part of the browser (apps/browser/src/renderer/examples/), so
 * run it before `pnpm screenshots` when an example changes, and build
 * again.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { startFixtureServer } from '../e2e/fixture-server';
import { inPage, launch, shellCall, sleep, waitFor, waitForPage } from '../e2e/harness';

const OUT = fileURLToPath(new URL('../../apps/browser/src/renderer/examples/', import.meta.url));

/** Each example, the page to show, and what to do before the picture. */
const SHOTS: { id: string; page: string; before?: string }[] = [
  { id: 'showroom', page: 'showroom/index.holoml' },
  // Late afternoon, from where the game starts, turned toward the trees and the chest.
  { id: 'blockworld', page: 'blockworld/index.holoml?hour=16.5', before: 'holoml.viewer.lookAt([3, 6.2, -8]), true' },
];

it('captures the pictures of the HoloML examples', async () => {
  const server = await startFixtureServer();
  const h = await launch(server.url('link-a.html'));
  try {
    await waitForPage(h, 'link-a.html');
    for (const shot of SHOTS) {
      await shellCall(h, 'showUrl', server.url(`holoml/${shot.page}`));
      const part = shot.page.split('?')[0]!;
      await waitForPage(h, part);
      await waitFor(`${shot.id} ready`, () => inPage<boolean>(h, 'window.__holoml?.ready === true', part), (r) => r, 30_000);
      // A walker falls to the ground first; then the view is set.
      await waitFor('standing', () => inPage<boolean>(h, 'window.__holoml.walker()?.onGround ?? true', part), (v) => v, 15_000);
      if (shot.before) await inPage(h, shot.before, part);
      await sleep(2500);
      // The page alone (not the browser around it), 720 by 450, as JPEG.
      const jpeg = await h.app.evaluate(async ({ webContents }, part) => {
        const page = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(part)).pop()!;
        const image = await page.capturePage();
        const { width, height } = image.getSize();
        const h = Math.round((width * 10) / 16);
        const cropped = image.crop({ x: 0, y: Math.max(0, Math.round((height - h) / 2)), width, height: Math.min(height, h) });
        return cropped.resize({ width: 720, height: 450, quality: 'best' }).toJPEG(84).toString('base64');
      }, part);
      writeFileSync(`${OUT}${shot.id}.jpg`, Buffer.from(jpeg, 'base64'));
    }
  } finally {
    await h.close();
    await server.close();
  }
}, 180_000);
