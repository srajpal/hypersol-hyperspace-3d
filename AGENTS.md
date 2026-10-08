# AGENTS.md — Project instructions for AI agents

Read this file first. It applies to every agent and tool working in this
repository. CLAUDE.md imports it, so Claude Code reads it automatically.

## Project

HyperSol HyperSpace 3D (short: HyperSpace 3D): an open-source desktop
browser with a 3D interface,
plus HoloML, a 3D markup language kept in its own repository.

- Brief: BRIEF.md (user, problem, idea, first result, later features)
- Architecture: ARCHITECTURE.md (parts, files, decisions, screens, open questions)
- Roadmap and current plan: TODO.md (milestones, tasks, checks)
- Prompt log: PROMPTS.md (every prompt the owner gives, lightly edited)
- Handoff: HANDOFF.md (current state and how to resume; keep it current)
- Browser repo: https://github.com/srajpal/hypersol-hyperspace-3d
  (renamed from hypersol-websurfer-3d on 2026-09-26; GitHub redirects
  the old address)
- Language repo: https://github.com/srajpal/holoml
- Local layout: two sibling folders, this repo (on the owner's machine
  still in the folder `hypersol-websurfer-3d/`; renaming the folder is
  optional)
  and `holoml/`, side by side under the same parent. Never nest one in
  the other. PROMPTS.md in this repo is the single prompt log for both.
- License: Apache 2.0 (both repos); HoloML spec text also CC BY 4.0

## Naming conventions

- The company is "HyperSol", with no "LLC" or "Inc." after it. It was
  founded in 2001 and no longer exists; this is a personal project
  honouring it, not marketed for now (owner, prompt 56).
- The founders are named without job titles.
- Copyright: "The HyperSpace 3D Authors" (this repository) and "The
  HoloML Authors" (holoml), each with an AUTHORS file. Contributions come
  under Apache 2.0's own terms; no contributor agreement (prompt 57).
- The browser is "HyperSol HyperSpace 3D"; its short display name, used
  in the app's own interface, is "HyperSpace 3D" (renamed 2026-09-26,
  owner, prompt 42; it was "HyperSol WebSurfer 3D" before).
- The original 2001 product is "HyperSol WebSurfer". "HyperSpace 3D" was
  also the title of an early HyperSol concept screen (2001 to 2003); do
  not claim that concept shipped. The language is "HoloML", file
  extension `.holoml` (owner, prompt 63; `.holo` and `.hlml` were taken).
- Internal identifiers keep their names: the `@hypersol/` package scope,
  `hypersol:` IPC channels, `HYPERSOL_*` environment switches,
  `hypersol.sqlite`, and the "hypersol-private" partition.

## Rules

1. Work only in this project: this folder, the sibling holoml folder,
   and the session scratchpad. Caches that installs write elsewhere by
   design (the pnpm store, Electron and Playwright download caches) are
   allowed. Development and test runs use a disposable browser profile
   under the ignored `userData/` folder or a temporary directory, never
   the owner's real profile.
2. Build only what the owner has approved. Approval comes in two kinds:
   first a milestone's plan is approved, then its build. Build approval
   covers every task in that milestone's plan in TODO.md. The agent
   checks in at any decision point the plan marks (for example the
   milestone 1 spike result) and at the end for acceptance. Anything not
   in the plan's tasks needs its own approval.
3. Use only the data and services agreed in ARCHITECTURE.md. No new
   network calls, services, hosting, or third-party accounts without
   separate approval.
4. Ask before adding software (packages, tools, runtimes), deleting work,
   resetting saved data, initialising or force-pushing git, or publishing
   anything.
5. Ask when a requirement is unclear or two readings would lead to
   different work. Do not guess on scope.
6. Keep private data and secrets out of the repository, the docs, the
   tests, and the prompt log. No API keys, tokens, passwords, personal
   addresses, or real browsing data. Use placeholders and a .gitignore.
   See Prompt log for redaction.
7. Never invent results. Report what actually ran and what it produced.
   If something failed or was skipped, say so.
