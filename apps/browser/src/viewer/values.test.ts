import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse, check, type ElementNode } from '@hypersol/holoml';
import { REACH, area, collapse, color, duration, num, ownProblems, paragraphs, repeat, scale, text, tiling, trimSpace, vec3 } from './values';

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

  it('text is reported where its first character that is not whitespace stands, and is still its element\'s own', () => {
    const doc = parse('<holoml version="0.2">\n<head><title>T</title><script src="a.js">\n   code</script></head>\n<scene />\n</holoml>');
    const problems = check(doc);
    const head = doc.root.children.find((c): c is ElementNode => c.type === 'element' && c.name === 'head')!;
    const script = head.children.find((c): c is ElementNode => c.type === 'element' && c.name === 'script')!;
    expect(problems.map((p) => [p.code, p.line, p.column])).toEqual([['text-not-allowed', 3, 4]]);
    expect(ownProblems(script, problems).map((p) => p.code)).toEqual(['text-not-allowed']);
  });
});

describe('the viewer reads a value where the checker takes it, and falls back where the checker reports it (review 134)', () => {
  /** The first element of a name in a page, at any depth. */
  const find = (el: ElementNode, name: string): ElementNode | undefined => {
    if (el.name === name) return el;
    for (const c of el.children) {
      const found = c.type === 'element' ? find(c, name) : undefined;
      if (found) return found;
    }
    return undefined;
  };

  /**
   * One value, written as an attribute in a 0.2 page: the element that
   * has it, and whether the checker reports it as a bad value. `scene`
   * is the scene's content with VALUE where the value goes.
   */
  function written(scene: string, element: string, attribute: string, value: string): { el: ElementNode; bad: boolean } {
    const doc = parse(`<holoml version="0.2"><scene>${scene.replace('VALUE', value)}</scene></holoml>`);
    const el = find(doc.root, element)!;
    const at = el.attributes.find((a) => a.name === attribute)!.start;
    const bad = check(doc).some((p) => p.code === 'bad-value' && p.line === at.line && p.column === at.column);
    return { el, bad };
  }

  const NBSP = ' ';

  it('a number: the same pattern, and only the four whitespace characters are dropped from around it', () => {
    // A number in each of its forms, whitespace around it, and what is not one: another space in place of whitespace included.
    const GOOD = ['1', '0', '-0', '0.4', '.5', '1.', '1e3', '1E+3', '1.5e-2', '007', ' 2 ', '\t2\n', '\r2\r', '1e-999'];
    const BAD = ['+1', '1..2', '.', '-', 'e3', '1e', '1e+', '0x10', '1 2', '1,5', 'Infinity', 'NaN', '1e999', `${NBSP}2`, `2${NBSP}`, ' 2', '\f2', '2\v', '﻿2', '١'];
    const LIGHT = '<light type="point" intensity="VALUE" />';
    for (const v of [...GOOD, ...BAD]) {
      const { el, bad } = written(LIGHT, 'light', 'intensity', v);
      expect(bad, `intensity=${JSON.stringify(v)} for the checker`).toBe(BAD.includes(v));
      expect(Number.isNaN(num(el, 'intensity', NaN, 0)), `intensity=${JSON.stringify(v)} for the viewer`).toBe(bad);
    }
    expect(num(written(LIGHT, 'light', 'intensity', '1.').el, 'intensity', NaN)).toBe(1);
    expect(num(written(LIGHT, 'light', 'intensity', '\t2\n').el, 'intensity', NaN)).toBe(2);
    expect(num(written(LIGHT, 'light', 'intensity', '1e-999').el, 'intensity', NaN)).toBe(0);
  });

  it('a time: a number in any of its forms, more than 0, followed at once by s or ms', () => {
    const TIMES: [string, number | null][] = [
      ['2s', 2000],
      ['500ms', 500],
      ['1.5e3ms', 1500],
      ['1e3ms', 1000],
      ['1.s', 1000],
      ['.5s', 500],
      ['1E-2s', 10],
      [' 2s\n', 2000],
      ['1e308s', Number.MAX_VALUE],
      ['0s', null],
      ['0ms', null],
      ['1e-999s', null],
      ['-1s', null],
      ['+1s', null],
      ['1 s', null],
      ['1', null],
      ['s', null],
      ['ms', null],
      ['1e999s', null],
      ['2S', null],
      ['2sec', null],
      [`${NBSP}2s`, null],
      [`2s${NBSP}`, null],
    ];
    for (const [v, ms] of TIMES) {
      const { el, bad } = written('<model id="m" src="a.glb" /><animate target="#m" attribute="rotation" to="0 90 0" duration="VALUE" />', 'animate', 'duration', v);
      expect(bad, `duration=${JSON.stringify(v)} for the checker`).toBe(ms === null);
      expect(duration(el, 'duration'), `duration=${JSON.stringify(v)}`).toBe(ms);
    }
  });

  it('a vector, a scale, a tiling, and an area: their numbers are separated by whitespace, and by nothing else', () => {
    const FALLBACK: [number, number, number] = [7, 7, 7];
    const says = (bad: boolean) => `the checker ${bad ? 'reports' : 'takes'} it`;
    const counts = { taken: 0, reported: 0 };
    const count = (bad: boolean) => (bad ? (counts.reported += 1) : (counts.taken += 1));
    for (const v of ['0 1 2', ' 0  1\t2\n', '0\r\n1 2', '.5 1. -2e1', '0 1', '0 1 2 3', '0,1,2', `0${NBSP}1 2`, `0 1 2${NBSP}`, '0\f1 2', '0\v1 2', '0 1 2', '1e999 0 0', '']) {
      const { el, bad } = written('<model src="a.glb" position="VALUE" />', 'model', 'position', v);
      expect(vec3(el, 'position', FALLBACK) === FALLBACK, `position=${JSON.stringify(v)}: ${says(bad)}`).toBe(bad);
      count(bad);
    }
    for (const v of ['2', '1 2 3', ' 2 ', '1 2', `2${NBSP}`, `${NBSP}2`, `1${NBSP}2${NBSP}3`, '1\f2\f3']) {
      const { el, bad } = written('<model src="a.glb" scale="VALUE" />', 'model', 'scale', v);
      expect(scale(el, FALLBACK) === FALLBACK, `scale=${JSON.stringify(v)}: ${says(bad)}`).toBe(bad);
      count(bad);
    }
    for (const v of ['3', '3 2', ' 3\t2 ', '0', '3 0', '-1', '3 2 1', `3${NBSP}2`, '1e999', '3\f2']) {
      const { el, bad } = written('<model src="a.glb"><material name="x" repeat="VALUE" /></model>', 'material', 'repeat', v);
      expect(tiling(el) === null, `a tiling of ${JSON.stringify(v)}: ${says(bad)}`).toBe(bad);
      count(bad);
    }
    for (const v of ['-6 -4 6 4', '\n-6 -4\t6 4 ', '6 -4 -6 4', '0 0 1', '0 0 1 1 1', `0${NBSP}0 1 1`, '0 0 1 1\f']) {
      const { el, bad } = written('<plan src="p.png" area="VALUE" />', 'plan', 'area', v);
      expect(area(el) === null, `area=${JSON.stringify(v)}: ${says(bad)}`).toBe(bad);
      count(bad);
    }
    // The samples have both kinds: 12 the checker takes, 27 it reports.
    expect(counts).toEqual({ taken: 12, reported: 27 });
    expect(vec3(written('<model src="a.glb" position="VALUE" />', 'model', 'position', ' 0  1\t2\n').el, 'position', FALLBACK)).toEqual([0, 1, 2]);
  });

  it('a colour and a count of repeats: whitespace around them is dropped, another space is not', () => {
    for (const [v, read] of [['#fff', '#ffffff'], ['#C0182A', '#c0182a'], [' #fff\n', '#ffffff'], ['#ffff', null], ['red', null], [`${NBSP}#fff`, null], [`#fff${NBSP}`, null], ['\f#fff', null]] as const) {
      const { el, bad } = written('<light type="ambient" color="VALUE" />', 'light', 'color', v);
      expect(bad, `color=${JSON.stringify(v)} for the checker`).toBe(read === null);
      expect(color(el, 'color'), `color=${JSON.stringify(v)}`).toBe(read);
    }
    const COUNTS: [string, number | null][] = [
      ['1', 1],
      ['3', 3],
      ['03', 3],
      [' 3\t', 3],
      ['indefinite', Infinity],
      [' indefinite ', Infinity],
      ['9007199254740991', 9007199254740991],
      ['0', null],
      ['-1', null],
      ['1.5', null],
      ['Indefinite', null],
      ['9007199254740993', null],
      [`${NBSP}3`, null],
      ['3\f', null],
    ];
    for (const [v, runs] of COUNTS) {
      const { el, bad } = written('<model id="m" src="a.glb" /><animate target="#m" attribute="rotation" to="0 90 0" duration="1s" repeat="VALUE" />', 'animate', 'repeat', v);
      expect(bad, `repeat=${JSON.stringify(v)} for the checker`).toBe(runs === null);
      // A count that is not one runs once.
      expect(repeat(el), `repeat=${JSON.stringify(v)}`).toBe(runs ?? 1);
    }
  });

  it('text: runs of whitespace show as one space, with none at the ends; another space is a character of the text', () => {
    expect(trimSpace(` \t\r\n${NBSP} a b \f\n `)).toBe(`${NBSP} a b \f`);
    expect(collapse(`  a \t\r\n b${NBSP} c\fd  `)).toBe(`a b${NBSP} c\fd`);
    const label = (words: string) => find(parse(`<holoml version="0.2"><scene><label>${words}</label></scene></holoml>`).root, 'label')!;
    expect(text(label(`\n  The red\t car,${NBSP}1 of 3\n`))).toBe(`The red car,${NBSP}1 of 3`);
    // A label of another space alone has text for the viewer, as it has for the checker; one of whitespace alone has none.
    const doc = parse(`<holoml version="0.2"><scene><label>${NBSP}</label><label> \t </label></scene></holoml>`);
    expect(check(doc).map((p) => p.code)).toEqual(['empty-text']);
    expect(text(find(doc.root, 'label')!)).toBe(NBSP);
    // A panel's paragraphs: a blank line is one with nothing in it but spaces and tabs.
    expect(paragraphs(`One\n \t\nTwo   words\r\n\r\nThree\n${NBSP}\nstill three\n\f\nand on`)).toEqual(['One', 'Two words', `Three ${NBSP} still three \f and on`]);
  });
});
