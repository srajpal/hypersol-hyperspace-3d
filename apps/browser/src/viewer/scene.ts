/**
 * A HoloML scene in Three.js (holoml SPEC.md, section 5): models, groups,
 * lights, labels, links, the viewpoint, and animation. The scene draws
 * only when something changes (a model arrives, the view moves, an
 * animation runs, a script asks), so an idle page costs nothing.
 *
 * Milestone 15: models load within the page's limits (budget.ts; issue
 * #23); links and named things are reached with Tab, and an outline of
 * the scene is in the page for screen readers and the text view (#25);
 * reduced motion is followed; the instrument panel's Scene part reads
 * the tree, the selection, and the costs from here (#28).
 *
 * Milestone 17 (HoloML 0.2 draft): elements can be added and removed by
 * the page's scripts (api.ts); a model file is loaded once and repeated
 * plain models are drawn as instances (instances.ts); walls and gravity
 * for walking (physics.ts); lights and the background can be animated;
 * sounds (sound.ts), text on the screen, and a crosshair.
 */
import {
  AmbientLight,
  AnimationMixer,
  Box3,
  Box3Helper,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  EdgesGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  LoadingManager,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Raycaster,
  Scene,
  SkinnedMesh,
  SpotLight,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  ACESFilmicToneMapping,
  type AnimationAction,
  type AnimationClip,
  type Intersection,
  type Material,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneModel } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { check, HoloParseError, parse, type ElementNode, type HoloNode } from '@hypersol/holoml';
import { Budget, LeftOut, LIMITS } from './budget';
import { orbitControls, walkControls, type ViewControls } from './controls';
import { InstancePool, countTriangles, worldBox, type Template } from './instances';
import { SolidGrid, Walker, type Box } from './physics';
import { SoundBank, type SoundHandle, type SoundReport } from './sound';
import { attr, color, contrastText, duration, has, num, repeat, resolveAddress, scale, text, vec3, type Vec3 } from './values';

const DEG = Math.PI / 180;
const LINK_HIGHLIGHT = 0x5ce1ff;

interface Link {
  href: string;
  object: Object3D;
  anchor: HTMLAnchorElement;
}

type Animated = 'position' | 'rotation' | 'scale' | 'intensity' | 'color' | 'background';

interface Animation {
  entry: Entry | null;
  object: Object3D | null;
  attribute: Animated;
  from: number[] | null;
  to: number[];
  duration: number;
  repeat: number;
  start: number[];
}

export interface ModelReport {
  src: string;
  /** refused: another site; left-out: over a limit, stopped, or failed to load (see reason). */
  state: 'loading' | 'loaded' | 'failed' | 'refused' | 'left-out';
  reason?: string;
  bytes?: number;
  triangles?: number;
  pictures?: { width: number; height: number }[];
  materials: Record<string, { color: string; metalness: number; roughness: number; opacity: number }>;
  animation: { name: string; playing: boolean; time: number } | null;
}

/** One element of the scene, for the outline, keyboard, inspector, and scripts. */
export interface Entry {
  el: ElementNode;
  kind: string;
  name: string;
  depth: number;
  object: Object3D | null;
  /** Its place in the outline (Tab order), if it is a link or a named thing. */
  item: HTMLElement | null;
  report?: ModelReport;
  id: string | null;
  parent: Entry | null;
  children: Entry[];
  /** The link it is inside, if any. */
  link: string | null;
  fromScript: boolean;
  removed?: boolean;
  /** Its own solid flag (models and groups, HoloML 0.2). */
  solid?: boolean;
  /** A model's file, once loaded; and the triangles it counts. */
  template?: Template;
  triangles?: number;
  sound?: SoundHandle;
  soundReport?: SoundReport;
  hud?: HTMLElement;
  /** A label's words and look, to draw it again when a script changes it. */
  labelLook?: { words: string; size: number; color: string; note: HTMLElement };
}

/** What a click, a tap, or the crosshair hit. */
export interface Hit {
  entry: Entry | null;
  point: Vec3 | null;
  normal: Vec3 | null;
}

export type SceneEvent =
  | { type: 'click'; hit: Hit; button: 'left' | 'right' | 'middle' }
  | { type: 'key'; key: string; down: boolean; repeat: boolean }
  | { type: 'frame'; time: number; dt: number };

interface LoadedTemplate {
  template: Template;
  animations: AnimationClip[];
  /** The first model to use a file has its triangles counted by the load itself. */
  claimed: boolean;
}

