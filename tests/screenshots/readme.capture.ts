/**
 * The README's screenshots (owner, prompt 68: always the newest version,
 * nice ones; prompt 99: four, to show the variety of what the browser
 * does; prompt 118: Harbour Loft, the newest example, first):
 *
 *   pnpm screenshots:readme
 *
 * In one window with four tabs (a sample web page, and HoloML's showroom,
 * Blockworld, and Harbour Loft), it writes to docs/screenshots/:
 *
 * - readme.png: Harbour Loft, the newest example (milestone 19): its
 *   living room by day, the harbour through the windows;
 * - readme-game.png: Blockworld, a HoloML game, from a pillar of stone at
 *   one corner of the island;
 * - readme-layers.png: the sample page in the Daylight theme, its parts
 *   lifted by the layers view;
 * - readme-instruments.png: the sample page with the instrument panel.
 *
 * The HoloML examples are copies from the holoml repository (see
 * packages/holoml/SOURCE.json), and the sample page (tests/fixtures/
 * readme/) is made up for these pictures; all are served from 127.0.0.1
 * like the test fixtures, so this run uses no network.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { startFixtureServer } from '../e2e/fixture-server';
import { cycleToTab, inPage, launch, pressInShell, settled, shellCall, sleep, tabs, waitFor, waitForPage, type Harness } from '../e2e/harness';

const OUT = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));

it('captures the README screenshots', async () => {
  const server = await startFixtureServer();
  const holoml = (page: string) => server.url(`holoml/${page}`);
  const h: Harness = await launch(server.url('readme/field-notes.html'));
  const shot = async (name: string) => {
    const png = await h.app.evaluate(async ({ BrowserWindow }) => {
      const image = await BrowserWindow.getAllWindows()[0]!.webContents.capturePage();
      return image.toPNG().toString('base64');
    });
    writeFileSync(`${OUT}${name}`, Buffer.from(png, 'base64'));
  };
  const ready = async (page: string) => {
    await waitForPage(h, page);
    await waitFor(`${page} ready`, () => inPage<boolean>(h, 'window.__holoml?.ready === true', page), (r) => r, 30_000);
    await settled(h);
    await sleep(2000); // the tab's snapshot for its card
  };
  const tabOf = async (part: string) => (await tabs(h)).find((t) => t.url.includes(part))!.id;
  const theme = async (scheme: 'light' | 'dark') => {
    await h.shell.click('hs-theme-button [data-testid="theme"]');
    await waitFor(scheme, () => h.shell.evaluate(() => document.documentElement.style.colorScheme), (s) => s === scheme);
    await sleep(1500);
  };
  try {
    mkdirSync(OUT, { recursive: true });
    await waitForPage(h, 'field-notes.html');
    await settled(h);
    await sleep(1500);
    for (const page of ['showroom/index.holoml', 'blockworld/index.holoml?hour=16.3', 'harbour-loft/index.holoml']) {
      await pressInShell(h, 'T', ['control']);
      await sleep(500);
      await shellCall(h, 'showUrl', holoml(page));
      await ready(page.split('?')[0]!);
    }

    // Harbour Loft's living room by day, from beside the bedroom's door (as its picture in the examples section).
    await inPage(h, 'holoml.viewer.position = [1.3, 1.65, -0.6], holoml.viewer.lookAt([-3, 1, 3]), true', 'harbour-loft');
    await sleep(2500);
    await shot('readme.png');

    // Blockworld: the whole island from a pillar of stone blocks at one
    // corner, as a player could build, once the welcome has gone (as its
    // picture in the examples section).
    await cycleToTab(h, await tabOf('blockworld'));
    await settled(h);
    const pillar = Array.from({ length: 11 }, (_, y) => `<model src="models/stone.gltf" position="12.5 ${y + 0.5} 12.5" solid />`).join(' ');
    await inPage(h, `holoml.add(${JSON.stringify(pillar)}), true`, 'blockworld');
    await sleep(300);
    await inPage(h, 'holoml.viewer.position = [12.5, 12.7, 12.5], holoml.viewer.lookAt([0, 2, 0]), true', 'blockworld');
    await waitFor('the welcome gone', () => inPage<boolean>(h, "holoml.find('message').text === ''", 'blockworld'), (v) => v, 15_000);
    await sleep(2000);
    await shot('readme-game.png');

    // The sample page in Daylight, its sections and pictures lifted by the layers view (on by default).
    await cycleToTab(h, await tabOf('field-notes'));
    await settled(h);
    await theme('light');
    await shot('readme-layers.png');

    // Nebula again: the page flat, and the instrument panel beside it.
    await theme('dark');
    await pressInShell(h, 'L', ['control', 'shift']);
    await pressInShell(h, 'I', ['control', 'shift']);
    await sleep(2500);
    await shot('readme-instruments.png');
  } finally {
    await h.close();
    await server.close();
  }
}, 300_000);