8. Never remove or weaken a requirement, a test, or an assertion to get a
   pass. Fix the code, or report the failure and ask.
9. Keep the README and other docs current. Any change that alters
   behaviour, setup, structure, or decisions updates the matching doc in
   the same change.
10. Mark run and test steps "not checked yet" until they have actually
    been executed in this project. Record commands only after they ran.
11. Commit after each completed, approved change, with a clear message
    that says what changed and why. Push before starting a milestone and
    after finishing one (owner instruction, 2026-09-26, prompt 37);
    otherwise push only when asked. When five or more commits are
    waiting to be pushed, remind the owner at the end of the reply.
    Never rewrite published history.
12. One active agent session per working tree at a time. If two sessions
    must run at once, they work in different folders. Before appending to
    PROMPTS.md, read its last heading and use the next number.
13. Security cadence: at the start of each milestone, check Electron's
    release notes for security releases. Upgrade to the current supported
    stable line before any public release. Record the version and the
    date checked in ARCHITECTURE.md section 3.

## Prompt log

Applies to the project owner's sessions only; contributors do not log
prompts. PROMPTS.md is a public record of how the software was built.
Every prompt from the owner is added to it in order, before the work for
it begins, as `## N — date · model, effort` followed by the prompt.

The text is lightly edited (owner, prompt 57): spelling and typing slips
are fixed and the meaning is kept; nothing personal, private, or secret
goes in (no keys, passwords, addresses, phone numbers, or non-public
names), and no tool bookkeeping (token counts, session ids). Images and
pasted output are summarised in one line. Short approvals are kept.
A prompt that only answers the agent's questions ("Q1: a") or approves
a draft gets a note above it saying what was asked, with the chosen
options spelled out, or what was approved (owner, prompts 61 and 63).

Do not change earlier entries except to correct an error.

## Working agreement

- The owner approves: the brief, the architecture, each milestone plan,
  each milestone build, and each finished milestone. Show drafts and
  wait.
- Prefer small, reviewable changes. One milestone at a time.
- When a rule needs changing, propose the wording and wait for approval.
  Do not change this file silently.
- Unfamiliar terms get a one-line explanation the first time they appear
  in a document.
- At the end of each milestone, save screenshots of the main screens to
  docs/screenshots/<milestone>/ with `MILESTONE=mN pnpm screenshots` (3D
  scenes as JPEG), and add them to docs/progress.md. Then take the
  previous set out of the tree and point its links in docs/progress.md
  at the last commit that has it, so the tree keeps only the newest
  desktop set. The README keeps a short progress paragraph that links
  there. (Added 2026-09-25, prompt 21; the progress page split out
  2026-09-26, prompt 47; only the newest set kept from prompt 161, the
  review of 2026-09-30, H6.)
- The README always opens with four screenshots of the newest version
  or milestone, good-looking ones that show the variety of what the
  browser does: refresh docs/screenshots/readme*.png with `pnpm
  screenshots:readme` at the end of each milestone and each release,
  and look at them. They show Harbour Loft, Blockworld, a sample page
  in the layers view, and the instrument panel, all served locally.
  (Owner, prompt 68; the showroom from prompt 81, Q5 a; four pictures
  since prompt 99, the wording approved in prompt 100; Harbour Loft in
  place of the sofa studio from prompt 118.)
- Owner-only automation (Remote Control at session start, the prompt-log
  reminder) lives in CLAUDE.local.md, which is gitignored, so
  contributors' sessions never inherit it.

## Testing

