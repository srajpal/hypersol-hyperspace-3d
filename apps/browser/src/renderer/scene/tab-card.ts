import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import type { Theme } from '@hypersol/themes';

// Two-thirds of the milestone 2 size (owner, prompt 33: the cards took too
// much of the screen). The drawing keeps its full resolution, with larger
// type, so the smaller card stays readable.
export const CARD_WIDTH = 136;
export const CARD_HEIGHT = 102;
const W = 400; // canvas pixels
const H = 300;
const SCALE = W / CARD_WIDTH; // canvas pixels per world unit, for sharp text
const SNAP = { x: 8, y: 8, w: W - 16, h: 214 };
const BAR_Y = 228;
const CLOSE = { cx: 360, cy: 264, r: 24 };
/** The speaker, left of the close button, on a tab that makes sound or is muted (milestone 10). */
const AUDIO = { cx: 304, cy: 264, r: 22 };

export type CardPart = 'body' | 'close' | 'audio';

export interface CardModel {
  /** Tab id, or 'plus' for the new-tab card. */
  key: number | 'plus';
  title: string;
  loading: boolean;
  favicon?: string;
  focused: boolean;
  /** A private tab: marked on its card. */
  private?: boolean;
  /** Its page was given the camera, microphone, or location: marked on its card (milestone 9). */
  access?: boolean;
  /** Milestone 10: its page makes sound; it is muted; it is asleep. */
  audible?: boolean;
  muted?: boolean;
  asleep?: boolean;
}

/**
 * One tab card in the room: the page's snapshot, its favicon and title,
 * and a close button (shown on hover, always on the focused card, so
 * touch can reach it). Drawn into a canvas texture on a plane.
 */
export class TabCard {
  readonly mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: CanvasTexture;
  private model: CardModel;
  private snapshot: HTMLImageElement | null = null;
  /** When the card last got a picture (performance.now()), for the tests. */
  snapshotAt = 0;
  private favicon: HTMLImageElement | null = null;
  private faviconSrc: string | undefined;
  private hovered = false;
  private hoverClose = false;
  private spinAngle = 0;

