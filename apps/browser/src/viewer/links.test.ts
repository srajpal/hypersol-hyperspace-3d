import { describe, expect, it } from 'vitest';
import { cameFromAnotherPage, linkAddress, toAnotherPage, type Here } from './links';

const SHOWROOM = 'https://srajpal.github.io/holoml/showroom/index.holoml';
const VIEWER = 'https://srajpal.github.io/hypersol-hyperspace-3d/viewer/';

/** HyperSpace 3D, or its Android app: the document is the page. */
const browser: Here = { document: SHOWROOM, page: SHOWROOM, web: false };
/** The viewer on the web, showing the showroom. */
const web: Here = { document: `${VIEWER}?page=${SHOWROOM}`, page: SHOWROOM, web: true };

// Following them, in the viewer on the web and in the browser, is checked end to end (web-viewer.e2e.ts, WL1 to WL9; m14's P4).
describe('where a link opens (issue #125)', () => {
  it('in HyperSpace 3D and its Android app, at its own address, whatever it is', () => {
    for (const href of [`${SHOWROOM.replace('index', 'quellis')}`, `${SHOWROOM}#front`, 'https://example.org/page.html', 'https://example.org/room.holoml']) {
      expect(linkAddress(href, browser), href).toBe(href);
    }
  });

  it('on the web, another HoloML page in the viewer by ?page=, its query and its place kept inside the value', () => {
    expect(linkAddress('https://srajpal.github.io/holoml/showroom/quellis.holoml', web)).toBe(`${VIEWER}?page=https://srajpal.github.io/holoml/showroom/quellis.holoml`);
    const shoe = linkAddress('https://srajpal.github.io/holoml/sneaker-store/shoe.holoml?colour=ember&size=9', web);
    expect(shoe).toBe(`${VIEWER}?page=https://srajpal.github.io/holoml/sneaker-store/shoe.holoml?colour=ember%26size=9`);
    expect(new URL(shoe).searchParams.get('page')).toBe('https://srajpal.github.io/holoml/sneaker-store/shoe.holoml?colour=ember&size=9');
    const place = linkAddress('https://srajpal.github.io/holoml/harbour-loft/index.holoml#terrace-door', web);
    expect(new URL(place).hash).toBe('');
    expect(new URL(place).searchParams.get('page')).toBe('https://srajpal.github.io/holoml/harbour-loft/index.holoml#terrace-door');
    // An address with escapes in it comes back the same.
    const spaced = 'https://example.org/a%20room/b+c.holoml';
    expect(new URL(linkAddress(spaced, web)).searchParams.get('page')).toBe(spaced);
  });

  it("on the web, a HoloML page of another site too, and one served from this computer over http, as the host fetches them", () => {
    expect(new URL(linkAddress('https://example.org/room.holoml', web)).searchParams.get('page')).toBe('https://example.org/room.holoml');
    expect(new URL(linkAddress('http://127.0.0.1:8080/room.holoml', web)).searchParams.get('page')).toBe('http://127.0.0.1:8080/room.holoml');
  });

  it('on the web, a place on the page itself by the name alone, so the viewer stays', () => {
    expect(linkAddress(`${SHOWROOM}#front`, web)).toBe(`${VIEWER}?page=${SHOWROOM}#front`);
    // In the playground's frame, the same.
    const framed: Here = { document: `${VIEWER}?from=parent`, page: SHOWROOM, web: true };
    expect(linkAddress(`${SHOWROOM}#front`, framed)).toBe(`${VIEWER}?from=parent#front`);
    expect(linkAddress(SHOWROOM.replace('index', 'quellis'), framed)).toBe(`${VIEWER}?page=${SHOWROOM.replace('index', 'quellis')}`);
  });

  it('on the web, an ordinary page, a page over plain http elsewhere, and what is not an address, as they are', () => {
    for (const href of ['https://srajpal.github.io/holoml/sofa-studio/cart.html', 'https://github.com/srajpal/holoml', 'http://example.org/room.holoml', 'mailto:someone@example.org', 'not an address']) {
      expect(linkAddress(href, web), href).toBe(href);
    }
  });
});

describe('which links fade (issue #125)', () => {
  it("another HoloML page of the page's own site, compared with the page's address, not the host's", () => {
    for (const here of [browser, web]) {
      expect(toAnotherPage('https://srajpal.github.io/holoml/showroom/quellis.holoml', here)).toBe(true);
      expect(toAnotherPage(`${SHOWROOM}#front`, here)).toBe(false);
      expect(toAnotherPage('https://srajpal.github.io/holoml/sofa-studio/cart.html', here)).toBe(false);
      expect(toAnotherPage('https://example.org/room.holoml', here)).toBe(false);
    }
  });

  it('arriving from another HoloML page: its address, or on the web the host with its ?page=', () => {
    const quellis = 'https://srajpal.github.io/holoml/showroom/quellis.holoml';
    expect(cameFromAnotherPage(quellis, browser)).toBe(true);
    expect(cameFromAnotherPage(SHOWROOM, browser)).toBe(false);
    expect(cameFromAnotherPage(`${VIEWER}?page=${quellis}`, web)).toBe(true);
    expect(cameFromAnotherPage(`${VIEWER}?page=${SHOWROOM}`, web)).toBe(false);
    // On the web, a referrer that is the page itself, another site's viewer, the playground, or nothing is not one.
    expect(cameFromAnotherPage(quellis, web)).toBe(false);
    expect(cameFromAnotherPage(`https://example.org/viewer/?page=${quellis}`, web)).toBe(false);
    expect(cameFromAnotherPage(`${VIEWER}?from=parent`, web)).toBe(false);
    expect(cameFromAnotherPage('', web)).toBe(false);
  });
});