Where tests live:
- Unit tests next to the code they test: `*.test.ts` in each package, in
  apps/browser/src, and in apps/android/src (the Android room page's);
  the Android app's Kotlin unit tests (JUnit) in
  apps/android/app/src/test.
- End-to-end tests in tests/e2e (Playwright driving the Electron app).
- Test fixture pages in tests/fixtures, served from 127.0.0.1.
- HoloML conformance fixtures in the holoml repo under conformance/.

How to run (from the repo root; first recorded 2026-09-24 on Windows 11
after they ran; on Windows and Linux in GitHub Actions since 2026-09-26,
see .github/workflows/ci.yml; macOS not checked yet). Counts are as of the
date given and grow with each milestone; TODO.md has the latest.
- Toolchain: Node 24 (the Node inside Electron 44; the automatic
  builds run it, and Node 26 for lint, types, and unit tests; owner,
  prompt 161; `engines` asks for 24 or newer since prompt 164); pnpm
  12.4.1, pinned in package.json.
- Install: `pnpm install --frozen-lockfile`
- Unit: `pnpm test` (Vitest; 502 tests passed on 2026-09-30;
  each test may take up to 20 seconds, vitest.config.ts)
- HyperSpace 3D for Android (milestone 24; first run 2026-10-05): after
  `pnpm build` and `pnpm --filter @hypersol/android build:web`, in
  apps/android `./gradlew testDebugUnitTest assembleDebug` (JDK 21 and
  the Android SDK; JAVA_HOME and ANDROID_HOME set, or the SDK's place in
  local.properties, which is not committed), then `adb install -r
  app/build/outputs/apk/debug/app-debug.apk` on a device plugged in over
  USB. The automatic builds run the same on Linux (the "Android" job,
  part of "All checks"); the checks on a device are run by hand. A test
  run on the device uses pages served from this computer over USB
  (`adb reverse`), never the owner's own accounts or data in the app.
- Lint and type check: `pnpm lint` and `pnpm typecheck` (both clean;
  lint takes about half a minute, as three of its rules need the types:
  a promise nobody awaits or catches is an error, since the review of
  2026-09-30)
- End-to-end: `pnpm test:e2e` builds the app, then runs Playwright
  against it (about nineteen minutes; 374 checks in 27 files: 372 in
  the full run on 2026-09-30, after the review's fixes, all passed on
  this computer, and two added after it, each run in its file; TODO.md
  has the details). On
  this computer vitest's report leaves out what passing checks log (the
  load times, frame rates, and memory); `pnpm test:e2e
  --reporter=verbose` shows it, as the automatic builds do. Needs
  openssl on PATH for the certificate-error check (Git for Windows
  includes one). Every
  host except 127.0.0.1 is blocked during the run, and the test windows
  ignore the real mouse, so a resting cursor cannot disturb results. See
  TODO.md for results. The automatic builds run the end-to-end checks
  in four parts side by side on each system, so a build takes as long
  as its longest part (two parts from prompt 122, Q7 a; four from
  prompt 134): HYPERSOL_E2E_PART=2 runs milestones 14 to 17's files
  (HoloML pages, the showroom, Blockworld) and the viewer's checks from
  the review of 2026-09-30, 3 milestones 18 to 20's
  (the sofa studio, Harbour Loft, the sneaker store), 4 milestone 21's
  (the ocean tunnel), and 1 everything else (vitest.e2e.config.ts lists
  them); without it, every check runs, and a part number that does not
  exist stops the run. A check may take 60 seconds unless it says
  otherwise, and a hook (what runs before and after a file's checks) 300.
  A last job, "All checks", passes only when every part has. A push or
  pull request that changes documents only (the *.md files at the top
  and the docs folder, which no check reads) skips the parts, and "All
  checks" passes at once (owner, prompt 135).
- Test windows stay out of the way (owner request, 2026-09-25): they
  open off screen, never take focus, and have no taskbar button, so the
  computer can be used during a run; `pnpm screenshots` works the same
  way. To watch a run in normal windows, set HYPERSOL_TEST_SHOW=1 (for
  example `HYPERSOL_TEST_SHOW=1 pnpm test:e2e`); then leave the machine
  alone while it runs. Check C1 confirms background windows are off
  every display and unfocused.
- GitHub's Linux machines have no graphics card and draw in software
  (the review of 2026-09-30 found that its Windows machines draw in
  software too). To
  draw that way on any machine and find checks that pass only with a
  graphics card, set HYPERSOL_TEST_SOFTWARE=1 (for example
  `HYPERSOL_TEST_SOFTWARE=1 pnpm test:e2e`; first run 2026-09-27); the
  frame-rate budgets, the HoloML load-time budgets (S2, T5), and the
  responsiveness budgets while a heavy HoloML page loads (R3, T2), and
  what only a graphics card draws (shadows, U9; the water's moving
  light, X2) are
  then measured and logged, not checked, as there (owner, prompts 59,
  95, and 96), and each such check reports "skipped" in software, not
  "passed" (C9 and G9's frame-time budget since the review's first
  wave; R3, S2, S6, T2, T5, U9, U13, V8, W6, X2, X5, and X9 since its
  second: each is split so that what needs no graphics card still
  runs and passes).
  So the budgets are checked only on a computer with a graphics card
  (today, the owner's). Drawn in software, a HoloML scene has half as
  many pixels each way and no smoothed edges (the viewer's own
  behaviour since prompt 135, checked in review-134-viewer.e2e.ts).
  Checks of scenes wait
  for what they check, not for fixed times (holdKeyUntil, framesDrawn,
  sceneStill, and sceneWait in tests/e2e/harness.ts), and a key held
  in a scene is held for an amount of the scene's own time (the
  viewer's `clock` test hook; the `hold` or `holdKey` helpers in m14,
  m17, m18, and m19), since a scene drawn slowly runs behind the
  clock; a check that an
  idle page draws nothing starts from sceneStill, as a page compiling
  shaders is not yet idle (milestone 21), and a check that the idle
  room draws nothing starts from roomStill (no switch animation, every
  loaded page's picture on its card, and a second and a half without a
  frame). A check that something does not happen looks once caughtUp
  returns (the app has dealt with everything the page had sent it), not
  after a sleep, which proves nothing on a slow machine. A check that
  clicks the permission prompt or an action of the download notice
  waits for `[data-armed]` on it: both take no click for their first
  half second. A wait stops at once, with AppGone, when the app's
  process has ended.
- Linux on this computer, the way GitHub's Linux machines run the
  checks: `pnpm test:linux` (needs Docker; first run 2026-09-28, owner,
  prompts 103 and 104). It builds tests/linux/Dockerfile (Ubuntu 24.04,
  Node 24, a virtual display, a throwaway keyring), sends in a fresh
  copy of the repository (the committed files with changes to tracked
  files), and runs the CI job's steps in a container of GitHub's size (4
  processors, 16 GB) with no graphics card; `pnpm test:linux <vitest
  arguments>` runs chosen end-to-end files only. It finds Linux
  problems before a push and reproduces them in minutes; the automatic
  builds stay the check a pull request is merged on.

What to recheck after any change (regression list; grows with each
milestone; the current milestone's checks are defined in TODO.md):
- Milestone 1 checks C1 to C11 from TODO.md (`pnpm test:e2e`): app
  launches, clicks land on the tilted page, parallax does not shift
  targets, typing, scrolling, hover and links, page isolation, no
  unexpected traffic, idle efficiency, load failure, page crash. Plus
  the unit tests (`pnpm test`).
- Milestone 2 checks D1 to D11 (same command): top bar, tabs, snapshots
  and favicons, many tabs, new-window rules, loading strip, error cards,
  right-click menu, start panel, shortcuts, About.
- Milestone 3 checks E1 to E10 (same command): bookmarks, history,
  Library, start panel data, search engine setting, reopening tabs,
  data intact after restart, clearing data, damaged or blocked saved
  data, keyboard access to the panels.
- Milestone 4 checks F1 to F10 (same command): tracker and ad requests
  blocked, shield count and popover, element hiding, blocked page with
  "open anyway", pausing a site, encrypted DNS setting and blocked
  resolver, filter lists (starter copy, refresh, failures), no unexpected
  traffic.
- Milestone 5 checks G1 to G9 (same command): layers view on and off,
  input through it, pinned parts, button and shortcut, global and
  per-site settings, image rectangles, pages that change, reduced
  motion, efficiency. The layers view is on by default, so every earlier
  check runs with it on.
- README screenshots: `pnpm screenshots:readme` (four since 2026-09-28,
  prompt 99: Harbour Loft (since prompt 118; the sofa studio before),
  Blockworld, a made-up sample page in the layers view, and the
  instrument panel; from local copies in
  tests/fixtures, no network; first run 2026-09-27; not a test).
- The HoloML examples' pictures: `pnpm screenshots:examples` (from the
  local copies, no network; first run 2026-09-27). They are part of the
  browser: run it when an example changes, before `pnpm screenshots`.
- Filter lists: `pnpm filters:update` rebuilds the starter copy from the
  internet (run before a release; first run 2026-09-26). It is the only
  place the blocker's page scripts are fetched, and it records the
  SHA-256 of the starter copy and of the scripts in starter.json, which
  the app checks (not run again since the review's change to it: not
  checked yet).
- Milestone 6 checks H1 to H7 (same command): theme switch, Settings >
  Theme with "Match the system", the room and window following the
  theme, page tilt, the layers view's outline; H5 (contrast) and H8 (no
  hard-coded colours; since the review of 2026-09-30 in the room's code,
  renderer/scene, too, with preload/theme-colours.test.ts for what the
  page preload draws) are unit tests.
