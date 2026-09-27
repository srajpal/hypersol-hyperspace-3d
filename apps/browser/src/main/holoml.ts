/**
 * HoloML pages (milestone 14; owner, prompt 65).
 *
 * A HoloML page is a text document. When a tab loads one (a `.holoml`
 * address, or the `model/vnd.holoml` media type), its response headers are
 * changed so that Chromium shows it as plain text, with a content policy
 * that lets in only the browser's HoloML viewer script and loads from the
 * page's own site (Q2 a). The page preload then hands the text to the
 * viewer, which draws the scene inside the tab's own sandboxed page
 * process: nothing from the page runs in the browser's privileged
 * processes, and the page keeps its own address everywhere.
 *
 * HoloML files on the computer (Q3 a) are served from an address with a
 * random name for their folder, made when the person opens a file (Ctrl+O,
 * the menu, or dropping it on the window); only that folder and the
 * folders inside it can be read, and only for this run of the browser.
 */
import { ipcMain, net, type Session } from 'electron';
import { randomBytes } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOLOML_DOCUMENT_CHANNEL, LOCAL_SCHEME, VIEWER_SCHEME } from '../shared/holoml-page';

export const HOLOML_MEDIA_TYPE = 'model/vnd.holoml';

/**
 * The content policy of every HoloML page: only the viewer's script, and
 * data from the page's own site (data: and blob: are the viewer's own).
 */
