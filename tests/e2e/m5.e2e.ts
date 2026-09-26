/**
 * Milestone 5 end-to-end checks G1 to G9 (TODO.md): the layers view,
 * input through it, pinned page parts, the button and shortcut, the
 * global and per-site settings, image rectangles, pages that change,
 * reduced motion, and efficiency.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import {
  clickAt,
  focusedPage,
  inPage,
  launch,
  navigateTo,
  pressInShell,
  project,
  removeFolder,
  screenPointOf,
  setContentSize,
  shellCall,
  sleep,
  typeInPage,
  waitFor,
  waitForPage,
  type Harness,
} from './harness';

let server: FixtureServer;
const profiles: string[] = [];

function newProfile(settings?: object): string {
  const dir = mkdtempSync(join(tmpdir(), 'hypersol-e2e-profile-'));
  profiles.push(dir);
  if (settings) writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings));
  return dir;
}

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
  for (const dir of profiles) await removeFolder(dir);
});

const PAGE = 'layers.html';
const LAYERS_BUTTON = 'hs-toolbar [data-testid="layers"]';
const SET = (id: string) => `hs-settings [data-testid="${id}"]`;
/** Lifted elements, by id or tag. */
const lifted = (h: Harness) =>
  inPage<string[]>(h, `[...document.querySelectorAll('[data-hs-layer]')].map((e) => e.id || e.tagName.toLowerCase())`, PAGE);
const rects = (h: Harness) =>
  inPage<Record<string, number[]>>(
    h,
    `Object.fromEntries(['hero', 'cards', 'form', 'hero-img', 'target'].map((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return [id, [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10)];
    }))`,
    PAGE,
  );
const layersOn = async (h: Harness) => (await shellCall(h, 'layers')).on;

async function openSettings(h: Harness): Promise<void> {
  if ((await shellCall(h, 'openPanel')) !== 'settings') await pressInShell(h, ',', ['control']);
  await waitFor('settings open', () => shellCall(h, 'openPanel'), (p) => p === 'settings');
}

describe('G1 to G3, G7: the layers view on a page', () => {
  let h: Harness;
  let flat: Record<string, number[]>;
  beforeAll(async () => {
    // Opens flat (global setting off), to measure the page as it is.
    h = await launch(server.url(PAGE), { userDataDir: newProfile({ layersOnOpen: false }) });
    await waitForPage(h, PAGE);
    await sleep(500);
    flat = await rects(h);
  });
  afterAll(async () => h?.close());

  it('G1 lifts the sections and images, and switching off restores the page exactly', async () => {
    expect(await layersOn(h)).toBe(false);
    expect(await lifted(h)).toEqual([]);
    await h.shell.click(LAYERS_BUTTON);
    await waitFor('layers on', () => lifted(h), (l) => l.length > 0);
    const on = await lifted(h);
    expect(on).toEqual(expect.arrayContaining(['hero', 'cards', 'form', 'long', 'hero-img', 'img']));
    expect(on).not.toContain('spin'); // the page transforms it itself
    expect(on).not.toContain('pinned');
    expect(await h.shell.locator(LAYERS_BUTTON).getAttribute('aria-pressed')).toBe('true');
    await sleep(400); // the lift animates
    const up = await rects(h);
    expect(up['hero']).not.toEqual(flat['hero']);
    expect(up['hero-img']![2]).toBeGreaterThan(flat['hero-img']![2]!); // nearer, so larger

    await h.shell.click(LAYERS_BUTTON);
    await waitFor('layers off', () => lifted(h), (l) => l.length === 0);
    expect(await rects(h)).toEqual(flat);
    expect(await inPage<number>(h, `document.querySelectorAll('[style*="--hs-lift"]').length`, PAGE)).toBe(0);
    expect(await inPage<boolean>(h, `document.documentElement.hasAttribute('data-hs-animating')`, PAGE)).toBe(false);
  });

  it('G2 clicks, typing, and scrolling land where they should', async () => {
    await h.shell.click(LAYERS_BUTTON);
    await waitFor('layers on', () => lifted(h), (l) => l.includes('form'));
    await inPage(h, `document.getElementById('form').scrollIntoView({ block: 'center' })`, PAGE);
    await sleep(500);
    await clickAt(h, await screenPointOf(h, '#target', PAGE));
    await waitFor('the button clicked', () => inPage<number>(h, 'window.clicks', PAGE), (n) => n === 1);
    await clickAt(h, await screenPointOf(h, '#field', PAGE));
    await waitFor('field focused', () => inPage<string>(h, 'document.activeElement.id', PAGE), (id) => id === 'field');
    await typeInPage(h, 'layers', PAGE);
    await waitFor('typed', () => inPage<string>(h, `document.getElementById('field').value`, PAGE), (v) => v === 'layers');
    const layout = await shellCall(h, 'layout');
    const p = await project(h, layout.panelWidth / 2, layout.panelHeight / 2);
    const before = await inPage<number>(h, 'window.scrollY', PAGE);
    await h.shell.mouse.move(p.x, p.y);
    await h.shell.mouse.wheel(0, 300);
    await waitFor('page scrolled', () => inPage<number>(h, 'window.scrollY', PAGE), (y) => y > before);
  });

  it('G3 a fixed header stays in place', async () => {
    expect(await layersOn(h)).toBe(true);
    const top = () => inPage<number>(h, `document.getElementById('pinned').getBoundingClientRect().top`, PAGE);
    await inPage(h, 'window.scrollTo(0, 0)', PAGE);
    await sleep(200);
    expect(await top()).toBe(0);
    await inPage(h, 'window.scrollTo(0, 500)', PAGE);
    await sleep(300);
    expect(await top()).toBe(0);
    expect(await inPage<string>(h, `getComputedStyle(document.getElementById('pinned')).transform`, PAGE)).toBe('none');
  });

  it('G7 layers sections the page adds later, and leaves nothing behind when switched off', async () => {
    await inPage(h, 'window.addSection()', PAGE);
    await waitFor('new section lifted', () => lifted(h), (l) => l.includes('late'));
    await pressInShell(h, 'L', ['control', 'shift']);
    await waitFor('layers off', () => lifted(h), (l) => l.length === 0);
    expect(await inPage<number>(h, `document.querySelectorAll('[style*="--hs-lift"]').length`, PAGE)).toBe(0);
  });
});

