import type { Theme } from './schema.js';

/**
 * Nebula: the dark default theme, a 1980s synthwave night (milestone 6,
 * owner direction prompt 29). Deep indigo sky over a magenta horizon, a
 * striped retro sun, a violet neon floor grid, cyan as the accent.
 */
export const nebula: Theme = {
  id: 'nebula',
  name: 'Nebula',
  scheme: 'dark',
  colors: {
    backgroundTop: '#07051a',
    backgroundBottom: '#1b0b3a',
    panelGlass: '#16123a',
    accent: '#39e6ff',
    accent2: '#ff4fd8',
    horizon: '#ff3d9a',
    warning: '#ffb86b',
    text: '#f1ecff',
    textMuted: '#aca3da',
    floorGrid: '#b43cff',
    desk: '#140d33',
    sunTop: '#ffe36b',
    sunMiddle: '#ff8a4c',
    sunBottom: '#ff2f92',
  },
  glowStrength: 0.7,
  lighting: {
    ambient: { color: '#7a5cff', intensity: 0.7 },
    key: { color: '#ffd6f5', intensity: 1.1 },
  },
  room: { sun: true, scanlines: 0.06 },
};