- Milestone 7 checks I1 to I9 (same command): the instrument panel on
  and off, page readouts, certificates, console, network list, browser
  gauges, the settings per part, DevTools, efficiency.
- Milestone 8 checks J1 to J8 (same command): zoom, find in page,
  downloads, printing, private tabs (marking, no history, separate and
  cleared cookies, not reopened, shield), keyboard.
- Milestone 9 checks K1 to K10 (same command): saving passwords
  (encrypted; Update, Not now, Never), filling only on click and the
  same site, the Library's Passwords tab, private tabs, a missing
  keychain, the permission prompt, remembered choices, the site panel
  and marker, the download notice, the "+" menu and flat printing.
- Milestone 10 checks L1 to L10 (same command): reopening closed tabs
  with their history, tab search, mute, card size, cards that hide and
  the list in the top bar, economy mode, sleeping tabs, history through
  the worker, and its budget with 100,000 visits.
- Milestone 11 checks M1 to M8 (same command): two ways to show tabs,
  address bar completion, the wider page, view settings, menus that
  close, Settings sections and search, shortcut remapping, and the
  Library search reset. Checks that use a setting first show its
  section with settingsTo (tests/e2e/harness.ts).
- Milestone 12 adds checks N1 to N7 (TODO.md): documents, privacy,
  legal files, version, the automatic builds on Windows and Linux, and
  the notice without WebGL 2 (tests/e2e/m12.e2e.ts).
