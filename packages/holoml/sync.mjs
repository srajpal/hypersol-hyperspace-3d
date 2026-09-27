// Copies HoloML's parser and checker from a tag of the holoml repository
// (the sibling folder ../holoml) into src/, and its showroom into the
// browser's test fixtures (milestone 16), and records what was copied in
// SOURCE.json (owner, prompt 65, Q4 a). The copies are not edited by hand:
// change HoloML in its own repository, tag it, and run this again.
//
//   pnpm holoml:sync                          (the tag and showroom in SOURCE.json)
//   pnpm holoml:sync v0.2.0                   (another tag, for both)
//   pnpm holoml:sync v0.1.1 --showroom <ref>  (the showroom from another tag, branch, or commit)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { COPIES, SHOWROOM, sha256, transform } from './copies.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const holoml = join(here, '..', '..', '..', 'holoml');
const previous = JSON.parse(readFileSync(join(here, 'SOURCE.json'), 'utf8'));
const args = process.argv.slice(2);
const flag = args.indexOf('--showroom');
const showroomRef = flag >= 0 ? args.splice(flag, 2)[1] : undefined;
const tag = args[0] ?? previous.tag;

const git = (...a) => execFileSync('git', ['-C', holoml, ...a], { encoding: 'utf8' });
const commit = git('rev-list', '-n', '1', tag).trim();
const files = {};
for (const { from, to } of COPIES) {
  const text = transform(git('show', `${tag}:${from}`), from, tag);
  writeFileSync(join(here, to), text);
  files[to] = sha256(text);
  console.log(`${from} -> ${to}`);
}

// The showroom, byte for byte (its models are binary), replacing the last copy.
const ref = showroomRef ?? (args[0] ? tag : (previous.showroom?.ref ?? tag));
const showroomCommit = git('rev-list', '-n', '1', ref).trim();
const target = join(here, SHOWROOM.to);
rmSync(target, { recursive: true, force: true });
const showroomFiles = {};
for (const path of git('ls-tree', '-r', '--name-only', showroomCommit, SHOWROOM.from).split('\n').filter(Boolean)) {
  const name = path.slice(SHOWROOM.from.length);
  if (SHOWROOM.skip.test(name)) continue;
  const bytes = execFileSync('git', ['-C', holoml, 'show', `${showroomCommit}:${path}`]);
  mkdirSync(dirname(join(target, name)), { recursive: true });
  writeFileSync(join(target, name), bytes);
  showroomFiles[name] = sha256(bytes);
}
console.log(`${SHOWROOM.from} -> tests/fixtures/holoml/showroom/ (${Object.keys(showroomFiles).length} files)`);

const showroom = { ref, commit: showroomCommit, files: showroomFiles };
writeFileSync(join(here, 'SOURCE.json'), JSON.stringify({ repository: 'https://github.com/srajpal/holoml', tag, commit, files, showroom }, null, 2) + '\n');
console.log(`copied HoloML ${tag} (${commit.slice(0, 7)}), showroom ${ref} (${showroomCommit.slice(0, 7)})`);
