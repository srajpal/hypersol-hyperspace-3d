import { describe, expect, it } from 'vitest';
import { MAX_LIFT_ITEMS, chooseToLift, isModelAddress, modelFileName, parseLiftAnswer, parseLiftItem, parseLiftItems, shownPart, type LiftItem } from './lift';

/** Milestone 28 (check LT1): what a page's preload says can be lifted, as the shell and the main process check it. */

const item = (over: Omit<Partial<LiftItem>, 'rect'> & { rect?: Partial<LiftItem['rect']> } = {}): LiftItem => ({
  id: 1,
  kind: 'img',
  src: '',
  name: 'A picture',
  ...over,
  rect: { x: 10, y: 20, width: 100, height: 80, ...over.rect },
});

describe('isModelAddress', () => {
  it('is an http or https address whose path ends in .glb or .gltf', () => {
    expect(isModelAddress('https://site.example/models/chair.glb')).toBe(true);
    expect(isModelAddress('http://site.example/a/b/Chair.GLTF?v=2#x')).toBe(true);
    expect(isModelAddress('https://site.example/chair.glb.html')).toBe(false);
    expect(isModelAddress('https://site.example/page?file=chair.glb')).toBe(false);
    expect(isModelAddress('file:///C:/models/chair.glb')).toBe(false);
    expect(isModelAddress('data:model/gltf-binary;base64,AAAA.glb')).toBe(false);
    expect(isModelAddress('blob:https://site.example/1234.glb')).toBe(false);
    expect(isModelAddress('not an address.glb')).toBe(false);
    expect(isModelAddress(`https://site.example/${'a'.repeat(2048)}.glb`)).toBe(false);
  });

  it("names a model by its file's name", () => {
    expect(modelFileName('https://site.example/models/old%20chair.glb?v=1')).toBe('old chair.glb');
    expect(modelFileName('nonsense')).toBe('');
  });
});

describe('parseLiftItem', () => {
  it('takes a picture and a model as they are', () => {
    expect(parseLiftItem(item())).toEqual(item());
    const model = item({ kind: 'model', src: 'https://site.example/chair.glb', name: '  Old \n chair ' });
    expect(parseLiftItem(model)).toEqual({ ...model, name: 'Old chair' });
  });

  it("drops a picture's address (pictures are captured, never fetched) and cuts a long name", () => {
    expect(parseLiftItem(item({ src: 'https://tracker.example/x.png' }))!.src).toBe('');
    expect(parseLiftItem(item({ name: 'x'.repeat(500) }))!.name).toHaveLength(200);
  });

  it('refuses what is malformed', () => {
    const bad: unknown[] = [
      null,
      'picture',
      { ...item(), id: -1 },
      { ...item(), id: 1.5 },
      { ...item(), kind: 'iframe' },
      { ...item(), rect: { x: 0, y: 0, width: 0, height: 10 } },
      { ...item(), rect: { x: 0, y: 0, width: Number.NaN, height: 10 } },
      { ...item(), rect: { x: 0, y: 0, width: 1e7, height: 10 } },
      { ...item(), rect: null },
      // A model must name a model file on the web.
      { ...item(), kind: 'model', src: '' },
      { ...item(), kind: 'model', src: 'file:///etc/passwd.glb' },
      { ...item(), kind: 'model', src: 'https://site.example/readme.txt' },
    ];
    for (const b of bad) expect(parseLiftItem(b), JSON.stringify(b)).toBeNull();
  });

  it('refuses a whole list with one bad item, or too many', () => {
    expect(parseLiftItems([item(), item({ id: 2 })])).toHaveLength(2);
    expect(parseLiftItems([item(), { ...item(), kind: 'object' }])).toBeNull();
    expect(parseLiftItems(Array.from({ length: MAX_LIFT_ITEMS + 1 }, (_, i) => item({ id: i })))).toBeNull();
    expect(parseLiftItems('nope')).toBeNull();
    expect(parseLiftAnswer({ seq: 3, items: [item()] })).toEqual({ seq: 3, items: [item()] });
    expect(parseLiftAnswer({ seq: '3', items: [] })).toBeNull();
    expect(parseLiftAnswer({ seq: 3, items: [null] })).toBeNull();
  });
});

describe('shownPart', () => {
  it('is the part inside the view, if enough of it shows', () => {
    const view = { width: 800, height: 600 };
    expect(shownPart({ x: -20, y: 550, width: 100, height: 100 }, view, 48)).toEqual({ x: 0, y: 550, width: 80, height: 50 });
    expect(shownPart({ x: 10, y: 570, width: 100, height: 100 }, view, 48)).toBeNull();
    expect(shownPart({ x: 900, y: 0, width: 100, height: 100 }, view, 1)).toBeNull();
  });
});

describe('chooseToLift', () => {
  it('pictures of at least 48 pixels each way and every model, not those already lifted, in the page\'s order', () => {
    const items = [
      item({ id: 1, name: 'big', rect: { width: 300, height: 200 } }),
      item({ id: 2, name: 'thin', rect: { width: 300, height: 40 } }),
      item({ id: 3, kind: 'model', src: 'https://s.example/a.glb', name: 'link', rect: { y: 30, width: 60, height: 14 } }),
      item({ id: 4, name: 'lifted' }),
      item({ id: 5, name: 'small', rect: { y: 400, width: 48, height: 48 } }),
      item({ id: 5, name: 'small again' }),
    ];
    expect(chooseToLift(items, new Set([4]), 12).map((i) => i.name)).toEqual(['big', 'link', 'small']);
  });

  it('no more than the room left: models first, then pictures, each in the page\'s order', () => {
    const items = [
      item({ id: 1, name: 'p1' }),
      item({ id: 2, name: 'p2' }),
      item({ id: 3, kind: 'model', src: 'https://s.example/a.glb', name: 'm1' }),
      item({ id: 4, name: 'p3' }),
    ];
    expect(chooseToLift(items, new Set(), 2).map((i) => i.name)).toEqual(['p1', 'm1']);
    expect(chooseToLift(items, new Set(), 0)).toEqual([]);
    expect(chooseToLift(items, new Set(), -3)).toEqual([]);
  });
});
