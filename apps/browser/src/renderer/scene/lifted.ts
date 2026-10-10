import {
  AmbientLight,
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Euler,
  FrontSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Scene,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import { computeTabArc, type PanelLayout } from '@hypersol/scene-core';
import type { Theme } from '@hypersol/themes';
import type { LiftKind } from '../../shared/lift';
import type { LiftedShape } from '../../shared/lifted-shape';
import { CARD_HEIGHT } from './tab-card';

/**
 * Lifted objects (milestone 28; owner, prompt 198): pictures and 3D models
 * from a tab's page, standing in the room in an arc on the right of the
 * page, as the tab cards stand on the left, facing the desk.
 *
 * They are drawn by a second WebGL canvas over the page (the room's own
 * canvas is under it, as the page is placed with CSS on top), with the
 * room's camera. They always stand between the page and the camera, which
 * never goes behind the page (milestone 27), so the page never hides any
 * part of them and drawing them over it is right. Each has a button over
 * where it is drawn, which takes the mouse and the keyboard: hovering or
 * focusing it shows its name, a drag (or the arrow keys) turns it, a click
 * (or Enter) brings it nearer and again sends it back, and its close
 * button (or Delete) puts it back into the page.
 *
 * Each tab has its own; only the tab in front shows them (Q4 a: they last
 * as long as their page, and are kept in memory only).
 */

/** The arc of lifted objects on the right of the page. */
// Well inside the window, as the cards' rail is: the objects stand nearer the camera than the page, so perspective
// pushes them outward.
export const LIFT_RAIL = { width: 140, right: 60, gap: 10, topMargin: 16, bottomMargin: 24 } as const;
/** Room the arc takes from the page: its width and a gap. */
export const LIFT_RAIL_ROOM = LIFT_RAIL.width + LIFT_RAIL.right;
/** How long rising out of the page, going back into it, and coming nearer take. */
const MOVE_MS = 450;
/** How far a drag turns an object, per pixel; and the arrow keys, per press. */
const DRAG_TURN = (0.6 * Math.PI) / 180;
const KEY_TURN = (15 * Math.PI) / 180;
const DRAG_START_PX = 5;
/** Nearer: the object stands at this share of the desk camera's distance, this share of the view high. */
const NEAR_DEPTH = 0.45;
const NEAR_HEIGHT = 0.55;
/** The frame round a lifted picture, as a share of its height, and its depth. */
const FRAME = 0.04;
const FRAME_DEPTH = 0.03;

export interface LiftedHost {
  readonly camera: PerspectiveCamera;
  /** Where a point of a tab's page is in the room (its pixels from the page's top-left), or null. */
  pagePoint(tabId: number, u: number, v: number): Vector3 | null;
  /** How a tab's page is turned in the room, or null. */
  pageRotation(tabId: number): Euler | null;
  layout(): PanelLayout;
  /** The arc's place on screen: its right edge (room the instrument panel takes is left of it) and its top. */
  railEdges(): { right: number; top: number; bottom: number };
  reducedMotion(): boolean;
  requestRender(): void;
  /** The arc came or went: the page is laid out again. */
  railChanged(): void;
}

/** Where on the page a lifted object came from: a rectangle of the page's own pixels (its zoom applied). */
export interface LiftedFrom {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiftedInfo {
  tabId: number;
  itemId: number;
  kind: LiftKind;
  name: string;
  state: 'loading' | 'ready';
  near: boolean;
  /** Turned by a drag or the keys, in degrees. */
  spin: { yaw: number; pitch: number };
  /** Where its button is on screen. */
  box: { x: number; y: number; width: number; height: number } | null;
  /** Where it was first drawn: where it rose from. */
  firstBox: { x: number; y: number; width: number; height: number } | null;
  /** A model's meshes, triangles, and pictures, once it has come. */
  shape: { meshes: number; triangles: number; pictures: number } | null;
  /** Moving (rising, going back, coming nearer, or to a new place in the arc). */
  moving: boolean;
}

interface Pose {
  position: Vector3;
  quaternion: Quaternion;
  scale: number;
}

interface Move {
  from: Pose;
  to: () => Pose;
  start: number;
  duration: number;
  done?: () => void;
}

const easeOut = (k: number) => 1 - (1 - k) ** 3;

/** One lifted object. */
class Lifted {
  /** Its place in the room (the arc, or nearer). */
  readonly holder = new Group();
  /** Turned by the person. */
  readonly spinner = new Group();
  /** What is drawn, centred, with its own size (`size`). */
  content: Object3D;
  size = { w: 1, h: 1 };
  state: 'loading' | 'ready' = 'loading';
  near = false;
  /** Going back into the page: it is removed once there. */
  leaving = false;
  yaw = 0;
  pitch = 0;
  move: Move | null = null;
  readonly element: HTMLDivElement;
  readonly button: HTMLButtonElement;
  readonly close: HTMLButtonElement;
  box: { x: number; y: number; width: number; height: number } | null = null;
  firstBox: { x: number; y: number; width: number; height: number } | null = null;
  shape: { meshes: number; triangles: number; pictures: number } | null = null;
  /** Its picture, for the checks. */
  picture: ImageBitmap | null = null;
  readonly owned: { dispose(): void }[] = [];

  constructor(
    readonly tabId: number,
    readonly itemId: number,
    readonly kind: LiftKind,
    readonly name: string,
    readonly from: LiftedFrom,
    placeholder: Object3D,
  ) {
    this.content = placeholder;
    this.holder.add(this.spinner);
    this.spinner.add(placeholder);
    this.element = document.createElement('div');
    this.element.className = 'hs-lifted-object';
    this.element.dataset['testid'] = 'lifted';
    this.element.dataset['item'] = String(itemId);
    this.button = document.createElement('button');
    this.button.className = 'hs-lifted-body';
    this.button.dataset['testid'] = 'lifted-object';
    const what = kind === 'model' ? 'lifted model' : kind === 'video' ? 'lifted still of a video' : 'lifted picture';
    this.button.setAttribute('aria-label', `${name}, ${what}`);
    this.button.setAttribute('aria-describedby', 'hs-lifted-hint');
    this.button.setAttribute('aria-pressed', 'false');
    const label = document.createElement('span');
    label.className = 'hs-lifted-name';
    label.dataset['testid'] = 'lifted-name';
    label.textContent = name;
    label.setAttribute('aria-hidden', 'true');
    this.button.append(label);
    this.close = document.createElement('button');
    this.close.className = 'hs-lifted-close';
    this.close.dataset['testid'] = 'lifted-close';
    this.close.setAttribute('aria-label', `Put back: ${name}`);
    this.close.title = 'Put it back into the page';
    this.close.textContent = '×';
    this.element.append(this.button, this.close);
  }

  info(): LiftedInfo {
    return {
      tabId: this.tabId,
      itemId: this.itemId,
      kind: this.kind,
      name: this.name,
      state: this.state,
      near: this.near,
      spin: { yaw: Math.round((this.yaw * 180) / Math.PI), pitch: Math.round((this.pitch * 180) / Math.PI) },
      box: this.box ? { ...this.box } : null,
      firstBox: this.firstBox ? { ...this.firstBox } : null,
      shape: this.shape ? { ...this.shape } : null,
      moving: this.move !== null,
    };
  }

  pose(): Pose {
    return { position: this.holder.position.clone(), quaternion: this.holder.quaternion.clone(), scale: this.holder.scale.x };
  }

  apply(p: Pose): void {
    this.holder.position.copy(p.position);
    this.holder.quaternion.copy(p.quaternion);
    this.holder.scale.setScalar(p.scale);
  }

  dispose(): void {
    for (const o of this.owned) o.dispose();
    this.picture?.close();
    this.element.remove();
  }
}

/** Puts an object's content at its centre, and gives its size. */
function centred(object: Object3D): { w: number; h: number; d: number } {
  const box = new Box3().setFromObject(object);
  const centre = box.getCenter(new Vector3());
  object.position.sub(centre);
  const size = box.getSize(new Vector3());
  return { w: Math.max(size.x, 1e-6), h: Math.max(size.y, 1e-6), d: size.z };
}

export class LiftedLayer {
  private readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  /** What screen readers hear: lifting, a model arriving, putting back. */
  private readonly said: HTMLDivElement;
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly ambient: AmbientLight;
  private readonly key: DirectionalLight;
  private readonly fill: DirectionalLight;
  private readonly objects: Lifted[] = [];
  private focused = -1;
  private railShown = false;
  /** Something was drawn last frame: one more frame clears it when nothing is left. */
  private drawn = false;
  private contextLost = false;
  private pixelRatio = window.devicePixelRatio;
  /** Called when the person puts an object back, or one finishes going back. */
  onPutBack: ((info: LiftedInfo) => void) | null = null;

  constructor(
    container: HTMLElement,
    private theme: Theme,
    private readonly host: LiftedHost,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'hs-lifted-layer';
    this.element.dataset['testid'] = 'lifted-layer';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'hs-lifted-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    const hint = document.createElement('p');
    hint.id = 'hs-lifted-hint';
    hint.className = 'sr-only';
    hint.textContent = 'Enter brings it nearer and sends it back; the arrow keys turn it; Delete puts it back into the page.';
    this.said = document.createElement('div');
    this.said.className = 'sr-only';
    this.said.setAttribute('role', 'status');
    this.said.setAttribute('aria-live', 'polite');
    this.said.dataset['testid'] = 'lifted-said';
    this.element.append(this.canvas, hint, this.said);
    container.append(this.element);
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.host.requestRender();
    });
    this.ambient = new AmbientLight();
    this.key = new DirectionalLight();
    this.key.position.set(-400, 900, 800);
    // A light from the camera's side, so a model's front is never dark.
    this.fill = new DirectionalLight();
    this.fill.position.set(300, 200, 1000);
    this.scene.add(this.ambient, this.key, this.fill);
    this.setTheme(theme);
  }

  /** Tells screen readers (lifting itself is told by the notice). */
  announce(text: string): void {
    this.said.textContent = text;
  }

  // ---- What there is ------------------------------------------------------

  /** A tab's objects, in the arc's order. */
  private of(tabId: number): Lifted[] {
    return this.objects.filter((o) => o.tabId === tabId && !o.leaving);
  }

  count(tabId: number): number {
    return this.of(tabId).length;
  }

  /** The page items a tab has lifted (by the preload's numbers). */
  liftedIds(tabId: number): Set<number> {
    return new Set(this.of(tabId).map((o) => o.itemId));
  }

  /** Whether the arc takes room beside the page now. */
  get rail(): boolean {
    return this.railShown;
  }

  /** For the checks and screen readers: every object of every tab. */
  list(): LiftedInfo[] {
    return this.objects.map((o) => o.info());
  }

  /** A lifted picture's pixels as captured (for check LT2), or null. */
  picture(tabId: number, itemId: number): ImageBitmap | null {
    return this.objects.find((o) => o.tabId === tabId && o.itemId === itemId)?.picture ?? null;
  }

  /** Something of the tab in front is moving: rising, going back, coming nearer, or a model on its way turning. */
  get moving(): boolean {
    return this.objects.some((o) => o.tabId === this.focused && (o.move !== null || (o.state === 'loading' && !this.host.reducedMotion())));
  }

  // ---- Lifting and putting back -------------------------------------------

  /**
   * Adds an object for a tab's page: a picture with its pixels (captured
   * from the page, Q1 a), or a model still loading (its shape comes later,
   * setModel). It rises from where it was on the page into the arc.
   */
  add(tabId: number, itemId: number, kind: LiftKind, name: string, from: LiftedFrom, picture?: ImageBitmap): void {
    // Its start: where it is on the page now, before the arc takes room from the page.
    const start = this.pagePose(tabId, from);
    const cube = new BoxGeometry(1, 1, 1);
    const edges = new EdgesGeometry(cube);
    const line = new LineSegments(edges, new LineBasicMaterial({ color: new Color(this.theme.colors.accent) }));
    const o = new Lifted(tabId, itemId, kind, name, from, line);
    o.owned.push(cube, edges, line.material);
    o.size = { w: 1, h: 1 };
    if (picture) this.framePicture(o, picture);
    this.wire(o);
    this.objects.push(o);
    this.scene.add(o.holder);
    this.element.append(o.element);
    const visible = tabId === this.focused;
    o.holder.visible = visible;
    o.element.hidden = !visible;
    // A picture starts as large as it was on the page (its face is 1 high); a model's box, as its place there.
    if (start) o.apply({ ...start, scale: picture ? from.height : Math.min(from.width, from.height) });
    else o.apply(this.slotPose(o));
    this.relayout(true);
  }

  /** A lifted picture: the page's pixels, framed; it is ready. */
  private framePicture(o: Lifted, bitmap: ImageBitmap): void {
    const aspect = bitmap.width / Math.max(1, bitmap.height);
    const h = 1;
    const w = aspect;
    const texture = new Texture(bitmap);
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    // The page's own pixels, unlit, as the page shows them; clearly in front of the frame, which would otherwise
    // show through in stripes where the two are drawn at almost the same depth.
    const face = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({ map: texture, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    );
    face.position.z = FRAME_DEPTH / 2 + 0.01;
    const border = FRAME * h;
    const frame = new Mesh(
      new BoxGeometry(w + border * 2, h + border * 2, FRAME_DEPTH),
      new MeshStandardMaterial({ color: new Color(this.theme.colors.desk), roughness: 0.5, metalness: 0.3 }),
    );
    const group = new Group();
    group.add(frame, face);
    this.replaceContent(o, group, { w: w + border * 2, h: h + border * 2 }, false);
    o.owned.push(texture, face.geometry, face.material, frame.geometry, frame.material);
    o.picture = bitmap;
  }

  /** A lifted model's shapes and pictures (decoded in the sandboxed frame, Q3 a): it is ready. */
  setModel(tabId: number, itemId: number, shape: LiftedShape): void {
    const o = this.objects.find((x) => x.tabId === tabId && x.itemId === itemId && x.state === 'loading');
    if (!o) {
      for (const p of shape.pictures) p.close();
      return;
    }
    const owned: { dispose(): void }[] = [];
    const textures = shape.pictures.map((bitmap) => {
      const t = new Texture(bitmap);
      t.flipY = false; // glTF's pictures run from the top, as the decoding frame keeps them
      t.colorSpace = SRGBColorSpace;
      t.needsUpdate = true;
      return t;
    });
    const materials: Material[] = shape.materials.map((m) => {
      const map = m.map === null ? null : (textures[m.map] ?? null);
      let mapped = map;
      if (map && m.mapTransform) {
        mapped = map.clone();
        const [ox, oy, rx, ry, rotation, cx, cy] = m.mapTransform;
        mapped.offset.set(ox, oy);
        mapped.repeat.set(rx, ry);
        mapped.rotation = rotation;
        mapped.center.set(cx, cy);
        mapped.needsUpdate = true;
        owned.push(mapped);
      }
      return new MeshStandardMaterial({
        color: new Color(...m.color),
        emissive: new Color(...m.emissive),
        metalness: m.metalness,
        roughness: m.roughness,
        opacity: m.opacity,
        transparent: m.transparent,
        alphaTest: m.alphaTest,
        side: m.doubleSided ? DoubleSide : FrontSide,
        vertexColors: m.vertexColors,
        map: mapped,
      });
    });
    const plain = new MeshStandardMaterial({ color: new Color(this.theme.colors.textMuted), roughness: 0.7 });
    const group = new Group();
    for (const m of shape.meshes) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(m.positions, 3));
      if (m.normals) geometry.setAttribute('normal', new BufferAttribute(m.normals, 3));
      if (m.uvs) geometry.setAttribute('uv', new BufferAttribute(m.uvs, 2));
      if (m.colors) geometry.setAttribute('color', new BufferAttribute(m.colors, 3));
      if (m.indices) geometry.setIndex(new BufferAttribute(m.indices, 1));
      if (!m.normals) geometry.computeVertexNormals();
      group.add(new Mesh(geometry, materials[m.material] ?? plain));
      owned.push(geometry);
    }
    const size = centred(group);
    // A model stands in a box as wide as it is high: its depth counts toward its width, as it turns.
    const inner = new Group();
    inner.add(group);
    this.replaceContent(o, inner, { w: Math.max(size.w, size.d), h: size.h }, true);
    o.shape = {
      meshes: shape.meshes.length,
      triangles: shape.meshes.reduce((n, m) => n + (m.indices ? m.indices.length : m.positions.length / 3) / 3, 0),
      pictures: shape.pictures.length,
    };
    o.owned.push(...owned, plain, ...materials, ...textures);
    for (const p of shape.pictures) o.owned.push({ dispose: () => p.close() });
  }

  /** Takes an object away at once (it could not be lifted, its page went). */
  drop(tabId: number, itemId: number): void {
    const o = this.objects.find((x) => x.tabId === tabId && x.itemId === itemId);
    if (o) this.remove(o);
  }

  /** Puts an object back into the page: it goes back to where it came from, and is gone. */
  putBack(tabId: number, itemId: number): void {
    const o = this.objects.find((x) => x.tabId === tabId && x.itemId === itemId && !x.leaving);
    if (!o) return;
    o.leaving = true;
    o.near = false;
    o.element.hidden = true;
    const info = o.info();
    const to = o.tabId === this.focused ? this.pagePose(o.tabId, o.from) : null;
    if (!to || this.host.reducedMotion()) {
      this.remove(o);
    } else {
      const scale = Math.max(o.from.width / o.size.w, o.from.height / o.size.h);
      this.moveTo(o, () => ({ ...to, scale }), () => this.remove(o));
    }
    this.relayout(true);
    this.onPutBack?.(info);
  }

  /** Every object of a tab goes at once: its page navigated, slept, or closed (Q4 a). */
  clearTab(tabId: number): void {
    const gone = this.objects.filter((o) => o.tabId === tabId);
    if (gone.length === 0) return;
    for (const o of gone) this.remove(o);
  }

  private remove(o: Lifted): void {
    const i = this.objects.indexOf(o);
    if (i < 0) return;
    this.objects.splice(i, 1);
    this.scene.remove(o.holder);
    o.dispose();
    this.relayout(true);
  }

  /** Puts what is drawn in place of the placeholder; `relayout` once the object is already in the room. */
  private replaceContent(o: Lifted, content: Object3D, size: { w: number; h: number }, relayout: boolean): void {
    o.spinner.remove(o.content);
    // The placeholder's lines go with it.
    for (const d of o.owned.splice(0)) d.dispose();
    o.content = content;
    o.spinner.add(content);
    o.spinner.rotation.set(o.pitch, o.yaw, 0);
    o.state = 'ready';
    // Its size changed: its place's scale is worked out again, without a jump.
    const before = o.size;
    o.size = size;
    if (o.move) {
      const k = Math.max(before.h / size.h, before.w / size.w);
      o.move.from.scale *= k;
    } else {
      o.holder.scale.multiplyScalar(Math.max(before.h / size.h, before.w / size.w));
    }
    if (relayout) this.relayout(true);
    this.host.requestRender();
  }

  // ---- Places ---------------------------------------------------------------

  /** Which tab is in front: only its objects show, and the arc takes room beside the page while it has any. */
  focus(tabId: number): void {
    this.focused = tabId;
    for (const o of [...this.objects]) {
      const shown = o.tabId === tabId;
      o.holder.visible = shown;
      o.element.hidden = !shown || o.leaving;
      // Another tab's objects wait where they are; one going back is gone.
      if (!shown && o.leaving) this.remove(o);
    }
    this.relayout(false);
  }

  /** The room was laid out again (a resize, the instrument panel): the objects take their new places at once. */
  layout(): void {
    for (const o of this.of(this.focused)) {
      if (!o.move) o.apply(o.near ? this.nearPose(o) : this.slotPose(o));
    }
    this.host.requestRender();
  }

  /**
   * The arc after a change: each object on its way to its place, then
   * whether the arc takes room beside the page (the page is laid out again
   * then, and an object already moving is left to move: one just lifted
   * still rises from where it was).
   */
  private relayout(animate: boolean): void {
    const still = !animate || this.host.reducedMotion();
    for (const o of this.of(this.focused)) {
      const to = () => (o.near ? this.nearPose(o) : this.slotPose(o));
      if (still) {
        o.move = null;
        o.apply(to());
      } else {
        this.moveTo(o, to);
      }
    }
    const rail = this.of(this.focused).length > 0;
    if (rail !== this.railShown) {
      this.railShown = rail;
      this.host.railChanged();
    }
    this.host.requestRender();
  }

  /** Its place in the arc: the arc of the tab cards, mirrored, each object in a slot as high as a card at most. */
  private slotPose(o: Lifted): Pose {
    const list = this.of(o.tabId);
    const index = Math.max(0, list.indexOf(o));
    const { right, top, bottom } = this.host.railEdges();
    const height = Math.max(1, bottom - top);
    const slot = Math.max(24, Math.min(CARD_HEIGHT * 1.1, (height - LIFT_RAIL.gap * (list.length - 1)) / Math.max(1, list.length)));
    const arc = computeTabArc({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      rail: { left: right - LIFT_RAIL.width, top, width: LIFT_RAIL.width, bottom },
      cardWidth: LIFT_RAIL.width,
      cardHeight: slot,
      gap: LIFT_RAIL.gap,
      count: Math.max(1, list.length),
      scroll: 0,
      // Turned toward the desk from the right, as the cards are from the left.
      turnDeg: -14,
    });
    const place = arc.cards[index] ?? arc.cards[0]!;
    // A model may be turned to show its depth: it is given a little less than the arc's width.
    const width = o.kind === 'model' ? LIFT_RAIL.width * 0.8 : LIFT_RAIL.width;
    const scale = Math.min(width / o.size.w, slot / o.size.h);
    return {
      position: new Vector3(place.position.x, place.position.y, place.position.z),
      quaternion: new Quaternion().setFromEuler(new Euler(place.rotationX, place.rotationY, 0)),
      scale,
    };
  }

  /** Nearer: in front of the page, facing the desk, most of the view high. */
  private nearPose(o: Lifted): Pose {
    const l = this.host.layout();
    const distance = l.cameraZ * (1 - NEAR_DEPTH);
    const viewHeight = 2 * distance * Math.tan(((l.fovDeg / 2) * Math.PI) / 180);
    const viewWidth = viewHeight * (window.innerWidth / Math.max(1, window.innerHeight));
    const scale = Math.min((viewHeight * NEAR_HEIGHT) / o.size.h, (viewWidth * 0.6) / o.size.w);
    return { position: new Vector3(0, 0, l.cameraZ * NEAR_DEPTH), quaternion: new Quaternion(), scale };
  }

  /** Where a rectangle of a tab's page is in the room, as a pose (scale 1); null if the page is not placed. */
  private pagePose(tabId: number, r: LiftedFrom): Pose | null {
    const centre = this.host.pagePoint(tabId, r.x + r.width / 2, r.y + r.height / 2);
    const rotation = this.host.pageRotation(tabId);
    if (!centre || !rotation) return null;
    // Just in front of the page, so it rises out of it.
    const forward = new Vector3(0, 0, 2).applyEuler(rotation);
    return { position: centre.add(forward), quaternion: new Quaternion().setFromEuler(rotation), scale: 1 };
  }

  /** Starts a move; its clock starts on the first frame that draws it, so that frame shows where it starts. */
  private moveTo(o: Lifted, to: () => Pose, done?: () => void): void {
    o.move = { from: o.pose(), to, start: -1, duration: MOVE_MS, ...(done ? { done } : {}) };
    this.host.requestRender();
  }

  // ---- Looking at them ------------------------------------------------------

  private toggleNear(o: Lifted): void {
    if (o.leaving || o.tabId !== this.focused) return;
    const near = !o.near;
    // One nearer at a time.
    for (const other of this.of(o.tabId)) {
      if (other !== o && other.near) {
        other.near = false;
        other.button.setAttribute('aria-pressed', 'false');
      }
    }
    o.near = near;
    o.button.setAttribute('aria-pressed', near ? 'true' : 'false');
    this.relayout(true);
  }

  private turn(o: Lifted, dYaw: number, dPitch: number): void {
    o.yaw += dYaw;
    o.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, o.pitch + dPitch));
    o.spinner.rotation.set(o.pitch, o.yaw, 0);
    this.host.requestRender();
  }

  /** Mouse and keys on an object's button. */
  private wire(o: Lifted): void {
    let press: { id: number; x: number; y: number; lastX: number; lastY: number; dragged: boolean } | null = null;
    let dragClick = false;
    o.button.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragClick = false;
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, dragged: false };
      o.button.setPointerCapture(e.pointerId);
    });
    o.button.addEventListener('pointermove', (e) => {
      if (!press || press.id !== e.pointerId) return;
      if (!press.dragged && Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_START_PX) return;
      press.dragged = true;
      this.turn(o, (e.clientX - press.lastX) * DRAG_TURN, (e.clientY - press.lastY) * DRAG_TURN);
      press.lastX = e.clientX;
      press.lastY = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (!press || press.id !== e.pointerId) return;
      dragClick = press.dragged;
      if (o.button.hasPointerCapture(e.pointerId)) o.button.releasePointerCapture(e.pointerId);
      press = null;
    };
    o.button.addEventListener('pointerup', end);
    o.button.addEventListener('pointercancel', end);
    o.button.addEventListener('click', () => {
      if (dragClick) {
        dragClick = false;
        return;
      }
      this.toggleNear(o);
    });
    o.button.addEventListener('keydown', (e) => {
      const turn: Record<string, [number, number]> = { ArrowLeft: [-KEY_TURN, 0], ArrowRight: [KEY_TURN, 0], ArrowUp: [0, -KEY_TURN], ArrowDown: [0, KEY_TURN] };
      const by = turn[e.key];
      if (by) {
        e.preventDefault();
        this.turn(o, by[0], by[1]);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.putBack(o.tabId, o.itemId);
      } else if (e.key === 'Escape' && o.near) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleNear(o);
      }
    });
    o.close.addEventListener('click', () => this.putBack(o.tabId, o.itemId));
  }

  // ---- Drawing --------------------------------------------------------------

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.ambient.color.set(theme.lighting.ambient.color);
    this.ambient.intensity = theme.lighting.ambient.intensity;
    this.key.color.set(theme.lighting.key.color);
    this.key.intensity = theme.lighting.key.intensity;
    this.fill.color.set(theme.lighting.key.color);
    this.fill.intensity = theme.lighting.key.intensity * 0.6;
    this.host.requestRender();
  }

  setPixelRatio(ratio: number): void {
    this.pixelRatio = ratio;
    this.renderer?.setPixelRatio(ratio);
  }

  /** Moves the objects on; true while any is moving (the room then draws again). */
  step(now: number): boolean {
    for (const o of [...this.objects]) {
      const m = o.move;
      if (m) {
        if (m.start < 0) m.start = now;
        const k = Math.min(1, (now - m.start) / m.duration);
        const e = easeOut(k);
        const to = m.to();
        o.holder.position.lerpVectors(m.from.position, to.position, e);
        o.holder.quaternion.slerpQuaternions(m.from.quaternion, to.quaternion, e);
        o.holder.scale.setScalar(m.from.scale + (to.scale - m.from.scale) * e);
        if (k >= 1) {
          o.move = null;
          m.done?.();
        }
      }
      // A model on its way turns slowly, unless motion is reduced.
      if (o.state === 'loading' && o.tabId === this.focused && !this.host.reducedMotion()) o.content.rotation.y += 0.03;
    }
    return this.moving;
  }

  /** Draws the objects of the tab in front over the page, and puts their buttons where they are drawn. */
  render(): void {
    const shown = this.objects.filter((o) => o.tabId === this.focused);
    if (shown.length === 0 && !this.drawn) return;
    if (!this.renderer) {
      try {
        this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(this.pixelRatio);
      } catch {
        return;
      }
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = this.renderer.getSize(new Vector2());
    if (size.x !== w || size.y !== h) this.renderer.setSize(w, h);
    const camera = this.host.camera;
    camera.updateMatrixWorld();
    if (!this.contextLost) this.renderer.render(this.scene, camera);
    this.drawn = shown.length > 0;
    const corner = new Vector3();
    for (const o of shown) {
      if (o.leaving) continue;
      o.holder.updateMatrixWorld(true);
      const box = new Box3().setFromObject(o.holder);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
        const sx = ((corner.x + 1) / 2) * w;
        const sy = ((1 - corner.y) / 2) * h;
        x0 = Math.min(x0, sx);
        y0 = Math.min(y0, sy);
        x1 = Math.max(x1, sx);
        y1 = Math.max(y1, sy);
      }
      o.box = { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) };
      o.firstBox ??= { ...o.box };
      const style = o.element.style;
      style.left = `${o.box.x}px`;
      style.top = `${o.box.y}px`;
      style.width = `${o.box.width}px`;
      style.height = `${o.box.height}px`;
    }
  }
}