- Milestone 14 checks P1 to P11 (same command, tests/e2e/m14.e2e.ts):
  HoloML pages open and fill the window, models and materials, orbit and
  walk, links, labels, lights, animation, mistakes, safety, browser
  features, files from the computer, efficiency, and without WebGL 2.
  The copy of HoloML's packages is checked by packages/holoml's test.
- Milestone 15 checks R1 to R9 (same command, tests/e2e/m15.e2e.ts):
  HoloML limits (file and page sizes, pictures, triangles, many
  elements; the shell answering within 200 ms while a page of many
  elements loads is logged in software, and skipped), stopping and the
  30-second limit, repeated visits, the
  keyboard, the accessibility tree, reduced motion and the text view,
  and the Scene inspector. The large files are generated by the fixture
  server (tests/e2e/fixture-server.ts, /holoml/gen/). R4 waits out the
  30-second limit once.
- Milestone 16 checks S2 to S7 (same command, tests/e2e/m16.e2e.ts):
  HoloML's showroom, a copy from the holoml repository in
  tests/fixtures/holoml/showroom (`pnpm holoml:sync`; its test checks
  the copy, and from milestone 17 every example's): the start panel link, loading within budget, walking,
  links and colours, the keyboard and text view, reduced motion,
  efficiency, and credits (the load and frame-rate budgets are logged
  in software, and skipped). S1 is holoml's own unit test. Also a HoloML
  page in a development run (the viewer from the dev server).
- Milestone 17 checks T2 to T8 (same command, tests/e2e/m17.e2e.ts):
  HoloML 0.2 scripts (the scene API; inline, other-site, failing, and
  never-ending scripts; the browser answering within 200 ms beside a
  script that never stops is logged in software, and skipped), sound
  (nothing before the first click or key, the tab's mute, the limits),
  walls and gravity, and Blockworld (a copy in
  tests/fixtures/holoml/blockworld): loading and drawing (the load
  and frame-rate budgets logged in software, and skipped), breaking and
  placing, the five gems, night and torches, the keyboard, the text view
  and the accessibility tree, reduced motion; and the HoloML examples
  section. T1 is holoml's own tests. After the milestone's report
  (prompt 89): a HoloML tab's card shows its scene once drawn, and
  Blockworld plays in a development run.
- Milestone 18 checks U2 to U6 and U9 to U15 (same command,
  tests/e2e/m18.e2e.ts). First part: walking and turning speeds (the
  page's, the default, and a script's), sliders (keyboard, mouse, the
  script's change event, the keys a slider keeps, screen readers, the
  text view), and Blockworld's Speed slider. Second part: shadows (the
  floor's pixels; drawn in software they are left out, and the check
  logs that and is skipped), a material's pictures and tiling, choices (mouse,
  keyboard, screen readers, scripts, the text view), light from a
  panorama of the surroundings, and the sofa studio (a copy in
  tests/fixtures/holoml/sofa-studio): loading within 5 s (logged in
  software, and skipped), every fabric and wood, the price, the cart page, the
  keyboard alone, and no frames while idle. U1 and U8 are holoml's own
  tests.
