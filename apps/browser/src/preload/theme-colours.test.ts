import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { builtInThemes } from '@hypersol/themes';
import { parseAccountsReply } from '../shared/page-passwords';

/**
 * What the page preload draws inside web pages takes its colours from the
 * theme in use, sent by the shell (the layers view's outline) or by the
 * main process (the list of saved sign-ins). Until the review of
 * 2026-09-30 (St3) these files carried copies of the dark theme's
 * colours, so the sign-in list stayed dark in the light theme. The black
 * of a drop shadow is no theme's colour and stays.
 */
const SHADOW = /rgb\(0 0 0 \/ \d+%\)/g;
const COLOUR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;

describe('what the page preload draws', () => {
  it('has no colour of its own: every one comes from the theme in use', () => {
    const found: string[] = [];
    for (const file of ['passwords.ts', 'layers.ts', '../shared/layers.ts', '../shared/page-passwords.ts']) {
      readFileSync(join(__dirname, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (COLOUR.test(line.replace(SHADOW, ''))) found.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(found).toEqual([]);
  });
});

describe('parseAccountsReply', () => {
  const colors = { text: '#1c1d3b', textMuted: '#4f5175', surface: '#fbf8ff', accent: '#007c83' };

  it('takes names with the colours of any built-in theme', () => {
    expect(parseAccountsReply({ names: ['ada', ''], colors })).toEqual({ names: ['ada', ''], colors });
    for (const theme of builtInThemes) {
      const { text, textMuted, panelGlass, accent } = theme.colors;
      expect(parseAccountsReply({ names: ['ada'], colors: { text, textMuted, surface: panelGlass, accent } }), theme.id).not.toBeNull();
    }
  });

  it('shows nothing for no names, or for colours that are not plain colours', () => {
    expect(parseAccountsReply(null)).toBeNull();
    expect(parseAccountsReply([])).toBeNull();
    expect(parseAccountsReply(['ada'])).toBeNull(); // the answer's form before colours were sent
    expect(parseAccountsReply({ names: [], colors })).toBeNull();
    expect(parseAccountsReply({ names: [42, null], colors })).toBeNull();
    expect(parseAccountsReply({ names: ['ada'] })).toBeNull();
    expect(parseAccountsReply({ names: ['ada'], colors: { ...colors, accent: 'red; background: url(https://evil.example/)' } })).toBeNull();
    expect(parseAccountsReply({ names: ['ada'], colors: { ...colors, surface: '#fff' } })).toBeNull();
  });
});
