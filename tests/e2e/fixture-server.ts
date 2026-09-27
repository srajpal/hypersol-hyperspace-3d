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
};

/** A solid-colour 16×16 PNG, built here so the fixture has no binary file. */
function makePng(r: number, g: number, b: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const size = 16;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [r, g, b]).flat())]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: size }, () => row)));
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
}

/** A PNG header claiming a size, for the favicon dimension limit (not decodable). */
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
 *   /download/slow.bin         2 MB sent slowly as an attachment (to cancel)
 *   /download/broken.bin       an attachment whose connection breaks part way (a failed download)
 *   /holoml/by-type            holoml/still.holoml, known only by its media type (no .holoml in the address)
 *   /holoml/as-text.holoml     holoml/second.holoml sent as text/plain, known only by its address
 */
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
    let sent = 0;
    const piece = Buffer.alloc(16 * 1024);
    const timer = setInterval(() => {
      if (res.destroyed || sent >= total) {
        clearInterval(timer);
        if (!res.destroyed) res.end();
        return;
      }
      sent += piece.length;
      res.write(piece);
    }, 100);
    res.on('close', () => clearInterval(timer));
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
    ...counters,
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
  return { hits: new Map(), aborted: new Map(), maxOpen: new Map(), openNow: new Map(), sent: new Map() };
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
