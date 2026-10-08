import { describe, expect, it } from 'vitest';
import { holdsFrame, isFrameName, lockRealm, markupHasFrame } from './guard';

// The guard itself, in a page, is checked end to end (review-134-main.e2e.ts, M6): these are its pure parts.
describe('what the guard against peer connections refuses (prompt 172)', () => {
  it('markup that opens a frame element, however it is written', () => {
    for (const markup of ['<iframe></iframe>', '<IFRAME src="x">', '<p>a</p><iframe/>', '< iframe>', '<x:iframe xmlns:x="http://www.w3.org/1999/xhtml"/>', '<object data="a">', '<embed src=a>', '<frameset><frame></frameset>', '<portal>', '<fencedframe>', '<iframe\nsrcdoc="x">']) {
      expect(markupHasFrame(markup), markup).toBe(true);
    }
  });

  it('markup without one, even with the words in it', () => {
    for (const markup of ['<p>an iframe</p>', '<iframes>', '<objective>', '<div data-object="1">', 'frame', '&lt;iframe&gt;', '<embedded-thing>']) {
      expect(markupHasFrame(markup), markup).toBe(false);
    }
  });

  it("frame elements' names, in any case and with a prefix", () => {
    for (const name of ['iframe', 'IFRAME', 'x:iframe', 'frame', 'object', 'embed']) expect(isFrameName(name), name).toBe(true);
    for (const name of ['div', 'iframes', 'canvas', 'x:div']) expect(isFrameName(name), name).toBe(false);
  });

  it('outside a page: a value that is not a node holds no frame, and locking does nothing', () => {
    expect(holdsFrame('<iframe>')).toBe(false);
    expect(holdsFrame(null)).toBe(false);
    expect(() => lockRealm()).not.toThrow();
  });
});