export class HolomlView {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.05, 2000);
  frames = 0;
  readonly models: ModelReport[] = [];
  readonly labels: { text: string; sprite: Sprite }[] = [];
  readonly links: Link[] = [];
  private readonly entryById = new Map<string, Entry>();
  private readonly entryOfObject = new WeakMap<Object3D, Entry>();
  private readonly animations: Animation[] = [];
  private readonly mixers: AnimationMixer[] = [];
  private readonly playing = new Set<AnimationAction>();
  private controls: ViewControls | null = null;
  private walker: Walker | null = null;
  private pending = 0;
  private started = 0;
  private frameRequested = false;
  private last = 0;
  private hovered: Link | null = null;
  private readonly highlight = new Box3Helper(new Box3(), LINK_HIGHLIGHT);
  private readonly raycaster = new Raycaster();
  private readonly base = document.baseURI;
  private readonly origin = new URL(document.baseURI).origin;
  private readonly textColor: string;
  readonly budget = new Budget();
  readonly entries: Entry[] = [];
  /** Elements past the page's limit, not shown. */
  leftOutElements = 0;
  /** Elements in the scene now (the page's limit counts these). */
  private elementCount = 2; // holoml and scene
  private readonly templates = new Map<string, Promise<LoadedTemplate>>();
  private readonly pools = new Map<Template, InstancePool>();
  private collidersDirty = true;
  private grid: SolidGrid | null = null;
  private selected = -1;
  private picking = false;
  private lights = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly outline: HTMLElement;
  private readonly hudLayer: HTMLElement;
  private readonly crosshair: HTMLElement;
  readonly sounds = new SoundBank();
  private readonly listeners = { click: new Set<(e: SceneEvent) => void>(), key: new Set<(e: SceneEvent) => void>(), frame: new Set<(e: SceneEvent) => void>() };
  private readonly version: string;
  private sceneId: string | null = null;
  /** The page's own ambient lights (HoloML 0.2: the soft light from around follows them). */
  private readonly ambients: AmbientLight[] = [];
  onReady: (() => void) | null = null;
  /** Loading began or ended (the shell's stop button and loading strip). */
  onBusy: ((busy: boolean) => void) | null = null;
  /** Something was left out or failed: the notice. */
  onLeftOut: (() => void) | null = null;

  constructor(root: ElementNode, container: HTMLElement, outline: HTMLElement, hudLayer: HTMLElement) {
    this.outline = outline;
    this.hudLayer = hudLayer;
    this.version = attr(root, 'version') === '0.2' ? '0.2' : '0.1';
    // Lines are hit only where they are, not a metre around them.
    this.raycaster.params.Line.threshold = 0.02;
    // Throws where Chromium cannot start WebGL 2; main.ts says so on the page.
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.outputColorSpace = SRGBColorSpace;
    container.append(this.renderer.domElement);
    this.renderer.domElement.dataset['testid'] = 'holoml-canvas';

    const scene = root.children.find((c): c is ElementNode => c.type === 'element' && c.name === 'scene');
    const background = scene ? color(scene, 'background') : null;
    this.scene.background = new Color(background ?? '#0b0f1e');
    this.textColor = contrastText(background ?? '#0b0f1e');
    this.sceneId = scene && this.version === '0.2' ? (attr(scene, 'id') ?? null) : null;
    // Soft reflections, so metal and paint look like themselves.
    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();

    this.crosshair = document.createElement('div');
    this.crosshair.className = 'holoml-crosshair';
    this.crosshair.setAttribute('aria-hidden', 'true');
    this.crosshair.hidden = true;
    this.hudLayer.append(this.crosshair);

    this.highlight.visible = false;
    this.scene.add(this.highlight);
    let viewpoint: ElementNode | null = null;
    const animates: ElementNode[] = [];
    if (scene) {
      for (const c of scene.children) {
        if (c.type !== 'element') continue;
        if (c.name === 'viewpoint') viewpoint ??= c;
        if (c.name === 'hud') {
          if (this.count(c)) this.hud(c, false);
          continue;
        }
        this.build(c, this.scene, null, null, 0, false, animates);
      }
    }
    if (this.leftOutElements > 0) {
      console.warn(`HoloML: ${this.leftOutElements.toLocaleString('en')} elements past the page's limit of ${LIMITS.elements.toLocaleString('en')} were left out.`);
    }
    if (this.lights === 0) {
      // No light on the page: light it softly, so models still show.
      const soft = new AmbientLight(0xffffff, 0.6);
      const sun = new DirectionalLight(0xffffff, 1.4);
      sun.position.set(3, 10, 6);
      soft.userData['default'] = sun.userData['default'] = true;
      this.scene.add(soft, sun);
    }
    for (const a of animates) this.addAnimation(a);
    this.setUpView(viewpoint);
    this.wirePointer();
    this.wireKeys();
    this.sounds.onChange = () => this.requestFrame();
    window.addEventListener('resize', () => this.resize());
    // Reduced motion: animations show their end at once (issue #25).
    this.reducedMotion.addEventListener('change', () => {
      this.applyMotion();
      this.requestFrame();
    });
    // Leaving the page releases everything, unless the back-forward cache keeps it to show again.
    window.addEventListener('pagehide', (e) => {
      if (!e.persisted) this.dispose();
    });
    this.resize();
    this.started = performance.now();
    this.applyMotion();
    if (this.pending === 0) queueMicrotask(() => this.onReady?.());
  }

  /** Stops every model still loading (Esc, the stop button). */
  stop(): void {
    this.budget.stop();
  }

  get stillMoving(): boolean {
    return !this.reducedMotion.matches;
  }

  get motionReduced(): boolean {
    return this.reducedMotion.matches;
  }

  /** With reduced motion, model animations hold their first frame and animate shows its end. */
  private applyMotion(): void {
    const still = this.reducedMotion.matches;
    for (const m of this.mixers) {
      for (const a of this.playing) {
        a.paused = still;
        if (still) a.time = 0;
      }
      m.update(0);
    }
  }

  /** Everything the page drew, released when the page goes. */
  dispose(): void {
    this.budget.stop(true);
    this.sounds.dispose();
    this.controls?.dispose();
    for (const pool of this.pools.values()) pool.dispose();
    const done = new Set<unknown>();
    const release = (o: Object3D) => {
      const mesh = o as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[] };
      if (mesh.geometry && !done.has(mesh.geometry)) {
        done.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      for (const m of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
        if (done.has(m)) continue;
        done.add(m);
        for (const value of Object.values(m)) if (value instanceof Texture) value.dispose();
        m.dispose();
      }
    };
    this.scene.traverse(release);
    for (const t of this.templates.values()) void t.then((loaded) => loaded.template.scene.traverse(release)).catch(() => undefined);
    this.renderer.dispose();
  }

  /** Where the viewer is and what it looks at. */
  get view(): { mode: 'orbit' | 'walk'; position: Vec3; target: Vec3 } {
    const p = this.camera.position;
    const t = this.controls?.target ?? new Vector3();
    return { mode: this.controls?.mode ?? 'orbit', position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
  }

  /** The walker (walk mode in a 0.2 page): its feet, and whether it stands on something. */
  get walkerInfo(): { feet: Vec3; onGround: boolean; gravity: boolean } | null {
    return this.walker ? { feet: [...this.walker.feet], onGround: this.walker.onGround, gravity: this.walker.gravity } : null;
  }

  /** An element's world position, rotation (degrees), and scale, by its id. */
  objectInfo(id: string): { position: Vec3; rotation: Vec3; scale: Vec3; marked: boolean } | null {
    const o = this.entryById.get(id)?.object;
    if (!o) return null;
    const p = new Vector3();
    o.getWorldPosition(p);
    const r = o.rotation;
    // Marked: a model left out shows the "missing" box where it would be.
    const marked = o.children.some((c) => c.userData['missing'] === true);
    return { position: [p.x, p.y, p.z], rotation: [r.x / DEG, r.y / DEG, r.z / DEG], scale: [o.scale.x, o.scale.y, o.scale.z], marked };
  }

  /** Where an object (by id) or a link (by index) is on the page, in CSS pixels, if in view. */
  screenPoint(which: string | number): { x: number; y: number } | null {
    const o = typeof which === 'number' ? this.links[which]?.object : this.entryById.get(which)?.object;
    if (!o) return null;
    const box = this.boxOf(o);
    const c = box.isEmpty() ? o.getWorldPosition(new Vector3()) : box.getCenter(new Vector3());
    c.project(this.camera);
    if (c.z > 1 || Math.abs(c.x) > 1 || Math.abs(c.y) > 1) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((c.x + 1) / 2) * rect.width, y: rect.top + ((1 - c.y) / 2) * rect.height };
  }

  /** The scene's lights: their kind, colour, and brightness, and whether the viewer added them. */
  lightsInfo(): { type: string; color: string; intensity: number; default: boolean }[] {
    const out: { type: string; color: string; intensity: number; default: boolean }[] = [];
    this.scene.traverse((o) => {
      const l = o as Object3D & { isLight?: boolean; color?: Color; intensity?: number };
      if (!l.isLight || !l.color) return;
      const type = o instanceof AmbientLight ? 'ambient' : o instanceof DirectionalLight ? 'directional' : o instanceof SpotLight ? 'spot' : o instanceof PointLight ? 'point' : o.type;
      out.push({ type, color: `#${l.color.getHexString()}`, intensity: l.intensity ?? 0, default: o.userData['default'] === true });
    });
    return out;
  }

  /** How the scene is drawn: draw calls and triangles in the last frame, and the instance pools. */
  get stats(): { calls: number; triangles: number; pools: { src: string; count: number }[]; solids: number } {
    const info = this.renderer.info.render;
    const pools = [...this.pools.values()].map((p) => ({ src: p.src, count: p.count }));
    return { calls: info.calls, triangles: info.triangles, pools, solids: this.grid?.size ?? 0 };
  }

  get busy(): boolean {
    return this.pending > 0;
  }

  /** What was left out, and why, for the notice. */
  get leftOut(): { what: string; why: string }[] {
    const out = this.models.filter((m) => m.state === 'left-out' || m.state === 'refused' || m.state === 'failed').map((m) => ({ what: m.src, why: m.reason ?? m.state }));
    for (const s of this.sounds.reports) if (s.state !== 'loaded' && s.state !== 'loading') out.push({ what: s.src, why: s.reason ?? s.state });
    if (this.leftOutElements > 0) {
      out.push({ what: `${this.leftOutElements.toLocaleString('en')} elements`, why: `past the page's limit of ${LIMITS.elements.toLocaleString('en')}` });
    }
    return out;
  }

  // ---- Building --------------------------------------------------------------

  /** Counts an element against the page's limit; false (and counted as left out) past it. */
  private count(node: ElementNode): boolean {
    if (this.elementCount + 1 > LIMITS.elements) {
      this.leftOutElements += 1 + countElements(node);
      return false;
    }
    this.elementCount += 1;
    return true;
  }

  /**
   * Builds one element (and what it holds) under a parent. From the page,
   * named things go into the outline; from a script (holoml.add), only
   * those with an id do (SPEC.md section 10, "Limits").
   */
  private build(node: HoloNode, parent: Object3D, parentEntry: Entry | null, link: string | null, depth: number, fromScript: boolean, animates: ElementNode[]): Entry | null {
    if (node.type !== 'element') return null;
    // The page's limit on elements: later ones are left out (issue #23).
    if (!this.count(node)) return null;
    const id = attr(node, 'id') ?? null;
    const entry: Entry = { el: node, kind: node.name, name: nameOf(node), depth, object: null, item: null, id: null, parent: parentEntry, children: [], link, fromScript };
    if (id) {
      if (this.entryById.has(id)) console.warn(`HoloML: the id "${id}" is used twice; the second is ignored.`);
      else {
        entry.id = id;
        this.entryById.set(id, entry);
      }
    }
    this.entries.push(entry);
    parentEntry?.children.push(entry);
    const listed = !link && (!fromScript || entry.id !== null);
    switch (node.name) {
      case 'group': {
        const g = this.place(new Object3D(), node);
        parent.add(g);
        this.setObject(entry, g);
        if (this.version === '0.2' && has(node, 'solid')) entry.solid = true;
        if (entry.id && listed) entry.item = this.addItem(entry, 'Group');
        for (const c of node.children) this.build(c, g, entry, link, depth + 1, fromScript, animates);
        this.track(g, link);
        break;
      }
      case 'model':
        if (listed) entry.item = this.addItem(entry, 'Model');
        if (this.version === '0.2' && has(node, 'solid')) entry.solid = true;
        this.setObject(entry, this.model(node, parent, entry));
        this.track(entry.object!, link);
        break;
      case 'light': {
        const l = this.light(node, parent);
        if (l) {
          this.setObject(entry, l);
          this.lights += 1;
        }
        break;
      }
      case 'label':
        this.setObject(entry, this.label(node, parent, entry));
        if (listed) entry.item = this.addItem(entry, 'Label');
        this.track(entry.object!, link);
        break;
      case 'a': {
        const href = resolveAddress(attr(node, 'href'), this.base);
        const holder = new Object3D();
        parent.add(holder);
        this.setObject(entry, holder);
        // In the outline before what it holds, in page order.
        if (href && !link) entry.item = this.addLink(href.href, holder, node);
        // A link inside a link is not followed (the checker reports it).
        for (const c of node.children) this.build(c, holder, entry, link ?? href?.href ?? null, depth + 1, fromScript, animates);
        break;
      }
      case 'animate':
        animates.push(node);
        break;
      case 'sound':
        if (this.version === '0.2') this.sound(node, entry);
        break;
    }
    return entry;
  }

  private setObject(entry: Entry, o: Object3D): void {
    entry.object = o;
    this.entryOfObject.set(o, entry);
  }

  private place(o: Object3D, el: ElementNode): Object3D {
    o.position.set(...vec3(el, 'position', [0, 0, 0]));
    const [rx, ry, rz] = vec3(el, 'rotation', [0, 0, 0]);
    o.rotation.set(rx * DEG, ry * DEG, rz * DEG, 'XYZ');
    o.scale.set(...scale(el));
    return o;
  }

  private track(o: Object3D, link: string | null): void {
    if (link) o.userData['link'] = link;
  }

  /** A model file, fetched within the limits and decoded once for every model that uses it. */
  private loadTemplate(url: URL): Promise<LoadedTemplate> {
    const known = this.templates.get(url.href);
    if (known) return known;
    let blobs = new Map<string, string>();
    const loading = this.budget
      .load(url, this.origin)
      .then(async (files) => {
        blobs = files.blobs;
        // The loader reads the counted files only, never the network.
        const manager = new LoadingManager();
        manager.setURLModifier((u) => blobs.get(new URL(u, url).href) ?? (u.startsWith('data:') || u.startsWith('blob:') ? u : 'blob:uncounted'));
        const gltf = await new GLTFLoader(manager).parseAsync(files.main, url.href.slice(0, url.href.lastIndexOf('/') + 1));
        // After decoding, the pictures' real sizes too (a backstop for unknown formats).
        let tooBig: string | null = null;
        let skinned = false;
        gltf.scene.traverse((o) => {
          if (o instanceof SkinnedMesh) skinned = true;
          const m = (o as Mesh).material;
          for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
            for (const value of Object.values(mat)) {
              const img = value instanceof Texture ? (value.image as { width?: number; height?: number } | null) : null;
              if (img && ((img.width ?? 0) > LIMITS.pictureSide || (img.height ?? 0) > LIMITS.pictureSide)) {
                tooBig = `a picture of ${img.width} by ${img.height} pixels is larger than ${LIMITS.pictureSide} by ${LIMITS.pictureSide}`;
              }
            }
          }
        });
        if (tooBig) {
          this.budget.releaseTriangles(files.triangles);
          throw new LeftOut(tooBig);
        }
        gltf.scene.updateMatrixWorld(true);
        const template: Template = {
          scene: gltf.scene,
          box: new Box3().setFromObject(gltf.scene),
          triangles: files.triangles || countTriangles(gltf.scene),
          bytes: files.bytes,
          pictures: files.pictures,
          instanceable: !skinned && gltf.animations.length === 0,
        };
        return { template, animations: gltf.animations, claimed: false };
      })
      .finally(() => {
        for (const b of blobs.values()) URL.revokeObjectURL(b);
      });
    this.templates.set(url.href, loading);
    return loading;
  }

  private model(el: ElementNode, parent: Object3D, entry: Entry): Object3D {
    const holder = this.place(new Object3D(), el);
    parent.add(holder);
    const src = attr(el, 'src') ?? '';
    const report: ModelReport = { src, state: 'loading', materials: {}, animation: null };
    this.models.push(report);
    entry.report = report;
    const url = resolveAddress(src, this.base);
    // Models come from the page's own site only (owner, prompt 65, Q2 a);
    // the page's content policy enforces the same.
    if (!url || url.origin !== this.origin) {
      report.state = 'refused';
      report.reason = "models load only from the page's own site";
      console.warn(`HoloML: the model "${src}" was not loaded: models load only from the page's own site.`);
      holder.add(missingMarker());
      this.onLeftOut?.();
      return holder;
    }
    // The page's limit on model files (issue #23; a file used many times counts once).
    if (!this.templates.has(url.href) && this.templates.size >= LIMITS.modelFiles) {
      this.leaveOut(holder, report, entry, `more than ${LIMITS.modelFiles} model files on the page`);
      return holder;
    }
    const changes = el.children.filter((c): c is ElementNode => c.type === 'element' && c.name === 'material');
    const clipName = attr(el, 'animation');
    this.pending += 1;
    if (this.pending === 1) this.onBusy?.(true);
    this.loadTemplate(url)
      .then((loaded) => {
        if (entry.removed) return;
        const t = loaded.template;
        // Each model drawn counts its triangles; the first was counted by the load.
        if (loaded.claimed) this.budget.useTriangles(t.triangles);
        loaded.claimed = true;
        entry.template = t;
        entry.triangles = t.triangles;
        report.bytes = t.bytes;
        report.triangles = t.triangles;
        report.pictures = t.pictures;
        holder.userData['template'] = t;
        if (t.instanceable && changes.length === 0 && !clipName) {
          // Drawn as an instance of the file's meshes (many blocks, few draw calls).
          this.poolFor(t, url.href).add(holder);
          this.materialsOf(t.scene, report);
        } else {
          const copy = cloneModel(t.scene);
          holder.add(copy);
          this.changeMaterials(changes, copy, report);
          if (clipName) this.startClip(el, copy, loaded.animations, clipName, report);
        }
        report.state = 'loaded';
        if (this.isSolid(entry)) this.collidersDirty = true;
        this.applyMotion();
      })
      .catch((e: unknown) => {
        if (entry.removed) return;
        if (e instanceof LeftOut) this.leaveOut(holder, report, entry, e.reason);
        else this.leaveOut(holder, report, entry, `could not be loaded (${e instanceof Error ? e.message : String(e)})`, 'failed');
      })
      .finally(() => this.settle());
    return holder;
  }

  /** One thing finished loading (or failing): the scene is ready when nothing is left. */
  private settle(): void {
    this.pending -= 1;
    this.requestFrame();
    if (this.pending === 0) {
      this.onBusy?.(false);
      this.onReady?.();
    }
  }

  private poolFor(t: Template, src: string): InstancePool {
    let pool = this.pools.get(t);
    if (!pool) {
      pool = new InstancePool(t, this.scene, src);
      this.pools.set(t, pool);
    }
    return pool;
  }

  private startClip(el: ElementNode, model: Object3D, clips: AnimationClip[], clipName: string, report: ModelReport): void {
    const clip = clips.find((c) => c.name === clipName);
    if (!clip) {
      console.warn(`HoloML: the model "${report.src}" has no animation named "${clipName}".`);
      return;
    }
    const mixer = new AnimationMixer(model);
    const action = mixer.clipAction(clip);
    action.play();
    // Without autoplay the model holds the animation's first frame, as a pose.
    if (has(el, 'autoplay')) this.playing.add(action);
    else action.paused = true;
    mixer.update(0);
    this.mixers.push(mixer);
    report.animation = { name: clipName, playing: !action.paused, time: 0 };
    (report as ModelReport & { action?: AnimationAction }).action = action;
  }

  /** A model not shown: marked where it would be, reported, and out of the Tab order. */
  private leaveOut(holder: Object3D, report: ModelReport, entry: Entry, reason: string, state: 'left-out' | 'failed' = 'left-out'): void {
    report.state = state;
    report.reason = reason;
    console.warn(state === 'failed' ? `HoloML: the model "${report.src}" ${reason}.` : `HoloML: the model "${report.src}" was left out: ${reason}.`);
    const pool = holder.userData['pool'] as InstancePool | undefined;
    pool?.remove(holder);
    holder.clear();
    holder.add(missingMarker());
    if (entry.item) this.removeItem(entry);
    this.onLeftOut?.();
  }

  /** <material> children: change the named materials, only what is given. */
  private changeMaterials(changes: ElementNode[], model: Object3D, report: ModelReport): void {
    const done = new Map<Material, MeshStandardMaterial>();
    model.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const next = list.map((m: Material) => {
        const change = changes.find((c) => attr(c, 'name') === m.name);
        if (!change || !(m instanceof MeshStandardMaterial)) return m;
        const copy = done.get(m) ?? m.clone();
        if (!(copy instanceof MeshStandardMaterial)) return m;
        if (!done.has(m)) {
          const c = color(change, 'color');
          if (c) copy.color.set(c);
          copy.metalness = num(change, 'metalness', copy.metalness, 0, 1);
          copy.roughness = num(change, 'roughness', copy.roughness, 0, 1);
          if (has(change, 'opacity')) {
            copy.opacity = num(change, 'opacity', copy.opacity, 0, 1);
            copy.transparent = copy.opacity < 1;
          }
          done.set(m, copy);
        }
        return copy;
      });
      o.material = Array.isArray(o.material) ? next : next[0]!;
    });
    this.materialsOf(model, report);
    for (const c of changes) {
      const name = attr(c, 'name') ?? '';
      if (!report.materials[name]) console.warn(`HoloML: the model "${report.src}" has no material named "${name}".`);
    }
  }

  private materialsOf(model: Object3D, report: ModelReport): void {
    model.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof MeshStandardMaterial && m.name) {
          report.materials[m.name] = { color: `#${m.color.getHexString()}`, metalness: m.metalness, roughness: m.roughness, opacity: m.opacity };
        }
      }
    });
  }

  private light(el: ElementNode, parent: Object3D): Object3D | null {
    const type = attr(el, 'type');
    const c = color(el, 'color') ?? '#ffffff';
    const intensity = num(el, 'intensity', 1, 0);
    let light: Object3D & { intensity: number };
    // Directional, point, and spot lights are drawn twice as bright as written (milestone 14's look).
    let factor = 2;
    if (type === 'ambient') {
      light = new AmbientLight(c, intensity);
      factor = 1;
      this.ambients.push(light as AmbientLight);
    } else if (type === 'directional') {
      const d = new DirectionalLight(c, intensity * 2);
      d.position.set(...vec3(el, 'position', [0, 10, 10]));
      d.target.position.set(...vec3(el, 'look-at', [0, 0, 0]));
      parent.add(d.target);
      light = d;
    } else if (type === 'point') {
      // No fall-off with distance, so "intensity 1" means the same on any
      // page; "range" is where the light stops.
      const p = new PointLight(c, intensity * 2, num(el, 'range', 0, 0), 0);
      p.position.set(...vec3(el, 'position', [0, 3, 0]));
      light = p;
    } else if (type === 'spot') {
      const s = new SpotLight(c, intensity * 2, num(el, 'range', 0, 0), num(el, 'angle', 30, 0, 90) * DEG, 0.25, 0);
      s.position.set(...vec3(el, 'position', [0, 3, 0]));
      s.target.position.set(...vec3(el, 'look-at', [0, 0, 0]));
      parent.add(s.target);
      light = s;
    } else return null;
    light.userData['factor'] = factor;
    light.userData['kind'] = type;
    parent.add(light);
    return light;
  }

  private label(el: ElementNode, parent: Object3D, entry: Entry): Object3D {
    const words = text(el);
    const size = num(el, 'size', 0.2, Number.MIN_VALUE);
    const fill = color(el, 'color') ?? this.textColor;
    const sprite = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    drawLabel(sprite, words, size, fill);
    sprite.position.set(...vec3(el, 'position', [0, 0, 0]));
    parent.add(sprite);
    this.labels.push({ text: words, sprite });
    // The label's words are in the page too, for Find in page and screen readers.
    const note = document.createElement('p');
    note.textContent = words;
    document.getElementById('holoml-labels')?.append(note);
    entry.labelLook = { words, size, color: fill, note };
    return sprite;
  }

  /** Screen text (HoloML 0.2): lines of text in a corner, in front of the scene. */
  private hud(el: ElementNode, fromScript: boolean): Entry {
    const id = attr(el, 'id') ?? null;
    const entry: Entry = { el, kind: 'hud', name: nameOf(el), depth: 0, object: null, item: null, id: null, parent: null, children: [], link: null, fromScript };
    if (id && !this.entryById.has(id)) {
      entry.id = id;
      this.entryById.set(id, entry);
    }
    const corner = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(attr(el, 'corner') ?? '') ? attr(el, 'corner')! : 'top-left';
    let place = this.hudLayer.querySelector<HTMLElement>(`.holoml-hud-corner[data-corner="${corner}"]`);
    if (!place) {
      place = document.createElement('div');
      place.className = 'holoml-hud-corner';
      place.dataset['corner'] = corner;
      this.hudLayer.append(place);
    }
    this.entries.push(entry);
    const box = document.createElement('div');
    box.className = 'holoml-hud';
    box.dataset['testid'] = 'holoml-hud';
    if (entry.id) box.dataset['id'] = entry.id;
    box.setAttribute('role', 'status');
    box.style.fontSize = `${num(el, 'size', 18, Number.MIN_VALUE)}px`;
    const c = color(el, 'color');
    if (c) box.style.color = c;
    place.append(box);
    entry.hud = box;
    this.setHudText(entry, el.children.map((ch) => (ch.type === 'text' ? ch.value : '')).join(''));
    return entry;
  }

  private setHudText(entry: Entry, value: string): void {
    const lines = value
      .split(/\r\n|\r|\n/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l !== '');
    entry.hud!.replaceChildren(
      ...lines.map((l) => {
        const line = document.createElement('div');
        line.textContent = l;
        return line;
      }),
    );
    entry.hud!.hidden = lines.length === 0;
  }

  /** A sound (HoloML 0.2): fetched within the limits; played after the viewer's first click or key. */
  private sound(el: ElementNode, entry: Entry): void {
    const src = attr(el, 'src') ?? '';
    const report: SoundReport = { id: entry.id, src, state: 'loading', playing: false };
    entry.soundReport = report;
    const handle = this.sounds.add(report, { loop: has(el, 'loop'), autoplay: has(el, 'autoplay'), volume: num(el, 'volume', 1, 0, 1) });
    entry.sound = handle;
    const url = resolveAddress(src, this.base);
    if (!url || url.origin !== this.origin) {
      handle.fail('refused', "sounds load only from the page's own site");
      console.warn(`HoloML: the sound "${src}" was not loaded: sounds load only from the page's own site.`);
      this.onLeftOut?.();
      return;
    }
    this.pending += 1;
    if (this.pending === 1) this.onBusy?.(true);
    this.budget
      .file(url, this.origin)
      .then(({ data, bytes }) => {
        report.bytes = bytes;
        if (!entry.removed) handle.arrive(data);
      })
      .catch((e: unknown) => {
        const reason = e instanceof LeftOut ? e.reason : `could not be loaded (${e instanceof Error ? e.message : String(e)})`;
        handle.fail(e instanceof LeftOut ? 'left-out' : 'failed', reason);
        console.warn(`HoloML: the sound "${src}" was not loaded: ${reason}.`);
        this.onLeftOut?.();
      })
      .finally(() => this.settle());
  }

  private addLink(href: string, object: Object3D, el: ElementNode): HTMLElement {
    const anchor = document.createElement('a');
    anchor.href = href;
    const words: string[] = [];
    const collect = (n: HoloNode) => {
      if (n.type !== 'element') return;
      if (n.name === 'label') words.push(text(n));
      n.children.forEach(collect);
    };
    collect(el);
    anchor.textContent = words.join(' ') || `Link to ${href}`;
    const link: Link = { href, object, anchor };
    // Keyboard: Tab reaches each link, which lights up in the scene; Enter follows it.
    anchor.addEventListener('focus', () => this.setHovered(link));
    anchor.addEventListener('blur', () => this.setHovered(null));
    const li = document.createElement('li');
    li.className = 'holoml-link';
    li.append(anchor);
    this.outline.append(li);
    this.links.push(link);
    return anchor;
  }

  /**
   * A named thing in the outline (issue #25): reached with Tab in page
   * order, outlined in the scene while in focus, and named for screen
   * readers.
   */
  private addItem(entry: Entry, kind: string): HTMLElement {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${kind}: ${entry.name}`;
    button.addEventListener('focus', () => this.outlineObject(entry.object));
    button.addEventListener('blur', () => this.outlineObject(null));
    li.append(button);
    this.outline.append(li);
    return button;
  }

  /** Removes a thing from the outline; if it had focus, the next one (or the one before) takes it. */
  private removeItem(entry: Entry): void {
    const item = entry.item;
    if (!item) return;
    const li = item.parentElement!;
    if (document.activeElement === item) {
      const next = (li.nextElementSibling ?? li.previousElementSibling)?.querySelector<HTMLElement>('a, button');
      next?.focus();
    }
    li.remove();
    entry.item = null;
  }

  /** The outline drawn around the object in focus or under the pointer, in world space. */
  get highlightInfo(): { visible: boolean; min: Vec3; max: Vec3 } {
    const { min, max } = this.highlight.box;
    return { visible: this.highlight.visible, min: [min.x, min.y, min.z], max: [max.x, max.y, max.z] };
  }

  /** An object's bounding box in the world, counting the instances drawn for it. */
  boxOf(o: Object3D): Box3 {
    o.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(o);
    const extra = new Box3();
    o.traverse((c) => {
      const t = c.userData['template'] as Template | undefined;
      if (t && c.userData['pool']) box.union(worldBox(t, c, extra));
    });
    return box;
  }

  private outlineObject(object: Object3D | null): void {
    if (object) {
      this.highlight.box.copy(this.boxOf(object)).expandByScalar(0.05);
      this.highlight.visible = !this.highlight.box.isEmpty();
    } else if (!this.hovered) this.highlight.visible = false;
    this.requestFrame();
  }

  // ---- Animation ------------------------------------------------------------

  private addAnimation(el: ElementNode): void {
    const id = attr(el, 'target')?.replace(/^#/, '') ?? '';
    const attribute = attr(el, 'attribute') as Animated | null | undefined;
    const ms = duration(el, 'duration');
    if (ms === null || !attribute) return;
    const v02 = this.version === '0.2';
    const entry = this.entryById.get(id) ?? null;
    const isScene = v02 && id !== '' && id === this.sceneId;
    let object: Object3D | null = entry?.object ?? null;
    let from: number[] | null;
    let to: number[];
    let start: number[];
    if (attribute === 'position' || attribute === 'rotation' || attribute === 'scale') {
      if (!object || !entry) return;
      if (entry.kind === 'light' && (!v02 || attribute !== 'position' || object instanceof AmbientLight)) return;
      from = has(el, 'from') ? vec3(el, 'from', [0, 0, 0]) : null;
      to = vec3(el, 'to', [0, 0, 0]);
      start = current(object, attribute);
    } else if (v02 && attribute === 'intensity' && entry?.kind === 'light' && object) {
      const l = object as Object3D & { intensity: number };
      from = has(el, 'from') ? [num(el, 'from', 0, 0)] : null;
      to = [num(el, 'to', 0, 0)];
      start = [l.intensity / (l.userData['factor'] as number)];
    } else if (v02 && attribute === 'color' && entry?.kind === 'light' && object) {
      const l = object as Object3D & { color: Color };
      const f = color(el, 'from');
      from = f ? rgb(f) : null;
      to = rgb(color(el, 'to') ?? '#ffffff');
      start = rgbOf(l.color);
    } else if (v02 && attribute === 'background' && isScene) {
      object = null;
      const f = color(el, 'from');
      from = f ? rgb(f) : null;
      to = rgb(color(el, 'to') ?? '#000000');
      start = rgbOf(this.scene.background as Color);
    } else return;
    this.animations.push({ entry, object, attribute, from, to, duration: ms, repeat: repeat(el), start });
  }

  private setUpView(viewpoint: ElementNode | null): void {
    const position = viewpoint ? vec3(viewpoint, 'position', [0, 1.6, 5]) : ([0, 1.6, 5] as Vec3);
    const lookAt = new Vector3(...(viewpoint ? vec3(viewpoint, 'look-at', [0, 1, 0]) : ([0, 1, 0] as Vec3)));
    this.camera.position.set(...position);
    this.camera.lookAt(lookAt);
    const mode = viewpoint && attr(viewpoint, 'mode') === 'walk' ? 'walk' : 'orbit';
    const changed = () => this.requestFrame();
    // On the canvas itself: the controls capture the pointer while dragging,
    // and a click on a link must still reach the canvas's own listeners.
    const canvas = this.renderer.domElement;
    const v02 = this.version === '0.2';
    if (v02 && viewpoint && has(viewpoint, 'crosshair')) this.crosshair.hidden = false;
    if (mode === 'walk' && v02) {
      // HoloML 0.2: walls, and gravity if the page asks for it.
      this.walker = new Walker(position, has(viewpoint!, 'gravity'), has(viewpoint!, 'jump'));
      this.controls = walkControls(this.camera, canvas, lookAt, changed, { walker: this.walker, solids: () => this.solids() });
    } else {
      this.controls = mode === 'walk' ? walkControls(this.camera, canvas, lookAt, changed) : orbitControls(this.camera, canvas, lookAt, changed);
    }
  }

  // ---- Walls --------------------------------------------------------------------

  /** Whether a model stops the walker: its own flag, or a solid group around it. */
  private isSolid(entry: Entry): boolean {
    for (let e: Entry | null = entry; e; e = e.parent) if (e.solid) return true;
    return false;
  }

  /** The solid boxes, rebuilt when solid things are added, removed, or moved. */
  private solids(): SolidGrid {
    if (this.grid && !this.collidersDirty) return this.grid;
    this.scene.updateMatrixWorld();
    const boxes: Box[] = [];
    const b = new Box3();
    for (const e of this.entries) {
      if (e.kind !== 'model' || e.removed || !e.template || !this.isSolid(e) || e.report?.state !== 'loaded') continue;
      const o = e.object!;
      if (o.userData['pool']) worldBox(e.template, o, b);
      else b.setFromObject(o);
      if (!b.isEmpty()) boxes.push({ min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] });
    }
    this.grid = new SolidGrid(boxes);
    this.collidersDirty = false;
    return this.grid;
  }

  // ---- Pointer and links ----------------------------------------------------

  /** The link under a point of the page, in CSS pixels (for the tests' failure reports). */
  linkHrefAt(x: number, y: number): string | null {
    return this.linkAt(x, y)?.href ?? null;
  }

  private ndc(x: number, y: number): Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new Vector2(((x - rect.left) / rect.width) * 2 - 1, 1 - ((y - rect.top) / rect.height) * 2);
  }

  /** The things under a point of the view, nearest first, as their own objects (an instance as its holder). */
  private hits(ndc: Vector2): { hit: Intersection; object: Object3D }[] {
    this.raycaster.setFromCamera(ndc, this.camera);
    const out: { hit: Intersection; object: Object3D }[] = [];
    for (const hit of this.raycaster.intersectObjects(this.scene.children, true)) {
      if (hit.object === this.highlight) continue;
      const pool = hit.object.userData['pool'] as InstancePool | undefined;
      const object = hit.object instanceof InstancedMesh && pool && hit.instanceId !== undefined ? pool.slots[hit.instanceId] : hit.object;
      if (object) out.push({ hit, object });
    }
    return out;
  }

  private linkAt(x: number, y: number): Link | null {
    for (const { hit, object } of this.hits(this.ndc(x, y))) {
      let o: Object3D | null = object;
      while (o && o.userData['link'] === undefined) o = o.parent;
      const href = o?.userData['link'] as string | undefined;
      if (href) return this.links.find((l) => l.href === href && isInside(object, l.object)) ?? null;
      if (hit.object !== this.highlight) return null; // the first thing hit is not a link
    }
    return null;
  }

  /** What is at a point of the view: the innermost element with a place, where, and which way the face looks. */
  private hitAt(ndc: Vector2): Hit | null {
    const first = this.hits(ndc)[0];
    if (!first) return null;
    const { hit, object } = first;
    let entry: Entry | null = null;
    for (let o: Object3D | null = object; o && !entry; o = o.parent) {
      const e = this.entryOfObject.get(o);
      if (e && e.kind !== 'a' && !e.removed) entry = e;
    }
    let normal: Vec3 | null = null;
    if (hit.face) {
      const n = hit.face.normal.clone();
      const world = hit.object.matrixWorld.clone();
      if (hit.object instanceof InstancedMesh && hit.instanceId !== undefined) {
        const m = new Matrix4();
        hit.object.getMatrixAt(hit.instanceId, m);
        world.multiply(m);
      }
      n.transformDirection(world);
      normal = [round(n.x), round(n.y), round(n.z)];
    }
    return { entry, point: [hit.point.x, hit.point.y, hit.point.z], normal };
  }

  /** What is in the middle of the view (under the crosshair). */
  aim(): Hit | null {
    // The view may have turned since the last frame was drawn.
    this.camera.updateMatrixWorld();
    this.scene.updateMatrixWorld();
    for (const pool of this.pools.values()) pool.sync();
    return this.hitAt(new Vector2(0, 0));
  }

  /** The inspector's pick mode. */
  setPicking(on: boolean): void {
    this.picking = on;
    this.renderer.domElement.style.cursor = on ? 'crosshair' : '';
  }

  get pickingNow(): boolean {
    return this.picking;
  }

  /** Selects an entry by its index (-1: none), and outlines it. */
  select(index: number): void {
    this.selected = index >= 0 && index < this.entries.length ? index : -1;
    this.outlineObject(this.entries[this.selected]?.object ?? null);
  }

  get selectedIndex(): number {
    return this.selected;
  }

  /** The innermost entry whose object is under a point of the page. */
  private entryAt(x: number, y: number): number {
    const hit = this.hitAt(this.ndc(x, y));
    return hit?.entry ? this.entries.indexOf(hit.entry) : -1;
  }

  /** What the inspector shows for one entry: its bounds, place, and costs. */
  entryInfo(index: number): { bounds: [Vec3, Vec3] | null; position: Vec3; rotation: Vec3; scale: Vec3; triangles: number | null; pictures: { width: number; height: number }[] } | null {
    const e = this.entries[index];
    if (!e) return null;
    const o = e.object;
    const box = o ? this.boxOf(o) : null;
    const p = new Vector3();
    o?.getWorldPosition(p);
    return {
      bounds: box && !box.isEmpty() ? [[box.min.x, box.min.y, box.min.z], [box.max.x, box.max.y, box.max.z]] : null,
      position: [p.x, p.y, p.z],
      rotation: o ? [o.rotation.x / DEG, o.rotation.y / DEG, o.rotation.z / DEG] : [0, 0, 0],
      scale: o ? [o.scale.x, o.scale.y, o.scale.z] : [1, 1, 1],
      triangles: e.report?.triangles ?? null,
      pictures: e.report?.pictures ?? [],
    };
  }

  private setHovered(link: Link | null): void {
    if (this.hovered === link) return;
    this.hovered = link;
    this.renderer.domElement.style.cursor = link ? 'pointer' : '';
    if (link) {
      this.highlight.box.copy(this.boxOf(link.object)).expandByScalar(0.05);
      this.highlight.visible = true;
    } else this.highlight.visible = false;
    this.requestFrame();
  }

  private wirePointer(): void {
    const canvas = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons === 0) this.setHovered(this.linkAt(e.clientX, e.clientY));
    });
    canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', (e) => {
      const start = down;
      down = null;
      // A drag moves the view; only a click (or tap) follows a link.
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
      // The inspector's pick: a click selects instead of following a link (issue #28).
      if (this.picking) {
        this.select(this.entryAt(e.clientX, e.clientY));
        return;
      }
      if (this.listeners.click.size > 0) {
        this.scene.updateMatrixWorld();
        for (const pool of this.pools.values()) pool.sync();
        const hit = this.hitAt(this.ndc(e.clientX, e.clientY)) ?? { entry: null, point: null, normal: null };
        this.emit({ type: 'click', hit, button: e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left' });
      }
      const link = this.linkAt(e.clientX, e.clientY);
      if (!link) return;
      if (e.button === 1 || e.ctrlKey || e.metaKey) window.open(link.href, '_blank');
      else if (e.button === 0) location.assign(link.href);
    });
    canvas.addEventListener('auxclick', (e) => e.preventDefault());
    // While a script listens for clicks, a right-click is the page's, not the browser's menu.
    canvas.addEventListener('contextmenu', (e) => {
      if (this.listeners.click.size > 0) e.preventDefault();
    });
  }

  private wireKeys(): void {
    const send = (e: KeyboardEvent, down: boolean) => {
      if (this.listeners.key.size === 0 || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      this.emit({ type: 'key', key: e.key, down, repeat: e.repeat });
    };
    window.addEventListener('keydown', (e) => send(e, true));
    window.addEventListener('keyup', (e) => send(e, false));
  }

  // ---- Scripts (api.ts) -------------------------------------------------------

  /** Calls a script's listener for a kind of event; returns a function that stops it. */
  listen(type: 'click' | 'key' | 'frame', listener: (e: SceneEvent) => void): () => void {
    this.listeners[type].add(listener);
    if (type === 'frame') this.requestFrame();
    return () => this.listeners[type].delete(listener);
  }

  private emit(e: SceneEvent): void {
    for (const listener of [...this.listeners[e.type]]) {
      try {
        listener(e);
      } catch (error) {
        // One listener's mistake must not stop the others, or the drawing.
        console.error(error);
      }
    }
  }

  findEntry(id: string): Entry | null {
    const e = this.entryById.get(id);
    return e && !e.removed ? e : null;
  }

  get pageVersion(): string {
    return this.version;
  }

  /**
   * Adds elements written in HoloML to the scene, or into a group
   * (holoml.add). They are checked like the page; an element with a
   * problem is left out, and the console says why.
   */
  addMarkup(markup: string, parent: Entry | null): Entry[] {
    const wrapped = `<holoml version="0.2"><scene>\n${markup}\n</scene></holoml>`;
    let doc;
    try {
      doc = parse(wrapped);
    } catch (e) {
      if (e instanceof HoloParseError) {
        console.warn(`HoloML: holoml.add: ${e.detail} (line ${e.position.line - 1}, column ${e.position.column}).`);
        return [];
      }
      throw e;
    }
    const scene = doc.root.children.find((c): c is ElementNode => c.type === 'element' && c.name === 'scene')!;
    const tops = scene.children.filter((c): c is ElementNode => c.type === 'element');
    const problems = check(doc).filter((p) => p.line > 1);
    const after = (p: { line: number; column: number }, s: { line: number; column: number }) => p.line > s.line || (p.line === s.line && p.column >= s.column);
    const added: Entry[] = [];
    const animates: ElementNode[] = [];
    const into = parent?.object ?? this.scene;
    tops.forEach((node, i) => {
      const next = tops[i + 1];
      if (!['group', 'model', 'light', 'label', 'sound'].includes(node.name)) {
        console.warn(`HoloML: holoml.add adds groups, models, lights, labels, and sounds, not <${node.name}>.`);
        return;
      }
      const own = problems.filter((p) => after(p, node.start) && (!next || !after(p, next.start)));
      if (own.length > 0) {
        for (const p of own) console.warn(`HoloML: holoml.add: line ${p.line - 1}, column ${p.column}: ${p.message}; <${node.name}> left out.`);
        return;
      }
      const entry = this.build(node, into, parent, parent?.link ?? null, (parent?.depth ?? -1) + 1, true, animates);
      if (entry) added.push(entry);
      else console.warn(`HoloML: holoml.add: <${node.name}> left out: past the page's limit of ${LIMITS.elements.toLocaleString('en')} elements.`);
    });
    if (added.some((e) => this.hasSolid(e))) this.collidersDirty = true;
    if (this.leftOutElements > 0) this.onLeftOut?.();
    this.requestFrame();
    return added;
  }

  private hasSolid(entry: Entry): boolean {
    if (entry.kind === 'model' && this.isSolid(entry)) return true;
    return entry.children.some((c) => this.hasSolid(c));
  }

  /** Removes an element and everything in it (holoml.remove). */
  removeEntry(entry: Entry): void {
    if (entry.removed) return;
    const gone: Entry[] = [];
    const collect = (e: Entry) => {
      gone.push(e);
      e.children.forEach(collect);
    };
    collect(entry);
    let solid = false;
    for (const e of gone) {
      e.removed = true;
      if (e.kind === 'model' && this.isSolid(e)) solid = true;
      if (e.id && this.entryById.get(e.id) === e) this.entryById.delete(e.id);
      const o = e.object;
      if (o) {
        (o.userData['pool'] as InstancePool | undefined)?.remove(o);
        if (e.kind === 'label') {
          const i = this.labels.findIndex((l) => l.sprite === o);
          if (i >= 0) this.labels.splice(i, 1);
          e.labelLook?.note.remove();
          ((o as Sprite).material.map as Texture | null)?.dispose();
          (o as Sprite).material.dispose();
        }
      }
      if (e.item) this.removeItem(e);
      e.sound?.remove();
      e.hud?.remove();
      if (e.report) {
        const i = this.models.indexOf(e.report);
        if (i >= 0) this.models.splice(i, 1);
      }
      if (e.triangles && e.report?.state === 'loaded') this.budget.releaseTriangles(e.triangles);
      this.elementCount -= 1;
    }
    entry.object?.removeFromParent();
    if (entry.parent) entry.parent.children = entry.parent.children.filter((c) => c !== entry);
    const removed = new Set(gone);
    const kept = this.entries.filter((e) => !removed.has(e));
    this.entries.length = 0;
    this.entries.push(...kept);
    if (this.selected >= this.entries.length) this.selected = -1;
    if (solid) this.collidersDirty = true;
    this.requestFrame();
  }

  /** Something about an element changed its place or visibility: redraw, and update instances and walls. */
  moved(entry: Entry): void {
    this.markMoved(entry);
    this.requestFrame();
  }

  /** Instances and walls follow an element's new place (drawn with the next frame). */
  private markMoved(entry: Entry): void {
    const o = entry.object;
    if (o) {
      o.traverse((c) => {
        const pool = c.userData['pool'] as InstancePool | undefined;
        if (pool) pool.dirty = true;
      });
    }
    if (this.hasSolid(entry)) this.collidersDirty = true;
  }

  setSolid(entry: Entry, on: boolean): void {
    entry.solid = on;
    this.collidersDirty = true;
    this.requestFrame();
  }

  /** A label's or screen text's words. */
  textOf(entry: Entry): string | undefined {
    if (entry.kind === 'label') return entry.labelLook?.words;
    if (entry.kind === 'hud') return [...(entry.hud?.children ?? [])].map((c) => c.textContent ?? '').join('\n');
    return undefined;
  }

  setText(entry: Entry, value: string): void {
    if (entry.kind === 'hud') this.setHudText(entry, value);
    else if (entry.kind === 'label' && entry.labelLook && entry.object) {
      const words = value.replace(/\s+/g, ' ').trim();
      entry.labelLook.words = words;
      entry.labelLook.note.textContent = words;
      drawLabel(entry.object as Sprite, words, entry.labelLook.size, entry.labelLook.color);
      const listed = this.labels.find((l) => l.sprite === entry.object);
      if (listed) listed.text = words;
      entry.name = words || 'label';
      if (entry.item) entry.item.textContent = `Label: ${entry.name}`;
      this.requestFrame();
    }
  }

  colorOf(entry: Entry): string | undefined {
    if (entry.kind === 'light') return `#${(entry.object as Object3D & { color: Color }).color.getHexString()}`;
    if (entry.kind === 'label') return entry.labelLook?.color;
    if (entry.kind === 'hud') return entry.hud?.style.color ? `#${new Color(entry.hud.style.color).getHexString()}` : this.textColor;
    return undefined;
  }

  setColor(entry: Entry, value: string): void {
    if (entry.kind === 'light') (entry.object as Object3D & { color: Color }).color.set(value);
    else if (entry.kind === 'label' && entry.labelLook && entry.object) {
      entry.labelLook.color = value;
      drawLabel(entry.object as Sprite, entry.labelLook.words, entry.labelLook.size, value);
    } else if (entry.kind === 'hud' && entry.hud) entry.hud.style.color = value;
    this.requestFrame();
  }

  intensityOf(entry: Entry): number | undefined {
    if (entry.kind !== 'light' || !entry.object) return undefined;
    const l = entry.object as Object3D & { intensity: number };
    return l.intensity / (l.userData['factor'] as number);
  }

  setIntensity(entry: Entry, value: number): void {
    if (entry.kind !== 'light' || !entry.object) return;
    const l = entry.object as Object3D & { intensity: number };
    l.intensity = value * (l.userData['factor'] as number);
    this.requestFrame();
  }

  /** Changes one material of a model (holoml's thing.material): a model drawn as an instance gets its own copy first. */
  setMaterial(entry: Entry, name: string, change: { color?: string; metalness?: number; roughness?: number; opacity?: number }): void {
    const holder = entry.object;
    const t = entry.template;
    if (entry.kind !== 'model' || !holder || !t || entry.report?.state !== 'loaded') return;
    const pool = holder.userData['pool'] as InstancePool | undefined;
    if (pool) {
      pool.remove(holder);
      holder.add(cloneModel(t.scene));
    }
    holder.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const next = list.map((m: Material) => {
        if (m.name !== name || !(m instanceof MeshStandardMaterial)) return m;
        const copy = m.userData['own'] === holder ? m : m.clone();
        copy.userData['own'] = holder;
        if (change.color) copy.color.set(change.color);
        if (change.metalness !== undefined) copy.metalness = change.metalness;
        if (change.roughness !== undefined) copy.roughness = change.roughness;
        if (change.opacity !== undefined) {
          copy.opacity = change.opacity;
          copy.transparent = change.opacity < 1;
        }
        return copy;
      });
      o.material = Array.isArray(o.material) ? next : next[0]!;
    });
    this.materialsOf(holder, entry.report);
    this.requestFrame();
  }

  get backgroundColor(): string {
    return `#${(this.scene.background as Color).getHexString()}`;
  }

  set backgroundColor(value: string) {
    (this.scene.background as Color).set(value);
    this.requestFrame();
  }

  /** Where the viewer's eyes are, and which way they look. */
  get viewerPosition(): Vec3 {
    const p = this.camera.position;
    return [p.x, p.y, p.z];
  }

  set viewerPosition(v: Vec3) {
    this.controls?.moveTo(v);
    this.requestFrame();
  }

  get viewerDirection(): Vec3 {
    const d = this.camera.getWorldDirection(new Vector3());
    return [d.x, d.y, d.z];
  }

  viewerLookAt(point: Vec3): void {
    this.controls?.lookAt(point);
    this.requestFrame();
  }

  // ---- Drawing --------------------------------------------------------------

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.requestFrame();
  }

  requestFrame(): void {
    if (this.frameRequested) return;
    this.frameRequested = true;
    requestAnimationFrame((t) => this.frame(t));
  }

  private frame(time: number): void {
    this.frameRequested = false;
    const dt = this.last === 0 ? 16 : Math.min(100, time - this.last);
    this.last = time;
    let moving = this.controls?.step(dt) ?? false;
    if (this.stepAnimations(performance.now())) moving = true;
    if (this.playing.size > 0 && !this.reducedMotion.matches) {
      for (const m of this.mixers) m.update(dt / 1000);
      for (const report of this.models) {
        const a = (report as ModelReport & { action?: AnimationAction }).action;
        if (a && report.animation) report.animation.time = a.time;
      }
      moving = true;
    }
    // A script listening for frames keeps the scene drawing (HoloML 0.2).
    if (this.listeners.frame.size > 0) {
      this.emit({ type: 'frame', time: performance.now() - this.started, dt });
      moving = true;
    }
    if (this.pools.size > 0) {
      this.scene.updateMatrixWorld();
      for (const pool of this.pools.values()) pool.sync();
    }
    this.followAmbient();
    this.renderer.render(this.scene, this.camera);
    this.frames += 1;
    if (moving) this.requestFrame();
    else this.last = 0;
  }

  /**
   * The soft light from around the scene (the environment, for paint and
   * metal) is the renderer's. In a 0.2 page that has ambient lights, it
   * follows their brightness, so a page can make night (milestone 17);
   * 0.1 pages look as they did.
   */
  private followAmbient(): void {
    if (this.version !== '0.2' || this.ambients.length === 0) return;
    const ambient = this.ambients.reduce((sum, l) => sum + (l.parent ? l.intensity : 0), 0);
    this.scene.environmentIntensity = 0.45 * Math.min(1, ambient / 0.6);
  }

  /** Moves every animate element on; true while any still runs. */
  private stepAnimations(now: number): boolean {
    let running = false;
    const still = this.reducedMotion.matches;
    for (const a of this.animations) {
      if (a.entry?.removed) continue;
      const elapsed = now - this.started;
      const runs = elapsed / a.duration;
      // With reduced motion, every animation shows its end at once (issue #25).
      const done = still || runs >= a.repeat;
      const t = done ? 1 : runs - Math.floor(runs);
      const from = a.from ?? a.start;
      const v = from.map((f, i) => f + (a.to[i]! - f) * t);
      switch (a.attribute) {
        case 'rotation':
          a.object!.rotation.set(v[0]! * DEG, v[1]! * DEG, v[2]! * DEG, 'XYZ');
          break;
        case 'position':
        case 'scale':
          a.object![a.attribute].set(v[0]!, v[1]!, v[2]!);
          break;
        case 'intensity':
          (a.object as Object3D & { intensity: number }).intensity = v[0]! * (a.object!.userData['factor'] as number);
          break;
        case 'color':
          (a.object as Object3D & { color: Color }).color.setRGB(v[0]!, v[1]!, v[2]!, SRGBColorSpace);
          break;
        case 'background':
          (this.scene.background as Color).setRGB(v[0]!, v[1]!, v[2]!, SRGBColorSpace);
          break;
      }
      if (a.entry && (a.attribute === 'position' || a.attribute === 'rotation' || a.attribute === 'scale')) this.markMoved(a.entry);
      if (!done) running = true;
    }
    return running;
  }
}