  constructor(
    model: CardModel,
    private theme: Theme,
    private readonly onRedraw: () => void,
  ) {
    this.model = model;
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.mesh = new Mesh(
      new PlaneGeometry(CARD_WIDTH, CARD_HEIGHT),
      new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, fog: false }),
    );
    this.mesh.userData['card'] = this;
    this.setFavicon(model.favicon);
    this.draw();
  }

  get key(): number | 'plus' {
    return this.model.key;
  }

  /** True while the card shows a spinner and needs frames. */
  get spinning(): boolean {
    return this.model.key !== 'plus' && this.model.loading && this.snapshot === null;
  }

  get hasSnapshot(): boolean {
    return this.snapshot !== null;
  }

  /** The picture on the card (a data address), for the tests. */
  get snapshotSrc(): string | null {
    return this.snapshot?.src ?? null;
  }

  update(model: CardModel): void {
    const changed =
      model.title !== this.model.title ||
      model.loading !== this.model.loading ||
      model.focused !== this.model.focused ||
      model.favicon !== this.model.favicon ||
      Boolean(model.access) !== Boolean(this.model.access) ||
      Boolean(model.audible) !== Boolean(this.model.audible) ||
      Boolean(model.muted) !== Boolean(this.model.muted) ||
      Boolean(model.asleep) !== Boolean(this.model.asleep);
    this.model = model;
    if (model.favicon !== this.faviconSrc) this.setFavicon(model.favicon);
    if (changed) this.draw();
  }

  setSnapshot(dataUrl: string): void {
    const img = new Image();
    img.onload = () => {
      this.snapshot = img;
      this.snapshotAt = performance.now();
      this.draw();
      this.onRedraw();
    };
    img.src = dataUrl;
  }

  setHover(hovered: boolean, overClose: boolean): boolean {
    if (hovered === this.hovered && overClose === this.hoverClose) return false;
    this.hovered = hovered;
    this.hoverClose = overClose;
    this.draw();
    return true;
  }

  setOpacity(opacity: number): void {
    this.mesh.material.opacity = opacity;
    this.mesh.visible = opacity > 0;
  }

  /** Advances the spinner; call once per frame while spinning. */
  tick(dtMs: number): void {
    this.spinAngle = (this.spinAngle + dtMs * 0.006) % (Math.PI * 2);
    this.draw();
  }

  /** Which part of the card a texture coordinate falls on. */
  partAt(u: number, v: number): CardPart {
    const x = u * W;
    const y = (1 - v) * H;
    const showsClose = this.model.key !== 'plus' && (this.hovered || this.model.focused);
    if (showsClose && Math.hypot(x - CLOSE.cx, y - CLOSE.cy) <= CLOSE.r + 6) return 'close';
    if (this.showsAudio && Math.hypot(x - AUDIO.cx, y - AUDIO.cy) <= AUDIO.r + 6) return 'audio';
    return 'body';
  }

  private get showsAudio(): boolean {
    return this.model.key !== 'plus' && Boolean(this.model.audible || this.model.muted);
  }

  /** A point on the card in its local coordinates (for tests and hit checks). */
  static localPoint(part: CardPart): { x: number; y: number } {
    if (part === 'close') return { x: CLOSE.cx / SCALE - CARD_WIDTH / 2, y: CARD_HEIGHT / 2 - CLOSE.cy / SCALE };
    if (part === 'audio') return { x: AUDIO.cx / SCALE - CARD_WIDTH / 2, y: CARD_HEIGHT / 2 - AUDIO.cy / SCALE };
    return { x: 0, y: 12 };
  }

  dispose(): void {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  private setFavicon(src: string | undefined): void {
    this.faviconSrc = src;
    this.favicon = null;
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      if (this.faviconSrc !== src) return;
      this.favicon = img;
      this.draw();
      this.onRedraw();
    };
    img.src = src;
  }

  /** Redraws the card in another theme's colours. */
  setTheme(theme: Theme): void {
    this.theme = theme;
    this.draw();
  }

  private draw(): void {
    const { ctx } = this;
    const c = this.theme.colors;
    const focused = this.model.focused;
    ctx.clearRect(0, 0, W, H);

    roundRect(ctx, 2, 2, W - 4, H - 4, 18);
    ctx.fillStyle = c.panelGlass;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = focused ? 5 : 3;
    ctx.strokeStyle = focused ? c.accent : this.hovered ? c.text : c.textMuted;
    if (this.model.key === 'plus') ctx.setLineDash([14, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (this.model.key === 'plus') {
      ctx.fillStyle = this.hovered ? c.accent : c.text;
      ctx.font = '300 140px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', W / 2, 118);
      ctx.font = '600 38px system-ui, sans-serif';
      ctx.fillText('New tab', W / 2, 246);
      this.texture.needsUpdate = true;
      return;
    }

    // Snapshot area.
    ctx.save();
    roundRect(ctx, SNAP.x, SNAP.y, SNAP.w, SNAP.h, 12);
    ctx.clip();
    if (this.snapshot) {
      const img = this.snapshot;
      const scale = Math.max(SNAP.w / img.width, SNAP.h / img.height);
      // Top of the page, like a thumbnail.
      ctx.drawImage(img, SNAP.x + (SNAP.w - img.width * scale) / 2, SNAP.y, img.width * scale, img.height * scale);
    } else {
      ctx.fillStyle = c.backgroundTop;
      ctx.fillRect(SNAP.x, SNAP.y, SNAP.w, SNAP.h);
      if (this.spinning) {
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(W / 2, SNAP.y + SNAP.h / 2, 26, this.spinAngle, this.spinAngle + Math.PI * 1.4);
        ctx.stroke();
      } else {
        ctx.fillStyle = c.textMuted;
        ctx.font = '600 64px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((this.model.title.trim()[0] ?? '·').toUpperCase(), W / 2, SNAP.y + SNAP.h / 2);
      }
    }
    ctx.restore();

    if (this.model.private) {
      // A private tab is marked on its card (milestone 8).
      ctx.fillStyle = c.accent2;
      roundRect(ctx, SNAP.x + 10, SNAP.y + 10, 150, 40, 8);
      ctx.fill();
      ctx.fillStyle = c.backgroundBottom;
      ctx.font = '700 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PRIVATE', SNAP.x + 85, SNAP.y + 31);
    }

    if (this.model.asleep) {
      // Asleep (milestone 10): the snapshot dims and says so.
      ctx.save();
      roundRect(ctx, SNAP.x, SNAP.y, SNAP.w, SNAP.h, 12);
      ctx.fillStyle = c.backgroundBottom;
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = c.textMuted;
      roundRect(ctx, SNAP.x + 10, SNAP.y + SNAP.h - 50, 150, 40, 8);
      ctx.fill();
      ctx.fillStyle = c.backgroundBottom;
      ctx.font = '700 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ASLEEP', SNAP.x + 85, SNAP.y + SNAP.h - 29);
    }

    if (this.model.access) {
      // The page was given the camera, microphone, or location (milestone 9).
      ctx.fillStyle = c.warning;
      roundRect(ctx, SNAP.x + SNAP.w - 110, SNAP.y + 10, 100, 40, 8);
      ctx.fill();
      ctx.fillStyle = c.backgroundBottom;
      ctx.beginPath();
      ctx.arc(SNAP.x + SNAP.w - 88, SNAP.y + 30, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '700 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LIVE', SNAP.x + SNAP.w - 50, SNAP.y + 31);
    }

    // Label bar: favicon, title, close button.
    let textX = 18;
    if (this.favicon) {
      ctx.drawImage(this.favicon, 14, BAR_Y + 14, 44, 44);
      textX = 68;
    }
    const showsClose = this.hovered || focused;
    const right = this.showsAudio ? AUDIO.cx - AUDIO.r - 10 : showsClose ? CLOSE.cx - CLOSE.r - 10 : W - 16;
    const maxText = right - textX;
    ctx.fillStyle = c.text;
    ctx.font = '600 32px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(fit(ctx, this.model.title || 'Untitled', maxText), textX, BAR_Y + 36);

    if (this.showsAudio) {
      // A speaker (milestone 10): sound waves while it plays, a slash when muted.
      const { cx, cy } = AUDIO;
      ctx.beginPath();
      ctx.arc(cx, cy, AUDIO.r, 0, Math.PI * 2);
      ctx.fillStyle = this.model.muted ? c.backgroundTop : c.accent;
      ctx.fill();
      ctx.fillStyle = this.model.muted ? c.text : c.backgroundBottom;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy - 5);
      ctx.lineTo(cx - 6, cy - 5);
      ctx.lineTo(cx + 2, cy - 12);
      ctx.lineTo(cx + 2, cy + 12);
      ctx.lineTo(cx - 6, cy + 5);
      ctx.lineTo(cx - 12, cy + 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (this.model.muted) {
        ctx.moveTo(cx + 6, cy - 7);
        ctx.lineTo(cx + 14, cy + 7);
        ctx.moveTo(cx + 14, cy - 7);
        ctx.lineTo(cx + 6, cy + 7);
      } else {
        ctx.arc(cx + 2, cy, 9, -0.8, 0.8);
      }
      ctx.stroke();
    }

    if (showsClose) {
      ctx.beginPath();
      ctx.arc(CLOSE.cx, CLOSE.cy, CLOSE.r, 0, Math.PI * 2);
      ctx.fillStyle = this.hoverClose ? c.accent : c.backgroundTop;
      ctx.fill();
      ctx.strokeStyle = this.hoverClose ? c.backgroundBottom : c.text;
      ctx.lineWidth = 3;
      const d = 8;
      ctx.beginPath();
      ctx.moveTo(CLOSE.cx - d, CLOSE.cy - d);
      ctx.lineTo(CLOSE.cx + d, CLOSE.cy + d);
      ctx.moveTo(CLOSE.cx + d, CLOSE.cy - d);
      ctx.lineTo(CLOSE.cx - d, CLOSE.cy + d);
      ctx.stroke();
    }
    this.texture.needsUpdate = true;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Shortens text with an ellipsis to fit a width. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= width) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
}
