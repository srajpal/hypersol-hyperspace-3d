import { describe, expect, it } from 'vitest';
import { wrap } from './panels';
import { area, paragraphs } from './values';
import type { ElementNode } from '@hypersol/holoml';

/** Every character one unit wide, spaces too: lines are easy to count. */
const chars = (s: string) => s.length;

const withArea = (value: string): ElementNode =>
  ({ type: 'element', name: 'plan', attributes: [{ name: 'area', value }], children: [] }) as unknown as ElementNode;

describe("a panel's text (HoloML 0.2 panel, milestone 19)", () => {
  it('a blank line starts a paragraph; spaces and single line breaks collapse', () => {
    expect(paragraphs('\n  Kitchen, 14 m²\n\n  Oak worktops,\n  a gas hob.\n')).toEqual(['Kitchen, 14 m²', 'Oak worktops, a gas hob.']);
    // A line of only spaces is blank too; several blank lines make one break.
    expect(paragraphs('One\r\n   \r\n\r\nTwo\n\t\nThree')).toEqual(['One', 'Two', 'Three']);
    expect(paragraphs('  \n \n ')).toEqual([]);
  });

  it('wraps words to the width, a word too long for a line broken where it must be', () => {
    expect(wrap('the quick brown fox jumps', 10, chars)).toEqual(['the quick', 'brown fox', 'jumps']);
    expect(wrap('short', 10, chars)).toEqual(['short']);
    expect(wrap('a harbourside-apartment view', 8, chars)).toEqual(['a', 'harbours', 'ide-apar', 'tment', 'view']);
    for (const line of wrap('Two bedrooms, a study, and a terrace on the roof with a view of the harbour.', 12, chars)) {
      expect(line.length).toBeLessThanOrEqual(12);
    }
  });
});

describe("a floor plan's area (HoloML 0.2 plan, milestone 19)", () => {
  it('reads four numbers, x0 z0 x1 z1, with the second corner beyond the first', () => {
    expect(area(withArea('-6 -4 6 4'))).toEqual([-6, -4, 6, 4]);
    expect(area(withArea(' 0  0 12.5 8 '))).toEqual([0, 0, 12.5, 8]);
    for (const bad of ['6 -4 -6 4', '0 0 0 1', '0 0 1', '0 0 1 1 1', 'a b c d', '0 0 1e999 1']) expect(area(withArea(bad)), bad).toBeNull();
  });
});
