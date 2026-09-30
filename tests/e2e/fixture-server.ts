import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

export const FIXTURES_DIR = fileURLToPath(new URL('../fixtures/', import.meta.url));

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  // HoloML pages and their glTF models (milestone 14).
  '.holoml': 'model/vnd.holoml',
  '.gltf': 'model/gltf+json',
  // HoloML's showroom (milestone 16): binary glTF models and their palette picture.
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  // HoloML 0.2 (milestone 17): sounds (scripts are .js, above).
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  // The sofa studio (milestone 18): glTF's own buffers, pictures, and the panorama of the surroundings.
  '.bin': 'application/octet-stream',
  '.jpg': 'image/jpeg',
  '.hdr': 'image/vnd.radiance',
  // The README's sample page (prompt 99): its pictures.
  '.svg': 'image/svg+xml',
};

/** A solid-colour 16×16 PNG, built here so the fixture has no binary file. */
function makePng(r: number, g: number, b: number): Buffer {
  return png(16, 16, () => [r, g, b]);
}

/** A PNG of any size, each pixel's colour from a function. */
function png(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour
  const rows = Array.from({ length: height }, (_, y) => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, (_, x) => pixel(x, y)).flat())]));
  const pixels = deflateSync(Buffer.concat(rows));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const ICON_PNG = makePng(0x30, 0x50, 0xc0);

export interface FixtureServer {
  /** Base address, ending in a slash, e.g. http://127.0.0.1:53211/ */
  base: string;
  url(file: string): string;
  close(): Promise<void>;
  /** Requests received, by path and query (for example "/icon.png?v=3"). */
  hits: Map<string, number>;
  /** Requests the client cancelled before the answer was sent, by path and query. */
  aborted: Map<string, number>;
  /** Most connections open at once, by path (without query). */
  maxOpen: Map<string, number>;
  /** Connections open now, by path (without query). */
  openNow: Map<string, number>;
  /** Body bytes written, by path and query (streaming favicon routes). */
  sent: Map<string, number>;
  /** Lets requests held at a gate (…?gate=NAME; the slow download's is "slow.bin") through, now and from then on. */
  release(gate: string): void;
}

/** Requests held until a check lets them through (FixtureServer.release). */
interface Gate {
  open: boolean;
  waiting: (() => void)[];
}

/** A PNG header claiming a size, for the favicon dimension limit (not decodable). */
/** "ff2020" as red, green, and blue from 0 to 255 (a bad value is the fallback). */
function hex(value: string | null, fallback: [number, number, number]): [number, number, number] {
  if (!value || !/^[0-9a-f]{6}$/i.test(value)) return fallback;
  const n = parseInt(value, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * A panorama in Radiance's HDR format (RGBE, flat scanlines): 64 by 32
 * pixels of one colour, each channel from 0 up (1 is as bright as white).
 */
function hdrPanorama(r: number, g: number, b: number): Buffer {
  const [w, h] = [64, 32];
  const v = Math.max(r, g, b);
  let rgbe = [0, 0, 0, 0];
  if (v > 1e-32) {
    const e = Math.ceil(Math.log2(v + 1e-9)); // v = m * 2^e with m in [0.5, 1)
    const scale = 256 / 2 ** e;
    rgbe = [Math.floor(r * scale), Math.floor(g * scale), Math.floor(b * scale), e + 128];
  }
  const header = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'ascii');
  const pixels = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) pixels.set(rgbe, i * 4);
  return Buffer.concat([header, pixels]);
}

