/**
 * A HoloML 0.1 scene in Three.js (holoml SPEC.md, section 5): models,
 * groups, lights, labels, links, the viewpoint, and animation. The scene
 * draws only when something changes (a model arrives, the view moves, an
 * animation runs), so an idle page costs nothing.
 *
 * Milestone 15: models load within the page's limits (budget.ts; issue
 * #23); links and named things are reached with Tab, and an outline of
 * the scene is in the page for screen readers and the text view (#25);
 * reduced motion is followed; the instrument panel's Scene part reads
 * the tree, the selection, and the costs from here (#28).
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
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Raycaster,
  Scene,
  SpotLight,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  ACESFilmicToneMapping,
  type AnimationAction,
  type Material,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LoadingManager, Texture } from 'three';
import { Budget, LeftOut, LIMITS } from './budget';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ElementNode, HoloNode } from '@hypersol/holoml';
import { orbitControls, walkControls, type ViewControls } from './controls';
import { attr, color, contrastText, duration, has, num, repeat, resolveAddress, scale, text, vec3, type Vec3 } from './values';

const DEG = Math.PI / 180;
const LINK_HIGHLIGHT = 0x5ce1ff;

interface Link {
  href: string;
  object: Object3D;
  anchor: HTMLAnchorElement;
}

interface Animation {
  object: Object3D;
  attribute: 'position' | 'rotation' | 'scale';
  from: Vec3 | null;
  to: Vec3;
  duration: number;
  repeat: number;
  start: Vec3;
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

/** One element of the scene, for the outline, keyboard, and inspector. */
interface Entry {
  el: ElementNode;
  kind: string;
  name: string;
  depth: number;
  object: Object3D | null;
  /** Its place in the outline (Tab order), if it is a link or a named thing. */
  item: HTMLElement | null;
  report?: ModelReport;
}

