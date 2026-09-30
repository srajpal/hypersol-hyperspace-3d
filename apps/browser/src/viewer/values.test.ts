import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse, check, type ElementNode } from '@hypersol/holoml';
import { REACH, num, ownProblems, scale, vec3 } from './values';

const el = (attributes: Record<string, string>): ElementNode =>
  ({
    type: 'element',
    name: 'model',
    attributes: Object.entries(attributes).map(([name, value], i) => ({ name, value, start: { line: 3, column: 8 + i, offset: 0 } })),
    children: [],
    start: { line: 3, column: 1, offset: 0 },
  }) as unknown as ElementNode;

describe('reading numbers (review 134, L1)', () => {
  it('reads what the specification calls a number', () => {
    for (const [written, value] of [['1', 1], ['-2.5', -2.5], ['3.', 3], ['.5', 0.5], ['1e3', 1000], ['-1.5E-2', -0.015]] as const) {
      expect(num(el({ size: written }), 'size', NaN), written).toBe(value);
    }
    for (const bad of ['', '+1', '1..2', '.', 'e3', '1e', '0x10', '1 2', 'Infinity', '1e999']) expect(num(el({ size: bad }), 'size', 7), bad).toBe(7);
  });

  it('refuses 200,000 digits that are not a number in well under 100 ms', () => {
    const long = `${'1'.repeat(200_000)}x`;
    const start = performance.now();
    expect(num(el({ size: long }), 'size', 7)).toBe(7);
    expect(vec3(el({ position: `0 ${long} 0` }), 'position', [1, 2, 3])).toEqual([1, 2, 3]);
    expect(scale(el({ scale: long }))).toEqual([1, 1, 1]);
    expect(performance.now() - start).toBeLessThan(100);
  });
});

describe('places within reach (review 134, V5)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps a place within a thousand kilometres, and falls back to the default beyond, saying so once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(vec3(el({ position: `${REACH} -${REACH} 0.5` }), 'position', [0, 0, 0])).toEqual([REACH, -REACH, 0.5]);
    expect(warn).not.toHaveBeenCalled();
    const far = el({ position: '1e17 2 0', scale: '1 1e9 1' });
    expect(vec3(far, 'position', [0, 1.6, 5])).toEqual([0, 1.6, 5]);
    expect(vec3(far, 'position', [0, 1.6, 5])).toEqual([0, 1.6, 5]);
    expect(scale(far)).toEqual([1, 1, 1]);
    // A turn of many degrees is only a turn, and an animation's ends are the page's to choose.
    expect(vec3(el({ rotation: '0 36000000 0' }), 'rotation', [0, 0, 0])).toEqual([0, 36000000, 0]);
    expect(vec3(el({ to: '0 36000000 0' }), 'to', [0, 0, 0])).toEqual([0, 36000000, 0]);
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([
      'HoloML: line 3, column 8: "position" is beyond 1,000,000; the default is used instead.',
      'HoloML: line 3, column 9: "scale" is beyond 1,000,000; the default is used instead.',
    ]);
  });
});

describe("an element's own problems (review 134, V10)", () => {
  it('counts a problem at its tag, its attributes, or what is written inside it, not one that shares its line', () => {
    const doc = parse('<holoml version="0.2">\n<head><title>T</title><meta nonsense="1" /><script src="a.js" /><script src="b.txt" /><script>x</script></head>\n<scene />\n</holoml>');
    const problems = check(doc);
    const head = doc.root.children.find((c): c is ElementNode => c.type === 'element' && c.name === 'head')!;
    const [a, b, inline] = head.children.filter((c): c is ElementNode => c.type === 'element' && c.name === 'script');
    // The line has problems (the meta's attribute, the second script's file, the third's code), and none is the first script's.
    expect(problems.filter((p) => p.line === 2).length).toBeGreaterThanOrEqual(3);
    expect(ownProblems(a!, problems)).toEqual([]);
    expect(ownProblems(b!, problems).map((p) => p.code)).toEqual(['bad-value']);
    expect(ownProblems(inline!, problems).map((p) => p.code)).toContain('text-not-allowed');
  });
});
