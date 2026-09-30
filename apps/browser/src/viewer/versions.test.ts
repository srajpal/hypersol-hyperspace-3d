import { describe, expect, it } from 'vitest';
import type { ElementNode } from '@hypersol/holoml';
import { VERSIONS, atLeast, pageVersion } from './versions';

const root = (version?: string | null): ElementNode =>
  ({
    type: 'element',
    name: 'holoml',
    attributes: version === undefined ? [] : [{ name: 'version', value: version, start: { line: 1, column: 9, offset: 8 } }],
    children: [],
    start: { line: 1, column: 1, offset: 0 },
  }) as unknown as ElementNode;

describe("a page's HoloML version (SPEC.md section 11; review 134, V2)", () => {
  it('reads the versions the viewer knows, as written', () => {
    expect(pageVersion(root('0.1'))).toBe('0.1');
    expect(pageVersion(root('0.2'))).toBe('0.2');
  });

  it('refuses a version it does not know, rather than guess', () => {
    for (const other of ['0.3', '1.0', '0.20', '2', '', ' 0.2', '0.2 ', 'latest']) expect(pageVersion(root(other)), JSON.stringify(other)).toBeNull();
  });

  it('reads a page that declares no version as the first (the checker reports the missing attribute)', () => {
    expect(pageVersion(root())).toBe('0.1');
    expect(pageVersion(root(null))).toBe('0.1');
  });

  it('every version from 0.2 on has what 0.2 added: a later version keeps the earlier ones\' features', () => {
    expect(atLeast('0.1', '0.2')).toBe(false);
    const from = VERSIONS.indexOf('0.2');
    VERSIONS.forEach((v, i) => expect(atLeast(v, '0.2'), v).toBe(i >= from));
    // What 0.1 has, every version has.
    for (const v of VERSIONS) expect(atLeast(v, '0.1'), v).toBe(true);
    for (const v of VERSIONS) expect(atLeast(v, undefined), v).toBe(true);
  });
});
