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
 * Milestone 17 (HoloML 0.2): elements can be added and removed by
 * the page's scripts (api.ts); a model file is loaded once and repeated
 * plain models are drawn as instances (instances.ts); walls and gravity
 * for walking (physics.ts); lights and the background can be animated;
 * sounds (sound.ts), text on the screen, and a crosshair.
 *
 * Milestone 18 (HoloML 0.2, second part): sliders and speeds; shadows
 * (left out when drawing in software); material pictures and tiling
 * (pictures.ts); choices that change a model's material in place; and
 * light from the page's own panorama of the surroundings.
 *
 * Milestone 19 (HoloML 0.2, third part): panels of wrapped text; click
 * actions (a door that opens, a switch for a lamp), each a button in the
 * outline; several viewpoints, as places an address names; a fade
 * between HoloML pages of one site; a sky; and a floor plan on the screen.
 *
 * Milestone 20 (HoloML 0.2, fourth part): loading by area. A group with
 * load="near" loads its models while the viewer is near and lets them go
 * (releasing their memory, and their share of the limits) when the viewer
 * is farther; a model's stand-in shows in its place until it has loaded;
 * scripts read `loaded` and hear `load`.
 *
 * Milestone 21 (HoloML 0.2, fifth part): water (water.ts), sounds that
 * come from a place (sound.ts), and a model's animation speed for scripts.
 *
 * Review 134: the page's version is read once and asked about through one
 * helper (versions.ts); every file the page names is loaded through one
 * guarded step, and a load that fails gives back all it held; a model's
 * triangles are counted once it is decoded; lights have limits; a still
 * walker draws nothing; the text view stops the scene; what a script
 * hides cannot be clicked or walked into; and where Chromium draws in
 * software the scene is drawn at half its sharpness, to keep it moving.
 *
 * As HoloML 0.2's third edition says (2026-09-30): only the ambient
 * lights in the scene now dim the light from around; a material that
 * takes no light is changed in what it has; a 0.1 page's screen text is
 * not shown; holoml.add leaves out an animate and a sound that begins on
 * a click, and says so; a model that needs a glTF extension the viewer
 * does not read is left out; and every paragraph of a panel inside a
 * link is in the outline.
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
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Raycaster,
  RepeatWrapping,
  Scene,
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
import { touchScreen } from './touch';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneModel } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { check, CLICKABLE, HoloParseError, parse, type ElementNode, type HoloNode } from '@hypersol/holoml';
import { Budget, LeftOut, LIMITS, Unreadable, Unsupported, type Claim, type LoadedFiles } from './budget';
import { keptByControl, orbitControls, TURN_SPEED, walkControls, WALK_SPEED, type ViewControls } from './controls';
import { InstancePool, canInstance, centreOf, countTriangles, isShown, worldBox, type Template } from './instances';
import { disposeDecoders, makeDecoders, type Decoders } from './decoders';
import { direction, mark, own as ownLanguage, UNSTATED, type Language } from './language';
import { SolidGrid, Walker, type Box } from './physics';
import { disposePanel, drawPanel, type PanelLook } from './panels';
import { Pictures, type PictureUse } from './pictures';
import { SoundBank, type SoundHandle, type SoundReport } from './sound';
import { Water } from './water';
import { area, attr, collapse, color, contrastText, duration, has, num, paragraphs, rawText, repeat, resolveAddress, scale, text, tiling, trimSpace, vec3, type Vec3 } from './values';
import { atLeast, type Version } from './versions';

const DEG = Math.PI / 180;
const LINK_HIGHLIGHT = 0x5ce1ff;
/** The fade between HoloML pages of one site (milestone 19): out as a link is followed, and in once the next page has drawn its scene. */
const FADE_OUT_MS = 260;
const FADE_IN_MS = 450;
/** The next page fades in by then, even if it is still loading. */
const ARRIVAL_WAIT_MS = 4000;
/** Going to a place on the same page: out and in again. */
const PLACE_FADE_MS = 180;
/** Loading by area (milestone 20): a group's models are let go once the viewer is this many times its `near` away. */
const LET_GO = 1.5;
/** A far model (HoloML 0.3) is shown a little past its distance and the model itself a little within it, so that standing at the line does not make it flicker. */
const FAR_MARGIN = 0.05;
/** Why a model that loads by area is not loaded (the inspector shows it). */
const FAR = 'it loads when the viewer comes near';
/** Where Chromium draws in software, the scene is drawn with half as many pixels each way (owner, prompt 135). */
const SOFTWARE_SHARPNESS = 0.5;
/** A press of a finger this long, without moving, does what a right-click does (milestone 24). */
const LONG_PRESS_MS = 500;
/**
 * Set on the page's root element by the browser, before the viewer runs,
 * to ask for the lighter drawing (milestone 24: HyperSpace 3D for Android
 * on a tablet): at half the sharpness, without shadows or the water's
 * moving light. Edges stay smoothed: on the owner's tablet (a Mali-G57)
 * a scene drawn without them showed nothing at all, with no error.
 */
const LIGHTER = 'data-hypersol-lighter';

/** How a file the page names ended, when it is not shown: refused (another site), left out (a limit, a stop), or failed. */
type NotShown = 'refused' | 'left-out' | 'failed';

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
  /** A click action (HoloML 0.2 begin="click"): it waits for its trigger. */
  onClick: boolean;
  /** Each click runs it forward, and the next back (`toggle`). */
  toggle: boolean;
  /** When its last click came (performance.now), or null before the first. */
  clickedAt: number | null;
  /** A toggle: where it was at the last click (0 at from, 1 at to), and which way it runs now. */
  at: number;
  way: 1 | -1;
  /** HoloML 0.3: where a script stopped it (0 at from, 1 at to); it stays there until started or clicked again. */
  halted?: number;
}

/** What the pointer is over: a link, or a click action's trigger (both are outlined, with the hand pointer). */
interface Hover {
  object: Object3D;
}

/**
 * A trigger (HoloML 0.2 click actions, milestone 19): the thing whose
 * click runs its animations and plays its sounds, and its button in the
 * outline, for the keyboard and screen readers.
 */
interface Trigger extends Hover {
  entry: Entry;
  animations: Animation[];
  sounds: Entry[];
  label: string;
  /** The language of the element its label came from (HoloML 0.3). */
  language?: Language;
  button: HTMLButtonElement | null;
}

/** A click action waiting to join its trigger (once everything it may name is built). */
interface PendingAction {
  trigger: string;
  animation?: Animation;
  sound?: Entry;
  label: string | null;
  /** The language of the action's element, for its label (HoloML 0.3). */
  language?: Language;
}

/** The floor plan (HoloML 0.2 `plan`, milestone 19): its picture, the ground it shows, and the viewer's marker. */
interface PlanState {
  /** HoloML 0.3: a script hid it (`visible`). */
  hiddenByScript?: boolean;
  src: string;
  state: 'loading' | 'loaded' | 'failed' | 'refused' | 'left-out';
  reason?: string;
  box: HTMLElement;
  img: HTMLImageElement;
  marker: HTMLElement;
  area: [number, number, number, number] | null;
  /** Where the marker is (fractions of the picture's width and height) and which way it points (degrees clockwise from up). */
  at: [number, number] | null;
  angle: number;
}

export interface ModelReport {
  src: string;
  /**
   * refused: another site; left-out: over a limit, stopped, or failed to
   * load (see reason); waiting: it loads by area, and the viewer is not
   * near, or it waits for room within the limits (milestone 20).
   */
  state: 'loading' | 'loaded' | 'failed' | 'refused' | 'left-out' | 'waiting';
  reason?: string;
  bytes?: number;
  triangles?: number;
  pictures?: { width: number; height: number }[];
  materials: Record<string, MaterialReport>;
  animation: { name: string; playing: boolean; time: number } | null;
  /** A stand-in's report (milestone 20): the address of the model it stands in for. */
  standsInFor?: string;
  /** A far model's report (HoloML 0.3, milestone 25): the address of the model it is the lighter version of. */
  farFor?: string;
}

/** A model's lighter version, shown from `far-from` metres away (HoloML 0.3 `far`, milestone 25). */
interface Far {
  /** Inside the model's own holder: placed, turned, and sized as the model, and a click on it is a click on the model. */
  holder: Object3D;
  report: ModelReport;
  src: string;
  from: number;
  /** The viewer is past the line (with a margin each way); until the view is set up, decided is false. */
  isFar: boolean;
  decided: boolean;
  /** Its file's address, while it uses the file. */
  href: string | null;
  template?: Template;
  triangles?: number;
  lights?: number;
  mixer?: AnimationMixer | null;
  materials?: Material[];
  looks?: Look[];
  /** Counts its loads: one that finishes after it was let go is dropped. */
  loads: number;
}

/** A group that loads by area (HoloML 0.2 load="near", milestone 20). */
interface Area {
  entry: Entry;
  /** How near, in metres, the viewer's eyes come for its models to load; they are let go beyond LET_GO times as far. */
  near: number;
  /** The viewer is near: its models load, or have loaded. */
  in: boolean;
  /** Its `loaded` as last told to the page's scripts (the `load` event). */
  told: boolean;
}

/** A model's stand-in (HoloML 0.2 `stand-in`, milestone 20): a lighter model in its place while it is not loaded. */
interface StandIn {
  /** Inside the model's own holder: placed, turned, and sized as the model. */
  holder: Object3D;
  report: ModelReport;
  /** Its file's address, while it uses the file. */
  href: string | null;
  template?: Template;
  triangles?: number;
  /** The lights inside its own copy that count towards the page's limit. */
  lights?: number;
}

/** What a model holds while it is loaded or loading, released when it is let go (milestone 20). */
interface Held {
  /** Its file's address. */
  href: string;
  /** Its `material` children's looks, with the page's pictures they hold. */
  looks: Promise<Look[]>;
  /** The materials made for it from those looks. */
  materials: Material[];
  /** Its animation's mixer. */
  mixer: AnimationMixer | null;
  /** The lights inside its own copy (its file's) that count towards the page's limit. */
  lights: number;
}

/**
 * A named material's look, for the tests and scripts: its numbers, and
 * its colour picture (the page's address for one the page gave, "own"
 * for the model file's) with its tiling.
 */
export interface MaterialReport {
  color: string;
  /** Null for a material that takes no light: it has no metalness and no roughness. */
  metalness: number | null;
  roughness: number | null;
  opacity: number;
  map: string | null;
  repeat: [number, number] | null;
}

/** A material's look as a `material` or an `option` element gives it: only what it gives. */
interface Look {
  color: string | null;
  metalness: number | null;
  roughness: number | null;
  opacity: number | null;
  map?: Texture;
  normalMap?: Texture;
  roughnessMap?: Texture;
  repeat: [number, number] | null;
}

/**
 * A material whose look a page can change: one that takes light, or one
 * that takes none (glTF's KHR_materials_unlit). The second is changed like
 * any other in what it has, its colour, its opacity, and its colour
 * picture with its tiling; it has no metalness, roughness, or bumps, so
 * those change nothing in it (SPEC.md section 7, `material`).
 */
type Changeable = MeshStandardMaterial | MeshBasicMaterial;

function changeable(m: Material): m is Changeable {
  return m instanceof MeshStandardMaterial || m instanceof MeshBasicMaterial;
}

/** A material's pictures, which `repeat` tiles (the model's own as well as the page's). */
const PICTURE_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap'] as const;

/** The page's panorama of the surroundings (HoloML 0.2 `environment`). */
interface EnvironmentState {
  src: string;
  state: 'loading' | 'loaded' | 'failed' | 'refused' | 'left-out';
  reason?: string;
}

/** One option of a choice: its value and label, its look, and the materials made with it (one for each material it replaces). */
interface ChoiceOption {
  value: string;
  label: string;
  /** Its words' language (HoloML 0.3). */
  language?: Language;
  look: Promise<Look> | null;
  made: Map<Material, Changeable>;
}

/** A choice (HoloML 0.2, milestone 18): its options, its radio buttons, and what it changes. */
interface ChoiceState {
  options: ChoiceOption[];
  inputs: HTMLInputElement[];
  legend: HTMLElement;
  chosen: number;
  /** The model's id and the material's name; null for a choice only the page's scripts use. */
  target: string | null;
  material: string | null;
  /** The console was told the model has no such material. */
  warned?: boolean;
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
  /** Its own shadows flag (models and groups, HoloML 0.2, milestone 18). */
  shadows?: boolean;
  /** A model's file, once loaded; and the triangles it counts. */
  template?: Template;
  triangles?: number;
  sound?: SoundHandle;
  soundReport?: SoundReport;
  hud?: HTMLElement;
  /** A slider's control and its label (HoloML 0.2, milestone 18); its box is `hud`. */
  slider?: { input: HTMLInputElement; label: HTMLElement };
  /** A choice's options and radio buttons (milestone 18); its box is `hud`. */
  choice?: ChoiceState;
  /** A label's words and look, to draw it again when a script changes it. */
  labelLook?: { words: string; size: number; color: string; note: HTMLElement };
  /** A panel's (HoloML 0.2, milestone 19). */
  panelLook?: PanelLook;
  /** A group that loads by area (HoloML 0.2 load="near", milestone 20). */
  area?: Area;
  /** A model's stand-in (HoloML 0.2 `stand-in`, milestone 20). */
  standIn?: StandIn;
  /** What a model holds while loaded or loading (milestone 20). */
  held?: Held;
  /** A model's lighter version far away (HoloML 0.3 `far`, milestone 25). */
  far?: Far;
  /** Counts a model's loads: a load that finishes after the model was let go is dropped. */
  loads?: number;
  /** A model's animation speed, as a script set it (milestone 21); 1 when never set. */
  animationSpeed?: number;
  /** An animate element's animation (HoloML 0.3: a thing scripts start and stop). */
  animation?: Animation;
  /** A model's or a group's name as a script set it (HoloML 0.3 `label`); null for none; undefined when never set. */
  ownLabel?: string | null;
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
  | { type: 'frame'; time: number; dt: number }
  | { type: 'change'; entry: Entry; value: number | string }
  | { type: 'load'; entry: Entry; loaded: boolean }
  | { type: 'place'; place: string };

interface LoadedTemplate {
  template: Template;
  animations: AnimationClip[];
  /**
   * What the file holds of the page's totals while it is loaded: its
   * bytes, its pictures' pixels, and one copy's triangles until the first
   * model to use it takes them.
   */
  claim: Claim;
}

export class HolomlView {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.05, 2000);
  frames = 0;
  /**
   * The scene's own time, in milliseconds: how far its frames have moved
   * it on, each by its `dt` (at most 100, so it runs slower than the
   * clock on a slow machine, and stands still while nothing is drawn).
   * Walking, turning, and a script's frames go by it; the browser's tests
   * measure speeds against it.
   */
  clock = 0;
  readonly models: ModelReport[] = [];
  /** Each label's words and the direction they are drawn in (HoloML 0.3: right to left for rtl). */
  readonly labels: { text: string; sprite: Sprite; dir: 'ltr' | 'rtl' }[] = [];
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
  private hovered: Hover | null = null;
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
  /** Model files that arrived and could not be read, and why: not fetched again on this page (review 134, V3). */
  private readonly unreadable = new Map<string, Error>();
  /** Instance pools, by model file (and whether its models have shadows). */
  private readonly pools = new Map<string, InstancePool>();
  private collidersDirty = true;
  private grid: SolidGrid | null = null;
  private selected = -1;
  private picking = false;
  private lights = 0;
  /** Lights that shine from a place or a direction now, the page's and its models' own: the page's limit counts these (review 134, V6). */
  private placedLights = 0;
  /** Lights past that limit, not shown; and lights past the limit on shadows, which shine without them. */
  private lightsLeftOut = 0;
  private shadowsLeftOff = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly outline: HTMLElement;
  private readonly hudLayer: HTMLElement;
  private readonly crosshair: HTMLElement;
  readonly sounds = new SoundBank();
  private readonly listeners = {
    click: new Set<(e: SceneEvent) => void>(),
    key: new Set<(e: SceneEvent) => void>(),
    frame: new Set<(e: SceneEvent) => void>(),
    change: new Set<(e: SceneEvent) => void>(),
    load: new Set<(e: SceneEvent) => void>(),
    place: new Set<(e: SceneEvent) => void>(),
  };
  /** Each animate element's entry, to give it its animation once built (HoloML 0.3). */
  private readonly animateEntries = new WeakMap<ElementNode, Entry>();
  private readonly version: Version;
  private sceneId: string | null = null;
  /**
   * The ambient lights in the scene now, the page's and those its scripts
   * added (HoloML 0.2: the soft light from around follows them). One that
   * is removed is taken out, so that a scene whose ambient lights have all
   * been removed is at full again, not dark (SPEC.md section 7, `light`).
   */
  private readonly ambients: AmbientLight[] = [];
  onReady: (() => void) | null = null;
  /** Loading began or ended (the shell's stop button and loading strip). */
  onBusy: ((busy: boolean) => void) | null = null;
  /** Something was left out or failed: the notice. */
  onLeftOut: (() => void) | null = null;
  /** A frame was drawn (the tab card's picture waits for one, prompt 89). */
  onDrawn: (() => void) | null = null;
  private viewMoving = false;
  /** The page's own pictures: materials' and the surroundings' (milestone 18). */
  private readonly pictures: Pictures;
  /** Decoders for compressed models (milestone 25), made when the first model file arrives. */
  private decoders: Decoders | null = null;
  /** The counted copies of the files of every model file being decoded, by address, for the KTX2 loader's pictures. */
  private readonly decodingFiles = new Map<string, string>();
  /** Pictures and surroundings not shown, and why (for the notice). */
  private readonly pictureProblems: { what: string; why: string }[] = [];
  /** The WebGL renderer's name when Chromium draws in software (no graphics card), else null. */
  private readonly software: string | null;
  /** The browser asked for the lighter drawing (milestone 24). */
  private readonly lighter: boolean;
  /** Drawn in software, or lighter: half the sharpness, and no shadows or moving light on water. */
  private readonly reduced: boolean;
  /** Shadows: drawn (a 0.2 page, a graphics card), and whether and why a page's were left out. */
  private readonly shadowsOn: boolean;
  private shadowsLeftOut: string | null = null;
  private readonly shadowLights: (DirectionalLight | PointLight | SpotLight)[] = [];
  private shadowBox: Box3 | null = null;
  /** Models a choice changes: drawn as their own copies, never as instances. */
  private readonly choiceTargets = new Set<string>();
  private readonly choices: Entry[] = [];
  /** A chosen model's meshes: their materials before any option. */
  private readonly ownMaterials = new WeakMap<Mesh, Material[]>();
  /** The page's panorama of the surroundings, and whether it lights the scene yet. */
  private environment: EnvironmentState | null = null;
  private environmentUrl: URL | null = null;
  /** The page's sky (HoloML 0.2 `sky`, milestone 19) and its address; its background colour shows while there is none. */
  private sky: EnvironmentState | null = null;
  private skyUrl: string | null = null;
  private readonly background: Color;
  /** How sharp pictures stay when seen at a slant. */
  private readonly anisotropy: number;
  /** Click actions (HoloML 0.2, milestone 19): the triggers, and actions still to join theirs. */
  private readonly triggers = new Map<Entry, Trigger>();
  private readonly pendingActions: PendingAction[] = [];
  /** The viewpoints; in a 0.2 page with several, the places the address names and the outline lists. */
  private viewpoints: ElementNode[] = [];
  private placesListed = false;
  private startPlace: string | null = null;
  private currentPlace: string | null = null;
  /** HoloML 0.3 (milestone 25): each element's language and direction, inherited as in HTML; none in an older page. */
  private readonly langs = new WeakMap<ElementNode, Language>();
  /** The scene's own language, for what a script adds to it (HoloML 0.3). */
  private sceneLanguage: Language | undefined;
  /** The fade over everything, between places and between HoloML pages of one site (milestone 19). */
  private readonly fader: HTMLElement;
  private fadeLevel = 0;
  private fadeUntil = 0;
  private arriving = false;
  private readonly fadeLog: { to: number; at: number }[] = [];
  /** The floor plan (HoloML 0.2 `plan`). */
  private planState: PlanState | null = null;
  /** Groups that load by area (milestone 20). */
  private readonly areas: Area[] = [];
  /** The models with a far version (HoloML 0.3). */
  private readonly fars: Entry[] = [];
  /** How many models (and stand-ins) use each model file, so a file that no model uses any more can be let go. */
  private readonly templateUsers = new Map<string, number>();
  /** The tiled copies of a made material's pictures, released with it. */
  private readonly tiledOf = new WeakMap<Material, Texture[]>();
  /** The page's water (HoloML 0.2 `water`, milestone 21); its materials are gone over again when models arrive or change. */
  private water: Water | null = null;
  private waterDirty = false;
  /** Why the water's moving light was left out, if it was. */
  private causticsLeftOut: string | null = null;
  /** The page's tab is behind another (milestone 21): what moves waits, and nothing draws but a change. */
  private behind = false;
  /**
   * New materials' shaders compile without blocking the page (milestone 21):
   * wanted when models arrive or materials change, and while they compile
   * the last frame stays on the screen.
   */
  private shadersWanted = true;
  private compiling = false;
  /** A frame is being drawn: what the page's scripts move during it asks for no new frame while the tab is behind. */
  private inFrame = false;
  /** The text view is on: the scene is hidden, takes no keys and no pointer, and draws nothing (review 134, V8). */
  private textView = false;

