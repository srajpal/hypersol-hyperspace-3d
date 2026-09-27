/**
 * A HoloML 0.1 scene in Three.js (holoml SPEC.md, section 5): models,
 * groups, lights, labels, links, the viewpoint, and animation. The scene
 * draws only when something changes (a model arrives, the view moves, an
 * animation runs), so an idle page costs nothing.
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
  state: 'loading' | 'loaded' | 'failed' | 'refused';
  materials: Record<string, { color: string; metalness: number; roughness: number; opacity: number }>;
  animation: { name: string; playing: boolean; time: number } | null;
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
  private readonly loader = new GLTFLoader();
  private readonly base = document.baseURI;
  private readonly textColor: string;
  onReady: (() => void) | null = null;

  constructor(root: ElementNode, container: HTMLElement, linkList: HTMLElement) {
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
    const build = (node: HoloNode, parent: Object3D, link: string | null) => {
      if (node.type !== 'element') return;
      switch (node.name) {
        case 'group': {
          const g = this.place(new Object3D(), node);
          parent.add(g);
          for (const c of node.children) build(c, g, link);
          this.track(g, node, link);
          break;
        }
        case 'model':
          this.track(this.model(node, parent), node, link);
          break;
        case 'light':
          if (this.light(node, parent)) lights += 1;
          break;
        case 'label':
          this.track(this.label(node, parent), node, link);
          break;
        case 'a': {
          const href = resolveAddress(attr(node, 'href'), this.base);
          const holder = new Object3D();
          parent.add(holder);
          // A link inside a link is not followed (the checker reports it).
          for (const c of node.children) build(c, holder, link ?? href?.href ?? null);
          if (href && !link) this.addLink(href.href, holder, linkList, node);
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
    if (scene) for (const c of scene.children) build(c, this.scene, null);
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
    this.resize();
    this.started = performance.now();
    if (this.pending === 0) queueMicrotask(() => this.onReady?.());
  }

  /** Where the viewer is and what it looks at. */
  get view(): { mode: 'orbit' | 'walk'; position: Vec3; target: Vec3 } {
    const p = this.camera.position;
    const t = this.controls?.target ?? new Vector3();
    return { mode: this.controls?.mode ?? 'orbit', position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
  }

  /** An element's world position, rotation (degrees), and scale, by its id. */
  objectInfo(id: string): { position: Vec3; rotation: Vec3; scale: Vec3 } | null {
    const o = this.ids.get(id);
    if (!o) return null;
    const p = new Vector3();
    o.getWorldPosition(p);
    const r = o.rotation;
    return { position: [p.x, p.y, p.z], rotation: [r.x / DEG, r.y / DEG, r.z / DEG], scale: [o.scale.x, o.scale.y, o.scale.z] };
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

  private model(el: ElementNode, parent: Object3D): Object3D {
    const holder = this.place(new Object3D(), el);
    parent.add(holder);
    const src = attr(el, 'src') ?? '';
    const report: ModelReport = { src, state: 'loading', materials: {}, animation: null };
    this.models.push(report);
    const url = resolveAddress(src, this.base);
    // Models come from the page's own site only (owner, prompt 65, Q2 a);
    // the page's content policy enforces the same.
    if (!url || url.origin !== new URL(this.base).origin) {
      report.state = 'refused';
      console.warn(`HoloML: the model "${src}" was not loaded: models load only from the page's own site.`);
      holder.add(missingMarker());
      return holder;
    }
    this.pending += 1;
    this.loader
      .loadAsync(url.href)
      .then((gltf) => {
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
      })
      .catch((e: unknown) => {
        report.state = 'failed';
        console.warn(`HoloML: the model "${src}" could not be loaded (${e instanceof Error ? e.message : String(e)}).`);
        holder.add(missingMarker());
      })
      .finally(() => {
        this.pending -= 1;
        this.requestFrame();
        if (this.pending === 0) this.onReady?.();
      });
    return holder;
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

  private light(el: ElementNode, parent: Object3D): boolean {
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
    } else return false;
    parent.add(light);
    this.track(light, el, null);
    return true;
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

  private addLink(href: string, object: Object3D, list: HTMLElement, el: ElementNode): void {
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
    list.append(anchor);
    this.links.push(link);
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
    if (this.playing.size > 0) {
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
    for (const a of this.animations) {
      const elapsed = now - this.started;
      const runs = elapsed / a.duration;
      const done = runs >= a.repeat;
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
