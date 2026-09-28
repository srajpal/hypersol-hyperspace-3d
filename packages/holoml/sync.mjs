// Copies HoloML's parser and checker from a tag of the holoml repository
// (the sibling folder ../holoml) into src/, and its example sites into the
// browser's test fixtures (milestones 16 and 17), and records what was
// copied in SOURCE.json (owner, prompt 65, Q4 a). The copies are not
// edited by hand: change HoloML in its own repository, tag it, and run
// this again.
//
//   pnpm holoml:sync                          (the tag and examples in SOURCE.json)
//   pnpm holoml:sync v0.2.0                   (another tag, for both)
//   pnpm holoml:sync v0.1.1 --examples <ref>  (the examples from another tag, branch, or commit)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { COPIES, EXAMPLES, sha256, transform } from './copies.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const holoml = join(here, '..', '..', '..', 'holoml');
const previous = JSON.parse(readFileSync(join(here, 'SOURCE.json'), 'utf8'));
const args = process.argv.slice(2);
const flag = args.findIndex((a) => a === '--examples' || a === '--showroom');
const examplesRef = flag >= 0 ? args.splice(flag, 2)[1] : undefined;
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

// The example sites, byte for byte (models and sounds are binary), each
// replacing its last copy. The scripts that make them stay in holoml.
const before = previous.examples ?? previous.showroom;
const ref = examplesRef ?? (args[0] ? tag : (before?.ref ?? tag));
const examplesCommit = git('rev-list', '-n', '1', ref).trim();
const exampleFiles = {};
for (const name of EXAMPLES.names) {
  const from = `${EXAMPLES.from}${name}/`;
  const target = join(here, EXAMPLES.to, name);
  rmSync(target, { recursive: true, force: true });
  const paths = git('ls-tree', '-r', '--name-only', examplesCommit, from).split('\n').filter(Boolean);
  for (const path of paths) {
    const inside = path.slice(from.length);
    if (EXAMPLES.skip.test(inside)) continue;
    // Room for the largest file (the sofa studio's panorama is 1.6 MB; the default is 1 MB).
    const bytes = execFileSync('git', ['-C', holoml, 'show', `${examplesCommit}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
    mkdirSync(dirname(join(target, inside)), { recursive: true });
    writeFileSync(join(target, inside), bytes);
    exampleFiles[`${name}/${inside}`] = sha256(bytes);
  }
  console.log(`${from} -> tests/fixtures/holoml/${name}/`);
}

const examples = { ref, commit: examplesCommit, files: exampleFiles };
writeFileSync(join(here, 'SOURCE.json'), JSON.stringify({ repository: 'https://github.com/srajpal/holoml', tag, commit, files, examples }, null, 2) + '\n');
console.log(`copied HoloML ${tag} (${commit.slice(0, 7)}), examples ${ref} (${examplesCommit.slice(0, 7)}): ${Object.keys(exampleFiles).length} files`);
