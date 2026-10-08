/**
 * Y3 (milestone 22): HyperSpace 3D's scene API has every member of
 * HoloML's Web IDL (SPEC.md appendix A.3, copied from the holoml
 * repository into packages/holoml/src/holoml.webidl by pnpm holoml:sync),
 * and nothing else: the `holoml` object, the viewer, each kind of thing,
 * a hit, a material's change, and the events. The API is installed against
 * a stand-in for the scene, which is all it needs to make its objects.
 * The Web IDL is HoloML 0.3's (milestone 25): a 0.3 page's scripts have all
 * of it, and a 0.2 page's have what they had (the last part).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Entry, HolomlView, SceneEvent } from './scene';
import { installApi } from './api';

const IDL = readFileSync(new URL('../../../../packages/holoml/src/holoml.webidl', import.meta.url), 'utf8');

/** The Web IDL's interfaces and dictionaries: each one's parent and its own members' names. */
function definitions(): Map<string, { parent: string | null; members: string[] }> {
  const out = new Map<string, { parent: string | null; members: string[] }>();
  const text = IDL.replace(/\r\n/g, '\n').replace(/\/\/[^\n]*/g, '');
  for (const m of text.matchAll(/(?:interface|dictionary)\s+(\w+)(?:\s*:\s*(\w+))?\s*\{([^}]*)\};/g)) {
    const members = m[3]!
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => /(\w+)\s*\(/.exec(s)?.[1] ?? s.split(/\s+/).pop()!);
    out.set(m[1]!, { parent: m[2] ?? null, members });
  }
  return out;
}

const defs = definitions();
const membersOf = (name: string): string[] => {
  const d = defs.get(name);
  if (!d) throw new Error(`the Web IDL has no ${name}`);
  return [...(d.parent ? membersOf(d.parent) : []), ...d.members];
};
const sorted = (list: Iterable<string>) => [...new Set(list)].sort();

const KINDS = { model: 'ModelThing', group: 'GroupThing', light: 'LightThing', label: 'LabelThing', panel: 'PanelThing', sound: 'SoundThing', hud: 'HudThing', slider: 'SliderThing', choice: 'ChoiceThing', animate: 'AnimateThing', water: 'WaterThing', plan: 'PlanThing' } as const;
/** The kinds and members HoloML 0.3 added, which a 0.2 page's scripts do not have. */
const ADDED_03 = { kinds: ['animate', 'water', 'plan'], viewer: ['place', 'goTo'], model: ['label'], group: ['label'], events: ['place'] };

type Api = Record<string, unknown> & {
  find(id: string): Record<string, unknown> | null;
  on(type: string, listener: (e: Record<string, unknown>) => void): () => void;
  aim(): Record<string, unknown> | null;
  viewer: Record<string, unknown>;
};

let api: Api;
const listeners = new Map<string, (e: SceneEvent) => void>();
const changes: Record<string, unknown>[] = [];
const entries = new Map<string, Entry>();

beforeAll(() => {
  for (const kind of Object.keys(KINDS)) entries.set(kind, { kind, id: kind, parent: null, removed: false, object: {} } as unknown as Entry);
  const view = {
    pageVersion: '0.3',
    findEntry: (id: string) => entries.get(id) ?? null,
    listen: (type: string, fn: (e: SceneEvent) => void) => {
      listeners.set(type, fn);
      return () => listeners.delete(type);
    },
    aim: () => ({ entry: entries.get('model')!, point: [0, 1, 0], normal: [0, 0, 1] }),
    setMaterial: (_e: Entry, _name: string, change: Record<string, unknown>) => changes.push(change),
  } as unknown as HolomlView;
  const win: { holoml?: Api } = {};
  (globalThis as { window?: unknown }).window = win;
  installApi(view, Promise.resolve());
  api = win.holoml!;
});