  /** `version`: the page's, one the viewer knows (main.ts refuses a page of any other before it comes here). */
  constructor(root: ElementNode, container: HTMLElement, outline: HTMLElement, hudLayer: HTMLElement, version: Version) {
    this.outline = outline;
    this.hudLayer = hudLayer;
    this.version = version;
    // HoloML 0.3 (milestone 25): the language and direction of each element's text, from the nearest element that
    // says them; the page's own language is the document's, for screen readers.
    if (this.since('0.3')) {
      this.learnLanguages(root, UNSTATED);
      const page = this.langs.get(root);
      if (page?.lang) document.documentElement.lang = page.lang;
    }
    // Lines are hit only where they are, not a metre around them.
    this.raycaster.params.Line.threshold = 0.02;
    // Whether Chromium draws in software is asked first: smoothed edges are chosen when the renderer is made.
    // There the scene is drawn at half its sharpness and without smoothed edges (owner, prompt 135: the ocean
    // tunnel went from one frame a second to three on a machine without a graphics card); the console says so once.
    this.software = softwareDrawing();
    // The browser's ask for the lighter drawing is read before any script of the page has run (milestone 24).
    this.lighter = document.documentElement.hasAttribute(LIGHTER);
    this.reduced = this.software !== null || this.lighter;
    // Throws where Chromium cannot start WebGL 2; main.ts says so on the page.
    // Smoothed edges are left out only in software: the lighter drawing keeps them (see LIGHTER).
    this.renderer = new WebGLRenderer({ antialias: this.software === null });
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.outputColorSpace = SRGBColorSpace;
    container.append(this.renderer.domElement);
    this.renderer.domElement.dataset['testid'] = 'holoml-canvas';
    if (this.software !== null) {
      console.warn('HoloML: this computer draws 3D in software, without a graphics card: the scene is drawn at half its sharpness and without smoothed edges, so that it moves more smoothly.');
    } else if (this.lighter) {
      console.warn('HoloML: the scene is drawn lighter on this device: at half its sharpness, without shadows or moving light on water, so that it moves more smoothly.');
    }
    // The graphics card was reset (a driver update, a computer waking up): what was drawn into pictures there is made again.
    this.renderer.domElement.addEventListener('webglcontextrestored', () => this.restored());
    // Shadows (HoloML 0.2): soft shadow maps where there is a graphics card.
    // Drawn in software they would take most of every frame, so a page's
    // shadows are left out there, and the console says so (owner, prompt 98, Q5 a).
    this.shadowsOn = this.since('0.2') && !this.reduced;
    if (this.shadowsOn) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = PCFShadowMap;
    }
    this.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.pictures = new Pictures(this.budget, this.origin, this.anisotropy);

    const scene = root.children.find((c): c is ElementNode => c.type === 'element' && c.name === 'scene');
    this.sceneLanguage = this.langs.get(scene ?? root);
    const background = scene ? color(scene, 'background') : null;
    this.background = new Color(background ?? '#0b0f1e');
    this.scene.background = this.background;
    this.textColor = contrastText(background ?? '#0b0f1e');
    this.sceneId = scene && this.since('0.2') ? (attr(scene, 'id') ?? null) : null;
    // Soft reflections, so metal and paint look like themselves.
    this.roomLight();
    this.scene.environmentIntensity = 0.45;
    // HoloML 0.2: the page's own surroundings light the scene once they arrive, and its sky shows behind it (milestone 19).
    const surroundings = scene && this.since('0.2') ? attr(scene, 'environment') : null;
    const sky = scene && this.since('0.2') ? attr(scene, 'sky') : null;
    if (sky) this.skyUrl = resolveAddress(sky, this.base)?.href ?? null;
    if (surroundings) this.loadEnvironment(surroundings);
    if (sky) this.loadSky(sky);
    // The models a choice changes get their own copies (not instances), so each is found before building.
    if (scene && this.since('0.2')) {
      for (const c of scene.children) {
        const target = c.type === 'element' && c.name === 'choice' && attr(c, 'material') ? trimSpace(attr(c, 'target') ?? '') : null;
        if (target?.startsWith('#')) this.choiceTargets.add(target.slice(1));
      }
    }

    this.crosshair = document.createElement('div');
    this.crosshair.className = 'holoml-crosshair';
    this.crosshair.setAttribute('aria-hidden', 'true');
    this.crosshair.hidden = true;
    this.hudLayer.append(this.crosshair);
    // Over everything, the page's own screen text included.
    this.fader = document.createElement('div');
    this.fader.id = 'holoml-fade';
    this.fader.setAttribute('aria-hidden', 'true');
    document.body.append(this.fader);

    this.highlight.visible = false;
    this.scene.add(this.highlight);
    // HoloML 0.2 (milestone 19): several viewpoints are places, each named by the address (#name) and listed in the outline.
    this.viewpoints = scene ? scene.children.filter((c): c is ElementNode => c.type === 'element' && c.name === 'viewpoint') : [];
    this.placesListed = this.since('0.2') && this.viewpoints.length > 1;
    const animates: ElementNode[] = [];
    if (scene) {
      for (const c of scene.children) {
        if (c.type !== 'element') continue;
        if (c.name === 'plan') {
          // At most one (the checker reports a second, which is left out).
          if (this.count(c) && this.since('0.2') && !this.planState) this.plan(c);
          continue;
        }
        if (c.name === 'water') {
          // At most one (the checker reports a second, which is left out).
          if (this.count(c) && this.since('0.2') && !this.water) this.makeWater(c);
          continue;
        }
        if (c.name === 'hud') {
          // Screen text is HoloML 0.2's: in a 0.1 page it is not shown, as a slider in one is not (the checker has
          // said that it is not a 0.1 element; SPEC.md section 9, "Reading and checking").
          if (this.count(c) && this.since('0.2')) this.hud(c, false);
          continue;
        }
        if (c.name === 'slider') {
          if (this.count(c) && this.since('0.2')) this.slider(c);
          continue;
        }
        if (c.name === 'choice') {
          if (this.count(c) && this.since('0.2')) this.choice(c);
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
    this.wireActions();
    // The address may name the place to start at; otherwise the first viewpoint.
    const start = this.placeNamed(addressName()) ?? this.viewpoints[0] ?? null;
    this.startPlace = this.currentPlace = start ? (attr(start, 'id') ?? null) : null;
    this.setUpView(start);
    // Groups that load by area within reach of the start load with the page (milestone 20).
    this.updateAreas();
    // HoloML 0.3: each model with a far version loads the one the view needs.
    this.updateFar();
    if (this.placesListed) {
      // A link to #name on this page, the outline's "Go to", Back and Forward: to that place, or to the first.
      window.addEventListener('hashchange', () => this.goTo(this.placeNamed(addressName()) ?? this.viewpoints[0]!));
    }
    // Arriving from another HoloML page of the same site: the scene fades in once drawn (a cut with reduced motion).
    if (this.since('0.2') && !this.reducedMotion.matches && arrivedFromHolomlPage()) {
      this.arriving = true;
      void this.setFade(1, 0);
      window.setTimeout(() => this.arrive(), ARRIVAL_WAIT_MS);
    }
    // Shown again from the back-forward cache after fading out: clear.
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) void this.setFade(0, 0);
    });
    this.wirePointer();
    this.wireKeys();
    this.sounds.onChange = () => this.requestFrame();
    this.sounds.onLeftOut = () => this.onLeftOut?.();
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

  /** Each element's language under an element that inherits `inherited` (HoloML 0.3). */
  private learnLanguages(el: ElementNode, inherited: Language): void {
    const mine = ownLanguage(el, inherited);
    this.langs.set(el, mine);
    for (const c of el.children) if (c.type === 'element') this.learnLanguages(c, mine);
  }

  /** An element's language and direction (HoloML 0.3); undefined in an older page. */
  private languageOf(el: ElementNode): Language | undefined {
    return this.langs.get(el);
  }

  /** The direction an element's words run in: left to right in an older page; in 0.3, as its `dir` says (`auto` by the words). */
  private directionOf(el: ElementNode, words: string): 'ltr' | 'rtl' {
    const l = this.langs.get(el);
    return l ? direction(l.dir, words) : 'ltr';
  }

  /** Whether the page's version has what a version added: every later version keeps it (review 134, V2). */
  private since(version: Version): boolean {
    return atLeast(this.version, version);
  }

  /** The renderer's own soft light from around, drawn into a picture on the graphics card. */
  private roomLight(): void {
    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }

  /**
   * The graphics card's context came back after being lost. Three.js
   * sends the models, materials, and pictures again by itself; what was
   * drawn into pictures on the card (the soft light from around) is
   * gone, so it is made again, and the scene is drawn (review 134, V10).
   */
  private restored(): void {
    this.scene.environment?.dispose();
    this.roomLight();
    if (this.environment?.state === 'loaded' && this.environmentUrl) {
      const url = this.environmentUrl;
      void this.pictures.environment(url).then((panorama) => this.lightFrom(panorama, url), () => undefined);
    }
    this.compiling = false;
    this.shadersWanted = true;
    this.waterDirty = true;
    this.shadowBox = null;
    for (const pool of this.pools.values()) pool.dirty = true;
    this.last = 0;
    this.requestFrame();
  }

  /** How many of the screen's pixels the scene is drawn with: all of them, or half each way where Chromium draws in software. */
  private pixelRatio(): number {
    return window.devicePixelRatio * (this.reduced ? SOFTWARE_SHARPNESS : 1);
  }

  /** How the scene is drawn (for the tests and the inspector): in software or not, and how sharply. */
  get drawingInfo(): { software: string | null; lighter: boolean; antialias: boolean; pixelRatio: number; devicePixelRatio: number } {
    return { software: this.software, lighter: this.lighter, antialias: this.software === null, pixelRatio: this.renderer.getPixelRatio(), devicePixelRatio: window.devicePixelRatio };
  }

  /** What is past the page's limits on lights (review 134, V6): lights left out, and lights that shine without the shadows they asked for. */
  get lightLimitsInfo(): { lights: number; leftOut: number; shadowLights: number; withoutShadows: number } {
    return { lights: this.placedLights, leftOut: this.lightsLeftOut, shadowLights: this.shadowLights.length, withoutShadows: this.shadowsLeftOff };
  }