- Milestone 19 checks V2 to V10 (same command, tests/e2e/m19.e2e.ts):
  panels (the page's pixels, Find in page, screen readers, the text
  view), click actions (the mouse, Enter and Space on their buttons, the
  sound, reduced motion, scripts), places (#name, "Go to", Back),
  arriving through a fade, the sky, and the floor plan; and Harbour Loft
  (a copy in tests/fixtures/holoml/harbour-loft): ready within 5 s
  (logged in software, and skipped), walls and a shut door that stop
  the walker,
  every door and lamp, the roof terrace and back, the booking page's
  form that sends nothing, the whole tour from the keyboard, screen
  readers, the text view, reduced motion, and no frames while idle. V1
  is holoml's own tests; V11 (the published site) is checked by hand.
- Milestone 20 checks W2 to W10 (same command, tests/e2e/m20.e2e.ts):
  loading by area (a far group not fetched, walking near loads it,
  walking away lets it go and its bytes stop counting), stand-ins,
  scripts' `loaded` and `load` event, and the limits counting only what
  is loaded (fixture pages areas.holoml, stand-in.holoml, and
  areas-limits.holoml); and the sneaker store (a copy in
  tests/fixtures/holoml/sneaker-store): ready within 5 s (logged in
  software, and skipped), the shelves by the entrance loaded and the rest as
  stand-ins, walking down the hall loading each shelf, the counter, bays,
  and walls stopping the walker, a shoe's page through a fade, every
  colourway in place, turning a shoe over, sizes, the cart and the
  checkout page that places nothing, the keyboard alone, screen
  readers, the text view, reduced motion, no frames while idle, and the
  page's memory falling again once far shelves are let go. W1 is
  holoml's own tests; W11 (the published site) is checked by hand.
- Milestone 21 checks X2 to X9 (same command, tests/e2e/m21.e2e.ts):
  water (a far model takes more of the water's colour than a near one,
  one outside the water keeps its own, and the light from the waves
  moves over a floor, holds still with reduced motion, and is left out
  in software, and skipped), sounds from a place (each ear's level as
  the viewer
  walks away, and silence beyond the range), and a script's animation
  speed (fixture pages water.holoml, caustics.holoml,
  sound-place.holoml, and animation-speed.holoml); and the ocean tunnel
  (a copy in tests/fixtures/holoml/aquarium): ready within 5 s (logged
  in software, and skipped), the fish in the water and clear of the
  tunnel and the
  rocks, the ledges and the rail stopping the walker, feeding (every
  flake eaten), a fish's panel from a click through the glass and from
  its button, the keyboard alone, screen readers, the text view,
  reduced motion, the frame rate (logged in software, and skipped),
  no frames behind
  another tab, and the page's memory over two minutes. X1 is holoml's
  own tests; X10 (the published site) is checked by hand.
- Milestone 22 checks Y1 to Y10 (TODO.md): HoloML's documentation. Most
  are holoml's own tests (the specification's form, its grammar, its
  Web IDL, the guides' examples, the reference pages, and the site's
  links, headings, pictures' text, keyboard access, and contrast); in
  this repository, apps/browser/src/viewer/api.test.ts holds the
  viewer's scene API to the Web IDL, and T8 checks the examples
  section's link to the published specification, and Y7b
  (tests/e2e/m22.e2e.ts) that a page too tall to lift in one layer
  stays flat and draws in the layers view. The screenshots add
  the documentation in the browser, built from the holoml repository
  beside this one. Y5 and Y9 (the published site) and Y6's screen
  reader are checked by hand.
- The review of 2026-09-30 (prompts 134 and 135) adds five files (same
  command), each check named for the review's finding:
  - tests/e2e/review-134-main.e2e.ts, the main process and the page
    preload: what a page may do without asking, WebSockets, a service
    worker's requests, and a listed favicon through the shield, a link
    that leads to a download, leaving a page that asks to
    be kept, what counts as a HoloML page (a download, a sandboxed
    answer, the site's own policy kept), HoloML files from the computer
    (from Downloads, leaving for the web, no peer connections and no
    frames for its script (prompt 172), a dropped file), Block for a
    page that asks to be kept, a start that fails, and a shell that
    crashes.
  - tests/e2e/review-134-shell.e2e.ts, the shell (R1 to R7): a HoloML
    page that fills the window drawn flat, switching panels, error cards
    that go, a prompt and a notice that take no click at first, the
    address bar, eight smaller faults of the top bar, tabs, and panels,
    the room drawing only what is needed and its cards hit where the
    rail lays them out while the context is lost, and access (the tab list,
    error cards, dialogs, reduced motion, composed text, menu keys,
    Escape).
  - tests/e2e/review-134-viewer.e2e.ts, the HoloML viewer (V2 to V10 and
    D12): versions it does not know, a model that cannot be decoded,
    triangles counted once decoded, the limits on lights, a still walker
    with gravity, the text view's keys, the private line to the browser,
    a script beside a problem, a graphics reset, a sound with a short
    range, hidden things, drawing in software, and the test hooks only
    in a test run (13 checks); and, from the review's second wave, the
    viewer and the specification's third edition (nine checks, Sp): a
    member a kind lacks, `parent` through a link, frozen vectors, the
    frame event's dt, what `holoml.add` leaves out, a panel inside a
    link in the text view, ambient lights, a model that needs an
    unsupported glTF extension, unlit materials, the syntax-error
    card, and a 0.1 page's hud (22 checks in all; fixture pages
    tests/fixtures/holoml/review-134-*, two models in the fixtures
    written by review-134-make-models.mjs, and two the fixture server
    generates).
  - tests/e2e/review-134-harness.e2e.ts, the test tools themselves: the
    slow download that holds until it is released, a wait that stops
    when the app has gone, and caughtUp.
  - tests/e2e/review-134-features.e2e.ts, the second wave's features
    (7 checks): HTTP sign-in (the prompt names the site and quotes its
    realm, the right answer loads the page; Cancel, Escape, and a
    wrong password; the prompt belongs to its tab and is cancelled by
    leaving or closing; a second one waits its turn, a long realm is
    cut, a picture from another site cannot ask), the window's size
    and place remembered (a restart, and a damaged saved size), and
    the text view's shortcut (a HoloML page only, changeable in
    Settings > Shortcuts).
  The pure parts are unit tests beside the code, new with the review:
  main/permissions, security, holoml, ipc, leave-page, start-up,
  tab-history, passwords/index, storage/scrub, sign-in, and
  window-bounds; viewer/values, versions, sound, controls, instances,
  and main; shared/settings, sign-in, and site; and
  preload/theme-colours.
