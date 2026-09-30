/**
 * Milestone 22 end-to-end check Y7b (TODO.md): a page taller than one
 * lifted layer can be drawn stays readable in the layers view. HoloML's
 * published specification, which the HoloML examples section links to, is
 * 52,000 pixels tall; lifted whole, its main section drew nothing. Such a
 * section now stays flat and draws, and the page's other sections still
 * lift. (Y7's link itself is checked by T8, in m17.e2e.ts.)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import { inPage, launch, setContentSize, sleep, waitFor, waitForPage, type Harness } from './harness';

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

const PAGE = 'tall.html';

/** Lifted elements, by id. */
const lifted = (h: Harness) => inPage<string[]>(h, `[...document.querySelectorAll('[data-hs-layer]')].map((e) => e.id || e.tagName.toLowerCase())`, PAGE);

/** The share of dark pixels (the page's text) in the middle of the window: 0 when nothing is drawn there. */
function ink(h: Harness): Promise<number> {
  return h.app.evaluate(async ({ BrowserWindow }) => {
    const image = await BrowserWindow.getAllWindows()[0]!.webContents.capturePage();
    const { width, height } = image.getSize();
    const bitmap = image.toBitmap();
    let dark = 0;
    let all = 0;
    for (let y = Math.floor(height * 0.35); y < Math.floor(height * 0.8); y += 2) {
      for (let x = Math.floor(width * 0.25); x < Math.floor(width * 0.75); x += 2) {
        const i = (y * width + x) * 4;
        all++;
        if ((bitmap[i]! + bitmap[i + 1]! + bitmap[i + 2]!) / 3 < 120) dark++;
      }
    }
    return dark / all;
  });
}

describe('Y7b: a very tall page in the layers view', () => {
  it('Y7b keeps a section too tall to lift flat, draws it, and still lifts the rest, in a wide and a narrow window', async () => {
    const h = await launch(server.url(PAGE));
    try {
      await waitForPage(h, PAGE);
      const tall = await inPage<number>(h, `document.getElementById('long').offsetHeight`, PAGE);
      expect(tall).toBeGreaterThanOrEqual(30_000);
      // GitHub's Windows machines gave the page less room than this computer does (found in the pull request's run).
      for (const [width, height] of [[1280, 800], [1024, 700]] as const) {
        await setContentSize(h, width, height);
        // The layers view is on: the page's other tall section, and its header, lift once the layers are chosen again.
        await waitFor(`the other sections lifted at ${width} by ${height}`, () => lifted(h), (l) => l.includes('side') && l.includes('top'), 15_000);
        expect(await lifted(h)).not.toContain('long');
        await sleep(1000);
        const drawn = await ink(h);
        console.log(`Y7b at ${width} by ${height}: the tall page's text covers ${(drawn * 100).toFixed(1)}% of the middle of the window`);
        expect(drawn).toBeGreaterThan(0.01);
      }
    } finally {
      await h.close();
    }
  });
});