export class HolomlView {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.05, 2000);
  frames = 0;
  readonly models: ModelReport[] = [];
  readonly labels: { text: string; sprite: Sprite }[] = [];
  readonly links: Link[] = [];
  private readonly ids = new Map<string, Object3D>();
  private readonly animations: Animation[] = [];
  private readonly mixers: AnimationMixer[] = [];
  private readonly playing = new Set<AnimationAction>();
  private controls: ViewControls | null = null;
  private pending = 0;
  private started = 0;
  private frameRequested = false;
  private last = 0;
  private hovered: Link | null = null;
  private readonly highlight = new Box3Helper(new Box3(), LINK_HIGHLIGHT);
  private readonly raycaster = new Raycaster();
  private readonly base = document.baseURI;
  private readonly textColor: string;
  readonly budget = new Budget();
  readonly entries: Entry[] = [];
  /** Elements past the page's limit, not shown. */
  leftOutElements = 0;
  private modelCount = 0;
  private selected = -1;
  private picking = false;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly outline: HTMLElement;
  onReady: (() => void) | null = null;
  /** Loading began or ended (the shell's stop button and loading strip). */
  onBusy: ((busy: boolean) => void) | null = null;
  /** Something was left out or failed: the notice. */
  onLeftOut: (() => void) | null = null;

  constructor(root: ElementNode, container: HTMLElement, outline: HTMLElement) {
    this.outline = outline;
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
    // Soft reflections, so metal and paint look like themselves.
    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();

    this.highlight.visible = false;
    this.scene.add(this.highlight);
    let lights = 0;
    let viewpoint: ElementNode | null = null;
    const animates: ElementNode[] = [];
    let elements = 2; // holoml and scene
    const build = (node: HoloNode, parent: Object3D, link: string | null, depth: number) => {
      if (node.type !== 'element') return;
      // The page's limit on elements: later ones are left out (issue #23).
      elements += 1;
      if (elements > LIMITS.elements) {
        this.leftOutElements += 1 + countElements(node);
        return;
      }
      const entry: Entry = { el: node, kind: node.name, name: nameOf(node), depth, object: null, item: null };
      this.entries.push(entry);
      switch (node.name) {
        case 'group': {
          const g = this.place(new Object3D(), node);
          parent.add(g);
          entry.object = g;
          if (attr(node, 'id') && !link) entry.item = this.addItem(entry, 'Group');
          for (const c of node.children) build(c, g, link, depth + 1);
          this.track(g, node, link);
          break;
        }
        case 'model':
          if (!link) entry.item = this.addItem(entry, 'Model');
          entry.object = this.model(node, parent, entry);
          this.track(entry.object, node, link);
          break;
        case 'light':
          entry.object = this.light(node, parent);
          if (entry.object) lights += 1;
          break;
        case 'label':
          entry.object = this.label(node, parent);
          if (!link) entry.item = this.addItem(entry, 'Label');
          this.track(entry.object, node, link);
          break;
        case 'a': {
          const href = resolveAddress(attr(node, 'href'), this.base);
          const holder = new Object3D();
          parent.add(holder);
          entry.object = holder;
          // In the outline before what it holds, in page order.
          if (href && !link) entry.item = this.addLink(href.href, holder, node);
          // A link inside a link is not followed (the checker reports it).
          for (const c of node.children) build(c, holder, link ?? href?.href ?? null, depth + 1);
          break;
        }
        case 'animate':
          animates.push(node);
          break;
        case 'viewpoint':
          if (parent === this.scene && !viewpoint) viewpoint = node;
          break;
      }
    };
    if (scene) for (const c of scene.children) build(c, this.scene, null, 0);
    if (this.leftOutElements > 0) {
      console.warn(`HoloML: ${this.leftOutElements.toLocaleString('en')} elements past the page's limit of ${LIMITS.elements.toLocaleString('en')} were left out.`);
    }
    if (lights === 0) {
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
    this.budget.stop();
    this.controls?.dispose();
    this.scene.traverse((o) => {
      const mesh = o as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[] };
      mesh.geometry?.dispose();
      for (const m of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
        for (const value of Object.values(m)) if (value instanceof Texture) value.dispose();
        m.dispose();
      }
    });
    this.renderer.dispose();
  }

  /** Where the viewer is and what it looks at. */
  get view(): { mode: 'orbit' | 'walk'; position: Vec3; target: Vec3 } {
    const p = this.camera.position;
    const t = this.controls?.target ?? new Vector3();
    return { mode: this.controls?.mode ?? 'orbit', position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
  }

  /** An element's world position, rotation (degrees), and scale, by its id. */
  objectInfo(id: string): { position: Vec3; rotation: Vec3; scale: Vec3; marked: boolean } | null {
    const o = this.ids.get(id);
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
    const o = typeof which === 'number' ? this.links[which]?.object : this.ids.get(which);
    if (!o) return null;
    const box = new Box3().setFromObject(o);
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

  get busy(): boolean {
    return this.pending > 0;
  }

  /** What was left out, and why, for the notice. */
  get leftOut(): { what: string; why: string }[] {
    const out = this.models.filter((m) => m.state === 'left-out' || m.state === 'refused' || m.state === 'failed').map((m) => ({ what: m.src, why: m.reason ?? m.state }));
    if (this.leftOutElements > 0) {
      out.push({ what: `${this.leftOutElements.toLocaleString('en')} elements`, why: `past the page's limit of ${LIMITS.elements.toLocaleString('en')}` });
    }
    return out;
  }

  // ---- Building --------------------------------------------------------------

  private place(o: Object3D, el: ElementNode): Object3D {
    o.position.set(...vec3(el, 'position', [0, 0, 0]));
    const [rx, ry, rz] = vec3(el, 'rotation', [0, 0, 0]);
    o.rotation.set(rx * DEG, ry * DEG, rz * DEG, 'XYZ');
    o.scale.set(...scale(el));
    return o;
  }

  private track(o: Object3D, el: ElementNode, link: string | null): void {
    const id = attr(el, 'id');
    if (id && !this.ids.has(id)) this.ids.set(id, o);
    if (link) o.userData['link'] = link;
  }

  private model(el: ElementNode, parent: Object3D, entry: Entry): Object3D {
    const holder = this.place(new Object3D(), el);
    parent.add(holder);
    const src = attr(el, 'src') ?? '';
    const report: ModelReport = { src, state: 'loading', materials: {}, animation: null };
    this.models.push(report);
    entry.report = report;
    // The page's limit on models (issue #23).
    this.modelCount += 1;
    if (this.modelCount > LIMITS.models) {
      this.leaveOut(holder, report, entry, `more than ${LIMITS.models} models on the page`);
      return holder;
    }
    const url = resolveAddress(src, this.base);
    // Models come from the page's own site only (owner, prompt 65, Q2 a);
    // the page's content policy enforces the same.
    if (!url || url.origin !== new URL(this.base).origin) {
      report.state = 'refused';
      report.reason = "models load only from the page's own site";
      console.warn(`HoloML: the model "${src}" was not loaded: models load only from the page's own site.`);
      holder.add(missingMarker());
      this.onLeftOut?.();
      return holder;
    }
    this.pending += 1;
    if (this.pending === 1) this.onBusy?.(true);
    let blobs: Map<string, string> = new Map();
    this.budget
      .load(url, new URL(this.base).origin)
      .then(async (files) => {
        blobs = files.blobs;
        report.bytes = files.bytes;
        report.triangles = files.triangles;
        report.pictures = files.pictures;
        // The loader reads the counted files only, never the network.
        const manager = new LoadingManager();
        manager.setURLModifier((u) => blobs.get(new URL(u, url).href) ?? (u.startsWith('data:') || u.startsWith('blob:') ? u : 'blob:uncounted'));
        const gltf = await new GLTFLoader(manager).parseAsync(files.main, url.href.slice(0, url.href.lastIndexOf('/') + 1));
        // After decoding, the pictures' real sizes too (a backstop for unknown formats).
        let tooBig: string | null = null;
        gltf.scene.traverse((o) => {
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
        if (tooBig) throw new LeftOut(tooBig);
        holder.add(gltf.scene);
        this.changeMaterials(el, gltf.scene, report);
        const clipName = attr(el, 'animation');
        if (clipName) {
          const clip = gltf.animations.find((c) => c.name === clipName);
          if (!clip) console.warn(`HoloML: the model "${src}" has no animation named "${clipName}".`);
          else {
            const mixer = new AnimationMixer(gltf.scene);
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
        }
        report.state = 'loaded';
        this.applyMotion();
      })
      .catch((e: unknown) => {
        if (e instanceof LeftOut) this.leaveOut(holder, report, entry, e.reason);
        else this.leaveOut(holder, report, entry, `could not be loaded (${e instanceof Error ? e.message : String(e)})`, 'failed');
      })
      .finally(() => {
        for (const b of blobs.values()) URL.revokeObjectURL(b);
        this.pending -= 1;
        this.requestFrame();
        if (this.pending === 0) {
          this.onBusy?.(false);
          this.onReady?.();
        }
      });
    return holder;
  }

  /** A model not shown: marked where it would be, reported, and out of the Tab order. */
  private leaveOut(holder: Object3D, report: ModelReport, entry: Entry, reason: string, state: 'left-out' | 'failed' = 'left-out'): void {
    report.state = state;
    report.reason = reason;
    console.warn(state === 'failed' ? `HoloML: the model "${report.src}" ${reason}.` : `HoloML: the model "${report.src}" was left out: ${reason}.`);
    holder.clear();
    holder.add(missingMarker());
    if (entry.item) this.removeItem(entry);
    this.onLeftOut?.();
  }

  /** <material> children: change the named materials, only what is given. */
  private changeMaterials(el: ElementNode, model: Object3D, report: ModelReport): void {
    const changes = el.children.filter((c): c is ElementNode => c.type === 'element' && c.name === 'material');
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
    model.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof MeshStandardMaterial && m.name) {
          report.materials[m.name] = { color: `#${m.color.getHexString()}`, metalness: m.metalness, roughness: m.roughness, opacity: m.opacity };
        }
      }
    });
    for (const c of changes) {
      const name = attr(c, 'name') ?? '';
      if (!report.materials[name]) console.warn(`HoloML: the model "${report.src}" has no material named "${name}".`);
    }
  }

  private light(el: ElementNode, parent: Object3D): Object3D | null {
    const type = attr(el, 'type');
    const c = color(el, 'color') ?? '#ffffff';
    const intensity = num(el, 'intensity', 1, 0);
    let light: Object3D;
    if (type === 'ambient') light = new AmbientLight(c, intensity);
    else if (type === 'directional') {
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
    parent.add(light);
    this.track(light, el, null);
    return light;
  }

  private label(el: ElementNode, parent: Object3D): Object3D {
    const words = text(el);
    const size = num(el, 'size', 0.2, Number.MIN_VALUE);
    const fill = color(el, 'color') ?? this.textColor;
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
    const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
    const height = size * 1.5;
    sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
    sprite.position.set(...vec3(el, 'position', [0, 0, 0]));
    parent.add(sprite);
    this.labels.push({ text: words, sprite });
    // The label's words are in the page too, for Find in page and screen readers.
    const note = document.createElement('p');
    note.textContent = words;
    document.getElementById('holoml-labels')?.append(note);
    return sprite;
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

  /** The focus outline in the scene around an object (null hides it). */
  /** The outline drawn around the object in focus or under the pointer, in world space. */
  get highlightInfo(): { visible: boolean; min: Vec3; max: Vec3 } {
    const { min, max } = this.highlight.box;
    return { visible: this.highlight.visible, min: [min.x, min.y, min.z], max: [max.x, max.y, max.z] };
  }

  private outlineObject(object: Object3D | null): void {
    if (object) {
      this.highlight.box.setFromObject(object).expandByScalar(0.05);
      this.highlight.visible = !this.highlight.box.isEmpty();
    } else if (!this.hovered) this.highlight.visible = false;
    this.requestFrame();
  }

  private addAnimation(el: ElementNode): void {
    const id = attr(el, 'target')?.replace(/^#/, '') ?? '';
    const object = this.ids.get(id);
    const attribute = attr(el, 'attribute');
    const ms = duration(el, 'duration');
    if (!object || ms === null || (attribute !== 'position' && attribute !== 'rotation' && attribute !== 'scale')) return;
    const to = vec3(el, 'to', [0, 0, 0]);
    this.animations.push({
      object,
      attribute,
      from: has(el, 'from') ? vec3(el, 'from', [0, 0, 0]) : null,
      to,
      duration: ms,
      repeat: repeat(el),
      start: current(object, attribute),
    });
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
    this.controls = mode === 'walk' ? walkControls(this.camera, canvas, lookAt, changed) : orbitControls(this.camera, canvas, lookAt, changed);
  }

  // ---- Pointer and links ----------------------------------------------------

  /** The link under a point of the page, in CSS pixels (for the tests' failure reports). */
  linkHrefAt(x: number, y: number): string | null {
    return this.linkAt(x, y)?.href ?? null;
  }

  private linkAt(x: number, y: number): Link | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(((x - rect.left) / rect.width) * 2 - 1, 1 - ((y - rect.top) / rect.height) * 2);
    this.raycaster.setFromCamera(ndc, this.camera);
    for (const hit of this.raycaster.intersectObjects(this.scene.children, true)) {
      let o: Object3D | null = hit.object;
      while (o && o.userData['link'] === undefined) o = o.parent;
      const href = o?.userData['link'] as string | undefined;
      if (href) return this.links.find((l) => l.href === href && isInside(hit.object, l.object)) ?? null;
      if (hit.object !== this.highlight) return null; // the first thing hit is not a link
    }
    return null;
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
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new Vector2(((x - rect.left) / rect.width) * 2 - 1, 1 - ((y - rect.top) / rect.height) * 2), this.camera);
    const hit = this.raycaster.intersectObjects(this.scene.children, true).find((h) => h.object !== this.highlight);
    if (!hit) return -1;
    for (let o: Object3D | null = hit.object; o; o = o.parent) {
      const i = this.entries.findIndex((e) => e.object === o && e.kind !== 'a');
      if (i >= 0) return i;
    }
    return -1;
  }

  /** What the inspector shows for one entry: its bounds, place, and costs. */
  entryInfo(index: number): { bounds: [Vec3, Vec3] | null; position: Vec3; rotation: Vec3; scale: Vec3; triangles: number | null; pictures: { width: number; height: number }[] } | null {
    const e = this.entries[index];
    if (!e) return null;
    const o = e.object;
    const box = o ? new Box3().setFromObject(o) : null;
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
      this.highlight.box.setFromObject(link.object).expandByScalar(0.05);
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
      const link = this.linkAt(e.clientX, e.clientY);
      if (!link) return;
      if (e.button === 1 || e.ctrlKey || e.metaKey) window.open(link.href, '_blank');
      else if (e.button === 0) location.assign(link.href);
    });
    canvas.addEventListener('auxclick', (e) => e.preventDefault());
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
    this.renderer.render(this.scene, this.camera);
    this.frames += 1;
    if (moving) this.requestFrame();
    else this.last = 0;
  }

  /** Moves every animate element on; true while any still runs. */
  private stepAnimations(now: number): boolean {
    let running = false;
    const still = this.reducedMotion.matches;
    for (const a of this.animations) {
      const elapsed = now - this.started;
      const runs = elapsed / a.duration;
      // With reduced motion, every animation shows its end at once (issue #25).
      const done = still || runs >= a.repeat;
      const t = done ? 1 : runs - Math.floor(runs);
      const from = a.from ?? a.start;
      const v = from.map((f, i) => f + (a.to[i]! - f) * t) as Vec3;
      if (a.attribute === 'rotation') a.object.rotation.set(v[0] * DEG, v[1] * DEG, v[2] * DEG, 'XYZ');
      else a.object[a.attribute].set(...v);
      if (!done) running = true;
    }
    return running;
  }
}

function current(o: Object3D, attribute: 'position' | 'rotation' | 'scale'): Vec3 {
  if (attribute === 'rotation') return [MathUtils.radToDeg(o.rotation.x), MathUtils.radToDeg(o.rotation.y), MathUtils.radToDeg(o.rotation.z)];
  const v = o[attribute];
  return [v.x, v.y, v.z];
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
