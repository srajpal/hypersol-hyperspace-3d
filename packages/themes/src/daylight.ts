import type { Theme } from './schema.js';

/**
 * Daylight: the light theme, a 1990s pastel day (milestone 6). Pale blue
 * sky over a pink and lavender horizon, a teal accent, a lavender grid,
 * near-white glass, dark navy text.
 */
export const daylight: Theme = {
  id: 'daylight',
  name: 'Daylight',
  scheme: 'light',
  colors: {
    backgroundTop: '#bfe3ff',
    backgroundBottom: '#f3e6ff',
    panelGlass: '#fbf8ff',
    accent: '#007c83',
    accent2: '#c93a86',
    horizon: '#ff9ecf',
    warning: '#b3261e',
    text: '#1c1d3b',
    textMuted: '#4f5175',
    floorGrid: '#a88ae8',
    desk: '#f4eeff',
    // Daylight shows no sun; a pale one in its colours, should it be switched on.
    sunTop: '#fff3b0',
    sunMiddle: '#ffc9a8',
    sunBottom: '#ff9ecf',
  },
  glowStrength: 0.35,
  lighting: {
    ambient: { color: '#ffffff', intensity: 1.6 },
    key: { color: '#fff4e0', intensity: 1.0 },
  },
  room: { sun: false, scanlines: 0 },
};