/** Draws a label's words into its sprite (again, when a script changes them). */
function drawLabel(sprite: Sprite, words: string, size: number, fill: string): void {
  const px = 96;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `600 ${px}px system-ui, "Segoe UI", sans-serif`;
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(words).width) + px;
  canvas.width = width;
  canvas.height = Math.ceil(px * 1.5);
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = px * 0.12;
  ctx.fillStyle = fill;
  ctx.fillText(words, width / 2, canvas.height / 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  sprite.material.map?.dispose();
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  const height = size * 1.5;
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
}

function current(o: Object3D, attribute: 'position' | 'rotation' | 'scale'): Vec3 {
  if (attribute === 'rotation') return [MathUtils.radToDeg(o.rotation.x), MathUtils.radToDeg(o.rotation.y), MathUtils.radToDeg(o.rotation.z)];
  const v = o[attribute];
  return [v.x, v.y, v.z];
}

/** "#rrggbb" as red, green, and blue from 0 to 1 (as written, sRGB). */
function rgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbOf(c: Color): number[] {
  return rgb(`#${c.getHexString()}`);
}

/** A face's direction, with rounding noise removed (blocks give exact axes). */
function round(n: number): number {
  const r = Math.round(n * 1e4) / 1e4;
  return Object.is(r, -0) ? 0 : r;
}

