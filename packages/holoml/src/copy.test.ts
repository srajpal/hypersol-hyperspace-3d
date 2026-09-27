import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain JavaScript module shared with sync.mjs
import { COPIES, EXAMPLES, sha256, transform } from '../copies.mjs';
import { check, parse } from './index';

const here = fileURLToPath(new URL('..', import.meta.url));
const source = JSON.parse(readFileSync(join(here, 'SOURCE.json'), 'utf8')) as {
  tag: string;
  commit: string;
  files: Record<string, string>;
  examples: { ref: string; commit: string; files: Record<string, string> };
};
const copies = COPIES as { from: string; to: string }[];
const examples = EXAMPLES as { from: string; to: string; names: string[]; skip: RegExp };
const hash = sha256 as (t: string | Buffer) => string;

describe('the copy of HoloML (owner, prompt 65, Q4 a)', () => {
  it('is unchanged since it was copied (edit HoloML in its own repository)', () => {
    for (const { to } of copies) {
      const text = readFileSync(join(here, to), 'utf8').replace(/\r\n/g, '\n');
      expect((sha256 as (t: string) => string)(text), to).toBe(source.files[to]);
    }
  });

  const holoml = join(here, '..', '..', '..', 'holoml');
  // Only where the holoml repository sits beside this one (not in GitHub Actions).
  it.skipIf(!existsSync(join(holoml, '.git')))(`matches the holoml repository at ${source.tag}`, () => {
    const commit = execFileSync('git', ['-C', holoml, 'rev-list', '-n', '1', source.tag], { encoding: 'utf8' }).trim();
    expect(commit).toBe(source.commit);
    for (const { from, to } of copies) {
      const original = execFileSync('git', ['-C', holoml, 'show', `${source.tag}:${from}`], { encoding: 'utf8' });
      const expected = (transform as (t: string, f: string, g: string) => string)(original, from, source.tag);
      expect(readFileSync(join(here, to), 'utf8').replace(/\r\n/g, '\n'), to).toBe(expected);
    }
  });

  it('has the example sites unchanged since they were copied (milestones 16 and 17)', () => {
    const names = Object.keys(source.examples.files);
    for (const site of examples.names) expect(names).toContain(`${site}/index.holoml`);
    for (const name of names) expect(hash(readFileSync(join(here, examples.to, name))), name).toBe(source.examples.files[name]);
  });

  it.skipIf(!existsSync(join(holoml, '.git')))(`has the example sites as the holoml repository has them at ${source.examples.ref}`, () => {
    const listed = examples.names.flatMap((site) =>
      execFileSync('git', ['-C', holoml, 'ls-tree', '-r', '--name-only', source.examples.commit, `${examples.from}${site}/`], { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
        .map((p) => p.slice(examples.from.length))
        .filter((n) => !examples.skip.test(n.slice(site.length + 1))),
    );
    expect(Object.keys(source.examples.files).sort()).toEqual(listed.sort());
    for (const name of listed) {
      const original = execFileSync('git', ['-C', holoml, 'show', `${source.examples.commit}:${examples.from}${name}`]);
      expect(hash(readFileSync(join(here, examples.to, name))), name).toBe(hash(original));
    }
  });

  it('parses and checks a page', () => {
    const doc = parse('<holoml version="0.1"><scene><model src="car.glb" /></scene></holoml>');
    expect(check(doc)).toEqual([]);
  });
});
