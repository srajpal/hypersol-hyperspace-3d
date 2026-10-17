// Makes the video and the GIF from the takes that video.capture.ts
// recorded into _video/ (the promotion plan's step 6, GitHub issue #93):
//
//   node tests/screenshots/video-encode.mjs      (pnpm screenshots:video runs it after the takes)
//
// The frames are held to 30 a second: each output frame is the latest
// captured at its time, so the video keeps the takes' own timing whatever
// rate the capture managed. They go, as JPEG, into Playwright's own ffmpeg
// (installed with the browser's tests; no other software), which encodes
// VP8 in WebM: _video/hyperspace-3d-<version>.webm. The take marked for
// the GIF goes through the same ffmpeg to PNG at 10 a second and 720
// pixels wide, and gif.mjs writes docs/video/hyperspace-3d.gif.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodeGif } from './gif.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const VIDEO = join(ROOT, '_video');
const GIF = join(ROOT, 'docs/video/hyperspace-3d.gif');
const GIF_WIDTH = 720;
const GIF_RATE = 10;

/** Playwright's ffmpeg, in its browsers folder. */
export function ffmpegPath() {
  const base =
    process.env['PLAYWRIGHT_BROWSERS_PATH'] ||
    (process.platform === 'win32' ? join(process.env['LOCALAPPDATA'] ?? join(homedir(), 'AppData/Local'), 'ms-playwright') : process.platform === 'darwin' ? join(homedir(), 'Library/Caches/ms-playwright') : join(homedir(), '.cache/ms-playwright'));
  const folders = existsSync(base) ? readdirSync(base).filter((f) => f.startsWith('ffmpeg-')).sort() : [];
  const name = process.platform === 'win32' ? 'ffmpeg-win64.exe' : process.platform === 'darwin' ? 'ffmpeg-mac' : 'ffmpeg-linux';
  for (const folder of folders.reverse()) {
    const file = join(base, folder, name);
    if (existsSync(file)) return file;
  }
  throw new Error(`Playwright's ffmpeg was not found under ${base}; pnpm install puts it there with the browser's tests.`);
}

/** The frames to show at `rate` a second for a take: the latest captured at each tick (a card is its one frame, held). */
function held(take, rate) {
  const tick = 1000 / rate;
  if (take.hold) return Array.from({ length: Math.round(take.hold / tick) }, () => take.frames[0].file);
  if (take.frames.length === 0) return [];
  const last = take.frames[take.frames.length - 1].t + tick;
  const out = [];
  let i = 0;
  for (let t = 0; t < last; t += tick) {
    while (i + 1 < take.frames.length && take.frames[i + 1].t <= t) i += 1;
    out.push(take.frames[i].file);
  }
  return out;
}

/** Pipes JPEG files into ffmpeg as an image sequence at `rate` a second, with the output arguments given. */
function pipe(ffmpeg, files, rate, outputArgs) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(rate), '-c:v', 'mjpeg', '-i', 'pipe:0', ...outputArgs], { stdio: ['pipe', 'inherit', 'inherit'] });
    proc.on('error', reject);
    // ffmpeg ending early (a wrong argument) closes the pipe: its exit code says so, not a second error.
    proc.stdin.on('error', () => undefined);
    proc.on('close', (code) => (code === 0 ? resolvePromise() : reject(new Error(`ffmpeg ended with ${code}`))));
    let i = 0;
    const write = () => {
      while (i < files.length) {
        const ok = proc.stdin.write(readFileSync(join(VIDEO, files[i])));
        i += 1;
        if (!ok) {
          proc.stdin.once('drain', write);
          return;
        }
      }
      proc.stdin.end();
    };
    write();
  });
}

export async function encode() {
  const takesFile = join(VIDEO, 'takes.json');
  if (!existsSync(takesFile)) throw new Error(`${takesFile} is not there: record the takes first (pnpm screenshots:video).`);
  const { width, height, rate, takes } = JSON.parse(readFileSync(takesFile, 'utf8'));
  const version = JSON.parse(readFileSync(join(ROOT, 'apps/browser/package.json'), 'utf8')).version;
  const ffmpeg = ffmpegPath();
  const sequence = takes.flatMap((take) => held(take, rate));
  const webm = join(VIDEO, `hyperspace-3d-${version}.webm`);
  await pipe(ffmpeg, sequence, rate, ['-c:v', 'libvpx', '-b:v', '6M', '-crf', '8', '-deadline', 'good', '-cpu-used', '1', '-auto-alt-ref', '0', '-pix_fmt', 'yuv420p', '-s', `${width}x${height}`, webm]);
  console.log(`video: ${webm}, ${sequence.length} frames, ${(sequence.length / rate).toFixed(1)} s at ${rate} a second, ${(statSync(webm).size / 1024 / 1024).toFixed(1)} MB`);

  const gifTake = takes.find((t) => t.gif);
  if (!gifTake) throw new Error('no take is marked for the GIF');
  const stage = mkdtempSync(join(tmpdir(), 'hyperspace3d-gif-'));
  try {
    const files = held(gifTake, GIF_RATE);
    await pipe(ffmpeg, files, GIF_RATE, ['-vf', `scale=${GIF_WIDTH}:-2`, '-f', 'image2', '-c:v', 'png', join(stage, '%04d.png')]);
    const frames = readdirSync(stage)
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => decodePng(readFileSync(join(stage, f))));
    const gif = encodeGif(frames, { delayMs: 1000 / GIF_RATE });
    mkdirSync(join(ROOT, 'docs/video'), { recursive: true });
    writeFileSync(GIF, gif);
    console.log(`gif: ${GIF}, ${frames.length} frames (${(frames.length / GIF_RATE).toFixed(1)} s at ${GIF_RATE} a second), ${frames[0].width} by ${frames[0].height}, ${(gif.length / 1024 / 1024).toFixed(2)} MB`);
    if (gif.length > 5 * 1024 * 1024) throw new Error('the GIF is over 5 MB, which GitHub would not show; shorten the take or lower GIF_WIDTH');
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  return { webm, gif: GIF };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  encode().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

// execFileSync is kept for a quick probe of ffmpeg by hand: node -e "..." is simpler than a flag.
export const ffmpegVersion = () => execFileSync(ffmpegPath(), ['-version']).toString().split('\n')[0];
