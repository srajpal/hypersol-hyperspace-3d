/**
 * Y3 (milestone 22): HyperSpace 3D's scene API has every member of
 * HoloML's Web IDL (SPEC.md appendix A.3, copied from the holoml
 * repository into packages/holoml/src/holoml.webidl by pnpm holoml:sync),
 * and nothing else: the `holoml` object, the viewer, each kind of thing,
 * a hit, a material's change, and the events. The API is installed against
 * a stand-in for the scene, which is all it needs to make its objects.
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

const KINDS = { model: 'ModelThing', group: 'GroupThing', light: 'LightThing', label: 'LabelThing', panel: 'PanelThing', sound: 'SoundThing', hud: 'HudThing', slider: 'SliderThing', choice: 'ChoiceThing' } as const;

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
    pageVersion: '0.2',
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
    ];
    for (const e of events) {
      api.on(e.type, (event) => seen.push(event));
      listeners.get(e.type)!(e);
    }
    expect(seen.map((e) => e['type'])).toEqual(events.map((e) => e.type));
    expect(sorted(seen.flatMap((e) => Object.keys(e)))).toEqual(sorted(membersOf('HoloMLEvent')));
  });
});
