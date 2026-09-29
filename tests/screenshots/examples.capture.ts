/**
 * The pictures on the HoloML examples cards (milestone 17): one of each
 * example site, from the local copies (tests/fixtures/holoml, copied by
 * pnpm holoml:sync), so this run uses no network.
 *
 *   pnpm screenshots:examples
 *   EXAMPLES_ONLY=sneaker-store pnpm screenshots:examples   (just one, or several separated by commas)
 *
 * They are part of the browser (apps/browser/src/renderer/examples/), so
 * run it before `pnpm screenshots` when an example changes, and build
 * again.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { startFixtureServer } from '../e2e/fixture-server';
import { inPage, launch, shellCall, sleep, waitFor, waitForPage, type Harness } from '../e2e/harness';

const OUT = fileURLToPath(new URL('../../apps/browser/src/renderer/examples/', import.meta.url));

/** Places the aquarium's fish as they might pass the tunnel, for its picture. */
const AQUARIUM_FISH = `() => {
  const put = (id, p, yaw) => { const t = holoml.find(id); if (t) { t.position = p; t.rotation = [0, yaw, 0]; } };
  put('shark-1', [-1.4, 3.8, -1.2], 75);
  put('shark-2', [4.5, 4.7, -10], -110);
  put('turtle-1', [2.7, 3.1, -3.2], -135);
  put('tuna-1', [1.0, 5.0, -6.8], -70);
  put('tuna-2', [2.1, 5.4, -7.6], -65);
  put('barramundi-1', [-4.4, 1.2, -3.5], 120);
  [[-3.3, 1.5, 0.6], [-3.7, 1.8, 0.2], [-3.1, 1.2, -0.2], [-3.9, 1.3, 1.0], [-3.5, 2.0, 1.2], [-4.0, 1.6, -0.5]].forEach((p, i) => put('bream-' + (i + 1), p, 150 + i * 5));
  [[0.2, 5.4, -3.2], [0.6, 5.2, -3.6], [1.0, 5.5, -3.0], [-0.2, 5.1, -3.8], [0.4, 5.7, -4.1], [0.9, 5.0, -4.4], [-0.5, 5.5, -2.9], [1.3, 5.3, -3.9]].forEach((p, i) => put('mackerel-' + (i + 1), p, 100 + i * 3));
  [[-2.9, 0.6, 1.9], [-3.1, 0.7, 2.3]].forEach((p, i) => put('clownfish-' + (i + 1), p, 80 + i * 20));
  put('butterflyfish-1', [2.9, 0.9, 1.2], -100);
}`;

/**
 * Each example, the page to show, and what to do before the picture: page
 * code to run in turn, each followed by a pause, and a condition to wait
 * for.
 */
const SHOTS: { id: string; page: string; steps?: [string, number][]; until?: string; still?: boolean }[] = [
  { id: 'showroom', page: 'showroom/index.holoml' },
  {
    // Late afternoon, the whole island from above one corner: the viewer
    // stands on a pillar of stone blocks there, as a player could build,
    // after the welcome message has gone.
    id: 'blockworld',
    page: 'blockworld/index.holoml?hour=16.3',
    steps: [
      [`holoml.add(${JSON.stringify(pillar(12, 12, 11))}), true`, 300],
      ['holoml.viewer.position = [12.5, 12.7, 12.5], true', 900],
      ['holoml.viewer.lookAt([0, 2, 0]), true', 0],
    ],
    until: "holoml.find('message').text === ''",
  },
  {
    // In the day's light, with the blue linen chosen (as a visitor would).
    id: 'sofa-studio',
    page: 'sofa-studio/index.holoml',
    steps: [[`document.querySelector('[data-id="fabric"] input[value="linen"]').click(), true`, 1500]],
  },
  {
    // The living room by day, from beside the bedroom's door: the harbour
    // through the windows, the dining table, the island, and the door up
    // to the roof terrace.
    id: 'harbour-loft',
    page: 'harbour-loft/index.holoml',
    steps: [
      ['holoml.viewer.position = [1.3, 1.65, -0.6], true', 300],
      ['holoml.viewer.lookAt([-3, 1, 3]), true', 0],
    ],
  },
  {
    // Beside the first bay, its six blue shoes close and the hall going back
    // to the counter (the bays near the entrance load with the page).
    id: 'sneaker-store',
    page: 'sneaker-store/index.holoml',
    steps: [
      ['holoml.viewer.position = [-0.8, 1.55, -1.8], true', 300],
      ['holoml.viewer.lookAt([-4.6, 1.4, -7]), true', 0],
    ],
  },
  {
    // In the tunnel, looking up and ahead, with the fish placed as they
    // might pass (reduced motion holds them where the page's script is
    // told they are): a shark over the glass, the turtle, tuna, and schools.
    id: 'aquarium',
    page: 'aquarium/index.holoml#tunnel',
    still: true,
    steps: [
      [`(${AQUARIUM_FISH})(), true`, 300],
      ['holoml.viewer.position = [0.4, 1.3, 3.5], true', 300],
      ['holoml.viewer.lookAt([-1.5, 3.2, -4]), true', 1500],
    ],
  },
];

