// Copies HoloML's parser and checker from a tag of the holoml repository
// (the sibling folder ../holoml) into src/, and records what was copied in
// SOURCE.json (owner, prompt 65, Q4 a). The copies are not edited by hand:
// change HoloML in its own repository, tag it, and run this again.
//
//   pnpm holoml:sync            (the tag in SOURCE.json)
//   pnpm holoml:sync v0.2.0     (another tag)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { COPIES, sha256, transform } from './copies.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const holoml = join(here, '..', '..', '..', 'holoml');
const previous = JSON.parse(readFileSync(join(here, 'SOURCE.json'), 'utf8'));
const tag = process.argv[2] ?? previous.tag;

const git = (...args) => execFileSync('git', ['-C', holoml, ...args], { encoding: 'utf8' });
const commit = git('rev-list', '-n', '1', tag).trim();
const files = {};
for (const { from, to } of COPIES) {
  const text = transform(git('show', `${tag}:${from}`), from, tag);
  writeFileSync(join(here, to), text);
  files[to] = sha256(text);
  console.log(`${from} -> ${to}`);
}
writeFileSync(join(here, 'SOURCE.json'), JSON.stringify({ repository: 'https://github.com/srajpal/holoml', tag, commit, files }, null, 2) + '\n');
console.log(`copied HoloML ${tag} (${commit.slice(0, 7)})`);
