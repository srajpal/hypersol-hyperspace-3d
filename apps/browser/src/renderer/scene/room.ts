import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Euler,
  Fog,
  GridHelper,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferAttribute,
  type Object3D,
} from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import {
  DEFAULT_PARALLAX,
  Parallax,
  clampScroll,
  computePanelLayout,
  computeTabArc,
  pointInPolygon,
  scrollToShow,
  type Insets,
  type PanelLayout,
  type TabArcInput,
  type TabArcLayout,
  type Vec2,
} from '@hypersol/scene-core';
import type { Theme } from '@hypersol/themes';
import { CARD_HEIGHT, CARD_WIDTH, TabCard, type CardModel, type CardPart } from './tab-card';
import type { TabView } from './tab-view';

/** Height kept free at the top for the HUD. */
export const HUD_HEIGHT = 64;
// The rail starts well inside the window: cards sit nearer the camera than
// the page, so perspective pushes them outward.
const RAIL = { left: 40, width: CARD_WIDTH, bottomMargin: 24, gap: 12 };
/** Room for the page. The tab rail only shows with two or more tabs (owner, prompt 33). */
const PAGE_INSETS: Insets = { top: HUD_HEIGHT, right: 36, bottom: 36, left: RAIL.left + RAIL.width + 32 };
/** Card sizes (milestone 10): medium is the size since milestone 6. */
export const CARD_SCALES = { small: 0.8, medium: 1, large: 1.3 } as const;
export type TabDisplayMode = 'cards' | 'list';
/** Space around the page (milestone 11): the free margin on the right and bottom, and the left without the rail. */
export const PAGE_MARGINS = { compact: 16, normal: 36, roomy: 72 } as const;
export type PageMarginSize = keyof typeof PAGE_MARGINS;
/** How much the room moves with the pointer (milestone 11), as a share of the default. */
export const PARALLAX_AMOUNTS = { off: 0, subtle: 0.5, normal: 1 } as const;
/** Economy mode's frame cap. */
const ECONOMY_FPS = 30;
const GLOW_MARGIN = 64;
const DESK_DEPTH = 360;
const SWITCH_MS = 250;

export interface RoomCallbacks {
  onCardClick(key: number | 'plus'): void;
  onCardClose(key: number): void;
  /** The speaker on a card: mute or unmute that tab (milestone 10). */
  onCardAudio?(key: number): void;
}

export interface RoomOptions {
  tiltDeg: number;
  fovDeg?: number;
  callbacks: RoomCallbacks;
}

interface Pose {
  position: Vector3;
  rotation: Euler;
  scale: number;
}

interface Tween {
  object: Object3D;
  from: Pose;
  to: () => Pose;
  start: number;
  duration: number;
  done?: () => void;
}

interface ViewEntry {
  view: TabView;
  object: CSS3DObject;
}

/**
 * The 3D room: a WebGL scene (floor, desk, glow, tab cards) with the
 * focused page placed on top by the CSS 3D renderer, seen from a fixed
 * desk camera with a small pointer parallax.
 *
 * Frames are drawn only while something changes (a resize, the camera
 * moving, a switch animation, the spinner of a card in view), so an idle
 * room costs nothing.
 */
