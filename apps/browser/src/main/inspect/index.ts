import { app, webContents, type IpcMainInvokeEvent, type Session, type WebContents } from 'electron';
import {
  parseInspectRequest,
  type BrowserReadout,
  type ConsoleLevel,
  type InspectOp,
  type InspectReply,
  type InspectRequest,
  type InspectSnapshot,
  parseSceneReadout,
  type SceneReadout,
} from '../../shared/inspect';
import { HOLOML_COMMAND_CHANNEL } from '../../shared/holoml-page';
import { declaredBytes, PageMonitor } from './monitor';

/** Chromium's own certificate verdict, passed through unchanged (setCertificateVerifyProc). */
const USE_CHROMIUM_RESULT = -3;

/** Chromium's code for a load that was given up: stopped, replaced, or turned into a download. */
const ERR_ABORTED = -3;

const LEVELS: readonly ConsoleLevel[] = ['debug', 'info', 'warning', 'error'];

export interface InspectorOptions {
  /** Is this page a HoloML page, marked by the main process (milestone 15)? Only those are asked for a scene. */
  isHolomlPage?(contents: WebContents): boolean;
  /** Test mode only (main/launch-options.ts): one certificate trusted by its fingerprint, the HTTPS fixture's (milestone 26). */
  testTrustedCertificate?: string;
}

/**
 * The instrument panel's side of the main process (milestone 7). It
 * listens to what the browser already sees for its web pages (request
 * completions and failures on the session, console messages, the
 * certificates Chromium checks, process metrics) and answers the shell.
 * Nothing is stored on disk or sent anywhere.
 */
export class Inspector {
  readonly monitor = new PageMonitor();
  private readonly tabs = new Set<number>();
  private readonly privateTabs = new Set<number>();
  private privateSession: Session | null = null;
  private lastPage = new Map<number, number>();

  constructor(
    private readonly ses: Session,
    private readonly options: InspectorOptions,
  ) {}

  start(): void {
    this.watch(this.ses);
  }

  /** The private tabs' session: what is recorded for it is kept apart. */
  setPrivateSession(ses: Session): void {
    this.privateSession = ses;
  }

  /** The last private tab closed. */
  forgetPrivate(): void {
    this.monitor.forgetPrivateCerts();
  }

  /** Listens to one session's web pages (the default one, and the private tabs' one). */
  watch(ses: Session): void {
    const isPrivate = () => this.privateSession !== null && ses === this.privateSession;
    ses.webRequest.onCompleted({ urls: ['<all_urls>'] }, (d) => {
      if (d.webContentsId === undefined || !this.tabs.has(d.webContentsId)) return;
      this.monitor.completed(d.webContentsId, d.id, d.statusCode, declaredBytes(d.responseHeaders), d.fromCache, d.timestamp);
    });
    ses.webRequest.onErrorOccurred({ urls: ['<all_urls>'] }, (d) => {
      if (d.webContentsId === undefined || !this.tabs.has(d.webContentsId)) return;
      this.monitor.failed(d.webContentsId, d.id, d.error, d.timestamp);
    });
    // Records each certificate Chromium checks; the verdict stays Chromium's (in a test run, the fixture's own
    // certificate, named by its fingerprint, is trusted too).
    ses.setCertificateVerifyProc((request, callback) => {
      const c = request.certificate;
      this.monitor.certificate({
        host: request.hostname,
        subject: c.subject?.commonName || c.subjectName,
        issuer: c.issuer?.commonName || c.issuerName,
        validExpiry: c.validExpiry,
        verification: request.verificationResult,
      }, isPrivate());
      const trusted = this.options.testTrustedCertificate;
      callback(trusted !== undefined && c.fingerprint === trusted ? 0 : USE_CHROMIUM_RESULT);
    });
  }

  /** A web request from a tab is starting (from the session's one before-request listener, main/privacy). */
  requestStarted(tab: number, details: { id: number; url: string; resourceType: string; method: string; timestamp: number }): void {
    if (!this.tabs.has(tab)) return;
    this.monitor.request(tab, details.id, details.url, details.resourceType, details.method, details.timestamp);
  }

