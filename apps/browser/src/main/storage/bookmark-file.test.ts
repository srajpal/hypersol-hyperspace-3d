import { describe, expect, it } from 'vitest';
import { BookmarkFileError, IMPORT_LIMITS, SKIPPED_SHOWN, decodeEntities, readBookmarkFile, writeBookmarkFile } from './bookmark-file';

const none = () => false;

/** A file as Chrome and Firefox export it, with a folder inside a folder. */
const CHROME = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" LAST_MODIFIED="1700000001" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://example.com/a?x=1&amp;y=2" ADD_DATE="1700000100" ICON="data:image/png;base64,AAAA">Fish &amp; chips &lt;3</A>
        <DT><H3 ADD_DATE="1700000000">Trips</H3>
        <DL><p>
            <DT><A HREF="https://日本.example/旅" ADD_DATE="1700000200">東京 · Ταξίδι · رحلة</A>
        </DL><p>
    </DL><p>
    <DT><A HREF="javascript:alert(1)">A bookmarklet</A>
    <DT><A HREF="place:sort=8">Firefox's recent tags</A>
    <DT><A HREF="https://example.com/a?x=1&amp;y=2">The same again</A>
    <DT><A>No address</A>
    <DT><A HREF='http://single.example/' add_date=1700000300>Single quotes</A>
</DL><p>
`;

describe('reading a bookmark file (milestone 26, issue #27)', () => {
  it('takes every web address with its title, date, icon, and folder, decoding the text', () => {
    const { found } = readBookmarkFile(CHROME, none);
    expect(found).toEqual([
      { url: 'https://example.com/a?x=1&y=2', title: 'Fish & chips <3', createdAt: 1700000100_000, favicon: 'data:image/png;base64,AAAA', folder: 'Bookmarks bar' },
      { url: 'https://日本.example/旅', title: '東京 · Ταξίδι · رحلة', createdAt: 1700000200_000, favicon: null, folder: 'Bookmarks bar › Trips' },
      { url: 'http://single.example/', title: 'Single quotes', createdAt: 1700000300_000, favicon: null, folder: '' },
    ]);
  });

  it('skips, and says why: not a web address, twice in the file, no address, and what is already bookmarked', () => {
    const has = (url: string) => url === 'http://single.example/';
    const { found, skipped, skippedCount } = readBookmarkFile(CHROME, has);
    expect(found.map((b) => b.url)).toEqual(['https://example.com/a?x=1&y=2', 'https://日本.example/旅']);
    expect(skipped.map((s) => [s.title, s.why])).toEqual([
      ['A bookmarklet', 'not a web address'],
      ["Firefox's recent tags", 'not a web address'],
      ['The same again', 'twice in the file'],
      ['No address', 'no address'],
      ['Single quotes', 'already bookmarked'],
    ]);
    expect(skippedCount).toBe(5);
  });

  it('keeps nothing that could run: tags in a title are dropped, and an icon must be a picture', () => {
    const file = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
      <DT><A HREF="https://x.example/" ICON="javascript:alert(1)"><script>alert(1)</script><b>Bold</b> <img src=x onerror=alert(1)>title</A>
    </DL>`;
    expect(readBookmarkFile(file, none).found).toEqual([{ url: 'https://x.example/', title: 'alert(1)Bold title', createdAt: null, favicon: null, folder: '' }]);
  });

  it('refuses a file that is not a bookmark file', () => {
    expect(() => readBookmarkFile('{"roots": {}}', none)).toThrow(BookmarkFileError);
    expect(() => readBookmarkFile('<html><body><a href="https://x.example/">x</a></body></html>', none)).toThrow(/not a bookmark file/);
  });

  it('takes a large file within the limits, and refuses one with too many bookmarks', () => {
    const many = (n: number) => `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>\n${Array.from({ length: n }, (_, i) => `<DT><A HREF="https://e.example/${i}" ADD_DATE="1700000000">Page ${i}</A>`).join('\n')}\n</DL>`;
    const start = performance.now();
    expect(readBookmarkFile(many(IMPORT_LIMITS.bookmarks), none).found).toHaveLength(IMPORT_LIMITS.bookmarks);
    // Linear in the file's length: twenty thousand bookmarks take well under a second.
    expect(performance.now() - start).toBeLessThan(2000);
    expect(() => readBookmarkFile(many(IMPORT_LIMITS.bookmarks + 1), none)).toThrow(/more than 20,000 bookmarks/);
  });

  it('lists the first skipped ones by name and counts them all', () => {
    const file = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>${Array.from({ length: SKIPPED_SHOWN + 10 }, (_, i) => `<DT><A HREF="javascript:${i}">J${i}</A>`).join('')}</DL>`;
    const { skipped, skippedCount } = readBookmarkFile(file, none);
    expect(skipped).toHaveLength(SKIPPED_SHOWN);
    expect(skippedCount).toBe(SKIPPED_SHOWN + 10);
  });

  it('reads a file cut short, taking what it can', () => {
    const file = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF="https://a.example/">A</A><DT><A HREF="https://b.example/">B';
    expect(readBookmarkFile(file, none).found.map((b) => [b.url, b.title])).toEqual([
      ['https://a.example/', 'A'],
      ['https://b.example/', 'https://b.example/'],
    ]);
  });

  it('decodes numeric and named character references, and leaves broken ones as written', () => {
    expect(decodeEntities('&#233;&#xE9;&eacute;&amp;&#0;&#xD800;&bogus;')).toBe('éé&eacute;&&#0;&#xD800;&bogus;');
  });
});

describe('writing a bookmark file', () => {
  const bookmarks = [
    { url: 'https://b.example/?q="x"&y=<1>', title: 'B & "quotes" <tags>', createdAt: 1700000200_500, favicon: null },
    { url: 'https://a.example/', title: 'Ünïcödé · 東京', createdAt: 1700000100_000, favicon: 'data:image/png;base64,AAAA' },
  ];

  it('writes the standard form, oldest first, with dates in seconds and icons', () => {
    const text = writeBookmarkFile(bookmarks);
    expect(text.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>')).toBe(true);
    expect(text).toContain('<DT><A HREF="https://a.example/" ADD_DATE="1700000100" ICON="data:image/png;base64,AAAA">Ünïcödé · 東京</A>');
    expect(text).toContain('<DT><A HREF="https://b.example/?q=&quot;x&quot;&amp;y=&lt;1&gt;" ADD_DATE="1700000200">B &amp; &quot;quotes&quot; &lt;tags&gt;</A>');
    expect(text.indexOf('a.example')).toBeLessThan(text.indexOf('b.example'));
  });

  it('reads back as what was written (a round trip)', () => {
    const { found, skippedCount } = readBookmarkFile(writeBookmarkFile(bookmarks), none);
    expect(skippedCount).toBe(0);
    expect(found).toEqual([
      { url: 'https://a.example/', title: 'Ünïcödé · 東京', createdAt: 1700000100_000, favicon: 'data:image/png;base64,AAAA', folder: '' },
      { url: 'https://b.example/?q="x"&y=<1>', title: 'B & "quotes" <tags>', createdAt: 1700000200_000, favicon: null, folder: '' },
    ]);
  });
});
