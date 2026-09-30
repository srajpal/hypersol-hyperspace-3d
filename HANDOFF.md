# HANDOFF.md

The state of the project for whoever picks it up next, person or agent.
Last updated 2026-09-29 (milestones 1 to 21 accepted, 21 in prompt
125, and HoloML 0.2 released as v0.2.0 in prompt 126: see "Milestone 21,
accepted" below. 22, HoloML's documentation, is being built (prompts
127 and 128: see "Milestone 22, in progress" below). The roadmap is in
TODO.md).

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
  (accepted 2026-09-29, prompt 122; merged in holoml, #17, and the
  browser, #36; published at
  https://srajpal.github.io/holoml/harbour-loft/); 20 a sneaker store,
  with loading by area (accepted 2026-09-29, prompt 122; merged in
  holoml, #18, and the browser, #37; published at
  https://srajpal.github.io/holoml/sneaker-store/; in place of Coral
  Bay, a resort, prompts 101 and 102); 21 the ocean tunnel, an
  aquarium, where HoloML 0.2 is completed (accepted 2026-09-29, prompt
  125; merged in holoml, #19, and the browser, #38; published at
  https://srajpal.github.io/holoml/aquarium/; HoloML 0.2 released as
  v0.2.0, https://github.com/srajpal/holoml/releases/tag/v0.2.0)); 22 documentation for HoloML to recognised standards (prompt
  115; being built, prompt 128); 23 HoloML 0.3, the features its check
  found missing (prompt 128, Q4 a); 24 privacy and data tools
  (HTTPS-only, per-site storage, bookmark import and export: #24, #26,
  #27); then installers as 1.0 (25 for Windows and Linux, 26 for
  macOS), with mobile later (owner, prompt 67).
- The logo direction is chosen (concept 4d in
  docs/branding/logo-concepts/); the real icons come with the installers.
- HyperSol, the company founded in 2001, no longer exists. This is a
  personal project honouring it, not marketed for now. Copyright: "The
  HyperSpace 3D Authors" and "The HoloML Authors" (AUTHORS files).

Two repositories, kept as sibling folders (never one inside the other).
Both main branches have milestones 19 to 21 (the browser's #38 and
holoml's #19 merged, 2026-09-29):

- Browser: https://github.com/srajpal/hypersol-hyperspace-3d (renamed
  from hypersol-websurfer-3d; GitHub redirects the old address)
- Language: https://github.com/srajpal/holoml

## Milestone 22, in progress (2026-09-29, prompts 127 and 128)

The plan and its checks (Y1 to Y10) are in TODO.md, "Milestone 22 —
HoloML documentation". The owner answered Q1 to Q7 with the
recommendations and approved the build (prompt 128): a specification in
W3C style, ABNF and a RELAX NG schema made from the checker's table, the
scene API in Web IDL, guides organised by Diátaxis, a site at
https://srajpal.github.io/holoml/ built with `marked` (a new development
package in holoml, approved as Q3 a), the media type's registration
template without registering it, the clarifications in 0.2's text (then
v0.2.1 on the owner's go), and everything in the holoml repository. The
features found missing go to milestone 23, "HoloML 0.3" (Q4 a).

## Milestone 21, accepted (2026-09-29, prompts 121 to 125)

The plan and its checks (X1 to X12) are in TODO.md, "Milestone 21 —
Aquarium", with the decisions made while building and the results. The
owner answered Q1 to Q7 with the recommendations (prompt 122), taken
with prompt 121's "Next milestone" as approval of the plan and its
build, and approved the nine fish (prompt 123). The owner merged holoml
#19 (prompt 124) and the browser's #38, and accepted the milestone
(prompt 125). On the owner's go (prompt 126), holoml's main (710d8b9) is
tagged v0.2.0 and published as the GitHub release "HoloML 0.2" (task 9,
Q6 a); the browser's copy of HoloML comes from that tag.

Where the work is:

