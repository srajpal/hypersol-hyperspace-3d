/**
 * Full screen and pointer lock for web pages (GitHub issue #75; owner,
 * after prompt 203, Q1 to Q5 a). A page may fill the whole screen, or
 * hold the pointer, after a real click or key (Chromium asks for one),
 * without a question; the browser then says so in a notice of its own,
 * over the page, and Escape always leaves: the main process sees the key
 * before the page does, so no page can keep either.
 */

/** Page preload to main process: the page holds the pointer now, or not. */
export const POINTER_LOCK_CHANNEL = 'hypersol:pointer-lock';

/** What a web page may have after a real click or key, without a question, with the browser's notice (Electron's names). */
export const ALLOWED_WITH_NOTICE: ReadonlySet<string> = new Set(['fullscreen', 'pointerLock']);

/** How long the notice stays, each time it shows. */
export const NOTICE_MS = 4000;
/** The pointer this near the top of the screen, in full screen, shows the notice again. */
export const TOP_EDGE_PX = 4;
/** And not more often than this. */
export const TOP_EDGE_EVERY_MS = 1500;

/**
 * The world the main process leaves full screen and pointer lock in: one
 * of its own, apart from the page's, so a page that replaces
 * `document.exitFullscreen` in its own world cannot stop it.
 */
export const LEAVE_WORLD = 1075;
export const LEAVE_SCRIPT = 'if (document.pointerLockElement) document.exitPointerLock(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);';

export type HoldKind = 'fullscreen' | 'pointer';

/** The notice's words: the site as the address bar shows it, and how to leave. */
export function holdNotice(kind: HoldKind, site: string): string {
  const who = site === '' ? 'This page' : site;
  return kind === 'fullscreen' ? `${who} is full screen. Press Esc to leave.` : `${who} has the pointer. Press Esc to get it back.`;
}

/** The site a notice names: the host of a web page's address; '' for anything else (a file opened from the computer). */
export function noticeSite(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.host : '';
  } catch {
    return '';
  }
}

/** Whether a key leaves full screen or gives the pointer back: Escape pressed, with any other keys, while a page holds either. */
export function escapeLeaves(input: { type: string; key: string }, holding: boolean): boolean {
  return holding && input.type === 'keyDown' && input.key === 'Escape';
}
