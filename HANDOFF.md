# HANDOFF.md

The state of the project for whoever picks it up next, person or agent.
Last updated 2026-09-28 (milestones 1 to 18 accepted; milestone 19,
Harbour Loft, is built, prompt 118, and waits for its pull requests and
the owner's acceptance: see "Milestone 19, built" below. Milestone 20 is a sneaker store
(prompts 101 and 102), and 22 is HoloML's documentation (prompt 115).
The roadmap is in TODO.md).

## Where things stand

HyperSol HyperSpace 3D ("HyperSpace 3D" in the app) is a desktop web
browser with a 3D interface, built with Electron. It was called HyperSol
WebSurfer 3D until 2026-09-26. TODO.md is the authority on milestone
state; this is a summary.

- Milestones 1 to 11 are done and accepted by the owner: the 3D room and
  tilted live page, tabs as cards or a list, bookmarks, history, the
  Library and Settings, ad and tracker blocking with a shield, encrypted
  DNS through Quad9, the layers view, the Nebula and Daylight themes, the
  instrument panel, zoom, find, downloads, printing, private tabs,
  passwords, site permissions, tab tools, economy mode, sleeping tabs,
  history in a worker thread, address bar completion, view settings,
  reorganized Settings, and remappable shortcuts.
- Milestone 12, accepted and released as v0.9.0 (a GitHub release,
  marked pre-release): the browser as source for developers, with a privacy and proofreading pass, legal and
  project files, and automatic builds and tests on Windows and Linux.