describe('G4 to G6: switching, settings, and image rectangles', () => {
  it('G4 the button and shortcut switch the view for the tab in front only', async () => {
    const h = await launch(server.url(PAGE), { userDataDir: newProfile() });
    try {
      await waitForPage(h, PAGE);
      await waitFor('on by default', () => layersOn(h), (on) => on);
      const first = await shellCall(h, 'focusedTabId');
      await pressInShell(h, 'T', ['control']);
      await navigateTo(h, server.url(PAGE));
      await waitFor('second tab on', () => layersOn(h), (on) => on);
      await pressInShell(h, 'L', ['control', 'shift']);
      await waitFor('second tab off', () => layersOn(h), (on) => !on);
      expect(await h.shell.locator(LAYERS_BUTTON).getAttribute('aria-pressed')).toBe('false');
      // The first tab is untouched until its page loads again.
      expect(await shellCall(h, 'layersOf', first)).toBe(true);
      const page = await focusedPage(h);
      await waitFor('the page flat again', () => inPage<number>(h, `document.querySelectorAll('[data-hs-layer]').length`, page), (n) => n === 0);
    } finally {
      await h.close();
    }
  });

  it('G5 the global switch sets how pages open, a site choice wins, and both last; clearing works', async () => {
    const profile = newProfile();
    let h = await launch(server.url('link-a.html'), { userDataDir: profile });
    try {
      await waitForPage(h, 'link-a');
      await openSettings(h);
      expect(await h.shell.locator(SET('set-layers-on-open')).isChecked()).toBe(true);
      await h.shell.click(SET('set-layers-on-open'));
      await waitFor('saved', () => Promise.resolve(JSON.parse(readFileSync(join(profile, 'settings.json'), 'utf8')).layersOnOpen), (v) => v === false);
      await pressInShell(h, 'Escape');
      await navigateTo(h, server.url(PAGE));
      await waitForPage(h, PAGE);
      await sleep(300);
      expect(await layersOn(h)).toBe(false); // global off
      await h.shell.click(LAYERS_BUTTON); // remembered for 127.0.0.1
      await waitFor('on', () => layersOn(h), (on) => on);
      await waitFor('site choice saved', () =>
        Promise.resolve(JSON.parse(readFileSync(join(profile, 'settings.json'), 'utf8')).layersSites), (s) => s?.['127.0.0.1'] === true);
    } finally {
      await h.close();
    }
    h = await launch(server.url(PAGE), { userDataDir: profile });
    try {
      await waitForPage(h, PAGE);
      await waitFor('site choice wins after a restart', () => layersOn(h), (on) => on);
      await openSettings(h);
      expect(await h.shell.locator(SET('set-layers-on-open')).isChecked()).toBe(false);
      expect(await h.shell.locator(SET('set-layers-sites')).textContent()).toContain('1 site has');
      await h.shell.click(SET('set-layers-forget'));
      await waitFor('forgotten', () => Promise.resolve(JSON.parse(readFileSync(join(profile, 'settings.json'), 'utf8')).layersSites), (s) =>
        Object.keys(s ?? { x: 1 }).length === 0);
      await pressInShell(h, 'Escape');
      await pressInShell(h, 'R', ['control']);
      await waitForPage(h, PAGE);
      await sleep(300);
      expect(await layersOn(h)).toBe(false); // back to the global switch
    } finally {
      await h.close();
    }
  });

  it('G6 reports image rectangles, and updates them after scrolling and resizing', async () => {
    const h = await launch(server.url(PAGE), { userDataDir: newProfile({ layersOnOpen: false }) });
    try {
      await waitForPage(h, PAGE);
      const hero = async () => (await shellCall(h, 'layers')).images.find((i) => i.alt === 'Hero picture');
      await waitFor('images reported', async () => (await shellCall(h, 'layers')).images.length, (n) => n === 4);
      const actual = await inPage<number[]>(h, `(() => { const r = document.getElementById('hero-img').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`, PAGE);
      const reported = await hero();
      // Page offsets are whole CSS pixels; the browser's own rectangle can have fractions.
      [reported!.x, reported!.y, reported!.width, reported!.height].forEach((v, i) => expect(Math.abs(v - actual[i]!)).toBeLessThan(1));
      expect(reported!.src).toBe(server.url('icon.png?hero'));
      expect(reported!.kind).toBe('img');

      await inPage(h, 'window.scrollTo(0, 100)', PAGE);
      await waitFor('moved up by the scroll', hero, (i) => i?.y === reported!.y - 100);

      const x = (await hero())!.x;
      await setContentSize(h, 1100, 760);
      await waitFor('moved by the resize', hero, (i) => i !== undefined && i.x !== x);

      // With the view on, the reported rectangle is still the page's own layout, not the lift.
      await inPage(h, 'window.scrollTo(0, 0)', PAGE);
      const flatHero = await waitFor('settled', hero, (i) => i?.y === reported!.y);
      await h.shell.click(LAYERS_BUTTON);
      await waitFor('layers on', () => layersOn(h), (on) => on);
      await sleep(600);
      expect(await hero()).toEqual(flatHero);
    } finally {
      await h.close();
    }
  });
});

