# HANDOFF.md

The state of the project for whoever picks it up next, person or agent.
Last updated 2026-10-09 (milestones 1 to 26 accepted, milestone 26,
privacy and data tools, on 2026-10-08, prompt 184; the next is 27,
free camera, not yet planned, after the fixes of 2026-10-09 below;
the review's last items in TODO.md, "The review's last items". The
roadmap is in TODO.md).

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
  v0.2.0, https://github.com/srajpal/holoml/releases/tag/v0.2.0, and
  its third edition as v0.2.2, tagged 2026-10-01 and released 2026-10-07)); 22 documentation for HoloML to recognised standards (prompt
  115; accepted 2026-10-07, prompt 160); 23 HoloML for VS Code, an extension
  kept in holoml and installed by hand (prompt 146; plan approved with
  the recommended answers, 2026-10-02; accepted 2026-10-05, prompt
  153); 24 HyperSpace 3D for Android (prompts 152 to 161; accepted
  2026-10-07); 25 HoloML 0.3, the features its check found missing
  (prompt 128, Q4 a; accepted 2026-10-08, prompt 174); 26 privacy and data tools
  (HTTPS-only, per-site storage, bookmark import and export: #24, #26,
  #27; accepted 2026-10-08, prompt 184); then free camera (27), lift to 3D (28), and polish (29), the
  last planned. The installers (30 and 31) were dropped in prompt 172:
  the project stays source only, and a fork may package its own build
  (CONTRIBUTING.md, "Making your own build").
- The logo direction is chosen (concept 4d in
  docs/branding/logo-concepts/); there are no app icons yet (the
  installers that would have brought them were dropped, prompt 172).
- HyperSol, the company founded in 2001, no longer exists. This is a
  personal project honouring it, not marketed for now. Copyright: "The
  HyperSpace 3D Authors" and "The HoloML Authors" (AUTHORS files).

Two repositories, kept as sibling folders (never one inside the other).
Both main branches are up to date: milestone 26 is merged here (#63,
2026-10-08), and HoloML 0.3 in holoml (#39, released as v0.3.0 with
#40):

- Browser: https://github.com/srajpal/hypersol-hyperspace-3d (renamed
  from hypersol-websurfer-3d; GitHub redirects the old address)
- Language: https://github.com/srajpal/holoml

## Issues and advisories of 2026-10-09 (prompts 188 and 189)

Before milestone 27: three draft advisories (private tabs, the
Library's passwords), #66 to #68 here, and holoml's #42 and #43, fixed
in the order the owner approved (prompt 189). Branches:
`fix-advisories-issues-66-68` here (pull request #69) and
`fix-issues-42-43` in holoml (pull request #44, merged, which also made
HoloML 0.3.1: the specification's second edition of 0.3; tagged v0.3.1
at 51af846, a pre-release, prompt 190). TODO.md, "Issues and advisories of 2026-10-09",
has each fix, its check (tests/e2e/fixes-189.e2e.ts), and the results.

The copy here is made from v0.3.1 (`pnpm holoml:sync v0.3.1 --examples
v0.3.1`; the example sites did not change). How to resume: #69's
automatic builds, the owner's merge, then the advisories, which stay
drafts until the owner publishes them; then milestone 27.

## Milestone 26, privacy and data tools (2026-10-08, prompts 177 to 179)

Accepted 2026-10-08 (prompt 184). Built on the branch m26-privacy-data,
merged as #63, which closed #24, #26, and #27; every automatic build
passed (T6 once only on a second try, noted in TODO.md to be watched).
Plan approved with the recommended answers (prompt 178), build approved
(prompt 179). TODO.md, "Milestone
26", has the plan, the decisions made while building (among them:
Q5's "whether a site has some" storage cannot be known from Electron,
and the owner kept Q5 a as built, prompt 181), and the results.
- HTTPS-only (#24): main/privacy/https-only.ts (decisions, unit tested),
  wired into the shield's listeners in main/privacy/index.ts; the card
  in renderer/load-errors.ts and scene/tab-view.ts; the site panel and
  Settings; settings httpsOnly and httpsOnlySites.
- Per-site storage (#26): main/site-data.ts; the Library's Sites tab.
- Bookmark files (#27): main/storage/bookmark-file.ts, the data
  service's import and export, the Library's Bookmarks tab.
- Checks PD1 to PD9 in tests/e2e/m26.e2e.ts, with
  startDualFixtureServer and the test switches --test-trusted-cert and
  --test-plain-http.

## Milestone 25, HoloML 0.3 (2026-10-07, prompts 167 to 170)

Accepted 2026-10-08 (prompt 174). Built on two branches, m25-holoml-0.3
here and holoml-0.3 in holoml, merged as #59 and holoml #39 (the
browser's copy of HoloML and its examples is synced from holoml's
main: `pnpm holoml:sync`).
TODO.md, milestone 25, has the plan, the decisions made while building,
and the results so far.

- holoml: SPEC.md is HoloML 0.3 (first edition, 2026-10-07): `label` on
  models and groups, `lang` and `dir`, `far` and `far-from`, more
  of the scene API, and, for every version, the look, panoramas, and
  minimum limits written down; the grammar, the checker, conformance
  samples, guides, and the RELAX NG schema checked by Jing
  (tools/jing/; needs Java). The examples take up 0.3, and a new one,
  Words in a room. The tools for the examples use glTF Transform
  (development packages): the store's compress.mjs, the aquarium's
  far.mjs.
- The browser: the viewer's names, language and direction
  (viewer/language.ts), far models, the 0.3 scene API, compressed
  models (viewer/decoders.ts; KTX2 through viewer/ktx2-host.ts, a host
  page with its own content policy, owner's choice in prompt 170), and
  a page's description in the tab's tooltip, the text view, and the
  Scene inspector. Checks HL2 to HL9 in tests/e2e/m25.e2e.ts.
- Done: the full end-to-end run (388 of 393; the five clipboard checks
  failed because Windows refused the clipboard to every program at the
  time, to be run again), the changed files on Linux, the screenshots
  (m25; m22's set out of the tree) and the README's four, and the
  Android build. Both pull requests merged (holoml #39, the browser
  #59), the automatic builds passed, and the clipboard checks passed
  when run again (prompt 172). The checks on the tablet
  passed (prompt 174), and the owner accepted the milestone. The
  published sites checked by hand (HL10): cleared by the owner
  (2026-10-09, prompt 186).
  HoloML 0.3 is tagged v0.3.0 (holoml #40's merge, 64e4e3e; a
  pre-release, https://github.com/srajpal/holoml/releases/tag/v0.3.0,
  prompt 176), and the browser's copy of HoloML is made from the tag
  (`pnpm holoml:sync v0.3.0 --examples v0.3.0`; only the copied
  files' "at" lines, the package's version, and SOURCE.json changed).
- After it (prompt 172, branch m25-follow-up): peer connections blocked
  for real (viewer/guard.ts), local KTX2 pictures served, the
  large-scene items, D8's lost right-click, the installers dropped
  (CONTRIBUTING.md, "Making your own build"), and the ocean tunnel's
  example picture taken again. TODO.md, "After milestone 25".
- Found, not part of this milestone: HoloML's `webrtc 'block'` is
  ignored by Chromium, so HoloML pages could make peer connections
  (TODO.md, milestone 25, results). Fixed in prompt 172: the viewer
  takes them out of the page's JavaScript (viewer/guard.ts; TODO.md,
  "After milestone 25").

## Milestone 24, HyperSpace 3D for Android (2026-10-05 to 2026-10-07, prompts 152 to 160)

Merged into main (pull request #53). The owner checked everything on the
tablet (prompt 160); the one fault, blurred tab cards, is fixed (the
room in economy mode at the display's own resolution on Android).
Accepted 2026-10-07 (prompt 161). What follows is from the build
(2026-10-05).

The browser on the owner's Android tablet, in apps/android: a Kotlin
app on Android's own WebView. Plan approved with the recommended
answers and the build tools (prompt 155); built 2026-10-05 on the
branch `m24-android` (since merged, #53). TODO.md, milestone 24, has the
plan, the decisions made while building, and the results so far.

- How it works: the desktop's own room, top bar, start panel, and
  examples run in one WebView (apps/android/src, built with Vite into
  the app's assets); each tab's page is a WebView over it, drawn onto
  the outline the room computes (PageLayer.kt, Homography.kt), with
  touches mapped back. HoloML pages use the desktop's built viewer,
  which now has touch controls (viewer/touch.ts: a walk pad, a jump
  button, a long press for a right-click) and a lighter drawing that
  the app asks for (half the sharpness, no shadows or moving light on
  water; edges stay smoothed, as this tablet drew nothing without
  them).
- Shared code changed: room.ts takes any page view (RoomView), reports
  each frame (onDrawn), and says which card is under a point (cardHit);
  the top bar can leave out parts (omit). The desktop behaves as before
  (its end-to-end run is the check).
- Building: `pnpm build`, `pnpm --filter @hypersol/android build:web`,
  then in apps/android `./gradlew testDebugUnitTest assembleDebug` and
  `adb install -r app/build/outputs/apk/debug/app-debug.apk`
  (apps/android/README.md). CI builds it on Linux ("Android" job).
- On the tablet so far: pages on the tilted panel take taps where they
  appear, tabs open, close with a swipe, and reopen, HoloML sites draw
  and walk by touch, and the ocean tunnel runs at 33 frames a second.
  The rest (scrolling, pinching, landscape, switching by a card,
  Forward, Reload, a search, Harbour Loft's doors, the other three
  sites, the network log, turning the tablet) the owner checked by hand
  (prompt 160).
- The tablet's Wi-Fi is a hotel's that needs a sign-in; for testing,
  pages were served from this computer over USB (`adb reverse`) by a
  small server in the session's scratch folder, not the repository.

## Milestone 23, HoloML for VS Code, accepted (2026-10-03, prompt 146)

A VS Code extension for HoloML, in the holoml repository's
packages/vscode, planned 2026-10-02 (the recommended answers to Q1 to
Q4), built 2026-10-03, and merged into holoml's main on 2026-10-05
(pull request #32). TODO.md, milestone 23, has the plan, the decisions
made while building, and the results so far.

- What it is: a language server (server.ts) over a language service
  (src/service/), started by a small client (extension.ts); a TextMate
  grammar, language settings, and snippets; esbuild bundles it and vsce
  makes the .vsix (`pnpm --filter holoml-vscode package`). Installed by
  hand; not published; no preview; no network.
- Mistakes come from holoml's own parser and checker; everything that
  must work while a page is half typed (suggestions, hover, the outline,
  folding, tags) uses the extension's forgiving reader
  (src/service/outline.ts). The hover's words are gathered from SPEC.md
  when the extension is built (dist/docs.json).
- Tests: its unit tests run with holoml's `pnpm test` (834 pass); its
  ten tests inside VS Code with `pnpm --filter holoml-vscode
  test:vscode`, in the installed VS Code (all pass in 1.139.1,
  2026-10-05). holoml's CI runs them in a downloaded VS Code 1.96.0 on
  Windows and Linux.
- The checks by hand (Z1 in Cursor, Z3's indentation, Z9's session)
  were done by the owner on 2026-10-05. Accepted 2026-10-05 (prompt
  153).

## The review of 2026-09-30, done (prompts 134 and 135)

The owner asked for a thorough review of both repositories and the
automatic builds (prompt 134), then for its recommendations to be taken
and every finding fixed (prompt 135). TODO.md, "The review of
2026-09-30", has what was reviewed, what was fixed with the check for
each, and what was left on purpose; CHANGELOG.md, Unreleased, has it
for readers. The review's own file, REVIEW-2026-09-30.md, is at this
repository's root on the owner's computer and is not committed: it
named weaknesses before they were fixed. Where it is kept is the
owner's decision.

Where the work was (nothing was pushed yet when this was written; all
of it is merged since, #39 and #45, and holoml's #21):

- Browser: branch `review-134-fixes`, made from `m22-holoml-docs`
  (pull request #39). Merged into it, in two waves: the main process
  and preloads (`review-134/main`), the shell (`review-134/shell`), the
  tests and their tools (`review-134/tests`), the viewer
  (`review-134/viewer`), the documents (`review-134/docs`); then
  `review-134/viewer2` (the viewer doing what HoloML's specification's
  third edition says, the Scene inspector's commands over the
  browser's own line, and repairs to the viewer's checks: key holds by
  the scene's clock, budgets skipped in software) and
  `review-134/features` (a prompt for HTTP sign-in, the window's size
  remembered, Ctrl+Shift+V in the shortcuts table, full screen and
  pointer lock refused again, a permission change naming its site, the
  test-run argument to page preloads, three checks measuring inside
  the app, one record per tab in the shell); and the lead's own changes
  (Electron 44.5.1 with its rule 13 record, Dependabot and the
  repository's files, `.claude/` ignored, the viewer's review checks
  in part 2 of the automatic builds, the history search index's
  secure delete, tab snapshots through the shell-only helper, the
  copy's version from the copied packages, `pnpm filters:update` run,
  lint that knows the types). The documents describe all of it (this
  branch's second documents pass, `review-134/docs2`, to be merged
  too).
- holoml: branch `review-134-fixes`, made from main (3ce0ab2), with
  the language's and the examples' fixes merged: the specification's
  third edition, the packages at 0.2.2, a change log, 44 new
  conformance samples, the new turtle, type-aware lint, and its tests
  run file by file. Its pull request #21 is open
  (https://github.com/srajpal/holoml/pull/21). Nothing is tagged
  since v0.2.0. The browser's copy of HoloML (packages/holoml,
  SOURCE.json) is made from that branch at 9e59907, and the copy's
  package file takes its version, 0.2.2, from the copied packages.
- On GitHub (the lead's record, 2026-09-30): the rule on main requires
  the one check "All checks"; Dependabot's alerts and security updates
  are on, and code scanning is set up, in both repositories (here, since
  prompt 166, by the repository's own CodeQL workflow, which also builds
  and scans the Android app's Kotlin); merged
  branches are deleted on merge from now on. Not done there: the three
  old merged branches (left for the owner), and requiring actions by
  commit (only after both pull requests are merged).

Done since (2026-09-30): every branch is merged; the final runs are
recorded in TODO.md's review section (Windows: 372 checks, all passed;
the Linux container: three checks failed only there and were repaired);
the examples' pictures of the aquarium and Blockworld are taken again
(the progress screenshots of milestones 21 and 22 still show the old
turtle: they are the record of their time); the issues (#40 to #44
here, #22 and #23 in holoml) and the draft security advisories (seven
here, two in holoml) are open; REVIEW-2026-09-30.md carries its status.

All three pull requests are merged (#39 and holoml's #21 on
2026-09-30, #45 on 2026-10-01). holoml is tagged v0.2.2 (2026-10-01,
dc2ad98), and the copy of HoloML is made from that tag (`pnpm
holoml:sync v0.2.2 --examples v0.2.2`; only the copied files' "at"
lines and SOURCE.json changed).

The bug issues opened after the review (#50, #51, holoml #30) are fixed:
holoml's in its #31 (merged 2026-10-01), the browser's on the branch
`fix-issues-50-51`, pull request #52 (TODO.md, "Bug issues after the
review"). The example sites' copy is from holoml's main (267e66e).

How to resume:

1. A GitHub release for v0.2.2 (a pre-release, like 0.2's) is the
   owner's to make; the tag is pushed. (Done, prompt 163.)
2. Publish or close the draft advisories as the owner decides, and
   take the owner's decisions listed under "Deliberately not done" in
   TODO.md. (Done: the advisories published 2026-10-07; the decisions
   in TODO.md, "The review's last items", prompt 160.)

Worth knowing:

- A check that leaves a page with a `beforeunload` handler must take
  Playwright's own dialog out of the way first
  (`h.app.context().on('dialog', () => undefined)`); the app's "Leave
  this page?" is recorded in the test log and answered from there
  (leaveAsks, leaveAnswer in main/test-hooks.ts).
- A check that clicks the permission prompt or the download notice
  waits for `[data-armed]` (half a second after either appears).
- The clipboard checks (D8, K2, and M1's "a real click may still copy
  text") failed on this computer during the fixes while its clipboard
  was out of reach; they are to be run again in the final runs.
- The viewer's test hooks appear on a HoloML page only when the main
  process started the page's process with `--hypersol-test-run`
  (shared/test-run.ts), which it does in test mode alone, never in a
  packaged app; the page preload reads nothing from the environment
  (ARCHITECTURE.md, Scene inspector). Test mode is off whenever
  `app.isPackaged`, so a fork's packaged build has neither.
- The Scene inspector's choosing and picking reach the viewer as
  `select:<index>`, `pick-on`, and `pick-off` on the HoloML command
  channel (main/inspect/index.ts); `window.__holoml` in a normal run
  holds only `scene`.
- A deleted history entry's pieces leave the search index at once
  (schema 5 sets FTS5's secure-delete; storage/scrub.test.ts).
- The viewer's checks hold a key for an amount of the scene's own time
  (the `clock` hook; the `hold` and `sceneTime` helpers in the
  milestone files), since a frame drawn slowly in software makes scene
  time run behind the clock; the budgets that need a graphics card
  report "skipped" in software (AGENTS.md, Testing).
- A check of HTTP sign-in uses the fixture server's
  `/review-134/basic/*` and `/review-134/basic-long/*` (a long realm);
  the test log's `signInsWaiting()` counts the prompts showing or
  waiting. The window-size check launches with `rememberWindow` (the
  harness passes `--test-remember-window`).
- `pnpm lint` takes about half a minute now that three of its rules
  need the types (eslint.config.js).

## Milestone 22, accepted (2026-09-29 to 2026-10-07, prompts 127 to 160)

The plan and its checks (Y1 to Y10) are in TODO.md, "Milestone 22 —
HoloML documentation". The owner answered Q1 to Q7 with the
recommendations and approved the build (prompt 128): a specification in
W3C style, ABNF and a RELAX NG schema made from the checker's table, the
scene API in Web IDL, guides organised by Diátaxis, a site at
https://srajpal.github.io/holoml/ built with `marked` (a new development
package in holoml, approved as Q3 a), the media type's registration
template without registering it, the clarifications in 0.2's text (then
v0.2.1 on the owner's go), and everything in the holoml repository. The
features found missing go to milestone 23, "HoloML 0.3" (Q4 a; 24
since 2026-10-02, 25 since 2026-10-05).

Built (2026-09-29), on branches not yet merged:

- holoml `docs`: SPEC.md in W3C form with its index; spec/ (ABNF,
  RELAX NG made from the checker's table, Web IDL); docs/ (2 tutorials,
  12 how-to guides, 4 reference pages, 5 explanation pages, and a home
  page); site/build.mjs (`pnpm site:build`) and the Pages workflow that
  now publishes the site; `pnpm reference:update` for the reference
  pages and the index; the packages at version 0.2.1. 362 tests.
- The browser `m22-holoml-docs`: the examples section's link to the
  published specification (T8), the copy of HoloML with its Web IDL
  (synced from holoml's `docs` branch; sync again from main once
  holoml's pull request is merged, and from v0.2.1 once tagged),
  api.test.ts (the viewer's API against the Web IDL), and screenshots 64
  to 66 (the documentation in the browser, built from the holoml folder
  beside this one).
- Found and fixed while taking the screenshots: the layers view drew a
  very tall page blank below its bar (the specification's main section
  is 52,000 pixels tall); a section too large to lift now stays flat
  (check Y7b).
- holoml #20 is merged (3ce0ab2, prompt 133) and the site is published:
  Y5 and Y9 pass from its public address. The browser's copy is synced
  from holoml's main.
- The review of both repositories (prompt 134) and its fixes (prompt
  135) have their own section, above. This branch, `m22-holoml-docs`,
  is pushed with the automatic builds in four parts, an "All checks"
  job, the skip for documents, and actions named by commit (fce1e63,
  pull request #39); the fixes are on `review-134-fixes`, made from it.
- Still to do then: a screen reader by hand (Y6, the owner's; cleared
  2026-10-09, prompt 186), the owner's acceptance (prompt 160), and the v0.2.1
  tag on the owner's go (made as v0.2.2, a pre-release). Both projects are marked
  experimental (prompts 129 and 131): HoloML in its specification,
  README, and site, with its releases as pre-releases; the browser in
  its README and About dialog.

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
  m21 file about 18 minutes on `pnpm test:linux`'s 4 processors (that
  was before scenes were drawn at half resolution in software, prompt
  135; since then 8 min 11 s, in the run of 2026-09-30). Its
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

- Both repositories protect main with two rulesets (prompt 130): no
  deletion or force pushes, for everyone; and a pull request merges once
  its CI checks pass (in this repository the one check "All checks",
  since prompt 135), which the owner, as admin, may bypass (so the
  agreed direct pushes to main still work). TODO.md, "Branch
  protection", has the details.
- Desktop first: Windows and Linux, then macOS (not checked yet).
  Android tablets in this repository (apps/android, milestone 24;
  prompt 152); phones and iOS later. Mouse, keyboard, and touch.
- Stack: Electron (the newest stable line; 44.7.0 since 2026-10-07),
  TypeScript, Three.js, Lit, SQLite through Node's node:sqlite,
  @ghostery/adblocker-electron, electron-vite, Vitest, Playwright. Node
  24 or newer, pnpm 12.4.1 pinned. Reasons in ARCHITECTURE.md
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
  every pull request and every push to main (.github/workflows/ci.yml),
  the end-to-end checks in four parts on each system; a change to
  documents only skips them. The runners have no graphics
  card: C9's frame rate is measured but skipped there (owner, prompt
  59), and so is G9's frame-time budget; Linux runs use SwiftShader for
  WebGL and a throwaway GNOME Keyring for the password checks.
- The language is HoloML, file extension `.holoml` ("3DML" was taken;
  "HSML" was checked and advised against; `.holo` and `.hlml` are used
  by other formats). Its syntax is strict and HTML-like, and its 3D
  models are glTF 2.0 (owner, prompts 58 and 63). Version 0.1 is written
  down in the holoml repository's SPEC.md, with a parser, a checker,
  and conformance samples (milestone 13).
- License: Apache 2.0 for both repositories; the HoloML spec text also
  CC BY 4.0. Contributions come under Apache 2.0's own terms.
- Versions: 0.9.0 is the source-only developer preview; no installers
  are planned (prompt 172).

## Open items (need an owner decision when their milestone comes)

- Product gaps noted in the 2026-09-24 review and not yet scheduled:
  onboarding, and a touch equivalent for closing tabs on the desktop
  (the Android app has one: a swipe on a card). Bookmark import came
  with milestone 26.
- No checks by hand are open: the owner cleared Y6 (milestone 22,
  the documentation read with Narrator) and HL10 (milestone 25, the
  published sites and specification) on 2026-10-09 (prompt 186). The
  documents' review of prompt 185 is merged (#65 here, holoml #41;
  prompt 187).
  Proposed, not placed in a milestone: a run of the frame-rate
  and load-time budgets on a machine with a graphics card in the
  automatic builds (TODO.md, after the roadmap).

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
   `MILESTONE=mN pnpm screenshots`, add them to docs/progress.md, take
   the previous desktop set out of the tree, and refresh the README's
   four with `pnpm screenshots:readme` (AGENTS.md, Working agreement).
8. Next: milestone 27, free camera and room navigation. Push first
   (rule 11), check Electron's security releases (rule 13), then draft
   its plan and questions in TODO.md for the owner's approval; nothing
   is built before the plan and then the build are approved.

## Not done yet, on purpose

- HoloML's packages are not published to npm; the browser keeps a copy
  (packages/holoml, pnpm holoml:sync).
- No installers, signing, or updates: none are planned (prompt 172).
- No installers attached to releases: v0.9.0 is source only.
