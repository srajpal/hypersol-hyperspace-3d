import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
/** The id git gives a file's bytes (a blob's SHA-1), as git ls-tree lists it. */
const gitObjectId = (bytes: Buffer) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

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
    const commit = execFileSync('git', ['-C', holoml, 'rev-list', '-n', '1', source.tag, '--'], { encoding: 'utf8' }).trim();
    expect(commit).toBe(source.commit);
    for (const { from, to } of copies) {
      const original = execFileSync('git', ['-C', holoml, 'show', `${source.tag}:${from}`], { encoding: 'utf8' });
      const expected = (transform as (t: string, f: string, g: string) => string)(original, from, source.tag);
      expect(readFileSync(join(here, to), 'utf8').replace(/\r\n/g, '\n'), to).toBe(expected);
    }
  });

  it('has the example sites unchanged since they were copied (milestones 16 to 20)', () => {
    const names = Object.keys(source.examples.files);
    for (const site of examples.names) expect(names).toContain(`${site}/index.holoml`);
    for (const name of names) expect(hash(readFileSync(join(here, examples.to, name))), name).toBe(source.examples.files[name]);
  });

  it.skipIf(!existsSync(join(holoml, '.git')))(`has the example sites as the holoml repository has them at ${source.examples.ref}`, () => {
    // Each file's git object id (from one listing per site; a git process per file took over 5 s for the sofa studio's 66 files).
    const listed = examples.names.flatMap((site) =>
      execFileSync('git', ['-C', holoml, 'ls-tree', '-r', source.examples.commit, `${examples.from}${site}/`], { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [meta, path] = line.split('\t') as [string, string];
          return { id: meta.split(' ')[2]!, name: path.slice(examples.from.length) };
        })
        .filter(({ name }) => !examples.skip.test(name.slice(site.length + 1))),
    );
    expect(Object.keys(source.examples.files).sort()).toEqual(listed.map((f) => f.name).sort());
    for (const { id, name } of listed) expect(gitObjectId(readFileSync(join(here, examples.to, name))), name).toBe(id);
  });

  it('parses and checks a page', () => {
    const doc = parse('<holoml version="0.1"><scene><model src="car.glb" /></scene></holoml>');
    expect(check(doc)).toEqual([]);
  });
});