export const HOLOML_CSP = [
  "default-src 'none'",
  // The viewer, and (HoloML 0.2) the page's own scripts from its own site.
  `script-src ${VIEWER_SCHEME}: 'self'`,
  "connect-src 'self' data: blob:",
  "img-src 'self' data: blob:",
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ');

type Headers = Record<string, string | string[]>;

export interface ResponseInfo {
  url: string;
  resourceType: string;
  statusCode: number;
  responseHeaders?: Headers;
}

function header(headers: Headers | undefined, name: string): string {
  if (!headers) return '';
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  const value = key === undefined ? undefined : headers[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/** Is this response a HoloML page for a tab's main frame? */
export function isHolomlResponse(d: ResponseInfo): boolean {
  // 304: a page checked again against the cache keeps HoloML's headers.
  if (d.resourceType !== 'mainFrame' || ((d.statusCode < 200 || d.statusCode > 299) && d.statusCode !== 304)) return false;
  const type = header(d.responseHeaders, 'content-type').split(';')[0]!.trim().toLowerCase();
  if (type === HOLOML_MEDIA_TYPE) return true;
  try {
    return new URL(d.url).pathname.toLowerCase().endsWith('.holoml');
  } catch {
    return false;
  }
}

const REPLACED = new Set([
  'content-type',
  'content-disposition',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-content-type-options',
  'x-frame-options',
]);

/** A HoloML page's headers: shown as UTF-8 text, under HoloML's content policy. */
export function holomlHeaders(headers: Headers | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(headers ?? {})) if (!REPLACED.has(k.toLowerCase())) out[k] = Array.isArray(v) ? v : [v];
  out['Content-Type'] = ['text/plain; charset=utf-8'];
  out['Content-Security-Policy'] = [HOLOML_CSP];
  out['X-Content-Type-Options'] = ['nosniff'];
  return out;
}

/** The address without its fragment, as documents are compared. */
function withoutHash(url: string): string {
  const i = url.indexOf('#');
  return i < 0 ? url : url.slice(0, i);
}

/** What local HoloML folders may serve, by extension. */
const LOCAL_TYPES: Record<string, string> = {
  '.holoml': 'text/plain; charset=utf-8',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  // HoloML 0.2 (milestone 17): scripts and sounds next to the page.
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

export interface HolomlOptions {
  /** The built viewer's files (out/renderer), or null in development runs. */
  viewerFiles: string | null;
  /** Development runs: the renderer's dev server, which serves the viewer. */
  devServer?: string;
  /** Development runs: the viewer's entry file on disk (src/viewer/main.ts), which the dev server serves by its path. */
  viewerSource?: string;
}

export class HolomlPages {
  /** Each tab's HoloML document, by its page's id: the address it was served at. */
  private readonly documents = new Map<number, string>();
  /** Local folders opened this run, by the random name in their address. */
  private readonly folders = new Map<string, string>();

  constructor(private readonly options: HolomlOptions) {}

  /**
   * Called by the shield's onHeadersReceived for every response (Electron
   * allows one listener per session): marks HoloML pages and gives them
   * HoloML's headers, on top of whatever the shield decided.
   */
  adjust(details: ResponseInfo & { webContentsId?: number }, response: { cancel?: boolean; responseHeaders?: Headers }): typeof response {
    if (response.cancel || details.resourceType !== 'mainFrame') return response;
    const tab = details.webContentsId;
    if (!isHolomlResponse({ ...details, responseHeaders: response.responseHeaders ?? details.responseHeaders })) {
      if (tab !== undefined && details.statusCode >= 200 && details.statusCode <= 299) this.documents.delete(tab);
      return response;
    }
    if (tab !== undefined) this.documents.set(tab, withoutHash(details.url));
    return { ...response, responseHeaders: holomlHeaders(response.responseHeaders ?? details.responseHeaders) };
  }

  /** Is this tab's document at this address a HoloML page? */
  isDocument(webContentsId: number, url: string): boolean {
    if (url.startsWith(`${LOCAL_SCHEME}:`)) return this.localFile(url) !== null && extname(new URL(url).pathname).toLowerCase() === '.holoml';
    return this.documents.get(webContentsId) === withoutHash(url);
  }

  forget(webContentsId: number): void {
    this.documents.delete(webContentsId);
  }

  /** Answers the page preload's question, for the page asking only. */
  wire(): void {
    ipcMain.on(HOLOML_DOCUMENT_CHANNEL, (event, url: unknown) => {
      event.returnValue = typeof url === 'string' && event.sender.getType() === 'webview' ? this.isDocument(event.sender.id, url) : false;
    });
  }

  /** The viewer's script and the local HoloML folders, in a web pages' session. */
  register(ses: Session): void {
    ses.protocol.handle(VIEWER_SCHEME, (request) => this.serveViewer(request));
    ses.protocol.handle(LOCAL_SCHEME, (request) => this.serveLocal(request));
  }

  private async serveViewer(request: Request): Promise<Response> {
    const { pathname, search } = new URL(request.url);
    const headers = {
      'content-type': 'text/javascript; charset=utf-8',
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
      'cache-control': 'no-cache',
    };
    if (this.options.viewerFiles === null) {
      // Development runs: the dev server serves the viewer as modules, and
      // every module it imports (its own files, Three.js) comes through
      // here too, by the dev server's own paths. The entry is the source
      // file by its place on disk (/@fs/...): the dev server's root is the
      // shell's folder, not the viewer's (found in milestone 16: it
      // answered its HTML page, and HoloML pages stayed blank in pnpm dev).
      const { devServer, viewerSource } = this.options;
      if (!devServer || !viewerSource) return new Response('Not found', { status: 404 });
      const path = pathname === '/assets/viewer.js' ? `/@fs/${viewerSource.replace(/\\/g, '/').replace(/^\/+/, '')}` : pathname;
      const res = await net.fetch(new URL(path + search, devServer).href);
      const type = res.headers.get('content-type') ?? '';
      if (!/javascript/.test(type)) return new Response('Not found', { status: 404 });
      return new Response(res.body, { status: res.status, headers });
    }
    // Only the viewer's scripts: other files of the browser are not served.
    if (!/^\/assets\/[\w.-]+\.js$/.test(pathname)) return new Response('Not found', { status: 404 });
    try {
      const body = await readFile(join(this.options.viewerFiles, pathname));
      return new Response(body, { headers });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  }

  /**
   * Opens a HoloML file from the computer: its folder may be read from its
   * address for the rest of this run. Returns the address, or null if the
   * path is not a readable .holoml file.
   */
  async openFile(path: string): Promise<string | null> {
    if (extname(path).toLowerCase() !== '.holoml') return null;
    let real: string;
    try {
      real = await realpath(path);
      if (!(await stat(real)).isFile()) return null;
    } catch {
      return null;
    }
    const folder = dirname(real);
    let name = [...this.folders].find(([, f]) => f === folder)?.[0];
    if (!name) {
      name = randomBytes(8).toString('hex');
      this.folders.set(name, folder);
    }
    return `${LOCAL_SCHEME}://${name}/${encodeURIComponent(basename(real))}`;
  }

  /** The file a local address stands for, if it is inside its opened folder. */
  private localFile(url: string): { folder: string; path: string } | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    const folder = this.folders.get(parsed.host);
    if (!folder || parsed.protocol !== `${LOCAL_SCHEME}:`) return null;
    let rel: string;
    try {
      rel = decodeURIComponent(parsed.pathname);
    } catch {
      return null;
    }
    const path = resolve(folder, `.${rel}`);
    return path === folder || path.startsWith(folder + sep) ? { folder, path } : null;
  }

  private async serveLocal(request: Request): Promise<Response> {
    const file = this.localFile(request.url);
    const common = { 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' };
    if (!file) {
      // An address from an earlier run (its folder's name is new each run), or a made-up one.
      return new Response(
        '<!doctype html><title>Open the file again</title><p>This HoloML file was opened in an earlier session. Open it again with Ctrl+O (or the menu\'s "Open a file"), or drop it on the window.</p>',
        { status: 404, headers: { ...common, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'" } },
      );
    }
    const type = LOCAL_TYPES[extname(file.path).toLowerCase()];
    if (!type) return new Response('Not found', { status: 404, headers: common });
    try {
      // A link inside the folder must not lead outside it.
      const real = await realpath(file.path);
      if (real !== file.folder && !real.startsWith(file.folder + sep)) return new Response('Not found', { status: 404, headers: common });
      const res = await net.fetch(pathToFileURL(real).href);
      const headers: Record<string, string> = { ...common, 'content-type': type };
      if (type.startsWith('text/plain')) headers['content-security-policy'] = HOLOML_CSP;
      return new Response(res.body, { status: 200, headers });
    } catch {
      return new Response('Not found', { status: 404, headers: common });
    }
  }
}
