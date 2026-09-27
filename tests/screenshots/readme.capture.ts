/**
 * The README's screenshot (owner, prompt 68: always the newest version, a
 * nice one; prompt 81, Q5 a: the HoloML showroom, served locally):
 *
 *   pnpm screenshots:readme
 *
 * The showroom is HoloML's own (a copy from the holoml repository, see
 * packages/holoml/SOURCE.json), served from 127.0.0.1 like the test
 * fixtures, so this run uses no network. It writes
 * docs/screenshots/readme.png.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { startFixtureServer } from '../e2e/fixture-server';
import { inPage, launch, pressInShell, settled, shellCall, sleep, waitFor, waitForPage, type Harness } from '../e2e/harness';

const OUT = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));

it('captures the README screenshot', async () => {
  const server = await startFixtureServer();
  const url = (page: string) => server.url(`holoml/showroom/${page}`);
  // Two car pages in tabs behind, the hall in front.
  const TABS = ['veyl-violet.holoml', 'quellis.holoml', 'index.holoml'];
  const h: Harness = await launch(url(TABS[0]!));
  const ready = async (page: string) => {
    await waitForPage(h, page);
    await waitFor(`${page} ready`, () => inPage<boolean>(h, 'window.__holoml?.ready === true', page), (r) => r, 30_000);
    await settled(h);
    await sleep(2000); // the tab's snapshot for its card
  };
  try {
    await ready(TABS[0]!);
    for (const page of TABS.slice(1)) {
      await pressInShell(h, 'T', ['control']);
      await sleep(500);
      await shellCall(h, 'showUrl', url(page));
      await ready(page);
    }
    // The turntable has turned the middle car to show its side.
    await sleep(3000);
    const png = await h.app.evaluate(async ({ BrowserWindow }) => {
      const image = await BrowserWindow.getAllWindows()[0]!.webContents.capturePage();
      return image.toPNG().toString('base64');
    });
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}readme.png`, Buffer.from(png, 'base64'));
  } finally {
    await h.close();
    await server.close();
  }
});
