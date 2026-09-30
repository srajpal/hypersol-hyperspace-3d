import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { daylight, nebula, type Theme } from '@hypersol/themes';
import { parseAccountsReply } from '../../shared/page-passwords';
import { Passwords } from './index';
import type { PasswordVault } from './vault';

const SITE = 'https://shop.example';

function setup(theme: () => Theme, isPrivate = false) {
  const vault = {
    accounts: (origin: string) => (origin === SITE ? ['ada', 'grace'] : []),
    password: (origin: string, username: string) => (origin === SITE && username === 'ada' ? 'test-pass-1' : null),
  } as unknown as PasswordVault;
  const passwords = new Passwords(vault, {
    isPrivate: () => isPrivate,
    send: () => undefined,
    writeClipboard: () => undefined,
    onChange: () => undefined,
    colors: () => {
      const { text, textMuted, panelGlass, accent } = theme().colors;
      return { text, textMuted, surface: panelGlass, accent };
    },
  });
  const frame = { url: `${SITE}/sign-in` };
  const page = Object.assign(new EventEmitter(), { mainFrame: frame, getType: () => 'webview' });
  passwords.trackTab(page as never);
  const ask = (request: unknown, from: { url: string } = frame) => passwords.handlePage({ sender: page, senderFrame: from } as never, request);
  return { passwords, page, ask };
}

describe('the list of saved sign-ins in a page (review of 2026-09-30, St3)', () => {
  it('gets its names with the colours of the theme in use, and follows a change of theme', () => {
    let theme = nebula;
    const { ask } = setup(() => theme);
    expect(ask({ op: 'accounts' })).toEqual({
      names: ['ada', 'grace'],
      colors: { text: nebula.colors.text, textMuted: nebula.colors.textMuted, surface: nebula.colors.panelGlass, accent: nebula.colors.accent },
    });
    theme = daylight;
    const light = parseAccountsReply(ask({ op: 'accounts' }))!;
    expect(light.colors).toEqual({ text: daylight.colors.text, textMuted: daylight.colors.textMuted, surface: daylight.colors.panelGlass, accent: daylight.colors.accent });
  });

  it('has nothing to show for a site with no sign-ins, a private tab, or a frame inside the page', () => {
    const { ask } = setup(() => nebula);
    expect(ask({ op: 'accounts' }, { url: 'https://other.example/' })).toBeNull(); // not the page's main frame
    const other = setup(() => nebula);
    other.page.mainFrame.url = 'https://other.example/';
    expect(other.ask({ op: 'accounts' })).toBeNull();
    expect(setup(() => nebula, true).ask({ op: 'accounts' })).toBeNull();
    expect(ask({ op: 'nonsense' })).toBeNull();
  });

  it('hands a password over only right after a real click or key press in the page', () => {
    const { page, ask } = setup(() => nebula);
    expect(ask({ op: 'fill', username: 'ada' })).toBeNull();
    page.emit('input-event', {}, { type: 'mouseMove' });
    expect(ask({ op: 'fill', username: 'ada' })).toBeNull();
    page.emit('input-event', {}, { type: 'mouseDown' });
    expect(ask({ op: 'fill', username: 'ada' })).toBe('test-pass-1');
  });
});
