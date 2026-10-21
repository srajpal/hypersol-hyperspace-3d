# Contributing to HyperSpace 3D

Thank you for taking a look. HyperSpace 3D is a personal open-source
project: a desktop web browser with a 3D interface, built with Electron.
This version is a developer preview: there are no installers, but each
release has a portable zip per system (the README's Download section);
to change it, you build and run it from source.

## Set up

You need:

- Node.js 24 or newer (`.nvmrc` names 24).
- pnpm 12.4.1. The version is pinned in package.json (`packageManager`);
  run `corepack enable` once and pnpm uses that exact version.
- Git.
- For the end-to-end tests: `openssl` on your PATH (Git for Windows
  includes one; Linux has it), and on Linux a display (a desktop session,
  or a virtual one with `xvfb-run`) and, for the password checks, GNOME
  Keyring (the tests ask for it by name; see the workflow for a
  throwaway one without a desktop).

Then:

```
git clone https://github.com/srajpal/hypersol-hyperspace-3d.git
cd hypersol-hyperspace-3d
pnpm install --frozen-lockfile
pnpm dev
```

The first run downloads the Electron binary (about 100 MB, from
Electron's GitHub releases) and checks it against the checksums in the
electron package. Development runs keep their data in the `userData/`
folder of the repository, never in your normal browser profile.

Checked for development on Windows 11, and on Windows and Linux (Ubuntu)
by GitHub Actions for every pull request and every push to main; on
macOS the builds run lint, the type check, the unit tests, and the
build, and the end-to-end checks as an experiment (not required, and
run on main or by hand rather than on pull requests; TODO.md, "Issue
#94"); on a Mac in hand the unit tests pass and the end-to-end
checks do but a few (2026-10-15; TODO.md, "Issue #111", has each). On
a Mac, take Node 24 from nvm or nodejs.org's installer if Homebrew
sets out to compile it, and allow "Electron" the microphone when
macOS asks during the first `pnpm test:e2e` (the checks that capture
audio use a stand-in device, but macOS asks once per binary all the
same; its dialog waits for you, and the two checks run out their time
if nobody answers), and keep the display awake during a run
(`caffeinate -d pnpm test:e2e`): with it asleep, or the screen locked,
macOS makes no full screen, and the full-screen checks miss. On
Windows, keep
the clone in a short folder path (such as `C:\dev\hyperspace`): pnpm
fails on file paths over Windows' 260-character limit.

## Test

| Command | What it does |
|---|---|
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, every package |
| `pnpm test` | Unit tests (Vitest), next to the code as `*.test.ts` |
| `pnpm test:e2e` | Builds the app and drives it with Playwright (about twenty-five to thirty minutes). Its windows open off screen and never take focus; set `HYPERSOL_TEST_SHOW=1` to watch. On Linux without a desktop: `xvfb-run -a pnpm test:e2e` |
| `pnpm test:linux` | With Docker, on any computer: all of the above on Linux, as GitHub's Linux machines run them (Ubuntu 24.04, 4 processors, 16 GB, no graphics card), in a container with a fresh copy of the repository. `pnpm test:linux tests/e2e/m1.e2e.ts` runs chosen end-to-end files |

Every pull request, and every push to main, runs all of these but
`pnpm test:linux` on Windows and Linux in GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)),
the end-to-end checks in four parts side by side on each system
(`HYPERSOL_E2E_PART=1` to `4`; see vitest.e2e.config.ts). A change to
documents only (the `*.md` files at the top and `docs/`) skips them.
The same builds also run lint, the type check, and the unit tests on
Node 26, and build and test the Android app.
Please make sure they pass before asking for a review.

Where things are: the app in `apps/browser` (main process, preloads, the
3D shell, and the HoloML viewer), shared 3D maths in `packages/scene-core`, the themes in
`packages/themes`, a copy of HoloML's parser and checker in
`packages/holoml` (change HoloML in its own repository, tag it, and run
`pnpm holoml:sync`), HyperSpace 3D for Android in `apps/android` (its
own [README](apps/android/README.md)), end-to-end tests and their
fixture pages in `tests/`.
[ARCHITECTURE.md](ARCHITECTURE.md) explains the design, and
[TODO.md](TODO.md) the roadmap and every check.

## Changes

- Open an issue first for anything larger than a fix, so we can agree on
  the approach.
- Keep changes small and focused, and match the code around them.
- Add or update tests for what you change. A failing test is fixed or
  reported, never deleted or weakened to pass.
- Update the documents a change affects (README.md, ARCHITECTURE.md,
  docs/privacy.md) in the same pull request.
- The browser adds no network calls, services, or telemetry beyond those
  listed in docs/privacy.md; propose any new one in an issue first.
- AI agents working in this repository follow [AGENTS.md](AGENTS.md).
- `main` is protected: it cannot be force-pushed or deleted, and a pull
  request is merged once its "All checks" job passes (Windows and Linux,
  each in four parts; macOS's lint, type check, unit tests, and build;
  Node 26; and Android).

## Making your own build

The project publishes no installers, and plans none (owner,
2026-10-08): each release is a portable zip per system (since 0.9.1,
2026-10-16; GitHub issue #92), unzipped and started, nothing signed,
plus the source. `pnpm package` makes that zip for the system it runs
on (apps/browser/scripts/package.mjs; `pnpm build` first):

- A staging folder, `release/stage/`, gets only what the app needs at
  run time: a package.json with the name, product name, version, and
  `main` (`out/main/index.js`), `out/`, `resources/`, and LICENSE,
  NOTICE, and THIRD-PARTY.md. Every package is bundled into `out/` but
  one: the shield's page script (@ghostery/adblocker-electron-preload),
  which the blocker reaches by name at run time, is copied into the
  folder's node_modules with what it depends on.
- @electron/packager packs it as plain files, no asar: the main process
  finds its preloads, the shell, and the viewer by paths beside itself,
  its worker threads for the filter lists and the history search start
  from files, and the shield reads the lists from
  `app.getAppPath()/resources/filters` (an asar with only some folders
  unpacked breaks those paths). It sets the icon
  (`resources/icons`, made from the logo by `pnpm --filter
  @hypersol/browser icons`), and copies the licence files beside the
  app: Apache 2.0 asks for the NOTICE file, the filter lists are under
  the GPL (their text and notice are inside, under resources/filters),
  and THIRD-PARTY.md credits the example sites' models and pictures.
- The folder is zipped as `HyperSpace3D-<version>-<system>-<processor>.zip`
  in `release/`, with its SHA-256 beside it.
- `pnpm package:smoke` starts the packaged app with a throwaway
  profile and checks its window's title and the room's canvas: test
  mode and the tests' hooks are off in a packaged app (they need
  `app.isPackaged` to be false), as are DevTools for the shell, so
  this is the one check a packaged app gets.
- A release: the tag `v<version>` pushed starts
  .github/workflows/release.yml, which makes a draft release with the
  changelog's section as its notes, packages on Windows, Linux, and
  macOS (Apple silicon and Intel), smoke-checks each, attests each zip
  (build provenance, GitHub issue #127; a run started by hand starts
  from the tag itself), and attaches the zips and checksums; the owner
  reads the draft and publishes it. Releases published since
  2026-10-20 are immutable: their tag and files cannot be changed or
  added to, so everything goes on the draft first.

Under the Apache 2.0 licence anyone may fork the repository and make an
installable build of their own from the same staging folder.

## Licence of contributions

HyperSpace 3D is licensed under the Apache License 2.0. By contributing,
you agree that your contribution is licensed under the same terms, as
section 5 of the licence describes; there is no separate agreement to
sign. You may add yourself to [AUTHORS](AUTHORS).

## Security

Please report security problems privately, as described in
[SECURITY.md](SECURITY.md), not in a public issue.

## Conduct

Everyone taking part keeps to the [code of conduct](CODE_OF_CONDUCT.md).
