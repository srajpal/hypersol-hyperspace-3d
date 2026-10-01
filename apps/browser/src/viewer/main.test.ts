import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Loads the viewer's entry script as a page would, up to where it waits
 * for the page's text: with or without the test run's mark on its script
 * element. Returns what it put on the window, and what it posted there.
 */
async function load(marked: boolean) {
  const posted: unknown[] = [];
  const mark = { removed: false, removeAttribute: () => (mark.removed = true) };
  const win: Record<string, unknown> = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    postMessage: (message: unknown) => posted.push(message),
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', {
    // Still loading: the viewer waits for the page's text, and builds nothing here.
    readyState: 'loading',
    addEventListener: () => undefined,
    querySelector: (selector: string) => (marked && selector === 'script[data-hypersol-holoml-test]' ? mark : null),
  });
  vi.resetModules();
  await import('./main');
  return { hooks: win['__holoml'] as Record<string, unknown>, posted, mark, win };
}

describe("what the viewer puts on a HoloML page's window (review 134, D12)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("in a normal run: only what the instrument panel's Scene part reads, frozen; nothing on the window acts", async () => {
    const { hooks } = await load(false);
    expect(Object.keys(hooks)).toEqual(['scene']);
    expect(Object.isFrozen(hooks)).toBe(true);
    // Read-only facts, as the inspector reads them before any scene is built.
    expect(hooks['scene']).toBeTypeOf('function');
    expect((hooks['scene'] as () => unknown)()).toMatchObject({ entryCount: 0, entries: [], selected: -1, picking: false, detail: null, models: [] });
    // None of the tests' hooks: nothing to read the scene's state with, and nothing else that acts.
    // (Choosing a thing and picking come over the private line from the main process, not from the window.)
    for (const name of ['select', 'pick', 'ready', 'frames', 'clock', 'view', 'models', 'point', 'linkAt', 'sounds', 'totals', 'walker', 'outline', 'drawing']) expect(hooks, name).not.toHaveProperty(name);
  });

  it("in a test run (the preload's mark on the viewer's script element): the tests' hooks too, and the mark is taken off", async () => {
    const { hooks, mark } = await load(true);
    expect(mark.removed).toBe(true);
    expect(Object.isFrozen(hooks)).toBe(true);
    for (const name of ['scene', 'ready', 'frames', 'clock', 'view', 'models', 'point', 'linkAt', 'sounds', 'totals', 'walker', 'outline', 'drawing', 'lightLimits']) expect(hooks, name).toHaveProperty(name);
    // Not in a test run either: the tests send the commands as the main process does.
    for (const name of ['select', 'pick']) expect(hooks, name).not.toHaveProperty(name);
    expect(hooks['ready']).toBe(false);
  });

  it('the hooks cannot be replaced from the page', async () => {
    const { win } = await load(false);
    const before = win['__holoml'];
    expect(() => {
      'use strict';
      (win as { __holoml: unknown }).__holoml = { scene: () => 'forged' };
    }).toThrow(TypeError);
    expect(win['__holoml']).toBe(before);
  });

  it('asks the preload for its private line as it starts, and posts nothing else on the window', async () => {
    const { posted } = await load(false);
    expect(posted).toEqual([{ hypersolHolomlViewer: true }]);
  });
});
