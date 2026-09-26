/**
 * Site permissions (milestone 9): a site may ask for the camera, the
 * microphone, or your location; you answer Allow, Allow this time, or
 * Block (owner, prompt 45, Q2 a). Allow and Block are remembered per site
 * (its origin: scheme, host, and port) in settings.json; private tabs keep
 * theirs in memory. Every other permission stays refused.
 *
 * Pure, so the main process, the shell, and the unit tests share it.
 */

/** The shell asks the main process about permissions over this channel. */
export const PERMISSIONS_CHANNEL = 'hypersol:permissions';

export const PERMISSION_KINDS = ['camera', 'microphone', 'location'] as const;
export type PermissionKind = (typeof PERMISSION_KINDS)[number];
/** A remembered answer. */
export type PermissionChoice = 'allow' | 'block';
/** A remembered answer, "ask" (none), or "once" (allowed this time, until the tab leaves the site). */
export type PermissionState = PermissionChoice | 'ask' | 'once';
/** An answer to a prompt. */
export type PromptAnswer = 'allow' | 'once' | 'block';

export type SiteChoices = Partial<Record<PermissionKind, PermissionChoice>>;

export const PERMISSION_LABELS: Record<PermissionKind, string> = {
  camera: 'Camera',
  microphone: 'Microphone',
  location: 'Location',
};

/** A prompt the shell shows under the top bar for one tab's page. */
export interface PermissionPrompt {
  id: number;
  webContentsId: number;
  origin: string;
  kinds: PermissionKind[];
}

/** The site panel's view of the page in a tab. */
export interface SitePermissions {
  origin: string;
  /** The page is plain http. */
  insecure: boolean;
  private: boolean;
  states: Record<PermissionKind, PermissionState>;
  /** Kinds this page was given access to (the in-use marker). */
  given: PermissionKind[];
}

export type PermissionRequest =
  | { op: 'answer'; id: number; answer: PromptAnswer }
  | { op: 'site'; tab: number }
  | { op: 'site.set'; tab: number; kind: PermissionKind; state: 'ask' | PermissionChoice };

export interface PermissionResults {
  answer: null;
  /** Null when the tab shows no web page. */
  site: SitePermissions | null;
  'site.set': SitePermissions | null;
}

export type PermissionOp = PermissionRequest['op'];
export type PermissionReply<K extends PermissionOp> = { ok: true; value: PermissionResults[K] } | { ok: false; error: string };

export const MAX_PERMISSION_SITES = 1000;

export const isPermissionKind = (v: unknown): v is PermissionKind =>
  typeof v === 'string' && (PERMISSION_KINDS as readonly string[]).includes(v);

const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1;

/**
 * A web origin as URL.origin gives it: http or https, a host name, and a
 * port only when it is not the default. Lower case.
 */
export function isOrigin(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 300) return false;
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.origin === v;
  } catch {
    return false;
  }
}

/** The origin of a web address, or null for anything that is not http or https. */
export function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

/** Checks the remembered choices from settings.json or a settings change. */
export function parseSiteChoices(value: unknown): Record<string, SiteChoices> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_PERMISSION_SITES) return null;
  const out: Record<string, SiteChoices> = {};
  for (const [origin, choices] of entries) {
    if (!isOrigin(origin) || typeof choices !== 'object' || choices === null || Array.isArray(choices)) return null;
    const site: SiteChoices = {};
    for (const [kind, choice] of Object.entries(choices as Record<string, unknown>)) {
      if (!isPermissionKind(kind) || (choice !== 'allow' && choice !== 'block')) return null;
      site[kind] = choice;
    }
    if (Object.keys(site).length > 0) out[origin] = site;
  }
  return out;
}

/**
 * What to do with a request for some kinds: grant it when every kind is
 * allowed (remembered, or this time), refuse it when any is blocked,
 * otherwise ask.
 */
export function decide(
  kinds: readonly PermissionKind[],
  remembered: SiteChoices | undefined,
  once: ReadonlySet<PermissionKind> | undefined,
): 'grant' | 'deny' | 'ask' {
  if (kinds.length === 0) return 'deny';
  if (kinds.some((k) => remembered?.[k] === 'block')) return 'deny';
  if (kinds.every((k) => remembered?.[k] === 'allow' || once?.has(k))) return 'grant';
  return 'ask';
}

/** The kinds a media request asks for (Electron's mediaTypes: video, audio). */
export function mediaKinds(mediaTypes: readonly string[] | undefined): PermissionKind[] {
  const kinds: PermissionKind[] = [];
  if (mediaTypes?.includes('video')) kinds.push('camera');
  if (mediaTypes?.includes('audio')) kinds.push('microphone');
  return kinds;
}

/** "your camera and microphone", for a prompt. */
export function describeKinds(kinds: readonly PermissionKind[]): string {
  if (kinds.length === 0) return '';
  const last = kinds[kinds.length - 1]!;
  return kinds.length === 1 ? `your ${last}` : `your ${kinds.slice(0, -1).join(', ')} and ${last}`;
}

export function parsePermissionRequest(raw: unknown): { request: PermissionRequest } | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'Not a request' };
  const r = raw as Record<string, unknown>;
  switch (r['op']) {
    case 'answer':
      if (!isId(r['id'])) return { error: 'answer: id must be a prompt id' };
      if (r['answer'] !== 'allow' && r['answer'] !== 'once' && r['answer'] !== 'block') {
        return { error: 'answer: answer must be allow, once, or block' };
      }
      return { request: { op: 'answer', id: r['id'], answer: r['answer'] } };
    case 'site':
      if (!isId(r['tab'])) return { error: 'site: tab must be a page id' };
      return { request: { op: 'site', tab: r['tab'] } };
    case 'site.set':
      if (!isId(r['tab'])) return { error: 'site.set: tab must be a page id' };
      if (!isPermissionKind(r['kind'])) return { error: 'site.set: unknown permission' };
      if (r['state'] !== 'ask' && r['state'] !== 'allow' && r['state'] !== 'block') {
        return { error: 'site.set: state must be ask, allow, or block' };
      }
      return { request: { op: 'site.set', tab: r['tab'], kind: r['kind'], state: r['state'] } };
    default:
      return { error: `Unknown request: ${String(r['op'])}` };
  }
}
