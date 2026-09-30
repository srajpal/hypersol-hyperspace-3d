import { describe, expect, it } from 'vitest';
import { parseImageReport, parseLayersState } from '../shared/layers';
import { LAYERS, findSectionContainer, largest, liftTransform, liftable, sameExceptLift, vanishingPoint, withoutLift, type Box } from './layers-plan';

const box = (width: number, height: number): Box => ({ x: 0, y: 0, width, height });

describe('findSectionContainer', () => {
  it('looks inside wrappers until the page splits into sections', () => {
    // body > div#app (whole page) > main (whole page) > [header, section, section, footer]
    const tree: Record<string, Box[]> = {
      '': [box(1000, 3000)],
      '0': [box(1000, 2990)],
      '0.0': [box(1000, 200), box(1000, 1200), box(1000, 1200), box(1000, 390)],
    };
    expect(findSectionContainer((p) => tree[p.join('.')] ?? [], 1000 * 3000)).toEqual([0, 0]);
  });

  it('stops at the body when it already has several sizeable children', () => {
    const kids = [box(1000, 900), box(1000, 900), box(1000, 900)];
    expect(findSectionContainer(() => kids, 1000 * 2700)).toEqual([]);
  });

  it('ignores tiny siblings of a wrapper (skip links, hidden helpers)', () => {
    const tree: Record<string, Box[]> = {
      '': [box(100, 10), box(1000, 2900), box(1, 1)],
      '1': [box(1000, 1400), box(1000, 1500)],
    };
    expect(findSectionContainer((p) => tree[p.join('.')] ?? [], 1000 * 3000)).toEqual([1]);
  });

  it('does not descend into a child that is only part of its parent', () => {
    const tree: Record<string, Box[]> = { '': [box(1000, 1000)] };
    expect(findSectionContainer((p) => tree[p.join('.')] ?? [], 1000 * 3000)).toEqual([]);
  });
});

describe('liftTransform', () => {
  it('is the identity, with the same functions, at depth 0 and scale 1', () => {
    const t = liftTransform({ x: 100, y: 200, width: 400, height: 300 }, { x: 500, y: 400 }, 0, 1);
    expect(t).toBe(
      `translate(400px, 200px) perspective(${LAYERS.perspective}px) translateZ(0px) translate(-400px, -200px) translate(200px, 150px) scale(1) translate(-200px, -150px)`,
    );
    const lifted = liftTransform({ x: 100, y: 200, width: 400, height: 300 }, { x: 500, y: 400 }, 70, 0.94);
    expect(lifted.replace(/-?[\d.]+/g, 'n')).toBe(t.replace(/-?[\d.]+/g, 'n')); // same shape, so it animates
    expect(lifted).toContain('translateZ(70px)');
    expect(lifted).toContain('scale(0.94)');
  });

  it('measures the vanishing point from the element, so every layer shares it', () => {
    expect(liftTransform({ x: 600, y: 900, width: 10, height: 10 }, { x: 500, y: 400 }, 10)).toMatch(/^translate\(-100px, -500px\)/);
  });
});

describe('vanishingPoint', () => {
  it('sits in the middle and follows the parallax, clamped', () => {
    expect(vanishingPoint({ width: 1000, height: 600 }, { x: 0, y: 0 })).toEqual({ x: 500, y: 300 });
    const moved = vanishingPoint({ width: 1000, height: 600 }, { x: 1, y: -1 });
    expect(moved).toEqual({ x: 500 + LAYERS.parallaxShift * 1000, y: 300 - LAYERS.parallaxShift * 600 });
    expect(vanishingPoint({ width: 1000, height: 600 }, { x: 9, y: Number.NaN })).toEqual(
      vanishingPoint({ width: 1000, height: 600 }, { x: 1, y: 0 }),
    );
  });
});

describe('our own style changes (issue #9)', () => {
  it('tells our --hs-lift apart from the page restyling an element', () => {
    const lift = '--hs-lift: translate(1px, 2px) perspective(1400px) translateZ(70px) scale(0.94);';
    expect(withoutLift(`color: red; ${lift}`)).toBe('color: red;');
    expect(sameExceptLift('color: red;', `color: red; ${lift}`)).toBe(true);
    expect(sameExceptLift(lift, lift.replace('70px', '0px'))).toBe(true);
    expect(sameExceptLift(lift, `${lift} transform: translateX(80px);`)).toBe(false);
    expect(sameExceptLift('', 'position: fixed;')).toBe(false);
  });
});

describe('largest', () => {
  it('keeps the biggest items, in their original order', () => {
    expect(largest([1, 9, 3, 7, 5], (n) => n, 3)).toEqual([9, 7, 5]);
    expect(largest([1, 2], (n) => n, 3)).toEqual([1, 2]);
  });
});

describe('layers messages', () => {
  it('checks the state the shell sends', () => {
    expect(parseLayersState({ on: true, animate: false, parallax: { x: 0.5, y: -1 }, accent: '#007c83' })).toEqual({
      on: true,
      animate: false,
      parallax: { x: 0.5, y: -1 },
      accent: '#007c83',
    });
    expect(parseLayersState({ on: true, animate: false, parallax: { x: 0, y: 0 }, accent: 'red; x' })?.accent).toBe('#39e6ff');
    expect(parseLayersState({ on: 'yes', animate: false, parallax: { x: 0, y: 0 } })).toBeNull();
    expect(parseLayersState({ on: true, animate: false, parallax: { x: Infinity, y: 0 } })).toBeNull();
  });

  it('checks image reports from a page, dropping addresses that are not web addresses', () => {
    const good = { x: 1, y: 2, width: 30, height: 40, src: 'https://a.example/i.png', alt: 'A', kind: 'img' };
    expect(parseImageReport([good])).toEqual([good]);
    expect(parseImageReport([{ ...good, src: 'javascript:alert(1)' }])![0]!.src).toBe('');
    expect(parseImageReport([{ ...good, kind: 'iframe' }])).toBeNull();
    expect(parseImageReport([{ ...good, width: -5 }])).toBeNull();
    expect(parseImageReport(Array.from({ length: 101 }, () => good))).toBeNull();
    expect(parseImageReport('nope')).toBeNull();
  });
});

describe('liftable (milestone 22)', () => {
  it('lifts what the graphics card can draw as one layer, in device pixels', () => {
    expect(liftable(1200, 8000, 1)).toBe(true);
    expect(liftable(1200, LAYERS.maxLiftDevicePixels, 1)).toBe(true);
    // HoloML's specification: its main section is over 52,000 CSS pixels tall.
    expect(liftable(896, 52_427, 1)).toBe(false);
    // The same section at twice the pixels (a high-density screen, or zoomed in) is too tall sooner.
    expect(liftable(1200, 5000, 2)).toBe(false);
    expect(liftable(1200, 4000, 2)).toBe(true);
    // Too wide is too large too.
    expect(liftable(9000, 400, 1)).toBe(false);
  });

  it('takes a missing or odd device pixel ratio as 1', () => {
    expect(liftable(1200, 8000, Number.NaN)).toBe(true);
    expect(liftable(1200, 8000, 0)).toBe(true);
    expect(liftable(1200, 9000, 0)).toBe(false);
  });
});
