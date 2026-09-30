import { webContents as allContents, type IpcMainInvokeEvent, type Session, type WebContents } from 'electron';
import type { ShellCommand } from '../shared/commands';
import {
  PERMISSION_KINDS,
  decide,
  mediaKinds,
  originOf,
  parsePermissionRequest,
  type PermissionKind,
  type PermissionRequest,
  type PermissionState,
  type PromptAnswer,
  type SiteChoices,
  type SitePermissions,
} from '../shared/permissions';

export interface PermissionDeps {
  isPrivate(contents: WebContents): boolean;
  /** Remembered choices for normal tabs (settings.json). */
  saved(): Record<string, SiteChoices>;
  save(sites: Record<string, SiteChoices>): void;
  /** Sends a command to the shell that hosts a page. */
  send(contents: WebContents, command: ShellCommand): void;
}

interface Pending {
  id: number;
  contents: WebContents;
  origin: string;
  kinds: PermissionKind[];
  callback: (granted: boolean) => void;
}

/**
 * What a page may do without asking (review of 2026-09-30, M1), by
 * Electron's name: put text on the clipboard. It tells the page nothing
 * about the person or the computer, ordinary pages need it (a "Copy"
 * button), and Chromium itself allows it only during a real click or key
 * press. Every other name, known or not, is refused unless it is asked
 * for with a prompt (the camera, the microphone, the location).
 *
 * Filling the screen and holding the pointer ('fullscreen' and
 * 'pointerLock') are not here: a page in full screen can draw what looks
 * like the browser's own top bar, and one that holds the pointer can keep
 * it, and the browser has no notice yet that says so and how to leave.
 * Until it has, both are refused, as they have been since milestone 9.
 */
export const ALLOWED_WITHOUT_ASKING: ReadonlySet<string> = new Set(['clipboard-sanitized-write']);

/** What one tab's page may use: "this time" grants and what it was given (the marker). */
interface TabGrants {
  origin: string;
  once: Set<PermissionKind>;
  given: Set<PermissionKind>;
}

/**
 * Site permissions (milestone 9): the camera, the microphone, and your
 * location, asked with a prompt in the shell (Allow, Allow this time,
 * Block: owner, prompt 45, Q2 a). Allow and Block are remembered per
 * origin, in settings.json for normal tabs and in memory for private tabs
 * (forgotten with the last private tab, as GitHub issue #8). "This time"
 * lasts until the tab leaves the site or closes. Every other permission
 * is refused, to a page that asks and to one that only looks (a page
 * that never asked reads "denied" for notifications, and nothing as
 * "granted"), except what is in ALLOWED_WITHOUT_ASKING. Only web pages
 * (webviews) are ever asked about.
 */
export class Permissions {
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private readonly tabs = new Map<WebContents, TabGrants>();
  private readonly privateChoices = new Map<string, SiteChoices>();
  /** Pages being reloaded to end their capture (revoke). */
  private readonly ending = new WeakSet<WebContents>();

  constructor(private readonly deps: PermissionDeps) {}