function pngClaiming(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>${escapeHtml(title)}</title>
<style>body{margin:0;padding:40px;font-family:sans-serif;font-size:22px;background:#fff}</style></head>
<body>${body}</body></html>`;
}

/**
 * Serves tests/fixtures, plus these routes:
 *   /slow?ms=1500              answers after a delay (loading strip)
 *   /search?q=...              a local stand-in for the search engine
 *   /icon.png                  a favicon
 *   /favicon/huge-bytes.png    2 MB, with its length declared
 *   /favicon/huge-stream.png   2 MB, sent in pieces without a declared length
 *   /favicon/huge-dims.png     a tiny file claiming 20000x20000 pixels
 *   /favicon/slow.png?ms=...   answers late (favicon timeout and cancelling)
 *   /favicon/declared-huge.png declares 10 MB, then trickles data forever
 *   /favicon/error-body.png    status 500 with a body that never ends
 *   /filters/<list>            tiny filter lists (block refreshed-tracker.test), for list refreshes
 *   /filters-failing/<list>    the same, except one list answers 500
 *   /dns-query?dns=...         a stand-in DNS-over-HTTPS resolver (answers every question)
 *   /dns-portal                a captive portal's web page where the resolver should be
 *   /ddm/...                   an "ad landing" page, served for the ad host mapped to this machine
 *   /download/sample.txt       a small file sent as an attachment (a download)
 *   /download/slow.bin         a 2 MB attachment that stays unfinished (to cancel): the first 64 KB are sent,
 *                              the rest only when the check calls release('slow.bin') (or, with gate=NAME, release(NAME))
 *   /download/broken.bin       an attachment whose connection breaks part way (a failed download)
 *   /holoml/by-type            holoml/still.holoml, known only by its media type (no .holoml in the address)
 *   /holoml/as-text.holoml     holoml/second.holoml sent as text/plain, known only by its address
 * Generated for HoloML's limits (milestone 15), so the repository holds no large file:
 *   /holoml/gen/zeros.bin?bytes=N       N zero bytes (up to 64 MB), sent in pieces without a declared length
 *   /holoml/gen/claim.png?w=W&h=H       a PNG header claiming W by H pixels
 *   /holoml/gen/box.gltf?mb=N&tris=T&img=W,H
 *                                       a glTF of T triangles (default 1) whose buffer is zeros.bin, at least
 *                                       N MB (default: just what the triangles need); img adds a claim.png;
 *                                       ms=M answers after M milliseconds (up to 10 s)
 *   /holoml/gen/late-car.gltf?ms=M      holoml/models/placeholder-car.gltf, after M milliseconds (up to 10 s);
 *                                       with gate=NAME instead, when the check calls release(NAME)
 *   /holoml/gen/never.gltf              answers nothing, ever (a model that never finishes)
 *   /holoml/gen/many.holoml?n=N         a page of a label and N empty groups (up to 50,000)
 *   /holoml/gen/tone.wav                a second of a quiet tone, as a WAV file (milestone 17)
 *   /holoml/gen/big.wav?mb=N            N MB of silence named as a WAV file, without a declared length
 *   /holoml/gen/stripes.png?n=N&a=RGB&b=RGB
 *                                       64 by 64 pixels of N pairs of upright stripes, colour a then b
 *                                       (default 2 pairs, ff2020 and 2040ff; milestone 18)
 *   /holoml/gen/panorama.hdr?rgb=R,G,B  a 64 by 32 HDR panorama of one colour (default 0,1,0: green)
 *   /holoml/gen/sky.png?top=RGB&bottom=RGB
 *                                       a 128 by 64 panorama, one colour above the horizon and one below
 *                                       (default ff6010 and 1060ff; milestone 19)
 *   /holoml/gen/plan.png                a 200 by 200 floor plan: pale, with a dark wall around (milestone 19)
 */
/** A WAV file: 16-bit mono, 22,050 samples a second, of a 440 Hz tone. */
function toneWav(seconds: number): Buffer {
  const rate = 22050;
  const n = Math.round(seconds * rate);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 6000), i * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8, 'ascii');
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36, 'ascii');
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

/** A glTF of one mesh: T triangles, all at one point, over a buffer of zeros (see the route list above). */
function boxGltf(params: URLSearchParams): string {
  const tris = Math.max(1, Math.min(50_000_000, Number(params.get('tris') ?? '1') || 1));
  const mb = Number(params.get('mb') ?? '0');
  // Three corners (36 bytes), then 16-bit indices: 6 bytes a triangle.
  const needed = 36 + tris * 6;
  const byteLength = Math.max(needed, Math.round(mb * 1024 * 1024));
  const img = params.get('img')?.split(',').map(Number);
  return JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [0, 0, 0] },
      { bufferView: 1, componentType: 5123, count: tris * 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: tris * 6 },
    ],
    buffers: [{ uri: `zeros.bin?bytes=${byteLength}`, byteLength }],
    ...(img && img.length === 2 ? { images: [{ uri: `claim.png?w=${img[0]}&h=${img[1]}` }] } : {}),
  });
}

function handler(req: IncomingMessage, res: ServerResponse, c: Counters): void {
  const url = new URL(req.url ?? '/', 'http://x');
  const path = decodeURIComponent(url.pathname);
  const key = `${url.pathname}${url.search}`;
  c.hits.set(key, (c.hits.get(key) ?? 0) + 1);
  const now = (c.openNow.get(url.pathname) ?? 0) + 1;
  c.openNow.set(url.pathname, now);
  c.maxOpen.set(url.pathname, Math.max(c.maxOpen.get(url.pathname) ?? 0, now));
  res.on('close', () => {
    c.openNow.set(url.pathname, (c.openNow.get(url.pathname) ?? 1) - 1);
    if (!res.writableFinished) c.aborted.set(key, (c.aborted.get(key) ?? 0) + 1);
  });
  if (path === '/holoml/by-type' || path === '/holoml/as-text.holoml') {
    const typed = path === '/holoml/by-type';
    readFile(join(FIXTURES_DIR, 'holoml', typed ? 'still.holoml' : 'second.holoml')).then(
      (body) => res.writeHead(200, { 'content-type': typed ? 'model/vnd.holoml' : 'text/plain', 'cache-control': 'no-store' }).end(body),
      () => res.writeHead(404).end(),
    );
    return;
  }
  if (path.startsWith('/holoml/gen/')) {
    const what = path.slice('/holoml/gen/'.length);
    const p = url.searchParams;
    if (what === 'never.gltf') return; // Held open until the client gives up or the server closes.
    if (what === 'tone.wav') {
      res.writeHead(200, { 'content-type': 'audio/wav', 'cache-control': 'no-store' });
      res.end(toneWav(1));
      return;
    }
    if (what === 'zeros.bin' || what === 'big.wav') {
      res.writeHead(200, { 'content-type': what === 'big.wav' ? 'audio/wav' : 'application/octet-stream', 'cache-control': 'no-store' });
      const asked = what === 'big.wav' ? Number(p.get('mb') ?? '1') * 1024 * 1024 : Number(p.get('bytes') ?? '0');
      const total = Math.min(64 * 1024 * 1024, Math.max(0, asked || 0));
      const piece = Buffer.alloc(256 * 1024);
      let sent = 0;
      const pump = () => {
        while (sent < total && !res.destroyed) {
          const part = piece.subarray(0, Math.min(piece.length, total - sent));
          sent += part.length;
          if (!res.write(part)) return void res.once('drain', pump);
        }
        if (!res.destroyed) res.end();
      };
      pump();
      return;
    }
    if (what === 'stripes.png') {
      const pairs = Math.min(16, Math.max(1, Number(p.get('n') ?? '2') || 2));
      const a = hex(p.get('a'), [0xff, 0x20, 0x20]);
      const b = hex(p.get('b'), [0x20, 0x40, 0xff]);
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      res.end(png(64, 64, (x) => (Math.floor((x * pairs * 2) / 64) % 2 === 0 ? a : b)));
      return;
    }
    if (what === 'sky.png') {
      const top = hex(p.get('top'), [0xff, 0x60, 0x10]);
      const bottom = hex(p.get('bottom'), [0x10, 0x60, 0xff]);
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      res.end(png(128, 64, (_x, y) => (y < 32 ? top : bottom)));
      return;
    }
    if (what === 'plan.png') {
      const wall = (v: number) => v < 6 || v >= 194;
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      res.end(png(200, 200, (x, y) => (wall(x) || wall(y) ? [0x3a, 0x3a, 0x40] : [0xf2, 0xef, 0xe8])));
      return;
    }
    if (what === 'panorama.hdr') {
      const [r, g, b] = (p.get('rgb') ?? '0,1,0').split(',').map((n) => Math.max(0, Number(n) || 0));
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(hdrPanorama(r ?? 0, g ?? 0, b ?? 0));
      return;
    }
    if (what === 'claim.png') {
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      res.end(pngClaiming(Number(p.get('w') ?? '16'), Number(p.get('h') ?? '16')));
      return;
    }
    if (what === 'late-car.gltf') {
      const send = () => {
        readFile(join(FIXTURES_DIR, 'holoml', 'models', 'placeholder-car.gltf')).then(
          (body) => {
            if (res.destroyed) return;
            res.writeHead(200, { 'content-type': TYPES['.gltf']!, 'cache-control': 'no-store' });
            res.end(body);
          },
          () => res.writeHead(500).end(),
        );
      };
      const name = p.get('gate');
      if (name) {
        const gate = c.gates.get(name) ?? { open: false, waiting: [] };
        c.gates.set(name, gate);
        if (gate.open) send();
        else gate.waiting.push(send);
        return;
      }
      setTimeout(send, Math.min(10_000, Math.max(0, Number(p.get('ms') ?? '0') || 0)));
      return;
    }
    if (what === 'box.gltf') {
      const send = () => {
        if (res.destroyed) return;
        res.writeHead(200, { 'content-type': TYPES['.gltf']!, 'cache-control': 'no-store' });
        res.end(boxGltf(p));
      };
      const wait = Math.min(10_000, Math.max(0, Number(p.get('ms') ?? '0') || 0));
      if (wait > 0) setTimeout(send, wait);
      else send();
      return;
    }
    if (what === 'many.holoml') {
      const n = Math.min(50_000, Math.max(0, Number(p.get('n') ?? '20000')));
      const groups = Array.from({ length: n }, (_, i) => `    <group position="${i % 100} 0 ${Math.floor(i / 100)}" />`).join('\n');
      res.writeHead(200, { 'content-type': TYPES['.holoml']!, 'cache-control': 'no-store' });
      res.end(
        `<holoml version="0.1">\n  <head>\n    <title>Many elements</title>\n  </head>\n  <scene>\n    <label id="first" position="0 2 0">First of many</label>\n${groups}\n  </scene>\n</holoml>\n`,
      );
      return;
    }
    res.writeHead(404).end();
    return;
  }
  if (path === '/favicon/declared-huge.png' || path === '/favicon/error-body.png') {
    const declared = path === '/favicon/declared-huge.png';
    res.writeHead(declared ? 200 : 500, {
      'content-type': 'image/png',
      'cache-control': 'no-store',
      ...(declared ? { 'content-length': String(10 * 1024 * 1024) } : {}),
    });
    const piece = Buffer.alloc(16 * 1024);
    const timer = setInterval(() => {
      if (res.destroyed) return;
      res.write(piece);
      c.sent.set(key, (c.sent.get(key) ?? 0) + piece.length);
    }, 20);
    res.on('close', () => clearInterval(timer));
    return;
  }
  if (path === '/favicon/huge-bytes.png') {
    const body = Buffer.concat([ICON_PNG, Buffer.alloc(2 * 1024 * 1024)]);
    res.writeHead(200, { 'content-type': 'image/png', 'content-length': String(body.length), 'cache-control': 'no-store' });
    res.end(body);
    return;
  }
  if (path === '/favicon/huge-stream.png') {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    let sent = 0;
    const piece = Buffer.alloc(64 * 1024);
    const pump = () => {
      while (sent < 2 * 1024 * 1024 && !res.destroyed) {
        sent += piece.length;
        if (!res.write(piece)) return void res.once('drain', pump);
      }
      if (!res.destroyed) res.end();
    };
    pump();
    return;
  }
  if (path === '/favicon/huge-dims.png') {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    res.end(pngClaiming(20000, 20000));
    return;
  }
  if (path === '/favicon/slow.png') {
    const ms = Math.min(30_000, Number(url.searchParams.get('ms') ?? '10000'));
    const t = setTimeout(() => {
      if (!res.destroyed) {
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
        res.end(ICON_PNG);
      }
    }, ms);
    res.on('close', () => clearTimeout(t));
    return;
  }
  if (path.startsWith('/filters/') || path.startsWith('/filters-failing/')) {
    if (path.startsWith('/filters-failing/') && path.endsWith('/easyprivacy.txt')) {
      res.writeHead(500, { 'content-type': 'text/plain' }).end('broken');
      return;
    }
    const body = path.endsWith('.json') ? '{"scriptlets":[],"redirects":[]}' : '! Title: test list\n||refreshed-tracker.test^\n';
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
    return;
  }
  if (path === '/dns-query') {
    // Echo the question back as an answer: the response bit set, no records.
    const q = Buffer.from((url.searchParams.get('dns') ?? '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (q.length >= 12) {
      q[2] = q[2]! | 0x80;
      q[3] = 0x83; // no such name
    }
    res.writeHead(200, { 'content-type': 'application/dns-message', 'cache-control': 'no-store' });
    res.end(q);
    return;
  }
  if (path === '/dns-portal') {
    res.writeHead(200, { 'content-type': TYPES['.html']!, 'cache-control': 'no-store' });
    res.end(page('Sign in to the Wi-Fi', '<h1>Sign in to continue</h1>'));
    return;
  }
  if (path === '/download/sample.txt') {
    const body = Buffer.from('HyperSol download test file\n');
    res.writeHead(200, {
      'content-type': 'text/plain',
      'content-disposition': 'attachment; filename="sample.txt"',
      'content-length': String(body.length),
      'cache-control': 'no-store',
    });
    res.end(body);
    return;
  }
  if (path === '/download/slow.bin') {
    const total = 2 * 1024 * 1024;
    res.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment; filename="slow.bin"',
      'content-length': String(total),
      'cache-control': 'no-store',
    });
    // The first pieces, then nothing until the check lets the rest go or
    // the client gives up. Sent against the clock (16 KB every 100 ms,
    // until 2026-09-30) the file finished by itself after 12.8 s, and a
    // check that needed it still running lost the race on a slow machine
    // (issue #10's check, on GitHub's Windows machines).
    const first = 64 * 1024;
    res.write(Buffer.alloc(first));
    const name = url.searchParams.get('gate') ?? 'slow.bin';
    const gate = c.gates.get(name) ?? { open: false, waiting: [] };
    c.gates.set(name, gate);
    const rest = () => {
      if (!res.destroyed) res.end(Buffer.alloc(total - first));
    };
    if (gate.open) rest();
    else gate.waiting.push(rest);
    return;
  }
  if (path === '/download/broken.bin') {
    res.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment; filename="broken.bin"',
      'content-length': String(1024 * 1024),
      'cache-control': 'no-store',
    });
    res.write(Buffer.alloc(8 * 1024));
    setTimeout(() => res.destroy(), 300);
    return;
  }
  if (path.startsWith('/ddm/')) {
    res.writeHead(200, { 'content-type': TYPES['.html']!, 'cache-control': 'no-store' });
    res.end(page('Ad landing', '<h1 id="landing">Ad landing page</h1>'));
    return;
  }
  if (path === '/slow') {
    const ms = Math.min(10_000, Number(url.searchParams.get('ms') ?? '1500'));
    setTimeout(() => {
      res.writeHead(200, { 'content-type': TYPES['.html']!, 'cache-control': 'no-store' });
      res.end(page('Slow page', '<h1>Slow page</h1><p>This answered late on purpose.</p>'));
    }, ms);
    return;
  }
  if (path === '/search') {
    const q = url.searchParams.get('q') ?? '';
    res.writeHead(200, { 'content-type': TYPES['.html']!, 'cache-control': 'no-store' });
    res.end(page(`Search: ${q}`, `<h1>Results for <span id="query">${escapeHtml(q)}</span></h1>`));
    return;
  }
  if (path === '/icon.png') {
    // Sizes declared, as most servers do (the instrument panel's data readout, milestone 7).
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store', 'content-length': String(ICON_PNG.length) });
    res.end(ICON_PNG);
    return;
  }
  const file = normalize(join(FIXTURES_DIR, path));
  if (!file.startsWith(normalize(FIXTURES_DIR)) || file.endsWith(sep) || !TYPES[extname(file)]) {
    res.writeHead(404).end();
    return;
  }
  readFile(file).then(
    (body) => {
      res.writeHead(200, { 'content-type': TYPES[extname(file)]!, 'cache-control': 'no-store', 'content-length': String(body.length) });
      res.end(body);
    },
    () => res.writeHead(404).end(),
  );
}

interface Counters {
  hits: Map<string, number>;
  aborted: Map<string, number>;
  maxOpen: Map<string, number>;
  openNow: Map<string, number>;
  sent: Map<string, number>;
  gates: Map<string, Gate>;
}

async function listen(
  server: Server,
  scheme: 'http' | 'https',
  counters: Counters,
  cleanup?: () => void,
  requestedPort = 0,
): Promise<FixtureServer> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  const base = `${scheme}://127.0.0.1:${port}/`;
  return {
    base,
    hits: counters.hits,
    aborted: counters.aborted,
    maxOpen: counters.maxOpen,
    openNow: counters.openNow,
    sent: counters.sent,
    release: (name) => {
      const gate = counters.gates.get(name) ?? { open: false, waiting: [] };
      counters.gates.set(name, gate);
      gate.open = true;
      for (const send of gate.waiting.splice(0)) send();
    },
    url: (file) => base + file,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          cleanup?.();
          resolve();
        });
        // Drop keep-alive sockets so no later request can still be served.
        server.closeAllConnections();
      }),
  };
}