- Then HoloML: 13 the language and 14 HoloML pages in the browser (both
  accepted), 15 HoloML hardening (resource limits, accessible scene
  navigation, an inspector: GitHub issues #23, #25, #28; accepted
  2026-09-27, prompt 79; the holoml spec note is in holoml pull request
  #7), 16 a car
  showroom demo (accepted 2026-09-27, prompt 83; the showroom is merged in holoml (pull request #12) and published at
  https://srajpal.github.io/holoml/showroom/; the browser's copy is
  synced from holoml's main); 17 to 21 five more HoloML example sites,
  one milestone each, growing HoloML 0.2 (prompts 84 and 85: 17
  Blockworld with the browser's examples section, accepted 2026-09-27,
  prompt 91: HoloML 0.2's first part and Blockworld are merged in
  holoml (pull request #13, prompt 90) and published at
  https://srajpal.github.io/holoml/blockworld/, and the browser's copy
  (packages/holoml and tests/fixtures/holoml) is synced from holoml's
  main (`pnpm holoml:sync main --examples main`); 18
  the sofa studio, with walking speeds, sliders, shadows, material
  pictures, choices, and light from the surroundings (accepted
  2026-09-28, prompt 112; merged in holoml, pull requests #14 to #16,
  and the browser, #34 and #35; published at
  https://srajpal.github.io/holoml/sofa-studio/); 19 Harbour Loft
  (built, waiting for acceptance); 20 a sneaker store (in place of Coral
  Bay, a resort, prompts 101 and 102); 21 Aquarium, where HoloML 0.2 is
  tagged); 22 documentation for HoloML to recognised standards (prompt
  115); 23 privacy and data tools (HTTPS-only, per-site storage,
  bookmark import and export: #24, #26, #27); then installers as 1.0
  (24 for Windows and Linux, 25 for macOS), with mobile later (owner,
  prompt 67).
- The logo direction is chosen (concept 4d in
  docs/branding/logo-concepts/); the real icons come with the installers.
- HyperSol, the company founded in 2001, no longer exists. This is a
  personal project honouring it, not marketed for now. Copyright: "The
  HyperSpace 3D Authors" and "The HoloML Authors" (AUTHORS files).

Two repositories, both on `main` (milestone 19's work is on branches,
below), kept as sibling folders (never one inside the other):

- Browser: https://github.com/srajpal/hypersol-hyperspace-3d (renamed
  from hypersol-websurfer-3d; GitHub redirects the old address)
- Language: https://github.com/srajpal/holoml

## Milestone 19, built (2026-09-28, prompt 118)

The plan and its checks (V1 to V12) are in TODO.md, "Milestone 19 —
Harbour Loft"; the owner approved the build in prompt 114, and it was
handed off mid-build (prompt 116) and finished in prompt 118.

Where the work is (neither branch is pushed yet):

- Browser: branch `m19-harbour-loft`, from main after milestone 18's
  acceptance: the viewer's part (panels, click actions, places and the
  fade, the sky, the floor plan, in apps/browser/src/viewer), Harbour
  Loft's copy (tests/fixtures/holoml/harbour-loft), its examples card
  and picture, checks V2 to V10 (tests/e2e/m19.e2e.ts) and T8 grown,
  the documents, and the screenshots (docs/screenshots/m19 and the
  README's four, Harbour Loft first).
- holoml: branch `harbour-loft`, from its main after pull request #16:
  the language (SPEC.md, the checker, conformance samples), Harbour
  Loft (examples/harbour-loft: its pages, loft.js, the models, and
  tools/download.mjs, layout.mjs, and prepare.mjs; the download's
  cache, tools/cache/, is ignored by git), and its README.
- The browser's copy of HoloML (packages/holoml) comes from holoml's
  `harbour-loft` branch (SOURCE.json). Once holoml's pull request is
  merged, sync it from main again: `pnpm holoml:sync main --examples
  main`.

What comes next, in order: the pull requests (holoml's first; GitHub
Pages publishes the site when it merges), the browser's copy synced
from holoml's main, the automatic builds, V11 by hand (the site from
its public address in the built app), and the owner's acceptance. For
an owner decision: the AGENTS.md wording for the README's pictures
(proposed in the reply to prompt 118; the README and its capture
already show Harbour Loft), and ARCHITECTURE.md section 10, item 4
(large scenes: shaders compiled on the page's main thread, every model
a Tab stop).

Worth knowing:

- The copy's test checks the commit its branch points to now: after any
  new commit on holoml's `harbour-loft`, run `pnpm holoml:sync
  harbour-loft --examples harbour-loft` again (only SOURCE.json changes
  when the copied files do not).
- Run one milestone's checks after `pnpm build` with `npx vitest run
  --config vitest.e2e.config.ts tests/e2e/m19.e2e.ts`.
- A button in a page acts on Enter only with the typed character: key
  down and up alone (pressInPage) move links but not buttons, so m19's
  checks send the character too (their `press` helper).
- A panorama read as a PNG or JPEG is decoded flipped (pictures.ts),
  since WebGL does not flip an ImageBitmap; check V6 looks at a
  two-colour sky to keep it the right way up.
- Harbour Loft's walls are separate `wall.glb` models, one a piece: the
  walker is stopped by each model's whole box, so a wall with a door, or
  a balustrade around a terrace, must be pieces.
- Harbour Loft is made by its tools: change tools/layout.mjs (walls,
  rooms, doors, furniture) or tools/prepare.mjs, then run
  `electron examples/harbour-loft/tools/prepare.mjs` from holoml's root
  (Electron is in the browser's apps/browser/node_modules/.bin), look
  at the rooms, and commit; it rewrites the flat's walls, windows, and
  furniture in index.holoml between its two prepare.mjs comments.
- U2 (milestone 18, walking speed) read 4.83 m/s once in the full run
  where 4.8 is allowed, and passed alone three times: a timing check
  that reads fast after a late frame.

## Read these first, in order

1. AGENTS.md (the rules; CLAUDE.md imports it)
2. BRIEF.md (what is being built and for whom)
3. ARCHITECTURE.md (how, and what is still open)
4. TODO.md (the roadmap, and the current milestone's tasks and checks)
5. README.md and CONTRIBUTING.md (the public face, and how to build and
   test)
6. PROMPTS.md (every owner prompt, lightly edited, in order)

The holoml repository has its own README.md and AGENTS.md, which defer
to this repository for rules and the prompt log.

## Decisions already made (do not reopen without the owner)

- Desktop first: Windows and Linux, then macOS; mobile later, as its own
  project. Mouse, keyboard, and touch.
- Stack: Electron (the newest stable line; 44.4.5 on 2026-09-26),
  TypeScript, Three.js, Lit, SQLite through Node's node:sqlite,
  @ghostery/adblocker-electron, electron-vite, Vitest, Playwright. Node
  22.13 or newer, pnpm 12.4.1 pinned. Reasons in ARCHITECTURE.md
  section 4.
- The focused page is a live Chromium view (an Electron `<webview>`)
  placed with CSS 3D transforms; background tabs show snapshots.
- Privacy by default: ad and tracker blocking, DNS over HTTPS through
  Quad9, no telemetry, no crash reporter, spellchecker off. Default
  search: DuckDuckGo. docs/privacy.md lists everything stored and sent.
- Known limitations: no DRM video (Electron ships no Widevine); the 3D
  room needs WebGL 2, and without it pages still work and a notice says
  so (owner, prompt 60).
- Automatic builds and tests: GitHub Actions on Windows and Linux for
  every push (.github/workflows/ci.yml). The runners have no graphics
  card: C9's frame rate is measured but skipped there (owner, prompt
  59); Linux runs use SwiftShader for WebGL and a throwaway GNOME
  Keyring for the password checks.
- The language is HoloML, file extension `.holoml` ("3DML" was taken;
  "HSML" was checked and advised against; `.holo` and `.hlml` are used
  by other formats). Its syntax is strict and HTML-like, and its 3D
  models are glTF 2.0 (owner, prompts 58 and 63). Version 0.1 is written
  down in the holoml repository's SPEC.md, with a parser, a checker,
  and conformance samples (milestone 13).
- License: Apache 2.0 for both repositories; the HoloML spec text also
  CC BY 4.0. Contributions come under Apache 2.0's own terms.
- Versions: 0.9.0 is the source-only developer preview; 1.0 is
  installers plus HoloML.

## Open items (need an owner decision when their milestone comes)

- With the installers (milestone 24): Windows signing (Microsoft's
  Artifact Signing recommended, or SignPath Foundation), updates
  (automatic from GitHub Releases recommended), Linux formats (AppImage
  and .deb recommended), the Windows installer type (per user
  recommended).
- With the macOS release (milestone 25): the Apple Developer Program for
  signing and notarization.
- Product gaps noted in the 2026-09-24 review and not yet scheduled:
  bookmark import and onboarding, a touch equivalent for closing tabs.

## How to resume

1. Log the owner's prompt in PROMPTS.md before any work (AGENTS.md,
   Prompt log): read the last heading and use the next number.
2. Do only what the prompt approves (AGENTS.md rule 2). Tick tasks and
   record check results in TODO.md as they actually run.
3. Any new package needs approval first (rule 4).
4. Update README.md, ARCHITECTURE.md, TODO.md, and this file whenever a
   decision or the project state changes. The Testing section of
   AGENTS.md lists only commands that have actually run.
5. Commit after each completed change. Push before and after each
   milestone, otherwise only when the owner asks; remind them when five
   or more commits are waiting.
6. One active session per working tree. A second session works in the
   other folder or waits.
7. At the end of each milestone, save screenshots with
   `MILESTONE=mN pnpm screenshots` and add them to docs/progress.md.

## Not done yet, on purpose

- HoloML's packages are not published to npm; the browser keeps a copy
  (packages/holoml, pnpm holoml:sync).
- No installers, signing, or updates (milestones 24 and 25).
- No installers attached to releases: v0.9.0 is source only.
