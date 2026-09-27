/**
 * The scene API for a HoloML page's scripts (HoloML 0.2 draft, SPEC.md
 * section 10; HyperSpace 3D milestone 17, owner prompt 86, Q1 a): one
 * object, `holoml`, to find, change, add, and remove elements, and to
 * hear clicks, keys, and frames. Scripts get handles ("things"), never
 * the viewer's own objects, and every value is checked on the way in.
 */
import type { Entry, HolomlView, Hit, SceneEvent } from './scene';
import type { Vec3 } from './values';

type Kind = 'model' | 'group' | 'light' | 'label' | 'sound' | 'hud';
const KINDS = new Set<string>(['model', 'group', 'light', 'label', 'sound', 'hud']);
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
    define('parent', () => (e.parent && e.parent.kind === 'group' ? thing(e.parent) : null));
    if (has('model', 'group', 'label', 'light')) {
      define(
        'position',
        () => {
          const p = o()?.position;
          return p ? [p.x, p.y, p.z] : undefined;
        },
        (v) => {
          o()?.position.set(...vector(v, 'position'));
          view.moved(e);
        },
      );
    }
    if (has('model', 'group')) {
      define(
        'rotation',
        () => {
          const r = o()?.rotation;
          return r ? [deg(r.x), deg(r.y), deg(r.z)] : undefined;
        },
        (v) => {
          const [x, y, z] = vector(v, 'rotation').map((d) => (d * Math.PI) / 180) as Vec3;
          o()?.rotation.set(x, y, z, 'XYZ');
          view.moved(e);
        },
      );
      define(
        'scale',
        () => {
          const s = o()?.scale;
          return s ? [s.x, s.y, s.z] : undefined;
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
    }
    if (has('model', 'group', 'label')) {
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
    if (has('label', 'hud')) {
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
      define(
        'volume',
        () => e.sound?.volume,
        (v) => {
          if (e.sound) e.sound.volume = unit(v, 'volume');
        },
      );
    }
    t['remove'] = () => view.removeEntry(e);
    const frozen = Object.freeze(t) as unknown as HolomlThing;
    thingOf.set(e, frozen);
    entryOf.set(frozen, e);
    return frozen;
  };

  const hitOut = (h: Hit | null) => (h ? { thing: thing(h.entry), point: h.point, normal: h.normal } : null);
  const TYPES = new Set(['click', 'key', 'frame']);

  const viewer = Object.freeze({
    get position(): Vec3 {
      return view.viewerPosition;
    },
    set position(v: unknown) {
      view.viewerPosition = vector(v, 'viewer.position');
    },
    get direction(): Vec3 {
      return view.viewerDirection;
    },
    lookAt(point: unknown) {
      view.viewerLookAt(vector(point, 'lookAt(point)'));
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
      if (typeof type !== 'string' || !TYPES.has(type)) throw new TypeError('holoml.on(type, listener): type must be "click", "key", or "frame"');
      if (typeof listener !== 'function') throw new TypeError('holoml.on(type, listener): listener must be a function');
      const call = listener as (e: unknown) => void;
      return view.listen(type as 'click' | 'key' | 'frame', (e: SceneEvent) => {
        if (e.type === 'click') call(Object.freeze({ type: 'click', ...hitOut(e.hit), button: e.button }));
        else if (e.type === 'key') call(Object.freeze({ type: 'key', key: e.key, down: e.down, repeat: e.repeat }));
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
