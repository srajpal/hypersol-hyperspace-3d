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
 * A file opened from a folder that holds many unrelated files (Downloads,
 * the desktop, Documents, the home folder, a drive's root) gets the files
 * beside it only, not the folders inside (review of 2026-09-30, M6): a
 * page saved into Downloads must not be able to read everything there.
 *
 * A site's own defences stay (review of 2026-09-30, V1). An answer the
 * site marked as a download, or sandboxed, is not a HoloML page and is
 * left exactly as sent; a HoloML page keeps the site's own content
 * policies, with HoloML's added as one more.
 */
import { ipcMain, net, type Session, type WebContents } from 'electron';
import { randomBytes } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import nodePath, { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOLOML_DOCUMENT_CHANNEL, LOCAL_SCHEME, VIEWER_SCHEME } from '../shared/holoml-page';

export const HOLOML_MEDIA_TYPE = 'model/vnd.holoml';

/**
 * The content policy of every HoloML page: only the viewer's script, and
 * data from the page's own site (data: and blob: are the viewer's own).
 * Milestone 25 (compressed models): WebAssembly, the decoders' workers
 * (made from blob: addresses), and the decoders' files from the viewer's
 * address. A page's own scripts could start workers and compile
 * WebAssembly too: that is no more than they can do in the page already.
 */
export const HOLOML_CSP = [
  "default-src 'none'",
  // The viewer, and (HoloML 0.2) the page's own scripts from its own site; WebAssembly for the decoders.
  `script-src ${VIEWER_SCHEME}: 'self' 'wasm-unsafe-eval'`,
  "worker-src blob:",
  `connect-src 'self' data: blob: ${VIEWER_SCHEME}:`,
  // The KTX2 transcoder's host (milestone 25), unseen in the page.
  `frame-src ${VIEWER_SCHEME}:`,
  "img-src 'self' data: blob:",
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
  // No peer connections: they would be a way out for what a page's script can read.
  "webrtc 'block'",
].join('; ');

/**
 * The content policy of the KTX2 transcoder's host (milestone 25; owner,
 * prompt 170): a page of the viewer's address that HoloML pages frame,
 * where the Basis transcoder may evaluate code (as Emscripten's builds
 * do) in its workers; HoloML pages themselves stay without it. It runs
 * only the viewer's scripts, reads only the viewer's files, and holds
 * nothing of any page.
 */
export const KTX2_HOST_CSP = [
  "default-src 'none'",
  `script-src ${VIEWER_SCHEME}: blob: 'unsafe-eval' 'wasm-unsafe-eval'`,
  "worker-src blob:",
  `connect-src ${VIEWER_SCHEME}: blob: data:`,
  `frame-ancestors http: https: ${VIEWER_SCHEME}: ${LOCAL_SCHEME}:`,
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** The transcoder's host page: it only loads its script. */
const KTX2_HOST_PAGE = '<!doctype html><meta charset="utf-8"><title>KTX2 picture decoder</title><script type="module" src="assets/ktx2-host.js"></script>';

type Headers = Record<string, string | string[]>;

export interface ResponseInfo {
  url: string;
  resourceType: string;
  statusCode: number;
  responseHeaders?: Headers;
}

/** Every value of a header, whatever the case of its name. */
function headerValues(headers: Headers | undefined, name: string): string[] {
  return Object.entries(headers ?? {})
    .filter(([k]) => k.toLowerCase() === name)
    .flatMap(([, v]) => (Array.isArray(v) ? v : [v]));
}

/** Does any of these content policies (several may share one header, between commas) have a sandbox directive? */
function hasSandbox(policies: string[]): boolean {
  return policies.some((value) => value.split(',').some((policy) => policy.split(';').some((directive) => /^sandbox(\s|$)/i.test(directive.trim()))));
}

/** Is this response a HoloML page for a tab's main frame? */
export function isHolomlResponse(d: ResponseInfo): boolean {
  // 304: a page checked again against the cache keeps HoloML's headers.
  if (d.resourceType !== 'mainFrame' || ((d.statusCode < 200 || d.statusCode > 299) && d.statusCode !== 304)) return false;
  // What the site sends to be saved, not shown, is a download; what it sandboxes must not
  // run in its origin. A site that takes uploads makes them safe in exactly these two ways.
  if (headerValues(d.responseHeaders, 'content-disposition').some((v) => /^\s*attachment(\s|;|$)/i.test(v))) return false;
  if (hasSandbox(headerValues(d.responseHeaders, 'content-security-policy'))) return false;
  const type = (headerValues(d.responseHeaders, 'content-type')[0] ?? '').split(';')[0]!.trim().toLowerCase();
  if (type === HOLOML_MEDIA_TYPE) return true;
  try {
    return new URL(d.url).pathname.toLowerCase().endsWith('.holoml');
  } catch {
    return false;
  }
}

const REPLACED = new Set(['content-type', 'x-content-type-options']);

/**
 * A HoloML page's headers: shown as UTF-8 text, under HoloML's content
 * policy. Everything else the site sent stays, its own content policies
 * and frame options among them: HoloML's policy is one more, and a page
 * must satisfy every one.
 */
export function holomlHeaders(headers: Headers | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const policies: string[] = [];
  for (const [k, v] of Object.entries(headers ?? {})) {
    const values = Array.isArray(v) ? v : [v];
    if (k.toLowerCase() === 'content-security-policy') policies.push(...values);
    else if (!REPLACED.has(k.toLowerCase())) out[k] = values;
  }
  out['Content-Type'] = ['text/plain; charset=utf-8'];
  out['Content-Security-Policy'] = [...policies, HOLOML_CSP];
  out['X-Content-Type-Options'] = ['nosniff'];
  return out;
}

/** The parts of node:path used below: this system's rules, or (in the unit tests) Windows' or POSIX's by name. */
export type PathRules = Pick<typeof nodePath, 'relative' | 'isAbsolute' | 'dirname' | 'sep'>;

/**
 * Is a file inside an opened folder? With `inner` false only the
 * folder's own files count, not those of the folders inside it. Works
 * for a folder that is a drive's or the file system's root, which
 * comparing text with a separator added did not (review of 2026-09-30).
 */
export function isInsideFolder(folder: string, file: string, inner: boolean, p: PathRules = nodePath): boolean {
  const rel = p.relative(folder, file);
  if (rel === '') return true;
  if (rel === '..' || rel.startsWith(`..${p.sep}`) || p.isAbsolute(rel)) return false;
  return inner || !rel.includes(p.sep);
}

/**
 * Is this a folder that holds many unrelated files: a drive's or the file
 * system's root, or one of the named ones (Downloads, the desktop,
 * Documents, the home folder)?
 */
export function isSharedFolder(folder: string, shared: readonly string[], p: PathRules = nodePath): boolean {
  return p.dirname(folder) === folder || shared.some((s) => p.relative(s, folder) === '');
}

/** Said once in the console of a page opened from a shared folder. */
export const SHARED_FOLDER_NOTE =
  'HoloML: this page was opened from a folder that holds other files too (Downloads, the desktop, Documents, your home folder, or a drive), ' +
  'so it can load the files beside it, but not files in the folders inside that folder. ' +
  'To use those, put the page and its files in a folder of their own.';

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
  // HoloML 0.2 (milestones 18 and 19): panoramas of the surroundings and the sky.
  '.hdr': 'image/vnd.radiance',
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
  /** Folders that hold many unrelated files (Downloads, the desktop, Documents, the home folder): see isSharedFolder. */
  sharedFolders?: readonly string[];
}

/** A folder opened this run. */
interface OpenedFolder {
  folder: string;
  /** The folders inside it may be read too (not for a shared folder). */
  inner: boolean;
}

export class HolomlPages {
  /** Each tab's HoloML document, by its page's id: the address it was served at. */
  private readonly documents = new Map<number, string>();
  /** Local folders opened this run, by the random name in their address. */
  private readonly folders = new Map<string, OpenedFolder>();
  /** The shared folders as the file system names them, found at the first opened file. */
  private shared: Promise<string[]> | null = null;

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
    if (url.startsWith(`${LOCAL_SCHEME}:`)) return this.localFile(url)?.inside === true && extname(new URL(url).pathname).toLowerCase() === '.holoml';
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
    // The KTX2 transcoder's host (milestone 25): its page, with a policy of its own.
    if (pathname === '/ktx2-host.html') {
      return new Response(KTX2_HOST_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': KTX2_HOST_CSP, 'cache-control': 'no-cache' } });
    }
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
      const source = (file: string) => `/@fs/${file.replace(/\\/g, '/').replace(/^\/+/, '')}`;
      const path =
        pathname === '/assets/viewer.js'
          ? source(viewerSource)
          : pathname === '/assets/ktx2-host.js'
            ? source(join(dirname(viewerSource), 'ktx2-host.ts'))
            : pathname;
      const res = await net.fetch(new URL(path + search, devServer).href);
      const type = res.headers.get('content-type') ?? '';
      // Scripts, and (milestone 25) the decoders' WebAssembly.
      if (!/javascript|wasm/.test(type) && !/\.wasm(?:\?|$)/.test(path)) return new Response('Not found', { status: 404 });
      return new Response(res.body, { status: res.status, headers: /wasm/.test(type) || /\.wasm(?:\?|$)/.test(path) ? { ...headers, 'content-type': 'application/wasm' } : headers });
    }
    // Only the viewer's scripts and (milestone 25) its decoders' WebAssembly: other files of the browser are not served.
    if (!/^\/assets\/[\w.-]+\.(?:js|wasm)$/.test(pathname)) return new Response('Not found', { status: 404 });
    try {
      const body = await readFile(join(this.options.viewerFiles, pathname));
      return new Response(body, { headers: pathname.endsWith('.wasm') ? { ...headers, 'content-type': 'application/wasm' } : headers });
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
    let name = [...this.folders].find(([, f]) => f.folder === folder)?.[0];
    if (!name) {
      this.shared ??= Promise.all((this.options.sharedFolders ?? []).map((f) => realpath(f).catch(() => f)));
      name = randomBytes(8).toString('hex');
      this.folders.set(name, { folder, inner: !isSharedFolder(folder, await this.shared) });
    }
    return `${LOCAL_SCHEME}://${name}/${encodeURIComponent(basename(real))}`;
  }

  /**
   * Watches a tab: a page opened from a shared folder is told, once for
   * each page, in its console, why files in the folders inside are not
   * found.
   */
  track(contents: WebContents): void {
    contents.on('did-navigate', (_event, url) => {
      const file = url.startsWith(`${LOCAL_SCHEME}:`) ? this.localFile(url) : null;
      if (!file || file.inner || !file.inside) return;
      contents.executeJavaScript(`console.info(${JSON.stringify(SHARED_FOLDER_NOTE)})`).catch(() => undefined);
    });
  }

  /** The file a local address stands for in a folder opened this run, and whether it is one the folder may serve. */
  private localFile(url: string): (OpenedFolder & { path: string; inside: boolean }) | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    const opened = this.folders.get(parsed.host);
    if (!opened || parsed.protocol !== `${LOCAL_SCHEME}:`) return null;
    let rel: string;
    try {
      rel = decodeURIComponent(parsed.pathname);
    } catch {
      return null;
    }
    const file = resolve(opened.folder, `.${rel}`);
    return { ...opened, path: file, inside: isInsideFolder(opened.folder, file, opened.inner) };
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
    if (!type || !file.inside) return new Response('Not found', { status: 404, headers: common });
    try {
      // A link inside the folder must not lead outside it (or, in a shared folder, into a folder inside it).
      const real = await realpath(file.path);
      if (!isInsideFolder(file.folder, real, file.inner)) return new Response('Not found', { status: 404, headers: common });
      const res = await net.fetch(pathToFileURL(real).href);
      const headers: Record<string, string> = { ...common, 'content-type': type };
      if (type.startsWith('text/plain')) headers['content-security-policy'] = HOLOML_CSP;
      return new Response(res.body, { status: 200, headers });
    } catch {
      return new Response('Not found', { status: 404, headers: common });
    }
  }
}
