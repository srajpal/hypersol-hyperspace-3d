/**
 * HL3 (milestone 25): the language and direction of a HoloML 0.3 page's
 * text, inherited as in HTML (SPEC.md section 7, "Language and direction").
 */
import { describe, expect, it } from 'vitest';
import { parse, type ElementNode } from '@hypersol/holoml';
import { direction, languages, UNSTATED } from './language';

const page = parse(`<holoml version="0.3" lang="en">
  <scene>
    <group lang="ar" dir="rtl">
      <label>مرحبا</label>
      <label lang="en" dir="ltr">Hello</label>
    </group>
    <label dir="auto">ברוכים הבאים</label>
    <label lang="en_GB" dir="sideways">Kept from the page</label>
  </scene>
</holoml>`).root;

const scene = page.children.find((c): c is ElementNode => c.type === 'element')!;
const elements = scene.children.filter((c): c is ElementNode => c.type === 'element');
const group = elements[0]!;
const [arabic, english] = group.children.filter((c): c is ElementNode => c.type === 'element');

describe('HL3: language and direction', () => {
  const map = languages(page);

  it('a page without them has text in no stated language, left to right', () => {
    const bare = parse('<holoml version="0.3"><scene><label>Hi</label></scene></holoml>').root;
    expect(languages(bare).get(bare)).toEqual(UNSTATED);
  });

  it('takes them from the nearest element that says them, and an element may say its own', () => {
    expect(map.get(page)).toEqual({ lang: 'en', dir: 'ltr' });
    expect(map.get(scene)).toEqual({ lang: 'en', dir: 'ltr' });
    expect(map.get(arabic!)).toEqual({ lang: 'ar', dir: 'rtl' });
    expect(map.get(english!)).toEqual({ lang: 'en', dir: 'ltr' });
    expect(map.get(elements[1]!)).toEqual({ lang: 'en', dir: 'auto' });
  });

  it('a value the checker refuses is not taken: the inherited one stays', () => {
    expect(map.get(elements[2]!)).toEqual({ lang: 'en', dir: 'ltr' });
  });

  it('auto follows the first letter that has a direction; left to right without one', () => {
    expect(direction('auto', 'ברוכים הבאים')).toBe('rtl');
    expect(direction('auto', 'مرحبا')).toBe('rtl');
    expect(direction('auto', '12 — مرحبا')).toBe('rtl');
    expect(direction('auto', 'Hello مرحبا')).toBe('ltr');
    expect(direction('auto', '日本語')).toBe('ltr');
    expect(direction('auto', '123 !?')).toBe('ltr');
    expect(direction('rtl', 'Hello')).toBe('rtl');
    expect(direction('ltr', 'مرحبا')).toBe('ltr');
  });
});
