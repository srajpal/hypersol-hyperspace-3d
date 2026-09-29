/**
 * Panels (HoloML 0.2 `panel`, milestone 19; holoml issue #11): text of
 * more than one line on a flat board, placed and turned like a model.
 * The words are wrapped to the panel's width and drawn into a picture on
 * the board, sharp from a step away.
 */
import { BackSide, CanvasTexture, FrontSide, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, SRGBColorSpace } from 'three';

/** Pixels a metre on a panel's picture: sharp from a step away. */
const PANEL_PX = 1000;
/** The largest side of a panel's picture; a larger panel is drawn less finely. */
const PANEL_MAX_PX = 4096;

/** A panel's words and look (HoloML 0.2 `panel`), kept to draw it again when a script changes the words. */
export interface PanelLook {
  paragraphs: string[];
  /** Its lines as wrapped, paragraph by paragraph. */
  lines: string[][];
  width: number;
  height: number;
  size: number;
  color: string;
  background: string | null;
  /** Its picture's size, in pixels. */
  pixels: [number, number];
  /** Its words in the page, for Find in page; and in the outline, after its button. */
  note: HTMLElement;
  words: HTMLElement | null;
}

const PANEL_FONT = (px: number) => `500 ${px}px system-ui, "Segoe UI", sans-serif`;

/**
 * Lays out a panel's words, wrapped to its width, and draws them on its
 * board (again, when a script changes them): a line is `size` high, with
 * room between lines and more between paragraphs. The board shows its
 * colour behind; without one, the text alone. The panel is as tall as
 * its text.
 */
export function drawPanel(holder: Object3D, look: PanelLook, anisotropy: number): void {
  const { width, size } = look;
  const pad = look.background ? size * 0.8 : size * 0.3;
  const inner = Math.max(size, width - 2 * pad);
  const line = size * 1.4;
  const gap = size * 0.7;
  // Measured at 100 pixels a line, in metres.
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = PANEL_FONT(100);
  const measure = (s: string) => (probe.measureText(s).width / 100) * size;
  look.lines = look.paragraphs.map((p) => wrap(p, inner, measure));
  const count = look.lines.reduce((n, l) => n + l.length, 0);
  look.height = 2 * pad + Math.max(1, count) * line + Math.max(0, look.lines.length - 1) * gap;
  const k = Math.min(PANEL_PX, PANEL_MAX_PX / width, PANEL_MAX_PX / look.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * k));
  canvas.height = Math.max(1, Math.round(look.height * k));
  look.pixels = [canvas.width, canvas.height];
  const ctx = canvas.getContext('2d')!;
  if (look.background) {
    ctx.fillStyle = look.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * k * 0.12;
  }
  ctx.font = PANEL_FONT(size * k);
  ctx.fillStyle = look.color;
  ctx.textBaseline = 'middle';
  let y = pad;
  for (const lines of look.lines) {
    for (const l of lines) {
      ctx.fillText(l, pad * k, (y + line / 2) * k);
      y += line;
    }
    y += gap;
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  disposePanel(holder);
  const geometry = new PlaneGeometry(width, look.height);
  // Unlit, as labels are, so the words read the same by day and by night.
  holder.add(new Mesh(geometry, new MeshBasicMaterial({ map: texture, transparent: !look.background, depthWrite: look.background !== null, toneMapped: false, side: FrontSide })));
  // Its back: the board, without the words (mirrored words would read backwards).
  if (look.background) holder.add(new Mesh(geometry, new MeshBasicMaterial({ color: look.background, toneMapped: false, side: BackSide })));
}

/** Releases a panel's board and picture. */
export function disposePanel(holder: Object3D): void {
  for (const c of [...holder.children]) {
    if (!(c instanceof Mesh)) continue;
    c.geometry.dispose();
    const m = c.material as MeshBasicMaterial;
    m.map?.dispose();
    m.dispose();
    c.removeFromParent();
  }
}

/** Breaks a paragraph into lines no wider than `width`; a word wider than a line is broken where it must be. */
export function wrap(paragraph: string, width: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of paragraph.split(' ')) {
    const longer = current ? `${current} ${word}` : word;
    if (measure(longer) <= width) {
      current = longer;
      continue;
    }
    if (current) lines.push(current);
    let rest = word;
    while (rest.length > 1 && measure(rest) > width) {
      let n = rest.length - 1;
      while (n > 1 && measure(rest.slice(0, n)) > width) n--;
      lines.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines;
}