/** Stone blocks from the ground up to a height, at one column. */
function pillar(x: number, z: number, height: number): string {
  const blocks: string[] = [];
  for (let y = 0; y < height; y++) blocks.push(`<model src="models/stone.gltf" position="${x + 0.5} ${y + 0.5} ${z + 0.5}" solid />`);
  return blocks.join(' ');
}

it('captures the pictures of the HoloML examples', async () => {
  const server = await startFixtureServer();
  const h = await launch(server.url('link-a.html'));
  try {
    await waitForPage(h, 'link-a.html');
    const only = process.env['EXAMPLES_ONLY']?.split(',');
    for (const shot of SHOTS.filter((s) => !only || only.includes(s.id))) {
      await reducedMotion(h, shot.still === true);
      await shellCall(h, 'showUrl', server.url(`holoml/${shot.page}`));
      const part = shot.page.split(/[?#]/)[0]!;
      await waitForPage(h, part);
      await waitFor(`${shot.id} ready`, () => inPage<boolean>(h, 'window.__holoml?.ready === true', part), (r) => r, 30_000);
      // A walker with gravity falls to the ground first (one without stays where it starts); then the view is set.
      await waitFor('standing', () => inPage<boolean>(h, '((w) => !w || !w.gravity || w.onGround)(window.__holoml.walker())', part), (v) => v, 15_000);
      for (const [code, pause] of shot.steps ?? []) {
        await inPage(h, code, part);
        await sleep(pause);
      }
      if (shot.until) await waitFor('the picture', () => inPage<boolean>(h, shot.until!, part), (v) => v, 15_000);
      await sleep(1500);
      // The page alone (not the browser around it), 720 by 450, as JPEG.
      const jpeg = await h.app.evaluate(async ({ webContents }, part) => {
        const page = webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && w.getURL().includes(part)).pop()!;
        const image = await page.capturePage();
        const { width, height } = image.getSize();
        const h = Math.round((width * 10) / 16);
        const cropped = image.crop({ x: 0, y: Math.max(0, Math.round((height - h) / 2)), width, height: Math.min(height, h) });
        return cropped.resize({ width: 720, height: 450, quality: 'best' }).toJPEG(84).toString('base64');
      }, part);
      writeFileSync(`${OUT}${shot.id}.jpg`, Buffer.from(jpeg, 'base64'));
    }
  } finally {
    await h.close();
    await server.close();
  }
}, 180_000);

/** Emulates (or stops emulating) reduced motion in the tab's page; it lasts across the tab's navigations while on. */
async function reducedMotion(h: Harness, on: boolean): Promise<void> {
  await h.app.evaluate(async ({ webContents }, on) => {
    const guest = webContents.getAllWebContents().filter((w) => w.getType() === 'webview').pop()!;
    if (on) {
      if (!guest.debugger.isAttached()) guest.debugger.attach('1.3');
      await guest.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    } else if (guest.debugger.isAttached()) {
      await guest.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
      guest.debugger.detach();
    }
  }, on);
}