describe('Y3: HyperSpace 3D has the scene API of the Web IDL, and no more (milestone 22)', () => {
  it('the holoml object', () => {
    expect(sorted(Object.keys(api))).toEqual(sorted(membersOf('HoloML')));
  });

  it('the viewer', () => {
    expect(sorted(Object.keys(api.viewer))).toEqual(sorted(membersOf('HoloMLViewer')));
  });

  for (const [kind, iface] of Object.entries(KINDS)) {
    it(`a ${kind} thing (${iface})`, () => {
      const thing = api.find(kind)!;
      expect(thing, kind).not.toBeNull();
      expect(sorted(Object.keys(thing))).toEqual(sorted(membersOf(iface)));
    });
  }

  it('a hit, from aim()', () => {
    expect(sorted(Object.keys(api.aim()!))).toEqual(sorted(membersOf('HoloMLHit')));
  });

  it("a material's change: every member of HoloMLMaterialChange reaches the model", () => {
    const model = api.find('model')! as { material(name: string, change: Record<string, unknown>): void };
    model.material('Paint', { color: '#c0182a', metalness: 0.5, roughness: 0.5, opacity: 0.5 });
    expect(sorted(Object.keys(changes.at(-1)!))).toEqual(sorted(membersOf('HoloMLMaterialChange')));
  });

  it('the events: each has its type, and together they have every member of HoloMLEvent', () => {
    const seen: Record<string, unknown>[] = [];
    const entry = entries.get('slider')!;
    const events: SceneEvent[] = [
      { type: 'click', hit: { entry: entries.get('model')!, point: [0, 1, 0], normal: [0, 0, 1] }, button: 'left' } as unknown as SceneEvent,
      { type: 'key', key: 'e', down: true, repeat: false },
      { type: 'frame', time: 16, dt: 16 },
      { type: 'change', entry, value: 0.5 },
      { type: 'load', entry: entries.get('group')!, loaded: true },
      { type: 'place', place: 'terrace' },
    ];
    for (const e of events) {
      api.on(e.type, (event) => seen.push(event));
      listeners.get(e.type)!(e);
    }
    expect(seen.map((e) => e['type'])).toEqual(events.map((e) => e.type));
    expect(sorted(seen.flatMap((e) => Object.keys(e)))).toEqual(sorted(membersOf('HoloMLEvent')));
  });
});

