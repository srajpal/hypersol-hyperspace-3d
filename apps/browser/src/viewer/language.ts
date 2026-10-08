/**
 * The language and direction of a HoloML 0.3 page's text (SPEC.md section
 * 7, "Language and direction"; milestone 25): `lang` and `dir`, taken from
 * the nearest element that says them, as in HTML. A page that says neither
 * has text in no stated language, running left to right.
 */
import type { ElementNode } from '@hypersol/holoml';

export type Direction = 'ltr' | 'rtl' | 'auto';

/** What an element's text says of itself, once inherited: its language (null for none stated) and direction. */
export interface Language {
  lang: string | null;
  dir: Direction;
}

export const UNSTATED: Language = { lang: null, dir: 'ltr' };

const DIRECTIONS = new Set<string>(['ltr', 'rtl', 'auto']);

/** An element's own `lang` and `dir` over what it inherits. A value the checker refuses (it has said so) is not taken. */
export function own(el: ElementNode, inherited: Language): Language {
  let { lang, dir } = inherited;
  for (const a of el.attributes) {
    if (a.name === 'lang' && a.value !== null && /^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$/.test(a.value)) lang = a.value;
    if (a.name === 'dir' && a.value !== null && DIRECTIONS.has(a.value)) dir = a.value as Direction;
  }
  return lang === inherited.lang && dir === inherited.dir ? inherited : { lang, dir };
}

/** Every element's language, walking down from an element that inherits `from`. */
export function languages(root: ElementNode, from: Language = UNSTATED): WeakMap<ElementNode, Language> {
  const out = new WeakMap<ElementNode, Language>();
  const walk = (el: ElementNode, inherited: Language) => {
    const mine = own(el, inherited);
    out.set(el, mine);
    for (const c of el.children) if (c.type === 'element') walk(c, mine);
  };
  walk(root, from);
  return out;
}

// Letters of scripts written from right to left (the Unicode Bidirectional Algorithm's R and AL): Hebrew, Arabic,
// Syriac, Thaana, NKo, Samaritan, Mandaic, and their presentation forms; and letters of any script, for the rest.
const RIGHT_TO_LEFT = /[֐-ࣿיִ-﷿ﹰ-﻿]|\uD802[\uDC00-\uDFFF]|\uD803[\uDC00-\uDE7F]|\uD83A[\uDC00-\uDFFF]|\uD83B[\uDC00-\uDEFF]/u;
const LETTER = /\p{L}/u;

/**
 * The direction text runs in: `ltr` and `rtl` as said; `auto` by the
 * first letter that has a direction (UAX #9, rules P2 and P3), and left to
 * right when none has.
 */
export function direction(dir: Direction, text: string): 'ltr' | 'rtl' {
  if (dir !== 'auto') return dir;
  for (const c of text) {
    if (RIGHT_TO_LEFT.test(c)) return 'rtl';
    if (LETTER.test(c)) return 'ltr';
  }
  return 'ltr';
}

/**
 * Puts a language on an element of the page (an outline item, a label's
 * words, screen text), as HTML's lang and dir. The browser resolves
 * "auto" itself there, also when a script changes the words later.
 */
export function mark(node: HTMLElement, language: Language | undefined): void {
  if (!language) return;
  if (language.lang) node.lang = language.lang;
  else node.removeAttribute('lang');
  node.dir = language.dir;
}
