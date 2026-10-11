# Contributing to HyperSpace 3D

Thank you for taking a look. HyperSpace 3D is a personal open-source
project: a desktop web browser with a 3D interface, built with Electron.
This version is a developer preview: there are no installers, so you
build and run it from source.

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
by GitHub Actions for every pull request and every push to main; macOS
is untested. On Windows, keep
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
  each in four parts, Node 26, and Android).

## Making your own build

The project publishes no installers, and plans none (owner,
2026-10-08): it is source for developers. Under the Apache 2.0 licence
anyone may fork it and make an installable build of their own. No
packaging tool is set up here, and packaging has not been checked in
this repository; what a packaged build needs:

- Package `apps/browser`, after `pnpm build`: its `main` is
  `out/main/index.js`. Electron's own packagers (Electron Forge, or
  electron-builder) can do it.
- Include `out/**` and `resources/filters/**`. The privacy shield's
  starter filter lists are read from inside the app's folder
  (`app.getAppPath()/resources/filters`, apps/browser/src/main/index.ts),
  so keep them there rather than among a packager's extra resources.
  Nothing else under `apps/browser` is needed when the app runs.
- The filter lists and the history search run in worker threads from
  `out/main`. If your packager's archive (asar) keeps them from
  starting, leave `out/main` unpacked.
- Ship `LICENSE`, `NOTICE`, and `THIRD-PARTY.md` from the repository's
  top, and `resources/filters/GPL-3.0.txt` with its `NOTICE.md`, beside
  the app: Apache 2.0 asks for the NOTICE file, the filter lists are
  under the GPL, and THIRD-PARTY.md credits the example sites' models
  and pictures. The About panel names the Apache licence only.
- Test mode and the tests' hooks are off in a packaged app (they need
  `app.isPackaged` to be false), as are DevTools for the shell.
- There are no app icons yet (docs/branding has the logo's concepts),
  so Electron's own icon is used until you add some.

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
