/**
 * The scene API for a HoloML page's scripts (HoloML 0.2, SPEC.md
 * section 10; HyperSpace 3D milestone 17, owner prompt 86, Q1 a): one
 * object, `holoml`, to find, change, add, and remove elements, and to
 * hear clicks, keys, frames, and sliders. Scripts get handles ("things"),
 * never the viewer's own objects, and every value is checked on the way
 * in. Milestone 18 (prompt 92): the viewer's speeds, and sliders; then
 * (prompt 98) choices. Milestone 19: panels. Milestone 20: whether models
 * and groups are loaded, and the `load` event (loading by area).
 * Milestone 21: a sound's place, and a model's animation speed.
 *
 * Review 134, as the specification's third edition says (SPEC.md section
 * 10): setting a member that a thing's kind does not have is no error and
 * changes nothing; the arrays a thing or the viewer gives are frozen; and
 * a thing's parent is the nearest group it is in, also through a link.
 */
import type { Entry, HolomlView, Hit, SceneEvent } from './scene';
import type { Vec3 } from './values';

type Kind = 'model' | 'group' | 'light' | 'label' | 'panel' | 'sound' | 'hud' | 'slider' | 'choice';
const KINDS = new Set<string>(['model', 'group', 'light', 'label', 'panel', 'sound', 'hud', 'slider', 'choice']);
const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function vector(v: unknown, what: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    throw new TypeError(`${what} must be three finite numbers, such as [0, 1.5, -2]`);
  }
  return [v[0], v[1], v[2]];
}

function colour(v: unknown, what: string): string {
  if (typeof v !== 'string' || !COLOR.test(v)) throw new TypeError(`${what} must be a colour such as "#c0182a" or "#fff"`);
  return v.length === 4 ? `#${[...v.slice(1)].map((c) => c + c).join('')}`.toLowerCase() : v.toLowerCase();
}

function unit(v: unknown, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) throw new TypeError(`${what} must be a number from 0 to 1`);
  return v;
}

/** A vector as a thing or the viewer gives it: frozen, so a script sets the member to a new array to move the thing (the Web IDL's FrozenArray). */
function given(x: number, y: number, z: number): Readonly<Vec3> {
  return Object.freeze<Vec3>([x, y, z]);
}

function within(v: unknown, min: number, max: number, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new TypeError(`${what} must be a number from ${min} to ${max}`);
  return v;
}

export interface HolomlThing {
  readonly id: string | null;
  readonly kind: Kind;
}

