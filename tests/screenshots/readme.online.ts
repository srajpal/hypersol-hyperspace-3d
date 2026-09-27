/**
 * The README's screenshot (owner, prompt 68: always the newest version,
 * a nice one, of a real site until HoloML sites are ready):
 *
 *   pnpm screenshots:readme
 *
 * Unlike every test, this run loads real pages: articles from Wikipedia
 * (text under CC BY-SA 4.0), through the browser's own encrypted DNS and
 * shield, in a throwaway profile. It writes docs/screenshots/readme.png.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { inPage, launch, navigateTo, pressInShell, settled, sleep, waitFor, waitForPage } from '../e2e/harness';

const OUT = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));
const PAGES = [
  'https://en.wikipedia.org/wiki/Web_browser',
  'https://en.wikipedia.org/wiki/Three-dimensional_space',
  'https://en.wikipedia.org/wiki/Hyperspace',
];

it('captures the README screenshot', async () => {
  const h = await launch(PAGES[0]!, { online: true });
  // The images in view (the rest load lazily, as the page scrolls).
  const inView = '[...document.images].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).every((i) => i.complete && i.naturalWidth > 0)';
  const ready = async (page: string) => {
    await waitForPage(h, page);
    // Wikipedia's banners (donation drives come and go) are hidden, as a
    // reader closing them would; the article itself is untouched.
    await h.app.evaluate(({ webContents }, part) => {
      const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(part)).pop();
      return guest?.insertCSS('#siteNotice, #centralNotice, .cn-fundraising, .frb { display: none !important; }');
    }, page);
    await waitFor(`${page} images`, () => inPage<boolean>(h, inView, page), (v) => v, 30_000);
    await settled(h);
    await sleep(2000); // the tab's snapshot for its card
  };
  try {
    await ready('Web_browser');
    for (const url of PAGES.slice(1)) {
      await pressInShell(h, 'T', ['control']);
      await sleep(500);
      await navigateTo(h, url);
      await ready(url.split('/').pop()!);
    }
    // The article and its picture fill the page, past the space above it.
    await inPage(h, 'window.scrollTo(0, 230); true', 'Hyperspace');
    await sleep(500);
    await waitFor('images in view', () => inPage<boolean>(h, inView, 'Hyperspace'), (v) => v, 30_000);
    await sleep(1500);
    const png = await h.app.evaluate(async ({ BrowserWindow }) => {
      const image = await BrowserWindow.getAllWindows()[0]!.webContents.capturePage();
      return image.toPNG().toString('base64');
    });
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}readme.png`, Buffer.from(png, 'base64'));
  } finally {
    await h.close();
  }
});