describe('G8 and G9: motion and efficiency', () => {
  it('G8 switches without animation when the system asks for reduced motion', async () => {
    const h = await launch(server.url(PAGE), { userDataDir: newProfile({ layersOnOpen: false }) });
    try {
      await waitForPage(h, PAGE);
      const duration = () =>
        inPage<string>(h, `(() => { const e = document.querySelector('[data-hs-layer]'); return e ? getComputedStyle(e).transitionDuration : ''; })()`, PAGE);
      await h.shell.click(LAYERS_BUTTON);
      await waitFor('animating', duration, (d) => d === '0.25s');
      await h.shell.click(LAYERS_BUTTON);
      await waitFor('off', () => lifted(h), (l) => l.length === 0);
      // Ask the page for reduced motion, as the system setting would.
      const page = await focusedPage(h);
      await h.app.evaluate(async ({ webContents }, id) => {
        const guest = webContents.fromId(id)!;
        guest.debugger.attach();
        await guest.debugger.sendCommand('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
        });
      }, page.id);
      await h.shell.click(LAYERS_BUTTON);
      await waitFor('lifted', () => lifted(h), (l) => l.length > 0);
      expect(await duration()).toBe('0s');
    } finally {
      await h.close();
    }
  });

  it('G9 idle with the view on draws nothing, and scrolling keeps its frame rate', async () => {
    const h = await launch(server.url(PAGE), { userDataDir: newProfile() });
    try {
      await waitForPage(h, PAGE);
      await waitFor('on', () => layersOn(h), (on) => on);
      await sleep(1500);
      const before = await shellCall(h, 'frames');
      await sleep(2000);
      expect(await shellCall(h, 'frames')).toBe(before);
      const timing = await inPage<{ avg: number; max: number }>(
        h,
        `new Promise((r) => { const t = []; let last = performance.now(); let n = 0;
          const f = (now) => { t.push(now - last); last = now; window.scrollBy(0, 8); if (++n < 90) requestAnimationFrame(f);
            else r({ avg: t.reduce((a, b) => a + b, 0) / t.length, max: Math.max(...t) }); };
          requestAnimationFrame(f); })`,
        PAGE,
      );
      console.log(`G9: scrolling with the layers view, ${timing.avg.toFixed(1)} ms per frame on average, ${timing.max.toFixed(1)} ms at most`);
      expect(timing.avg).toBeLessThan(20);
    } finally {
      await h.close();
    }
  });
});