  trackTab(contents: WebContents): void {
    const id = contents.id;
    this.tabs.add(id);
    if (this.privateSession !== null && contents.session === this.privateSession) this.privateTabs.add(id);
    contents.on('did-navigate', (_event, url) => this.monitor.pageCommitted(id, url, Date.now()));
    // A page that failed to load: the tab shows its error card, so the readouts are that page's
    // (its certificate, say). A load given up or turned into a download is not a failure.
    contents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
      if (isMainFrame && code !== ERR_ABORTED) this.monitor.pageCommitted(id, url, Date.now());
    });
    contents.on('did-stop-loading', () => this.monitor.pageFinished(id, Date.now()));
    contents.on('console-message', (event) => {
      const level = LEVELS.includes(event.level) ? event.level : 'info';
      this.monitor.console(id, level, event.message, event.sourceId, event.lineNumber, Date.now());
    });
    contents.once('destroyed', () => {
      this.tabs.delete(id);
      this.privateTabs.delete(id);
      this.monitor.forget(id);
      this.lastPage.delete(id);
    });
  }

  /** Answers one request from the shell (registered with handleFromShell, main/ipc.ts). Never throws. */
  async handle(event: IpcMainInvokeEvent, raw: unknown): Promise<InspectReply<InspectOp>> {
    const parsed = parseInspectRequest(raw);
    if ('error' in parsed) return { ok: false, error: parsed.error };
    try {
      const r = parsed.request;
      if (r.op === 'inspect.scene' || r.op === 'inspect.scene-select' || r.op === 'inspect.scene-pick') {
        return { ok: true, value: await this.scene(event.sender, r) } as InspectReply<InspectOp>;
      }
      return { ok: true, value: this.run(event.sender, r) } as InspectReply<InspectOp>;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * The instrument panel's Scene part (milestone 15, GitHub issue #28):
   * the HoloML viewer's facts, read only from pages the main process
   * marked as HoloML, and checked field by field (parseSceneReadout).
   * Choosing a thing and picking go to the page's preload as commands,
   * which hands them to the viewer over its private line: nothing on the
   * page's window acts for the inspector, so a page's script has nothing
   * there to call or to replace (review 134, D12).
   */
  private async scene(shell: WebContents, r: Extract<InspectRequest, { op: 'inspect.scene' | 'inspect.scene-select' | 'inspect.scene-pick' }>): Promise<SceneReadout | null> {
    const contents = webContents.fromId(r.tab);
    if (!contents || !this.tabs.has(r.tab) || contents.hostWebContents !== shell) throw new Error('Not one of your tabs');
    if (!this.options.isHolomlPage?.(contents)) return null;
    if (r.op !== 'inspect.scene') {
      contents.send(HOLOML_COMMAND_CHANNEL, r.op === 'inspect.scene-select' ? `select:${r.index}` : r.on ? 'pick-on' : 'pick-off');
      return null;
    }
    const raw: unknown = await contents.executeJavaScript('window.__holoml ? window.__holoml.scene() : null', false).catch(() => null);
    return parseSceneReadout(raw);
  }

  private run(shell: WebContents, r: InspectRequest): unknown {
    const contents = webContents.fromId(r.tab);
    if (!contents || !this.tabs.has(r.tab) || contents.hostWebContents !== shell) throw new Error('Not one of your tabs');
    switch (r.op) {
      case 'inspect.snapshot':
        return this.snapshot(contents, r.sinceNet, r.sinceConsole);
      case 'inspect.clear-console':
        this.monitor.clearConsole(r.tab);
        return null;
      case 'inspect.devtools':
        contents.openDevTools({ mode: 'detach' });
        return null;
    }
  }

  private snapshot(contents: WebContents, sinceNet: number, sinceConsole: number): InspectSnapshot {
    const id = contents.id;
    const known = this.lastPage.get(id);
    const s = this.monitor.snapshot(id, sinceNet, sinceConsole, this.privateTabs.has(id));
    // A new page since the shell last asked: the shell starts its lists afresh.
    // (Numbers keep rising across pages, so the new page's entries are all included.)
    const reset = known !== undefined && known !== s.pageNumber;
    const fresh = s;
    this.lastPage.set(id, s.pageNumber);
    const metrics = app.getAppMetrics();
    const pid = contents.getOSProcessId();
    const own = metrics.find((m) => m.pid === pid);
    const browser: BrowserReadout = {
      memoryKB: metrics.reduce((sum, m) => sum + (m.memory?.workingSetSize ?? 0), 0),
      processes: metrics.length,
      cpuPercent: Math.round(metrics.reduce((sum, m) => sum + (m.cpu?.percentCPUUsage ?? 0), 0) * 10) / 10,
      uptime: Math.round(process.uptime()),
    };
    return {
      page: {
        ...fresh.page,
        cpuPercent: Math.round((own?.cpu?.percentCPUUsage ?? 0) * 10) / 10,
        memoryKB: own?.memory?.workingSetSize ?? 0,
      },
      net: fresh.net,
      console: fresh.console,
      reset,
      browser,
    };
  }
}