/** Puts `holoml` on the page's window, for its scripts. */
export function installApi(view: HolomlView, ready: Promise<void>): void {
  const entryOf = new WeakMap<object, Entry>();
  const thingOf = new WeakMap<Entry, HolomlThing>();
  const deg = (r: number) => (r * 180) / Math.PI;

  const thing = (e: Entry | null | undefined): HolomlThing | null => {
    if (!e || e.removed || !KINDS.has(e.kind)) return null;
    const known = thingOf.get(e);
    if (known) return known;
    const kind = e.kind as Kind;
    const o = () => (e.removed ? null : e.object);
    const has = (...kinds: Kind[]) => kinds.includes(kind);
    const t: Record<string, unknown> = {};
    const define = (name: string, get: () => unknown, set?: (v: unknown) => void) =>
      Object.defineProperty(t, name, { enumerable: true, get, ...(set ? { set: (v: unknown) => (e.removed ? undefined : set(v)) } : {}) });
    define('id', () => e.id);
    define('kind', () => kind);
    // The nearest group it is in. A link is not a thing, and does not count: a model in a link in a group has that group.
    define('parent', () => {
      let p = e.parent;
      while (p && p.kind === 'a') p = p.parent;
      return p && p.kind === 'group' ? thing(p) : null;
    });
    if (has('model', 'group', 'label', 'panel', 'light')) {
      define(
        'position',
        () => {
          const p = o()?.position;
          return p ? given(p.x, p.y, p.z) : undefined;
        },
        (v) => {
          o()?.position.set(...vector(v, 'position'));
          view.moved(e);
        },
      );
    }
    if (has('model', 'group', 'panel')) {
      define(
        'rotation',
        () => {
          const r = o()?.rotation;
          return r ? given(deg(r.x), deg(r.y), deg(r.z)) : undefined;
        },
        (v) => {
          const [x, y, z] = vector(v, 'rotation').map((d) => (d * Math.PI) / 180) as Vec3;
          o()?.rotation.set(x, y, z, 'XYZ');
          view.moved(e);
        },
      );
    }
    if (has('model', 'group')) {
      define(
        'scale',
        () => {
          const s = o()?.scale;
          return s ? given(s.x, s.y, s.z) : undefined;
        },
        (v) => {
          o()?.scale.set(...vector(v, 'scale'));
          view.moved(e);
        },
      );
      define(
        'solid',
        () => e.solid === true,
        (v) => view.setSolid(e, v === true),
      );
      // Loading by area (milestone 20): a model's file is in; a group's models near enough to load are all in.
      define('loaded', () => !e.removed && view.isLoaded(e));
    }
    if (has('model', 'group', 'label', 'panel')) {
      define(
        'visible',
        () => o()?.visible,
        (v) => {
          const x = o();
          if (!x) return;
          x.visible = v !== false;
          view.moved(e);
        },
      );
    }
    if (has('label', 'panel', 'hud', 'slider', 'choice')) {
      define(
        'text',
        () => view.textOf(e),
        (v) => view.setText(e, String(v).slice(0, 10_000)),
      );
    }
    if (has('light', 'label', 'hud')) {
      define(
        'color',
        () => view.colorOf(e),
        (v) => view.setColor(e, colour(v, 'color')),
      );
    }
    if (has('light')) {
      define(
        'intensity',
        () => view.intensityOf(e),
        (v) => {
          if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new TypeError('intensity must be a number, 0 or more');
          view.setIntensity(e, v);
        },
      );
    }
    if (has('model')) {
      // How fast its own animation plays (milestone 21): 1 as made, 0 held still.
      define(
        'animationSpeed',
        () => view.animationSpeedOf(e),
        (v) => view.setAnimationSpeed(e, within(v, 0, 4, 'animationSpeed')),
      );
      t['material'] = (name: unknown, change: unknown) => {
        if (e.removed) return;
        if (typeof name !== 'string') throw new TypeError('material(name, change): name must be text');
        const c = (change ?? {}) as Record<string, unknown>;
        view.setMaterial(e, name, {
          ...(c['color'] !== undefined ? { color: colour(c['color'], 'color') } : {}),
          ...(c['metalness'] !== undefined ? { metalness: unit(c['metalness'], 'metalness') } : {}),
          ...(c['roughness'] !== undefined ? { roughness: unit(c['roughness'], 'roughness') } : {}),
          ...(c['opacity'] !== undefined ? { opacity: unit(c['opacity'], 'opacity') } : {}),
        });
      };
    }
    if (has('sound')) {
      t['play'] = () => (e.removed ? undefined : e.sound?.play());
      t['stop'] = () => (e.removed ? undefined : e.sound?.stop());
      define('playing', () => e.soundReport?.playing === true);
      // Where it comes from (milestone 21): null for a sound from everywhere; a place makes it a sound from there.
      // Setting null is an error, as anything that is not a place is: a sound that has a place keeps one.
      define(
        'position',
        () => {
          const p = view.soundPosition(e);
          return p ? given(...p) : null;
        },
        (v) => view.setSoundPosition(e, vector(v, 'position')),
      );
      define(
        'volume',
        () => e.sound?.volume,
        (v) => {
          if (e.sound) e.sound.volume = unit(v, 'volume');
        },
      );
    }
    if (has('slider')) {
      define(
        'value',
        () => view.sliderValue(e),
        (v) => {
          const r = view.sliderRange(e);
          if (r) view.setSliderValue(e, within(v, r.min, r.max, 'value'));
        },
      );
      define('min', () => view.sliderRange(e)?.min);
      define('max', () => view.sliderRange(e)?.max);
      define('step', () => view.sliderRange(e)?.step);
    }
    if (has('choice')) {
      define(
        'value',
        () => view.choiceValue(e),
        (v) => {
          if (typeof v !== 'string' || !view.setChoiceValue(e, v)) {
            throw new TypeError(`value must be one of the choice's options: ${(view.choiceOptions(e) ?? []).map((o) => JSON.stringify(o)).join(', ')}`);
          }
        },
      );
      define('options', () => Object.freeze([...(view.choiceOptions(e) ?? [])]));
    }
    t['remove'] = () => view.removeEntry(e);
    // Frozen, and behind a handler that takes the setting of a member its kind does not have (any name) without
    // a word: nothing changes, the member is undefined still, and it is no error, though a page's script is a
    // module, where setting a member of a frozen object otherwise throws. A member it has goes to the member.
    const handle = new Proxy(Object.freeze(t), {
      set: (target, name, value, receiver) => (Object.hasOwn(target, name) ? Reflect.set(target, name, value, receiver) : true),
    }) as unknown as HolomlThing;
    thingOf.set(e, handle);
    entryOf.set(handle, e);
    return handle;
  };

  const hitOut = (h: Hit | null) => (h ? { thing: thing(h.entry), point: h.point, normal: h.normal } : null);
  const TYPES = new Set<SceneEvent['type']>(['click', 'key', 'frame', 'change', 'load']);

  const viewer = Object.freeze({
    get position(): Readonly<Vec3> {
      return given(...view.viewerPosition);
    },
    set position(v: unknown) {
      view.viewerPosition = vector(v, 'viewer.position');
    },
    get direction(): Readonly<Vec3> {
      return given(...view.viewerDirection);
    },
    lookAt(point: unknown) {
      view.viewerLookAt(vector(point, 'lookAt(point)'));
    },
    /** Walking: metres a second (HoloML 0.2 `speed`, milestone 18). */
    get speed(): number {
      return view.viewerSpeed;
    },
    set speed(v: unknown) {
      view.viewerSpeed = within(v, 0.5, 10, 'viewer.speed');
    },
    /** Turning and looking up and down from the keyboard: degrees a second (`turn-speed`). */
    get turnSpeed(): number {
      return view.viewerTurnSpeed;
    },
    set turnSpeed(v: unknown) {
      view.viewerTurnSpeed = within(v, 10, 720, 'viewer.turnSpeed');
    },
  });

  const api = Object.freeze({
    version: view.pageVersion,
    ready,
    find: (id: unknown) => (typeof id === 'string' ? thing(view.findEntry(id)) : null),
    add: (markup: unknown, parent?: unknown) => {
      if (typeof markup !== 'string') throw new TypeError('holoml.add(markup, parent): markup must be text');
      let into: Entry | null = null;
      if (parent !== undefined && parent !== null) {
        into = entryOf.get(parent as object) ?? null;
        if (!into || into.kind !== 'group' || into.removed) throw new TypeError('holoml.add(markup, parent): parent must be a group thing');
      }
      return view.addMarkup(markup, into).map(thing).filter((x): x is HolomlThing => x !== null);
    },
    remove: (t: unknown) => {
      const e = entryOf.get(t as object);
      if (e) view.removeEntry(e);
    },
    on: (type: unknown, listener: unknown) => {
      if (typeof type !== 'string' || !TYPES.has(type as SceneEvent['type'])) {
        throw new TypeError('holoml.on(type, listener): type must be "click", "key", "frame", "change", or "load"');
      }
      if (typeof listener !== 'function') throw new TypeError('holoml.on(type, listener): listener must be a function');
      const call = listener as (e: unknown) => void;
      return view.listen(type as SceneEvent['type'], (e: SceneEvent) => {
        if (e.type === 'click') call(Object.freeze({ type: 'click', ...hitOut(e.hit), button: e.button }));
        else if (e.type === 'key') call(Object.freeze({ type: 'key', key: e.key, down: e.down, repeat: e.repeat }));
        else if (e.type === 'change') call(Object.freeze({ type: 'change', thing: thing(e.entry), value: e.value }));
        else if (e.type === 'load') call(Object.freeze({ type: 'load', thing: thing(e.entry), loaded: e.loaded }));
        else call(Object.freeze({ type: 'frame', time: e.time, dt: e.dt }));
      });
    },
    aim: () => hitOut(view.aim()),
    viewer,
    get background() {
      return view.backgroundColor;
    },
    set background(v: unknown) {
      view.backgroundColor = colour(v, 'background');
    },
    get reducedMotion() {
      return view.motionReduced;
    },
  });
  Object.defineProperty(window, 'holoml', { value: api, enumerable: true });
}