/** Serves the fixtures on 127.0.0.1, at a random free port unless one is given. */
function counters(): Counters {
  return { hits: new Map(), aborted: new Map(), maxOpen: new Map(), openNow: new Map(), sent: new Map(), gates: new Map() };
}

export function startFixtureServer(port = 0): Promise<FixtureServer> {
  const c = counters();
  return listen(createServer((req, res) => handler(req, res, c)), 'http', c, undefined, port);
}

function findOpenssl(): string {
  const candidates = [
    'openssl',
    'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
  ];
  for (const c of candidates) {
    try {
      execFileSync(c, ['version'], { stdio: 'ignore' });
      return c;
    } catch {
      // Next one.
    }
  }
  throw new Error('The certificate-error check needs openssl on PATH (Git for Windows includes one).');
}

/**
 * Serves the fixtures over HTTPS with a self-signed certificate made for
 * this run and deleted afterwards. Chromium does not trust it, which is
 * the point: it produces a certificate error.
 */
export function startHttpsFixtureServer(): Promise<FixtureServer> {
  const dir = mkdtempSync(join(tmpdir(), 'hypersol-tls-'));
  const key = join(dir, 'key.pem');
  const cert = join(dir, 'cert.pem');
  execFileSync(
    findOpenssl(),
    ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=127.0.0.1'],
    { stdio: 'ignore' },
  );
  if (!existsSync(cert)) throw new Error('openssl did not produce a certificate');
  const c = counters();
  const server = createHttpsServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) =>
    handler(req, res, c),
  );
  return listen(server as unknown as Server, 'https', c, () => rmSync(dir, { recursive: true, force: true }));
}