  /**
   * The text view came on or went (main.ts). While it is on the scene is
   * hidden: it takes no keys and no pointer, so the arrow keys, Page Up,
   * Page Down, and the space bar scroll the text, and it draws nothing
   * until it is shown again (review 134, V8).
   */
  setTextView(on: boolean): void {
    if (this.textView === on) return;
    this.textView = on;
    if (this.controls) this.controls.paused = on;
    this.last = 0;
    if (!on) this.requestFrame();
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
    const release = (o: Object3D) => releaseObject(o, done);
    this.scene.traverse(release);
    for (const t of this.templates.values()) void t.then((loaded) => loaded.template.scene.traverse(release)).catch(() => undefined);
    if (this.decoders) disposeDecoders(this.decoders);
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
    const c = centreOf(this.boxOf(o), o).project(this.camera);
    if (c.z > 1 || Math.abs(c.x) > 1 || Math.abs(c.y) > 1) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((c.x + 1) / 2) * rect.width, y: rect.top + ((1 - c.y) / 2) * rect.height };
  }

  /** The rectangle an object (by id) covers on the page, around its box's corners, in CSS pixels (for the tests). */
  screenRect(id: string): { left: number; top: number; right: number; bottom: number } | null {
    const o = this.entryById.get(id)?.object;
    if (!o) return null;
    const box = this.boxOf(o);
    if (box.isEmpty()) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const out = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (let i = 0; i < 8; i++) {
      const c = new Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(this.camera);
      const x = rect.left + ((c.x + 1) / 2) * rect.width;
      const y = rect.top + ((1 - c.y) / 2) * rect.height;
      out.left = Math.min(out.left, x);
      out.right = Math.max(out.right, x);
      out.top = Math.min(out.top, y);
      out.bottom = Math.max(out.bottom, y);
    }
    return out;
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

  /** How the scene is drawn: draw calls and triangles in the last frame, the instance pools, and the pictures held on the graphics card. */
  get stats(): { calls: number; triangles: number; pools: { src: string; count: number }[]; solids: number; textures: number } {
    const info = this.renderer.info.render;
    const pools = [...this.pools.values()].map((p) => ({ src: p.src, count: p.count }));
    return { calls: info.calls, triangles: info.triangles, pools, solids: this.grid?.size ?? 0, textures: this.renderer.info.memory.textures };
  }

  get busy(): boolean {
    return this.pending > 0;
  }

  /** The view is not moving by itself or by held keys (a walker still falling moves it). */
  get viewSettled(): boolean {
    return !this.viewMoving;
  }

  /** Shadows (milestone 18): the lights and the models that cast them, and why a page's were left out, if they were. */
  get shadowsInfo(): { lights: number; models: number; leftOut: string | null } {
    const models = this.shadowsOn ? this.entries.filter((e) => e.kind === 'model' && e.report?.state === 'loaded' && this.castsShadows(e)).length : 0;
    return { lights: this.shadowLights.filter((l) => l.parent).length, models, leftOut: this.shadowsLeftOut };
  }

  /** The page's panorama of the surroundings, and how brightly it lights the scene. */
  get environmentInfo(): { src: string; state: string; reason?: string; intensity: number } | null {
    return this.environment ? { ...this.environment, intensity: this.scene.environmentIntensity } : null;
  }

  /** The choices (milestone 18): label, corner, options, and the chosen value. */
  get choicesInfo(): { id: string | null; label: string; corner: string | null; value: string; options: { value: string; label: string }[] }[] {
    return this.choices.map((e) => {
      const c = e.choice!;
      return {
        id: e.id,
        label: c.legend.textContent ?? '',
        corner: e.hud?.parentElement?.dataset['corner'] ?? null,
        value: c.options[c.chosen]?.value ?? '',
        options: c.options.map(({ value, label }) => ({ value, label })),
      };
    });
  }

  /** The panels (milestone 19): their words, their lines as wrapped, their size in metres, and their picture's in pixels. */
  get panelsInfo(): { id: string | null; paragraphs: string[]; lines: string[][]; width: number; height: number; size: number; color: string; background: string | null; pixels: [number, number] }[] {
    return this.entries
      .filter((e) => e.kind === 'panel' && e.panelLook && !e.removed)
      .map((e) => {
        const l = e.panelLook!;
        return { id: e.id, paragraphs: [...l.paragraphs], lines: l.lines.map((x) => [...x]), width: l.width, height: l.height, size: l.size, color: l.color, background: l.background, pixels: [...l.pixels] };
      });
  }

  /** The click actions (milestone 19): each trigger, its button, and where its animations are (0 at from, 1 at to). */
  get actionsInfo(): { trigger: string | null; button: string | null; pressed: string | null; animations: { target: string | null; attribute: string; toggle: boolean; progress: number; running: boolean }[]; sounds: string[] }[] {
    const now = performance.now();
    return [...this.triggers.values()]
      .filter((t) => !t.entry.removed)
      .map((t) => ({
        trigger: t.entry.id,
        button: t.button?.textContent ?? null,
        pressed: t.button?.getAttribute('aria-pressed') ?? null,
        animations: t.animations.map((a) => {
          const p = this.progress(a, now);
          return { target: a.entry?.id ?? null, attribute: a.attribute, toggle: a.toggle, progress: p?.t ?? 0, running: p !== null && !p.done };
        }),
        sounds: t.sounds.map((e) => e.id ?? e.name),
      }));
  }

  /** The places (milestone 19): where the viewer started and is now (by the viewpoints' ids), and every place's name. */
  get placesInfo(): { start: string | null; current: string | null; places: { id: string; label: string }[] } {
    const places = this.placesListed ? this.viewpoints.filter((v) => attr(v, 'id')).map((v) => ({ id: attr(v, 'id')!, label: placeName(v) })) : [];
    return { start: this.startPlace, current: this.currentPlace, places };
  }

  /** The page's sky (milestone 19): its address, whether it arrived, and how brightly it is drawn. */
  get skyInfo(): { src: string; state: string; reason?: string; intensity: number } | null {
    return this.sky ? { ...this.sky, intensity: this.scene.backgroundIntensity } : null;
  }

  /** The floor plan (milestone 19): its corner, size, name, picture, and the viewer's marker. */
  get planInfo(): { corner: string | null; width: number; label: string; src: string; state: string; reason?: string; marker: { shown: boolean; x: number; y: number; angle: number } } | null {
    const p = this.planState;
    if (!p) return null;
    const shown = !p.marker.hidden && !p.box.hidden;
    return {
      corner: p.box.parentElement?.dataset['corner'] ?? null,
      width: p.box.getBoundingClientRect().width,
      label: p.img.alt,
      src: p.src,
      state: p.state,
      ...(p.reason ? { reason: p.reason } : {}),
      marker: { shown, x: p.at?.[0] ?? 0, y: p.at?.[1] ?? 0, angle: p.angle },
    };
  }

  /** The fade (milestone 19): how dark it is now, whether a page is still arriving, and each fade's start. */
  get fadeInfo(): { opacity: number; arriving: boolean; log: { to: number; at: number }[] } {
    return { opacity: Number(getComputedStyle(this.fader).opacity), arriving: this.arriving, log: this.fadeLog.map((x) => ({ ...x })) };
  }

  /** A fade is under way, or the page is dark (the tab card waits for the scene itself). */
  get fading(): boolean {
    return this.fadeLevel > 0 || performance.now() < this.fadeUntil;
  }

  /** What was left out, and why, for the notice. */
  get leftOut(): { what: string; why: string }[] {
    const out = this.models.filter((m) => m.state === 'left-out' || m.state === 'refused' || m.state === 'failed').map((m) => ({ what: m.src, why: m.reason ?? m.state }));
    for (const s of this.sounds.reports) if (s.state !== 'loaded' && s.state !== 'loading') out.push({ what: s.src, why: s.reason ?? s.state });
    out.push(...this.pictureProblems);
    if (this.lightsLeftOut > 0) {
      out.push({ what: this.lightsLeftOut === 1 ? 'one light' : `${this.lightsLeftOut} lights`, why: `past the page's limit of ${LIMITS.lights} lights` });
    }
    if (this.shadowsLeftOff > 0) {
      out.push({ what: this.shadowsLeftOff === 1 ? "one light's shadows" : `the shadows of ${this.shadowsLeftOff} lights`, why: `at most ${LIMITS.shadowLights} lights cast shadows on a page` });
    }
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
    // In a 0.2 page, what a script adds, the script moves and plays: an animate, and a sound that begins on a click,
    // are left out wherever they are in its markup, and the console says so (SPEC.md section 10, `holoml.add`).
    // A 0.3 page's scripts may add them (milestone 25).
    const notAdded = fromScript && !this.since('0.3') ? leftOutOfAdd(node) : null;
    if (notAdded) {
      console.warn(`HoloML: holoml.add: line ${node.start.line - 1}, column ${node.start.column}: ${notAdded}.`);
      return null;
    }
    // The page's limit on elements: later ones are left out (issue #23).
    if (!this.count(node)) return null;
    const id = attr(node, 'id') ?? null;
    const entry: Entry = { el: node, kind: node.name, name: nameOf(node, this.since('0.3')), depth, object: null, item: null, id: null, parent: parentEntry, children: [], link, fromScript };
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
        if (this.since('0.2') && has(node, 'solid')) entry.solid = true;
        if (this.since('0.2') && has(node, 'shadows')) entry.shadows = true;
        if (this.since('0.2') && attr(node, 'load') === 'near') {
          // Loading by area (milestone 20): its models wait for the viewer to come near.
          const near = num(node, 'near', 10, 0);
          entry.area = { entry, near: near > 0 ? near : 10, in: false, told: false };
          this.areas.push(entry.area);
        }
        // A group is in the outline by its id, or (HoloML 0.3) by a name of its own.
        if ((entry.id || (this.since('0.3') && collapse(attr(node, 'label') ?? ''))) && listed) entry.item = this.addItem(entry, 'Group');
        for (const c of node.children) this.build(c, g, entry, link, depth + 1, fromScript, animates);
        this.track(g, link);
        break;
      }
      case 'model':
        if (listed) entry.item = this.addItem(entry, 'Model');
        if (this.since('0.2') && has(node, 'solid')) entry.solid = true;
        if (this.since('0.2') && has(node, 'shadows')) entry.shadows = true;
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
      case 'panel':
        if (!this.since('0.2')) break;
        this.setObject(entry, this.panel(node, parent, entry));
        if (listed) entry.item = this.addItem(entry, 'Panel');
        this.panelWords(entry);
        this.track(entry.object!, link);
        break;
      case 'viewpoint':
        if (this.placesListed && entry.id) entry.item = this.addPlace(entry, node);
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
        this.animateEntries.set(node, entry);
        break;
      case 'sound':
        if (this.since('0.2')) {
          this.sound(node, entry, parent);
          // Plays when its trigger is clicked (milestone 19).
          if (attr(node, 'begin') === 'click') this.pendingActions.push({ trigger: idOf(attr(node, 'trigger')), sound: entry, label: attr(node, 'label') ?? null, language: this.languageOf(node) });
        }
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

  /** A file's address, if it is on the page's own site: models, sounds, and pictures load from nowhere else (owner, prompt 65, Q2 a; the page's content policy enforces the same). */
  private ownSite(src: string): URL | null {
    const url = resolveAddress(src, this.base);
    return url && url.origin === this.origin ? url : null;
  }

  /**
   * The steps every file the page names goes through (a model, a
   * stand-in, a material's picture, the surroundings, the sky, a floor
   * plan, a sound), written once (review 134, V3): its address must be on
   * the page's own site, or it is refused; it counts as loading until
   * `load` is done, so the page is ready, and the loading strip stops,
   * only then; and when `load` fails, `out` is told how (left out for a
   * limit or a stop, failed for anything else) and in what words.
   *
   * What a load holds of the page's totals is in its claim (budget.ts),
   * and every loader used here gives its claim back whole when it fails
   * (Budget.load and Budget.file, a model's decoding, Pictures), so a load
   * that ends in `out` holds nothing. Resolves with what `load` made, or
   * null when it was refused, left out, or failed.
   */
  private async guarded<T>(src: string, refusal: string, load: (url: URL) => Promise<T>, out: (state: NotShown, reason: string, overTotal: boolean) => void): Promise<T | null> {
    const url = this.ownSite(src);
    if (!url) {
      out('refused', refusal, false);
      return null;
    }
    this.pending += 1;
    if (this.pending === 1) this.onBusy?.(true);
    try {
      return await load(url);
    } catch (e) {
      if (e instanceof LeftOut) out('left-out', e.reason, e.overTotal);
      else out('failed', `could not be loaded (${e instanceof Error ? e.message : String(e)})`, false);
      return null;
    } finally {
      this.settle();
    }
  }

  /** A model file, fetched within the limits and decoded once for every model that uses it. */
  private loadTemplate(url: URL): Promise<LoadedTemplate> {
    const known = this.templates.get(url.href);
    if (known) return known;
    // A file that arrived and could not be read would read no better now: it is not fetched again (review 134, V3).
    const unreadable = this.unreadable.get(url.href);
    const loading = unreadable
      ? Promise.reject<LoadedTemplate>(unreadable)
      : this.budget.load(url, this.origin).then(
          (files) => this.decode(url, files),
          (e: unknown) => {
            // Nor is one that needs what the viewer does not have (a glTF extension it does not read).
            if (e instanceof Unreadable || e instanceof Unsupported) this.unreadable.set(url.href, e);
            throw e;
          },
        );
    this.templates.set(url.href, loading);
    return loading;
  }

  /**
   * Decodes a model file that has arrived, and counts it again as it
   * really is: its pictures' sizes (a backstop for kinds whose header is
   * not read) and their pixels, and its triangles as they will be drawn,
   * which is what the page is charged (what the file said of itself was
   * an estimate; review 134, V4). A file that cannot be decoded, or is
   * refused once it is, holds nothing: its claim is given back, and the
   * pictures decoded for it are closed.
   */
  private async decode(url: URL, files: LoadedFiles): Promise<LoadedTemplate> {
    let scene: Object3D | null = null;
    try {
      // The loader reads the counted files only, never the network.
      const manager = new LoadingManager();
      manager.setURLModifier((u) => files.blobs.get(new URL(u, url).href) ?? (u.startsWith('data:') || u.startsWith('blob:') ? u : 'blob:uncounted'));
      const loader = new GLTFLoader(manager);
      // Compressed geometry and pictures (milestone 25): the viewer's own decoders. The KTX2 loader reads a model's
      // pictures through its own manager, so it finds them among the counted files of the models being decoded.
      for (const [address, blob] of files.blobs) this.decodingFiles.set(address, blob);
      this.decoders ??= makeDecoders(this.renderer, (u) => this.decodingFiles.get(u) ?? null);
      loader.setDRACOLoader(this.decoders.draco).setKTX2Loader(this.decoders.ktx2).setMeshoptDecoder(this.decoders.meshopt);
      const gltf = await loader.parseAsync(files.main, url.href.slice(0, url.href.lastIndexOf('/') + 1)).catch((e: unknown) => {
        throw new Unreadable(e instanceof Error ? e.message : String(e));
      });
      scene = (gltf.scene as Object3D | undefined) ?? null;
      if (!scene) throw new Unreadable('it has no scene');
      let tooBig: string | null = null;
      let pixels = 0;
      const seen = new Set<unknown>();
      scene.traverse((o) => {
        const m = (o as Mesh).material;
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
          for (const value of Object.values(mat)) {
            const img = value instanceof Texture ? (value.image as { width?: number; height?: number } | null) : null;
            if (!img || seen.has(img)) continue;
            seen.add(img);
            pixels += (img.width ?? 0) * (img.height ?? 0);
            if ((img.width ?? 0) > LIMITS.pictureSide || (img.height ?? 0) > LIMITS.pictureSide) {
              tooBig = `a picture of ${img.width} by ${img.height} pixels is larger than ${LIMITS.pictureSide} by ${LIMITS.pictureSide}`;
            }
          }
        }
      });
      if (tooBig) throw new LeftOut(tooBig);
      files.claim.setPixels(pixels);
      scene.updateMatrixWorld(true);
      const triangles = countTriangles(scene);
      files.claim.setTriangles(triangles);
      const template: Template = {
        scene,
        box: new Box3().setFromObject(scene),
        triangles,
        bytes: files.bytes,
        pictures: files.pictures,
        instanceable: canInstance(scene, gltf.animations.length > 0),
      };
      return { template, animations: gltf.animations, claim: files.claim };
    } catch (e) {
      if (scene) releaseFile(scene);
      files.claim.release();
      // It would end the same way again, unless it only lacked room within the page's totals.
      if (e instanceof Unreadable || (e instanceof LeftOut && !e.overTotal)) this.unreadable.set(url.href, e);
      throw e;
    } finally {
      for (const [address, b] of files.blobs) {
        URL.revokeObjectURL(b);
        if (this.decodingFiles.get(address) === b) this.decodingFiles.delete(address);
      }
    }
  }

  private model(el: ElementNode, parent: Object3D, entry: Entry): Object3D {
    const holder = this.place(new Object3D(), el);
    parent.add(holder);
    this.setObject(entry, holder);
    const src = attr(el, 'src') ?? '';
    const report: ModelReport = { src, state: 'loading', materials: {}, animation: null };
    this.models.push(report);
    entry.report = report;
    // HoloML 0.2 (milestone 20): a lighter model stands in until this one has loaded.
    const standIn = this.since('0.2') ? attr(el, 'stand-in') : null;
    if (standIn) this.standIn(entry, holder, standIn);
    // HoloML 0.3 (milestone 25): a lighter version far away. Which of the two loads first is decided once the view
    // is set up (updateFar): until then neither loads.
    const far = this.since('0.3') ? attr(el, 'far') : null;
    const from = num(el, 'far-from', 0, 0);
    if (far && from > 0) {
      const report: ModelReport = { src: far, state: 'waiting', reason: 'it loads when the viewer is far', materials: {}, animation: null, farFor: src };
      this.models.push(report);
      const f: Far = { holder: new Object3D(), report, src: far, from, isFar: true, decided: false, href: null, loads: 0 };
      f.holder.visible = false;
      holder.add(f.holder);
      entry.far = f;
      this.fars.push(entry);
    }
    // Loading by area (milestone 20): in a group the viewer is not near, it waits for the viewer
    // (one from another site is refused at once, wherever it is).
    if (!this.ownSite(src) || this.wanted(entry)) this.loadModel(entry);
    else {
      report.state = 'waiting';
      report.reason = FAR;
    }
    return holder;
  }

  /**
   * Loads a model's file and its materials' pictures, and draws it: as an
   * instance of the file's meshes, or as its own copy when it changes its
   * materials, plays an animation, or a choice changes it. A model that
   * loads by area may be let go before it arrives: that load is dropped.
   */
  private loadModel(entry: Entry): void {
    const el = entry.el;
    const holder = entry.object!;
    const report = entry.report!;
    const byArea = this.byArea(entry);
    const load = (entry.loads = (entry.loads ?? 0) + 1);
    const current = () => !entry.removed && entry.loads === load;
    report.state = 'loading';
    delete report.reason;
    void this.guarded(
      report.src,
      "models load only from the page's own site",
      async (url) => {
        // The page's limit on model files (issue #23; a file used many times counts once, and one let go not at all).
        if (!this.templates.has(url.href) && this.templates.size >= LIMITS.modelFiles) throw new LeftOut(`more than ${LIMITS.modelFiles} model files on the page`, true);
        const changes = el.children.filter((c): c is ElementNode => c.type === 'element' && c.name === 'material');
        const clipName = attr(el, 'animation');
        // The materials' pictures (HoloML 0.2) load beside the model; a picture that fails is reported, and the rest shows.
        const looks = Promise.all(changes.map((c) => this.lookOf(c)));
        const held: Held = { href: url.href, looks, materials: [], mixer: null, lights: 0 };
        entry.held = held;
        this.useTemplate(url.href);
        const [loaded, given] = await Promise.all([this.loadTemplate(url), looks]);
        if (!current()) return;
        const t = loaded.template;
        // Each model drawn counts its triangles. The load held one copy's until the first model took them.
        loaded.claim.setTriangles(0);
        this.budget.useTriangles(t.triangles);
        entry.template = t;
        entry.triangles = t.triangles;
        report.bytes = t.bytes;
        report.triangles = t.triangles;
        report.pictures = t.pictures;
        holder.userData['template'] = t;
        const shadows = this.shadowsOn && this.castsShadows(entry);
        const chosen = entry.id !== null && this.choiceTargets.has(entry.id);
        if (t.instanceable && changes.length === 0 && !clipName && !chosen) {
          // Drawn as an instance of the file's meshes (many blocks, few draw calls).
          this.poolFor(t, url.href, shadows).add(holder);
          this.materialsOf(t.scene, report);
        } else {
          const copy = cloneModel(t.scene);
          held.lights = this.fileLights(copy);
          if (shadows) castShadows(copy);
          holder.add(copy);
          holder.userData['copy'] = copy;
          held.materials = this.changeMaterials(changes, given, copy, report);
          if (clipName) held.mixer = this.startClip(el, copy, loaded.animations, clipName, report);
          if (held.mixer && entry.animationSpeed !== undefined) held.mixer.timeScale = entry.animationSpeed;
          // The options its choices start with; the model counts as loading until they are on it.
          await Promise.all(this.choices.filter((c) => c.choice!.target === entry.id).map((c) => this.applyChoice(c)));
          if (!current()) return;
        }
        report.state = 'loaded';
        this.showStandIn(entry, false);
        this.showFar(entry, false);
        if (shadows) this.shadowBox = null;
        if (this.isSolid(entry)) this.collidersDirty = true;
        this.applyMotion();
      },
      (state, reason, overTotal) => {
        if (!current()) return;
        if (state === 'refused') {
          report.state = 'refused';
          report.reason = reason;
          console.warn(`HoloML: the model "${report.src}" was not loaded: ${reason}.`);
          holder.add(missingMarker());
          this.onLeftOut?.();
        }
        // A model that loads by area and would pass the page's totals waits for room (milestone 20).
        else if (byArea && overTotal) this.waitForRoom(entry, reason);
        else this.leaveOut(holder, report, entry, reason, state);
      },
    ).then(() => {
      if (byArea) this.tellAreas();
    });
  }

  /**
   * The lights inside a model's own copy (its file's own) count towards
   * the page's limit on lights like the page's: those past it are taken
   * out of the copy (review 134, V6). Returns how many it keeps.
   */
  private fileLights(copy: Object3D): number {
    const lights: Object3D[] = [];
    copy.traverse((o) => {
      if ((o as Object3D & { isLight?: boolean }).isLight === true && !(o instanceof AmbientLight)) lights.push(o);
    });
    let kept = 0;
    for (const light of lights) {
      if (this.placedLights < LIMITS.lights) {
        this.placedLights += 1;
        kept += 1;
      } else {
        light.removeFromParent();
        this.lightLeftOut();
      }
    }
    return kept;
  }

  /** A light past the page's limit is not shown: counted for the notice, and the console says so once. */
  private lightLeftOut(): void {
    this.lightsLeftOut += 1;
    if (this.lightsLeftOut === 1) {
      console.warn(`HoloML: a page shows at most ${LIMITS.lights} lights that shine from a place or a direction; the lights after them were left out.`);
    }
    this.onLeftOut?.();
  }

  /**
   * A model's stand-in (HoloML 0.2, milestone 20): loaded with the page,
   * and counted, like any model, into a holder inside the model's own, so
   * it is placed, turned, and sized as the model, and a click on it is a
   * click on the model. It is drawn plain (as an instance where it can
   * be), and is solid and casts shadows if the model does.
   */
  private standIn(entry: Entry, holder: Object3D, src: string): void {
    const report: ModelReport = { src, state: 'loading', materials: {}, animation: null, standsInFor: attr(entry.el, 'src') ?? '' };
    this.models.push(report);
    const s: StandIn = { holder: new Object3D(), report, href: null };
    holder.add(s.holder);
    entry.standIn = s;
    void this.guarded(
      src,
      "models load only from the page's own site",
      async (url) => {
        if (!this.templates.has(url.href) && this.templates.size >= LIMITS.modelFiles) throw new LeftOut(`more than ${LIMITS.modelFiles} model files on the page`);
        s.href = url.href;
        this.useTemplate(url.href);
        const loaded = await this.loadTemplate(url);
        if (entry.removed) return;
        const t = loaded.template;
        loaded.claim.setTriangles(0);
        this.budget.useTriangles(t.triangles);
        s.template = t;
        s.triangles = t.triangles;
        report.bytes = t.bytes;
        report.triangles = t.triangles;
        report.pictures = t.pictures;
        s.holder.userData['template'] = t;
        const shadows = this.shadowsOn && this.castsShadows(entry);
        if (t.instanceable) this.poolFor(t, url.href, shadows).add(s.holder);
        else {
          const copy = cloneModel(t.scene);
          s.lights = this.fileLights(copy);
          if (shadows) castShadows(copy);
          s.holder.add(copy);
        }
        this.materialsOf(t.scene, report);
        report.state = 'loaded';
        if (s.holder.visible && shadows) this.shadowBox = null;
        if (s.holder.visible && this.isSolid(entry)) this.collidersDirty = true;
      },
      (state, reason) => {
        if (!entry.removed) this.standInLeftOut(s, reason, state);
      },
    );
  }

  /** A stand-in not shown: reported (the model itself still loads). */
  private standInLeftOut(s: StandIn, reason: string, state: NotShown = 'left-out'): void {
    s.report.state = state;
    s.report.reason = reason;
    console.warn(`HoloML: the stand-in "${s.report.src}" was ${state === 'failed' ? 'not loaded' : 'left out'}: ${reason}.`);
    // What it had taken so far no longer counts.
    if (s.triangles) this.budget.releaseTriangles(s.triangles);
    s.triangles = undefined;
    this.placedLights -= s.lights ?? 0;
    s.lights = 0;
    if (s.href) this.releaseTemplate(s.href, false);
    s.href = null;
    this.onLeftOut?.();
  }

  /** Shows a model's stand-in while the model is not loaded, and hides it once the model is. */
  private showStandIn(entry: Entry, shown: boolean): void {
    const s = entry.standIn;
    // HoloML 0.3: the far version, once it shows, takes the stand-in's place.
    if (shown && entry.far?.holder.visible) shown = false;
    if (!s || s.holder.visible === shown) return;
    s.holder.visible = shown;
    const pool = s.holder.userData['pool'] as InstancePool | undefined;
    if (pool) pool.dirty = true;
    if (s.template && this.isSolid(entry)) this.collidersDirty = true;
    if (s.template && this.castsShadows(entry)) this.shadowBox = null;
    this.requestFrame();
  }

  /** A model's stand-in goes with the model (holoml.remove): it no longer counts. */
  private removeStandIn(entry: Entry): void {
    const s = entry.standIn;
    if (!s) return;
    (s.holder.userData['pool'] as InstancePool | undefined)?.remove(s.holder);
    if (s.triangles) this.budget.releaseTriangles(s.triangles);
    this.placedLights -= s.lights ?? 0;
    if (s.href) this.releaseTemplate(s.href, false);
    const i = this.models.indexOf(s.report);
    if (i >= 0) this.models.splice(i, 1);
    entry.standIn = undefined;
  }

  // ---- A lighter model far away (HoloML 0.3, milestone 25) ---------------------------

  /** Whether a far version can stand for its model: not one that could not be loaded. */
  private farUsable(f: Far): boolean {
    return f.report.state !== 'refused' && f.report.state !== 'left-out' && f.report.state !== 'failed';
  }

  /**
   * Each model with a far version, as the viewer moves: past `far-from`
   * (and a margin), the far version loads and shows, and once it shows the
   * model itself is let go; within it (less a margin), the model loads, and
   * once it is in the far version hides. In a group that loads by area and
   * is let go, neither is loaded. A far version that cannot be loaded
   * leaves the model to show at any distance.
   */
  private updateFar(): void {
    if (this.fars.length === 0) return;
    const eye = this.camera.position;
    const at = new Vector3();
    for (const entry of this.fars) {
      const f = entry.far;
      if (!f || entry.removed) continue;
      if (!this.areasIn(entry)) {
        if (f.holder.visible || f.href) this.releaseFar(entry, true);
        f.decided = false;
        continue;
      }
      const d = entry.object!.getWorldPosition(at).distanceTo(eye);
      if (!f.decided) {
        f.isFar = d >= f.from;
        f.decided = true;
      } else if (f.isFar && d < f.from * (1 - FAR_MARGIN)) f.isFar = false;
      else if (!f.isFar && d > f.from * (1 + FAR_MARGIN)) f.isFar = true;
      const report = entry.report!;
      if (f.isFar && this.farUsable(f)) {
        if (f.report.state === 'waiting') this.loadFar(entry);
        else if (f.report.state === 'loaded') {
          if (!f.holder.visible) this.showFar(entry, true);
          // Shown: the model itself is let go, and holds nothing while the viewer is far.
          if (report.state === 'loaded' || report.state === 'loading') this.letGo(entry);
        }
      } else {
        // Near, or the far version cannot stand for it: the model itself; the far one shows until it is in.
        if (report.state === 'waiting' && this.wanted(entry)) this.loadModel(entry);
        else if (report.state === 'loaded' && f.holder.visible) this.showFar(entry, false);
        else if (!this.farUsable(f) && f.holder.visible) this.showFar(entry, false);
      }
    }
  }

  /** Shows or hides a far version (and the stand-in with it hides). */
  private showFar(entry: Entry, shown: boolean): void {
    const f = entry.far;
    if (!f || f.holder.visible === shown) return;
    f.holder.visible = shown;
    if (shown) this.showStandIn(entry, false);
    const pool = f.holder.userData['pool'] as InstancePool | undefined;
    if (pool) pool.dirty = true;
    if (f.template && this.isSolid(entry)) this.collidersDirty = true;
    if (f.template && this.castsShadows(entry)) this.shadowBox = null;
    this.requestFrame();
  }

  /**
   * Loads a far version: drawn as an instance of its file where it can be,
   * or as its own copy when the model changes its materials or plays one of
   * its animations, which the far version then does too. It counts toward
   * the page's limits like any model.
   */
  private loadFar(entry: Entry): void {
    const f = entry.far!;
    const report = f.report;
    const load = (f.loads += 1);
    const current = () => !entry.removed && f.loads === load;
    report.state = 'loading';
    delete report.reason;
    void this.guarded(
      f.src,
      "models load only from the page's own site",
      async (url) => {
        if (!this.templates.has(url.href) && this.templates.size >= LIMITS.modelFiles) throw new LeftOut(`more than ${LIMITS.modelFiles} model files on the page`);
        f.href = url.href;
        this.useTemplate(url.href);
        const el = entry.el;
        const changes = el.children.filter((c): c is ElementNode => c.type === 'element' && c.name === 'material');
        const clipName = attr(el, 'animation');
        const [loaded, looks] = await Promise.all([this.loadTemplate(url), Promise.all(changes.map((c) => this.lookOf(c)))]);
        if (!current()) return;
        const t = loaded.template;
        loaded.claim.setTriangles(0);
        this.budget.useTriangles(t.triangles);
        f.template = t;
        f.triangles = t.triangles;
        f.looks = looks;
        report.bytes = t.bytes;
        report.triangles = t.triangles;
        report.pictures = t.pictures;
        f.holder.userData['template'] = t;
        const shadows = this.shadowsOn && this.castsShadows(entry);
        if (t.instanceable && changes.length === 0 && !clipName) {
          this.poolFor(t, url.href, shadows).add(f.holder);
          this.materialsOf(t.scene, report);
        } else {
          const copy = cloneModel(t.scene);
          f.lights = this.fileLights(copy);
          if (shadows) castShadows(copy);
          f.holder.add(copy);
          f.holder.userData['copy'] = copy;
          f.materials = this.changeMaterials(changes, looks, copy, report);
          if (clipName) f.mixer = this.startClip(el, copy, loaded.animations, clipName, report);
          if (f.mixer && entry.animationSpeed !== undefined) f.mixer.timeScale = entry.animationSpeed;
        }
        report.state = 'loaded';
        this.applyMotion();
        this.requestFrame();
      },
      (state, reason) => {
        if (current()) this.farLeftOut(entry, reason, state);
      },
    );
  }

  /** A far version that could not be loaded: reported; the model itself shows at any distance. */
  private farLeftOut(entry: Entry, reason: string, state: NotShown = 'left-out'): void {
    const f = entry.far!;
    this.releaseFar(entry, false);
    f.report.state = state;
    f.report.reason = reason;
    console.warn(`HoloML: the far model "${f.report.src}" was ${state === 'failed' ? 'not loaded' : 'left out'}: ${reason}; the model itself is shown at every distance.`);
    this.onLeftOut?.();
    this.requestFrame();
  }

  /** Releases what a far version holds; it loads again when wanted. With `drop`, a file no model uses any more is let go too. */
  private releaseFar(entry: Entry, drop: boolean): void {
    const f = entry.far;
    if (!f) return;
    f.loads += 1;
    this.showFar(entry, false);
    (f.holder.userData['pool'] as InstancePool | undefined)?.remove(f.holder);
    (f.holder.userData['copy'] as Object3D | undefined)?.removeFromParent();
    delete f.holder.userData['copy'];
    delete f.holder.userData['template'];
    if (f.triangles) this.budget.releaseTriangles(f.triangles);
    f.triangles = undefined;
    f.template = undefined;
    this.placedLights -= f.lights ?? 0;
    f.lights = 0;
    for (const m of f.materials ?? []) this.disposeMade(m);
    f.materials = undefined;
    if (f.mixer) {
      f.mixer.stopAllAction();
      this.mixers.splice(this.mixers.indexOf(f.mixer), 1);
      for (const a of [...this.playing]) if (a.getMixer() === f.mixer) this.playing.delete(a);
    }
    f.mixer = null;
    for (const l of f.looks ?? []) for (const t of [l.map, l.normalMap, l.roughnessMap]) if (t) this.pictures.release(t, drop);
    f.looks = undefined;
    if (f.href) this.releaseTemplate(f.href, drop);
    f.href = null;
    if (this.farUsable(f)) {
      f.report.state = 'waiting';
      f.report.reason = 'it loads when the viewer is far';
    }
    delete f.report.bytes;
    delete f.report.triangles;
    delete f.report.pictures;
  }

  /** The models with a far version, for the tests and the inspector: the distance, which one the view needs, and both states. */
  get farInfo(): { id: string | null; src: string; state: string; far: { src: string; state: string; reason: string | null; shown: boolean }; from: number; isFar: boolean; distance: number }[] {
    const eye = this.camera.position;
    const at = new Vector3();
    return this.fars
      .filter((e) => !e.removed && e.far)
      .map((e) => ({
        id: e.id,
        src: e.report!.src,
        state: e.report!.state,
        far: { src: e.far!.report.src, state: e.far!.report.state, reason: e.far!.report.reason ?? null, shown: e.far!.holder.visible && e.far!.report.state === 'loaded' },
        from: e.far!.from,
        isFar: e.far!.isFar,
        distance: e.object!.getWorldPosition(at).distanceTo(eye),
      }));
  }

  // ---- Loading by area (HoloML 0.2, milestone 20) -------------------------------

  /** Whether a model loads by area: a group around it has load="near". */
  private byArea(entry: Entry): boolean {
    for (let e = entry.parent; e; e = e.parent) if (e.area) return true;
    return false;
  }

  /** Whether a model may load now: the viewer is near every group around it that loads by area. */
  private wanted(entry: Entry): boolean {
    if (!this.areasIn(entry)) return false;
    // HoloML 0.3: not while the viewer is far and its far version can stand for it.
    return !(entry.far?.isFar && this.farUsable(entry.far));
  }

  /** Whether the viewer is near every group around a model that loads by area. */
  private areasIn(entry: Entry): boolean {
    for (let e = entry.parent; e; e = e.parent) if (e.area && !e.area.in) return false;
    return true;
  }

  /** The models in a group, at any depth. */
  private modelsIn(group: Entry): Entry[] {
    const out: Entry[] = [];
    const walk = (e: Entry) => {
      for (const c of e.children) {
        if (c.removed) continue;
        if (c.kind === 'model') out.push(c);
        walk(c);
      }
    };
    walk(group);
    return out;
  }

  /**
   * Each group with load="near" loads its models while the viewer's eyes
   * are within its `near` of the group's place, and lets them go once
   * they are farther than LET_GO times that (so walking along the edge
   * does not load them and let them go again and again). What is let go
   * makes room first, and models that waited for room try again.
   */
  private updateAreas(): void {
    if (this.areas.length === 0) return;
    const eye = this.camera.position;
    const at = new Vector3();
    const coming: Area[] = [];
    const going: Area[] = [];
    for (const a of this.areas) {
      if (a.entry.removed) continue;
      const d = a.entry.object!.getWorldPosition(at).distanceTo(eye);
      if (!a.in && d <= a.near) coming.push(a);
      else if (a.in && d > a.near * LET_GO) going.push(a);
    }
    if (coming.length === 0 && going.length === 0) return;
    for (const a of going) a.in = false;
    for (const a of going) for (const m of this.modelsIn(a.entry)) this.letGo(m);
    for (const a of coming) a.in = true;
    for (const a of coming) for (const m of this.modelsIn(a.entry)) if (m.report?.state === 'waiting' && this.wanted(m)) this.loadModel(m);
    if (going.length > 0) {
      for (const m of this.entries) if (m.kind === 'model' && !m.removed && m.report?.state === 'waiting' && this.wanted(m)) this.loadModel(m);
    }
    this.tellAreas();
    this.requestFrame();
  }

  /**
   * Lets a model go: it holds nothing and counts for nothing, its stand-in
   * shows again, and a load still under way is dropped when it finishes.
   * It loads again when the viewer comes near.
   */
  private letGo(entry: Entry): void {
    const report = entry.report!;
    if (report.state === 'refused') return;
    entry.loads = (entry.loads ?? 0) + 1;
    const drawn = report.state === 'loaded';
    const solid = drawn && this.isSolid(entry);
    const shadows = drawn && this.castsShadows(entry);
    this.unload(entry, true);
    report.state = 'waiting';
    report.reason = FAR;
    delete report.bytes;
    delete report.triangles;
    delete report.pictures;
    delete (report as ModelReport & { action?: AnimationAction }).action;
    report.materials = {};
    report.animation = null;
    this.showStandIn(entry, true);
    if (solid) this.collidersDirty = true;
    if (shadows) this.shadowBox = null;
  }

  /** A model that loads by area and would pass the page's limits waits, holding nothing, until other groups are let go. */
  private waitForRoom(entry: Entry, reason: string): void {
    this.unload(entry, true);
    entry.report!.state = 'waiting';
    entry.report!.reason = `${reason}; it loads when other groups are let go`;
    this.showStandIn(entry, true);
  }

  /**
   * Takes a model out of the scene and releases what it holds: its
   * triangles, its instance or copy, the materials made for it, its
   * animation, its materials' pictures, and its use of its file. With
   * `drop` (loading by area), a file or picture no model uses any more is
   * let go too; without (holoml.remove), it stays loaded for the next.
   */
  private unload(entry: Entry, drop: boolean): void {
    const holder = entry.object;
    if (entry.triangles) this.budget.releaseTriangles(entry.triangles);
    entry.triangles = undefined;
    entry.template = undefined;
    if (holder) {
      (holder.userData['pool'] as InstancePool | undefined)?.remove(holder);
      (holder.userData['copy'] as Object3D | undefined)?.removeFromParent();
      delete holder.userData['copy'];
      delete holder.userData['template'];
      for (const c of [...holder.children]) if (c.userData['missing'] === true) holder.remove(c);
    }
    const held = entry.held;
    entry.held = undefined;
    if (!held) return;
    this.placedLights -= held.lights;
    for (const m of held.materials) this.disposeMade(m);
    if (held.mixer) {
      held.mixer.stopAllAction();
      this.mixers.splice(this.mixers.indexOf(held.mixer), 1);
      for (const a of [...this.playing]) if (a.getMixer() === held.mixer) this.playing.delete(a);
    }
    // A choice's materials were made from this model's: they are made again when it loads again.
    for (const c of this.choices) {
      if (c.choice?.target !== entry.id) continue;
      for (const o of c.choice.options) {
        for (const m of o.made.values()) this.disposeMade(m);
        o.made.clear();
      }
    }
    void held.looks.then((looks) => {
      for (const l of looks) for (const t of [l.map, l.normalMap, l.roughnessMap]) if (t) this.pictures.release(t, drop);
    });
    this.releaseTemplate(held.href, drop);
  }

  /** A material made for one model (from its `material` changes or a choice's option), with the tiled copies of its pictures. */
  private disposeMade(m: Material): void {
    for (const t of this.tiledOf.get(m) ?? []) t.dispose();
    m.dispose();
  }

  /** One more model (or stand-in) uses a model file. */
  private useTemplate(href: string): void {
    this.templateUsers.set(href, (this.templateUsers.get(href) ?? 0) + 1);
  }

  /**
   * A model (or stand-in) no longer uses a file. With `drop`, a file no
   * model uses any more is let go: what it holds of the page's totals
   * stops counting, and its meshes, materials, and pictures are released.
   * A file that failed held nothing; it is forgotten, so it is tried again
   * next time, unless it arrived and could not be read (see `unreadable`).
   */
  private releaseTemplate(href: string, drop: boolean): void {
    const left = (this.templateUsers.get(href) ?? 1) - 1;
    if (left > 0) {
      this.templateUsers.set(href, left);
      return;
    }
    this.templateUsers.delete(href);
    if (!drop) return;
    const loading = this.templates.get(href);
    this.templates.delete(href);
    void loading?.then(
      (loaded) => {
        const t = loaded.template;
        // Its bytes, its pictures' pixels, and one copy's triangles if no model took them.
        loaded.claim.release();
        for (const key of [href, `shadows ${href}`]) {
          const pool = this.pools.get(key);
          if (pool?.template !== t) continue;
          pool.dispose();
          this.pools.delete(key);
        }
        releaseFile(t.scene);
      },
      () => undefined,
    );
  }

  /**
   * Tells the page's scripts when a group that loads by area has all its
   * models in, or has let them go (the `load` event, as its `loaded`
   * changes; not while a script's new model loads into a group already in).
   */
  private tellAreas(): void {
    for (const a of [...this.areas]) {
      if (a.entry.removed) continue;
      const loaded = this.isLoaded(a.entry);
      const within = a.in && this.wanted(a.entry);
      if (loaded && !a.told) {
        a.told = true;
        this.emit({ type: 'load', entry: a.entry, loaded: true });
      } else if (!within && a.told) {
        a.told = false;
        this.emit({ type: 'load', entry: a.entry, loaded: false });
      }
    }
  }

  /**
   * A model's or a group's `loaded` (the scene API): a model's file has
   * loaded; a group is not let go, and every model in it that may load now
   * has loaded or been left out.
   */
  isLoaded(e: Entry): boolean {
    if (e.kind === 'model') return e.report?.state === 'loaded';
    for (let p: Entry | null = e; p; p = p.parent) if (p.area && !p.area.in) return false;
    return this.modelsIn(e).every((m) => !this.wanted(m) || (m.report?.state !== 'loading' && m.report?.state !== 'waiting'));
  }

  /** The groups that load by area (for the tests): how near the viewer is, and their models with their stand-ins. */
  get areasInfo(): { id: string | null; near: number; in: boolean; loaded: boolean; distance: number; models: { id: string | null; src: string; state: string; reason: string | null; standIn: { src: string; state: string; shown: boolean } | null }[] }[] {
    const eye = this.camera.position;
    const at = new Vector3();
    return this.areas
      .filter((a) => !a.entry.removed)
      .map((a) => ({
        id: a.entry.id,
        near: a.near,
        in: a.in,
        loaded: this.isLoaded(a.entry),
        distance: a.entry.object!.getWorldPosition(at).distanceTo(eye),
        models: this.modelsIn(a.entry).map((m) => this.modelInfo(m)),
      }));
  }

  /** Every model with a stand-in (for the tests): its state, and its stand-in's. */
  get standInsInfo(): { id: string | null; src: string; state: string; reason: string | null; standIn: { src: string; state: string; shown: boolean } | null }[] {
    return this.entries.filter((e) => e.kind === 'model' && !e.removed && e.standIn).map((e) => this.modelInfo(e));
  }

  private modelInfo(m: Entry): { id: string | null; src: string; state: string; reason: string | null; standIn: { src: string; state: string; shown: boolean } | null } {
    const s = m.standIn;
    return {
      id: m.id,
      src: m.report?.src ?? '',
      state: m.report?.state ?? '',
      reason: m.report?.reason ?? null,
      standIn: s ? { src: s.report.src, state: s.report.state, shown: s.holder.visible && s.report.state === 'loaded' } : null,
    };
  }

  /** What the page's files count now (for the tests): bytes, triangles, model files, and (review 134, V6) the pixels of pictures and the seconds of sound. */
  get totals(): { bytes: number; triangles: number; modelFiles: number; pixels: number; seconds: number } {
    return { bytes: this.budget.bytes, triangles: this.budget.triangles, modelFiles: this.templates.size, pixels: this.budget.pixels, seconds: this.budget.seconds };
  }

  /** One thing finished loading (or failing): the scene is ready when nothing is left. */
  private settle(): void {
    this.pending -= 1;
    this.waterDirty = true;
    this.shadersWanted = true;
    this.requestFrame();
    if (this.pending === 0) {
      this.onBusy?.(false);
      this.onReady?.();
    }
  }

  /** The instances of a model file: one pool for models with shadows, one for models without. */
  private poolFor(t: Template, src: string, shadows: boolean): InstancePool {
    const key = `${shadows ? 'shadows ' : ''}${src}`;
    let pool = this.pools.get(key);
    if (!pool) {
      pool = new InstancePool(t, this.scene, src, shadows);
      this.pools.set(key, pool);
    }
    return pool;
  }

  /** Whether a model casts and receives shadows: its own flag, or a group's around it (HoloML 0.2). */
  private castsShadows(entry: Entry): boolean {
    for (let e: Entry | null = entry; e; e = e.parent) if (e.shadows) return true;
    return false;
  }

  /** Plays (or poses) one of a model's own animations; its mixer, or null when it has none of that name. */
  private startClip(el: ElementNode, model: Object3D, clips: AnimationClip[], clipName: string, report: ModelReport): AnimationMixer | null {
    const clip = clips.find((c) => c.name === clipName);
    if (!clip) {
      console.warn(`HoloML: the model "${report.src}" has no animation named "${clipName}".`);
      return null;
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
    return mixer;
  }

  /**
   * A model not shown: marked where it would be, reported, and out of the
   * Tab order. What it held is released; one that loads by area forgets
   * its file and stays in the Tab order, as it is tried again when the
   * viewer next comes near (milestone 20). Its stand-in stays.
   */
  private leaveOut(holder: Object3D, report: ModelReport, entry: Entry, reason: string, state: NotShown = 'left-out'): void {
    report.state = state;
    report.reason = reason;
    console.warn(state === 'failed' ? `HoloML: the model "${report.src}" ${reason}.` : `HoloML: the model "${report.src}" was left out: ${reason}.`);
    const byArea = this.byArea(entry);
    this.unload(entry, byArea);
    holder.add(missingMarker());
    if (entry.item && !byArea) this.removeItem(entry);
    this.onLeftOut?.();
  }

  /** <material> children: change the named materials, only what is given (with their looks, pictures included); the materials made. */
  private changeMaterials(changes: ElementNode[], looks: Look[], model: Object3D, report: ModelReport): Material[] {
    const done = new Map<Material, Changeable>();
    model.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const next = list.map((m: Material) => {
        const i = changes.findIndex((c) => attr(c, 'name') === m.name);
        if (i < 0 || !changeable(m)) return m;
        let copy = done.get(m);
        if (!copy) {
          copy = m.clone();
          this.applyLook(copy, looks[i]!);
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
    return [...done.values()];
  }

  /**
   * What a `material` or an `option` element gives: its numbers, and
   * (HoloML 0.2) its pictures and tiling, once the pictures arrive. It
   * never fails: a picture that cannot be shown is left out and reported,
   * and the material keeps its own.
   */
  private async lookOf(el: ElementNode): Promise<Look> {
    const unit = (name: string) => {
      const v = has(el, name) ? num(el, name, NaN, 0, 1) : NaN;
      return Number.isNaN(v) ? null : v;
    };
    const look: Look = { color: color(el, 'color'), metalness: unit('metalness'), roughness: unit('roughness'), opacity: unit('opacity'), repeat: null };
    if (!this.since('0.2')) return look;
    look.repeat = tiling(el);
    const slots: [string, 'map' | 'normalMap' | 'roughnessMap', PictureUse][] = [
      ['map', 'map', 'color'],
      ['normal-map', 'normalMap', 'data'],
      ['roughness-map', 'roughnessMap', 'data'],
    ];
    await Promise.all(
      slots.map(async ([name, slot, use]) => {
        const src = attr(el, name);
        const texture = src ? await this.picture(src, use, look.repeat ?? [1, 1]) : null;
        if (texture) look[slot] = texture;
      }),
    );
    return look;
  }

  /** One of the page's pictures, counted as loading until it arrives; null (and reported) when it cannot be shown. */
  private picture(src: string, use: PictureUse, repeat: [number, number]): Promise<Texture | null> {
    return this.guarded(
      src,
      "pictures load only from the page's own site",
      (url) => this.pictures.texture(url, use, repeat),
      (_state, reason) => this.pictureLeftOut(src, reason),
    );
  }

  /** A picture not shown: reported once, however many materials name it. */
  private pictureLeftOut(what: string, why: string): void {
    if (this.pictureProblems.some((p) => p.what === what)) return;
    this.pictureProblems.push({ what, why });
    console.warn(`HoloML: the picture "${what}" was left out: ${why}.`);
    this.onLeftOut?.();
  }

  /**
   * Gives a material a look: only what the look gives changes; `repeat`
   * tiles the material's own pictures too. A material that takes no light
   * takes the look's colour, opacity, colour picture, and tiling; metalness,
   * roughness, and the pictures of bumps and roughness are nothing to it.
   */
  private applyLook(m: Changeable, look: Look): void {
    const lit = m instanceof MeshStandardMaterial;
    if (look.color) m.color.set(look.color);
    if (lit && look.metalness !== null) m.metalness = look.metalness;
    if (lit && look.roughness !== null) m.roughness = look.roughness;
    if (look.opacity !== null) {
      m.opacity = look.opacity;
      m.transparent = look.opacity < 1;
    }
    const slots = m as unknown as Record<(typeof PICTURE_SLOTS)[number], Texture | null | undefined>;
    const given = new Set<Texture>();
    for (const slot of lit ? (['map', 'normalMap', 'roughnessMap'] as const) : (['map'] as const)) {
      const t = look[slot];
      if (t) {
        slots[slot] = t;
        given.add(t);
      }
    }
    if (look.repeat) {
      // One copy of each picture, however many slots use it (roughness and metalness often share one).
      const tiled = new Map<Texture, Texture>();
      for (const slot of PICTURE_SLOTS) {
        const t = slots[slot];
        if (!t || given.has(t)) continue;
        let copy = tiled.get(t);
        if (!copy) {
          copy = t.clone();
          copy.wrapS = RepeatWrapping;
          copy.wrapT = RepeatWrapping;
          copy.repeat.set(look.repeat[0], look.repeat[1]);
          copy.needsUpdate = true;
          tiled.set(t, copy);
        }
        slots[slot] = copy;
      }
      // Released with the material, when its model is let go (milestone 20).
      this.tiledOf.set(m, [...tiled.values()]);
    }
    m.needsUpdate = true;
  }

  private materialsOf(model: Object3D, report: ModelReport): void {
    model.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (changeable(m) && m.name) {
          const lit = m instanceof MeshStandardMaterial;
          report.materials[m.name] = {
            color: `#${m.color.getHexString()}`,
            metalness: lit ? m.metalness : null,
            roughness: lit ? m.roughness : null,
            opacity: m.opacity,
            map: m.map ? ((m.map.userData['src'] as string | undefined) ?? 'own') : null,
            repeat: m.map ? [m.map.repeat.x, m.map.repeat.y] : null,
          };
        }
      }
    });
  }

  private light(el: ElementNode, parent: Object3D): Object3D | null {
    const type = attr(el, 'type');
    const c = color(el, 'color') ?? '#ffffff';
    const intensity = num(el, 'intensity', 1, 0);
    // The page's limit on lights that shine from a place or a direction (review 134, V6): later ones are left out.
    if ((type === 'directional' || type === 'point' || type === 'spot') && this.placedLights >= LIMITS.lights) {
      this.lightLeftOut();
      return null;
    }
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
    if (type !== 'ambient') this.placedLights += 1;
    light.userData['factor'] = factor;
    light.userData['kind'] = type;
    if (this.since('0.2') && has(el, 'shadows') && type !== 'ambient') this.castFrom(light as DirectionalLight | PointLight | SpotLight);
    parent.add(light);
    return light;
  }

  /**
   * A light marked `shadows` (HoloML 0.2): soft shadows from the models
   * marked `shadows`, where there is a graphics card; drawn in software,
   * left out, and the console says so once. Each such light draws the
   * scene once more, into a picture that every material then reads, and a
   * graphics card has room for only so many: past the page's limit a light
   * shines without shadows, and the console says so once (review 134, V6).
   */
  private castFrom(light: DirectionalLight | PointLight | SpotLight): void {
    if (!this.shadowsOn) {
      if (!this.shadowsLeftOut && this.software === null && this.lighter) {
        this.shadowsLeftOut = 'the scene is drawn lighter on this device';
        console.warn("HoloML: the page's shadows were left out: the scene is drawn lighter on this device.");
      } else if (!this.shadowsLeftOut) {
        this.shadowsLeftOut = `this computer draws 3D in software${this.software ? ` (${this.software})` : ''}`;
        console.warn("HoloML: the page's shadows were left out: this computer draws 3D in software, without a graphics card.");
      }
      return;
    }
    if (this.shadowLights.length >= LIMITS.shadowLights) {
      this.shadowsLeftOff += 1;
      if (this.shadowsLeftOff === 1) console.warn(`HoloML: at most ${LIMITS.shadowLights} lights cast shadows on a page; the lights after them shine without shadows.`);
      this.onLeftOut?.();
      return;
    }
    light.castShadow = true;
    const size = light instanceof PointLight ? 1024 : 2048;
    light.shadow.mapSize.set(size, size);
    // Soft edges, and no stripes on the surfaces that cast them.
    light.shadow.radius = 4;
    light.shadow.bias = -0.0003;
    light.shadow.normalBias = 0.02;
    this.shadowLights.push(light);
  }

  /**
   * Each shadow-casting light sees just the models with shadows, so the
   * detail of its shadow map is spent on them (fitted before each frame;
   * the models' bounds are measured again when they arrive or move).
   */
  private fitShadows(): void {
    if (this.shadowLights.length === 0) return;
    if (!this.shadowBox) {
      this.scene.updateMatrixWorld();
      const box = new Box3();
      const b = new Box3();
      for (const e of this.entries) {
        if (e.kind !== 'model' || e.removed || !this.castsShadows(e) || !this.modelBox(e, b)) continue;
        box.union(b);
      }
      this.shadowBox = box;
    }
    if (this.shadowBox.isEmpty()) return;
    const { min, max } = this.shadowBox;
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z));
    const pad = 0.1;
    for (const light of this.shadowLights) {
      if (!light.parent) continue;
      light.updateWorldMatrix(true, false);
      if (light instanceof DirectionalLight) {
        light.target.updateWorldMatrix(true, false);
        light.shadow.updateMatrices(light);
        const cam = light.shadow.camera;
        const lo = new Vector3(Infinity, Infinity, Infinity);
        const hi = new Vector3(-Infinity, -Infinity, -Infinity);
        for (const c of corners) {
          const v = c.clone().applyMatrix4(cam.matrixWorldInverse);
          lo.min(v);
          hi.max(v);
        }
        // An orthographic view may reach behind the light's own place, so near can be less than 0.
        cam.left = lo.x - pad;
        cam.right = hi.x + pad;
        cam.bottom = lo.y - pad;
        cam.top = hi.y + pad;
        cam.near = -hi.z - pad;
        cam.far = -lo.z + pad;
        cam.updateProjectionMatrix();
      } else {
        const at = light.getWorldPosition(new Vector3());
        const cam = light.shadow.camera;
        cam.near = 0.05;
        cam.far = Math.max(1, Math.max(...corners.map((c) => c.distanceTo(at))) + pad);
        cam.updateProjectionMatrix();
      }
    }
  }

  /**
   * The page's panorama of the surroundings (HoloML 0.2 `environment`):
   * once it arrives, it lights the scene in place of the renderer's own
   * soft light. It comes from the page's own site, within its limits.
   */
  private loadEnvironment(src: string): void {
    const state: EnvironmentState = { src, state: 'loading' };
    this.environment = state;
    void this.guarded(
      src,
      "the surroundings load only from the page's own site",
      async (url) => {
        this.lightFrom(await this.pictures.environment(url), url);
        this.environmentUrl = url;
        state.state = 'loaded';
        this.followAmbient();
      },
      (how, reason) => {
        state.state = how;
        state.reason = reason;
        this.pictureLeftOut(src, reason);
      },
    );
  }

  /** Lights the scene from the page's panorama, drawn into a picture on the graphics card (again, when the card was reset). */
  private lightFrom(panorama: Texture, url: URL): void {
    const pmrem = new PMREMGenerator(this.renderer);
    const lit = pmrem.fromEquirectangular(panorama).texture;
    pmrem.dispose();
    // The same file as the sky: kept, for the sky draws it.
    if (url.href !== this.skyUrl) panorama.dispose();
    this.scene.environment?.dispose();
    this.scene.environment = lit;
  }

  /**
   * The page's sky (HoloML 0.2 `sky`, milestone 19): a panorama drawn
   * behind everything in place of the background colour, once it
   * arrives. It comes from the page's own site, within its limits, and
   * its brightness follows the ambient lights, as the surroundings' does.
   */
  private loadSky(src: string): void {
    const state: EnvironmentState = { src, state: 'loading' };
    this.sky = state;
    void this.guarded(
      src,
      "the sky loads only from the page's own site",
      async (url) => {
        this.scene.background = await this.pictures.environment(url);
        state.state = 'loaded';
        this.followAmbient();
      },
      (how, reason) => {
        state.state = how;
        state.reason = reason;
        this.pictureLeftOut(src, reason);
      },
    );
  }

  /**
   * A panel (HoloML 0.2, milestone 19): wrapped text on a flat board,
   * placed and turned like a model. Its words are in the page too, for
   * Find in page, screen readers, and the text view.
   */
  private panel(el: ElementNode, parent: Object3D, entry: Entry): Object3D {
    const holder = this.place(new Object3D(), el);
    holder.userData['holomlText'] = true;
    parent.add(holder);
    const background = color(el, 'background');
    const note = document.createElement('div');
    document.getElementById('holoml-labels')?.append(note);
    entry.panelLook = {
      paragraphs: paragraphs(rawText(el)),
      lines: [],
      width: num(el, 'width', 1, Number.MIN_VALUE),
      height: 0,
      size: num(el, 'size', 0.06, Number.MIN_VALUE),
      color: color(el, 'color') ?? (background ? contrastText(background) : this.textColor),
      background,
      pixels: [0, 0],
      note,
      words: null,
      dir: this.languageOf(el)?.dir ?? 'ltr',
    };
    drawPanel(holder, entry.panelLook, this.anisotropy);
    return holder;
  }

  /** A panel's words in the page (for Find in page) and in the outline after its button (for screen readers and the text view). */
  private panelWords(entry: Entry): void {
    const look = entry.panelLook;
    if (!look) return;
    const paras = (list: string[]) =>
      list.map((words) => {
        const p = document.createElement('p');
        p.textContent = words;
        mark(p, this.languageOf(entry.el));
        return p;
      });
    look.note.replaceChildren(...paras(look.paragraphs));
    // The first paragraph names its button; the rest follow it. A panel inside a link has no button of its own:
    // its first paragraph is in the link's words, and the rest follow the link, in its item, so that screen
    // readers and the text view have every paragraph of it too.
    const item = entry.item ?? this.linkItem(entry);
    if (item) {
      if (!look.words) {
        look.words = document.createElement('div');
        look.words.className = 'holoml-panel-words';
        if (entry.item) entry.item.after(look.words);
        else item.parentElement?.append(look.words);
      }
      look.words.replaceChildren(...paras(look.paragraphs.slice(1)));
    }
  }

  /** The outline's link that an element is inside, if it is inside one that is listed there. */
  private linkItem(entry: Entry): HTMLElement | null {
    for (let e = entry.parent; e; e = e.parent) if (e.kind === 'a' && e.item) return e.item;
    return null;
  }

  /**
   * The floor plan (HoloML 0.2 `plan`, milestone 19): the page's picture
   * in a corner of the screen, with a marker for where the viewer is and
   * which way they face. The picture comes from the page's own site,
   * within its limits.
   */
  private plan(el: ElementNode): void {
    const entry: Entry = { el, kind: 'plan', name: nameOf(el), depth: 0, object: null, item: null, id: null, parent: null, children: [], link: null, fromScript: false };
    const id = attr(el, 'id') ?? null;
    if (id && !this.entryById.has(id)) {
      entry.id = id;
      this.entryById.set(id, entry);
    }
    this.entries.push(entry);
    const src = attr(el, 'src') ?? '';
    const box = document.createElement('figure');
    box.className = 'holoml-plan';
    box.dataset['testid'] = 'holoml-plan';
    box.style.width = `${num(el, 'width', 200, Number.MIN_VALUE)}px`;
    const img = document.createElement('img');
    img.alt = collapse(attr(el, 'label') ?? '') || 'Floor plan';
    const marker = document.createElement('div');
    marker.className = 'holoml-plan-marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.hidden = true;
    box.append(img, marker);
    mark(box, this.languageOf(el));
    // Shown once its picture has arrived.
    box.hidden = true;
    this.corner(el, 'top-right').append(box);
    entry.hud = box;
    const plan: PlanState = { src, state: 'loading', box, img, marker, area: area(el), at: null, angle: 0 };
    this.planState = plan;
    void this.guarded(
      src,
      "pictures load only from the page's own site",
      async (url) => {
        img.src = await this.pictures.address(url);
        // Not a picture a browser can draw after all: it holds nothing of the page's totals.
        await img.decode().catch((e: unknown) => {
          this.pictures.discard(url);
          throw e;
        });
        plan.state = 'loaded';
        box.hidden = plan.hiddenByScript === true;
        this.updatePlan();
      },
      (how, reason) => {
        plan.state = how;
        plan.reason = reason;
        this.pictureLeftOut(src, reason);
      },
    );
  }

  /** The floor plan's marker: where the viewer is on it, and which way they face (hidden outside its area). */
  private updatePlan(): void {
    const plan = this.planState;
    if (!plan) return;
    const area = plan.area;
    const p = this.camera.position;
    const fx = area ? (p.x - area[0]) / (area[2] - area[0]) : -1;
    const fz = area ? (p.z - area[1]) / (area[3] - area[1]) : -1;
    const inside = plan.state === 'loaded' && fx >= 0 && fx <= 1 && fz >= 0 && fz <= 1;
    plan.marker.hidden = !inside;
    plan.at = inside ? [fx, fz] : null;
    if (!inside) return;
    const d = this.camera.getWorldDirection(new Vector3());
    // Up on the picture is -z; the angle turns clockwise, as the view does seen from above.
    plan.angle = Math.round((Math.atan2(d.x, -d.z) / DEG) * 10) / 10;
    plan.marker.style.left = `${(fx * 100).toFixed(2)}%`;
    plan.marker.style.top = `${(fz * 100).toFixed(2)}%`;
    plan.marker.style.transform = `translate(-50%, -50%) rotate(${plan.angle}deg)`;
  }

  private label(el: ElementNode, parent: Object3D, entry: Entry): Object3D {
    const words = text(el);
    const size = num(el, 'size', 0.2, Number.MIN_VALUE);
    const fill = color(el, 'color') ?? this.textColor;
    const sprite = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    const dir = this.directionOf(el, words);
    drawLabel(sprite, words, size, fill, dir);
    sprite.position.set(...vec3(el, 'position', [0, 0, 0]));
    parent.add(sprite);
    this.labels.push({ text: words, sprite, dir });
    // The label's words are in the page too, for Find in page and screen readers, in their language (HoloML 0.3).
    const note = document.createElement('p');
    note.textContent = words;
    mark(note, this.languageOf(el));
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
    const place = this.corner(el);
    this.entries.push(entry);
    const box = document.createElement('div');
    box.className = 'holoml-hud';
    box.dataset['testid'] = 'holoml-hud';
    if (entry.id) box.dataset['id'] = entry.id;
    box.setAttribute('role', 'status');
    box.style.fontSize = `${num(el, 'size', 18, Number.MIN_VALUE)}px`;
    const c = color(el, 'color');
    if (c) box.style.color = c;
    mark(box, this.languageOf(el));
    place.append(box);
    entry.hud = box;
    this.setHudText(entry, el.children.map((ch) => (ch.type === 'text' ? ch.value : '')).join(''));
    return entry;
  }

  /** The screen corner an element names, where its screen text and sliders stack in page order. */
  private corner(el: ElementNode, fallback = 'top-left'): HTMLElement {
    const corner = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(attr(el, 'corner') ?? '') ? attr(el, 'corner')! : fallback;
    let place = this.hudLayer.querySelector<HTMLElement>(`.holoml-hud-corner[data-corner="${corner}"]`);
    if (!place) {
      place = document.createElement('div');
      place.className = 'holoml-hud-corner';
      place.dataset['corner'] = corner;
      this.hudLayer.append(place);
    }
    return place;
  }

  /**
   * A slider (HoloML 0.2, milestone 18): a number the viewer chooses, with
   * its label, in a corner of the screen. It is the page's own range
   * control, so the mouse, touch, the keyboard, and screen readers use it
   * as on any web page; moving it tells the page's scripts (`change`).
   */
  private slider(el: ElementNode): Entry {
    const id = attr(el, 'id') ?? null;
    const entry: Entry = { el, kind: 'slider', name: nameOf(el), depth: 0, object: null, item: null, id: null, parent: null, children: [], link: null, fromScript: false };
    if (id && !this.entryById.has(id)) {
      entry.id = id;
      this.entryById.set(id, entry);
    }
    this.entries.push(entry);
    const min = num(el, 'min', 0);
    let max = num(el, 'max', 1);
    if (!(max > min)) max = min + 1;
    const step = num(el, 'step', (max - min) / 100, Number.MIN_VALUE);
    const value = Math.min(max, Math.max(min, num(el, 'value', min)));
    const box = document.createElement('label');
    box.className = 'holoml-slider';
    box.dataset['testid'] = 'holoml-slider';
    if (entry.id) box.dataset['id'] = entry.id;
    const words = document.createElement('span');
    words.textContent = text(el);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    box.append(words, input);
    mark(words, this.languageOf(el));
    this.corner(el).append(box);
    entry.hud = box;
    entry.slider = { input, label: words };
    input.addEventListener('input', () => this.emit({ type: 'change', entry, value: Number(input.value) }));
    return entry;
  }

  /** A slider's value, range, and steps (for scripts). */
  sliderValue(entry: Entry): number | undefined {
    return entry.slider ? Number(entry.slider.input.value) : undefined;
  }

  sliderRange(entry: Entry): { min: number; max: number; step: number } | undefined {
    const i = entry.slider?.input;
    return i ? { min: Number(i.min), max: Number(i.max), step: Number(i.step) } : undefined;
  }

  /** Moves a slider (kept to its range and steps), without a change event. */
  setSliderValue(entry: Entry, value: number): void {
    if (entry.slider) entry.slider.input.value = String(value);
  }

  /**
   * A choice (HoloML 0.2, milestone 18): options in a corner of the
   * screen, as the page's own group of radio buttons, so the mouse,
   * touch, the keyboard (the arrow keys), and screen readers use it as on
   * any web page. Picking an option changes the named material of the
   * target model in place; either way, it tells the page's scripts
   * (`change`). Every option's pictures load with the page, so a pick
   * shows at once.
   */
  private choice(el: ElementNode): Entry {
    const id = attr(el, 'id') ?? null;
    const entry: Entry = { el, kind: 'choice', name: nameOf(el), depth: 0, object: null, item: null, id: null, parent: null, children: [], link: null, fromScript: false };
    if (id && !this.entryById.has(id)) {
      entry.id = id;
      this.entryById.set(id, entry);
    }
    this.entries.push(entry);
    this.choices.push(entry);
    // Its options count against the page's limit on elements too.
    this.elementCount += countElements(el);
    const target = trimSpace(attr(el, 'target') ?? '');
    const material = attr(el, 'material') ?? null;
    const changes = target.startsWith('#') && material !== null;
    const options: ChoiceOption[] = [];
    for (const o of el.children) {
      if (o.type !== 'element' || o.name !== 'option') continue;
      const label = text(o);
      const value = attr(o, 'value') ?? label;
      // Two options with one value: the checker reports it, and the first is kept.
      if (options.some((x) => x.value === value)) continue;
      options.push({ value, label: label || value, look: changes ? this.lookOf(o) : null, made: new Map(), language: this.languageOf(o) });
    }
    const box = document.createElement('fieldset');
    box.className = 'holoml-choice';
    box.dataset['testid'] = 'holoml-choice';
    if (entry.id) box.dataset['id'] = entry.id;
    const legend = document.createElement('legend');
    legend.textContent = collapse(attr(el, 'label') ?? '');
    mark(legend, this.languageOf(el));
    legend.hidden = legend.textContent === '';
    if (legend.hidden) box.setAttribute('aria-label', entry.id ?? 'Choice');
    const list = document.createElement('div');
    list.className = 'holoml-options';
    const group = `holoml-choice-${this.choices.length}`;
    const start = Math.max(0, options.findIndex((o) => o.value === attr(el, 'value')));
    const inputs = options.map((o, i) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = group;
      input.value = o.value;
      input.checked = i === start;
      const words = document.createElement('span');
      words.textContent = o.label;
      mark(words, o.language);
      label.append(input, words);
      list.append(label);
      input.addEventListener('change', () => {
        if (input.checked) this.pick(entry, i, true);
      });
      return input;
    });
    box.append(legend, list);
    this.corner(el).append(box);
    entry.hud = box;
    entry.choice = { options, inputs, legend, chosen: start, target: changes ? target.slice(1) : null, material: changes ? material : null };
    return entry;
  }

  /** Picks an option: the viewer did (tell the scripts), or a script did (no event). */
  private pick(entry: Entry, index: number, byViewer: boolean): void {
    const c = entry.choice;
    if (!c || !c.options[index]) return;
    const changed = index !== c.chosen;
    c.chosen = index;
    c.inputs[index]!.checked = true;
    if (!changed) return;
    void this.applyChoice(entry);
    if (byViewer) this.emit({ type: 'change', entry, value: c.options[index]!.value });
  }

  /**
   * Puts a choice's chosen option on its model's material, once the model
   * and the option's pictures are there. Each option starts from the
   * material's own look (the page's, before any option) and changes only
   * what it gives; the material it makes is kept for the next time.
   */
  private async applyChoice(entry: Entry): Promise<void> {
    const c = entry.choice;
    if (!c?.target || !c.material) return;
    const option = c.options[c.chosen];
    const look = await option?.look;
    // Picked again meanwhile, or gone: the later pick applies its own.
    if (!option || !look || c.options[c.chosen] !== option || entry.removed) return;
    const model = this.entryById.get(c.target);
    const holder = model?.kind === 'model' && !model.removed ? model.object : null;
    if (!model || !holder?.userData['copy']) return;
    let found = false;
    holder.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const now = Array.isArray(o.material) ? o.material : [o.material];
      // The materials it had before any option: each option starts from these.
      let own = this.ownMaterials.get(o);
      if (!own) {
        own = [...now];
        this.ownMaterials.set(o, own);
      }
      const next = own.map((base, i) => {
        if (base.name !== c.material || !changeable(base)) return now[i]!;
        found = true;
        let made = option.made.get(base);
        if (!made) {
          made = base.clone();
          this.applyLook(made, look);
          option.made.set(base, made);
        }
        return made;
      });
      o.material = Array.isArray(o.material) ? next : next[0]!;
    });
    if (!found && !c.warned) {
      c.warned = true;
      console.warn(`HoloML: the choice "${entry.name}" changes the material "${c.material}", which the model "${model.name}" does not have.`);
    }
    if (model.report) this.materialsOf(holder, model.report);
    this.waterDirty = true;
    this.shadersWanted = true;
    this.requestFrame();
  }

  /** A choice's chosen value and its options' values (for scripts). */
  choiceValue(entry: Entry): string | undefined {
    const c = entry.choice;
    return c ? c.options[c.chosen]?.value : undefined;
  }

  choiceOptions(entry: Entry): string[] | undefined {
    return entry.choice?.options.map((o) => o.value);
  }

  /** Picks the option with a value, as the viewer would, but without a change event; false when no option has it. */
  setChoiceValue(entry: Entry, value: string): boolean {
    const i = entry.choice?.options.findIndex((o) => o.value === value) ?? -1;
    if (i < 0) return false;
    this.pick(entry, i, false);
    return true;
  }

  private setHudText(entry: Entry, value: string): void {
    const lines = value
      .split(/\r\n|\r|\n/)
      .map(collapse)
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
  private sound(el: ElementNode, entry: Entry, parent: Object3D): void {
    const src = attr(el, 'src') ?? '';
    const report: SoundReport = { id: entry.id, src, state: 'loading', playing: false, plays: 0 };
    entry.soundReport = report;
    // A sound that begins on a click does not also play by itself (the checker reports both together).
    const autoplay = has(el, 'autoplay') && attr(el, 'begin') !== 'click';
    const handle = this.sounds.add(report, { loop: has(el, 'loop'), autoplay, volume: num(el, 'volume', 1, 0, 1) });
    entry.sound = handle;
    // A sound from a place (milestone 21): it sits in its parent, so it moves with a group.
    if (has(el, 'position')) this.placeSound(entry, parent, vec3(el, 'position', [0, 0, 0]), num(el, 'range', 20, Number.MIN_VALUE));
    void this.guarded(
      src,
      "sounds load only from the page's own site",
      async (url) => {
        const { data, bytes, claim } = await this.budget.file(url, this.origin);
        report.bytes = bytes;
        // The sound holds its file's share of the page's totals from here on, and gives it back when it is
        // removed or cannot be played (at once, if it was removed while its file was on the way).
        handle.arrive(data, claim);
      },
      (how, reason) => {
        handle.fail(how, reason);
        console.warn(`HoloML: the sound "${src}" was not loaded: ${reason}.`);
        this.onLeftOut?.();
      },
    );
  }

  /** Puts a sound at a place in its parent (milestone 21): a marker it is heard from, as the viewer moves and as its group moves. */
  private placeSound(entry: Entry, parent: Object3D, at: Vec3, range: number): void {
    let marker = entry.object;
    if (!marker) {
      marker = new Object3D();
      marker.name = 'sound';
      parent.add(marker);
      this.setObject(entry, marker);
    }
    marker.position.set(...at);
    const world = new Vector3();
    const where = (): Vec3 => {
      marker.getWorldPosition(world);
      return [world.x, world.y, world.z];
    };
    entry.sound?.place(where, range);
    this.requestFrame();
  }

  /** A sound's place in its parent (a script's `position`), or null for a sound from everywhere. */
  soundPosition(entry: Entry): Vec3 | null {
    const p = entry.kind === 'sound' ? entry.object?.position : undefined;
    return p ? [p.x, p.y, p.z] : null;
  }

  /** A script gives a sound a place: from there on it comes from that place (its range as the page gave it, or 20 metres). */
  setSoundPosition(entry: Entry, at: Vec3 | null): void {
    if (entry.kind !== 'sound' || entry.removed) return;
    if (at === null) {
      // HoloML 0.3: its place taken away, it is heard as a sound from everywhere again.
      const marker = entry.object;
      if (marker) {
        marker.removeFromParent();
        this.entryOfObject.delete(marker);
        entry.object = null;
      }
      entry.sound?.place(null, num(entry.el, 'range', 20, Number.MIN_VALUE));
      this.requestFrame();
      return;
    }
    const parent = entry.parent?.object ?? this.scene;
    this.placeSound(entry, parent, at, num(entry.el, 'range', 20, Number.MIN_VALUE));
  }

  // ---- HoloML 0.3 in the scene API (milestone 25) -----------------------------------

  /** Starts an animate from its beginning, as when it begins by itself; with reduced motion it shows its end at once. */
  startAnimation(entry: Entry): void {
    const a = entry.animation;
    if (!a || entry.removed) return;
    a.halted = undefined;
    a.clickedAt = performance.now();
    if (a.toggle) {
      a.at = 0;
      a.way = 1;
    }
    this.requestFrame();
  }

  /** Stops an animate where it is; it keeps that place until started or clicked again. */
  stopAnimation(entry: Entry): void {
    const a = entry.animation;
    if (!a || entry.removed || a.halted !== undefined) return;
    const p = this.progress(a, performance.now());
    if (p) a.halted = p.t;
  }

  /** Whether an animate runs now. */
  animationRunning(entry: Entry): boolean {
    const a = entry.animation;
    if (!a || entry.removed || a.halted !== undefined) return false;
    const p = this.progress(a, performance.now());
    return p !== null && !p.done;
  }

  /** The water's colour and clarity, for scripts. */
  waterLook(entry: Entry): { color: string; clarity: number } | undefined {
    return entry.kind === 'water' && this.water ? { color: this.water.look.color, clarity: this.water.look.clarity } : undefined;
  }

  setWaterColor(entry: Entry, value: string): void {
    if (entry.kind !== 'water' || !this.water) return;
    this.water.setColor(value);
    this.requestFrame();
  }

  setWaterClarity(entry: Entry, value: number): void {
    if (entry.kind !== 'water' || !this.water) return;
    this.water.setClarity(value);
    this.requestFrame();
  }

  /** Whether the floor plan is shown, as a script sees it (it may still be loading). */
  planVisible(entry: Entry): boolean | undefined {
    return entry.kind === 'plan' && this.planState ? this.planState.hiddenByScript !== true : undefined;
  }

  setPlanVisible(entry: Entry, on: boolean): void {
    const plan = this.planState;
    if (entry.kind !== 'plan' || !plan) return;
    plan.hiddenByScript = !on;
    plan.box.hidden = !on || plan.state !== 'loaded';
  }

  /** A model's or a group's own name (its label), or null for none. */
  labelOf(entry: Entry): string | null | undefined {
    if (entry.kind !== 'model' && entry.kind !== 'group') return undefined;
    if (entry.ownLabel !== undefined) return entry.ownLabel;
    return collapse(attr(entry.el, 'label') ?? '') || null;
  }

  /** A script names a model or a group: screen readers and the text view hear the new name. */
  setLabel(entry: Entry, value: string | null): void {
    if ((entry.kind !== 'model' && entry.kind !== 'group') || entry.removed) return;
    entry.ownLabel = value === null ? null : collapse(value) || null;
    entry.name = entry.ownLabel ?? (entry.id || nameOf(entry.el));
    if (entry.item) this.nameItem(entry.item, entry);
    // A group without an id is in the outline by its name only.
    else if (entry.kind === 'group' && entry.ownLabel && !entry.link) entry.item = this.addItem(entry, 'Group');
  }

  /** The place the viewer last arrived at (HoloML 0.3 `viewer.place`). */
  get viewerPlace(): string | null {
    return this.currentPlace;
  }

  /** Takes the viewer to a place by its id, as a link to #id does; false when no viewpoint has the id. */
  goToPlace(id: string): boolean {
    const vp = this.viewpoints.find((v) => attr(v, 'id') === id);
    if (!vp) return false;
    // Through the page's address where places are listed, so that Back returns.
    if (this.placesListed) this.visit(id);
    else this.goTo(vp);
    return true;
  }

  /** How loud a sound from a place is in each of the viewer's ears now (the page's hooks), by its id. */
  soundLevels(id: string): { left: number; right: number } | null {
    return this.entryById.get(id)?.sound?.levels() ?? null;
  }

  /** How fast a model's own animation plays (milestone 21): 1 as made, 0 held still. */
  animationSpeedOf(entry: Entry): number {
    return entry.animationSpeed ?? 1;
  }

  setAnimationSpeed(entry: Entry, speed: number): void {
    if (entry.kind !== 'model' || entry.removed) return;
    entry.animationSpeed = speed;
    if (entry.held?.mixer) entry.held.mixer.timeScale = speed;
    if (entry.far?.mixer) entry.far.mixer.timeScale = speed;
    this.requestFrame();
  }

  /**
   * The page's water (HoloML 0.2 `water`, milestone 21). Its moving light
   * is left out where Chromium draws in software, as shadows are: it would
   * take much of every frame there, and the console says so.
   */
  private makeWater(el: ElementNode): void {
    // HoloML 0.3: a thing scripts find by its id, to change its colour and clarity.
    const id = this.since('0.3') ? (attr(el, 'id') ?? null) : null;
    const entry: Entry = { el, kind: 'water', name: id ?? 'water', depth: 0, object: null, item: null, id: null, parent: null, children: [], link: null, fromScript: false };
    if (id && !this.entryById.has(id)) {
      entry.id = id;
      this.entryById.set(id, entry);
    }
    this.entries.push(entry);
    const size = vec3(el, 'size', [1, 1, 1]);
    const caustics = has(el, 'caustics');
    if (caustics && this.software !== null) {
      this.causticsLeftOut = `this computer draws 3D in software (${this.software})`;
      console.warn("HoloML: the water's moving light was left out: this computer draws 3D in software, without a graphics card.");
    } else if (caustics && this.lighter) {
      this.causticsLeftOut = 'the scene is drawn lighter on this device';
      console.warn("HoloML: the water's moving light was left out: the scene is drawn lighter on this device.");
    }
    this.water = new Water(
      {
        position: vec3(el, 'position', [0, 0, 0]),
        size: size.every((n) => n > 0) ? size : [1, 1, 1],
        color: color(el, 'color') ?? '#1f6f8b',
        clarity: num(el, 'clarity', 15, Number.MIN_VALUE),
        caustics,
      },
      !this.reduced,
    );
    this.waterDirty = true;
    this.shadersWanted = true;
  }

  /** The page's water, for the tests and the inspector: its box, its look, and its moving light. */
  get waterInfo(): { min: Vec3; max: Vec3; color: string; clarity: number; caustics: boolean; causticsShown: boolean; causticsLeftOut: string | null; causticsTime: number } | null {
    const w = this.water;
    if (!w) return null;
    return { min: w.min, max: w.max, color: w.look.color, clarity: w.look.clarity, caustics: w.look.caustics, causticsShown: w.causticsShown, causticsLeftOut: this.causticsLeftOut, causticsTime: w.causticsTime };
  }

  /** How much a point has faded into the water's colour, seen from where the viewer is now (0 without water). */
  waterFadeAt(point: Vec3): number {
    const c = this.camera.position;
    return this.water ? this.water.fadeAt([c.x, c.y, c.z], point) : 0;
  }

  /** How bright the water's moving light is: it follows the page's lights that shine from a place (the sun, lamps). */
  private waterLight(): number {
    let sum = 0;
    this.scene.traverseVisible((o) => {
      if (o instanceof DirectionalLight || o instanceof SpotLight || o instanceof PointLight) sum += o.intensity;
    });
    return Math.min(1.2, 0.25 * sum);
  }

  private addLink(href: string, object: Object3D, el: ElementNode): HTMLElement {
    const anchor = document.createElement('a');
    anchor.href = href;
    const words: string[] = [];
    const collect = (n: HoloNode) => {
      if (n.type !== 'element') return;
      if (n.name === 'label') words.push(text(n));
      // A panel's first paragraph (HoloML 0.2).
      if (n.name === 'panel' && this.since('0.2')) words.push(paragraphs(rawText(n))[0] ?? '');
      n.children.forEach(collect);
    };
    collect(el);
    anchor.textContent = words.join(' ') || `Link to ${href}`;
    if (words.length > 0) mark(anchor, this.languageOf(el));
    const link: Link = { href, object, anchor };
    // Keyboard: Tab reaches each link, which lights up in the scene; Enter follows it.
    anchor.addEventListener('focus', () => this.setHovered(link));
    anchor.addEventListener('blur', () => this.setHovered(null));
    // To another HoloML page of the same site: through the fade, as a click in the scene is.
    anchor.addEventListener('click', (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || !this.fadesTo(href)) return;
      e.preventDefault();
      this.follow(href);
    });
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
    button.dataset['kind'] = kind;
    this.nameItem(button, entry);
    button.addEventListener('focus', () => this.outlineObject(entry.object));
    button.addEventListener('blur', () => this.outlineObject(null));
    li.append(button);
    this.outline.append(li);
    return button;
  }

  /**
   * An outline item's words: the kind in the browser's words ("Model: "),
   * then the thing's name in the page's, with its language and direction
   * (HoloML 0.3), so that a screen reader reads each in its own voice.
   */
  private nameItem(button: HTMLElement, entry: Entry): void {
    const name = document.createElement('span');
    name.textContent = entry.name;
    mark(name, this.languageOf(entry.el));
    button.replaceChildren(`${button.dataset['kind'] ?? entry.kind}: `, name);
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
    const v02 = this.since('0.2');
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
      start = rgbOf(this.background);
    } else return;
    // HoloML 0.2 (milestone 19): a click action waits for its trigger (by default its target).
    const onClick = v02 && attr(el, 'begin') === 'click';
    const toggle = onClick && has(el, 'toggle');
    const animation: Animation = { entry, object, attribute, from, to, duration: ms, repeat: toggle ? 1 : repeat(el), start, onClick, toggle, clickedAt: null, at: 0, way: 1 };
    this.animations.push(animation);
    const self = this.animateEntries.get(el);
    if (self) self.animation = animation;
    if (onClick) this.pendingActions.push({ trigger: idOf(attr(el, 'trigger') ?? attr(el, 'target')), animation, label: attr(el, 'label') ?? null, language: this.languageOf(el) });
  }

  // ---- Click actions (HoloML 0.2, milestone 19) ----------------------------------

  /**
   * Each animation and sound that begins on a click joins its trigger, a
   * thing that can be clicked, and each new trigger gets its button in
   * the outline: in place of the trigger's own item, or after a panel's,
   * whose words stay. (The checker has reported triggers that cannot be
   * clicked; their actions never run.)
   */
  private wireActions(): void {
    const touched = new Set<Trigger>();
    for (const p of this.pendingActions.splice(0)) {
      const entry = this.entryById.get(p.trigger);
      if (!entry || entry.removed || !entry.object || !CLICKABLE.includes(entry.kind)) continue;
      let t = this.triggers.get(entry);
      if (!t) {
        t = { entry, object: entry.object, animations: [], sounds: [], label: '', button: null };
        this.triggers.set(entry, t);
      }
      if (p.animation) t.animations.push(p.animation);
      if (p.sound) t.sounds.push(p.sound);
      const label = collapse(p.label ?? '');
      if (!t.label && label) {
        t.label = label;
        t.language = p.language;
      }
      touched.add(t);
    }
    for (const t of touched) {
      if (!t.button) this.addActionButton(t);
      this.nameActionButton(t);
    }
  }

  /** A trigger's button in the outline: Tab reaches it (the trigger lights up in the scene), and Enter or Space runs its actions. */
  private addActionButton(t: Trigger): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'holoml-action';
    button.addEventListener('focus', () => this.outlineObject(t.object));
    button.addEventListener('blur', () => this.outlineObject(null));
    button.addEventListener('click', () => {
      if (t.entry.removed) return;
      this.runTrigger(t);
      // Scripts hear it as a click on the trigger, with no point (it came from the keyboard or the outline).
      if (this.listeners.click.size > 0) this.emit({ type: 'click', hit: { entry: t.entry, point: null, normal: null }, button: 'left' });
    });
    t.button = button;
    const item = t.entry.item;
    if (item && t.entry.kind !== 'panel') {
      item.replaceWith(button);
      t.entry.item = button;
      return;
    }
    const li = document.createElement('li');
    li.className = 'holoml-action-item';
    li.append(button);
    if (item?.parentElement) item.parentElement.after(li);
    else this.outline.append(li);
  }

  /** Names a trigger's button by its actions' label (or the trigger's name); a toggle's says whether it is on. */
  private nameActionButton(t: Trigger): void {
    if (!t.button) return;
    t.button.textContent = t.label || t.entry.name;
    mark(t.button, t.label ? t.language : this.languageOf(t.entry.el));
    const toggle = t.animations.find((a) => a.toggle);
    if (toggle) t.button.setAttribute('aria-pressed', String(toggle.clickedAt !== null && toggle.way === 1));
    else t.button.removeAttribute('aria-pressed');
  }

  /** The trigger under a point of the page: the innermost thing hit, or the nearest of what holds it, that has click actions. */
  private triggerAt(x: number, y: number): Trigger | null {
    if (this.triggers.size === 0) return null;
    const hit = this.hitAt(this.ndc(x, y));
    for (let e: Entry | null = hit?.entry ?? null; e; e = e.parent) {
      const t = this.triggers.get(e);
      if (t && !e.removed) return t;
    }
    return null;
  }

  /** A trigger was clicked, or its button pressed: its animations run (a toggle the other way, from where it is), and its sounds play. */
  private runTrigger(t: Trigger): void {
    const now = performance.now();
    for (const a of t.animations) {
      if (a.entry?.removed) continue;
      a.halted = undefined;
      if (a.toggle) {
        a.at = this.toggleAt(a, now);
        a.way = a.clickedAt === null ? 1 : a.way === 1 ? -1 : 1;
      }
      a.clickedAt = now;
    }
    for (const s of t.sounds) if (!s.removed) s.sound?.play();
    this.nameActionButton(t);
    this.requestFrame();
  }

  /** Where a toggle is now: 0 at `from`, 1 at `to`; with reduced motion, at the end it runs to. */
  private toggleAt(a: Animation, now: number): number {
    if (a.clickedAt === null) return 0;
    if (this.reducedMotion.matches) return a.way === 1 ? 1 : 0;
    return Math.min(1, Math.max(0, a.at + (a.way * (now - a.clickedAt)) / a.duration));
  }

  /** Where an animation is now (0 at from, 1 at to) and whether it has finished; null for a click action not yet clicked. */
  private progress(a: Animation, now: number): { t: number; done: boolean } | null {
    if (a.halted !== undefined) return { t: a.halted, done: true };
    if (a.toggle) {
      if (a.clickedAt === null) return null;
      const t = this.toggleAt(a, now);
      return { t, done: t === (a.way === 1 ? 1 : 0) };
    }
    if (a.onClick && a.clickedAt === null) return null;
    const runs = (now - (a.clickedAt ?? this.started)) / a.duration;
    // With reduced motion, every animation shows its end at once (issue #25).
    const done = this.reducedMotion.matches || runs >= a.repeat;
    return { t: done ? 1 : runs - Math.floor(runs), done };
  }

  // ---- Places and fades (HoloML 0.2, milestone 19) ---------------------------------

  /** The viewpoint an address names (#name), in a 0.2 page with several; null for none, or a name the page does not have. */
  private placeNamed(name: string | null): ElementNode | null {
    if (!this.placesListed || !name) return null;
    return this.viewpoints.find((v) => attr(v, 'id') === name) ?? null;
  }

  /** "Go to" a place, in the outline. */
  private addPlace(entry: Entry, vp: ElementNode): HTMLElement {
    const li = document.createElement('li');
    li.className = 'holoml-place';
    const button = document.createElement('button');
    button.type = 'button';
    const name = document.createElement('span');
    name.textContent = placeName(vp);
    mark(name, this.languageOf(vp));
    button.replaceChildren('Go to: ', name);
    button.addEventListener('click', () => this.visit(entry.id!));
    li.append(button);
    this.outline.append(li);
    return button;
  }

  /** Goes to a place through the page's address, so that Back returns and the address names where the viewer is. */
  private visit(id: string): void {
    const vp = this.placeNamed(id);
    if (!vp) return;
    if (addressName() === id) this.goTo(vp);
    else location.hash = id;
  }

  /** Goes to a place: a short fade out and in, or a cut with reduced motion. */
  private goTo(vp: ElementNode): void {
    const id = attr(vp, 'id') ?? null;
    const position = vec3(vp, 'position', [0, 1.6, 5]);
    const lookAt = vec3(vp, 'look-at', [0, 1, 0]);
    const go = () => {
      this.controls?.moveTo(position);
      this.controls?.lookAt(lookAt);
      this.currentPlace = id;
      // HoloML 0.3: the page's scripts hear where the viewer arrived.
      if (id && this.since('0.3')) this.emit({ type: 'place', place: id });
      this.requestFrame();
    };
    if (this.reducedMotion.matches) {
      go();
      return;
    }
    void this.setFade(1, PLACE_FADE_MS).then(() => {
      go();
      return this.setFade(0, PLACE_FADE_MS);
    });
  }

  /** Darkens or clears the page over some milliseconds; resolves when done. */
  private setFade(to: number, ms: number): Promise<void> {
    this.fadeLog.push({ to, at: performance.now() });
    this.fadeLevel = to;
    this.fadeUntil = performance.now() + ms;
    const f = this.fader;
    f.style.transition = ms > 0 ? `opacity ${ms}ms ease` : 'none';
    // Read back, so a new transition applies before the new opacity.
    void f.offsetWidth;
    f.style.opacity = String(to);
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  /** Whether following a link fades: to another HoloML page of the same site, from a 0.2 page, without reduced motion. */
  private fadesTo(href: string): boolean {
    if (!this.since('0.2') || this.reducedMotion.matches) return false;
    try {
      const to = new URL(href);
      return to.origin === location.origin && isHolomlPage(to) && !sameDocument(to, new URL(location.href));
    } catch {
      return false;
    }
  }

  /** Follows a link: to another HoloML page of the same site through a fade, else at once. */
  private follow(href: string): void {
    if (!this.fadesTo(href)) {
      location.assign(href);
      return;
    }
    void this.setFade(1, FADE_OUT_MS).then(() => {
      location.assign(href);
      // Still here a while later (the page did not go): clear again.
      window.setTimeout(() => void this.setFade(0, FADE_IN_MS), 5000);
    });
  }

  /** The page arrived through a fade: once its scene is drawn (or after a while), it fades in. */
  private arrive(): void {
    if (!this.arriving) return;
    this.arriving = false;
    // Drawn once more when clear, so the tab's card shows the scene.
    void this.setFade(0, FADE_IN_MS).then(() => this.requestFrame());
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
    const v02 = this.since('0.2');
    if (v02 && viewpoint && has(viewpoint, 'crosshair')) this.crosshair.hidden = false;
    if (mode === 'walk' && v02) {
      // HoloML 0.2: walls, gravity if the page asks for it, and its speeds (milestone 18).
      this.walker = new Walker(position, has(viewpoint!, 'gravity'), has(viewpoint!, 'jump'));
      const speeds = { walk: num(viewpoint!, 'speed', WALK_SPEED, 0.5, 10), turn: num(viewpoint!, 'turn-speed', TURN_SPEED, 10, 720) };
      this.controls = walkControls(this.camera, canvas, lookAt, changed, { walker: this.walker, solids: () => this.solids() }, speeds);
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
      // What a script has hidden (`visible = false`) stops no one, as it cannot be clicked (review 134, V10).
      if (e.kind !== 'model' || e.removed || !e.object || !isShown(e.object) || !this.isSolid(e) || !this.modelBox(e, b)) continue;
      boxes.push({ min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] });
    }
    this.grid = new SolidGrid(boxes);
    this.collidersDirty = false;
    return this.grid;
  }

  /**
   * The box a model takes up in the world: its own once it has loaded, or
   * its stand-in's while that stands in (milestone 20); false when neither
   * is there.
   */
  private modelBox(e: Entry, b: Box3): boolean {
    const o = e.object;
    const s = e.standIn;
    if (o && e.template && e.report?.state === 'loaded') {
      if (o.userData['pool']) worldBox(e.template, o, b);
      else b.setFromObject((o.userData['copy'] as Object3D | undefined) ?? o);
    } else if (e.far?.template && e.far.holder.visible) {
      if (e.far.holder.userData['pool']) worldBox(e.far.template, e.far.holder, b);
      else b.setFromObject(e.far.holder);
    } else if (s?.template && s.holder.visible) {
      if (s.holder.userData['pool']) worldBox(s.template, s.holder, b);
      else b.setFromObject(s.holder);
    } else return false;
    return !b.isEmpty();
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

  /**
   * The things under a point of the view, nearest first, as their own
   * objects (an instance as its holder). What is not shown is not there:
   * a thing a script has hidden (`visible = false`), or that is inside a
   * hidden group, takes no click, hover, link, or trigger, whether it is
   * drawn as an instance or as its own copy (review 134, V10).
   */
  private hits(ndc: Vector2): { hit: Intersection; object: Object3D }[] {
    this.raycaster.setFromCamera(ndc, this.camera);
    const out: { hit: Intersection; object: Object3D }[] = [];
    for (const hit of this.raycaster.intersectObjects(this.scene.children, true)) {
      if (hit.object === this.highlight) continue;
      const pool = hit.object.userData['pool'] as InstancePool | undefined;
      const object = hit.object instanceof InstancedMesh && pool && hit.instanceId !== undefined ? pool.slots[hit.instanceId] : hit.object;
      if (object && isShown(object)) out.push({ hit, object });
    }
    return out;
  }

  /** The link under a point of the page: only if the first thing hit there is in one (a link behind something else is not under the pointer). */
  private linkAt(x: number, y: number): Link | null {
    const first = this.hits(this.ndc(x, y))[0];
    if (!first) return null;
    let o: Object3D | null = first.object;
    while (o && o.userData['link'] === undefined) o = o.parent;
    const href = o?.userData['link'] as string | undefined;
    return href ? (this.links.find((l) => l.href === href && isInside(first.object, l.object)) ?? null) : null;
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

  /** A link, or a click action's trigger (milestone 19), under the pointer or in focus: outlined, with the hand pointer. */
  private setHovered(hover: Hover | null): void {
    if (this.hovered === hover) return;
    this.hovered = hover;
    this.renderer.domElement.style.cursor = hover ? 'pointer' : '';
    if (hover) {
      this.highlight.box.copy(this.boxOf(hover.object)).expandByScalar(0.05);
      this.highlight.visible = true;
    } else this.highlight.visible = false;
    this.requestFrame();
  }

  private wirePointer(): void {
    const canvas = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    /**
     * A finger held still is a right-click (milestone 24): it reaches the
     * page's scripts as one once it has been held long enough, while it is
     * still down, since Android may cancel a touch held that long before
     * it lifts; and the touch then follows no link.
     */
    let press: number | undefined;
    let pressed = false;
    const stopPress = () => window.clearTimeout(press);
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons === 0) this.setHovered(this.linkAt(e.clientX, e.clientY) ?? this.triggerAt(e.clientX, e.clientY));
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) stopPress();
    });
    canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
      pressed = false;
      stopPress();
      if (e.pointerType !== 'touch') return;
      const { clientX: x, clientY: y } = e;
      press = window.setTimeout(() => {
        pressed = true;
        if (this.listeners.click.size === 0) return;
        this.scene.updateMatrixWorld();
        for (const pool of this.pools.values()) pool.sync();
        const hit = this.hitAt(this.ndc(x, y)) ?? { entry: null, point: null, normal: null };
        this.emit({ type: 'click', hit, button: 'right' });
      }, LONG_PRESS_MS);
    });
    canvas.addEventListener('pointercancel', () => {
      stopPress();
      down = null;
    });
    canvas.addEventListener('pointerup', (e) => {
      stopPress();
      const start = down;
      down = null;
      if (pressed) {
        pressed = false;
        return;
      }
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
      // A click action's trigger (HoloML 0.2): a click or tap runs its actions.
      const trigger = e.button === 0 ? this.triggerAt(e.clientX, e.clientY) : null;
      if (trigger) this.runTrigger(trigger);
      const link = this.linkAt(e.clientX, e.clientY);
      if (!link) return;
      if (e.button === 1 || e.ctrlKey || e.metaKey) window.open(link.href, '_blank');
      else if (e.button === 0) this.follow(link.href);
    });
    canvas.addEventListener('auxclick', (e) => e.preventDefault());
    // While a script listens for clicks, a right-click is the page's, not the browser's menu.
    canvas.addEventListener('contextmenu', (e) => {
      // A long press on a touch screen is a right-click for the page, not the system's menu (milestone 24).
      if (this.listeners.click.size > 0 || touchScreen()) e.preventDefault();
    });
  }

  private wireKeys(): void {
    const send = (e: KeyboardEvent, down: boolean) => {
      if (this.listeners.key.size === 0 || e.ctrlKey || e.metaKey || e.altKey) return;
      // A slider keeps its own keys while it has the keyboard; others still reach scripts.
      if (keptByControl(e)) return;
      this.emit({ type: 'key', key: e.key, down, repeat: e.repeat });
    };
    window.addEventListener('keydown', (e) => send(e, true));
    window.addEventListener('keyup', (e) => send(e, false));
  }

  // ---- Scripts (api.ts) -------------------------------------------------------

  /** Calls a script's listener for a kind of event; returns a function that stops it. */
  listen(type: SceneEvent['type'], listener: (e: SceneEvent) => void): () => void {
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

  get pageVersion(): Version {
    return this.version;
  }

  /**
   * Adds elements written in HoloML to the scene, or into a group
   * (holoml.add). They are checked like the page; an element with a
   * problem is left out, and the console says why.
   */
  addMarkup(markup: string, parent: Entry | null): Entry[] {
    const wrapped = `<holoml version="${this.version}"><scene>\n${markup}\n</scene></holoml>`;
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
    // HoloML 0.3 (milestone 25): animations, panels, and links too, and what they hold may have click actions.
    const addable = this.since('0.3') ? ['group', 'model', 'light', 'label', 'sound', 'animate', 'panel', 'a'] : ['group', 'model', 'light', 'label', 'sound'];
    // The new elements' language and direction, as if they stood where they are added.
    if (this.since('0.3')) {
      const around = (parent ? this.langs.get(parent.el) : this.sceneLanguage) ?? UNSTATED;
      for (const node of tops) this.learnLanguages(node, around);
    }
    tops.forEach((node, i) => {
      const next = tops[i + 1];
      if (!addable.includes(node.name)) {
        console.warn(`HoloML: holoml.add adds ${this.since('0.3') ? 'groups, models, lights, labels, sounds, animations, panels, and links' : 'groups, models, lights, labels, and sounds'}, not <${node.name}>.`);
        return;
      }
      const own = problems.filter((p) => after(p, node.start) && (!next || !after(p, next.start)));
      if (own.length > 0) {
        for (const p of own) console.warn(`HoloML: holoml.add: line ${p.line - 1}, column ${p.column}: ${p.message}; <${node.name}> left out.`);
        return;
      }
      // A sound that begins on a click is left out (build says why); anything else that is not built is past the page's limit.
      const full = leftOutOfAdd(node) === null;
      const entry = this.build(node, into, parent, parent?.link ?? null, (parent?.depth ?? -1) + 1, true, animates);
      if (entry) added.push(entry);
      else if (full) console.warn(`HoloML: holoml.add: <${node.name}> left out: past the page's limit of ${LIMITS.elements.toLocaleString('en')} elements.`);
    });
    // HoloML 0.3: the animations and click actions it added, once every element it added is in the scene. One whose
    // target or trigger is not there is left out, and the console says why.
    for (const a of animates) {
      const target = idOf(attr(a, 'target'));
      if (!this.entryById.has(target) && target !== this.sceneId) {
        console.warn(`HoloML: holoml.add: <animate> left out: no element has the id "${target}".`);
        continue;
      }
      this.addAnimation(a);
    }
    const waiting = this.pendingActions.filter((p) => !this.entryById.has(p.trigger));
    for (const p of waiting) console.warn(`HoloML: holoml.add: a click action left out: no element has the id "${p.trigger}".`);
    this.wireActions();
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
        if (e.kind === 'panel') {
          e.panelLook?.note.remove();
          e.panelLook?.words?.remove();
          disposePanel(o);
        }
        if (e.kind === 'light') this.removeLight(o);
      }
      // A trigger's button goes with it (in its own item, or after a panel's).
      const trigger = this.triggers.get(e);
      if (trigger) {
        if (trigger.button && trigger.button !== e.item) trigger.button.closest('li')?.remove();
        this.triggers.delete(e);
      }
      if (e.item) this.removeItem(e);
      e.sound?.remove();
      e.hud?.remove();
      if (e.choice) this.choices.splice(this.choices.indexOf(e), 1);
      if (e.kind === 'model' && this.castsShadows(e)) this.shadowBox = null;
      if (e.report) {
        const i = this.models.indexOf(e.report);
        if (i >= 0) this.models.splice(i, 1);
      }
      if (e.kind === 'model') {
        // Its triangles and what it held no longer count; its file stays loaded for the next (milestone 20).
        this.unload(e, false);
        this.removeStandIn(e);
        if (e.far) {
          this.releaseFar(e, false);
          const i = this.models.indexOf(e.far.report);
          if (i >= 0) this.models.splice(i, 1);
          this.fars.splice(this.fars.indexOf(e), 1);
          e.far = undefined;
        }
      }
      if (e.area) this.areas.splice(this.areas.indexOf(e.area), 1);
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
    // A group that loads by area may have all its models in now.
    if (this.areas.length > 0) this.tellAreas();
    this.requestFrame();
  }

  /**
   * A light removed from the scene: the picture its shadows were drawn
   * into is released on the graphics card, the point it aimed at goes with
   * it, and it no longer counts towards the page's lights (review 134, V10).
   */
  private removeLight(o: Object3D): void {
    const light = o as Object3D & { dispose?: () => void; target?: Object3D };
    light.dispose?.();
    light.target?.removeFromParent();
    const casting = this.shadowLights.indexOf(o as DirectionalLight);
    if (casting >= 0) this.shadowLights.splice(casting, 1);
    if (o instanceof AmbientLight) {
      // An ambient light that is gone no longer dims the light from around (it counted as none, and the scene went dark).
      const at = this.ambients.indexOf(o);
      if (at >= 0) this.ambients.splice(at, 1);
    } else this.placedLights -= 1;
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
    // The shadow-casting lights fit the models with shadows again.
    if (this.shadowLights.length > 0) this.shadowBox = null;
  }

  setSolid(entry: Entry, on: boolean): void {
    entry.solid = on;
    this.collidersDirty = true;
    this.requestFrame();
  }

  /** A label's or screen text's words; a panel's paragraphs, separated by a blank line. */
  textOf(entry: Entry): string | undefined {
    if (entry.kind === 'label') return entry.labelLook?.words;
    if (entry.kind === 'panel') return entry.panelLook?.paragraphs.join('\n\n');
    if (entry.kind === 'slider') return entry.slider?.label.textContent ?? '';
    if (entry.kind === 'choice') return entry.choice?.legend.textContent ?? '';
    if (entry.kind === 'hud') return [...(entry.hud?.children ?? [])].map((c) => c.textContent ?? '').join('\n');
    return undefined;
  }

  setText(entry: Entry, value: string): void {
    if (entry.kind === 'hud') this.setHudText(entry, value);
    else if (entry.kind === 'panel' && entry.panelLook && entry.object) {
      entry.panelLook.paragraphs = paragraphs(value);
      drawPanel(entry.object, entry.panelLook, this.anisotropy);
      entry.name = entry.panelLook.paragraphs[0] ?? entry.id ?? 'panel';
      if (entry.item && !this.triggers.get(entry)?.button?.isSameNode(entry.item)) this.nameItem(entry.item, entry);
      this.panelWords(entry);
      if (entry.object) this.markMoved(entry);
      this.requestFrame();
    }
    else if (entry.kind === 'slider' && entry.slider) entry.slider.label.textContent = collapse(value);
    else if (entry.kind === 'choice' && entry.choice) {
      const legend = entry.choice.legend;
      legend.textContent = collapse(value);
      legend.hidden = legend.textContent === '';
      if (legend.hidden) entry.hud?.setAttribute('aria-label', entry.id ?? 'Choice');
      else entry.hud?.removeAttribute('aria-label');
    }
    else if (entry.kind === 'label' && entry.labelLook && entry.object) {
      const words = collapse(value);
      entry.labelLook.words = words;
      entry.labelLook.note.textContent = words;
      mark(entry.labelLook.note, this.languageOf(entry.el));
      const dir = this.directionOf(entry.el, words);
      drawLabel(entry.object as Sprite, words, entry.labelLook.size, entry.labelLook.color, dir);
      const listed = this.labels.find((l) => l.sprite === entry.object);
      if (listed) {
        listed.text = words;
        listed.dir = dir;
      }
      entry.name = words || 'label';
      if (entry.item) this.nameItem(entry.item, entry);
      this.requestFrame();
    }
  }

  colorOf(entry: Entry): string | undefined {
    if (entry.kind === 'light') return entry.object ? `#${(entry.object as Object3D & { color: Color }).color.getHexString()}` : undefined;
    if (entry.kind === 'label') return entry.labelLook?.color;
    if (entry.kind === 'hud') return entry.hud?.style.color ? `#${new Color(entry.hud.style.color).getHexString()}` : this.textColor;
    return undefined;
  }

  setColor(entry: Entry, value: string): void {
    if (entry.kind === 'light') (entry.object as (Object3D & { color: Color }) | null)?.color.set(value);
    else if (entry.kind === 'label' && entry.labelLook && entry.object) {
      entry.labelLook.color = value;
      drawLabel(entry.object as Sprite, entry.labelLook.words, entry.labelLook.size, value, this.directionOf(entry.el, entry.labelLook.words));
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
      const copy = cloneModel(t.scene);
      if (this.shadowsOn && this.castsShadows(entry)) castShadows(copy);
      holder.add(copy);
      holder.userData['copy'] = copy;
    }
    holder.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const next = list.map((m: Material) => {
        if (m.name !== name || !changeable(m)) return m;
        let copy = m;
        if (m.userData['own'] !== holder) {
          copy = m.clone();
          copy.userData['own'] = holder;
          // Released with the model, when it is removed or let go (review 134, V10).
          entry.held?.materials.push(copy);
        }
        if (change.color) copy.color.set(change.color);
        // A material that takes no light has no metalness or roughness to change.
        if (change.metalness !== undefined && copy instanceof MeshStandardMaterial) copy.metalness = change.metalness;
        if (change.roughness !== undefined && copy instanceof MeshStandardMaterial) copy.roughness = change.roughness;
        if (change.opacity !== undefined) {
          copy.opacity = change.opacity;
          copy.transparent = change.opacity < 1;
        }
        return copy;
      });
      o.material = Array.isArray(o.material) ? next : next[0]!;
    });
    this.materialsOf(holder, entry.report);
    this.waterDirty = true;
    this.shadersWanted = true;
    this.requestFrame();
  }

  /** The background colour (behind everything unless the page has a sky). */
  get backgroundColor(): string {
    return `#${this.background.getHexString()}`;
  }

  set backgroundColor(value: string) {
    this.background.set(value);
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

  /** How fast the viewer walks (metres a second) and turns from the keyboard (degrees a second). */
  get viewerSpeed(): number {
    return this.controls?.speed ?? WALK_SPEED;
  }

  set viewerSpeed(v: number) {
    if (this.controls) this.controls.speed = v;
  }

  get viewerTurnSpeed(): number {
    return this.controls?.turnSpeed ?? TURN_SPEED;
  }

  set viewerTurnSpeed(v: number) {
    if (this.controls) this.controls.turnSpeed = v;
  }

  // ---- Drawing --------------------------------------------------------------

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // The window may be on another screen now, or the page zoomed: the sharpness follows.
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.requestFrame();
  }

  /**
   * The page's tab went behind another, or came to the front (milestone 21).
   * Behind, the scene stops drawing what moves (animations, the water's
   * light, a script's frames); a change still draws once, so that the
   * tab's card can show the scene. In front again, it goes on.
   */
  setBehind(on: boolean): void {
    if (this.behind === on) return;
    this.behind = on;
    this.last = 0;
    if (!on) this.requestFrame();
  }

  get isBehind(): boolean {
    return this.behind;
  }

  /** New shaders are compiling, or wanted: the scene is not yet drawn as it now is (for the tests). */
  get shadersCompiling(): boolean {
    return this.compiling || this.shadersWanted;
  }

  requestFrame(): void {
    // Hidden behind the text view, the scene draws nothing: it is drawn again when it is shown.
    if (this.frameRequested || this.textView) return;
    // Behind another tab, what moves in a frame (a script's frame handler moving things) asks for no more.
    if (this.behind && this.inFrame) return;
    this.frameRequested = true;
    requestAnimationFrame((t) => this.frame(t));
  }

  private frame(time: number): void {
    this.frameRequested = false;
    if (this.textView) return;
    this.inFrame = true;
    try {
      this.drawFrame(time);
    } finally {
      this.inFrame = false;
    }
  }

  private drawFrame(time: number): void {
    // How far the scene moves on in this frame: the time since the last one, but never more than 100 ms, and one
    // frame's usual time where there is no last frame to measure from (SPEC.md section 10, the `frame` event).
    const dt = this.last === 0 ? 16 : Math.min(100, time - this.last);
    this.last = time;
    this.clock += dt;
    let moving = this.controls?.step(dt) ?? false;
    this.viewMoving = moving;
    // Loading by area (milestone 20): what the viewer came near loads, and what it left is let go.
    this.updateAreas();
    // Far models (HoloML 0.3): the lighter version past the line, the model itself within it.
    this.updateFar();
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
    this.fitShadows();
    if (this.water) {
      if (this.waterDirty) {
        this.water.hook(this.scene);
        this.waterDirty = false;
      }
      this.water.light = this.waterLight();
      // The moving light keeps the scene drawing; with reduced motion it holds still.
      if (this.water.step(dt, this.reducedMotion.matches)) moving = true;
    }
    if (this.sounds.placed) {
      const c = this.camera;
      const forward = new Vector3();
      c.getWorldDirection(forward);
      const up = new Vector3(0, 1, 0).applyQuaternion(c.quaternion);
      this.sounds.follow([c.position.x, c.position.y, c.position.z], [forward.x, forward.y, forward.z], [up.x, up.y, up.z]);
    }
    // New shaders compile off the page's main thread where the graphics card can (KHR_parallel_shader_compile);
    // meanwhile the last frame stays, and what loads goes on loading.
    if (this.shadersWanted && !this.compiling) {
      this.shadersWanted = false;
      this.compiling = true;
      this.renderer
        .compileAsync(this.scene, this.camera)
        .catch(() => undefined)
        .finally(() => {
          this.compiling = false;
          this.requestFrame();
        });
    }
    if (this.compiling) {
      // Not drawn yet, but where everything is stays current (clicks, and what the tests measure, use it).
      this.scene.updateMatrixWorld();
      this.camera.updateMatrixWorld();
      if (moving && !this.behind) this.requestFrame();
      else this.last = 0;
      return;
    }
    this.renderer.render(this.scene, this.camera);
    this.frames += 1;
    this.updatePlan();
    // Arrived through a fade: in once everything is drawn.
    if (this.arriving && this.pending === 0) this.arrive();
    this.onDrawn?.();
    if (moving && !this.behind) this.requestFrame();
    else this.last = 0;
  }

  /**
   * The soft light from around the scene (for paint and metal) is the
   * renderer's own, or the page's panorama of its surroundings (HoloML
   * 0.2, milestone 18). In a 0.2 page that has ambient lights, it follows
   * their brightness, so a page can make evening or night (milestone 17);
   * 0.1 pages look as they did. The ambient lights that count are those
   * in the scene at the time: with none (none written, or all removed by
   * a script), the light from around is at full.
   */
  private followAmbient(): void {
    const full = this.environment?.state === 'loaded' ? 1 : 0.45;
    let factor = 1;
    if (this.since('0.2') && this.ambients.length > 0) {
      const ambient = this.ambients.reduce((sum, l) => sum + l.intensity, 0);
      factor = Math.min(1, ambient / 0.6);
    }
    this.scene.environmentIntensity = full * factor;
    // The sky (milestone 19) as well: evening outside the windows too.
    this.scene.backgroundIntensity = factor;
  }

  /** Moves every animate element on; true while any still runs. */
  private stepAnimations(now: number): boolean {
    let running = false;
    for (const a of this.animations) {
      if (a.entry?.removed) continue;
      // A click action not yet clicked leaves its element as it is.
      const p = this.progress(a, now);
      if (!p) continue;
      const { t, done } = p;
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
          this.background.setRGB(v[0]!, v[1]!, v[2]!, SRGBColorSpace);
          break;
      }
      if (a.entry && (a.attribute === 'position' || a.attribute === 'rotation' || a.attribute === 'scale')) this.markMoved(a.entry);
      if (!done) running = true;
    }
    return running;
  }
}

