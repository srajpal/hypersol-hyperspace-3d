// pnpm test:linux: the checks on Linux, on this computer, the way
// GitHub's Linux machines run them (owner, prompts 103 and 104). It needs
// Docker. It builds the image in this folder (Ubuntu 24.04, as GitHub's
// ubuntu-latest), sends in a fresh copy of the repository (the committed
// files, with any changes to tracked files; a new file counts once it is
// added with git add), and runs there what .github/workflows/ci.yml runs:
// install, lint, types, unit tests, and the end-to-end checks on a
// virtual display with a throwaway keyring. The container has GitHub's
// size (4 processors, 16 GB) and no graphics card, so Chromium draws in
// software, as there.
//
//   pnpm test:linux                          everything, as the CI job
//   pnpm test:linux tests/e2e/m1.e2e.ts      only these end-to-end files
//   pnpm test:linux tests/e2e/m2.e2e.ts -t D13   (any vitest arguments)
//
// pnpm's store and Electron's download are kept in Docker volumes
// (hypersol-linux-pnpm, hypersol-linux-cache) between runs.
import { execFileSync, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const IMAGE = 'hypersol-linux-tests';
const filters = process.argv.slice(2);

// A session bus and a throwaway keyring, then a virtual display, as the CI job; the arguments go on to the inner shell.
const e2e = (command) =>
  `dbus-run-session -- bash -c 'echo -n throwaway | gnome-keyring-daemon --unlock --components=secrets > /dev/null; ` +
  `xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" ${command}' bash "$@"`;
const steps = [
  'set -e',
  'mkdir -p repo && tar -x -C repo && cd repo',
  'pnpm install --frozen-lockfile',
  ...(filters.length === 0
    ? ['pnpm lint', 'pnpm typecheck', 'pnpm test', e2e('pnpm test:e2e')]
    : ['pnpm build', e2e('pnpm exec vitest run --config vitest.e2e.config.ts "$@"')]),
].join('\n');

execFileSync('docker', ['build', '-t', IMAGE, here], { stdio: 'inherit' });
// The files to test: the working tree's tracked files as a commit (without touching the working tree), or HEAD.
const ref = execFileSync('git', ['stash', 'create'], { cwd: root, encoding: 'utf8' }).trim() || 'HEAD';
console.log(`Testing ${ref === 'HEAD' ? 'HEAD' : 'HEAD with the working tree changes'} on Linux${filters.length ? `: ${filters.join(' ')}` : ''}`);

const docker = spawn(
  'docker',
  [
    'run', '--rm', '-i',
    // GitHub's Linux machines for public repositories: 4 processors, 16 GB.
    '--cpus=4', '--memory=16g',
    // Chromium needs more shared memory than Docker's 64 MB, and its
    // sandbox needs user namespaces, which Docker's default seccomp
    // profile refuses (the CI job allows them with a sysctl instead).
    '--shm-size=2g', '--security-opt', 'seccomp=unconfined',
    '-v', 'hypersol-linux-pnpm:/home/tester/.local/share/pnpm',
    '-v', 'hypersol-linux-cache:/home/tester/.cache',
    IMAGE, 'bash', '-c', steps, 'bash', ...filters,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);
const archive = spawn('git', ['archive', '--format=tar', ref], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
archive.stdout.pipe(docker.stdin);
docker.on('exit', (code) => process.exit(code ?? 1));
