// The messages between the room's page and the Android app (milestone 24).
import { describe, expect, it } from 'vitest';
import { parseFromApp, quadChanged, type ToApp } from './bridge';

describe('messages from the app', () => {
  it('takes the tabs, with only what it knows of each, and a focused tab that is among them', () => {
    expect(
      parseFromApp({
        type: 'tabs',
        tabs: [{ id: 1, url: 'https://a.example/', title: 'A', loading: true, canGoBack: true, extra: 'ignored' }, { id: 'two' }, { id: 2 }],
        focused: 2,
        canReopen: true,
      }),
    ).toEqual({
      type: 'tabs',
      tabs: [
        { id: 1, url: 'https://a.example/', title: 'A', loading: true, canGoBack: true, canGoForward: false, holoml: false, crashed: false },
        { id: 2, url: '', title: '', loading: false, canGoBack: false, canGoForward: false, holoml: false, crashed: false },
      ],
      focused: 2,
      canReopen: true,
    });
    expect(parseFromApp({ type: 'tabs', tabs: [{ id: 1 }], focused: 9 })).toMatchObject({ focused: null });
  });

  it('takes a page picture only as a JPEG or PNG data address', () => {
    expect(parseFromApp({ type: 'snapshot', id: 1, dataUrl: 'data:image/jpeg;base64,AAAA' })).toEqual({ type: 'snapshot', id: 1, dataUrl: 'data:image/jpeg;base64,AAAA' });
    expect(parseFromApp({ type: 'snapshot', id: 1, dataUrl: 'javascript:alert(1)' })).toBeNull();
    expect(parseFromApp({ type: 'snapshot', id: 1, dataUrl: 'https://a.example/x.jpg' })).toBeNull();
  });

  it('keeps a tilt within -1 and 1, and refuses anything else', () => {
    expect(parseFromApp({ type: 'tilt', x: 3, y: -0.5 })).toEqual({ type: 'tilt', x: 1, y: -0.5 });
    expect(parseFromApp({ type: 'tilt', x: Number.NaN, y: 0 })).toBeNull();
    expect(parseFromApp({ type: 'settings', lighter: 'yes' })).toEqual({ type: 'settings', lighter: false });
    expect(parseFromApp({ type: 'navigate', url: 'x' })).toBeNull();
    expect(parseFromApp('tabs')).toBeNull();
    expect(parseFromApp(null)).toBeNull();
  });
});

describe("the page's outline", () => {
  const quad = (over: Partial<Extract<ToApp, { type: 'quad' }>> = {}): Extract<ToApp, { type: 'quad' }> => ({
    type: 'quad',
    id: 1,
    visible: true,
    quad: [10, 10, 100, 10, 110, 200, 0, 200],
    width: 640,
    height: 900,
    dpr: 1.125,
    ...over,
  });

  it('is told again only when it moves a quarter of a pixel or more, or anything else about it changes', () => {
    expect(quadChanged(null, quad())).toBe(true);
    expect(quadChanged(quad(), quad({ quad: [10.1, 10, 100, 10, 110, 200, 0, 200] }))).toBe(false);
    expect(quadChanged(quad(), quad({ quad: [10.3, 10, 100, 10, 110, 200, 0, 200] }))).toBe(true);
    expect(quadChanged(quad(), quad({ visible: false }))).toBe(true);
    expect(quadChanged(quad(), quad({ id: 2 }))).toBe(true);
    expect(quadChanged(quad(), quad({ width: 641 }))).toBe(true);
    expect(quadChanged(quad({ quad: [] }), quad())).toBe(true);
  });
});
