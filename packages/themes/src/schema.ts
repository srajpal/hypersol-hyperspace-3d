/**
 * A theme is one set of values that feeds both the 2D HUD (as CSS
 * variables) and the 3D room (as Three.js colours and light settings).
 * Colours are 6-digit hex strings in sRGB, the same notation CSS uses.
 */
export interface ThemeColors {
  /** Top of the room's background gradient. */
  backgroundTop: string;
  /** Bottom of the room's background gradient. */
  backgroundBottom: string;
  /** Tint of glass surfaces (panels, bars). */
  panelGlass: string;
  /** The theme's main accent colour: glow edges, focus rings, buttons. */
  accent: string;
  /** A second accent for highlights and the floor grid's glow (milestone 6). */
  accent2: string;
  /** The glow along the horizon, behind the room. */
  horizon: string;
  /** Warnings and errors (error text, destructive buttons). */
  warning: string;
  /** Main text colour. */
  text: string;
  /** Secondary text colour. */
  textMuted: string;
  /** Lines of the room's floor grid. */
  floorGrid: string;
  /** Colour of the desk surface under the page. */
  desk: string;
  /** The retro sun's disc, from its top, through the middle, to its bottom (drawn where room.sun is on). */
  sunTop: string;
  sunMiddle: string;
  sunBottom: string;
}

export type ColorToken = keyof ThemeColors;

export interface LightSetting {
  color: string;
  intensity: number;
}

export interface Theme {
  id: string;
  name: string;
  /** "dark" or "light", for the window's native colour scheme. */
  scheme: 'dark' | 'light';
  colors: ThemeColors;
  /** 0 to 1: how strongly accent glow edges shine. */
  glowStrength: number;
  lighting: {
    ambient: LightSetting;
    key: LightSetting;
  };
  /** Room decorations. */
  room: {
    /** A striped retro sun low on the horizon behind the page. */
    sun: boolean;
    /** Strength of faint scanlines over the room (never over pages), 0 to 0.3. */
    scanlines: number;
  };
}
