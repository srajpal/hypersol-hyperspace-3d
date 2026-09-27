/**
 * Milestone 12 end-to-end check N7 (TODO.md): on a computer where
 * Chromium cannot start WebGL 2, the app still starts, says plainly that
 * it cannot draw the 3D room, and pages still work (owner, prompt 60).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './fixture-server';
import { clickAt, inPage, launch, navigateTo, screenPointOf, shellCall, waitFor, waitForPage } from './harness';

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

const MESSAGE = 'hs-room-message [data-testid="room-message"]';

describe('N7: without WebGL 2', () => {
  it('starts, says it cannot draw the 3D room, and pages still load and take clicks', async () => {
    const h = await launch(server.url('form.html'), { noWebGL: true });
    try {
      await waitForPage(h, 'form');
      expect(await shellCall(h, 'drawsRoom')).toBe(false);
      const message = h.shell.locator(MESSAGE);
      await message.waitFor({ state: 'visible' });
      expect(await message.getAttribute('role')).toBe('alert');
      expect(await message.textContent()).toContain("This computer can't draw the 3D room");
      expect(await message.textContent()).toContain('WebGL 2');

      // The page, drawn by CSS, still takes clicks and typing focus.
      await clickAt(h, await screenPointOf(h, '#name', 'form'));
      await waitFor('field focused', () => inPage<string>(h, 'document.activeElement.id', 'form'), (id) => id === 'name');
      // And the address bar still loads pages.
      await navigateTo(h, server.url('link-a.html'));
      await waitForPage(h, 'link-a');

      await h.shell.click('hs-room-message [data-testid="room-message-close"]');
      await message.waitFor({ state: 'detached' });
    } finally {
      await h.close();
    }
  });

  it('with WebGL 2, the room is drawn and there is no message', async () => {
    const h = await launch(server.url('form.html'));
    try {
      await waitForPage(h, 'form');
      expect(await shellCall(h, 'drawsRoom')).toBe(true);
      expect(await h.shell.locator(MESSAGE).count()).toBe(0);
    } finally {
      await h.close();
    }
  });
});