/**
 * Why holoml.add leaves an element of its markup out, wherever it stands
 * there, in words for the console; null for one it adds. An `animate`, and
 * a `sound` that begins on a click: what a script adds, the script moves
 * and plays (SPEC.md section 10).
 */
function leftOutOfAdd(el: ElementNode): string | null {
  if (el.name === 'animate') return '<animate> left out: what a script adds, the script moves itself';
  if (el.name === 'sound' && attr(el, 'begin') === 'click') return 'a <sound> that begins on a click left out: what a script adds, the script plays itself, with play()';
  return null;
}

/** An id reference ("#door") as the id itself. */
function idOf(ref: string | null | undefined): string {
  return trimSpace(ref ?? '').replace(/^#/, '');
}

/** The place the page's address names after #, if any. */
function addressName(): string | null {
  if (location.hash.length <= 1) return null;
  try {
    return decodeURIComponent(location.hash.slice(1));
  } catch {
    return location.hash.slice(1);
  }
}

/** A place's name in the outline: its label, or its id. */
function placeName(vp: ElementNode): string {
  return collapse(attr(vp, 'label') ?? '') || attr(vp, 'id') || 'viewpoint';
}

/** A HoloML page, by its address. */
function isHolomlPage(url: URL): boolean {
  return /\.holoml$/i.test(url.pathname);
}

/** Two addresses of one document (they differ at most after #). */
function sameDocument(a: URL, b: URL): boolean {
  return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search;
}

/** This page was opened from another HoloML page of the same site, by following a link (not Back, Forward, or reloading). */
function arrivedFromHolomlPage(): boolean {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav && nav.type !== 'navigate') return false;
  try {
    const from = new URL(document.referrer);
    return from.origin === location.origin && isHolomlPage(from) && !sameDocument(from, new URL(location.href));
  } catch {
    return false;
  }
}