describe('GitHub issues #9, #11, #14: the layers view and changing pages', () => {
  it('#9 lets go of an element when the page transforms, animates, or pins it after it was lifted; no churn', async () => {
    const h = await launch(server.url(PAGE), { userDataDir: newProfile() });
    try {
      await waitForPage(h, PAGE);
      await waitFor('layers on', () => lifted(h), (l) => l.includes('hero') && l.includes('cards') && l.includes('form'));
      const layerOf = (id: string) => inPage<string | null>(h, `document.getElementById('${id}').getAttribute('data-hs-layer')`, PAGE);
      // Inline style.
      await inPage(h, `document.getElementById('hero').style.transform = 'translateX(80px)'`, PAGE);
      await waitFor('hero let go', () => layerOf('hero'), (l) => l === null);
      expect(await inPage<string>(h, `getComputedStyle(document.getElementById('hero')).transform`, PAGE)).toBe('matrix(1, 0, 0, 1, 80, 0)');
      // A class from the page's own stylesheet.
      await inPage(h, `(() => { const s = document.createElement('style'); s.textContent = '.moved { transform: translateY(10px); }'; document.head.append(s); document.getElementById('cards').classList.add('moved'); })()`, PAGE);
      await waitFor('cards let go', () => layerOf('cards'), (l) => l === null);
      expect(await inPage<string>(h, `getComputedStyle(document.getElementById('cards')).transform`, PAGE)).toBe('matrix(1, 0, 0, 1, 0, 10)');
      // Pinned afterwards.
      await inPage(h, `document.getElementById('form').style.position = 'fixed'`, PAGE);
      await waitFor('form let go', () => layerOf('form'), (l) => l === null);
      // Nothing keeps changing once the page is still (our own style updates are not page changes).
      await sleep(800);
      await inPage(h, `window.__hsChanges = 0; new MutationObserver((r) => (window.__hsChanges += r.length)).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-hs-layer'] })`, PAGE);
      await sleep(1500);
      expect(await inPage<number>(h, 'window.__hsChanges', PAGE)).toBe(0);
      // Off and on again: still left alone.
      await pressInShell(h, 'L', ['control', 'shift']);
      await waitFor('off', () => lifted(h), (l) => l.length === 0);
      await pressInShell(h, 'L', ['control', 'shift']);
      await waitFor('on', () => lifted(h), (l) => l.includes('long'));
      expect(await lifted(h)).not.toEqual(expect.arrayContaining(['hero']));
      expect(await inPage<string>(h, `getComputedStyle(document.getElementById('hero')).transform`, PAGE)).toBe('matrix(1, 0, 0, 1, 80, 0)');
    } finally {
      await h.close();
    }
  });

  it('#9 (review) lets go of a section when a fixed element is added inside it, or a class on it pins a child', async () => {
    const h = await launch(server.url(PAGE), { userDataDir: newProfile() });
    try {
      await waitForPage(h, PAGE);
      await waitFor('layers on', () => lifted(h), (l) => l.includes('hero') && l.includes('form'));
      const layerOf = (id: string) => inPage<string | null>(h, `document.getElementById('${id}').getAttribute('data-hs-layer')`, PAGE);
      // A fixed element added inside a lifted section.
      await inPage(h, `(() => { const p = document.createElement('div'); p.id = 'new-fixed'; p.style.cssText = 'position:fixed;top:0;left:0;width:100px;height:30px'; p.textContent = 'fixed'; document.getElementById('hero').append(p); })()`, PAGE);
      // Promptly: the layers are chosen again once the new element has been checked.
      await waitFor('hero let go', () => layerOf('hero'), (l) => l === null, 3000);
      const top = () => inPage<number>(h, `document.getElementById('new-fixed').getBoundingClientRect().top`, PAGE);
      const before = await top();
      await inPage(h, 'window.scrollTo(0, 200)', PAGE);
      await sleep(300);
      expect(Math.abs((await top()) - before)).toBeLessThan(1); // it stays put, as fixed means
      await inPage(h, 'window.scrollTo(0, 0)', PAGE);
      // A class on a lifted section that pins something inside it, through the page's stylesheet.
      await inPage(h, `(() => { const s = document.createElement('style'); s.textContent = '.pin-field #field { position: fixed; top: 0; left: 0; }'; document.head.append(s); document.getElementById('form').classList.add('pin-field'); })()`, PAGE);
      await waitFor('form let go', () => layerOf('form'), (l) => l === null, 3000);
      expect(await inPage<string>(h, `getComputedStyle(document.getElementById('field')).position`, PAGE)).toBe('fixed');
    } finally {
      await h.close();
    }
  });

  it('#11 keeps a 20,000-element page responsive while it changes, with the layers view on', async () => {
    const h = await launch(server.url('large.html'), { userDataDir: newProfile() });
    try {
      await waitForPage(h, 'large.html');
      await waitFor('built', () => inPage<string>(h, 'document.title', 'large.html'), (t) => t === 'Large page ready');
      expect(await layersOn(h)).toBe(true);
      await sleep(1500); // the first scan settles
      await inPage(h, 'window.longTasks = []', 'large.html');
      for (let i = 0; i < 6; i++) {
        await inPage(h, 'window.addRow()', 'large.html');
        await sleep(600);
      }
      const tasks = await inPage<number[]>(h, 'window.longTasks', 'large.html');
      console.log(`#11: long tasks while the page changed: ${JSON.stringify(tasks.map((t) => Math.round(t)))}`);
      // Budget: no pause of 50 ms or more (a long task) while the page changes.
      expect(tasks.filter((t) => t >= 50)).toEqual([]);
    } finally {
      await h.close();
    }
  });

  it('#14 follows scrolling inside boxes: image reports and the lift of layers inside them', async () => {
    const h = await launch(server.url(PAGE), { userDataDir: newProfile() });
    try {
      await waitForPage(h, PAGE);
      await inPage(
        h,
        `(() => {
          const box = document.createElement('div');
          box.id = 'scroller';
          box.style.cssText = 'height:240px;width:400px;overflow:auto';
          box.innerHTML = '<div style="width:1200px"><img id="moving" alt="Moving" src="/icon.png?nested" width="160" height="100"><div style="height:2000px"></div></div>';
          document.getElementById('hero').append(box);
        })()`,
        PAGE,
      );
      const moving = async () => (await shellCall(h, 'layers')).images.find((i) => i.alt === 'Moving');
      const start = await waitFor('reported', moving, (i) => i !== undefined);
      await waitFor('lifted', () => lifted(h), (l) => l.includes('moving'));
      const liftBefore = await inPage<string>(h, `document.getElementById('moving').style.getPropertyValue('--hs-lift')`, PAGE);
      await inPage(h, `document.getElementById('scroller').scrollTop = 180`, PAGE);
      await waitFor('moved up in the report', moving, (i) => i !== undefined && Math.abs(i.y - (start!.y - 180)) < 1);
      await waitFor('lift follows', () => inPage<string>(h, `document.getElementById('moving').style.getPropertyValue('--hs-lift')`, PAGE), (v) => v !== liftBefore);
      await inPage(h, `document.getElementById('scroller').scrollLeft = 120`, PAGE);
      await waitFor('moved left in the report', moving, (i) => i !== undefined && Math.abs(i.x - (start!.x - 120)) < 1);
    } finally {
      await h.close();
    }
  });
});