- Milestone 23 checks Z1 to Z10 (TODO.md): HoloML for VS Code, in the
  holoml repository's packages/vscode. Its unit tests run with holoml's
  `pnpm test` (the grammar, every conformance sample and example site,
  suggestions, hover, the built extension with the network refused, and
  the .vsix's contents); its tests inside VS Code with `pnpm --filter
  holoml-vscode test:vscode` there (holoml's AGENTS.md has the details).
  Nothing in this repository changes with it.
- Milestone 24 checks AN1 to AN9 (TODO.md): HyperSpace 3D for Android,
  on the owner's tablet, by hand (the app opens to the room; a page on
  the tilted panel where taps land; tabs; the top bar; HoloML pages
  with touch alone; the frame rate with the lighter drawing; nothing on
  the network but the pages; rotation and tilt; and the desktop's
  regression, as the room, the top bar, and the viewer are shared). The
  shared parts' unit tests run with `pnpm test` (viewer/touch.test.ts,
  apps/android/src/bridge.test.ts), and the app's with Gradle.
- Milestone 25 checks HL1 to HL10 (TODO.md): HoloML 0.3. HL1 is
  holoml's own tests (the language, and its RELAX NG schema checked by
  Jing, which needs Java there). In this repository (same command,
  tests/e2e/m25.e2e.ts): names for models and groups, and a link named
  by them (HL2); the language and direction of text (HL3); a page's
  description (HL7); compressed models, Draco, meshopt, and KTX2, the
  last through the transcoder's own host (HL4; fixture pages and models
  in tests/fixtures/holoml/compressed, made by its make.mjs); far models
  (HL5); the scene API of 0.3 (HL6); how a panorama faces; and the
  example sites (HL9: every model a screen reader reaches has a name;
  the ocean tunnel's far fish, and its frame rate, logged in software
  and skipped; the sneaker store's smaller download; Words in a room
  for screen readers). HL8 is every earlier milestone's checks; HL10 the
  full run, the Android app by hand, and the published sites.
- Milestone 26 checks PD1 to PD10 (TODO.md): privacy and data tools.
  In tests/e2e/m26.e2e.ts (same command): HTTPS-only, typed, followed,
  and redirected (PD1), no quiet fallback and no loop (PD2), exceptions
  until the browser closes and kept ones across a restart (PD3), a
  private tab's own (PD4), and the switch (PD5); the Sites tab's list
  (PD6) and clearing one site (PD7); bookmark import, with its preview,
  duplicates, text as written, and a file refused (PD8), and export
  with a round trip (PD9). HTTPS is checked with local fixtures only
  (fixture-server.ts, startDualFixtureServer: three test sites, HTTP
  and HTTPS on one port, a certificate a test run alone trusts by its
  fingerprint, --test-trusted-cert); test runs pass --test-plain-http
  for the plain-HTTP test server's names (shop.test and the shield's
  stand-ins), which HTTPS-only leaves alone, as it does local
  addresses. The pure parts are unit tests beside the code
  (privacy/https-only, site-data, storage/bookmark-file, and the
  service's import and export). PD10 is every earlier milestone's
  checks.
- Later milestones add: privacy and data tools (26), free camera (27),
  lift to 3D (28), and polish (29). No installers (dropped, prompt
  172).

Rules for tests: a failing test is reported, not deleted. A test is
changed only when the requirement it checks has changed, and the doc that
states the requirement is updated in the same change.