/** Draws a label's words into its sprite (again, when a script changes them). */
function drawLabel(sprite: Sprite, words: string, size: number, fill: string, dir: 'ltr' | 'rtl' = 'ltr'): void {
  const px = 96;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `600 ${px}px system-ui, "Segoe UI", sans-serif`;
  ctx.font = font;
  // HoloML 0.3: right-to-left words are laid out from the right (the Unicode Bidirectional Algorithm's base direction).
  ctx.direction = dir;
  const width = Math.ceil(ctx.measureText(words).width) + px;
  canvas.width = width;
  canvas.height = Math.ceil(px * 1.5);
  ctx.font = font;
  ctx.direction = dir;
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
function nameOf(el: ElementNode, v03 = false): string {
  // HoloML 0.3 (milestone 25): a model's and a group's own name, before its id and its file's name.
  if (v03 && (el.name === 'model' || el.name === 'group')) {
    const label = collapse(attr(el, 'label') ?? '');
    if (label) return label;
  }
  if (el.name === 'label') return text(el) || 'label';
  if (el.name === 'panel') return paragraphs(rawText(el))[0] || attr(el, 'id') || 'panel';
  if (el.name === 'plan') return collapse(attr(el, 'label') ?? '') || attr(el, 'id') || 'plan';
  if (el.name === 'viewpoint') return placeName(el);
  if (el.name === 'slider') return text(el) || attr(el, 'id') || 'slider';
  if (el.name === 'choice') return collapse(attr(el, 'label') ?? '') || attr(el, 'id') || 'choice';
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

/** Releases an object's geometry, materials, and pictures on the graphics card, each once (`done` holds those already released). */
function releaseObject(o: Object3D, done: Set<unknown>): void {
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
}

/**
 * A model file let go (loading by area, milestone 20): its meshes,
 * materials, and pictures are released, and its decoded pictures closed.
 */
function releaseFile(root: Object3D): void {
  const done = new Set<unknown>();
  root.traverse((o) => {
    const mesh = o as Object3D & { material?: Material | Material[] };
    for (const m of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
      for (const value of Object.values(m)) {
        const image = value instanceof Texture ? (value.image as unknown) : null;
        if (image instanceof ImageBitmap && !done.has(image)) {
          done.add(image);
          image.close();
        }
      }
    }
    releaseObject(o, done);
  });
}

/** A model that casts and receives shadows: every mesh in it. */
function castShadows(model: Object3D): void {
  model.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
}

/**
 * The WebGL renderer's name when Chromium draws in software (no graphics
 * card, as on GitHub's test machines), else null. Asked of a context made
 * for the question and let go at once, before the scene's own renderer
 * is made: whether edges are smoothed is chosen when a renderer is made.
 */
function softwareDrawing(): string | null {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return null;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /swiftshader|llvmpipe|softpipe|basic render|warp/i.test(name) ? name : null;
}

/** Where a model that could not be loaded would be: a small red wire box. */
function missingMarker(): Object3D {
  const box = new LineSegments(new EdgesGeometry(new BoxGeometry(0.5, 0.5, 0.5)), new LineBasicMaterial({ color: 0xff4d6d }));
  box.position.y = 0.25;
  box.userData['missing'] = true;
  return box;
}
