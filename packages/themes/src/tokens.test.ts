import { describe, expect, it } from 'vitest';
import {
  builtInThemes,
  contrastRatio,
  daylight,
  themeById,
  cssVarName,
  hexToNumber,
  nebula,
  numberToHex,
  threeColor,
  toCssVariables,
  validateTheme,
  type ColorToken,
} from './index.js';

describe('theme tokens', () => {
  it('names CSS variables from token names', () => {
    expect(cssVarName('accent')).toBe('--hs-accent');
    expect(cssVarName('backgroundTop')).toBe('--hs-background-top');
    expect(cssVarName('textMuted')).toBe('--hs-text-muted');
  });

  it('converts hex both ways without loss', () => {
    expect(hexToNumber('#5ce1ff')).toBe(0x5ce1ff);
    expect(numberToHex(0x5ce1ff)).toBe('#5ce1ff');
    expect(numberToHex(0)).toBe('#000000');
    expect(() => hexToNumber('#fff')).toThrow();
    expect(() => hexToNumber('red')).toThrow();
    expect(() => numberToHex(0x1000000)).toThrow();
  });

  it('gives matching CSS and 3D colours for every token of every built-in theme', () => {
    for (const theme of builtInThemes) {
      const vars = toCssVariables(theme);
      for (const token of Object.keys(theme.colors) as ColorToken[]) {
        const css = vars[cssVarName(token)];
        expect(css, `${theme.id}.${token}`).toBeDefined();
        expect(hexToNumber(css!)).toBe(threeColor(theme, token));
      }
    }
  });

  it('built-in themes are valid', () => {
    for (const theme of builtInThemes) {
      expect(validateTheme(theme)).toEqual([]);
    }
  });

  it('has Nebula (dark, the default) and Daylight (light)', () => {
    expect(builtInThemes.map((t) => [t.id, t.scheme])).toEqual([
      ['nebula', 'dark'],
      ['daylight', 'light'],
    ]);
    expect(themeById('daylight')).toBe(daylight);
    expect(themeById('nope')).toBe(nebula);
  });

  it("has the sun's colours as tokens in every theme (review of 2026-09-30, St3)", () => {
    for (const theme of builtInThemes) {
      const vars = toCssVariables(theme);
      for (const token of ['sunTop', 'sunMiddle', 'sunBottom'] as const) {
        expect(theme.colors[token], `${theme.id}.${token}`).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(vars['--hs-sun-top']).toBe(theme.colors.sunTop);
      expect(vars['--hs-sun-bottom']).toBe(theme.colors.sunBottom);
    }
    // Nebula's sun keeps the colours it was drawn with before they were tokens.
    expect([nebula.colors.sunTop, nebula.colors.sunMiddle, nebula.colors.sunBottom]).toEqual(['#ffe36b', '#ff8a4c', '#ff2f92']);
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('meets WCAG AA contrast on both themes (H5)', () => {
    for (const t of builtInThemes) {
      const c = t.colors;
      for (const surface of [c.panelGlass, c.backgroundTop, c.desk]) {
        expect(contrastRatio(c.text, surface), `${t.id} text on ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(c.textMuted, surface), `${t.id} muted text on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(c.warning, c.panelGlass), `${t.id} warning`).toBeGreaterThanOrEqual(4.5);
      // Buttons and focus rings are user-interface parts: 3:1.
      expect(contrastRatio(c.accent, c.panelGlass), `${t.id} accent`).toBeGreaterThanOrEqual(3);
    }
  });

  it('reports invalid values', () => {
    const broken = {
      ...nebula,
      glowStrength: 2,
      colors: { ...nebula.colors, accent: 'cyan' },
    };
    const problems = validateTheme(broken);
    expect(problems).toContain('colors.accent is not #rrggbb: cyan');
    expect(problems).toContain('glowStrength must be between 0 and 1');
  });
});
