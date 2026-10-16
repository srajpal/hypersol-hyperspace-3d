// Makes the social preview pictures of both repositories: the picture
// GitHub, and every site that unfurls a link, shows for the repository
// (Settings, General, Social preview; 1280 by 640 pixels, uploaded by
// hand, as GitHub has no API for it). Promotion plan, step 8 (GitHub
// issue #95). Electron renders a page of this script's own, as the icons
// are made (icons.mjs), so the fonts are this computer's: the files are
// committed, and no build renders them.
//
//   pnpm --filter @hypersol/browser social-previews   (electron scripts/social-previews.mjs)
//
// Writes docs/branding/social-preview.png (the browser: the logo and the
// words over the README's first screenshot, Harbour Loft in the room),
// and, when the holoml repository is beside this one, its
// docs/branding/social-preview.png (HoloML: the name and the words over
// four of the examples' pictures from holoml's site).
import { app, BrowserWindow } from 'electron';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../..');
const HOLOML = resolve(ROOT, '../holoml');
const WIDTH = 1280;
const HEIGHT = 640;

const url = (file) => pathToFileURL(file).href;

const STYLE = `
  html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #0b1030; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #fff; position: relative; }
  .cover { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 72%; }
  .shade { position: absolute; inset: 0; }
  .words { position: absolute; display: flex; flex-direction: column; justify-content: center; }
  h1 { margin: 0; font-weight: 700; letter-spacing: -0.01em; line-height: 1.05; text-shadow: 0 2px 12px rgba(0,0,0,0.6); }
  p { margin: 0; line-height: 1.3; text-shadow: 0 1px 8px rgba(0,0,0,0.6); }
  .tag { color: #9ff6ff; }
  .logo { position: absolute; }
  .strip { position: absolute; left: 0; right: 0; bottom: 0; display: flex; gap: 0; }
  .strip img { display: block; width: ${WIDTH / 4}px; height: ${HEIGHT * 0.3125}px; object-fit: cover; }
`;

/** The browser: the logo at the left, the words beside it, Harbour Loft in the room behind. */
function browserPage() {
  const shot = url(join(ROOT, 'docs/screenshots/readme.png'));
  const logo = url(join(ROOT, 'apps/browser/resources/icons/logo.png'));
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>
  <img class="cover" src="${shot}" alt="">
  <div class="shade" style="background: linear-gradient(90deg, rgba(8,10,40,0.96) 0%, rgba(8,10,40,0.9) 48%, rgba(8,10,40,0.35) 75%, rgba(8,10,40,0.15) 100%)"></div>
  <div class="shade" style="background: linear-gradient(180deg, rgba(8,10,40,0.6) 0%, rgba(8,10,40,0) 45%)"></div>
  <img class="logo" src="${logo}" alt="" style="left: 48px; top: 112px; width: 416px; height: 416px">
  <div class="words" style="left: 488px; top: 0; height: ${HEIGHT}px; width: 740px">
    <h1 style="font-size: 62px">HyperSol HyperSpace 3D</h1>
    <p style="font-size: 31px; margin-top: 18px">An open-source desktop browser with a 3D interface: ordinary websites in a 3D room, and fully 3D sites written in HoloML.</p>
    <p class="tag" style="font-size: 24px; margin-top: 26px">Free · Apache 2.0 · Windows, macOS, and Linux · no telemetry</p>
  </div>
</body></html>`;
}

/** HoloML: the name and the words above a row of four examples. */
function holomlPage() {
  const pictures = ['harbour-loft', 'showroom', 'aquarium', 'blockworld'].map((n) => url(join(HOLOML, 'site/pictures', `${n}.jpg`)));
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>
  <div class="shade" style="background: radial-gradient(ellipse at 20% 0%, rgba(57,230,255,0.22), transparent 55%), radial-gradient(ellipse at 90% 20%, rgba(255,79,216,0.2), transparent 50%)"></div>
  <div class="words" style="left: 72px; top: 0; height: ${HEIGHT * 0.6875}px; width: 1136px">
    <h1 style="font-size: 112px">HoloML</h1>
    <p style="font-size: 34px; margin-top: 10px">A markup language for fully 3D websites, written the way a page is.</p>
    <p class="tag" style="font-size: 24px; margin-top: 24px">An open specification · a parser and a checker · seven example sites · Apache 2.0 and CC BY 4.0</p>
  </div>
  <div class="strip">${pictures.map((p) => `<img src="${p}" alt="">`).join('')}</div>
</body></html>`;
}

/** A window drawing one page off screen. */
async function open(file) {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true, sandbox: true },
  });
  await win.loadFile(file);
  return win;
}

/** The page's PNG, once every picture is decoded and two frames drawn. */
async function capture(win) {
  await win.webContents.executeJavaScript(
    `Promise.all([...document.images].map((i) => i.decode().catch(() => undefined))).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))`,
    true,
  );
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: WIDTH, height: HEIGHT });
  return image.resize({ width: WIDTH, height: HEIGHT }).toPNG();
}

app.whenReady().then(async () => {
  const stage = mkdtempSync(join(tmpdir(), 'hyperspace3d-social-'));
  try {
    const jobs = [{ page: browserPage(), out: join(ROOT, 'docs/branding/social-preview.png') }];
    if (existsSync(join(HOLOML, 'site/pictures/harbour-loft.jpg'))) jobs.push({ page: holomlPage(), out: join(HOLOML, 'docs/branding/social-preview.png') });
    else console.log(`holoml is not beside this repository (${HOLOML}): its picture is not made`);
    const windows = [];
    try {
      for (const [i, job] of jobs.entries()) {
        const file = join(stage, `page-${i}.html`);
        writeFileSync(file, job.page);
        windows.push(await open(file));
      }
      for (const [i, job] of jobs.entries()) {
        mkdirSync(dirname(job.out), { recursive: true });
        writeFileSync(job.out, await capture(windows[i]));
        console.log(`written ${job.out} (${WIDTH} by ${HEIGHT})`);
      }
    } finally {
      for (const win of windows) win.destroy();
    }
    app.exit(0);
  } catch (e) {
    console.error(e);
    app.exit(1);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
});