- Browser: branch `m21-aquarium` (merged, #38), from main after #37: the viewer's
  water (water.ts), sounds from a place (sound.ts), animation speed
  (api.ts), shaders compiled without blocking and nothing drawn behind
  another tab (scene.ts, main.ts, the preload, room.ts, and
  tab-view.ts), the aquarium's copy (tests/fixtures/holoml/aquarium),
  its examples card and picture, checks X2 to X9 (tests/e2e/m21.e2e.ts,
  with the fixture pages water.holoml, caustics.holoml,
  sound-place.holoml, and animation-speed.holoml), T8 grown, the
  automatic builds in two parts on each system (ci.yml and
  vitest.e2e.config.ts, Q7 a), the documents, and the screenshots
  (docs/screenshots/m21).
- holoml: branch `aquarium` (merged, #19), from its main after pull request #18: the
  language's fifth part (SPEC.md, the checker, conformance samples), 0.2
  complete (spec.test.ts keeps it so), the aquarium
  (examples/aquarium: its pages, aquarium.js, ocean.js, the models and
  sounds, and tools/; the download's cache, tools/cache/, is ignored by
  git), its tests, and the README and NOTICE.
- The browser's copy of HoloML (packages/holoml) comes from holoml's
  tag v0.2.0 (SOURCE.json: 710d8b9, the merge of #19, prompt 126).
- Pull requests: holoml #19 and the browser's #38, both merged (GitHub
  Pages publishes the aquarium, and X10 passed). #38's builds found the
  aquarium too slow to draw in software (fixed by lighter models) and a
  race in the idle-frame checks (fixed by sceneStill); its last build
  passed, every job within its 45 minutes (X11). V5, E6b, and #10, from
  earlier milestones, each failed once on GitHub's machines and passed
  on the same code; they are not changed. TODO.md has the details.

Worth knowing:

- Run the aquarium's tools from holoml's root: `node
  examples/aquarium/tools/download.mjs` (once), then `electron
  examples/aquarium/tools/prepare.mjs` (Electron is in the browser's
  apps/browser/node_modules/.bin). prepare.mjs rewrites the tank, the
  bubblers, and the fish in index.holoml, between its prepare.mjs
  comments, from ocean.js.
- The water's haze and moving light are added to every model material
  as it compiles (water.ts, onBeforeCompile); the viewer goes over the
  materials again when models load or change (waterDirty in scene.ts),
  and asks for their shaders to be compiled then (shadersWanted): the
  last frame stays on the screen until they are, and a page's hooks say
  `compiling`. Checks that click in a scene wait until it is drawn and
  not compiling (painted() in m21.e2e.ts).
- A tab hidden behind another is hidden by style, which Chromium still
  counts as seen; the room tells the tab view (setShown, setInFront),
  which sends a HoloML page "behind" or "in-front". Behind, the viewer
  asks for no frames for what moves (requestFrame's inFrame guard);
  the page's hook says `behind`.
- A sound from a place has left and right analysers; the page's hook
  soundLevels(id) reads what each ear hears, and X3 checks it.
- Drawn in software (GitHub's Linux machines) the aquarium is slow: its
  checks may take up to 600 s each (TANK_TIME in m21.e2e.ts), and the
  m21 file about 18 minutes on `pnpm test:linux`'s 4 processors. Its
  models have triangle budgets (fish.mjs, and prepare.mjs for Poly
  Haven's): shapes.mjs thinTo makes a more detailed file lighter. A new
  fish or rock should get one.
- Shaders compile without holding up the page, and the scene is drawn
  once they are ready, so a page can answer while it is not yet idle:
  checks that an idle page draws nothing start from the harness's
  sceneStill (drawn, not compiling, the frame count holding).
- In vitest 5 the default report on this computer leaves out what
  passing checks log (the load times and frame rates); add
  `--reporter=verbose` to see them. The automatic builds show them.
- The fish's placements for the pictures are shared by the example's
  picture and the screenshots (tests/screenshots/aquarium.ts); they
  hold only with reduced motion, as the script moves the fish every
  frame otherwise.

## Milestone 20, accepted (2026-09-29, prompts 120 to 122)

The plan and its checks (W1 to W12) are in TODO.md, "Milestone 20 —
Sneaker store"; the owner approved the plan, with the recommended
answers, and the build in prompt 120.

Where the work is:

- Browser: branch `m20-sneaker-store`, from `m19-harbour-loft` (pull
  request #36, not yet merged: merge it first). Loading by area in the
  viewer (scene.ts: areas, stand-ins, letting go; budget.ts and
  pictures.ts: what is let go stops counting; api.ts: `loaded` and the
  `load` event; main.ts: the areas(), standIns(), and totals() hooks),
  the store's copy (tests/fixtures/holoml/sneaker-store), its examples
  card and picture, checks W2 to W10 (tests/e2e/m20.e2e.ts, with the
  fixture pages areas.holoml, stand-in.holoml, and areas-limits.holoml),
  T8 grown, the documents, and the screenshots (docs/screenshots/m20).
- holoml: branch `sneaker-store`, from its main after pull request #17:
  the language (SPEC.md, the checker, conformance samples), the store
  (examples/sneaker-store: its pages, scripts, colourways.js, models,
  and tools/download.mjs and prepare.mjs; the download's cache,
  tools/cache/, is ignored by git), its tests, and the README and
  NOTICE.
- The browser's copy of HoloML (packages/holoml) comes from holoml's
  `sneaker-store` branch; once holoml's pull request is merged, sync it
  from main (`pnpm holoml:sync main --examples main`), as milestone 19
  did.

Merged (prompt 121): holoml's #18 and the browser's #37 (after #36);
their automatic builds passed, GitHub Pages published the store, and
W11 passed (the published store in the built app; TODO.md has the
numbers). The browser's copy of HoloML is synced from holoml's main
(a6c88d9). The owner accepted the milestone (prompt 122).

Worth knowing:

- The store is made by its tools: change colourways.js (the colourways,
  their colours, their prices) or tools/prepare.mjs, then run
  `node examples/sneaker-store/tools/download.mjs` (once) and
  `electron examples/sneaker-store/tools/prepare.mjs` from holoml's
  root, look at the store, and commit; prepare.mjs rewrites the places,
  shelves, bays, and ledges in index.holoml and the colour options in
  shoe.holoml, between their prepare.mjs comments.
- The shoe's licence (CC BY 4.0) leaves out logos and trademarks:
  prepare.mjs paints out the mark on its heel tab (in its colour,
  relief, and roughness pictures) and "///FOAM" on its midsole (in its
  relief), at fixed places in the pictures. A new picture of the shoe
  needs the same look.
- Loading by area keeps count of each model file's and picture's users:
  the last model let go releases the file (unload and releaseTemplate in
  scene.ts). A load that finishes after its model was let go is dropped
  (entry.loads).
- Electron names the arrow keys Right, Left, Up, and Down (not
  ArrowRight) for sendInputEvent.
- W10 reads the page's memory through its debugger (collecting garbage
  first); the process's working set is only logged.
- The store's bench is in the middle of the hall: W6 walks the left-hand
  lane (the right-hand one has the About sign's stand in it).

## Milestone 19, accepted (2026-09-29; built in prompt 118)

The plan and its checks (V1 to V12) are in TODO.md, "Milestone 19 —
Harbour Loft"; the owner approved the build in prompt 114, and it was
handed off mid-build (prompt 116) and finished in prompt 118.

Where the work is (holoml's pull request #17 is merged, and GitHub
Pages publishes the site; the browser's is pull request #36, with
Auto-fix on):

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
  main (SOURCE.json: 4d69a69, the merge of #17).

Merged (prompt 121): the browser's #36, after its automatic builds
passed (V8 to V10 were given time for drawing in software after `pnpm
test:linux` ran them out of time; then its Linux job failed V5 and V8,
which read the page too late on GitHub's slower machine, fixed
2026-09-29: TODO.md, milestone 19's results). V11 passed (the published
site in the built app). The owner accepted the milestone (prompt
122). The AGENTS.md wording for the README's pictures is approved and
in (prompt 119). For an owner decision later: ARCHITECTURE.md section
10, item 4 (large scenes: shaders compiled on the page's main thread,
every model a Tab stop).

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

- With the installers (milestone 25): Windows signing (Microsoft's
  Artifact Signing recommended, or SignPath Foundation), updates
  (automatic from GitHub Releases recommended), Linux formats (AppImage
  and .deb recommended), the Windows installer type (per user
  recommended).
- With the macOS release (milestone 26): the Apple Developer Program for
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
- No installers, signing, or updates (milestones 25 and 26).
- No installers attached to releases: v0.9.0 is source only.