describe('things as the specification says (review 134; SPEC.md section 10, "Things" and "The viewer")', () => {
  /** A stand-in for a Three.js object: a place, a turn, and a size, each with its `set`. */
  const object = () => {
    const xyz = (x: number, y: number, z: number) => {
      const v = { x, y, z, set: (nx: number, ny: number, nz: number) => Object.assign(v, { x: nx, y: ny, z: nz }) };
      return v;
    };
    return { position: xyz(1, 2, 3), rotation: xyz(0, Math.PI / 2, 0), scale: xyz(1, 1, 1), visible: true };
  };

  /** The scene API over a small scene: a group that holds a link that holds a model and a label, a light, and two sounds. */
  function scene(version = '0.2') {
    const made = new Map<string, Entry>();
    const entry = (kind: string, id: string, parent: Entry | null) => {
      const e = { kind, id, parent, removed: false, object: object(), children: [] } as unknown as Entry;
      made.set(id, e);
      return e;
    };
    const hall = entry('group', 'hall', null);
    const room = entry('group', 'room', hall);
    const link = entry('a', 'link', room);
    const inner = entry('a', 'inner', link);
    entry('model', 'car', inner);
    entry('label', 'sign', link);
    entry('model', 'loose', null);
    entry('model', 'linked', entry('a', 'alone', null));
    entry('light', 'lamp', room);
    entry('sound', 'here', null);
    entry('sound', 'everywhere', null);
    const moved: string[] = [];
    const places = new Map<string, [number, number, number] | null>([['here', [4, 1.6, 0]]]);
    const view = {
      pageVersion: version,
      findEntry: (id: string) => made.get(id) ?? null,
      moved: (e: Entry) => moved.push(e.id!),
      viewerPosition: [0, 1.6, 5],
      viewerDirection: [0, 0, -1],
      soundPosition: (e: Entry) => places.get(e.id!) ?? null,
      setSoundPosition: (e: Entry, at: [number, number, number] | null) => places.set(e.id!, at),
      removeEntry: (e: Entry) => (e.removed = true),
    } as unknown as HolomlView;
    const win: { holoml?: Api } = {};
    (globalThis as { window?: unknown }).window = win;
    installApi(view, Promise.resolve());
    return { holoml: win.holoml!, made, moved };
  }

  it('setting a member its kind does not have is not an error and changes nothing: the member is undefined still', () => {
    const { holoml, made } = scene();
    const sign = holoml.find('sign')!;
    const keys = Object.keys(sign);
    // A label has no rotation, no scale, and no intensity; "colour" and "nonsense" are no members of anything.
    for (const name of ['rotation', 'scale', 'intensity', 'solid', 'value', 'colour', 'nonsense', 'constructor']) {
      expect(() => {
        sign[name] = [0, 90, 0];
      }, name).not.toThrow();
      expect(Object.hasOwn(sign, name), name).toBe(false);
    }
    expect(sign['rotation']).toBeUndefined();
    expect(sign['nonsense']).toBeUndefined();
    expect('nonsense' in sign).toBe(false);
    expect(Object.keys(sign)).toEqual(keys);
    // Nothing of the label itself changed either.
    expect((made.get('sign')!.object as unknown as ReturnType<typeof object>).rotation).toMatchObject({ x: 0, y: Math.PI / 2, z: 0 });
    // The same for every kind, and for a symbol.
    for (const id of ['car', 'hall', 'lamp', 'here']) {
      const thing = holoml.find(id)!;
      expect(() => {
        thing['nonsense'] = 1;
        (thing as Record<symbol, unknown>)[Symbol.iterator] = 1;
      }, id).not.toThrow();
      expect(thing['nonsense'], id).toBeUndefined();
    }
  });

  it('a member it has is still set, and checked; a member that is read-only is still read-only; it is the same thing each time', () => {
    const { holoml, made, moved } = scene();
    const car = holoml.find('car')!;
    car['position'] = [4, 5, 6];
    expect(car['position']).toEqual([4, 5, 6]);
    expect((made.get('car')!.object as unknown as ReturnType<typeof object>).position).toMatchObject({ x: 4, y: 5, z: 6 });
    expect(moved).toEqual(['car']);
    expect(() => (car['position'] = [1, 2])).toThrow(TypeError);
    expect(() => (car['id'] = 'other')).toThrow(TypeError);
    expect(() => (car['remove'] = () => undefined)).toThrow(TypeError);
    expect(car['id']).toBe('car');
    expect(Object.isFrozen(car)).toBe(true);
    expect(holoml.find('car')).toBe(car);
    // Removed: setting its members does nothing, those it has and those it has not.
    (car['remove'] as () => void)();
    expect(() => {
      car['position'] = [9, 9, 9];
      car['nonsense'] = 1;
    }).not.toThrow();
    expect((made.get('car')!.object as unknown as ReturnType<typeof object>).position).toMatchObject({ x: 4, y: 5, z: 6 });
  });

  it("a thing's parent is the nearest group it is in, also through a link, and a link inside a link", () => {
    const { holoml } = scene();
    const room = holoml.find('room')!;
    expect(holoml.find('car')!['parent']).toBe(room);
    expect(holoml.find('sign')!['parent']).toBe(room);
    expect(holoml.find('lamp')!['parent']).toBe(room);
    expect(room['parent']).toBe(holoml.find('hall'));
    // In no group: null, with a link around it or without.
    expect(holoml.find('hall')!['parent']).toBeNull();
    expect(holoml.find('loose')!['parent']).toBeNull();
    expect(holoml.find('linked')!['parent']).toBeNull();
    // A link is not a thing.
    expect(holoml.find('link')).toBeNull();
  });

  it("the arrays a thing or the viewer gives are frozen: a script sets the member to a new array", () => {
    const { holoml } = scene();
    const car = holoml.find('car')!;
    for (const name of ['position', 'rotation', 'scale']) {
      const v = car[name] as number[];
      expect(Array.isArray(v), name).toBe(true);
      expect(Object.isFrozen(v), name).toBe(true);
      expect(() => (v[0] = 9), name).toThrow(TypeError);
      expect(() => v.push(1), name).toThrow(TypeError);
    }
    expect(car['rotation']).toEqual([0, 90, 0]);
    expect(Object.isFrozen(holoml.find('sign')!['position'])).toBe(true);
    expect(Object.isFrozen(holoml.find('lamp')!['position'])).toBe(true);
    expect(Object.isFrozen(holoml.find('hall')!['scale'])).toBe(true);
    // The viewer's.
    expect(holoml.viewer['position']).toEqual([0, 1.6, 5]);
    expect(Object.isFrozen(holoml.viewer['position'])).toBe(true);
    expect(Object.isFrozen(holoml.viewer['direction'])).toBe(true);
    // A frozen array is a fine value to set: the thing takes its numbers.
    car['position'] = holoml.viewer['position'];
    expect(car['position']).toEqual([0, 1.6, 5]);
  });

  it("a sound's place is a frozen array, or null for a sound from everywhere; setting null is an error, and the place stays", () => {
    const { holoml } = scene();
    const here = holoml.find('here')!;
    expect(here['position']).toEqual([4, 1.6, 0]);
    expect(Object.isFrozen(here['position'])).toBe(true);
    expect(holoml.find('everywhere')!['position']).toBeNull();
    expect(() => (here['position'] = null)).toThrow(TypeError);
    expect(() => (here['position'] = undefined)).toThrow(TypeError);
    expect(here['position']).toEqual([4, 1.6, 0]);
    here['position'] = [0, 1, 2];
    expect(here['position']).toEqual([0, 1, 2]);
  });

  it("in a 0.3 page, setting a sound's place to null takes it away (milestone 25)", () => {
    const { holoml } = scene('0.3');
    const here = holoml.find('here')!;
    here['position'] = null;
    expect(here['position']).toBeNull();
    expect(() => (here['position'] = undefined)).toThrow(TypeError);
  });
});

