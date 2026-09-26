import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every project file a source file imports, followed through its own imports. */
function graph(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const text = readFileSync(entry, 'utf8');
  for (const m of text.matchAll(/(?:import|export)\s[^'"]*?from\s+'(\.[^']+)'|import\s+'(\.[^']+)'/g)) {
    const spec = m[1] ?? m[2]!;
    const base = resolve(dirname(entry), spec);
    const file = [`${base}.ts`, join(base, 'index.ts'), base].find((f) => existsSync(f) && f.endsWith('.ts'));
    if (file) graph(file, seen);
  }
  return seen;
}

/**
 * The two preloads run sandboxed, where a preload cannot load a second
 * file. If both import the same project module, the build puts it in a
 * shared chunk file and the shell's bridge fails to load (found
 * 2026-09-26, milestone 9). So they must share no module.
 */
describe('preloads', () => {
  it('share no project module, so each builds to a single file', () => {
    const shell = graph(join(__dirname, 'shell.ts'));
    const page = graph(join(__dirname, 'page.ts'));
    const shared = [...shell].filter((f) => page.has(f)).map((f) => f.slice(join(__dirname, '..').length + 1));
    expect(shared).toEqual([]);
  });
});
