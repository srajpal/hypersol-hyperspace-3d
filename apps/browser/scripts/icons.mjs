// Makes the app's icons from the logo chosen in prompt 46 (concept 4d,
// docs/branding/logo-concepts/4d-now-in-big-3d.svg: a cube with "NOW IN"
// on one face and a big "3D" on the other, in orbit over the neon grid;
// GitHub issue #92, the 0.9.1 release). Electron itself renders the SVG,
// as the concept pictures were made with headless Chrome, so the Impact
// font of the words is the one this computer has (Windows has it; the
// files are committed, so no build renders them).
//
//   pnpm --filter @hypersol/browser icons        (electron scripts/icons.mjs)
//
// Writes resources/icons/: icon-<size>.png for 16 to 1024 pixels (the
// wordless cube up to 64, as the words cannot be read that small, the
// concept's notes), icon.png (512), logo.png (512, with the words, for a
// README or an About box), icon.ico (Windows: 16 to 256) and icon.icns
// (macOS: 16 to 1024), both written here, as each format is a list of
// PNGs with a small header: no package is needed for them.
import { app, BrowserWindow } from 'electron';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, '../../../docs/branding/logo-concepts/4d-now-in-big-3d.svg');
const OUT = join(here, '../resources/icons');
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
/** Below this size the words are left off. */
const WORDS_FROM = 128;

/** The SVG without its three groups of words (the ones with a font-family). */
function withoutWords(svg) {
  return svg.replace(/<g transform="matrix\([^"]*\)" font-family="[^"]*"[^>]*>[\s\S]*?<\/g>\n?/g, '');
}

/** A page on disk that shows an SVG as a picture, sized by a script; one window loads it once. */
function writePage(svg, file) {
  const data = Buffer.from(svg).toString('base64');
  writeFileSync(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}img{display:block}</style></head><body><img id="i" src="data:image/svg+xml;base64,${data}"></body></html>`,
  );
}

/** Renders the page's picture at one size: the window and the picture resized, two frames waited, the page captured. */
async function render(win, size) {
  win.setContentSize(size, size);
  await win.webContents.executeJavaScript(
    `(() => { const i = document.getElementById('i'); i.style.width = '${size}px'; i.style.height = '${size}px'; return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))); })()`,
    true,
  );
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  return image.resize({ width: size, height: size }).toPNG();
}

/** A hidden, transparent window drawn off screen, for the captures. */
async function openPage(file) {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true, sandbox: true },
  });
  await win.loadFile(file);
  return win;
}

/** A Windows .ico of PNG entries (Vista and later read PNG inside an .ico). */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach(({ size, png }, i) => {
    const at = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, at); // 0 means 256
    dir.writeUInt8(size >= 256 ? 0 : size, at + 1);
    dir.writeUInt8(0, at + 2); // colours in the palette: none
    dir.writeUInt8(0, at + 3);
    dir.writeUInt16LE(1, at + 4); // colour planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

/** A macOS .icns of PNG entries, by Apple's type for each size. */
function icns(entries) {
  const TYPES = { 16: 'icp4', 32: 'icp5', 64: 'icp6', 128: 'ic07', 256: 'ic08', 512: 'ic09', 1024: 'ic10' };
  const chunks = entries
    .filter((e) => TYPES[e.size])
    .map(({ size, png }) => {
      const head = Buffer.alloc(8);
      head.write(TYPES[size], 0, 'ascii');
      head.writeUInt32BE(8 + png.length, 4);
      return Buffer.concat([head, png]);
    });
  const total = 8 + chunks.reduce((n, c) => n + c.length, 0);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(total, 4);
  return Buffer.concat([head, ...chunks]);
}

app.whenReady().then(async () => {
  try {
    const svg = readFileSync(SOURCE, 'utf8');
    const plain = withoutWords(svg);
    if (plain === svg) throw new Error('the words were not found in the SVG; the concept file has changed');
    mkdirSync(OUT, { recursive: true });
    const stage = mkdtempSync(join(tmpdir(), 'hyperspace3d-icons-'));
    const pages = { words: join(stage, 'words.html'), plain: join(stage, 'plain.html') };
    writePage(svg, pages.words);
    writePage(plain, pages.plain);
    const windows = { words: await openPage(pages.words), plain: await openPage(pages.plain) };
    const entries = [];
    try {
      for (const size of SIZES) {
        const png = await render(size >= WORDS_FROM ? windows.words : windows.plain, size);
        writeFileSync(join(OUT, `icon-${size}.png`), png);
        entries.push({ size, png });
      }
      writeFileSync(join(OUT, 'icon.png'), entries.find((e) => e.size === 512).png);
      writeFileSync(join(OUT, 'logo.png'), await render(windows.words, 512));
    } finally {
      windows.words.destroy();
      windows.plain.destroy();
      rmSync(stage, { recursive: true, force: true });
    }
    writeFileSync(join(OUT, 'icon.ico'), ico(entries.filter((e) => e.size <= 256)));
    writeFileSync(join(OUT, 'icon.icns'), icns(entries));
    console.log(`icons written to ${OUT}: ${SIZES.join(', ')} px; icon.ico, icon.icns, icon.png, logo.png`);
    app.exit(0);
  } catch (e) {
    console.error(e);
    app.exit(1);
  }
});