/** How many elements a node holds, at any depth. */
function countElements(node: ElementNode): number {
  let n = 0;
  for (const c of node.children) if (c.type === 'element') n += 1 + countElements(c);
  return n;
}

/** A name for the outline and the inspector: the text, the id, or the file. */
function nameOf(el: ElementNode): string {
  if (el.name === 'label') return text(el) || 'label';
  const id = attr(el, 'id');
  if (id) return id;
  if (el.name === 'model') return (attr(el, 'src') ?? '').split(/[?#]/)[0]!.split('/').pop() || 'model';
  if (el.name === 'sound') return (attr(el, 'src') ?? '').split(/[?#]/)[0]!.split('/').pop() || 'sound';
  if (el.name === 'a') return attr(el, 'href') ?? 'link';
  if (el.name === 'light') return `${attr(el, 'type') ?? ''} light`.trim();
  return el.name;
}

function isInside(o: Object3D, ancestor: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (p === ancestor) return true;
  return false;
}

/** Where a model that could not be loaded would be: a small red wire box. */
function missingMarker(): Object3D {
  const box = new LineSegments(new EdgesGeometry(new BoxGeometry(0.5, 0.5, 0.5)), new LineBasicMaterial({ color: 0xff4d6d }));
  box.position.y = 0.25;
  box.userData['missing'] = true;
  return box;
}