export class Room {
  /** Frames drawn so far; read by the idle-efficiency check (C9). */
  frames = 0;
  readonly parallax = new Parallax();
  /** Called on each frame the camera's parallax moves, with the offset as -1 to 1 on each axis (y up). */
  onCameraMove: ((offset: { x: number; y: number }) => void) | null = null;
  /** Null where Chromium cannot start WebGL 2: the page and the top bar still work, the room is not drawn (milestone 12, owner prompt 60). */
  private readonly webgl: WebGLRenderer | null;
  /** The room's canvas, or a stand-in without WebGL, so the pointer wiring stays the same. */
  private readonly canvas: HTMLCanvasElement;
  private readonly css: CSS3DRenderer;
  private readonly cameraElement: HTMLElement;
  private readonly scene = new Scene();
  private readonly cssScene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly glow: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly desk: Mesh<BoxGeometry, MeshStandardMaterial>;
  private grid: GridHelper;
  private readonly ambient: AmbientLight;
  private readonly key: DirectionalLight;
  /** A glow band along the horizon, far behind the page (milestone 6). */
  private readonly horizon: Mesh<PlaneGeometry, MeshBasicMaterial>;
  /** A striped retro sun on the horizon, for themes that have one. */
  private readonly sun: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly views = new Map<number, ViewEntry>();
  private readonly cards = new Map<number | 'plus', TabCard>();
  private order: (number | 'plus')[] = [];
  private focusedId = -1;
  private railScroll = 0;
  private tweens: Tween[] = [];
  private currentLayout!: PanelLayout;
  private arc!: TabArcLayout;
  private framePending = false;
  private lastFrameTime = 0;
  private hoveredCard: TabCard | null = null;
  /** The WebGL context is lost (a graphics reset): the room is not drawn until it is restored; the pages still are. */
  private contextLost = false;
  /** Whether the tab rail shows: only with two or more tabs. */
  private railShown = false;
  private extra = { right: 0, bottom: 0 };
  /** Milestone 10: card size, how tabs are shown, room above the page for the tab list, economy mode. */
  private cardScale = 1;
  private display: TabDisplayMode = 'cards';
  /** Milestone 11: which way the page leans, and the space around it. */
  private direction: 1 | -1 = 1;
  private margin: number = PAGE_MARGINS.normal;
  private tabCount = 0;
  private topExtra = 0;
  private economy = false;
  /** A HoloML page in front (milestone 14): the page fills the window, flat and still. */
  private fill = false;
  private lastDrawn = 0;
  /** The last few parallax decisions, for diagnosing test failures. */
  readonly pointerLog: { x: number; y: number; target: string; overPage: boolean }[] = [];
  private readonly raycaster = new Raycaster();
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(
    container: HTMLElement,
    private theme: Theme,
    private readonly options: RoomOptions,
  ) {
    // Three.js throws when Chromium refuses WebGL 2 (no graphics driver, a
    // virtual machine, or WebGL switched off); the browser still starts,
    // without the room, and the app says so.
    let webgl: WebGLRenderer | null = null;
    try {
      webgl = new WebGLRenderer({ antialias: true, alpha: true });
      webgl.setPixelRatio(window.devicePixelRatio);
      webgl.setClearColor(0x000000, 0);
    } catch {
      webgl = null;
    }
    this.webgl = webgl;
    this.canvas = webgl?.domElement ?? document.createElement('canvas');
    container.append(this.canvas);
    // A graphics reset (driver update, GPU switch, sleep) loses the WebGL
    // context. The room is not drawn while it is lost (the pages, placed
    // with CSS, still follow tab switches and resizes); when it comes
    // back, the room draws again at once, without waiting for input
    // (GitHub issue #12). Three.js uploads the textures (room, cards,
    // snapshots) again from their images on that first frame.
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); // allows the browser to restore it
      this.contextLost = true;
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.lastFrameTime = 0;
      this.requestRender();
    });

    this.css = new CSS3DRenderer();
    this.css.domElement.classList.add('hs-css-layer');
    container.append(this.css.domElement);
    // CSS3DRenderer nests: domElement > view element > camera element. Pages
    // go straight into the camera element, where the renderer keeps them;
    // anywhere else it moves them on the first frame, and a moved webview
    // is destroyed and loads its page again.
    this.cameraElement = this.css.domElement.firstElementChild!.firstElementChild as HTMLElement;

    this.camera = new PerspectiveCamera(options.fovDeg ?? 40, 1, 1, 20000);

    const c = theme.colors;
    this.scene.fog = new Fog(new Color(c.backgroundBottom), 1500, 6000);
    this.ambient = new AmbientLight(new Color(theme.lighting.ambient.color), theme.lighting.ambient.intensity);
    this.key = new DirectionalLight(new Color(theme.lighting.key.color), theme.lighting.key.intensity);
    this.key.position.set(-400, 900, 800);
    this.scene.add(this.ambient, this.key);

    this.grid = new GridHelper(8000, 80, new Color(c.floorGrid), new Color(c.floorGrid));
    this.scene.add(this.grid);

    this.horizon = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ color: new Color(c.horizon), map: makeBandTexture(), transparent: true, depthWrite: false, fog: false }),
    );
    this.sun = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ map: makeSunTexture(), transparent: true, depthWrite: false, fog: false }),
    );
    this.sun.visible = theme.room.sun;
    // Drawn first, behind everything else in the room.
    this.horizon.renderOrder = -2;
    this.sun.renderOrder = -1;
    this.scene.add(this.horizon, this.sun);

    this.desk = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ color: new Color(c.desk), roughness: 0.6, metalness: 0.2 }),
    );
    this.scene.add(this.desk);

    this.glow = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        color: new Color(c.accent),
        map: makeGlowTexture(),
        transparent: true,
        opacity: theme.glowStrength,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.scene.add(this.glow);

    this.layout();
    window.addEventListener('resize', () => {
      this.layout();
      this.requestRender();
    });
    this.watchPixelRatio();
    // Reduced motion (the system's setting) covers the room's own movement
    // too: the camera holds still and loading cards show a still mark.
    this.reducedMotion.addEventListener('change', () => {
      const still = this.reducedMotion.matches;
      if (still) this.centreCamera();
      for (const card of this.cards.values()) card.setStill(still);
      this.requestRender();
    });
    this.wirePointer();
    this.requestRender();
  }

  get layoutInfo(): PanelLayout {
    return this.currentLayout;
  }

  get animating(): boolean {
    return this.tweens.length > 0;
  }

  get rail(): { scroll: number; maxScroll: number; fits: number } {
    return { scroll: this.arc.scroll, maxScroll: this.arc.maxScroll, fits: this.arc.fits };
  }

  // ---- Tabs ---------------------------------------------------------------

  /** Adds a tab's view to the room, hidden until focused. */
  addView(view: TabView): void {
    const object = new CSS3DObject(view.element);
    view.setSize(this.currentLayout.panelWidth, this.currentLayout.panelHeight);
    this.applyPose(object, this.centrePose());
    this.setShown(view, false);
    // In the page now, so a background tab's webview attaches and loads.
    this.cameraElement.append(view.element);
    this.cssScene.add(object);
    this.views.set(view.tabId, { view, object });
  }

  /** Removes a closed tab's view; its webview and page go with it. */
  removeView(tabId: number): void {
    const entry = this.views.get(tabId);
    if (!entry) return;
    this.tweens = this.tweens.filter((t) => t.object !== entry.object);
    this.cssScene.remove(entry.object);
    entry.view.dispose();
    this.views.delete(tabId);
    this.requestRender();
  }

  /** Cards in order; the "+" card is added at the end. */
  setCards(models: CardModel[]): void {
    const all: CardModel[] = [...models, { key: 'plus', title: 'New tab', loading: false, focused: false }];
    const keys = new Set(all.map((m) => m.key));
    for (const [key, card] of this.cards) {
      if (!keys.has(key)) {
        this.scene.remove(card.mesh);
        card.dispose();
        this.cards.delete(key);
        if (this.hoveredCard === card) this.hoveredCard = null;
      }
    }
    for (const model of all) {
      const card = this.cards.get(model.key);
      if (card) card.update(model);
      else {
        const created = new TabCard(model, this.theme, () => this.requestRender());
        created.setStill(this.reducedMotion.matches);
        this.cards.set(model.key, created);
        this.scene.add(created.mesh);
      }
    }
    this.order = all.map((m) => m.key);
    this.tabCount = models.length;
    const shown = this.wantRail();
    if (shown !== this.railShown) {
      this.railShown = shown;
      if (!shown && this.hoveredCard) this.setHovered(null);
      this.layout(); // the page widens or makes room for the rail
    } else {
      this.layoutCards();
    }
    this.requestRender();
  }

  /** Room the page leaves for the instrument panel (milestone 7), in CSS pixels. */
  setExtraInsets(extra: { right: number; bottom: number }): void {
    if (extra.right === this.extra.right && extra.bottom === this.extra.bottom) return;
    this.extra = { ...extra };
    this.layout();
    this.requestRender();
  }

  /** Whether the tab rail is showing (two or more tabs). */
  get railVisible(): boolean {
    return this.railShown;
  }

  // ---- Tab display and economy (milestone 10) ------------------------------

  private get railWidth(): number {
    return CARD_WIDTH * this.cardScale;
  }

  /** The rail shows with two or more tabs, and never for the list. */
  private wantRail(): boolean {
    return this.tabCount >= 2 && this.display === 'cards';
  }

  private updateRail(): void {
    const shown = this.wantRail();
    if (shown === this.railShown) return;
    this.railShown = shown;
    if (!shown && this.hoveredCard) this.setHovered(null);
    this.layout();
    this.requestRender();
  }

  /** Card size, how tabs are shown, and the room the tab list takes above the page. */
  setTabLayout(options: { scale: number; display: TabDisplayMode; topExtra: number }): void {
    const changed = options.scale !== this.cardScale || options.topExtra !== this.topExtra;
    this.cardScale = options.scale;
    this.topExtra = options.topExtra;
    this.display = options.display;
    const shown = this.wantRail();
    if (changed || shown !== this.railShown) {
      this.railShown = shown;
      this.layout();
      this.requestRender();
    }
  }

  get display_(): { scale: number; display: TabDisplayMode } {
    return { scale: this.cardScale, display: this.display };
  }

  /**
   * The view (milestone 11): which way the page leans, the space around
   * it, and how much the room moves with the pointer.
   */
  setView(view: { direction: 1 | -1; margin: PageMarginSize; parallax: keyof typeof PARALLAX_AMOUNTS }): void {
    const margin = PAGE_MARGINS[view.margin];
    this.parallax.options.maxOffset = DEFAULT_PARALLAX.maxOffset * PARALLAX_AMOUNTS[view.parallax];
    if (view.parallax === 'off') this.centreCamera();
    if (view.direction === this.direction && margin === this.margin) {
      this.requestRender();
      return;
    }
    this.direction = view.direction;
    this.margin = margin;
    this.layout();
    this.requestRender();
  }

  get view(): { direction: 1 | -1; margin: number; parallax: number } {
    return { direction: this.direction, margin: this.margin, parallax: this.parallax.options.maxOffset };
  }

  /**
   * Economy mode: the room at a lower resolution, without its glow, sun,
   * horizon band, parallax, or switch animations, and at most 30 frames a
   * second. The page itself is untouched.
   */
  setEconomy(on: boolean): void {
    if (on === this.economy) return;
    this.economy = on;
    this.applyPixelRatio();
    this.horizon.visible = !on;
    this.sun.visible = this.theme.room.sun && !on;
    if (on) this.centreCamera();
    this.layout();
    this.requestRender();
  }

  get economyOn(): boolean {
    return this.economy;
  }

  /** The room's resolution: the display's, or half of it in economy mode. */
  private applyPixelRatio(): void {
    this.webgl?.setPixelRatio(this.economy ? Math.max(0.5, window.devicePixelRatio * 0.5) : window.devicePixelRatio);
  }

  /**
   * Follows the display's pixel ratio, which changes when the window moves
   * to a display with another scaling or the system's scaling changes;
   * set only at the start, the room stayed blurred or too costly after.
   * A media query matches one ratio, so each change is watched for anew.
   */
  private watchPixelRatio(): void {
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener(
      'change',
      () => {
        this.applyPixelRatio();
        this.layout();
        this.requestRender();
        this.watchPixelRatio();
      },
      { once: true },
    );
  }

  /**
   * A HoloML page in front (milestone 14, owner prompt 65, Q1 a): its scene
   * fills the window below the top bar, beside the tab rail, flat and
   * still, and the room steps aside; other pages lean back as before.
   */
  setFill(on: boolean): void {
    if (on === this.fill) return;
    this.fill = on;
    if (on) this.centreCamera();
    this.layout();
    this.requestRender();
  }

  get filling(): boolean {
    return this.fill;
  }

  /**
   * Puts the camera back at the centre at once, for a view that must be
   * flat and still. The pointer is usually over the page then, where the
   * parallax is paused and would ignore a new target, so the page stayed
   * slightly skewed (review of 2026-09-30, R4).
   */
  private centreCamera(): void {
    this.parallax.reset();
    this.onCameraMove?.({ x: 0, y: 0 });
  }

  get pixelRatio(): number {
    return this.webgl?.getPixelRatio() ?? window.devicePixelRatio;
  }

  /** False where Chromium could not start WebGL 2, so the room is not drawn. */
  get drawsRoom(): boolean {
    return this.webgl !== null;
  }

  setSnapshot(tabId: number, dataUrl: string): void {
    this.cards.get(tabId)?.setSnapshot(dataUrl);
  }

  hasSnapshot(tabId: number): boolean {
    return this.cards.get(tabId)?.hasSnapshot ?? false;
  }

  /** When a tab's card last got a picture (performance.now(); 0 for never), for the tests. */
  snapshotAt(tabId: number): number {
    return this.cards.get(tabId)?.snapshotAt ?? 0;
  }

  /** The picture on a tab's card (a data address), for the tests. */
  snapshotSrc(tabId: number): string | null {
    return this.cards.get(tabId)?.snapshotSrc ?? null;
  }

  /**
   * Shows a tab's page in the centre. With animate, it grows out of its
   * card while the previous page shrinks back into its own card.
   */
  focus(tabId: number, animate: boolean): void {
    const previous = this.focusedId;
    this.focusedId = tabId;
    this.railScroll = scrollToShow(this.arcInput(), this.order.indexOf(tabId));
    this.layoutCards();
    const duration = animate && !this.reducedMotion.matches && !this.economy ? SWITCH_MS : 0;

    const next = this.views.get(tabId);
    if (next) {
      this.tweens = this.tweens.filter((t) => t.object !== next.object);
      this.setShown(next.view, true);
      if (duration > 0 && previous !== tabId) {
        this.applyPose(next.object, this.cardPose(tabId));
        this.addTween(next.object, () => this.centrePose(), duration);
      } else {
        this.applyPose(next.object, this.centrePose());
      }
    }
    const old = previous === tabId ? undefined : this.views.get(previous);
    if (old) {
      this.tweens = this.tweens.filter((t) => t.object !== old.object);
      const hide = () => {
        if (this.focusedId !== previous) this.setShown(old.view, false);
      };
      if (duration > 0) this.addTween(old.object, () => this.cardPose(previous), duration, hide);
      else hide();
    }
    this.requestRender();
  }

  // ---- Layout -------------------------------------------------------------

  private pageInsets(): Insets {
    const margin = this.fill ? 0 : this.margin;
    const left = this.railShown ? RAIL.left + this.railWidth + 32 : margin;
    return {
      ...PAGE_INSETS,
      left,
      top: PAGE_INSETS.top + this.topExtra,
      right: margin + this.extra.right,
      bottom: margin + this.extra.bottom,
    };
  }

  get tiltDeg(): number {
    return this.options.tiltDeg;
  }

  /** Leans the page back by another angle (Settings > Page tilt). */
  setTilt(deg: number): void {
    if (deg === this.options.tiltDeg) return;
    this.options.tiltDeg = deg;
    this.layout();
    this.requestRender();
  }

  /** Recomputes sizes after a resize or tilt change. */
  layout(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.currentLayout = computePanelLayout({
      viewportWidth: w,
      viewportHeight: h,
      fovDeg: this.options.fovDeg ?? 40,
      tiltDeg: this.fill ? 0 : this.options.tiltDeg,
      direction: this.direction,
      insets: this.pageInsets(),
    });
    const layout = this.currentLayout;

    this.webgl?.setSize(w, h);
    this.css.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = layout.fovDeg;
    this.camera.updateProjectionMatrix();
    this.applyCamera();

    for (const { view, object } of this.views.values()) {
      view.setSize(layout.panelWidth, layout.panelHeight);
      if (!this.tweens.some((t) => t.object === object)) this.applyPose(object, this.centrePose());
    }

    // Desk slab under the page; floor grid further down.
    const bottom = layout.position.y - layout.panelHeight / 2;
    this.desk.scale.set(layout.panelWidth * 1.1, 14, DESK_DEPTH);
    this.desk.rotation.set(0, layout.rotationY, 0);
    this.desk.position.set(layout.position.x, bottom - 22, layout.position.z + DESK_DEPTH / 2 - 60);
    // The instrument panel's bottom strip takes the desk's place (it would
    // otherwise float under the raised page and cover the tab rail's lowest card).
    this.desk.visible = this.extra.bottom === 0 && !this.fill;
    this.grid.position.set(0, bottom - 120, 0);

    // The horizon is at the camera's height, far away; the glow and sun sit on it.
    const far = 7000;
    const halfWidth = Math.tan(((layout.fovDeg / 2) * Math.PI) / 180) * far * (w / h);
    this.horizon.scale.set(halfWidth * 4, far * 0.22, 1);
    this.horizon.position.set(0, 0, -far);
    const r = far * 0.16;
    this.sun.scale.set(r * 2, r * 2, 1);
    // To the right of the page, half risen, where the room shows around it.
    this.sun.position.set(halfWidth * 0.78, r * 0.25, -far + 10);

    this.layoutCards();
  }

  private arcInput(): TabArcInput {
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      rail: {
        left: RAIL.left,
        top: HUD_HEIGHT + this.topExtra,
        width: this.railWidth,
        bottom: window.innerHeight - RAIL.bottomMargin,
      },
      cardWidth: this.railWidth,
      cardHeight: CARD_HEIGHT * this.cardScale,
      gap: RAIL.gap,
      count: Math.max(1, this.order.length),
      scroll: this.railScroll,
      // The "+" card (always last) stays in view (owner, prompt 20).
      pinLast: true,
    };
  }

  private layoutCards(): void {
    this.railScroll = clampScroll(this.arcInput(), this.railScroll);
    this.arc = computeTabArc(this.arcInput());
    this.order.forEach((key, i) => {
      const card = this.cards.get(key);
      const place = this.arc.cards[i];
      if (!card || !place) return;
      card.mesh.position.set(place.position.x, place.position.y, place.position.z);
      card.mesh.rotation.set(place.rotationX, place.rotationY, 0);
      card.mesh.scale.setScalar(this.cardScale);
      card.setOpacity(this.railShown ? place.opacity : 0);
    });
  }

  private centrePose(): Pose {
    const l = this.currentLayout;
    return {
      position: new Vector3(l.position.x, l.position.y, l.position.z),
      rotation: new Euler(0, l.rotationY, 0),
      scale: 1,
    };
  }

  private cardPose(key: number): Pose {
    const card = this.cards.get(key);
    const scale = this.railWidth / Math.max(1, this.currentLayout.panelWidth);
    if (!card) return { ...this.centrePose(), scale };
    return { position: card.mesh.position.clone(), rotation: card.mesh.rotation.clone(), scale };
  }

  private applyPose(object: Object3D, pose: Pose): void {
    object.position.copy(pose.position);
    object.rotation.copy(pose.rotation);
    object.scale.setScalar(pose.scale);
  }

  private setShown(view: TabView, shown: boolean): void {
    // Hidden, not removed: a webview that leaves the page reloads. Hidden
    // this way, Chromium still counts the page as seen, so the tab view also
    // tells it (a HoloML page then draws nothing, milestone 21).
    const element = view.element;
    view.setInFront(shown);
    element.style.visibility = shown ? '' : 'hidden';
    element.style.pointerEvents = shown ? '' : 'none';
    element.setAttribute('aria-hidden', shown ? 'false' : 'true');
  }

  private addTween(object: Object3D, to: () => Pose, duration: number, done?: () => void): void {
    const from: Pose = {
      position: object.position.clone(),
      rotation: object.rotation.clone(),
      scale: object.scale.x,
    };
    this.tweens.push({ object, from, to, start: performance.now(), duration, ...(done ? { done } : {}) });
  }

  // ---- Rendering ----------------------------------------------------------

  requestRender(): void {
    if (this.framePending) return;
    this.framePending = true;
    // Economy mode: at most ECONOMY_FPS frames a second.
    const wait = this.economy ? 1000 / ECONOMY_FPS - (performance.now() - this.lastDrawn) : 0;
    if (wait > 1) window.setTimeout(() => requestAnimationFrame((t) => this.frame(t)), wait);
    else requestAnimationFrame((t) => this.frame(t));
  }

  private frame(time: number): void {
    this.framePending = false;
    this.lastDrawn = performance.now();
    const dt = this.lastFrameTime === 0 ? 16 : Math.min(50, time - this.lastFrameTime);
    this.lastFrameTime = time;

    const moving = this.parallax.step(dt);
    if (moving && this.onCameraMove) {
      const { x, y } = this.parallax.offset;
      this.onCameraMove({ x: x / DEFAULT_PARALLAX.maxOffset, y: y / DEFAULT_PARALLAX.maxOffset });
    }
    this.stepTweens(performance.now());
    // A spinner asks for frames only where it is seen: not on a card out
    // of view (one tab, tabs shown as a list, a card scrolled off the
    // rail), and not while the room is not drawn. Otherwise every page
    // load kept the frame loop running for nothing. With reduced motion
    // the card shows a still mark.
    const roomDrawn = this.webgl !== null && !this.contextLost && !this.reducedMotion.matches;
    let spinning = false;
    for (const card of this.cards.values()) {
      if (roomDrawn && card.spinning && card.mesh.visible) {
        card.tick(dt);
        spinning = true;
      }
    }
    this.applyCamera();
    this.placeGlow();
    if (!this.contextLost) this.webgl?.render(this.scene, this.camera);
    this.css.render(this.cssScene, this.camera);
    this.frames += 1;
    if (moving || this.tweens.length > 0 || spinning) this.requestRender();
    else this.lastFrameTime = 0;
  }

  private stepTweens(now: number): void {
    if (this.tweens.length === 0) return;
    const finished: Tween[] = [];
    for (const t of this.tweens) {
      const k = Math.min(1, (now - t.start) / t.duration);
      const e = 1 - (1 - k) ** 3; // ease out
      const to = t.to();
      t.object.position.lerpVectors(t.from.position, to.position, e);
      t.object.rotation.set(
        t.from.rotation.x + (to.rotation.x - t.from.rotation.x) * e,
        t.from.rotation.y + (to.rotation.y - t.from.rotation.y) * e,
        t.from.rotation.z + (to.rotation.z - t.from.rotation.z) * e,
      );
      t.object.scale.setScalar(t.from.scale + (to.scale - t.from.scale) * e);
      if (k >= 1) finished.push(t);
    }
    this.tweens = this.tweens.filter((t) => !finished.includes(t));
    for (const t of finished) t.done?.();
  }

  private applyCamera(): void {
    const { x, y } = this.parallax.offset;
    this.camera.position.set(x, y, this.currentLayout.cameraZ);
    this.camera.lookAt(0, 0, 0);
  }

  /** The glow sits just behind the focused page, following it as it moves. */
  private placeGlow(): void {
    const entry = this.views.get(this.focusedId);
    if (!entry || this.economy) {
      this.glow.visible = false;
      return;
    }
    const { object } = entry;
    const l = this.currentLayout;
    const s = object.scale.x;
    this.glow.visible = true;
    this.glow.scale.set((l.panelWidth + GLOW_MARGIN * 2) * s, (l.panelHeight + GLOW_MARGIN * 2) * s, 1);
    this.glow.rotation.copy(object.rotation);
    const back = new Vector3(0, 0, -4).applyEuler(object.rotation);
    this.glow.position.copy(object.position).add(back);
  }

  // ---- Geometry for input and tests --------------------------------------

  private project(world: Vector3): Vec2 {
    const p = world.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight };
  }

  /** Where a point on the focused page (page pixels from its top-left) is on screen now. */
  projectPagePoint(u: number, v: number): Vec2 {
    const entry = this.views.get(this.focusedId);
    const { panelWidth: w, panelHeight: h } = this.currentLayout;
    if (!entry) return { x: Number.NaN, y: Number.NaN };
    entry.object.updateMatrixWorld();
    return this.project(entry.object.localToWorld(new Vector3(u - w / 2, h / 2 - v, 0)));
  }

  /** The focused page's outline on screen: top-left, top-right, bottom-right, bottom-left. */
  screenQuad(): Vec2[] {
    const { panelWidth: w, panelHeight: h } = this.currentLayout;
    return [
      this.projectPagePoint(0, 0),
      this.projectPagePoint(w, 0),
      this.projectPagePoint(w, h),
      this.projectPagePoint(0, h),
    ];
  }

  /** Screen point of part of a card, or null if the card is not showing. */
  cardPoint(key: number | 'plus', part: CardPart): Vec2 | null {
    const card = this.cards.get(key);
    if (!card || !card.mesh.visible) return null;
    const local = TabCard.localPoint(part);
    card.mesh.updateMatrixWorld();
    return this.project(card.mesh.localToWorld(new Vector3(local.x, local.y, 0)));
  }

  /** The colours the 3D materials actually use, as #rrggbb (for check C1). */
  sceneColors(): Record<string, string> {
    // The grid draws with per-vertex colours; its material stays white.
    const gridColors = this.grid.geometry.getAttribute('color');
    const gridColor = new Color().fromBufferAttribute(gridColors as BufferAttribute, 0);
    return {
      accent: `#${this.glow.material.color.getHexString()}`,
      desk: `#${this.desk.material.color.getHexString()}`,
      floorGrid: `#${gridColor.getHexString()}`,
      horizon: `#${this.horizon.material.color.getHexString()}`,
      fog: `#${(this.scene.fog as Fog).color.getHexString()}`,
      ambient: `#${this.ambient.color.getHexString()}`,
      key: `#${this.key.color.getHexString()}`,
      sun: this.sun.visible ? 'shown' : 'hidden',
    };
  }

  /** Switches the room to another theme at once: sky decorations, grid, desk, glow, fog, lights, and cards. */
  setTheme(theme: Theme): void {
    this.theme = theme;
    const c = theme.colors;
    (this.scene.fog as Fog).color.set(c.backgroundBottom);
    this.ambient.color.set(theme.lighting.ambient.color);
    this.ambient.intensity = theme.lighting.ambient.intensity;
    this.key.color.set(theme.lighting.key.color);
    this.key.intensity = theme.lighting.key.intensity;
    const position = this.grid.position.clone();
    this.scene.remove(this.grid);
    this.grid.dispose();
    this.grid = new GridHelper(8000, 80, new Color(c.floorGrid), new Color(c.floorGrid));
    this.grid.position.copy(position);
    this.scene.add(this.grid);
    this.desk.material.color.set(c.desk);
    this.glow.material.color.set(c.accent);
    this.glow.material.opacity = theme.glowStrength;
    this.horizon.material.color.set(c.horizon);
    this.sun.visible = theme.room.sun && !this.economy;
    for (const card of this.cards.values()) card.setTheme(theme);
    this.requestRender();
  }

  // ---- Pointer ------------------------------------------------------------

  private cardAt(x: number, y: number): { card: TabCard; part: CardPart } | null {
    if (!this.webgl) return null; // cards that are not drawn take no clicks
    const ndc = new Vector2((x / window.innerWidth) * 2 - 1, 1 - (y / window.innerHeight) * 2);
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes = [...this.cards.values()].map((c) => c.mesh).filter((m) => m.visible);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    if (!hit?.uv) return null;
    const card = hit.object.userData['card'] as TabCard;
    return { card, part: card.partAt(hit.uv.x, hit.uv.y) };
  }

  private setHovered(hit: { card: TabCard; part: CardPart } | null): void {
    let changed = false;
    if (this.hoveredCard && this.hoveredCard !== hit?.card) {
      changed = this.hoveredCard.setHover(false, false) || changed;
    }
    this.hoveredCard = hit?.card ?? null;
    if (hit) changed = hit.card.setHover(true, hit.part === 'close') || changed;
    this.canvas.style.cursor = hit ? 'pointer' : '';
    if (changed) this.requestRender();
  }

  /**
   * Parallax follows the pointer over the room and pauses over the page,
   * so click targets never move under the cursor. Cards react to hover,
   * clicks, and the mouse wheel.
   */
  private wirePointer(): void {
    const canvas = this.canvas;
    const focusedElement = () => this.views.get(this.focusedId)?.view.element;
    const overPage = (x: number, y: number, target: EventTarget | null): boolean => {
      const el = focusedElement();
      if (!el) return false;
      return (target instanceof Node && el.contains(target)) || pointInPolygon({ x, y }, this.screenQuad());
    };

    document.addEventListener('pointermove', (e) => {
      const over = overPage(e.clientX, e.clientY, e.target);
      const t = e.target instanceof Element ? e.target : null;
      this.pointerLog.push({
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
        target: t ? `${t.tagName.toLowerCase()}${t.className && typeof t.className === 'string' ? `.${t.className}` : ''}` : String(e.target),
        overPage: over,
      });
      if (this.pointerLog.length > 20) this.pointerLog.shift();
      if (over) {
        this.parallax.setPaused(true);
        this.setHovered(null);
        return;
      }
      this.parallax.setPaused(false);
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = 1 - (e.clientY / window.innerHeight) * 2;
      // Economy mode, a page that fills the window, and reduced motion keep the camera still.
      if (!this.economy && !this.fill && !this.reducedMotion.matches) this.parallax.setPointer(nx, ny);
      this.setHovered(e.target === canvas ? this.cardAt(e.clientX, e.clientY) : null);
      if (this.parallax.moving) this.requestRender();
    });
    document.addEventListener('pointerover', (e) => {
      const el = focusedElement();
      if (el && e.target instanceof Node && el.contains(e.target)) {
        this.parallax.setPaused(true);
      }
    });
    canvas.addEventListener('pointerleave', () => this.setHovered(null));

    canvas.addEventListener('click', (e) => {
      const hit = this.cardAt(e.clientX, e.clientY);
      if (!hit) return;
      if (hit.part === 'close' && hit.card.key !== 'plus') this.options.callbacks.onCardClose(hit.card.key);
      else if (hit.part === 'audio' && hit.card.key !== 'plus') this.options.callbacks.onCardAudio?.(hit.card.key);
      else this.options.callbacks.onCardClick(hit.card.key);
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.railShown || e.clientX > RAIL.left + this.railWidth + 24) return;
        const before = this.railScroll;
        this.railScroll = clampScroll(this.arcInput(), this.railScroll + e.deltaY);
        if (this.railScroll === before) return;
        this.layoutCards();
        this.setHovered(this.cardAt(e.clientX, e.clientY));
        this.requestRender();
      },
      { passive: true },
    );
  }
}

/** A soft rectangle that fades to transparent at the edges, for the glow. */
/** A soft horizontal band: clear at the top and bottom, strongest in the middle. */
function makeBandTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
  }
  return new CanvasTexture(canvas);
}

/** The 1980s sun: a disc fading from gold to magenta, its lower half cut by widening stripes. */
function makeSunTexture(): CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#ffe36b');
    g.addColorStop(0.55, '#ff8a4c');
    g.addColorStop(1, '#ff2f92');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) {
      const y = size * 0.52 + i * i * 4.5 + i * 22;
      ctx.fillRect(0, y, size, 3 + i * 2.2);
    }
  }
  return new CanvasTexture(canvas);
}

function makeGlowTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const edge = size * 0.18;
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.min(x, y, size - 1 - x, size - 1 - y);
        const a = Math.min(1, d / edge);
        const i = (y * size + x) * 4;
        image.data[i] = 255;
        image.data[i + 1] = 255;
        image.data[i + 2] = 255;
        image.data[i + 3] = Math.round(255 * a * a);
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  return new CanvasTexture(canvas);
}