  /** Puts the handlers on a session (the default one and the private one). */
  protect(session: Session): void {
    session.setPermissionRequestHandler((contents, permission, callback, details) => {
      if (ALLOWED_WITHOUT_ASKING.has(permission)) {
        callback(true);
        return;
      }
      const kinds =
        permission === 'media'
          ? mediaKinds((details as { mediaTypes?: string[] }).mediaTypes)
          : permission === 'geolocation'
            ? (['location'] as PermissionKind[])
            : [];
      const origin = originOf(details.requestingUrl);
      if (kinds.length === 0 || !origin || contents.getType() !== 'webview') {
        callback(false);
        return;
      }
      this.request(contents, origin, kinds, callback);
    });
    session.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => {
      // With no handler Electron answers "yes" to every check, and until the
      // review of 2026-09-30 this one did too for all but the three kinds
      // below: notifications, MIDI, reading the clipboard, and the rest
      // read as granted to every page.
      if (ALLOWED_WITHOUT_ASKING.has(permission)) return true;
      if (permission !== 'media' && permission !== 'geolocation') return false;
      if (!contents || contents.getType() !== 'webview') return false;
      const origin = originOf(details.requestingUrl ?? requestingOrigin) ?? originOf(requestingOrigin);
      if (!origin) return false;
      const kinds: PermissionKind[] =
        permission === 'geolocation'
          ? ['location']
          : details.mediaType === 'video'
            ? ['camera']
            : details.mediaType === 'audio'
              ? ['microphone']
              : ['camera', 'microphone'];
      return kinds.some((k) => this.state(contents, origin, k) === 'allow' || this.state(contents, origin, k) === 'once');
    });
  }

  /** Watches a web page: leaving the site or closing ends its "this time" grants and prompts. */
  trackTab(contents: WebContents): void {
    contents.on('did-stop-loading', () => this.ending.delete(contents));
    contents.on('did-navigate', (_event, url) => {
      this.ending.delete(contents);
      const grants = this.tabs.get(contents);
      if (grants && originOf(url) !== grants.origin) this.leave(contents);
      for (const p of this.pending.values()) if (p.contents === contents && originOf(url) !== p.origin) this.end(p, false);
    });
    contents.once('destroyed', () => {
      this.tabs.delete(contents);
      for (const p of [...this.pending.values()]) if (p.contents === contents) this.end(p, false);
    });
  }

  /** The last private tab closed: private choices go. */
  forgetPrivate(): void {
    this.privateChoices.clear();
  }

  private request(contents: WebContents, origin: string, kinds: PermissionKind[], callback: (granted: boolean) => void): void {
    const verdict = decide(kinds, this.choices(contents)[origin], this.grantsFor(contents, origin)?.once);
    if (verdict !== 'ask') {
      if (verdict === 'grant') this.given(contents, origin, kinds);
      callback(verdict === 'grant');
      return;
    }
    const p: Pending = { id: this.nextId++, contents, origin, kinds, callback };
    this.pending.set(p.id, p);
    this.deps.send(contents, { type: 'permission-prompt', prompt: { id: p.id, webContentsId: contents.id, origin, kinds } });
  }

  /** A request from the shell (registered with handleFromShell, main/ipc.ts). Never throws. */
  async handle(event: IpcMainInvokeEvent, raw: unknown): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
    const parsed = parsePermissionRequest(raw);
    if ('error' in parsed) return { ok: false, error: parsed.error };
    try {
      return { ok: true, value: this.run(parsed.request, event.sender) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private run(r: PermissionRequest, shell: WebContents): unknown {
    switch (r.op) {
      case 'answer': {
        const p = this.pending.get(r.id);
        if (p && p.contents.hostWebContents === shell) this.answer(p, r.answer);
        return null;
      }
      case 'site':
        return this.site(this.page(r.tab, shell));
      case 'site.set': {
        const contents = this.page(r.tab, shell);
        const origin = contents ? originOf(contents.getURL()) : null;
        if (!contents || !origin) return null;
        this.remember(contents, origin, [r.kind], r.state === 'ask' ? null : r.state);
        this.grantsFor(contents, origin)?.once.delete(r.kind);
        if (r.state === 'block') this.revoke(origin, r.kind, contents.session);
        return this.site(contents);
      }
    }
  }

  private answer(p: Pending, answer: PromptAnswer): void {
    if (answer === 'once') {
      const grants = this.grantsFor(p.contents, p.origin, true)!;
      for (const k of p.kinds) grants.once.add(k);
    } else {
      this.remember(p.contents, p.origin, p.kinds, answer);
    }
    this.end(p, answer !== 'block');
  }

  /** Settles a prompt: tells the page, clears it from the shell, and marks what was given. */
  private end(p: Pending, granted: boolean): void {
    if (!this.pending.delete(p.id)) return;
    if (granted) this.given(p.contents, p.origin, p.kinds);
    p.callback(granted);
    if (!p.contents.isDestroyed()) this.deps.send(p.contents, { type: 'permission-ended', id: p.id });
  }

  /**
   * Blocking a site's camera or microphone ends what its pages are already
   * capturing, in every tab on that site, not only new requests (GitHub
   * issue #22); the in-use marker goes with it. A page that was given the
   * camera or microphone is reloaded: that ends its capture whatever its
   * scripts do, where asking the page to stop its own tracks (as until the
   * review of 2026-09-30, M7) left a hostile page capturing under a marker
   * that had gone out. Only in the session the choice was made in: normal
   * and private tabs keep separate choices (PR #29 review).
   */
  private revoke(origin: string, kind: PermissionKind, session: Session): void {
    for (const [contents, grants] of this.tabs) {
      if (grants.origin !== origin || contents.isDestroyed() || contents.session !== session) continue;
      if (!grants.given.delete(kind)) continue;
      this.deps.send(contents, { type: 'site-access', webContentsId: contents.id, kinds: [...grants.given] });
      if (kind !== 'location') {
        this.ending.add(contents);
        contents.reload();
      }
    }
  }

  /**
   * Is this page being reloaded to end its capture? Then a page that asks
   * to be kept (a beforeunload handler) is not asked about: "Stay" would
   * leave it capturing after Block (main/leave-page.ts).
   */
  endingCapture(contents: WebContents): boolean {
    return this.ending.has(contents);
  }

  private given(contents: WebContents, origin: string, kinds: PermissionKind[]): void {
    const grants = this.grantsFor(contents, origin, true)!;
    for (const k of kinds) grants.given.add(k);
    this.deps.send(contents, { type: 'site-access', webContentsId: contents.id, kinds: [...grants.given] });
  }

  /** The tab left the site: "this time" grants and the marker go. */
  private leave(contents: WebContents): void {
    const had = this.tabs.get(contents)?.given.size ?? 0;
    this.tabs.delete(contents);
    if (had > 0 && !contents.isDestroyed()) this.deps.send(contents, { type: 'site-access', webContentsId: contents.id, kinds: [] });
  }

  private grantsFor(contents: WebContents, origin: string, create = false): TabGrants | undefined {
    const grants = this.tabs.get(contents);
    if (grants && grants.origin === origin) return grants;
    if (!create) return undefined;
    const fresh: TabGrants = { origin, once: new Set(), given: new Set() };
    this.tabs.set(contents, fresh);
    return fresh;
  }

  private choices(contents: WebContents): Record<string, SiteChoices> {
    return this.deps.isPrivate(contents) ? Object.fromEntries(this.privateChoices) : this.deps.saved();
  }

  /** Remembers (or with null, forgets) a choice for some kinds on a site. */
  private remember(contents: WebContents, origin: string, kinds: PermissionKind[], choice: 'allow' | 'block' | null): void {
    const current = { ...this.choices(contents)[origin] };
    for (const k of kinds) {
      if (choice) current[k] = choice;
      else delete current[k];
    }
    if (this.deps.isPrivate(contents)) {
      if (Object.keys(current).length > 0) this.privateChoices.set(origin, current);
      else this.privateChoices.delete(origin);
      return;
    }
    const sites = { ...this.deps.saved() };
    if (Object.keys(current).length > 0) sites[origin] = current;
    else delete sites[origin];
    this.deps.save(sites);
  }

  private state(contents: WebContents, origin: string, kind: PermissionKind): PermissionState {
    const remembered = this.choices(contents)[origin]?.[kind];
    if (remembered) return remembered;
    return this.grantsFor(contents, origin)?.once.has(kind) ? 'once' : 'ask';
  }

  /** A web page the asking shell hosts, by its web contents id. */
  private page(id: number, shell: WebContents): WebContents | null {
    const found = allContents.fromId(id);
    return found && !found.isDestroyed() && found.getType() === 'webview' && found.hostWebContents === shell ? found : null;
  }

  private site(contents: WebContents | null): SitePermissions | null {
    const origin = contents ? originOf(contents.getURL()) : null;
    if (!contents || !origin) return null;
    const states = Object.fromEntries(PERMISSION_KINDS.map((k) => [k, this.state(contents, origin, k)])) as Record<
      PermissionKind,
      PermissionState
    >;
    return {
      origin,
      insecure: origin.startsWith('http:'),
      private: this.deps.isPrivate(contents),
      states,
      given: [...(this.grantsFor(contents, origin)?.given ?? [])],
    };
  }
}