describe("HoloML 0.3's members (milestone 25)", () => {
  function install(version: string) {
    const made = new Map<string, Entry>();
    for (const [kind, id] of [['model', 'lion'], ['group', 'hall'], ['animate', 'turn'], ['water', 'pool'], ['plan', 'map']] as const) {
      made.set(id, { kind, id, parent: null, removed: false, object: { visible: true }, children: [] } as unknown as Entry);
    }
    const calls: string[] = [];
    const labels = new Map<string, string | null>([['lion', 'A stone lion']]);
    const view = {
      pageVersion: version,
      findEntry: (id: string) => made.get(id) ?? null,
      listen: () => () => undefined,
      labelOf: (e: Entry) => labels.get(e.id!) ?? null,
      setLabel: (e: Entry, v: string | null) => labels.set(e.id!, v),
      startAnimation: (e: Entry) => calls.push(`start ${e.id}`),
      stopAnimation: (e: Entry) => calls.push(`stop ${e.id}`),
      animationRunning: () => true,
      waterLook: () => ({ color: '#1f6f8b', clarity: 15 }),
      setWaterColor: (_e: Entry, v: string) => calls.push(`color ${v}`),
      setWaterClarity: (_e: Entry, v: number) => calls.push(`clarity ${v}`),
      planVisible: () => true,
      setPlanVisible: (_e: Entry, v: boolean) => calls.push(`plan ${v}`),
      viewerPlace: 'hall',
      goToPlace: (id: string) => {
        calls.push(`go ${id}`);
        return id === 'terrace';
      },
    } as unknown as HolomlView;
    const win: { holoml?: Api } = {};
    (globalThis as { window?: unknown }).window = win;
    installApi(view, Promise.resolve());
    return { holoml: win.holoml!, calls, labels };
  }

  it("a 0.2 page's scripts have the API as it was: none of 0.3's kinds, members, or events", () => {
    const { holoml } = install('0.2');
    for (const id of ['turn', 'pool', 'map']) expect(holoml.find(id), id).toBeNull();
    for (const m of ADDED_03.viewer) expect(Object.keys(holoml.viewer), m).not.toContain(m);
    expect(Object.keys(holoml.find('lion')!)).not.toContain('label');
    expect(Object.keys(holoml.find('hall')!)).not.toContain('label');
    expect(() => holoml.on('place', () => undefined)).toThrow(TypeError);
  });

  it('a model and a group have a label; a script can change it, or set null for none', () => {
    const { holoml, labels } = install('0.3');
    const lion = holoml.find('lion')!;
    expect(lion['label']).toBe('A stone lion');
    lion['label'] = 'A lion of stone';
    expect(labels.get('lion')).toBe('A lion of stone');
    lion['label'] = null;
    expect(labels.get('lion')).toBeNull();
  });

  it('an animate starts and stops; the water changes, and refuses a clarity that is not more than 0; the plan hides', () => {
    const { holoml, calls } = install('0.3');
    const turn = holoml.find('turn')! as Record<string, unknown> & { start(): void; stop(): void };
    expect(turn['kind']).toBe('animate');
    turn.start();
    turn.stop();
    expect(turn['running']).toBe(true);
    const pool = holoml.find('pool')!;
    expect(pool['clarity']).toBe(15);
    pool['color'] = '#0A3';
    pool['clarity'] = 4;
    for (const bad of [0, -1, Number.NaN, '4']) expect(() => (pool['clarity'] = bad), String(bad)).toThrow(TypeError);
    expect(() => (pool['color'] = 'blue')).toThrow(TypeError);
    holoml.find('map')!['visible'] = false;
    expect(calls).toEqual(['start turn', 'stop turn', 'color #00aa33', 'clarity 4', 'plan false']);
  });

  it("the viewer's place, and goTo: an id that is not a place's is an error", () => {
    const { holoml, calls } = install('0.3');
    expect(holoml.viewer['place']).toBe('hall');
    (holoml.viewer['goTo'] as (id: string) => void)('terrace');
    expect(() => (holoml.viewer['goTo'] as (id: unknown) => void)('nowhere')).toThrow(TypeError);
    expect(() => (holoml.viewer['goTo'] as (id: unknown) => void)(3)).toThrow(TypeError);
    expect(calls).toEqual(['go terrace', 'go nowhere']);
  });
});
