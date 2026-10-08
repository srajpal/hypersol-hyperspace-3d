/**
 * Bookmark files (milestone 26, GitHub issue #27): reading the file
 * every browser exports, the "Netscape bookmark file" (HTML), and
 * writing one.
 *
 * The file is read as text by the small reader here, never shown as a
 * page: nothing in it runs, and only the bookmarks' addresses, titles,
 * dates, and icons are taken from it. Bookmarks here have no folders
 * (owner, prompt 178, Q3 a): an imported bookmark's folder is kept only
 * for the preview, and an export is one flat list.
 */

/** The largest file read, and the most bookmarks taken from one (milestone 26's plan). */
export const IMPORT_LIMITS = { fileBytes: 10 * 1024 * 1024, bookmarks: 20_000 } as const;

const MAX_URL = 8192;
const MAX_TITLE = 1024;
const MAX_FAVICON = 64 * 1024;

export interface ImportedBookmark {
  url: string;
  title: string;
  /** When it was bookmarked (milliseconds), from the file's ADD_DATE, or null when it has none. */
  createdAt: number | null;
  favicon: string | null;
  /** The folders it was in, outermost first, joined with " › " (shown in the preview only). */
  folder: string;
}

export type SkipReason = 'not a web address' | 'already bookmarked' | 'twice in the file' | 'address too long' | 'no address';

export interface SkippedBookmark {
  title: string;
  url: string;
  why: SkipReason;
}

export interface ReadBookmarks {
  found: ImportedBookmark[];
  /** The first SKIPPED_SHOWN of those skipped; skippedCount counts them all. */
  skipped: SkippedBookmark[];
  skippedCount: number;
}

/** How many skipped bookmarks are listed by name (the rest are counted). */
export const SKIPPED_SHOWN = 500;

/** Why a whole file is refused: not a bookmark file, or past the limits. */
export class BookmarkFileError extends Error {}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Turns character references into the characters they stand for (the few names browsers write, and numbers). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
    }
    return NAMED[ref.toLowerCase()] ?? whole;
  });
}

/** Writes text so that it reads back as itself, in an element or a quoted attribute. */
export function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A tag's attributes, by lower-case name: quoted with " or ', or bare. */
function attributes(source: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const m of source.matchAll(re)) {
    const name = m[1]!.toLowerCase();
    if (!out.has(name)) out.set(name, decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''));
  }
  return out;
}

/** Plain text from an element's content: tags inside it dropped, references decoded, spaces collapsed. */
function plainText(html: string): string {
  // Tags are taken out again until nothing changes, so that no pass can leave a tag behind (as CodeQL's
  // js/incomplete-multi-character-sanitization asks). The title is text wherever it goes: shown as text, and
  // written back escaped.
  let text = html;
  for (let before = ''; before !== text; ) {
    before = text;
    text = text.replace(/<[^>]*>/g, '');
  }
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

const isWeb = (url: string): boolean => /^https?:\/\/[^\s]/i.test(url);

/**
 * Reads a bookmark file's text. `has` says which addresses are already
 * bookmarked. Throws BookmarkFileError for a file that is not a bookmark
 * file, or one past the limits; otherwise returns what would be added
 * and what would be skipped, and why.
 */
export function readBookmarkFile(text: string, has: (url: string) => boolean): ReadBookmarks {
  if (text.length > IMPORT_LIMITS.fileBytes) throw new BookmarkFileError(`This file is larger than ${IMPORT_LIMITS.fileBytes / 1024 / 1024} MB.`);
  const source = text.replace(/^﻿/, '');
  if (!/<!DOCTYPE\s+NETSCAPE-Bookmark-file-1/i.test(source) && !/<dl[\s>]/i.test(source)) {
    throw new BookmarkFileError("This is not a bookmark file: other browsers export bookmarks as an HTML file, which is what's needed here.");
  }
  const found: ImportedBookmark[] = [];
  const skipped: SkippedBookmark[] = [];
  let skippedCount = 0;
  // End tags, searched for from where each element starts (case-insensitively, in the text as it is).
  const ends: Record<string, RegExp> = { a: /<\/a\b/gi, h3: /<\/h3\b/gi };
  const seen = new Set<string>();
  const folders: string[] = [];
  // The folder a <DL> opens: the title of the <H3> just before it.
  let pendingFolder: string | null = null;
  const tags = /<(\/?)(dl|h3|a)\b([^>]*)>|<!--[\s\S]*?-->/gi;
  let m: RegExpExecArray | null;
  while ((m = tags.exec(source)) !== null) {
    if (m[2] === undefined) continue; // a comment
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    if (name === 'dl') {
      if (closing) folders.pop();
      else {
        folders.push(pendingFolder ?? '');
        pendingFolder = null;
      }
      continue;
    }
    if (closing) continue;
    // The element's content runs to its end tag (or, in a file cut short, to the next tag of the kind).
    const endTag = ends[name]!;
    endTag.lastIndex = tags.lastIndex;
    const end = endTag.exec(source)?.index ?? -1;
    const content = end === -1 ? '' : source.slice(tags.lastIndex, end);
    if (end !== -1) tags.lastIndex = end;
    if (name === 'h3') {
      pendingFolder = plainText(content);
      continue;
    }
    const attrs = attributes(m[3] ?? '');
    const url = (attrs.get('href') ?? '').trim();
    const title = plainText(content).slice(0, MAX_TITLE) || url;
    const why: SkipReason | null = !url ? 'no address' : !isWeb(url) ? 'not a web address' : url.length > MAX_URL ? 'address too long' : seen.has(url) ? 'twice in the file' : has(url) ? 'already bookmarked' : null;
    if (why) {
      skippedCount += 1;
      if (skipped.length < SKIPPED_SHOWN) skipped.push({ title, url: url.slice(0, 200), why });
      continue;
    }
    seen.add(url);
    if (found.length >= IMPORT_LIMITS.bookmarks) {
      throw new BookmarkFileError(`This file has more than ${IMPORT_LIMITS.bookmarks.toLocaleString('en')} bookmarks to add; nothing was imported.`);
    }
    const seconds = Number(attrs.get('add_date'));
    const icon = attrs.get('icon') ?? '';
    found.push({
      url,
      title,
      createdAt: Number.isFinite(seconds) && seconds > 0 && seconds < 1e11 ? Math.round(seconds * 1000) : null,
      favicon: icon.startsWith('data:image/') && icon.length <= MAX_FAVICON ? icon : null,
      folder: folders.filter(Boolean).join(' › '),
    });
  }
  return { found, skipped, skippedCount };
}

export interface ExportedBookmark {
  url: string;
  title: string;
  createdAt: number;
  favicon: string | null;
}

/** Writes bookmarks as a bookmark file, oldest first, one flat list. */
export function writeBookmarkFile(bookmarks: ExportedBookmark[]): string {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file.',
    '     It will be read and overwritten.',
    '     DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const b of [...bookmarks].sort((a, c) => a.createdAt - c.createdAt)) {
    const icon = b.favicon ? ` ICON="${escapeText(b.favicon)}"` : '';
    lines.push(`    <DT><A HREF="${escapeText(b.url)}" ADD_DATE="${Math.floor(b.createdAt / 1000)}"${icon}>${escapeText(b.title)}</A>`);
  }
  lines.push('</DL><p>', '');
  return lines.join('\n');
}
