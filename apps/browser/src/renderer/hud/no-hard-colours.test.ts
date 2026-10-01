import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * H8 (milestone 6): the shell takes every colour from the theme (--hs-*
 * variables in its styles, the theme's tokens in the 3D room), so
 * switching themes changes everything together. The room's own code
 * (scene/) is checked too since the review of 2026-09-30 (St3), which
 * found the sun's colours written into it. Three literal colours are
 * deliberate: a web page's own default white background, the black of
 * the scanlines, whose strength the theme sets, and the white of the
 * horizon band's mask, which only shapes the glow (its colour is the
 * theme's, set on the material).
 */
const ALLOWED = ['background: #ffffff;', 'rgb(0 0 0 / calc(var(--hs-scanlines) * 100%))', "g.addColorStop(0, 'rgba(255,255,255,0)');", "g.addColorStop(0.5, 'rgba(255,255,255,0.75)');", "g.addColorStop(1, 'rgba(255,255,255,0)');"];
const COLOUR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;

describe('shell styles', () => {
  it('use theme colours only', () => {
    const dir = join(__dirname, '..');
    const sources = (folder: string) =>
      readdirSync(join(dir, folder))
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
        .map((f) => `${folder}/${f}`);
    const files = ['styles.css', ...sources('hud'), ...sources('scene')];
    expect(files).toContain('scene/room.ts');
    const found: string[] = [];
    for (const file of files) {
      readFileSync(join(dir, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (COLOUR.test(line) && !ALLOWED.some((a) => line.includes(a))) found.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(found).toEqual([]);
  });
});
