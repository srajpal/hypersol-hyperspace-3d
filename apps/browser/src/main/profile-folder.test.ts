import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chooseProfileFolder } from './profile-folder';

describe('chooseProfileFolder (the product rename)', () => {
  const appData = join('C:', 'Users', 'someone', 'AppData', 'Roaming');
  const current = join(appData, 'HyperSol HyperSpace 3D');
  const earlier = join(appData, 'HyperSol WebSurfer 3D');

  it('keeps using the folder from the earlier name, so bookmarks, history, and settings survive', () => {
    expect(chooseProfileFolder(appData, 'HyperSol HyperSpace 3D', (p) => p === earlier)).toBe(earlier);
  });

  it('prefers the folder under the current name when there is one', () => {
    expect(chooseProfileFolder(appData, 'HyperSol HyperSpace 3D', (p) => p === earlier || p === current)).toBe(current);
  });

  it('uses the current name on a first start', () => {
    expect(chooseProfileFolder(appData, 'HyperSol HyperSpace 3D', () => false)).toBe(current);
  });
});
