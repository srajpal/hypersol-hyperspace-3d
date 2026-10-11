# TODO.md — Roadmap and current plan

Product: HyperSol HyperSpace 3D (renamed from HyperSol WebSurfer 3D on
2026-09-26; see "Rename" at the end).

Status key: **Done**; **Current** (plan approved, build not yet
approved); **Later** (listed, not approved to build); **Removed**
(taken off the roadmap).
Run and test steps are "not checked yet" until they have actually run.
Plan approved 2026-09-24.

## Roadmap

| # | Milestone | Useful result | Status |
|---|---|---|---|
| 1 | Live page in the 3D room | One real site on a tilted live panel in the 3D room; click, type, scroll work; build and test tooling runs | Done (accepted 2026-09-25 with C2 as a known issue) |
| 2 | Browsing basics | Tabs as cards in the left arc, top HUD (back, forward, reload, address and search), progress strip, shortcuts, new-tab start panel (empty state), error cards, right-click menu | Done (accepted 2026-09-25) |
| 3 | Memory and Settings | Bookmarks and history in SQLite, Library panel, Settings panel, start panel with your data, all intact after restart | Done (accepted 2026-09-26; E11 "so far so good", fuller look review after themes and depth) |
| 4 | Private by default | Ad and tracker blocking, DNS over HTTPS in secure mode, shield count and popover, "blocked" card with "open anyway", filter-refresh switch, docs/privacy.md | Done (accepted 2026-09-26) |
| 5 | Depth layering | Page sections and images lifted into layered depth; image rectangles reported | Done (accepted 2026-09-26) |
| 6 | Themes and look (design) | Final Nebula and Daylight, theme switch, matching room lighting, design pass over all screens, custom window frame considered | Done (accepted 2026-09-26; tab cards to shrink, see below) |
| 7 | Instrument panel | Floating panels with live readouts about the page and the browser: dials, meters, a console, and a network list, like a light DevTools; each part switchable in Settings | Done (accepted 2026-09-26) |
| 8 | Everyday browser features | Zoom (buttons, shortcuts, per site), find in page, downloads panel, printing, private tabs | Done (accepted 2026-09-26, with follow-ups below) |
| 9 | Passwords and site permissions | A password manager (offer to save on sign-in, fill on return, a Passwords tab in the Library, encrypted with the system's keychain) and a site permissions panel (camera, microphone, location: per-site prompts and choices to review and revoke); plus the milestone 8 feedback (download finished notice, private tab under "+", printing) | Done (accepted, prompt 50) |
| 10 | Tabs and economy | Reopen a closed tab, search tabs, mute a tab, tab card options (small, medium, large, auto-hide, or a list in the top bar); economy mode (lower rendering resolution, fewer effects, a frame cap, sleeping inactive tabs while protecting forms, audio, and downloads); history work off the main process (GitHub issue #4) | Done (accepted, prompt 50) |
| 11 | Owner feedback: address bar, view, settings, shortcuts | Two ways to show tabs; address bar completion; a wider page and view settings; menus that close; reorganized Settings with search; shortcut list and remapping; Library search reset | Done (accepted, prompt 54) |
| 12 | Developer preview 0.9.0 | Source release for developers: privacy and proofreading pass, legal and project files, automatic builds and tests on Windows and Linux (GitHub issue #5), Electron check, trademark and `.holo` checks, version 0.9.0 | Done (accepted, prompt 61; released as v0.9.0) |
| 13 | HoloML v0.1 language | Spec (HTML-like tags, glTF models), schema, parser, conformance samples | Done (accepted, prompt 64) |
| 14 | HoloML in the browser | `.holoml` page mode: models, orbit and walk, labels, links, lights, materials, animation | Done (accepted, prompt 76) |
| 15 | HoloML hardening | Resource limits for heavy or hostile scenes, with costs shown and cancelling (GitHub issue #23); keyboard and screen-reader navigation of scenes, with a text outline and a flat, still view (#25); a source and scene inspector for authors (#28) | Done (accepted, prompt 79) |
| 16 | Car showroom demo | Demo site with walk-around 3D cars | Done (accepted, prompt 83) |
| 17 | Blockworld and the examples section | A small block game in HoloML (movement, breaking and placing, day and night, sound); HoloML 0.2 draft: scripts, sound, screen text, walls and gravity, animated lights; a HoloML examples section in the browser, with screenshots | Done (accepted, prompt 91) |
| 18 | Sofa studio | A furniture shop: choose fabrics in place, shadows, a price that changes; first, walking and turning speeds and sliders (prompt 92) | Done (accepted, prompt 112) |
| 19 | Harbour Loft | An apartment tour: walls that stop you, doors and lights to click, paragraphs of text | Done (accepted, prompt 122) |
| 20 | Sneaker store | A shoe store, in place of Coral Bay, a resort (prompts 101 and 102): a wall of sneakers to pick up, turn, and see up close, in their colourways and sizes, with a cart and a checkout page (no real payment); loading by area for many models | Done (accepted, prompt 122) |
| 21 | Aquarium | 5 to 10 real-looking fish that swim around, and feeding them | Done (accepted, prompt 125; HoloML v0.2.0 released, prompt 126) |
| 22 | HoloML documentation | Documentation for HoloML to recognised standards (prompt 115); which ones is for its plan, for example a W3C-style specification with RFC 2119 requirement words, a formal grammar (such as RELAX NG or XML Schema), and guides organised as tutorials, how-to guides, reference, and explanation (Diátaxis), published with GitHub Pages | Done (accepted 2026-10-07, prompt 160) |
| 23 | HoloML for VS Code | An extension that helps people write `.holoml` files in VS Code and editors built on it: colours for the syntax, mistakes underlined as you type, suggestions, help on hover, the outline and folding, and end tags kept in step with start tags; installed by hand from a file, not published; no live preview (prompt 146) | Done (accepted, prompt 153) |
| 24 | HyperSpace 3D for Android | The browser on an Android tablet, to see how far it reaches (prompt 152): an app in this repository (apps/android) on Android's own engine, the 3D room and its pages, HoloML pages, and touch in place of the mouse and keyboard; first, a quick look at the HoloML viewer and the example sites in the tablet's browser (prompt 153) | Done (accepted 2026-10-07, prompt 161) |
| 25 | HoloML 0.3 | The features milestone 22's check found missing (prompt 127): names for models and groups, the language and direction of text, compressed models in HyperSpace 3D, level of detail, more of the scene API, and a page's description shown. (review, 2026-09-30) Also for its plan: limits on what files become (decoded pictures, decoded sound, lights) and on the time a page may take without scripts, in the specification's own text; the look written down (lights, tone mapping, the default surroundings, the field of view) and a panorama's projection; and the rest of the language engineer's list below | Done (accepted 2026-10-08, prompt 174) |
| 26 | Privacy and data tools | HTTPS-only browsing with explicit exceptions (#24); per-site storage management (#26); bookmark import and export (#27). | Done (accepted 2026-10-08, prompt 184; the review's item for the history search index was done by its D6) |
| 27 | Free camera and room navigation | Move freely around the room | Done (accepted 2026-10-09, prompt 196; moved before the installers, prompt 129; numbered 27 since 2026-10-05) |
| 28 | Lift to 3D | Images and 3D models on 2D pages become objects | Done (accepted 2026-10-10, prompt 201; numbered 28 since 2026-10-05) |
| 29 | Polish | Custom font, sound design, theme editor, motion tuning. (review, 2026-09-30) A notice of the browser's own for full screen and pointer lock, saying so and how to leave (both are refused until then); the shell checked with a screen reader, and with an input method | Removed (prompt 203): its two needed items are GitHub issues #75 and #76; the rest is polish for later or a fork |
| — | Further out | More HoloML scripting, extensions, sync, theme marketplace, Tor or VPN, VR, iOS, and Android phones (Android tablets are milestone 24) | Later |

Milestones 1 to 11 built the browser. On 2026-09-26 (prompts 54 to 58)
the owner chose to release it as source for developers first (milestone
12, a 0.9.0 developer preview), follow the HoloML path (13 to 15), and
ship installers as 1.0 afterwards (then 16 for Windows and Linux, 17 for
macOS; mobile later). Entries below that say "milestone 11" or "12" for
the installer release now mean 16. The
instrument panel was added as milestone 7 on 2026-09-26 (prompt 35); on
the same day the everyday browser features moved ahead of the first
release as milestone 8, with a Passwords milestone 9 (prompt 37); then
(prompts 42 and 43) site permissions joined Passwords as milestone 9,
the tab requests and economy mode became milestone 10, and the first
release is now milestone 11. Earlier entries below that say "milestone
7", "8", or "10" for the release now mean 11.

On 2026-09-27 (prompt 67) two milestones were added: HoloML hardening
as 15 (issues #23, #25, #28) and privacy and data tools as 17 (#24,
#26, #27). The car showroom moved from 15 to 16, the Windows and Linux
release from 16 to 18, macOS from 17 to 19, and the later milestones
from 18, 19, and 20 to 20, 21, and 22. Dated entries below keep the
numbers they were written with.

On 2026-09-27 (prompts 84 and 85) five HoloML example sites were added
before privacy and data tools, one milestone each: 17 Blockworld (with
the browser's HoloML examples section), 18 Sofa studio, 19 Harbour Loft,
20 Coral Bay, 21 Aquarium. Privacy and data tools moved from 17 to 22,
the Windows and Linux release from 18 to 23, macOS from 19 to 24, and
the later milestones from 20, 21, and 22 to 25, 26, and 27.

On 2026-09-28 (prompts 101 and 102) milestone 20 became a sneaker
store in place of Coral Bay, a resort: a store where people buy
products that are good in 3D shows the browser's general use better.
Of the HoloML features Coral Bay was to bring, loading by area moves to
the store (many shoes, each loaded when the viewer comes near);
movement along paths, sounds by place, and a sky wait until a site
needs them (the aquarium's fish may take paths).

On 2026-09-28 (prompt 115) documentation for HoloML to recognised
standards became milestone 22, after the example sites and HoloML 0.2's
tag: privacy and data tools moved from 22 to 23, the Windows and Linux
release from 23 to 24, macOS from 24 to 25, and the later milestones
from 25, 26, and 27 to 26, 27, and 28.

On 2026-09-30 (prompts 134 and 135) a review of both repositories
added items to milestones 23, 24, 27, 28, and 29, marked "(review,
2026-09-30)" in the table; nothing is renumbered. "The review of
2026-09-30", further down, has the whole account.

On 2026-10-02 (prompt 146, and the owner's answers after it) HoloML
for VS Code became milestone 23, after the documentation: HoloML 0.3
moved from 23 to 24, privacy and data tools from 24 to 25, free
camera from 25 to 26, lift to 3D from 26 to 27, polish from 27 to
28, and the installers from 28 and 29 to 29 and 30. Dated entries
below keep the numbers they were written with.

On 2026-10-05 (prompts 152 to 154) the browser for Android became
milestone 24, after HoloML for VS Code: HoloML 0.3 moved from 24 to
25, privacy and data tools from 25 to 26, free camera from 26 to 27,
lift to 3D from 27 to 28, polish from 28 to 29, and the installers
from 29 and 30 to 30 and 31.

On 2026-10-08 (prompt 172) the owner dropped milestones 30 and 31,
the installers for Windows and Linux and for macOS: the project stays
an open-source repository with no builds of its own to download, and
anyone may fork it and make an installable build of their own
(CONTRIBUTING.md, "Making your own build", says what one needs).
Their other items go with them: licence texts and credits inside the
app, how security updates reach users, and a check that test mode is
absent from a packaged app (it is off whenever `app.isPackaged`).
Polish (29) is the last milestone planned.

On 2026-10-10 (prompts 202 and 203) the owner ended the milestones
after 28: what was left was refinement rather than what the browser or
HoloML needs to work. Milestone 29 is removed. Work continues from the
GitHub issues of both repositories, bugs and enhancements; the review
of what was left opened issues #75 (full screen and pointer lock, with a notice of the
browser's own), #76 (the interface checked with a screen reader and an
input method), #77 (soft text on the tilted page), #78 (a dropped
.holoml file), #79 (checks that sleep and then look), #80 (the budgets
with a graphics card in the automatic builds), #81 (macOS), and #82 (C9
and L9 on the owner's computer). The rules
tied to milestones (approval, pushing, the security check, the
screenshots) were reworded for issues in AGENTS.md, and prompts are
recorded only when the owner asks. The "Further out" row stays as a
list of ideas, as does milestone 29's polish (a custom font, sound
design, a theme editor, motion tuning).

- Milestone 25 (HoloML 0.3; 23 when this was written), the language
  engineer's list for its plan:
  the look written down, so that a second renderer can match a picture
  (how bright a light of a given intensity is, tone mapping, the
  default surroundings, the field of view); a panorama's projection and
  which way its middle faces; limits on what files become and on time,
  as the specification's own requirements (today they are HyperSpace
  3D's, in the specification's notes); a floor plan that scripts can
  find; `holoml.add` for animations, click actions, and a panel or a
  link at the top level; taking a sound's place away again; what a
  reader reports for a further copy of an element a page may have only
  once; whether text on both sides of a comment is one text; and the
  generated RELAX NG grammar checked by a validator in the tests.
- Milestone 26 (privacy and data tools; 24 when this was written):
  nothing new. (A gap found while
  writing docs/privacy.md, three-letter pieces of a deleted visit left
  in the history search index, was closed the same day: schema 5 sets
  the index's own secure-delete; scrub.test.ts checks it.)
- Proposed, not placed in a milestone (for the owner to place; since
  prompt 203 GitHub issue #80): a run of the frame-rate and load-time
  budgets on a machine with a graphics card in the automatic builds.
  Today GitHub's machines draw in
  software, so the budgets are only logged there, and no build anywhere
  but the owner's computer can notice the browser getting slower.

### Where design work belongs

- Screen layout and navigation are built inside the feature milestone
  that needs them. The overall layout is already approved
  (ARCHITECTURE.md section 9), and each screen can only be judged with
  its real data: tab rail and shortcuts in 2, Library and Settings
  panels (with Escape to close) in 3, the shield in 4.
- Shared style starts as a small foundation task in milestone 1: one set
  of theme values feeds both the HUD's CSS variables and the Three.js
  materials, so no screen hard-codes a colour. Final colours and a design
  pass get their own milestone (6), because exact colours are still an
  open question and reviewing every real screen together keeps them
  consistent.
- Later polish was to go in the last milestone (29, Polish), so it
  could not delay a working browser; milestone 29 was removed (prompt
  203), and polish is for later issues or a fork.

## Milestone 1 — Live page in the 3D room

Status: Done. Plan approved 2026-09-24; build approved 2026-09-24
(prompt 16); built 2026-09-25; accepted by the owner 2026-09-25 (prompt
19, "continue with next milestone") with one known issue: check C2 is
intermittent (see Check results). Its investigation continues in
milestone 2.

Goal: prove that a live web page tilted in 3D takes clicks, typing, and
scrolling correctly (ARCHITECTURE.md open question 2), and set up the
build and test tooling.

### Decisions (2026-09-24)

- The focused page is an Electron `<webview>` element inside the shell,
  placed by Three.js CSS3DRenderer. (`WebContentsView` is a flat native
  layer and cannot be transformed in 3D.) Every webview is locked down
  when it attaches.
- Fallback: if the tilted page fails the input checks, or its text is not
  readable at the default tilt, the focused page faces the viewer flat
  and fully sharp, with the 3D room around it. Only tab cards and
  transitions tilt. Texture mode stays the later upgrade path.
- Parallax pauses while the pointer is over the page and eases back over
  about 250 ms; it resumes over the room and is capped to a small range.
- Window: standard OS title bar. A custom frame is considered in
  milestone 6.
- Colours: provisional Nebula values only; final values in milestone 6.
- Waiting and error states in this milestone are plain text; styled
  cards arrive in milestone 2.

### Software installed (approved 2026-09-24, prompt 16)

Installed with pnpm 12.4.1 on 2026-09-24: electron 44.4.5, electron-vite
5.0.0, vite 7.3.6 (electron-vite 5 supports Vite 5 to 7, so not 8),
typescript 6.0.3 (typescript-eslint 8.70 supports TypeScript below 6.1,
so not 7), @types/node 26.6.2, three 0.186, @types/three 0.186, vitest
5.0.1, playwright 1.63.0 (library only; no browsers downloaded), eslint
10.11.0, typescript-eslint 8.70.1. Downloads performed: packages from the
npm registry, and the Electron 44.4.5 binary from Electron's GitHub
releases (Electron 44 has no install script; it fetches the binary on
first use and checks it against checksums shipped in the package).

### Tasks

- [x] 1. Workspace: pnpm workspace, `tsconfig.base.json`, `apps/browser`
      (electron-vite), skeleton `packages/scene-core` and
      `packages/themes`. Scripts: `dev`, `test`, `test:e2e`, `lint`,
      `typecheck`.
- [x] 2. Main process: single instance, one window with standard frame.
      Sandbox on, context isolation on, no Node in pages. On webview
      attach, replace any page-requested preload with the trusted page
      preload (an empty stub until milestone 5) and force safe web
      preferences. Narrow shell bridge.
- [x] 3. Room: Three.js scene with provisional Nebula background and
      lighting, fixed desk camera, CSS3D and WebGL layers stacked.
      Render on demand only (no redraws while idle).
- [x] 4. Page panel: `PagePanel` interface in scene-core; live webview
      panel with adjustable tilt (0° to 20°, default about 10°) and a
      glow edge.
- [x] 5. Parallax as decided above.
- [x] 6. Temporary plain address field (removed when the HUD lands in
      milestone 2) and a `--start-url` launch option for tests.
- [x] 7. Design task, style foundation: theme token schema in
      `@hypersol/themes` with provisional Nebula values; one value
      produces both a CSS variable and a Three.js colour.
- [x] 8. Spike: run the input checks at 0°, default, and 20°. Record the
      results; apply the flat-page fallback if they fail. Close open
      question 2 in ARCHITECTURE.md.
- [x] 9. better-sqlite3 check: from release listings, without installing,
      confirm prebuilt binaries for Electron 44 on Windows, macOS, and
      Linux (x64 and arm64). Record under open question 3.
      Result: checked node:sqlite first, as ARCHITECTURE.md asks. It
      works in Electron 44.4.5 (Node 24.21.0, SQLite 3.53.4): a table
      was created, written, and read back. The better-sqlite3 release
      listing was not checked, since it would not be needed. Switching
      milestone 3 to node:sqlite needs the owner's approval.
- [x] 10. Test harness: Vitest, Playwright Electron launcher, a local
      fixture server on 127.0.0.1 with a random port, and the sample
      pages below.
- [x] 11. Docs: README build and run, AGENTS.md Testing (only commands
      that ran), ARCHITECTURE.md, HANDOFF.md.

### Sample inputs (written by the agent, in `tests/fixtures/`)

- `click-grid.html`: 3×3 buttons (corners, edges, centre) that report
  which was hit.
- `form.html`: text input, textarea, select, checkbox.
- `long.html`: a tall page for scrolling.
- `link-a.html` and `link-b.html`: pages that link to each other.
- `hover.html`: a target that reports pointer enter and leave.
- `node-probe.html`: reports whether `require` or `process` exist.

### Checks

| # | Check | How | Expected result |
|---|---|---|---|
| C1 | App launches | Automated (Playwright) | Window opens, room renders, no console errors |
| C2 | Clicks land | Automated: all 9 grid buttons at 0°, default, 20°, at 2 window sizes | Every click hits the intended button |
| C3 | Parallax does not shift targets | Automated: move the pointer over the room, then click the grid | Parallax pauses over the page; all clicks land |
| C4 | Typing | Automated: click the field on the tilted page (real window routing), then type; keys are delivered to the page's view because Playwright's window-level keys do not reach a webview. Manual: real keyboard on a tilted page (owner, 2026-09-25) | Values match exactly |
| C5 | Scrolling | Automated: wheel over the page, then over the room | Page scrolls only when the pointer is over it |
| C6 | Hover and links | Automated | Hover reported; link loads the second page |
| C7 | Page isolation | Automated: `node-probe.html` | No Node access; any page-requested preload is replaced by the trusted stub |
| C8 | No unexpected traffic | Automated: log all requests during the run | Only 127.0.0.1 |
| C9 | Idle efficiency | Automated: count frames | No redraws while idle; about 60 fps during parallax on graphics hardware (where Chromium draws in software, the rate is reported and that part is skipped, not passed; owner, prompt 59) |
| C10 | Load failure | Automated: stop the server, then load a page | Plain "couldn't load" text; app does not crash |
| C11 | Page crash | Automated: force the page's process to crash | App survives; message with Reload |
| C12 | Layout and style code | Vitest (unit) | Panel position and tilt correct; parallax cap and pause hold; one theme value yields matching CSS and 3D colour |
| C13 | Real sites | Manual, by the owner: Wikipedia, DuckDuckGo, YouTube | Text readable at the default tilt; video plays; parallax feels calm |
| C14 | Touch | Manual: tap and scroll | Works, or marked "not checked" without a touch screen |
| C15 | macOS and Linux | — | "Not checked" until milestone 7 |

### Check results (Windows 11, 2026-09-24)

Machine: a Windows 11 laptop with a discrete graphics card and
integrated graphics, one 1920×1080 display at 100% scaling, a touchpad,
and no touch screen. Clicks in the automated checks are sent with Playwright's mouse
(Chrome DevTools Protocol, entering at the window), not OS input.

Latest results, 2026-09-25: 35 unit tests pass; lint and type check
clean. End-to-end: of the last 7 full runs, 5 passed 23 of 23 and 2 had
C2 failures; 1 of 3 further runs of C2 alone also failed (see C2).

| # | Result |
|---|---|
| C1 | Pass |
| C2 | Cause found and fixed in the tests in milestone 2 (see milestone 2, task 13); passes in every run since. Original note: intermittent. When it passes, all 54 clicks land within 3 px of the target at 0°, 10°, and 20°, at 1280×800 and 1024×700. In some full runs, one click in the first seconds after a fresh launch on a tilted page never reaches the page (no pointer or mouse event at all) while the shell keeps focus on the webview. Not reproduced in 276 targeted clicks outside that window (back-to-back, after resizes, at delays of 0 to 1000 ms), and not seen by the owner in real use. Cause not found. Changes that did not remove it: waiting for the page to paint after load and after resize, and waiting for the window to have focus (both kept as fair preconditions). The grid page now records every pointer, mouse, and focus event, and C2 prints them when a click is missed. |
| C3 | Pass |
| C4 | Pass, with the method changed (see the Checks table). Playwright's keyboard, and Electron's input events sent to the window, never reached the page, tilted or flat. A real keyboard does: the owner typed into Wikipedia's search box on the tilted page (2026-09-25). The automated check keeps the real click routing and delivers the keys to the page's view. Gap: automated window-to-page keyboard routing is not covered; plan an OS-level input check with the per-OS checks in milestone 7. |
| C5 | Pass |
| C6 | Pass |
| C7 | Pass |
| C8 | Pass |
| C9 | Pass: no frames while idle; 60 to 69 frames per second during parallax across runs |
| C10 | Pass |
| C11 | Pass |
| C12 | Pass: 35 unit tests in 5 files |
| C13 | Owner, 2026-09-25: Wikipedia and other sites opened and typing worked; text looks a little blurry when tilted. Readability accepted; sharpness at the default 10° tilt to revisit in milestone 6. |
| C14 | Not checked: this machine has no touch screen |
| C15 | Not checked (milestone 7) |

Also found and handled: Chromium ignores input to a page until it has
painted, and "loaded" can come a moment earlier, so the tests wait for
the first paint before interacting.

### Spike result (task 8)

Answered 2026-09-25: the tilted live page works. Clicks, hover,
scrolling, links, and real keyboard typing all reach the page at the
default tilt, so the flat-page fallback is not needed. Text is slightly
soft when tilted (owner); the page is pixel-sharp only at 0°.

Regression list started by this milestone: C1 to C11.

### Done when

C1 to C12 pass (with the fallback in place if needed), the owner
accepts C13, the docs are updated, and the owner approves the finished
milestone.

## Milestone 2 — Browsing basics

Status: Done. Plan and build approved 2026-09-25 (prompt 19); built
2026-09-25; look and feel (D12) and the milestone approved by the owner
2026-09-25 (prompt 20), with one change: the "+" card is pinned (below).
Screenshots: docs/screenshots/m2/.

Goal: a browser you can use day to day in the 3D room: several tabs,
a real top bar, keyboard shortcuts, a new-tab start panel, clear error
cards, and a right-click menu.

### Decisions (2026-09-25)

Already settled in ARCHITECTURE.md section 9: tab cards in a shallow
arc on the left, each a snapshot with title and favicon, click to
focus, the focused page slides into the centre, close on hover, "+"
card at the end; top HUD with back, forward, reload, address and search
bar (DuckDuckGo), menu button; thin loading strip under the bar;
Ctrl/Cmd+T, Ctrl/Cmd+W, Ctrl/Cmd+L, Ctrl+Tab; start panel with search
box, bookmarks grid, recent history ("Nothing saved yet" when empty);
error cards with a plain message, the address, and Retry; shimmer until
first paint; spinner on a card until its snapshot.

New, from the owner's answers (prompt 19):
- Links that ask for a new window open as a new tab in front;
  Ctrl-click or middle-click opens it behind. A page opening a window
  without a recent click or key press is blocked.
- When there are more tabs than fit, the arc scrolls with the mouse
  wheel over it; cards stay full size. The focused card is kept in view.
- A right-click menu: back, forward, reload; on a link, open link in new
  tab and copy link address; on selected text, copy; in a text field,
  cut, copy, paste, select all.
- A certificate-error card ("This site's certificate isn't valid") with
  no way to proceed; Go back only.
- Assumptions accepted: the focused card always shows its close button
  (works for touch); the menu holds New tab, Close tab, and About
  (Library and Settings join in milestone 3); tab cards open and close
  with 250 ms animations.

### Software to install (approved with the plan, prompt 19)

lit (web components for the HUD; named in ARCHITECTURE.md section 4).
Tests also use the openssl already on the machine (bundled with Git) to
make a throwaway certificate at run time for the certificate-error check.

### Tasks

- [x] 1. Tab arc layout maths in scene-core: card positions on a shallow
      arc, visible range, scroll clamping, keep-focused-in-view.
- [x] 2. Tab store in the shell (pure, unit tested): add in front or
      behind, close with a sensible next focus, next and previous,
      closing the last tab leaves a fresh start tab.
- [x] 3. Several live pages: one webview per tab, created once and never
      moved in the page so it never reloads; background pages hidden;
      the focused page slides between its card and the centre (250 ms).
- [x] 4. Tab cards in the WebGL room: snapshot texture, title and
      favicon, spinner until the snapshot, hover and focused states,
      close button (always on the focused card), "+" card, wheel
      scrolling, and an off-screen DOM tab list mirroring the cards for
      keyboard and screen-reader access.
- [x] 5. HUD as Lit components: back, forward, reload, address and search
      bar, menu (New tab, Close tab, About), loading strip. Replaces the
      temporary address field.
- [x] 6. Address or search: web addresses load; anything else searches
      DuckDuckGo. Tests point search at a local stand-in.
- [x] 7. Keyboard shortcuts handled in the main process for both the
      shell and web pages: Ctrl/Cmd+T, Ctrl/Cmd+W, Ctrl/Cmd+L, Ctrl+Tab,
      Ctrl+Shift+Tab, Ctrl/Cmd+R and F5, Alt+Left and Alt+Right (Cmd+[
      and Cmd+] on macOS).
- [x] 8. New-window handling as decided above, including pop-up blocking.
- [x] 9. Start panel for new tabs: search box, bookmarks and history
      sections with the "Nothing saved yet" empty state.
- [x] 10. Waiting and error states: shimmer until first paint; error cards
      for address not found, connection failed, certificate error, page
      crashed ("This page went dark"), and any other failure.
- [x] 11. Right-click menu as decided above.
- [x] 12. About panel: name, version, Electron and Chromium versions,
      licence.
- [x] 13. C2 investigation continued (missed click shortly after launch).
- [x] 14. Tests: unit tests for the new pure logic; end-to-end checks
      below; milestone 1 checks updated only where milestone 2 changes
      the requirement (the temporary address field and plain-text error
      text are replaced).
- [x] 15. Docs: ARCHITECTURE.md, README, AGENTS.md Testing, HANDOFF.

### Sample inputs (written by the agent)

Existing fixtures plus: `new-window.html` (a target=_blank link and a
script that tries window.open without a click), `slow` (a server route
that answers after a delay, for the loading strip), `search` (a local
search stand-in that shows the query), and a local HTTPS server with a
self-signed certificate made at run time. All tests block every host
except 127.0.0.1 with Chromium's host resolver rules, so nothing leaves
the machine; `notfound.test` exercises "address not found".

### Checks

| # | Check | How | Expected result |
|---|---|---|---|
| D1 | Top bar | Automated | Address shows the page; Enter on an address loads it; Enter on words searches; back, forward, reload work and are disabled when they cannot act |
| D2 | Tabs | Automated | "+" card and Ctrl+T open a start tab; clicking a card focuses it; Ctrl+Tab and Ctrl+Shift+Tab cycle; switching keeps each page's state without reloading; hover close and Ctrl+W close; closing the last tab leaves a start tab |
| D3 | Snapshots | Automated | Background cards show a snapshot; spinner only until then |
| D4 | Many tabs | Automated: 12 tabs | Arc scrolls with the wheel; cards keep full size; focused card in view; the "+" card stays in view at any scroll (owner, prompt 20) |
| D5 | New-window links | Automated | target=_blank opens a tab in front; Ctrl-click opens one behind; window.open without a click is blocked |
| D6 | Loading | Automated: slow page | Loading strip shows while loading and hides after |
| D7 | Error cards | Automated | Not found, connection failed, certificate error (no proceed), crash ("This page went dark"), each with the address; Retry recovers where it applies |
| D8 | Right-click menu | Automated | Link menu opens the link in a background tab and copies its address; text field menu offers paste; selected text copies |
| D9 | Start panel | Automated | Empty state reads "Nothing saved yet" with a hint; its search box searches |
| D10 | Shortcuts | Automated, from the shell and from inside a page | Each shortcut does its job |
| D11 | About | Automated | Shows versions; Escape closes; says it is an experimental developer preview (added in prompt 131) |
| D12 | Look and feel | Manual, owner | Tab arc, cards, top bar, animations feel right |
| C1–C11 | Milestone 1 regression | Automated | Still pass |

### Check results (Windows 11, 2026-09-25)

Unit: 73 tests in 11 files pass. Lint and type check clean.
End-to-end (`pnpm test:e2e`, 57 checks: C1 to C11 and D1 to D11): the
last three runs passed 57 of 57 (about 90 seconds each). Of the eight
full runs after the last input fix, seven passed; the other failed on a
race in the test helper after a resize (it read the room's layout
before the room had updated), which was then fixed.

| # | Result |
|---|---|
| D1 | Pass |
| D2 | Pass |
| D3 | Pass: snapshots on both cards, favicon shown, no frames drawn once idle |
| D4 | Pass: 12 tabs; rail scrolls with the wheel; card spacing unchanged within 1.5 px |
| D5 | Pass: unrequested pop-up blocked; target=_blank in front; Ctrl-click behind, next to its opener; window.open on click in front |
| D6 | Pass |
| D7 | Pass: not found, connection failed with Retry recovering, certificate error with no Retry and no way to proceed (crash card covered by C11) |
| D8 | Pass |
| D9 | Pass |
| D10 | Pass |
| D11 | Pass |
| D12 | Pass: owner, 2026-09-25 ("look and feel are good, approved") |
| C1–C11 | Pass. C9 measured 139 to 145 frames per second during parallax on these runs: the display was at 144 Hz; the rate follows the display. |

Found and fixed during the build:
- Webviews need the `allowpopups` attribute, or Electron drops every
  new-window request before the main process can decide.
- The first address shown in a new tab could be the previous tab's.
- Cards were clipped at the window's left edge; the rail moved right.
- Task 13 (C2): input sent in the same instant a page appears, moves, or
  resizes can be routed to the shell instead of the page. Waiting two
  shell frames after the page paints, and letting the pointer arrive
  before pressing (as a real mouse does), removed every such failure.
  Mouse use is not affected. A touch tap at that instant might be:
  recheck with C14 on a touch screen.

Test-method notes (the requirements are unchanged):
- Shortcut keys pressed in the shell are sent through Electron's input
  path, where the main process sees them; Playwright's keyboard reaches
  the shell's page but skips that path.
- The right-click menu is read from a test log and an entry chosen by
  label, instead of a native popup that waits for a real mouse. The
  entries and their actions are the same code as in normal use.
- Playwright's own screenshots can show a page wider than it is (seen
  2026-09-25); Electron's capture of the same moment is correct. Use
  Electron captures when judging looks.

Changed after review (owner, prompt 20): the "+" card is pinned. It
follows the last tab while the tabs fit, and stays at the bottom of the
rail once they overflow; the tabs scroll above it.

### Done when

D1 to D11 and C1 to C11 pass (C2's known issue aside, unless fixed), the
owner accepts D12, the docs are updated, and the owner approves the
milestone.

## Milestone 3 — Memory and Settings

Status: Done. Plan and build approved 2026-09-25 (prompts 21 and 22);
built 2026-09-25; accepted 2026-09-26 (prompt 29). E11: "so far so
good"; the owner will review the look more fully once themes (6) and
depth layering (5) are in, and asked to lean further into the 1980s and
1990s aesthetic. Screenshots: docs/screenshots/m3/.

Goal: the browser remembers bookmarks, history, and settings across
restarts, with a Library panel, a Settings panel, and a start panel that
shows your data. No new packages: SQLite through Node's built-in
node:sqlite.

### Decisions (2026-09-25, prompt 21)

- Bookmarks: a star at the right end of the address bar, and Ctrl+D.
  Filled when the page is saved; clicking again removes it. One flat
  list, no folders.
- History: kept until the user clears it. The Library groups it by day,
  with search, delete per entry, and "Clear all history" behind a
  confirmation.
- Settings: search engine (DuckDuckGo default, Brave Search, Startpage,
  Google, Bing); on startup (a new tab, or your tabs from last time);
  clear browsing data (any of history, cookies and site data, cache).
- Library (Ctrl+Shift+O) and Settings (Ctrl+,) slide in from the right,
  one at a time; Escape closes them; both are also in the menu.
- Stored in the app data folder: hypersol.sqlite (bookmarks, history),
  settings.json, session.json (open tabs, only used when startup is set
  to reopen them).
- If saved data cannot be read: a damaged settings.json is set aside as a
  backup and defaults are used; if the database cannot be opened, the
  Library says "Couldn't open your saved data", nothing is recorded, and
  browsing keeps working.

### Tasks

- [x] 1. Storage in the main process: database with a schema version,
      settings.json, session.json, all written through a temporary file
      then swapped in.
- [x] 2. Typed requests from the shell for bookmarks, history, settings,
      session, and clearing data; accepted only from the shell; every
      input checked.
- [x] 3. History recording for every page load, from the main process;
      titles filled in when the page reports them.
- [x] 4. Bookmark star and Ctrl+D.
- [x] 5. Library panel (Lit): bookmarks and history views, search, day
      groups, deletes, empty, waiting, and error states.
- [x] 6. Settings panel (Lit): search engine, startup, clear browsing data.
- [x] 7. Start panel with your data: bookmarks grid and recent history.
- [x] 8. Reopen last tabs on startup when chosen.
- [x] 9. Menu entries, shortcuts, keyboard access to the panels (focus
      moves in on open and back on close).
- [x] 10. docs/privacy.md: what is stored, where, and how to delete it.
- [x] 11. Tests: unit (storage, settings checks, day grouping, search
      engines, session); end-to-end E1 to E10; C1 to C11 and D1 to D11 as
      regression.
- [x] 12. Docs and screenshots (MILESTONE=m3 pnpm screenshots).

### Checks

| # | Check | Expected result |
|---|---|---|
| E1 | Bookmark star and Ctrl+D | Adds and removes a bookmark; the star shows the state |
| E2 | History | Visited pages appear grouped by day; search finds them; single delete and "Clear all" (with confirmation) work |
| E3 | Library bookmarks | Listed; clicking opens one; removing works |
| E4 | Start panel | Shows your bookmarks and recent history |
| E5 | Search engine setting | Searches go to the chosen engine (checked by address; nothing loads from the internet) |
| E6 | Reopen last tabs | With that setting, the same tabs return after a restart |
| E7 | Restart | Bookmarks, history, and settings intact after close and reopen with the same profile |
| E8 | Clear browsing data | Cleared history is gone; a cookie set by a test page is gone |
| E9 | Failures | Damaged settings.json gives defaults and a backup; a blocked database shows the message and browsing still works |
| E10 | Keyboard | Shortcuts open the panels, focus moves in, Tab reaches the controls, Escape closes and returns focus |
| E11 | Look and feel | Owner review; screenshots saved |
| C1–C11, D1–D11 | Regression | Still pass |

### Check results (Windows 11, 2026-09-25)

Unit: 98 tests in 13 files pass (storage, settings checks, request
checks, day grouping, session). Lint and type check clean.
End-to-end (`pnpm test:e2e`, 71 checks: C1 to C11, D1 to D11 plus a new
single-load check, E1 to E10): the last two full runs after the final
test fix passed 71 of 71. One earlier run had a single failure not seen
again (D1: pressing Enter in the address bar timed out waiting for the
field; D1 then passed five times in a row alone).

| # | Result |
|---|---|
| E1 | Pass |
| E2 | Pass |
| E3 | Pass |
| E4 | Pass |
| E5 | Pass: Brave Search address used; DuckDuckGo stand-in used after switching back |
| E6 | Pass |
| E7 | Pass |
| E8 | Pass: history and a test cookie cleared |
| E9 | Pass: damaged settings.json set aside with defaults; a blocked database shows "Couldn't open your saved data" and browsing works |
| E10 | Pass |
| E11 | Pass for now (owner, 2026-09-26): "so far so good"; fuller review after milestones 5 and 6 |
| C1–C11, D1–D11 | Pass |

Found and fixed during the build:
- Every new tab loaded its page twice (since milestone 2): pages were
  put into the wrong element of the CSS 3D renderer, which then moved
  them on its first frame, and a moved webview is destroyed and reloads.
  New regression check in D2: a page is fetched once.
- With the Library open, the menu opened underneath the panel; the top
  bar now sits above the panels.
- Start panel rows picked up the error-card button border.
- The app had no product name, so a real install would have kept its
  data in a folder named after the package; it is now "HyperSol
  WebSurfer 3D".
- Test harness: test windows now ignore the real mouse. A cursor resting
  over the test window sent its own pointer events, which moved the
  parallax (occasional C3 and D4 failures). The harness also asks for
  window focus if Windows has not given it within 3 seconds, and
  tolerates a temporary folder Electron is still releasing.
- E10 originally expected Tab to stay inside the Library; the panel does
  not trap focus (like Chrome's side panel), so the check now confirms
  the panel's controls are reachable with Shift+Tab.

Changed after the build (owner, prompt 24): test windows no longer come
to the front. They open off screen, never take focus, and have no
taskbar button; Chromium is told to keep drawing them. HYPERSOL_TEST_SHOW=1
shows them for watching. Resizing now corrects the window's outer size
step by step, since Electron's content-size call is unreliable off
screen. New check in C1: background windows are off every display and
unfocused. Two full runs after the change: 72 of 72; unit tests 99.

### Done when

E1 to E10, C1 to C11, and D1 to D11 pass, the owner accepts E11, the
docs and screenshots are updated, and the owner approves the milestone.

## GitHub issues (2026-09-25, prompt 25)

Fixed on branch fix/github-issues-1-6 (pull request for the owner to
review): #1 favicon limits, #2 settings failures, #3 saving tabs before
closing, #6 documentation. Partly fixed: #4 (search debouncing and
merged refreshes) and #5 (toolchain pinned and documented).

Follow-ups, proposed and not approved to build:
- #4: move database work to a worker off the main process; indexed
  search and history aggregation; latency benchmarks with budgets.
  Now part of milestone 10 (tabs and economy), before real users
  build up large histories.
- #5: continuous integration for build, lint, types, and tests needs the
  owner's approval of a service (AGENTS.md rule 3, for example GitHub
  Actions). Windows, macOS, and Linux coverage belongs with milestone 11's
  per-OS checks.

New checks added with the fixes: D13 (favicon limits); E6 (tabs saved
when closing right after a change; failed saves shown); E9 (unreadable
settings); E2 (search runs once typing pauses).

Also found and fixed: the rare stalled Enter press in the address bar
(seen twice before). Enter started the navigation on key-down and moved
the keyboard into the page at once, so the key's release landed in the
page and the test tool waited for an acknowledgement that never came.
The page now takes the keyboard once Enter is released (or after half a
second). A tab also kept the previous page's favicon after navigating;
fixed with #1.

Results on the branch (Windows 11, 2026-09-25): 119 unit tests; the full
end-to-end suite, now 82 checks, passed 82 of 82 in three runs in a row.

Pull request #7 review (prompt 26), two findings, both fixed:
- Refused favicon downloads (declared too large, error status) kept
  running while the next address was tried. Every attempt now has its
  own cancel switch and refused bodies are cancelled. New unit tests and
  a streaming-server check (D13) confirm each connection closes at once,
  at most one is open, and under 256 KB is sent; both failed against the
  previous code.
- Holding the window open to save the tabs cancelled a quit, and only
  the window was closed afterwards; on macOS the app would keep running
  after Quit. The main process now remembers a requested quit and resumes
  it. New checks (E6b) with the app kept alive after its last window
  closes, as on macOS: Quit ends the app with the latest tabs saved;
  closing the window saves them and leaves the app running; both still
  finish when the shell never answers (after the 2 s wait). The Quit
  checks failed with the resume switched off. Native macOS not tested.
- Results after the fixes: 123 unit tests; 88 of 88 end-to-end checks in
  two runs.

## Milestone 4 — Private by default

Status: Done. Accepted by the owner 2026-09-26 (prompt 33), after
testing it on real sites. Plan and build approved 2026-09-26 (prompt 29),
with the owner's answers Q1 a, Q2 a, Q3 a. Electron security check done
at the start (ARCHITECTURE.md section 3). All tasks done; the owner's
look-and-feel check (F11) passed with the acceptance, and the optional
live check (L1) was the owner's test on real sites (results below).
Screenshots: docs/screenshots/m4/ (out of the tree since; see
docs/progress.md).

Goal: ads and trackers are blocked on every page and website lookups
are encrypted, with no setup; you can see what was blocked on each page
and let it through when a site breaks.

### Decisions (2026-09-26, prompt 29)

Already settled in ARCHITECTURE.md: @ghostery/adblocker-electron; lists
refreshed through Chromium's network (so encrypted DNS applies) with a
switch in Settings; encrypted DNS in Secure mode with Quad9, Settings
offers Secure or Automatic; a "blocked on this network" card with "Use
this network's DNS for now" (Automatic until the app closes); a shield
with a per-page count and a popover; a "blocked" card with "open
anyway".

New, from the owner's answers:
- Lists (Q1 a): ads and trackers. EasyList, EasyPrivacy, uBlock
  Origin's filters, privacy, and badware lists, and Peter Lowe's list,
  from Ghostery's copies on GitHub (one host). No cookie-banner or
  annoyance lists.
- First start (Q2 a): the app includes a starter copy of the lists, so
  pages are protected from the first one. `pnpm filters:update` rebuilds
  the starter copy before each release; the app then refreshes from the
  internet. Each list's license notice ships with it; a list whose terms
  do not allow shipping is download-only.
- Broken sites (Q3 a): the shield popover lists what was blocked and has
  a "Pause on this site" switch, remembered per site.
- Assumptions accepted: refresh at most once a day; a failed refresh
  keeps the current lists; "open anyway" lets that one address through
  in that tab; the count resets on a new page; Settings gains the DNS
  mode, the refresh switch, "Lists updated <date>", and "Update now".
- Technical approach: the package has no allow-once or per-site
  mechanism, so the app owns the request listener, asks the package's
  engine for each request, and counts per tab; the package's page
  script handles element hiding.

### Software to install (approved with the build, prompt 29)

@ghostery/adblocker-electron (MPL-2.0; brings @ghostery/adblocker,
@ghostery/adblocker-electron-preload, tldts-experimental).

### Tasks

- [x] 1. Trial and license check: requests blocked in our webview tabs
      on Electron 44; element hiding alongside our page preload; the
      build packages the blocker's page script; per-tab counts. Check
      every list's license. Report before building on it.
- [x] 2. Filter service in the main process: load from the saved copy,
      else the starter copy (missing or damaged); refresh daily when
      switched on; a failure keeps the current lists; saved atomically.
- [x] 3. Starter copy: `pnpm filters:update` downloads the lists and
      builds the included copy with the license notices.
- [x] 4. Request blocking: block and count per tab; a blocked page
      shows the blocked card; "open anyway" allows it once in that tab;
      nothing is blocked on a paused site.
- [x] 5. Shield: count at the bottom right; popover with the list and
      the per-site switch; keyboard access; Escape closes it.
- [x] 6. Encrypted DNS: on at startup, follows the setting; detect a
      blocked resolver, show the card, "Use this network's DNS for now".
- [x] 7. Settings: DNS mode, refresh switch, lists updated date, "Update
      now".
- [x] 8. docs/privacy.md: exact lists and addresses, the resolver,
      everything the app sends.
- [x] 9. Tests: unit; end-to-end F1 to F10; C, D, E as regression.
- [x] 10. Docs and screenshots (MILESTONE=m4 pnpm screenshots).

### Checks

| # | Check | Expected result |
|---|---|---|
| F1 | Tracker and ad requests | A test page's tracker script and ad image are blocked; the page still works |
| F2 | Shield count | Per tab; resets on a new page |
| F3 | Popover | Lists what was blocked; keyboard reachable; Escape closes |
| F4 | Element hiding | An element matched by a hiding rule is not shown |
| F5 | Blocked page | The card shows; "open anyway" loads it in that tab only |
| F6 | Pause on this site | Nothing blocked there; remembered after restart |
| F7 | Encrypted DNS setting | Secure with Quad9 at startup; Automatic applies at once |
| F8 | Encrypted DNS blocked | The card shows; "Use this network's DNS" works until the app closes |
| F9 | Lists | Work with no network (starter copy); refresh uses only the named addresses (served locally in tests); a failed refresh keeps the lists; a damaged saved copy falls back to the starter copy |
| F10 | No unexpected traffic | With refresh off, only the page's own requests |
| F11 | Look and feel | Owner review; screenshots saved |
| L1 | Live check (only with the owner's yes to use the real internet) | Lookups go to Quad9; a known tracker on a real page is blocked |
| C, D, E | Regression | Still pass |

### Check results (Windows 11, 2026-09-26)

Task 1 (trial and license check): the package works with our webview
tabs on Electron 44.4.5; the engine loads the starter copy in 16 ms and
answers a request in about 9 microseconds; parsing the full lists takes
about 0.8 s, so refreshes build in a worker thread. Every package the
blocker brings is MPL-2.0 or MIT. The lists' own licence lines were
checked by `pnpm filters:update`: EasyList and EasyPrivacy (GPL-3.0 or
CC BY-SA 3.0), uBlock Origin (GPL-3.0); Peter Lowe's list states no
licence, so it is download-only. The starter copy is 6.8 MB (2.9 MB
compressed). @ghostery/adblocker and @ghostery/adblocker-electron-preload
were added as direct dependencies (same version, already installed with
the approved package) so the worker and the page preload can import
them.

Unit: 148 tests in 15 files pass (shield decisions, filter service,
DNS messages, request checks, settings, the starter copy). Lint and type
check clean.

End-to-end (`pnpm test:e2e`, 102 checks): F1 to F10 (14 checks) passed
in four runs in a row, the last two on the finished code. Full suite on
the finished code: 99 of 102; the 3 failures are the D8 clipboard checks, because the Windows clipboard was unavailable to
every program on the machine during the runs (PowerShell's
Set-Clipboard failed too, with no program holding it). D8 is not
checked for this milestone yet; rerun it when the clipboard works.

| # | Result |
|---|---|
| F1 | Pass: ad image and tracker script never reach the server; the page's own image loads; an unlisted host goes through |
| F2 | Pass |
| F3 | Pass |
| F4 | Pass: two generic EasyList rules hide their elements on a named host |
| F5 | Pass, including "Go back" to the page the tab was on |
| F6 | Pass, including after a restart |
| F7 | Pass (checked through the settings the app applies; tests have no internet) |
| F8 | Pass, with a local stand-in resolver and a captive-portal page |
| F9 | Pass: starter copy, "Update now" from a local server (15 downloads, nothing else), kept after restart, failed refresh, damaged saved copy, scheduled refresh |
| F10 | Pass |
| F11 | Pass (owner, 2026-09-26, prompt 33) |
| L1 | Not run by the agent; the owner tested on real sites (prompt 33) |
| C, D, E | Pass; D8 passed on 2026-09-26 once the clipboard worked again |

Found and fixed during the build:
- Electron drops a page load the shield cancels without any failure
  event, so the tab showed nothing. The main process now tells the shell,
  which shows the blocked card.
- The lists' stand-in scripts (redirects to data: addresses) did not load
  in Electron; those requests are now blocked outright.
- "Go back" on the blocked card went back one page too far (the blocked
  page never replaced the current one); it now just returns to it.
- The first test run mapped every *.test name to this machine, which
  broke D7's "address not found"; only the names the checks need are
  mapped now.

Changed requirement: settings.json gains dnsMode, filterRefresh, and
pausedSites, so the two storage tests that compare the whole settings
object now include them.

Test switches added (test mode only): --filters-base (lists from a local
address, with the schedule's first check after 1 s; without it, test
runs never refresh on their own) and --dns-probe (a local stand-in for
the resolver check; without it the check is skipped).

Not checked: native macOS and Linux; real Quad9 and real list downloads
from inside the app (L1).

### Done when

F1 to F10 and the regression checks pass, the owner accepts F11 (and L1
if run), the docs and screenshots are updated, and the owner approves
the milestone.

## Milestone 5 — Depth layering

Status: Done. Accepted by the owner 2026-09-26 (prompt 33: "image
flattening works"). Screenshots: docs/screenshots/m5/. Plan and build
approved 2026-09-26 (prompt 31), with
the owner's answers Q1 b ("to start"), Q2 (on by default for now, with a
per-site and a global setting), Q3 a. Electron security check: done the
same day for milestone 4 (ARCHITECTURE.md section 3). Milestone 4 then
still awaited the owner's acceptance (F11; accepted the same day,
prompt 33).

Goal: everyday pages gain visible depth. A layers view breaks a page's
main sections and images apart into separate layers at different
depths; the page stays usable, and image positions are reported for
the later lift-to-3D milestone.

### Decisions (2026-09-26, prompt 31)

Already settled in ARCHITECTURE.md: depth comes from the trusted page
preload styling top-level sections and images (no pixel copying, so
input keeps working), and the preload reports image rectangles.

New, from the owner's answers:
- Q1 b, to start: a layers view on demand (a toolbar button and a
  shortcut) that spreads sections and images into separate layers.
  Subtle always-on depth is not built now.
- Q2: the layers view is on by default when a page opens, for now.
  Settings has a global switch for it (default on). Switching the view
  on or off on a page is remembered for that site and wins over the
  global switch; Settings can clear the per-site choices. (Agent's
  reading of the answer, stated when saving the plan.)
- Q3 a: image rectangles are reported to the shell and visible to the
  tests only; no user-facing feature yet.
- Technical approach: each lifted element gets its own CSS perspective
  transform around one shared vanishing point, so no ancestor gains a
  transform and pinned (fixed or sticky) page parts keep working;
  elements that are pinned or contain pinned parts are skipped, and the
  number of layers is capped. The page's layers cannot share the room's
  3D space, so the view happens inside the page panel; the vanishing
  point follows the room's parallax.

### Tasks

- [x] 1. Trial: the layering approach on the test pages and a variety
      of layouts: pinned headers, click accuracy, text sharpness, frame
      rate. Report before building on it.
- [x] 2. Page preload: find the top-level sections and images, lift them
      into layers, keep them current as the page changes, scrolls, and
      resizes; skip risky elements; cap the count; animate in and out
      (instant with reduced motion).
- [x] 3. Shell: the layers button in the top bar and a shortcut; the
      view per tab; sent to the page, and the vanishing point with the
      room's parallax.
- [x] 4. Settings: "Open pages in the layers view" (default on), the
      per-site choices (remembered when the view is switched on a page),
      and clearing them.
- [x] 5. Image rectangles reported from the page to the shell, checked
      there, kept per tab; exposed to the tests.
- [x] 6. Tests: unit (section choice, settings); end-to-end G1 to G9; C,
      D, E, F as regression.
- [x] 7. Docs and screenshots (MILESTONE=m5 pnpm screenshots).

### Checks

| # | Check | Expected result |
|---|---|---|
| G1 | Layers view | Sections and images of a test page are lifted into separate depths; switching it off restores the page exactly |
| G2 | Input | Clicks, typing, and scrolling land where they should in the layers view |
| G3 | Pinned parts | A fixed header stays in place in the layers view |
| G4 | Button and shortcut | Both switch the view for the tab in front only |
| G5 | Settings | The global switch sets how pages open; a per-site choice wins; both survive a restart; clearing the choices works |
| G6 | Image rectangles | Reported for the page's images, and updated after scrolling and resizing |
| G7 | Changing pages | Sections added later by the page are layered; nothing is left behind when switching off |
| G8 | Reduced motion | The view switches without animation |
| G9 | Efficiency | Idle and scrolling stay within the milestone 1 budget with the view on (on graphics hardware; where Chromium draws in software the scrolling time is logged and that part skipped, not passed, as C9; owner, prompt 76) |
| G10 | Look and feel | Owner review; screenshots saved |
| C, D, E, F | Regression | Still pass |

### Check results (Windows 11, 2026-09-26)

Task 1 (trial, on the layers test page with the finished code path): the
button inside a lifted section takes the click (the page's own hit test
finds it); the fixed header stays at the top, also after scrolling; a
section the page transforms itself is left alone; switching off removes
every layer. Scrolling with the view on: 7.5 ms per frame on average,
8.8 to 12.6 ms at most, in two runs. Not tried on real websites: test
runs have no internet, so a variety of real layouts is still to be seen
(G10, the owner's review, is the first look at real sites).

Unit: 159 tests pass (section choice, lift transform, vanishing point,
messages, settings, shortcut). Lint and type check clean.

End-to-end (`pnpm test:e2e`, 111 checks): G1 to G9 pass (9 checks, in
the last three runs). Full suite: 108 of 111, with the layers view on by
default for every earlier check; the 3 failures are again the D8
clipboard checks, with the Windows clipboard unavailable to every
program on the machine (see milestone 4).

| # | Result |
|---|---|
| G1 | Pass: sections and images lifted; page positions identical after switching off |
| G2 | Pass: click, typing, and wheel scrolling |
| G3 | Pass |
| G4 | Pass |
| G5 | Pass, including after a restart |
| G6 | Pass: within 1 CSS pixel of the page's own rectangle (page offsets are whole pixels); updated after scrolling and resizing; unchanged by the lift |
| G7 | Pass |
| G8 | Pass (reduced motion requested through Chromium's media emulation) |
| G9 | Pass: no frames drawn while idle; scrolling under 20 ms per frame on average |
| G10 | Pass (owner, 2026-09-26, prompt 33) |
| C, D, E, F | Pass; D8 passed once the clipboard worked again |

Changed while building: the checks first read the page before the
switch-off animation had finished (G4) and compared whole-pixel offsets
with fractional rectangles (G6); both checks now wait or allow under one
pixel. "1 site has their own choice" now reads "its own choice".

### Done when

G1 to G9 and the regression checks pass, the owner accepts G10, the
docs and screenshots are updated, and the owner approves the milestone.

## Milestone 6 — Themes and look

Status: Done. Accepted by the owner 2026-09-26 (prompt 33), with one
look-and-feel change: the tab cards are too large; they should be
smaller and hidden while there is only one tab, with a small button to
open another (or Ctrl+T). Screenshots: docs/screenshots/m6/ (1 to 11 in Nebula, 12 to
15 in Daylight). Approved 2026-09-26 (prompt 32: "Go ahead with
milestone 6 and then give a concise list of what to test and approve").
The owner asked for the build without a question round, so the design
choices below are the agent's, recorded here for the owner's review
(H9). Owner direction from prompt 29: lean into the 1980s and 1990s
aesthetic.

Goal: two finished themes with a switch, the 3D room matching the
theme, a design pass over every screen, and the page tilt adjustable
for sharper text.

### Design choices (agent, for owner review)

- Nebula (dark, default): a synthwave night. Deep indigo sky over a
  magenta horizon glow, a striped retro sun low behind the page, a
  magenta neon floor grid, cyan as the accent. Faint scanlines over the
  room (never over pages).
- Daylight (light): a 1990s pastel day. Pale blue sky over a pink and
  lavender horizon, a teal accent, a lavender grid, near-white glass
  panels, dark navy text, no scanlines.
- Theme tokens gain: a second accent (grid, highlights), the horizon
  colour, a warning colour (replacing hard-coded error colours), and
  room options (sun, scanlines). Text contrast is checked against WCAG
  AA (4.5:1 for text, 3:1 for secondary text) in unit tests.
- Theme switch: a button at the bottom right beside the shield
  (ARCHITECTURE.md section 9), and Settings > Theme: Nebula, Daylight,
  or Match the system. Saved in settings.json; the window's title bar
  follows the theme's light or dark scheme.
- Page tilt: Settings > Page tilt, 0 to 20 degrees (default 10). Less
  tilt gives sharper text (milestone 1 note: text slightly soft when
  tilted). The --tilt launch option still wins, for tests.
- Custom window frame: considered and not built. The standard frame
  keeps native dragging, snapping, and accessibility on all three
  systems; the theme now sets its light or dark scheme.
- Small labels (section headings, counters) use a monospace face, the
  one typographic retro touch; body text stays the system font (a custom
  font is milestone 17).

### Tasks

- [x] 1. Theme schema additions and the final Nebula and Daylight
      values; contrast tests.
- [x] 2. The room: sky, horizon glow, retro sun, grid, desk, glow, fog,
      and lights from the theme, and switchable at run time; cards
      redraw.
- [x] 3. The HUD: every hard-coded colour replaced by theme values;
      design pass over the top bar, panels, cards, start panel, error
      cards, shield, About; scanlines.
- [x] 4. Theme switch button and Settings > Theme (with Match the
      system); saved; the title bar and window background follow.
- [x] 5. Settings > Page tilt; applied at once.
- [x] 6. The layers view's outline uses the theme's accent.
- [x] 7. Tests: unit (tokens, contrast, settings); end-to-end H1 to H8;
      C, D, E, F, G as regression.
- [x] 8. Docs and screenshots in both themes (MILESTONE=m6).

### Checks

| # | Check | Expected result |
|---|---|---|
| H1 | Theme switch | The button switches Nebula and Daylight; HUD colours and room colours change together |
| H2 | Settings > Theme | Each choice applies at once and after a restart; Match the system follows the system's light or dark setting |
| H3 | Room | Sky, grid, desk, glow, fog, lights, and cards use the theme's values |
| H4 | Window | The window background and title bar scheme follow the theme |
| H5 | Contrast | Text and secondary text meet WCAG AA contrast on both themes' panels and sky |
| H6 | Page tilt | The setting re-tilts the page at once and after a restart; clicks land at 0 and 20 degrees |
| H7 | Layers view | Its outline uses the theme's accent |
| H8 | No leftovers | No hard-coded colours remain in the shell's styles |
| H9 | Look and feel | Owner review of both themes; screenshots saved |
| C to G | Regression | Still pass |

### Check results (Windows 11, 2026-09-26)

Unit: 164 tests pass, including WCAG AA contrast for both themes (text
and secondary text at least 4.5:1 on panels, sky, and desk; warnings
4.5:1; accent 3:1) and a scan of the shell's styles for hard-coded
colours. Lint and type check clean.

End-to-end (`pnpm test:e2e`, 117 checks): H1 to H7 (6 checks) pass.
Full suite: 113 of 117 in the first run; the failures were the three D8
clipboard checks (the machine's clipboard is still unavailable to every
program) and C1, whose colour comparison expected the room to report
exactly three colours; the room now reports more (lights, fog, horizon,
sun), so C1 compares the colours that have a CSS twin, now including the
horizon. C1 passes again.

| # | Result |
|---|---|
| H1 | Pass |
| H2 | Pass ("Match the system" checked by asking the shell for dark, then light) |
| H3 | Pass: accent, desk, grid, horizon, fog, both lights, and the sun follow the theme |
| H4 | Pass |
| H5 | Pass (unit test) |
| H6 | Pass: 0 and 20 degrees, kept after a restart; a --tilt on the command line wins |
| H7 | Pass |
| H8 | Pass (unit test): only a page's default white and the scanlines' black remain, by design |
| H9 | Pass (owner, 2026-09-26, prompt 33), tab cards to shrink |
| C to G | Pass; D8 passed once the clipboard worked again |

Adjusted after the first screenshots: Daylight's desk looked muddy grey
under the room's lights; it is lighter now, with more ambient light.

### Done when

H1 to H8 and the regression checks pass, the owner accepts H9, the docs
and screenshots are updated, and the owner approves the milestone.

### After acceptance: smaller tab cards (2026-09-26, prompt 33)

Owner request: the tab cards took too much of the screen. Done:
- Cards are two-thirds of their first size (136 by 102 world units),
  drawn at full resolution with larger type.
- The rail shows only with two or more tabs; with one tab the page
  widens into the space. A "+" button at the left of the top bar (and
  Ctrl/Cmd+T) opens another tab; the pinned "+" card stays at the end
  of the rail when it shows.
- Checks changed with the requirement: D2 now opens the second tab with
  the top-bar button and checks the rail hides with one tab and appears
  with two; the last-tab check closes it with Ctrl+W (there is no card
  to close); D3 and D4 open the second tab with the button. D4 now
  compares a card's own size with twelve tabs and with two, instead of
  the spacing between the first two cards: the arc's curve depends on
  the number of cards, which moves them a few pixels without resizing
  them.
- Results: 164 unit tests; 117 of 117 end-to-end checks (D8 included,
  the clipboard works again). Screenshots in docs/screenshots/m6
  retaken.

## Milestone 7 — Instrument panel

Status: Done. Accepted by the owner 2026-09-26 (prompt 36: "everything
else is approved"), with the full suite, 126 of 126, passing on the
owner's machine (clipboard checks included). Screenshots: docs/screenshots/m7/ (16 to 18 show the panel).
Electron security check at the start: 44.4.5 still newest. Plan and
build approved 2026-09-26 (prompts 33 to 35),
with the owner's answers Q1 a (a new milestone before the first
release), Q2 all, "with settings to manage all", Q3 floating panels
along the sides and bottom. The owner's reference image shows the kinds
of controls wanted (round dials, meters, digital readouts, toggles); the
look stays ours (prompt 34: "create controls that match the
aesthetic").

Goal: a busier, more informative interface. Floating panels in the room
show live readouts about the page in front and the browser, a console,
and a network list, like a light DevTools, each part switchable in
Settings.

### Decisions (2026-09-26, prompts 33 to 35)

- What it shows (Q2, all):
  - Page readouts: load time, requests, data transferred, requests
    blocked, the connection (secure or not; certificate issuer and
    expiry), the DNS service in use, and the page's memory and CPU.
  - Console: the page's console messages and errors.
  - Network list: the page's requests (address, type, status, size,
    time), filterable.
  - Browser gauges: tabs open, total memory, frame rate, filter-list age,
    encrypted DNS status, clock.
- Where (Q3): floating glass panels in the room, a column along the
  right side and a strip along the bottom; the page makes room for them
  while they show. They lean toward the viewer and drift a little with
  the room's parallax.
- Settings (Q2, "settings to manage all"): "Show the instrument panel"
  (off by default), and a switch for each part (page readouts, console,
  network list, browser gauges), plus which console messages to show
  (all, warnings and errors, errors only).
- Assumptions accepted: off by default; turned on in Settings, with a
  top-bar button, or Ctrl/Cmd+Shift+I; an "Open full DevTools" button
  for the page in front.
- Controls in our style: round dials, segmented meters, LCD-style
  readouts, and toggle switches, drawn from the theme's colours and
  monospace labels, in Nebula and Daylight alike.
- Data stays in the app: every readout comes from what the browser
  already sees (its own request listener, console events, certificate
  checks it already makes, process metrics). Nothing new goes over the
  network; nothing is stored on disk; it is kept per tab in memory and
  forgotten with the page. Certificate details are read by passing
  Chromium's own verification result through unchanged.

### Tasks

- [x] 1. Page monitor in the main process: per-tab requests (with
      status, size, time, from the session's request events), console
      messages, certificate details per host, page memory and CPU;
      capped, in memory only; a checked request channel for the shell.
- [x] 2. Control components in our style: dial, segmented meter, LCD
      readout, toggle switch; both themes; reduced motion respected.
- [x] 3. Floating panels: right column (page readouts, browser gauges)
      and bottom strip (console, network list); the page's space
      adjusts; parallax drift; keyboard reachable.
- [x] 4. Console view (levels, clear, filter) and network list (type
      filter, text filter, totals).
- [x] 5. Settings: the main switch, a switch per part, console level;
      top-bar button and Ctrl/Cmd+Shift+I; "Open full DevTools".
- [x] 6. docs/privacy.md: what the panel reads and that it stays in
      memory.
- [x] 7. Tests: unit (monitor records, caps, checks, formatting);
      end-to-end I1 to I9; C to H as regression.
- [x] 8. Docs and screenshots in both themes (MILESTONE=m7).

### Checks

| # | Check | Expected result |
|---|---|---|
| I1 | Switching on and off | Settings, the button, and the shortcut show and hide the panels; the page takes the space back; off by default; remembered after a restart |
| I2 | Page readouts | A test page's request count, data size, blocked count, load time, and secure or not match what happened; they follow the tab in front |
| I3 | Certificate | An HTTPS test page shows its certificate issuer and expiry; verification is unchanged (an invalid certificate still fails) |
| I4 | Console | A test page's log, warning, and error appear with their levels; the level setting and clear work |
| I5 | Network list | The test page's requests appear with status, type, and size; filters work |
| I6 | Browser gauges | Tabs open, memory, filter-list age, and DNS status shown and current |
| I7 | Settings per part | Each part hides and shows on its own; remembered |
| I8 | DevTools | "Open full DevTools" opens the page's DevTools |
| I9 | Efficiency and input | While off, no polling and no frames drawn; while on, idle work stays small; clicks on the page still land |
| I10 | Look and feel | Owner review in both themes; screenshots saved |
| C to H | Regression | Still pass |

### Check results (Windows 11, 2026-09-26)

Unit: 176 tests pass (the monitor's records, change numbers, caps,
certificates, sizes; request checks; the panel's wording and filters;
settings). Lint and type check clean.

End-to-end (`pnpm test:e2e`, 126 checks): I1 to I9 (9 checks) pass, in
the last three runs. Full suite: 123 of 126; the 3 failures are the D8
clipboard checks, with the Windows clipboard unavailable to every
program on the machine again during the run (PowerShell's Set-Clipboard
failed too); D8 passed earlier the same day when it worked.

| # | Result |
|---|---|
| I1 | Pass: off by default; button, Ctrl+Shift+I, and Settings; the page gives up and takes back its room; kept after a restart |
| I2 | Pass: 4 requests, 1 blocked, data at least the page's size, load time, memory; follows the tab in front |
| I3 | Pass: the self-signed test certificate's issuer and a failed verdict show; the page still gets the certificate card |
| I4 | Pass: log, warning, and error with their levels; the level from Settings and from the panel; Clear stays cleared |
| I5 | Pass: statuses 200, 404, BLOCKED; type and text filters; totals |
| I6 | Pass |
| I7 | Pass, including after a restart |
| I8 | Pass |
| I9 | Pass: nothing asked while off; about once a second while on; no 3D frames while idle; clicks on the page land |
| I10 | Pass (owner, 2026-09-26, prompt 36) |
| C to H | Pass: the owner's run, 126 of 126 (prompt 36) |

Known limits: the data readout adds up the sizes servers declare
(content-length); responses without one count as unknown ("—"). The
test server now declares its sizes, as most servers do. Frame rate
counts the 3D room's frames, which is 0 while nothing moves (the room
only draws when something changes).

Adjusted after the first screenshots: the desk slab under the page is
hidden while the bottom strip shows (the raised page left it floating,
covering the tab rail's lowest card); the console's level tags read
ERR, WARN, INFO, DBG; the network list no longer scrolls sideways.

### Done when

I1 to I9 and the regression checks pass, the owner accepts I10, the
docs and screenshots are updated, and the owner approves the milestone.

### After acceptance: maximize the console and network list (2026-09-26, prompt 36)

Owner request, done: each of the console and the network list has a
maximize button; the panel then fills most of the window, flat and over
the page, with wrapped messages and full request addresses (plus the
method); Escape, the button again, or a click outside restores it. New
check I5b. Results: 10 of 10 milestone 7 checks.

## Requests waiting for a milestone (tracked, not yet approved to build)

Owner, prompt 36: "let me know what milestone is best for these things.
just keep track if it is not time yet."

| Request | Best place | Why |
|---|---|---|
| Zoom the page in and out, with buttons | Milestone 8, Everyday browser features | Placed (prompt 37, Q1 a) |
| A password manager (a password was not saved) | Milestone 9, Passwords | Placed (prompt 37, Q1 a); plan and questions when milestone 8 is done |

## Milestone 8 — Everyday browser features

Status: Done. Accepted by the owner 2026-09-26 (prompt 38), after
testing downloads, printing, and private tabs; follow-ups recorded
below. Screenshots: docs/screenshots/m8/ (20 to 22). Electron
security check at the start: 44.4.5 still newest. Plan and build
approved 2026-09-26 (prompt 37), with
the owner's answers Q1 a (this milestone next, then Passwords, then the
first release), Q2 a (downloads), Q3 a (private tabs).

Goal: the everyday tools a daily browser needs before its first
release: zoom, find in page, downloads, printing, and private tabs.

### Decisions (2026-09-26, prompts 36 and 37)

- Zoom (owner request, prompt 36): minus, the percentage, and plus
  buttons in the top bar (the percentage resets to 100%); Ctrl/Cmd with
  plus, minus, and 0; remembered per site (as Chrome does), in
  settings.json; steps from 25% to 500%.
- Find in page: Ctrl/Cmd+F opens a find bar under the top bar with the
  match count, next and previous (Enter and Shift+Enter), and Escape to
  close.
- Downloads (Q2 a): saved straight to the system's Downloads folder
  (a number is added to a name that is taken); a Downloads panel slides
  in from the right (like the Library) with progress, open, show in
  folder, cancel, and clear the list; a badge on the menu while one is
  running. The list is kept for the session only.
- Printing: Ctrl/Cmd+P and Print in the menu open the system's print
  dialog for the page.
- Private tabs (Q3 a): a private tab in the same window (menu item and
  Ctrl/Cmd+Shift+N), clearly marked on its card and in the top bar; it
  uses a separate in-memory session, so no history, cookies, cache, or
  site data are kept, and all of it is gone when the last private tab
  closes. Private tabs are never saved in the tab list for "reopen your
  tabs". The shield, encrypted DNS, and element hiding apply as usual.

### Tasks

- [x] 1. Zoom: buttons, shortcuts, per-site memory, the webview's zoom.
- [x] 2. Find in page: the find bar, count, next and previous.
- [x] 3. Downloads: the main process saves to the Downloads folder and
      reports progress; the Downloads panel; badge.
- [x] 4. Printing from the shortcut and the menu.
- [x] 5. Private tabs: an in-memory session with the same protections;
      marking; no history or saved tabs; menu and shortcut.
- [x] 6. docs/privacy.md: downloads and private tabs.
- [x] 7. Tests: unit (zoom steps, file names, settings); end-to-end J1 to
      J8; C to I as regression.
- [x] 8. Docs and screenshots (MILESTONE=m8).

### Checks

| # | Check | Expected result |
|---|---|---|
| J1 | Zoom | Buttons and shortcuts zoom the page; the percentage shows; remembered per site after a restart; reset works |
| J2 | Find in page | Ctrl+F finds text with a count; next and previous move; Escape closes |
| J3 | Downloads | A test file downloads to the chosen folder (a temporary one in tests) with progress; open folder, cancel, and clear work; a taken name gets a number |
| J4 | Print | The shortcut and the menu open printing for the page (checked through a test hook; no printer needed) |
| J5 | Private tabs | A private tab is marked; its visits are not in history; its cookies are not in normal tabs and are gone after it closes |
| J6 | Private and saved tabs | Private tabs are not reopened after a restart |
| J7 | Protections in private tabs | The shield blocks the test tracker in a private tab |
| J8 | Keyboard | Every new control is reachable by keyboard; Escape closes the find bar and the panel |
| J9 | Look and feel | Owner review; screenshots saved |
| C to I | Regression | Still pass |

### Check results (Windows 11, 2026-09-26)

Unit: 181 tests pass (zoom steps, per-site zoom settings, safe and
unique download names, download request checks, shortcuts). Lint and
type check clean.

End-to-end (`pnpm test:e2e`, 134 checks): J1 to J8 (7 checks) pass.
Full suite: 134 of 134 on the second run. The first full run had one
failure, C9's frame rate while the camera follows the pointer (46.5
frames a second against at least 50); C9 then passed three times alone
and in the second full run, so it is recorded as a one-off under load,
to watch.

| # | Result |
|---|---|
| J1 | Pass: buttons, Ctrl+plus, minus, 0, the level shown, kept per site after a restart, reset forgets it |
| J2 | Pass: 3 matches, next and previous, no match, Escape |
| J3 | Pass: saved in the folder; the second copy is "sample (1).txt"; progress, cancel, show in folder (recorded in tests), clear |
| J4 | Pass (counted in tests instead of the system dialog) |
| J5 | Pass: marked; not in history; its cookie unseen by a normal tab and gone after it closes; an in-memory session |
| J6 | Pass |
| J7 | Pass |
| J8 | Pass: the find bar and Downloads panel take the keyboard; Escape closes them |
| J9 | Pass (owner, 2026-09-26, prompt 38), with the follow-ups below |
| C to I | Pass |

Found and fixed during the build: Electron's findInPage option
"findNext" is true for a new search (the opposite of its name); the
first version passed it the other way and found nothing.

Test switch added (test mode only): --downloads-dir, a temporary folder
for downloads. In tests, "Open" and "Show in folder" are recorded
instead of opening anything, and printing is counted instead of opening
the system dialog.

Known limits: a private tab's start panel still shows your bookmarks
and recent history (it only shows them; nothing new is recorded).

### Done when

J1 to J8 and the regression checks pass, the owner accepts J9, the docs
and screenshots are updated, and the owner approves the milestone.

### Owner feedback on milestone 8 (2026-09-26, prompt 38), planned in milestone 9

To be used when planning the next work ("Use my feed back before making
plans"); nothing here is approved to build yet.

- Downloads: no visible sign that a download finished. Proposed: a
  short notice when a download completes (and when one fails), with
  Open and Show in folder.
- Printing to PDF works but the result does not look good. To look into
  later (likely the tilted 3D page or the layers view reaching the
  printout; print the page flat and without the layers styles).
- Private tabs: "New private tab" should also be offered from the "+"
  button in the top bar.

## Milestone 9 — Passwords: owner's answers (2026-09-26, prompt 38)

Answers given before the plan; the plan is the next section
("Milestone 9 — Passwords and site permissions"):

- Q1 a: passwords encrypted with the system's own keychain (Electron's
  safeStorage), unlocked by the system sign-in; no master password.
- Q2 a: managed in a Passwords tab in the Library (search, view, copy,
  delete).
- Q3 a: no import for now; passwords are saved as you sign in.
- Assumptions shown with the questions (not yet confirmed or refused):
  offer to save on sign-in; fill only on the same site; never in
  private tabs; no sync.

## Milestone 9 — Passwords and site permissions

Status: Done. Accepted by the owner 2026-09-26 (prompt 50) after testing everything. Build approved 2026-09-26 (prompt 46), after the
owner chose the logo direction. Questions answered 2026-09-26 (prompt
45: Q1 b, Q2 a, Q3 a). Pushed before the build started. Electron
security check at the start: 44.4.5 still newest (2026-09-26).

Goal: remember sign-ins safely, let sites use the camera, microphone,
and location when you allow it, and close the milestone 8 feedback.

### Decisions (2026-09-26, prompts 38 and 45)

- Passwords are encrypted with the system's keychain (Electron's
  safeStorage: an interface to the operating system's own protected
  storage, such as Windows' DPAPI or the macOS Keychain) and stored in
  hypersol.sqlite; no master password (prompt 38, Q1 a). If the keychain
  is not available (possible on some Linux systems), nothing is saved
  and the offer says why.
- Saving: when a form with a password field is submitted, a bar offers
  Save, Never for this site, or Not now; a new password for a known
  account offers Update.
- Filling (Q1 b): only when you click a sign-in field and pick the
  account from a small list under it; never automatically on load, so a
  page's scripts cannot read a password you did not choose to use.
  Only on the exact site (scheme, host, and port) it was saved for.
- Plain http sites (Q3 a): saved and filled too, and the offer and the
  list say "not secure" (home routers and printers often use http).
- Never in private tabs; no import (prompt 38, Q3 a); no sync.
- Managed in a Passwords tab in the Library: search, view, copy, delete,
  and the "never" list (prompt 38, Q2 a). Clear data leaves passwords
  alone unless ticked.
- Site permissions: camera, microphone, and location ask with a prompt
  under the top bar: Allow, Allow this time, Block (Q2 a). Allow and
  Block are remembered per site in settings.json; "this time" lasts
  until the tab leaves the site or closes. Every other permission stays
  refused, as today.
- Private tabs ask the same way, but remembered choices stay in memory
  and are forgotten with the last private tab (as GitHub issue #8).
- A site panel opened from the address bar shows the site's choices and
  changes them; Settings lists every site with a remembered choice.
- While a site uses the camera or microphone, its tab card and the top
  bar show a live marker.
- Location uses only the operating system's own location service; no
  network location service or API key is added (AGENTS.md rule 3). If
  the system gives no location, the site gets an error. Checked early in
  the build and reported.
- Download notice: a short notice when a download finishes or fails,
  with Open and Show in folder (milestone 8 feedback).
- "+" keeps opening a normal tab on click; a small arrow on it (or a
  right-click) opens New tab and New private tab (milestone 8 feedback).
- Printing prints the page flat, without the layers view's styles
  (milestone 8 feedback).

### Tasks

- [x] 1. Password store: safeStorage encryption, the database table, the
      "never" list; unit tests with a stand-in keychain.
- [x] 2. Sign-in detection in the page preload and the save / update bar;
      never in private tabs.
- [x] 3. Fill on click: the account list under a sign-in field, same site
      only.
- [x] 4. Library Passwords tab: search, view, copy, delete, "never" list;
      Clear data option.
- [x] 5. Site permissions: the request and check handlers, the prompt,
      per-site memory (in memory for private tabs), the site panel, the
      Settings list, the camera and microphone marker; location through
      the system only.
- [x] 6. Download finished and failed notice.
- [x] 7. The "+" menu with New private tab.
- [x] 8. Flat printing without the layers view's styles.
- [x] 9. docs/privacy.md: passwords and permissions.
- [x] 10. Tests: unit; end-to-end K1 to K10; C to J as regression.
- [x] 11. Docs and screenshots (MILESTONE=m9).

### Checks

| # | Check | Expected result |
|---|---|---|
| K1 | Save a password | Signing in on a test page offers to save; Save stores it encrypted (the database holds no plain text); Never and Not now work; a changed password offers Update |
| K2 | Fill on click | Clicking the field lists the account; choosing it fills; nothing is filled before the click; another site (other port) is not offered it |
| K3 | Passwords tab | Search, view, copy, delete, and the "never" list work in the Library |
| K4 | Private tabs | No offer and no fill in a private tab |
| K5 | Keychain unavailable | With the keychain turned off (a test switch), nothing is saved and the offer says why |
| K6 | Permission prompt | A test page asking for the camera gets the prompt; Allow, Allow this time, and Block give the page the right answer (a stand-in device in tests) |
| K7 | Remembered choices | Allow and Block survive a restart; "this time" does not; private choices are forgotten with the last private tab; other permissions stay refused |
| K8 | Site panel and Settings | The panel shows and changes the site's choices; Settings lists and removes them; the in-use marker shows while the camera is used |
| K9 | Download notice | Finishing and failing downloads show the notice; Open and Show in folder work |
| K10 | "+" menu and printing | New private tab from the "+" menu; a test page prints to PDF the same with the layers view on and off |

Test sign-ins are made-up values on 127.0.0.1 fixture pages; no real
passwords are used anywhere.

### Check results (Windows 11, 2026-09-26)

`pnpm test:e2e` ran all 150 checks (C to K plus the issue checks). K1
to K10 passed. The first full run had two failures in E10 (keyboard
access to the panels): the Library now has a third tab, Passwords, so
Shift+Tab from the search field reaches it before History. That is a
changed requirement (milestone 9 added the tab), so the check now
expects Passwords, then History, then Bookmarks; with that, all 21
milestone 3 checks passed. The full suite was then run again: 150 of
150 passed (279 s). `pnpm test`: 208 unit tests passed; `pnpm lint` and
`pnpm typecheck` clean.

| # | Result |
|---|---|
| K1 | Pass. Typed sign-in offers to save (marked not secure on http); the database holds the password only encrypted; the same password again offers nothing; a new one offers Update and replaces it; Not now saves nothing; Never stops offers on the site |
| K2 | Pass. Nothing filled on load; a click on the field lists the account; picking it fills both fields (the page sees the input events); another port (another origin) gets no list |
| K3 | Pass. Passwords tab: search, Show, Copy (read back from the clipboard), Delete; the "never" list can be undone |
| K4 | Pass. Private tab (opened from the "+" menu): no list, no offer, nothing saved |
| K5 | Pass. With --test-no-keychain the offer says the keychain is not available, has no Save, nothing is saved, and the Library says why |
| K6 | Pass. Stand-in camera and microphone: Allow gives video, Allow this time gives audio, Block refuses location (code 1) |
| K7 | Pass. Remembered on the page without asking; Notification.requestPermission() is refused; after a restart Allow and Block hold and "this time" is gone; a private tab asks for itself, its choice stays out of settings.json and is gone with the last private tab |
| K8 | Pass. Marker in the top bar and on the tab (accessOf); the site panel shows Allow, Block, and "this time", and changing Location to Ask saves; leaving the site clears the marker; Settings lists the site and Forget clears it |
| K9 | Pass. Notices for a finished download (Show in folder and Open reach the main process) and for a broken one (Download failed, with Downloads) |
| K10 | Pass. The "+" arrow and a right-click open the menu; New private tab and New tab work. printToPDF of a lifted page equals the flat page (dates and document id removed; two flat prints are identical first). With the print rule taken out on purpose, K10 failed, so it does test the fix |

Location (the plan's early check): with every host except 127.0.0.1
blocked, an allowed request got a position in about 4 seconds on
Windows 11, and the app made no network request for it: the position
comes from Windows' own location service. The operating system may use
its own services for that; the browser adds none.

Not checked by the tests: that the saved sign-ins list closes when the
page loses the keyboard (test windows never have focus, so the page
never gets that event); Escape and a click elsewhere close it and are
used in the tests.

Known limit: Electron reports no event when a page starts or stops
using the camera or microphone, so the marker means "given to this
page" (from the grant until the tab leaves the site), not "recording
now". The operating system's own camera light and indicators still
show actual use.

Found and fixed during the build: both preloads importing the same
module made the build split it into a separate file, which a sandboxed
preload cannot load, so the shell's bridge failed to start. Fixed by
keeping the preloads' imports apart; preload/preload-graph.test.ts now
fails if they ever share a module.

### Done when

- K1 to K10 pass on Windows, with C to J and the unit tests.
- The owner has tried saving and filling a password, a permission
  prompt, the download notice, the "+" menu, and printing, and accepts.

## Milestone 10 — Tabs and economy

Status: Done. Accepted by the owner 2026-09-26 (prompt 50) after testing; feedback for the next plan recorded below. The owner asked to push, build this milestone, and
then list the tests (prompt 49, 2026-09-26), without a separate plan
review; the choices below are the agent's defaults, marked for the
owner's review at acceptance, and each can be changed in Settings or
later. Milestone 9 was pushed first; its acceptance was then still to
come (the owner tested it with this milestone's list and accepted both,
prompt 50). Electron security
check at the start: 44.4.5 still newest (2026-09-26).

Goal: the tab requests from prompt 42 and a lighter browser: reopen,
search, and mute tabs; choose how tabs are shown; an economy mode; tabs
that sleep when unused; and history work moved off the main process
(GitHub issue #4).

### Decisions (agent defaults, for the owner's review)

- Reopen a closed tab: Ctrl/Cmd+Shift+T and "Reopen closed tab" in the
  menu; the last 25 closed tabs of this session (memory only), reopened
  where they were, with their back and forward history. Private tabs are
  not remembered.
- Search tabs: Ctrl/Cmd+Shift+A and "Search tabs" in the menu: a list of
  every tab (title, site, sound, asleep) under the top bar; typing
  filters it; arrows and Enter switch; each has a close button.
- Mute: a tab playing sound shows a speaker on its card and in the
  lists; clicking it mutes or unmutes the tab; "Mute tab" in the menu
  does the same for the tab in front. Muting belongs to the tab.
- Settings > Tabs, size: Small, Medium (today's size, the default),
  Large.
- Settings > Tabs, show tabs as: Cards (today: the rail appears with two
  or more tabs; the default), Cards that hide (the rail stays out of the
  way and slides in when the pointer rests at the left edge or with
  Ctrl+Tab, and goes 2 seconds after the pointer last moved over them,
  since over the page the shell sees no pointer at all; a list of tabs
  shows in the top bar), or a List in the top
  bar only (no cards). The list is a row of small tabs under the top
  bar: favicon, title, sound, close, and "+".
- Economy mode, Settings > Economy: Off, On, or On when running on
  battery (the default). It draws the room at a lower resolution, turns
  off the glow, sun, horizon band, scanlines, parallax, and switch
  animations, and caps the room at 30 frames a second. The page itself
  stays sharp. "ECO" shows in the top bar while it is on.
- Sleeping tabs, Settings > Economy: put a tab to sleep after it has
  not been in front for 30 minutes (the default; also Off, 5, 15, 60);
  in economy mode after 5 minutes at most. Never asleep: the tab in
  front, a tab playing sound, a tab with a download running, a tab with
  text typed into a form, a tab still loading. A sleeping tab keeps its
  card, snapshot, and title, marked "asleep"; opening it loads the page
  again with its back and forward history.
- History off the main process (issue #4): history searches, recent
  pages, and writes run in a worker thread with its own connection to
  hypersol.sqlite; search uses a full-text index (SQLite FTS5 with the
  trigram tokenizer, which matches parts of words like today's search;
  shorter than three letters falls back to the plain search); a
  "latest visit per address" index serves the start panel. Budgets,
  measured by a unit benchmark with 100,000 visits: a search or the
  recent list answers within 50 ms, and the main process's event loop
  is never held more than 20 ms by history work.

### Tasks

- [x] 1. Main process: sound state and mute per tab; downloads say which
      tab started them; power source (battery or not); tab history kept
      for reopening and waking; the history worker.
- [x] 2. Page preload: tells the shell when a form has typed text.
- [x] 3. Shell: closed-tab list and reopening; tab search; mute on cards,
      lists, and the menu.
- [x] 4. Settings > Tabs: card size and how tabs are shown; the list in
      the top bar; cards that hide.
- [x] 5. Economy mode and sleeping tabs, with their Settings.
- [x] 6. History worker, full-text search, and the benchmark (issue #4).
- [x] 7. Tests: unit (closed-tab list, sleep rules, history worker and
      benchmark, settings); end-to-end L1 to L10; C to K as regression.
- [x] 8. Docs, privacy statement, and screenshots (MILESTONE=m10).

### Checks

| # | Check | Expected result |
|---|---|---|
| L1 | Reopen a closed tab | Ctrl+Shift+T and the menu reopen the last closed tabs in order, in place, with back history; private tabs are not reopened |
| L2 | Search tabs | The shortcut opens the list; typing filters; Enter switches; close works; Escape closes |
| L3 | Mute | A page playing sound shows the speaker; clicking it (card, list, or menu) mutes the page and back |
| L4 | Card size | Small, Medium, and Large change the cards and the page's room; saved |
| L5 | How tabs are shown | Cards that hide: no rail until the left edge or Ctrl+Tab, list in the top bar; List only: no cards; the list switches and closes tabs |
| L6 | Economy mode | On: lower resolution, effects off, at most 30 frames a second, "ECO" shown; "on battery" follows the power source |
| L7 | Sleeping tabs | An unused tab sleeps (its page is gone, card kept); opening it wakes it with its history; tabs with sound, a download, or typed text stay awake |
| L8 | History still works | History, search, and the start panel work through the worker; E checks pass |
| L9 | History budget | Unit benchmark: 100,000 visits, search and recent within 50 ms, main thread held at most 20 ms (since prompt 107: the longest gap between two turns of the main process's event loop) |
| L10 | Keyboard and menus | The new shortcuts and menu entries work from the page and the shell |

### Check results (Windows 11, 2026-09-26)

`pnpm test`: 220 unit tests passed. `pnpm lint` and `pnpm typecheck`
clean. End-to-end: all nine L checks passed (L10's shortcuts and menus
are covered inside L1 and L2). The full suite ran 159 checks: 158
passed and D8 "copies selected text" failed once (the clipboard check
that has failed before when the Windows clipboard was busy); it passed
when run again (D8, 5 of 5), and the files run one at a time, so no
other check touched the clipboard meanwhile. The full suite was then
run again: 159 of 159 passed (317 s).

| # | Result |
|---|---|
| L1 | Pass. Ctrl+Shift+T reopened the closed middle tab in its place, on find.html, with link-b.html behind it (Back went there); a closed private tab was not kept; the menu entry is greyed out with nothing to reopen and reopens otherwise |
| L2 | Pass. Ctrl+Shift+A from the page and from the shell, and the menu; typing filters; Enter and the arrows switch; the list's close button closes; "No tab matches."; Escape closes |
| L3 | Pass. A page playing a tone showed as audible; the card's speaker muted it (the page's audio muted in Electron), the menu's Unmute tab unmuted it, and the list's speaker muted it again |
| L4 | Pass. Large (1.3) narrowed the page, Small (0.8) widened it; saved in settings.json |
| L5 | Pass. Cards that hide: no rail with two tabs, the list shown; Ctrl+Tab brought the cards in and they went again; resting the pointer at the left edge brought them in, and they went after it moved away. List only: no cards even with Ctrl+Tab; the list switched, closed, and opened tabs |
| L6 | Pass. On: the room at half the device's pixel ratio, no sun, no scanlines, ECO shown, and a spinning card drew at most 30 frames a second (counted over one second). "On battery" followed the power events |
| L7 | Pass. With a 100 ms "minute" and 5 minutes set, the unused tab slept (its page closed); the tabs with typed text, a running download, and the one in front stayed awake; opening it woke it on link-a.html with link-b.html behind it (Back went there) |
| L8 | Pass. History ran in the worker thread; visits and search worked through it |
| L9 | Pass. 100,000 visits: nine searches and the recent list answered in 1 to 34 ms after the first (26 ms), and the main process's event loop was held at most 16 ms (budget 20). The unit benchmark on the same data kept each query under 50 ms too |
| L10 | Pass (inside L1 and L2) |

Found and fixed during the build:
- Electron restores a page's history only into a page that has never
  navigated, not even to a blank page. A new page for a reopened or
  waking tab now starts with a marked blank address that the main
  process turns into "load nothing", and the history goes in once the
  page is attached.
- Over the page the shell sees no pointer events, so "the pointer moved
  away from the cards" cannot be seen; cards that hide go 2 seconds
  after the pointer last moved over the room instead.
- Escape now closes the top bar's menus from anywhere in the shell (the
  screenshots showed the "+" menu staying open).

Changed checks, because their requirement changed (documented here):
- The Ctrl+Shift+T example in the shortcut unit test ("ignores other
  combinations") now uses Ctrl+Alt+T: Ctrl+Shift+T reopens a closed tab.
- The milestone 9 database test now expects schema 3 and also checks
  the new search index on an upgraded database.
- A storage test awaits recordVisit, which now answers later (history
  runs in a worker).

### Done when

- L1 to L10 pass on Windows, with C to K and the unit tests.
- The owner has tried the new tab features, economy mode, and sleeping
  tabs, and accepts.

### Owner feedback on milestones 9 and 10 (2026-09-26, prompt 50), planned as milestone 11

1. Cards that hide behave strangely: keep only two ways to show tabs,
   cards and a list.
2. The address bar should complete previously visited sites, like other
   browsers.
3. The page's window should be wider (too much space on the right), with
   adjustable settings for the angle and more.
4. The top bar's menu (the dots) should close when clicking elsewhere.
5. Settings: better organized and better looking, perhaps in levels,
   with a search.
6. Show the available shortcuts somewhere, and allow remapping them.
7. The Library's search box should reset when changing tabs.

## Milestone 11 — Owner feedback: address bar, view, settings, shortcuts

Status: Done. Accepted by the owner 2026-09-26 (prompt 54). Build approved 2026-09-26 (prompt 52). The owner's
feedback (prompt 50) with the answers Q1 a, Q2 a, Q3 a (prompt 51).
Electron security check at the start: 44.4.5 still newest (2026-09-26).

### Decisions (2026-09-26, prompts 50 and 51)

- Tabs show as Cards or as a List in the top bar; "Cards that hide" is
  removed (the owner found it odd). A saved "autohide" reads as Cards.
- Address bar completion (Q1 a): as you type, the rest of a visited
  site fills in, selected (Enter goes there, Delete removes it, typing
  carries on); a list under the bar shows the best matches from history
  and bookmarks (most visited and most recent first) and "Search for
  ...". Arrows and Enter pick; each history match can be removed. The
  matching runs in the history worker (an index of sites by visit count
  and last visit), so it stays fast with a long history.
- A wider page: the page is laid out so its tilted outline reaches both
  sides of the free area (today it shrinks around its centre to fit the
  near edge, leaving a gap on the right).
- Settings > Appearance and view (Q3 a): how far the page leans (the
  existing tilt, 0 to 20 degrees); which way it leans (right edge back,
  or left edge back); how much the room moves with the pointer (off,
  subtle, normal); space around the page (compact, normal, roomy); and
  a "Flat and still" preset (no lean, no movement).
- Menus close when you click elsewhere: the dots menu, the "+" menu,
  the site panel, and tab search also close when the page takes the
  click (the shell never sees clicks inside a page), on a card, and
  when the window loses focus.
- Settings (Q2 a): a wider panel with sections listed on the left
  (General; Appearance and view; Tabs; Privacy and security, with the
  shield, DNS, filter lists, site permissions, and passwords; Economy;
  Instrument panel; Shortcuts; Clear data), one page each; a search at
  the top finds any setting by its name or related words across all
  sections, shows its section, and highlights it; a cleaner look, with
  grouped cards and a short description under each setting.
- Shortcuts: Settings > Shortcuts lists every shortcut with its keys;
  Change, then press the new keys, remaps it (saved in settings.json;
  the main process uses the remapped keys); clashes are shown and
  refused; Reset returns the defaults; copy, paste, cut, undo, and
  select all cannot be taken. "Keyboard shortcuts" in the menu opens
  the page; the menus' key hints follow the remapped keys.
- The Library's search box empties when you switch between Bookmarks,
  History, and Passwords.

### Tasks

- [x] 1. Two ways to show tabs; settings read an old "autohide" as cards.
- [x] 2. Address bar completion: the worker's site index and query,
      inline completion, the suggestion list, removing a match.
- [x] 3. The wider page layout; View settings and the preset.
- [x] 4. Menus and popovers close on clicks in the page, on cards, and
      when the window loses focus.
- [x] 5. Settings reorganized into sections, with search and a new look.
- [x] 6. Shortcut list and remapping, in the main process and the menus.
- [x] 7. Library search resets between tabs.
- [x] 8. Tests: unit (completion ranking, layout fit, shortcut table and
      clashes, settings search, settings reading); end-to-end M1 to M8;
      C to L as regression (L5 changes with item 1).
- [x] 9. Docs and screenshots (MILESTONE=m11).

### Checks

| # | Check | Expected result |
|---|---|---|
| M1 | Two ways to show tabs | Settings offers Cards and List only; a saved "autohide" opens as Cards |
| M2 | Address bar completion | Typing part of a visited site completes it inline and lists matches (history, bookmarks, "Search for"); Enter, arrows, Delete, Escape behave as described; a removed match stays gone |
| M3 | Wider page | At 10 degrees the page's outline reaches within a few pixels of both sides of the free area; at 0 degrees it fills it 1:1 as before |
| M4 | View settings | Direction, movement, and margins change the page and room; "Flat and still" sets no lean and no movement; saved |
| M5 | Menus close | The dots menu, "+" menu, site panel, and tab search close on a click in the page, on a card, and when the window loses focus |
| M6 | Settings | Sections switch; search finds settings in other sections and shows them; keyboard reaches everything |
| M7 | Shortcuts | The list shows every shortcut; a remap works from the page and the shell and survives a restart; a clash and a reserved key are refused; Reset works; the menu shows the new keys |
| M8 | Library search reset | Switching tabs empties the search box and shows the full list |

### Check results (Windows 11, 2026-09-26)

`pnpm test`: 235 unit tests passed; `pnpm lint` and `pnpm typecheck`
clean. End-to-end: M1 to M8 passed. The full suite (167 checks) passed
163; the 4 that failed all read the clipboard (D8 copy a link, copy
selected text, paste; K3's Copy inside K2), and the Windows clipboard
was failing machine-wide at the time: PowerShell's own Set-Clipboard
failed with "Requested Clipboard operation did not succeed". Run again
once the clipboard worked (same day): D8 5 of 5 and K2 passed, so all
167 checks have passed on this build.

| # | Result |
|---|---|
| M1 | Pass. Settings offers Cards and List in the top bar only; a saved "autohide" opened as Cards (also L5, rewritten, and a unit test) |
| M2 | Pass (and four runs in a row after a fix, below). Visits on a named test site: "sho" completed to the site, selected; typing on completed to a page, and Enter went to its real address; Backspace dropped the completion without completing again; Escape dropped the list and kept the typing; the arrows picked a row and Enter went there; a removed match left the list and history; the "Search ... for" row searched even for address-like text |
| M3 | Pass. At 10 degrees the page's outline was within 3 px of both sides of the free area (36 px margins, one tab); unit tests check 5, 10, and 20 degrees both ways within 2 px |
| M4 | Pass. Left edge back made the left edge the shorter one; Subtle halved the movement; Roomy (72 px) narrowed the page; "Flat and still" set no lean and no movement; all saved. Added after the build (owner, prompt 53): a "Default view" button next to it, which put all four back to the defaults (M4 extended; 8 of 8 M checks passed again) |
| M5 | Pass. The dots menu, the "+" menu, the site panel, and tab search closed on a click in the page and on a card |
| M6 | Pass. Eight sections; Privacy showed DNS and not Theme; "camera" found Site permissions and "lean" the page view from other sections, with working controls; a search with no match said so; Escape cleared the search, then closed |
| M7 | Pass. 22 shortcuts listed; Reopen closed tab remapped to Ctrl+Alt+R and saved; a clash (Ctrl+T) and a reserved key (Ctrl+V) were refused with the reason; the menu showed Ctrl+Alt+R; after a restart Ctrl+Alt+R reopened a tab from the page and Ctrl+Shift+T did nothing; Reset returned the default |
| M8 | Pass. Switching Library tabs emptied the search box and showed the full list |

Found and fixed during the build:
- The address bar sometimes sent the completed text without its scheme
  (so http sites opened as https): the list's close-after-blur timer and
  the replies' order could clear what was offered. Enter now looks up
  the real address of whatever the bar shows among everything offered
  while typing, and the blur timer leaves the list alone while the bar
  has the keyboard.
- A test fixture's first 100,000-visit suggestion once took 95 ms (the
  first call after the inserts); a warm suggestion takes about 3 ms. The
  unit check takes the middle of five tries.

Changed checks, because their requirement changed (documented here):
- L5 (milestone 10) now checks the two remaining ways to show tabs and
  that a saved "cards that hide" opens as cards.
- The layout unit test "shrinks more as the tilt grows" became "gets
  shorter as the tilt grows, and reaches both sides of the free area":
  the page no longer narrows with the tilt (owner, prompt 50).
- Checks that use a setting first show its Settings section
  (settingsTo, as a person picks the section), since Settings has one
  page per section.

### Done when

- M1 to M8 pass on Windows, with C to L and the unit tests.
- The owner has tried the address bar, the wider page and View
  settings, the new Settings, and shortcut remapping, and accepts.

## Milestone 12 — Developer preview 0.9.0

Status: Done. Accepted 2026-09-26 (prompt 61), and released as the
0.9.0 developer preview (tag v0.9.0). Plan and build approved (prompt 58),
after the answers in prompts 54 to 58 (recorded below: A a, B a, C a,
D1 to D4 a, E a, F a, P1 a, P2 b, P3 b). Pushed before the build started.

Goal: the browser released as source that developers can build, test,
and contribute to on Windows and Linux, with the record of how it was
made cleaned for privacy and spelling.

### Decisions (prompts 54 to 58)

- Source only, tagged 0.9.0 "developer preview"; 1.0 comes with
  installers and HoloML (B a).
- Privacy (P1 a): the current files are cleaned; the history is left as
  it is. PROMPTS.md becomes an edited record: every prompt in order with
  its meaning unchanged, spelling fixed, tool bookkeeping (token counts,
  session tags, renumbering notes) summarised once at the top; the
  AGENTS.md logging rule changes from "verbatim" to "lightly edited".
  The README keeps both founders' names (P2 b). Commits keep the
  current author email (P3 b).
- Legal (D1 to D4 a): copyright "The HyperSpace 3D Authors" and "The
  HoloML Authors", with AUTHORS files; the name stays, with a README
  line that HyperSol, the company, no longer exists and this is a
  personal project honouring it; contributions come under Apache 2.0's
  own terms.
- Security reports through GitHub's private vulnerability reporting,
  switched on in both repositories (F a).
- GitHub Actions builds and tests every push on Windows and Linux (C a).
- Trademark and `.holo` checks now, with the searches and results
  recorded (E a).

### Tasks

- [x] 1. PROMPTS.md as an edited record; the logging rule updated.
- [x] 2. Proofreading of every document in both repositories; machine
      details and the private session setup taken out of HANDOFF.md.
- [x] 3. Legal files: copyright lines, NOTICE, AUTHORS, the README note,
      the naming rules in AGENTS.md (both repositories).
- [x] 4. THIRD-PARTY.md: the licences of every package the app ships
      and of the filter lists.
- [x] 5. SECURITY.md and CONTRIBUTING.md (both repositories); private
      vulnerability reporting switched on.
- [x] 6. Trademark and `.holo` checks, recorded in docs/name-checks.md.
- [x] 7. Electron: the newest stable version, and the security check.
- [x] 8. GitHub Actions: lint, types, unit tests, and end-to-end checks on
      Windows and Linux; Linux problems it finds fixed.
- [x] 9. Version 0.9.0; the README's developer section; the release notes.
      Tagging and publishing the release wait for the owner's go.

### Progress (2026-09-26)

- Tasks 1 to 7 done. Proofreading (task 2) found no spelling slips in
  either repository; it found stale milestone numbers, a stale test
  duration, and two sentences about private tabs whose meaning had
  drifted (ARCHITECTURE.md, docs/privacy.md), all corrected.
- Version 0.9.0 in every package.json. Check D11 now reads the version
  from the app's package.json instead of expecting "0.0.0" (the
  requirement changed: the About box shows the real version). The About
  box and README carry the new copyright line. Release notes started in
  CHANGELOG.md.
- GitHub Actions, first runs (task 8): lint, types, and the 235 unit
  tests pass on Windows and Linux (after the history timing check took
  the median of five runs; one run alone caught a pause of the shared
  machine). End-to-end on Windows: 165 of 167 passed.
  - I5b failed: on the runner's 1024x768 screen, with the tab rail
    showing, the console's buttons ran under the network panel. Fixed:
    the header controls wrap to a second line in a narrow panel. New
    check I5c holds every header control of both panels inside its
    panel, clickable, at 1000x640 with the rail showing; it failed
    before the fix and passes after.
  - C9's frame rate failed: 16.8 frames a second against at least 50.
    The runner has no graphics card, so Chromium draws in software.
    Owner's decision (prompt 59, option a): where the room's WebGL
    renderer is a software one (SwiftShader, llvmpipe, Microsoft Basic
    Render Driver), C9 still measures and prints the rate, then marks
    the frame-rate part skipped; on graphics hardware it must still
    reach 50. The idle part of C9 runs everywhere.
  - End-to-end on Linux: every app launch timed out, and the run hit
    its 45-minute limit before errors were printed. The harness now
    prints a launch failure as it happens, which showed the cause:
    "WebGL2 blocklisted". The runner has no graphics card, Chromium
    blocks Linux's software GL for WebGL 2, and the room's renderer
    cannot start, so the shell never becomes ready. On Linux the test
    launches now pass `--enable-unsafe-swiftshader`, so Chromium draws
    WebGL with its own software renderer (tests only; no change with a
    graphics card).
  - Next run: Windows passed (167 checks, C9's rate skipped as
    decided: 15.7 frames a second on Microsoft's software renderer).
    Linux: 159 passed, 8 failed. K1 to K4: the runner has no desktop,
    so Chromium chose its fixed-key password store, which the app
    rightly counts as no keychain; the Linux test launches now ask for
    GNOME Keyring by name, and the workflow starts a throwaway unlocked
    one on a session bus. C2 at 1024x700 (three tilts) and H6: after the
    page's shape changes (a resize, a new tilt), the next click did not
    reach the page. Not reproduced on Windows, even drawing in software;
    the harness now reports what the shell has under a missed click and
    whether a second click gets through.
  - Found by this: without WebGL 2 the app showed an empty window.
    Owner (prompt 60): add a clear message. Now the room is skipped
    where WebGL 2 cannot start, pages and panels still work, and a
    notice says "This computer can't draw the 3D room", why, and how to
    show tabs as a list. New check N7 (tests/e2e/m12.e2e.ts) passes.
  - Third run: Windows passed; Linux 164 of 167: the keychain fix made
    K1 to K4 pass, and H6 passed; C2 at 1024x700 still lost the first
    click after a resize, while a second click a second later landed.
    A person cannot click that soon after a resize, so the harness's
    resize now also waits until input reaches the page. Pointer moves
    reaching it were not enough (fourth run: C2 still lost the click),
    so it presses an empty spot of the page until the page sees the
    press. The fourth run also showed a race in #8 (m8): Ctrl+Tab
    pressed again before the last press took effect overshot and closed
    the wrong tab; tab steps and closes are now each confirmed
    (cycleToTab, closeFocusedTab in the harness). Windows passed in
    full on the third and fourth runs (169, and C9's rate skipped).
- Local regression (N6), Windows 11: 167 of 167 end-to-end checks
  passed (332 seconds) before I5c was added; milestone 7 with I5c: 11
  of 11.

### Checks

| # | Check | Expected result |
|---|---|---|
| N1 | Builds and tests on GitHub | The workflow passes on Windows and Linux: lint, types, unit tests, end-to-end checks |
| N2 | Privacy | No personal email, machine details, or private session setup in the current files of either repository; PROMPTS.md reads as an edited record |
| N3 | Spelling | Every document in both repositories proofread |
| N4 | Legal and project files | LICENSE, NOTICE, AUTHORS, THIRD-PARTY.md, SECURITY.md, CONTRIBUTING.md present and consistent in both repositories |
| N5 | From source | A fresh clone builds and runs with the README's steps (checked on Windows here and on Linux through GitHub) |
| N6 | Regression | C to M pass locally, and the unit tests |
| N7 | Without WebGL 2 | Started without WebGL (test mode), the app says "This computer can't draw the 3D room" and why; pages still load and take clicks; OK closes the notice; with WebGL there is no notice (owner, prompt 60) |

### Results (2026-09-26)

| # | Result |
|---|---|
| N1 | Pass. Run 36290367588 (commit 6e6d0af): Windows and Linux each passed lint, types, 235 unit tests, and 169 end-to-end checks; C9's frame rate skipped on both, as decided (software drawing: 18.0 and 14.1 frames a second) |
| N2 | Pass. No personal email, private names beyond the two founders, or private session setup in the current files; the test hardware stays described in general terms (a laptop with a discrete graphics card, one 1920x1080 display), as test context. The history is left as it is (P1 a) |
| N3 | Pass. Every document in both repositories proofread (task 2) |
| N4 | Pass. LICENSE, NOTICE, AUTHORS, THIRD-PARTY.md (browser), SECURITY.md, CONTRIBUTING.md in both repositories; private vulnerability reporting on in both |
| N5 | Pass on Windows: a fresh clone of the pushed main, in a short folder path, installed with `pnpm install --frozen-lockfile`, built, passed lint, types, and the unit tests, and launched (checks C1). A clone under a very long folder path failed: pnpm could not write a file past Windows' 260-character path limit (now noted in CONTRIBUTING.md). Linux through GitHub Actions (N1) |
| N6 | Pass. Full local run with N7: 166 of 170 passed; the other four (D8's copy and paste, K2's copy) failed while the Windows clipboard was failing for every program on the machine (PowerShell's Set-Clipboard too). Rerun once it worked again: D8 and K1 to K3, 10 of 10 passed |
| N7 | Pass, locally and in GitHub Actions on Windows and Linux |

### Done when

- N1 to N7 pass, the owner has read the edited PROMPTS.md and the new
  project files, and says go for the 0.9.0 tag and release.

## Milestone 13 — HoloML v0.1, the language

Status: Done. Accepted 2026-09-27 (prompt 64). Plan and
build approved 2026-09-26 (prompt 63) with Q1 a (`.holoml`), Q2 a
(strict, HTML-like), Q3 a (everything milestone 14 shows), Q4 a (GitHub
Actions). Pushed before the build; the holoml repository pushed at the
end (commit 553e497).
Rule 13 check done (ARCHITECTURE.md section 3).

Goal: HoloML exists as a small, written language that a person can
hand-write, with a parser and a checker that any renderer can use, and
sample files that pin down what every element means. The browser shows
HoloML pages in milestone 14; nothing in the browser changes here.

The work happens in the holoml repository; this plan, the prompt log,
and the handoff stay in this one.

### The language, as proposed (owner, prompt 58: H1 a, H2 a)

HTML-like tags; 3D models are glTF 2.0 (`.gltf` or `.glb`). A first
sketch, for judging, not final:

```
<holoml version="0.1">
  <head>
    <title>Showroom</title>
  </head>
  <scene background="#0b0f1e">
    <viewpoint position="0 1.6 6" look-at="0 0.8 0" mode="orbit" />
    <light type="ambient" intensity="0.4" />
    <light type="directional" position="4 8 5" intensity="1.2" />
    <a href="coupe.holoml">
      <model id="coupe" src="models/coupe.glb" rotation="0 30 0">
        <material name="Paint" color="#c0182a" metalness="0.8" roughness="0.3" />
      </model>
    </a>
    <label position="0 2.1 0">The coupe: click to walk around it</label>
    <animate target="#coupe" attribute="rotation" to="0 390 0" duration="20s" repeat="indefinite" />
  </scene>
</holoml>
```

- Units: metres and degrees; y is up (glTF's own convention).
- Elements in v0.1: `holoml`, `head`, `title`, `meta`, `scene`,
  `group` (moves several things together), `model`, `material` (changes
  a named material inside a model), `viewpoint` (where the viewer
  starts, and orbit or walk), `light` (ambient, directional, point,
  spot), `label` (text in the scene), `a` (a link around a model or a
  label), and `animate` (changes an attribute over time). A model's own
  glTF animations play by name.
- Links go to other HoloML pages or to ordinary web pages.
- Media type, for pages served over the web: `model/vnd.holoml`, in the
  same family as X3D's `model/x3d+xml`; unregistered until the language
  has users.

### Questions

- Q1, the file extension (owner, prompt 62). a: `.holoml`, which
  nothing else uses and which matches the name (recommended). b:
  `.hlml`, shorter, but already used by "High Level Mindustry Logic"
  (docs/name-checks.md). c: keep `.holo`, used by two other formats.
- Q2, how strict the syntax is. a: strict and HTML-like: every element
  closed (`<model ... />` or `</model>`), attribute values quoted,
  boolean attributes may stand alone (`autoplay`), and any mistake stops
  with its line, column, and a plain message (recommended: a small
  parser, clear errors, and room to loosen later). b: exactly XML, so
  XML tools can read it (no standalone boolean attributes). c: forgiving
  like HTML, repairing mistakes as browsers do (much larger; later, if
  ever).
- Q3, what v0.1 covers. a: everything milestone 14 will show: models,
  groups, the viewpoint with orbit and walk, lights, labels, links,
  material changes, and simple animation (recommended: one spec for one
  renderer milestone). b: the core only (models, viewpoint, labels,
  links); lights, materials, and animation in v0.2.
- Q4, automatic tests for the holoml repository. a: GitHub Actions on
  Windows and Linux, as the browser has (recommended). b: none yet.

Assumed unless the owner says otherwise: the packages stay in the
repository and are not published to npm (publishing needs its own
approval); the spec text is CC BY 4.0 and the code Apache 2.0, as now.

### Tasks

- [x] 1. SPEC.md: the syntax, every element and attribute with its
      meaning, units and coordinates, links, errors, the media type, and
      the file extension; written like a small HTML spec, with examples.
- [x] 2. @holoml/parser: text to a node tree, with the line and column
      of every node, and clear errors; no dependencies.
- [x] 3. @holoml/schema: checks a tree against the spec (known elements,
      allowed children, attribute types such as numbers, vectors,
      colours, durations, and links) and lists every problem with its
      place.
- [x] 4. Conformance samples in conformance/: valid files with the tree
      each must give (JSON), and invalid files with the error each must
      give; every element and attribute has at least one sample.
- [x] 5. The same tool setup as the browser (pnpm workspace, TypeScript,
      Vitest, ESLint), and the README, AGENTS.md, and CONTRIBUTING.md
      updated with the commands that ran.
- [x] 6. GitHub Actions for the holoml repository (if Q4 a).
- [x] 7. examples/: a small showroom page, with a simple placeholder
      model made for the project (no third-party models), that the
      checker accepts; the real showroom is milestone 15.

### Software to install (holoml repository, with plan approval)

The same tools and versions the browser uses: typescript 6.0, vitest
5.0, eslint 10 with typescript-eslint 8, and @types/node; pnpm 12.4.1
pinned. Nothing at run time: the parser and checker have no
dependencies.

### Checks

| # | Check | Expected result |
|---|---|---|
| O1 | Spec | SPEC.md covers every element and attribute in v0.1, each with an example |
| O2 | Parser | Every valid sample gives exactly its expected tree, with positions |
| O3 | Errors | Every invalid sample fails with its expected error, line, and column |
| O4 | Checker | Wrong children, unknown attributes, and bad values (vectors, colours, durations, links) are each reported with their place |
| O5 | Coverage | Every element and attribute in the spec has at least one valid sample; a unit test enforces it |
| O6 | Round trip | Writing a parsed tree back out and parsing it again gives the same tree, for every valid sample |
| O7 | Speed | A 1 MB file parses in under 100 ms on the test machine |
| O8 | Automatic tests | Lint, types, and unit tests pass locally and (if Q4 a) on GitHub on Windows and Linux |
| O9 | Browser unchanged | The browser's checks still pass (only its documents change) |

### Results (2026-09-26)

| # | Result |
|---|---|
| O1 | Pass. SPEC.md describes every element and attribute, each element with an example; a unit test (spec.test.ts) holds its tables of error and problem codes, its element sections, and their attribute rows to the code |
| O2 | Pass. 11 valid samples give exactly their expected trees, with positions |
| O3 | Pass. 22 syntax-error samples each give their expected code, line, and column; the positions were counted by hand for every one, and the parser's own tests have hand-written expectations |
| O4 | Pass. 18 problem samples, covering every problem code, each give their expected problems and places |
| O5 | Pass. A unit test finds every element and attribute of the rules in a valid sample |
| O6 | Pass. Every valid sample written out by serialize() and read again gives the same tree (text compared with whitespace collapsed, as the spec shows it) |
| O7 | Pass. A 1.00 MB document reads in 22.0 ms (median of five, after a warm-up) on the Windows 11 test machine |
| O8 | Pass. Lint, types, and 105 tests clean locally; GitHub Actions run 36293453877 passed on Windows and Linux (105 tests each) |
| O9 | Pass. In the browser repository only documents changed; its 235 unit tests pass. The end-to-end checks were not rerun, since no code changed |

Found while building: an attribute value missing its closing quote was
first reported as a "<" inside the value, on the next line; it now has
its own error, unclosed-value, at the opening quote. Text in the wrong
place is reported at its first visible character, not at the whitespace
before it. Git on this machine converts line ends on commit
(core.autocrlf input), which would have turned the sample that tests
Windows line ends into a Unix one; the holoml repository's
.gitattributes keeps every .holoml file byte for byte.

### Done when

- O1 to O9 pass and the owner accepts. Then milestone 14 shows HoloML
  pages in the browser.

## Milestone 14 — HoloML pages in the browser

Status: Done. Accepted 2026-09-27 (prompt 76). Plan and build approved
2026-09-27 (prompt 65) with Q1 to Q5 a. Pushed before the
build. Rule 13 check done
(ARCHITECTURE.md section 3).

Goal: opening a HoloML page (a `.holoml` address) shows its 3D scene in
the browser, as HoloML 0.1 (the holoml repository's SPEC.md) describes:
models with their material changes, the viewpoint with orbit and walk,
lights, labels, links, and animation. Everything else keeps working
around it: tabs, history, bookmarks, back and forward, private tabs,
the shield, and the instrument panel.

### How it would work (proposed)

- A navigation whose response is a HoloML document (the `.holoml`
  extension, or the `model/vnd.holoml` media type) is shown by the
  browser's own HoloML viewer instead of as text or a download.
- The viewer runs inside that tab's page process, which is sandboxed
  like any web page, so a page's content never runs in the browser's
  own privileged process. It draws with Three.js, which the browser
  already has, including its glTF loader: no new package.
- The address bar, the tab, history, bookmarks, and reopened tabs all
  show and keep the page's own `.holoml` address.
- Models and the page itself load through the tab's own network
  session, so the shield, encrypted DNS, and private tabs apply as for
  any page.
- The scene draws only when something changes (moving the view, an
  animation, a model loading), like the room, so an idle scene costs
  nothing.

### Questions

- Q1, how a HoloML page appears. a: the scene fills the window below
  the top bar; the tilted panel and the room step aside while that tab
  is in front, and come back for other tabs (recommended: a 3D page
  shown in full, not flattened onto a tilted panel). b: on the tilted
  panel like any other page. c: merged into the room itself (not
  recommended: the page's content would have to run in the browser's
  own privileged process).
- Q2, where a page's models may come from. a: the page's own site only,
  for now (recommended: simple and safe; the showroom needs no more).
  b: any http or https site, with the shield blocking trackers as for
  other pages.
- Q3, HoloML files on the computer. a: open them too, with Ctrl+O (an
  Open file item in the menu) or by dragging a `.holoml` file onto the
  window; their models load only from the same folder and the folders
  inside it (recommended: people can try the examples without a web
  server). b: web pages only for now.
- Q4, how the browser gets the HoloML parser and checker. a: tag the
  holoml repository v0.1.0 and keep a copy of its two packages in this
  repository, made by a script from that tag, with a test that the copy
  still matches it (recommended: installs and builds need nothing new).
  b: pnpm installs them straight from the holoml repository on GitHub at
  the tag (a new install-time dependency on GitHub). c: publish them to
  npm (needs an npm account; a separate approval).
- Q5, mistakes in a page. a: a syntax error shows a card with the
  message, the line and column, and that line of the page; problems the
  checker finds are listed in the instrument panel's console, and the
  rest of the scene is shown (recommended: as browsers treat HTML). b:
  any mistake shows only the card.

Assumed unless the owner says otherwise: the layers view and page zoom
do not apply to HoloML pages (their buttons are off for them); Find in
page searches labels; printing a HoloML page prints what is on screen;
`view-source:` is not added in this milestone.

### Tasks

- [x] 1. The viewer: recognise HoloML responses, show them with the
      viewer in the tab's page process, keep the page's address
      everywhere (tab, address bar, history, bookmarks, reopening,
      restoring tabs).
- [x] 2. The scene: models (glTF 2.0) with position, rotation, scale,
      and material changes; groups; lights, with a soft default light
      when a page has none; the background.
- [x] 3. The viewpoint: orbit (drag, wheel, pinch) and walk (arrow keys
      and W, A, S, D, drag to look), with keyboard and touch
      equivalents; the start position and look-at point.
- [x] 4. Labels that face the viewer; links on models, groups, and
      labels (pointer, highlight, click or tap, and Tab and Enter from
      the keyboard); a model's own glTF animations (animation,
      autoplay); animate, with repeat and indefinite.
- [x] 5. Mistakes (per Q5), and safety: only http, https, and relative
      addresses; models only from where Q2 allows; no scripts.
- [x] 6. Files on the computer (if Q3 a).
- [x] 7. The parser and checker in the browser (per Q4).
- [x] 8. The HoloML showroom example as a test fixture, and screenshots.
- [x] 9. Documents: README, ARCHITECTURE, docs/privacy.md (what a
      HoloML page may load), the Testing section, and HANDOFF.

### Checks

| # | Check | Expected result |
|---|---|---|
| P1 | Opens | A `.holoml` page served from 127.0.0.1 shows its scene; the tab and title show its `<title>`; the address bar shows its address |
| P2 | Models | Each model loads in its place, turned and scaled as written; a material change sets the named material's colour, metalness, roughness, and opacity (read back from the scene) |
| P3 | Viewpoint | The view starts where the page says; orbit and walk move it with the mouse, the keyboard, and touch |
| P4 | Links | Clicking a linked model or label opens its page; Back returns; Tab and Enter reach links from the keyboard |
| P5 | Labels, lights, animation | Labels face the viewer; lights change what is lit; `animate` and a model's own animation move things over time and stop when they should |
| P6 | Mistakes | A syntax error shows the card with its line and column; problems appear in the instrument panel's console; the rest of the scene shows |
| P7 | Safety | A `javascript:` link and a model from a site Q2 does not allow are refused; the page cannot reach Node or the browser's own bridge; the shield counts blocked requests as for other pages |
| P8 | Browser features | History, bookmarks, reopening a closed tab, restoring tabs after a restart, and private tabs all keep the `.holoml` address |
| P9 | Files | (if Q3 a) A `.holoml` file opened from the computer shows its scene with models from its folder; a model outside that folder is refused |
| P10 | Efficiency | An idle scene draws no frames; an animated one draws only while it moves |
| P11 | Without WebGL 2 | A HoloML page says it cannot be shown, instead of an empty window (as N7) |
| P12 | Regression | C to O still pass, and the unit tests |

### Results (2026-09-27)

| # | Result |
|---|---|
| P1 | Pass. still.holoml shows its scene flat across the window beside the tab rail (fill on, rotation 0); the tab shows its title and address; zoom and the layers view are off for it. Pages known only by the media type (/holoml/by-type) or only by the address (as-text.holoml, sent as text/plain) open too |
| P2 | Pass. Models load in place, turned and scaled as written; Paint reads back #c0182a, metalness 0.7, roughness 0.3; Glass opacity 0.35; the other car keeps its own paint |
| P3 | Pass. Orbit: arrow keys, + and -, a mouse drag, the wheel, and a one-finger touch drag (sent through the page's own debugger connection) move the view around its point. Walk: W and the right arrow move at eye height; a drag and a touch drag look around |
| P4 | Pass. A click on a linked model and on a linked label opens its page; Alt+Left returns; Tab reaches a link and Enter follows it |
| P5 | Pass. Labels carry their text, also in the page for Find in page; the page's four lights are used, and a page without lights gets the soft default; animate turns a group and raises a label once; a model's own animation plays with autoplay and holds its first frame without |
| P6 | Pass. mistake.holoml shows the card with "Line 5, column 21" and the line; problems.holoml's three problems are in the instrument panel's console, and its model and labels still show |
| P7 | Pass. A model from another site is refused (and the page's content policy refuses a fetch to it); a javascript: link is not a link; the page has no require, process, or bridge; its model request passes through the shield's listener and shows in the network list |
| P8 | Pass. History records the page with its title; Ctrl+D bookmarks it; a closed HoloML tab reopens as a scene; tabs come back after a restart; a private tab shows a scene and adds no history |
| P9 | Pass. A file opened from the computer (through the test hook that stands in for the file chooser) shows its scene with the model from its folder; a model outside the folder fails; a link to another file in the folder works; a web page cannot navigate to a local address; an address with an unknown folder name asks to open the file again. Dropping a file is not automated (a test cannot drop a real file) |
| P10 | Pass. An idle scene draws no frames for 1.5 s; an animated one keeps drawing; one whose animation has finished stops |
| P11 | Pass. Without WebGL (test switch --test-no-webgl, now for pages too), a HoloML page says it cannot draw 3D scenes |
| P12 | Pass, with two exceptions that are issue #20. Full run: 186 of 189, then M7 passed on its own after its expected shortcut count went from 22 to 23 (the requirement changed: Ctrl+O opens a HoloML file, prompt 65, Q3 a; the unit test that Ctrl+O was unassigned changed the same way). F9 and I6 fail because the built-in filter lists are now more than a day old, as issue #20 reports; not caused by this milestone, and fixed in the issues pull request. Unit tests: 238 passed |

The viewer's first run already drew the scene; the one fault found was
that the orbit and walk controls captured the pointer on the wrapper
element, so a click never reached the canvas's link handler; they now
listen on the canvas itself.

### Done when

- P1 to P12 pass, screenshots are saved, and the owner accepts.

## Release path and milestone 12: owner's answers so far (2026-09-26, prompts 54 to 56)

- Release order (prompt 54): Windows and Linux first, macOS second,
  mobile later. Then (prompt 55): no installers for now; the browser is
  released as source for developers while the work follows the HoloML
  path.
- A a: milestone 12 is a small developer preview (automatic builds and
  tests on GitHub, contributor docs, legal and project files, an
  Electron upgrade, Linux checked from source, a version tag), then the
  HoloML milestones, then Windows and Linux installers, then macOS.
- B a: the source release is tagged 0.9.0, "developer preview"; 1.0 is
  installers plus HoloML.
- C a: GitHub Actions approved for automatic builds and tests on
  Windows and Linux (GitHub issue #5).
- E a: a recorded trademark search for the names and a check of the
  `.holo` extension, done now.
- F a: security reports through GitHub's private vulnerability
  reporting; no personal email published.
- Deferred until the installers milestone: Windows signing, Linux
  formats, updates, the Windows installer type (questions Q2 to Q5 of
  prompt 54).
- Legal identity (prompts 56 and 57): HyperSol the company no longer
  exists; this is a personal project, not marketed now. D1 a: copyright
  "The HyperSpace 3D Authors", with an AUTHORS file. D2 a: keep the name
  HyperSol HyperSpace 3D, with a README line that HyperSol no longer
  exists and this is a personal project honouring it. D3 a: outside
  contributions come under Apache 2.0's own terms, no paperwork. D4 a:
  the holoml repository the same ("The HoloML Authors").
- Privacy (prompt 58): P1 a (clean the current files, leave the history),
  P2 b (keep both founders' names in the README), P3 b (keep the commit
  email). HoloML (prompt 58): H1 a (HTML-like tags), H2 a (glTF 2.0
  models).

## Milestone 15 — HoloML hardening

Status: Done. Accepted by the owner 2026-09-27 (prompt 79). Plan
answered (prompt 77: Q1 to Q5 a, as recommended) and build approved
(prompt 78), 2026-09-27. Pushed before the build. Rule 13 check done
(ARCHITECTURE.md section 3).

Goal: HoloML pages stay safe and usable at any size and for anyone. A
heavy or hostile scene cannot exhaust memory or freeze the browser
(GitHub issue #23). A scene can be used without precise mouse movement,
without depth or motion, and with a screen reader (#25). An author can
see why a scene looks the way it does (#28).

### How it would work (proposed)

- Limits (#23). The viewer loads each model through its own counted
  fetch, including the files a glTF names (buffers, pictures), so every
  byte counts against the page's limits before anything is decoded.
  After decoding, it counts pictures' sizes and triangles. Proposed
  limits per page:
  - page text: 2 MB;
  - elements: 10,000;
  - models: 64;
  - one file: 32 MB;
  - all of a page's model files together: 128 MB;
  - one picture: 4096 by 4096 pixels;
  - triangles in all: 2 million;
  - a model that has not loaded after 30 seconds is given up.
- What a limit means (Q2): the model that crosses it is not shown and is
  marked where it would be. The rest of the scene shows, and a notice
  says what was left out and why.
- Stopping. Esc, or the top bar's stop button while models load, stops
  every pending load. Leaving the page disposes of everything; the
  browser's own controls live in another process and stay responsive
  whatever the page does.
- Keyboard and screen readers (#25):
  - Tab moves through the scene's links and named things (models,
    groups, and labels with an id or text), in the order the page lists
    them. The object in focus is outlined and its name is announced.
  - Enter follows a link; the arrow keys still move the view.
  - A text outline of the scene (title, each named thing with its label,
    and its links) is in the page for screen readers.
  - Focus stays on the same object when others appear or go; if its
    object goes, focus moves to the next one.
- Without depth and motion (Q3): with the system's "reduce motion" on,
  animations show their end state and the view moves without gliding. A
  "text view" switch shows the outline as a plain page: the same names
  and links, with no 3D.
- The inspector (#28, Q4): when a HoloML page is in front, the
  instrument panel gains a Scene part. It shows:
  - the scene's objects as a tree;
  - for the selected one, its line of the page's text, its bounds,
    position, rotation, and scale, and its triangles and picture sizes;
  - every problem and every model that failed or was left out, with its
    line and column.
  - A pick button lets a click in the scene select an object instead of
    following a link. All of it works from the keyboard.
  - The browser reads these facts from the viewer only for pages the
    main process marked as HoloML.

### Questions

- Q1, the limits. a: the ones above (recommended: roomy for a showroom
  of detailed cars, far below what freezes a machine). b: stricter
  (half of each). c: looser (double each).
- Q2, a model over a limit. a: it is left out and marked, the rest of the
  scene shows, and a notice says why (recommended, as the viewer already
  treats a model that fails). b: the whole page is refused, with a card.
- Q3, a flat view. a: reduced motion followed automatically, plus a text
  view switch (a top-bar button, and Ctrl+Shift+V) that shows the scene
  as a plain page of names and links (recommended). b: reduced motion
  and the screen-reader outline only, with no visible text view.
- Q4, where the inspector lives. a: a Scene part of the instrument panel,
  beside the page readouts, console, and network list (recommended: one
  place for developer tools). b: a panel of its own.
- Q5, what Tab reaches in a scene. a: links and named things, in page
  order (recommended). b: links only, as now.

### Tasks

- [x] 1. Limits: counted loading of models and the files they name,
      picture and triangle checks, the page's limits, the notice, and
      marks for what was left out.
- [x] 2. Stopping: Esc and the stop button while loading; everything
      disposed of when the page goes.
- [x] 3. Keyboard: Tab through links and named things, the focus
      outline, announcements, and focus kept steady.
- [x] 4. The outline for screen readers, and the text view (per Q3);
      reduced motion.
- [x] 5. The inspector's Scene part (per Q4): tree, selection and pick,
      source line, bounds, transforms, costs, and diagnostics.
- [x] 6. HoloML's own spec (holoml repository): a note that renderers
      may set resource limits, with the browser's as an example. Wording
      only; no change to the language.
- [x] 7. Documents: README, ARCHITECTURE, docs/privacy.md (nothing new is
      sent), the Testing section, HANDOFF; screenshots, and the README
      screenshot.

### Checks

Named R: Q is skipped, so that checks are not confused with the
questions.

| # | Check | Expected result |
|---|---|---|
| R1 | Oversized files | A model file over 32 MB, and a page whose models add up to more than 128 MB, are left out with a mark and a notice; the rest shows |
| R2 | Big pictures, many triangles | A 8192 by 8192 picture, and models over 2 million triangles in all, are left out the same way |
| R3 | Many elements | A page of 20,000 elements shows the first part and says the rest was left out; the browser stays responsive (a shell action answers within 200 ms, with a graphics card; drawn in software, measured and logged, prompt 96). Since the review of 2026-09-30, drawn in software the check reports "skipped", not "passed" |
| R4 | Slow and stopped | A model that never finishes is given up after 30 s; Esc and the stop button stop pending loads at once |
| R5 | Repeated visits | Ten visits back and forth between two heavy pages leave the page process's memory where it was after the first |
| R6 | Keyboard | Tab reaches every link and named thing in page order with a visible outline; Enter follows links; focus holds when objects appear or go |
| R7 | Screen readers | The accessibility tree has the outline: the page title, each named thing with its name, and each link with its text and address |
| R8 | Without motion | With reduced motion, animations show their end at once; the text view shows the same names and links as a plain page |
| R9 | Inspector | Picking an object shows its source line, bounds, transforms, and costs; problems and failed models are listed with line and column; it all works from the keyboard |
| R10 | Regression | C to P pass, the unit tests, and the HoloML conformance samples |

### Results (2026-09-27)

Checks are in tests/e2e/m15.e2e.ts; the large files are generated by
the fixture server (/holoml/gen/), so none is in the repository.

| # | Result |
|---|---|
| R1 | Pass. A model whose buffer is 40 MB is cut off at 32 MB, left out, and marked with the red box; the other model and the label show; the notice reads "One thing on this page was left out" with the reason. Five 30 MB models: exactly one is left out ("would pass 128 MB in all"), four load |
| R2 | Pass. A model naming an 8192 by 8192 picture is left out from the picture's header, before decoding. Two models of 1.2 million triangles each: one loads, the other is left out ("would pass the page's 2,000,000") |
| R3 | Pass. A page of 20,000 empty groups after a label shows its first label and says the elements past 10,000 were left out; the shell answered every call within 200 ms while it loaded |
| R4 | Pass. A model that never answers: the top bar's stop button and Esc each leave it out within 2 s ("stopped before it finished loading"), and Reload comes back; left alone, it is given up after 30 s ("still loading after 30 s") |
| R5 | Pass. Ten visits back and forth between two pages of three 20 MB models each: the page process's memory after a garbage collection stays within 40 MB of where it was after the first visit |
| R6 | Pass. Tab goes through still.holoml's seven links and named things in page order, each outlined in the scene; Shift+Tab goes back; Enter on "More cars" follows it. On a page whose model is stopped, focus stays on the item it was on; if its own model goes, focus moves to the next item |
| R7 | Pass. The page's accessibility tree has the title as a heading, the "Scene outline" navigation, each named thing as a button, and both links with their text; their addresses are the links' |
| R8 | Pass. The text view (top-bar button; Ctrl+Shift+V in the page and in the shell) hides the 3D view and shows the same names and links as a plain page. With reduced motion (emulated through the page's debugger), a label's rise is at its end at once, and the turning group and the model's own animation stand still |
| R9 | Pass. With Pick on, a click on the car shows "Line 11, column 5", the line itself, bounds, position 0, 0, 0, rotation 0°, 30°, 0°, scale, and triangles; a click on a linked model selects it without following the link. The refused model is listed as "25:5 model far refused". Enter, the arrow keys, End, and Space work the tree and the Pick button. The Scene part goes away on an ordinary page |
| R10 | Pass, with one timing note. Full run: 209 of 212. P9 had caught a real fault: a model file that could not be fetched was reported as "left out" instead of "failed"; fixed, and P9 passes. C9 (43 frames a second, needs 50) and L9 (main process held 20.005 ms, needs under 20) failed while other work ran on the machine; rerun alone, both pass. L9's measure sits at 18 to 20 ms on this machine with or without this milestone (19.5 ms twice on the previous commit), so it is close to its limit. Unit tests: 250 passed; lint and type check clean. HoloML's own tests with its conformance samples (holoml repository, spec branch): 122 passed |

Changed checks (their requirement changed with this milestone): P4's
Tab test now presses Tab until the link, since Tab also reaches named
things first (Q5 a).

Two faults were found and fixed along the way: models loading side by
side could pass the triangle limit together (the triangles are now
held at the check), and a model left out kept counting against the
page's 128 MB until the others had also crossed it (now released at
once). Both have unit tests (viewer/budget.test.ts) that failed before
the fix. HoloML's spec note (task 6) is in holoml pull request #7
(https://github.com/srajpal/holoml/pull/7), opened on acceptance.

### Done when

- R1 to R10 pass, screenshots are saved, and the owner accepts.

## Milestone 16 — Car showroom demo

Status: Done. Accepted by the owner 2026-09-27 (prompt 83), after
checking it on their own computer. Plan answered (prompt 81: Q1 to Q5
a, as recommended) and build approved (prompt 81), 2026-09-27. Pushed before the build. Rule 13 check done
(ARCHITECTURE.md section 3).

Goal: a small HoloML site that shows what HoloML 0.1 can do, the one the
brief describes: a showroom where every car is a 3D model you walk
around, with labels, links, lights, materials, and animation, written in
plain markup. It replaces the placeholder example in the holoml
repository and becomes the browser's showcase.

### How it would work (proposed)

- The site, in the holoml repository under examples/showroom/:
  - The hall (index.holoml): five cars on plinths under spot lights,
    the middle one on a slowly turning turntable, each with a label of
    its name and one line about it. Car names are made up; no real
    makes or logos.
  - A page per car (for example comet.holoml): the car on its own, in
    walk mode, with links to its colour pages and back to the hall.
  - Colour pages (comet-blue.holoml and so on): the same car with
    another paint, set with `<material>`. HoloML 0.1 has no scripts, so
    each colour is its own page.
  - An about page: what HoloML is, with links to the spec and both
    repositories.
- The hall itself (floor, plinths, back wall) is a glTF model written by
  a script in the repository, as the placeholder car is now, so it is
  ours to license.
- The cars come from an openly licensed pack (Q2), with its licence file
  and credits kept beside them.
- Budget: the whole site well inside the milestone 15 limits (proposed
  target: under 10 MB and 200,000 triangles for the hall), so it opens
  in a moment on an ordinary computer.
- The browser's tests use a copy of the site, brought in the way the
  HoloML packages are (`pnpm holoml:sync` from a tag), served from
  127.0.0.1 like every other fixture.
- Anything the site needs that HoloML 0.1 cannot say (for example
  shadows, a paint choice without separate pages) is written down, not
  added (Q4).

### Questions

- Q1, where the site lives and how people reach it.
  a: in the holoml repository, published with GitHub Pages at
  srajpal.github.io/holoml/showroom/ (free static hosting on the GitHub
  account both repositories already use), and the browser's start panel
  gets a "HoloML showroom" link to it (recommended: anyone with the
  browser can try it, and the source sits next to the language). The
  browser sends nothing unless the person clicks the link.
  b: in the holoml repository only, not published: opened from the
  computer with Ctrl+O. No hosting.
  c: built into the browser, opened from the start panel with no
  network at all (a larger app, and a second copy to keep in step).
- Q2, the car models.
  a: Kenney's Car Kit (kenney.nl, CC0: no conditions; 45 low-poly
  vehicles in one style, small files). Recommended: one consistent look,
  tiny files, nothing to credit by law (credited anyway). If the kit has
  no glTF files, I come back to you before converting anything.
  b: Kenney's kit for the hall, plus the Khronos ToyCar (CC0, one
  detailed car with clear-coat paint and glass) as the car on the
  turntable. Nicer centrepiece; two styles side by side.
  c: our own cars written by a script, like the placeholder: fully ours,
  but plain boxes and wheels.
  (Either a or b means downloading those files from kenney.nl or
  GitHub; your answer is the approval for that download.)
- Q3, how much site.
  a: the hall, a page per car, colour pages, and the about page
  (recommended).
  b: the hall and one car page only.
- Q4, what HoloML 0.1 cannot do.
  a: stay within 0.1; each gap goes into the holoml repository as an
  idea for 0.2 (an issue each), with the page that needed it
  (recommended: the demo proves the language as it is).
  b: extend the language in this milestone (a 0.2 draft).
- Q5, the README's opening screenshot.
  a: switch it to the showroom in the browser, taken from the local
  copy (so that shot no longer uses the network), and change the README
  note in AGENTS.md's working agreement to say so (recommended: it
  shows the project's own work). Proposed wording: "The README always
  opens with a screenshot of the newest version or milestone, and a
  good-looking one: refresh docs/screenshots/readme.png with `pnpm
  screenshots:readme` at the end of each milestone and each release,
  and look at it. It shows the HoloML showroom (milestone 16), served
  locally."
  b: keep the Wikipedia shot.

### Tasks

- [x] 1. The hall model: a script that writes the floor, plinths, and
      back wall as glTF.
- [x] 2. The cars (per Q2): download, check the licence and the files,
      choose five, keep the licence and credits beside them, and find
      each car's paint material by name.
- [x] 3. The pages (per Q3): hall, car pages, colour pages, about; the
      holoml repository's tests check that every page is valid.
- [x] 4. The browser's copy: `pnpm holoml:sync` also brings the
      showroom into the test fixtures; end-to-end checks S1 to S7.
- [x] 5. Publishing (per Q1): GitHub Pages for the holoml repository and
      the start panel link (Q1 a), or the instructions to open it (b).
- [x] 6. The gaps (per Q4): an issue per missing feature in holoml.
- [x] 7. Documents: both READMEs, ARCHITECTURE, docs/privacy.md (the
      start panel link, if Q1 a), credits, HANDOFF; screenshots and the
      README screenshot (per Q5).

### Checks

| # | Check | Expected result |
|---|---|---|
| S1 | Valid pages | Every showroom page passes HoloML's checker with no problems (holoml unit tests) |
| S2 | Loads whole and fast | The hall is ready within 5 s from 127.0.0.1 with a graphics card (drawn in software, measured and logged instead, prompt 95); no model is left out or fails; the Scene part's totals are under the budget. Since the review of 2026-09-30, drawn in software the check reports "skipped", not "passed" |
| S3 | Walk around | Each car page starts in walk mode; walking moves around the car at eye height |
| S4 | Links and colours | Every link reaches its page and Back returns; each colour page shows its paint (the material's colour read back) |
| S5 | For everyone | Tab reaches every car by name; the text view lists the cars and links; with reduced motion the turntable stands still |
| S6 | Efficient | An idle car page draws no frames; the hall draws only while the turntable turns. Since the review of 2026-09-30, drawn in software the check reports "skipped", not "passed" |
| S7 | Credits | The models' licence and credits are in the repository and shown on the about page |
| S8 | Published (Q1 a) | The site opens from its public address, and the start panel link opens it (checked by hand: the tests stay on 127.0.0.1) |
| S9 | Regression | C to R pass, the unit tests, and HoloML's tests |

### Results (2026-09-27)

The showroom is in holoml pull request #12
(https://github.com/srajpal/holoml/pull/12), merged by the owner. The
browser's copy (tests/fixtures/holoml/showroom) is synced from holoml's
main at the merge commit (`pnpm holoml:sync v0.1.1 --showroom main`).
Checks are in tests/e2e/m16.e2e.ts.

| # | Result |
|---|---|
| S1 | Pass. holoml's tests: all 21 pages valid; every link and every material a page changes exists; the hall under 10 MB and 200,000 triangles; the credits present. 139 passed; lint and types clean |
| S2 | Pass. The hall is ready within 5 s from 127.0.0.1; all 11 models (hall, five plinths, five cars) load; no problems, nothing left out; the Scene part's totals are about 0.8 MB and 13,000 triangles |
| S3 | Pass. Each car page starts in walk mode at 1.7 m; holding W walks more than 0.3 m at the same height |
| S4 | Pass. A mouse click on the Quellis in the hall opens its page (paint #c8243a); Tab and Enter open "Ocean blue" (#2c5fbf); Alt+Left returns; "Back to the hall" goes to the hall. All five cars' three colour pages load with their paint |
| S5 | Pass. Tab reaches the five cars by name and "About this showroom", each outlined; the text view lists the cars, their lines, and the title; with reduced motion the turntable stands still |
| S6 | Pass. The hall keeps drawing while the turntable turns (at least 10 frames a second with a graphics card; in software only that it draws, as C9 and G9); an idle car page draws no frames for 1.5 s |
| S7 | Pass. The about page credits "Kenney's Car Kit (kenney.nl, CC0)" and links to the spec; models/CREDITS.md is in the copy |
| S8 | Pass after a fix. The start panel's "Try HoloML" link points to https://srajpal.github.io/holoml/showroom/index.holoml, and with the test switch it opens the local copy. After the merge the owner opened the published site in a development run (`pnpm dev`) and it stayed blank (prompt 82): the viewer's script came back as the dev server's HTML page. In development runs the viewer is served by the renderer's dev server, whose root is the shell's folder, so the viewer's address was wrong there, and the modules it imports could not come through the viewer's scheme; HoloML pages had never worked in `pnpm dev` (every test and screenshot uses the built app). Fixed in main/holoml.ts: in development runs every viewer request goes to the dev server, the entry by its file path. A new check starts the dev server on its own and points the built app at it, offline: the showroom draws (it timed out without the fix). The published site, opened once by hand in the built app, draws with all 11 models and no problems |
| S9 | Pass. Full run: 222 of 222 end-to-end checks (C to S). After the development-run fix (S8), the HoloML files (M14 to M16, now 47 checks with the new one) passed again. Unit tests: 252 passed; lint and type check clean |

Faults found along the way and fixed: HoloML pages in development runs
(see S8); and after focus moved into a page,
Chromium scrolled the layer that holds the pages, so the page was drawn
away from where the room placed it (a HoloML page opened from the
start panel sat 89 pixels left, over the tab rail). The layer is now
`overflow: clip`; m16.e2e.ts checks the drawn page against the room's
placement, and that check failed before the fix (209 pixels off).

HoloML 0.1 gaps filed as ideas for 0.2 (Q4 a): holoml issues #8
shadows, #9 changing a material in place, #10 walk mode that stops at
walls, #11 text of more than one line.

The README's screenshot is now the showroom, served locally
(tests/screenshots/readme.capture.ts); the Wikipedia run and the test
harness's `online` switch are gone, so no run uses the network.

### Done when

- S1 to S9 pass, screenshots are saved, and the owner accepts.

## Milestone 17 — Blockworld, HoloML 0.2 (first part), and the examples section

Status: Done. Accepted by the owner 2026-09-27 (prompt 91). Plan
answered (prompt 86: Q1 to Q5 a, as recommended) and build approved
(prompt 86), 2026-09-27. Pushed before the build and after acceptance.
Rule 13 check done (ARCHITECTURE.md section 3). Results below.

Goal: the first HoloML site you can play. Blockworld, a very small
Minecraft-like game, needs HoloML to react (scripts), to make sound,
to stop the walker at walls and keep them on the ground, to animate
lights, and the browser to draw thousands of blocks cheaply. And the
browser gets a place to find and try every HoloML example, with a
screenshot of each.

### How it would work (proposed)

- **HoloML 0.2, first part** (holoml repository: SPEC.md, parser,
  checker, conformance samples). A page says `version="0.2"`; every 0.1
  page stays valid, and a 0.1 reader refuses 0.2 pages, as the spec
  already requires.
  - `<script src="game.js" />` in `head`: JavaScript from the page's
    own site (never inline, never another site), run after the scene is
    shown, in the page's own sandboxed process, like any web page's
    script. It gets a small scene API, `holoml` (Q1): find elements by
    id; read and change position, rotation, scale, visibility, a
    material's colour, a light's colour and brightness, and a label's
    or screen text's words; add elements from HoloML text (checked, and
    counted against the page's limits) and remove them; events: click
    and right-click (with the element, the point, and the face hit),
    keys, and every frame (with the time since the last); play and stop
    sounds; where the viewer is and looks.
  - `<sound id src loop volume />`: a sound file (Ogg, MP3, or WAV) to
    play from a script or with `autoplay`. Nothing plays before the
    viewer's first click or key on the page (prompt 85, Q5 a); the
    tab's mute applies; sound files count against the page's limits
    like models.
  - `<hud>`: a few lines of text fixed to a corner of the screen (the
    game's score and chosen block), which scripts can change; read by
    screen readers and shown in the text view.
  - Walls and gravity (holoml issue #10): a `solid` flag on `model`
    and `group`; the walker cannot pass through solid things. On
    `viewpoint`, `gravity` (the walker falls to the ground below and
    stands on solid things) and `jump` (Space jumps).
  - `animate` can also change a light's `intensity` and `color`, a
    light's `position`, and the scene's `background`, so a day can turn
    into night.
- **The browser** renders 0.2 pages. The content policy of HoloML
  pages also allows scripts from the page's own site. Models used many
  times with the same materials are drawn as one (instancing), so an
  island of a few thousand blocks stays smooth. A page's script that
  never stops cannot stop the browser: its controls, Stop, and closing
  the tab keep working, as for any web page.
- **Blockworld** (holoml repository, examples/blockworld/, published
  with GitHub Pages like the showroom). An island of about 24 by 24
  blocks and 8 high, made by the page's script from a seed: grass,
  dirt, stone, sand, wood, leaves, water, and a few trees.
  - Walk with gravity; Space jumps; blocks stop you.
  - Click a block to break it (a short crack animation and a sound);
    right-click to place the chosen block on the face you clicked;
    keys 1 to 5 choose the block. From the keyboard, E breaks and Q
    places the block under the crosshair in the middle of the view.
  - A day lasts about four minutes: the sun moves and changes colour,
    the sky darkens, and night falls. Torches (block 5) give light.
  - Five gems are hidden in the stone; bring them to the chest and the
    screen text says you won.
  - Sounds: footsteps, breaking, placing, a gem, winning (Kenney's CC0
    sound packs); birds by day and crickets at night (Q3).
  - The blocks are small models made from Kenney's CC0 Voxel Pack
    textures by a script in the repository.
- **The examples section** (prompt 85): a panel, "HoloML examples",
  like the Library, opened from the start panel's "Try HoloML", from
  the menu, and with Ctrl+Shift+E (Q2). A card for each example: its
  screenshot, its name, a line about it, and Open. For now: the
  showroom and Blockworld; each later example milestone adds its card.
  The screenshots are part of the browser (made by `pnpm screenshots`
  from the local copies), so the panel fetches nothing; an example's
  site is asked for only when Open is clicked. Keyboard and screen
  readers can use it like the other panels.

### Questions

- Q1, the scene API. a: a small `holoml` object (find, change, add,
  remove, events, sound, screen text), written down in the spec with an
  example for each part (recommended: small enough to learn in an
  afternoon, and the browser can check everything a script asks for).
  b: a DOM-like API over HoloML elements, like HTML's
  `document.querySelector` (familiar, but much larger to specify and to
  keep safe).
- Q2, the examples section. a: a panel like the Library, opened from
  the start panel, the menu, and Ctrl+Shift+E, with a card per example
  (recommended: room for screenshots and descriptions as the list
  grows to six). b: the cards shown directly on the start panel, below
  Recent.
- Q3, birds and crickets. Kenney's CC0 packs have effects but no
  outdoor ambience. a: made by a script in the repository (simple
  generated chirps and trills; ours, no download) (recommended). b: CC0
  recordings from Freesound or OpenGameArt, credited (another source,
  so it needs your approval). c: no ambience.
- Q4, looking around in Blockworld. a: drag to look, as walk mode does
  now, with a crosshair in the middle for the keyboard (recommended:
  the mouse is never captured). b: pointer lock, as most first-person
  games do: the mouse turns the view until Esc.
- Q5, HoloML versions. a: this is the first part of HoloML 0.2; the spec
  grows with each example milestone (17 to 21), pages written for it
  say `version="0.2"`, and 0.2 is tagged when milestone 21 ends
  (recommended: one version for the features the examples need). b:
  0.2 is finished and tagged at the end of milestone 17; later
  features become 0.3, 0.4, and so on.

### Tasks

- [x] 1. HoloML spec 0.2 (first part): scripts and the scene API,
      sound, screen text, walls and gravity, animated lights and
      background; parser and checker; conformance samples for each new
      element, attribute, and problem; 0.1 pages unchanged.
- [x] 2. The browser: 0.2 pages, the scene API, sound (after the first
      interaction, with the tab's mute and the limits), screen text,
      collision and gravity, animated lights, instancing; the content
      policy; the copy of the parser and checker (`pnpm holoml:sync`).
- [x] 3. Blockworld: the block models and sounds (downloads approved in
      prompt 85, Q3 a), the ambience (per Q3), the page and its script,
      credits; published with GitHub Pages.
- [x] 4. The examples section (per Q2), with the showroom's and
      Blockworld's cards and screenshots.
- [x] 5. Checks T1 to T10 (tests/e2e/m17.e2e.ts, the holoml repository's
      tests).
- [x] 6. Documents: both READMEs, SPEC, ARCHITECTURE, docs/privacy.md
      (scripts and sound on HoloML pages; the examples section fetches
      nothing), THIRD-PARTY, AGENTS testing, HANDOFF; screenshots and the
      README screenshot.

### Checks

Named T (milestone 16 used S).

| # | Check | Expected result |
|---|---|---|
| T1 | The language | holoml's tests: every new element, attribute, and problem has a conformance sample; all 0.1 samples and examples still pass; a 0.2 page read as 0.1 is refused |
| T2 | Scripts | A page's script from its own site runs and changes the scene through the API; an inline script, or one from another site, does not run, and the console says why; a script error is shown in the console and the scene stays; a script that never stops leaves the browser's controls answering within 200 ms (with a graphics card; drawn in software, measured and logged, prompt 96), and closing the tab works. Since the review of 2026-09-30, drawn in software the check reports "skipped", not "passed" |
| T3 | Sound | Nothing plays before the first click or key; after it, a sound plays (checked through the page's audio state); the tab's mute silences it; a sound file over the limits is left out like a model |
| T4 | Walls and gravity | The walker falls to the ground, stands on blocks, jumps with Space, and cannot pass through solid blocks or walk through the chest |
| T5 | Many blocks | Blockworld's island (several thousand blocks) loads within 5 s from 127.0.0.1 and draws at 30 frames a second or more, both with a graphics card (drawn in software, as on GitHub's machines, both are measured and logged instead: the frame rate as C9, prompt 59; the load time since prompt 95). Since the review of 2026-09-30, drawn in software the check reports "skipped", not "passed" |
| T6 | Playing | Breaking and placing by mouse and by keyboard; keys 1 to 5 change the block shown on screen; picking up a gem counts it; five gems in the chest show "You won"; night comes and a torch lights its surroundings |
| T7 | For everyone | Blockworld can be played from the keyboard alone; the screen text is in the text view and the accessibility tree; with reduced motion the day stands still at noon |
| T8 | The examples section | Opens from the start panel, the menu, and Ctrl+Shift+E; shows the showroom and Blockworld with their screenshots; Open goes to the example's address (a local copy in the test); usable from the keyboard; opening the panel fetches nothing (no unexpected traffic) |
| T9 | Published | Blockworld opens from its public address in the built app (checked by hand, as S8) |
| T10 | Regression | C to S pass, the unit tests, and holoml's tests |

### Results (2026-09-27)

HoloML 0.2's first part and Blockworld are in holoml pull request #13
(https://github.com/srajpal/holoml/pull/13), merged by the owner
(prompt 90); GitHub Pages publishes Blockworld at
https://srajpal.github.io/holoml/blockworld/. The browser's copy
(packages/holoml and tests/fixtures/holoml) is synced from holoml's main
at the merge commit (`pnpm holoml:sync main --examples main`, 64d7e99),
the same files as the branch the checks ran on. Checks are in
tests/e2e/m17.e2e.ts.

| # | Result |
|---|---|
| T1 | Pass. holoml's tests: 165 passed; lint and types clean. Every new element, attribute, and problem has a conformance sample (four valid 0.2 samples, five problem samples) and is in SPEC.md with an example (the tests check both); every 0.1 sample gives the result it gave before; a 0.2 page read by a 0.1 reader is refused (unsupported-version); the showroom's and Blockworld's pages are valid, and Blockworld's files stay under 2 MB, with their credits |
| T2 | Pass (4 checks). A script from the page's own site changed the scene through the API: a label's words, a light's intensity, screen text, a model added from HoloML text (solid, in its group), and one removed; a wrong argument throws a clear error, and holoml.add refuses `<animate>` with a console message. An inline script and a script from another site did not run, and the console said why. A script that throws leaves the scene as it was. With a script that never stops, the browser answered each of 10 requests within 200 ms, and the tab closed |
| T3 | Pass. Before the first input nothing played and the browser kept the tab muted; after a click in the page the sound played, and the tab was unmuted and audible; the tab's own mute silenced it. A sound file over 32 MB was left out ("larger than 32 MB") and listed with what was left out |
| T4 | Pass (2 checks). On a page built from Blockworld's blocks (walls.holoml) the walker fell to the floor, stopped at a wall, was stopped by a step, jumped onto it with Space, and passed through leaves (not solid). In Blockworld the walker stands on the chest's lid |
| T5 | Pass. Blockworld was ready within 5 s of opening from 127.0.0.1, with more than 1,000 blocks drawn as instances in fewer than 60 draw calls, at more than 30 frames a second with the graphics card. Measured during the build: ready in about 2.2 s, about 1,160 blocks shown (only blocks with a face that can be seen are added; the rest of the island is kept by the script), 14 draw calls, about 143 frames a second |
| T6 | Pass (3 checks). A click broke a block and a right-click placed one; E broke and Q placed the block under the crosshair; keys 3 and 1 changed the screen text ("Placing: Stone", "Placing: Grass"), and after key 4 Q placed planks. Digging with E found all five gems (the count went from 1 to 5), and E at the chest put them in: "In the chest: 5 of 5" and "You won". At 22:00 the sun gives no light, and a torch placed with Q stands on the block with its light on; at least a quarter of the view is 30% brighter with the torch's light than without it (the page's own pixels, from a view that stands still) |
| T7 | Pass (3 checks). From the keyboard alone: the left arrow turned the view without moving it, Page Down looked down, and E broke the block under the crosshair; walking (W), jumping (Space), placing (Q), and choosing blocks (1 to 5) by key are in T4 and T6. The screen text is in the text view ("Gems carried", "Placing") and the accessibility tree (the score and the clock). With reduced motion the clock reads "Day 1, 12:00 (the clock stands still)" and stays |
| T8 | Pass. The examples section opened from the start panel, the menu, and Ctrl+Shift+E; it shows the showroom and Blockworld with their pictures, and links to HoloML's repository, its specification, and each example's source; the keyboard reaches Blockworld's Open, and Enter opened the local copy in the tab; opening the section fetched nothing |
| T9 | Pass. After the merge, Blockworld opened in the built app from https://srajpal.github.io/holoml/blockworld/index.holoml (a one-off run with the network, not a test, as S8): HoloML 0.2, ready, every model and all nine sounds loaded, nothing left out, 1,161 blocks and five gems, and it draws the island with its trees and the chest |
| T10 | Pass. Full run on the finished code, after the report's changes (prompt 89): 240 of 240 end-to-end checks passed (C to T), the clipboard checks included. In the first full runs that day the Windows clipboard was unavailable to every program (PowerShell's Get-Clipboard failed too), and the 4 checks that use it failed there: D8's copy link, copy text, and paste, and the passwords check K2 and K3; they passed once it worked again. One earlier full run also missed milestone 10's L9 budget by 0.02 ms (the main process held 20.02 ms against 20) while a type check ran alongside; it passed alone and in the final run. Unit tests: 261 passed; lint and type check clean; holoml's tests: 165 passed |

Faults found along the way and fixed:
- Walk mode could not turn or look up and down from the keyboard, so
  Blockworld could not be played without a mouse (T7). The left and right
  arrows now turn (they moved sideways before; A and D still do), and
  Page Up and Page Down look up and down, in every HoloML version.
  Milestone 14's P3 check moved sideways with the right arrow; it now
  uses D, and also checks that the right arrow turns without moving and
  that Page Up looks up. The requirement (walk moves with the keyboard)
  is unchanged; SPEC.md now asks renderers for keyboard turning.
- Blockworld's torches were toned down (light 1.6 to 0.9) for a darker
  night during the build, after T6 was written to check a light above 1.
  T6 now checks what the requirement says, that the torch lights its
  surroundings, by comparing the view with and without its light.
- Found while building: a finished animation kept the page drawing;
  the walker could hang in the air after the block under it was broken;
  the crosshair used the camera's place from the frame before; instanced
  blocks were picked with stale bounds, so gems 2 to 5 could not be
  found; night stayed bright because the scene's soft environment light
  ignored the page's lights (it now follows the ambient lights in 0.2
  pages); a development run missed a module the viewer loads late.

The examples section's pictures come from `pnpm screenshots:examples`
(the showroom's hall, and Blockworld's island from a pillar of stone at
one corner); the milestone's screenshots are 49 to 52 in
docs/screenshots/m17. The README's screenshot stays the showroom, as
AGENTS.md says (prompt 81, Q5 a).

Prompt 87 (elements for moving between scenes and for loading): proposed
for the Harbour Loft and Coral Bay plans, below.

After the report (prompts 89 and 90):
- The owner's answers: the left and right arrows keep turning; the card
  fix below is approved; the README's screenshot stays the showroom.
- "Blockworld does not load in `pnpm dev`": the start panel and the
  examples section open Blockworld's published address, and pull request
  #13 was still open on GitHub when the owner tried (holoml's main ended
  at the showroom), so that address did not exist yet. The development
  run itself was not at fault: a new check starts the dev server and
  points the built app at it, offline, and Blockworld's local copy
  plays, its script and all. The owner then merged #13 (prompt 90).
- The card fix: a HoloML page finishes loading before its models arrive,
  so its tab card's picture showed an empty room or only its labels
  (the README's screenshot showed it). The viewer now says when it has
  drawn the scene with nothing left to load and the view still (a walker
  that starts in the air has landed), after the scene is ready and after
  each later loading such as a script's models; the shell takes the
  card's picture again then. A new check opens a page whose car arrives
  two seconds late: the card's first picture has no car, and a later one
  shows its red paint. Without the fix it failed (the car never reached
  the card). Screenshots 51 and 52 set the viewer's place and direction
  together, so the card, which takes its picture when the viewer lands,
  shows the same view.

### Done when

- T1 to T10 pass, screenshots are saved, and the owner accepts.

### Later example milestones (outline; each gets a full plan in turn)

- 18 Sofa studio: material choices in place (#9), shadows (#8),
  environment lighting, textured fabrics (Poly Haven), a price that
  changes.
- 19 Harbour Loft: click actions without scripts (doors, switches),
  paragraphs of text (#11), larger scenes, a floor plan. Proposed for
  its plan (prompt 87): moving between pages as between rooms, a link
  to a named viewpoint on the next page (`href="kitchen.holoml#window"`)
  and a transition (a short fade instead of a cut).
- 20 Sneaker store (in place of Coral Bay, prompts 101 and 102): a wall
  of sneakers to pick up, turn, and see up close (the sole, the laces),
  in their colourways (choices) and sizes, a cart across shoes, and a
  checkout page (no real payment). From Coral Bay's list, loading by
  area: proposed for its plan (prompt 87), areas that load their models
  when the viewer comes near and let go of them when far, counted
  against the page's limits only while loaded, a simpler model to show
  far away, and loading progress a page's script can show. Open
  question for its plan: good CC0 shoe models (prompt 85, Q3 a allows
  CC0 only; CC BY ones, credited, would need the owner's approval).
- 21 Aquarium (prompt 85): 5 to 10 real-looking fish of different
  kinds that swim around the tank with their own animations (glTF
  skins), rocks, plants, bubbles, light through the water, and a Feed
  button: food falls and the fish swim to it and eat. It may take
  movement along paths, from Coral Bay's list, for the fish (prompt
  102). Open question for
  its plan: CC0 packs have few real-looking fish; if there are not
  enough, CC BY models (credited) would need the owner's approval, as
  prompt 85's Q3 a allows CC0 only.

## Milestone 18 — Sofa studio, with walking speeds and sliders

Status: Done. Accepted by the owner on 2026-09-28 (prompt 112), after
browser pull request #35 merged. Part 1 (walking and turning speeds, and sliders)
approved by the owner and built, 2026-09-27 (prompt 92), in browser pull
request #34 with the fixes for GitHub's Linux machines. Part 2, the sofa
studio, the milestone's example site: planned below (prompt 97); the
owner answered Q1 to Q6 with the recommendations and approved the build
(prompt 98); built, see Part 2 results. The owner merged #34 and holoml
#15 (prompt 99); the studio is published. Pushed before the
milestone (after milestone 17's acceptance). Rule 13 check done
(ARCHITECTURE.md section 3).

### Part 1: walking and turning speeds, and sliders (prompt 92)

Walking felt slow in Blockworld (prompt 91): it was fixed at 2.2 metres
a second, and nothing in HoloML could change it. The owner asked for a
speed setting, a slider in the game to change it, so that the game's
code shows how to use it, and faster turning with it (prompt 92).

- HoloML 0.2 (holoml pull request #14): `speed` (metres a second, 0.5 to
  10, default 2.2) and `turn-speed` (degrees a second, 10 to 720, default
  90) on `viewpoint`; `slider`, a number the viewer chooses on the
  screen (`min`, `max`, `step`, `value`, a corner, and its label); in
  the scene API, `holoml.viewer.speed` and `turnSpeed`, slider things
  (`value`, `min`, `max`, `step`, `text`), and the `change` event.
- The browser: walk mode goes at the page's speeds; looking up and down
  from the keyboard goes as fast as turning (it was a little slower,
  69 degrees a second). A slider is the page's own range control in its
  screen corner, so the mouse, touch, the keyboard, and screen readers
  use it as on any web page, and the text view shows it; while it has
  the keyboard it keeps only its own keys (arrows, Home, End, Page Up,
  Page Down), so the other keys still walk and reach the page's script.
- Blockworld walks at 4.3 metres a second (Minecraft's walking pace)
  and turns at 120 degrees a second; its Speed slider, under the block
  choices, goes from half to twice both, and the "Speed" part of
  game.js shows how.

Tasks:

- [x] 1. The language: SPEC.md, the checker, conformance samples
      (holoml).
- [x] 2. The browser: the speeds, the slider, the scene API; the copy of
      the parser and checker (`pnpm holoml:sync`).
- [x] 3. Blockworld's speeds and Speed slider; its picture in the
      examples section.
- [x] 4. Checks U1 to U7 (tests/e2e/m18.e2e.ts, holoml's tests).
- [x] 5. Documents.

Checks (named U; milestone 17 used T):

| # | Check | Expected result |
|---|---|---|
| U1 | The language | holoml's tests: `speed`, `turn-speed`, and `slider` have valid and problem samples; the checker reports speeds out of range, a `max` not above `min`, and a `value` outside the range; a 0.1 page may not use them |
| U2 | Walking speed | A page's `speed` is how fast the viewer walks (within 20%, measured while the key is held); a 0.2 page that says nothing walks at 2.2 metres a second and turns at 90 degrees a second |
| U3 | Turning speed | A page's `turn-speed` is how fast the arrow keys turn the viewer (within 20%), without moving them |
| U4 | Scripts | `holoml.viewer.speed` and `turnSpeed` can be read and set, and change how fast the viewer goes; a value out of range is an error and changes nothing |
| U5 | Sliders | In their corners, with their labels, and the defaults SPEC.md gives; the keyboard (arrows, Home, End) and the mouse move them, and the script hears `change`; a script's `value` moves a slider without an event, and a value out of range is an error; while a slider has the keyboard it keeps its own keys and the others still walk; a click on it is not a click in the scene; screen readers find it, named by its label; the text view shows it |
| U6 | Blockworld | 4.3 metres a second and 120 degrees a second; its Speed slider sets both from half to twice, and its label follows |
| U7 | Regression | The HoloML checks (milestones 14 to 17), the unit tests, and the full end-to-end run |

### Part 1 results (2026-09-27)

The owner merged holoml pull request #14 (prompt 97); the browser's
copy is synced from holoml's main at the merge commit (`pnpm holoml:sync
main --examples main`, 12847d3), the same files as the branch the checks
ran on. Checks
are in tests/e2e/m18.e2e.ts, with the test page
tests/fixtures/holoml/speed.holoml and its script.

| # | Result |
|---|---|
| U1 | Pass. holoml's tests: 170 passed (a valid sample, v02-speed-and-slider; a problem sample, bad-slider; newer-than-declared uses both in a 0.1 page); lint and types clean |
| U2 | Pass. At `speed="4"` the viewer walked within 20% of 4 metres a second, measured between two moments while W was held; walls.holoml, a 0.2 page without speeds, reads 2.2 and 90 |
| U3 | Pass. At `turn-speed="180"` the left arrow turned within 20% of 180 degrees a second, without moving |
| U4 | Pass. Five values out of range were refused with their messages and changed nothing; at 8 metres a second and 30 degrees a second the viewer went within 20% of both |
| U5 | Pass. Both sliders in their corners with their labels; the second shows the defaults (0 to 10 in steps of 0.1, starting at 0). The right arrow moved "pace" to 1.25: the script heard it, set 5 metres a second and 225 degrees a second, and changed the label; the left arrow moved it back without turning the viewer, and W still walked. A click at its right end set 2, with no scene click. A script's value 0.5 moved it without an event; 3 was refused. The accessibility tree has two sliders, "Pace 2×" (value 0.5) and "Plain"; the text view shows both |
| U6 | Pass. Blockworld reads 4.3 and 120; End on its slider gave 8.6 and 240 and the label "Speed 2×", Home gave 2.15 and 60 and "Speed 0.5×" |
| U7 | Pass, with one timing miss. Full run: 244 of 245 end-to-end checks passed (C to U); milestone 10's L9 answered one search in 70 ms (limit 50) during the run and passed alone right after (9 of 9); L9's measure is being reworked in the owner's other session (browser pull request #33). The HoloML checks (milestones 14 to 17) passed again with the new walk controls (64 of 64); unit tests 261; holoml's tests 170 |

### Part 2: the sofa studio (plan answered and build approved, prompt 98)

Goal: HoloML's first shop, with realistic graphics. A furniture shop's
page for one sofa in a lit room: the viewer walks around it, chooses the
fabric and the legs in place (no new page), sees soft shadows and a room
that looks real, watches the price follow the choice, and goes on to an
ordinary web page to "add it to the cart". It needs what the showroom
found missing (holoml issues #8 shadows and #9 changing a material in
place), textured materials, and light from the surroundings.

#### How it would work (proposed)

- **HoloML 0.2, second part** (holoml repository: SPEC.md, the checker,
  conformance samples; 0.1 pages unchanged):
  - Shadows (#8): a `shadows` flag on `light` (it casts shadows) and on
    `model` and `group` (they cast and receive them). The renderer
    chooses how soft and how detailed, and may leave shadows out when it
    must (as with its other limits), saying so.
  - Textured materials: `material` gains `map` (a colour picture),
    `normal-map` (fine bumps), `roughness-map`, and `repeat` (how many
    times the picture tiles, such as "3 3"). Pictures come from the
    page's own site and count against the page's limits like models'.
  - A choice in place (#9): `choice`, a set of options on the screen, in
    a corner like `hud` and `slider`. It names a model's material
    (`target="#sofa" material="Fabric"`); each `option` gives the
    material's new colour, pictures, and roughness, and its label.
    Picking an option changes the material at once, without a script;
    the keyboard (arrow keys, as a group of radio buttons) and screen
    readers use it, and the text view shows it. Scripts hear `change`
    with the option's value, and can read and set the chosen option.
  - Light from the surroundings: `environment` on `scene`, a picture of
    the surroundings (an HDR or JPEG panorama from the page's own site)
    that lights shiny and soft materials alike, and can also be the
    background. Without it, the renderer's own soft light, as now.
- **The browser**: soft shadow maps (Three.js), sized within the limits;
  texture maps and tiling; choices as the page's own radio buttons in
  their corner, as sliders are; the environment picture through
  Three.js's own HDR loader (already part of three; no new package);
  the limits count every picture.
- **The sofa studio** (holoml repository, examples/sofa-studio/,
  published with GitHub Pages like the others), from Poly Haven's CC0
  models, textures, and HDRIs (downloads approved in prompt 85, Q3 a):
  - A room with a wood floor, a rug, walls, a coffee table, a side
    table, and a lamp; a studio HDRI for the light; soft shadows under
    everything. The sofa is one of Poly Haven's Sofa 01 to 03 (per Q2),
    chosen for a fabric that is its own material.
  - Orbit around the sofa (it is a product page, not a walk).
  - Two choices, bottom left: Fabric (five, such as rough linen, velour
    velvet, wool bouclé, poly-wool herringbone, and brown leather) and
    Legs (oak, walnut, black metal).
  - The price, top right, follows the choices (per Q6), and "Add to
    cart" opens cart.html, an ordinary page in the example that lists
    the chosen fabric and legs from its address (there is no shop
    behind it).
  - An "Evening" slider or choice for the lamp and the window light
    (per Q3), and credits on an about page, as the showroom has.
- **The examples section and the start panel** gain the sofa studio,
  with its picture.

#### Questions

- Q1, the material choice. a: the declarative `choice` and `option`
  above: no script needed for the common case, the keyboard and screen
  readers use it, and scripts can listen (recommended: issue #9's idea,
  the smallest useful step; the aquarium and the apartment can reuse
  it). b: screen buttons (`button`) and a script that changes the
  material (more flexible, but every shop page needs code).
- Q2, the sofa. a: one of Poly Haven's three sofas (realistic, 2,700 to
  8,000 triangles, CC0), the one whose fabric separates best
  (recommended). b: all three, with a Model choice too (a larger page).
  c: Kenney's Furniture Kit (low-poly, as the showroom's cars; smaller,
  less real).
- Q3, the sofa bed from the proposal (prompt 84). None of the CC0 sofas
  opens into a bed. a: drop it, and let the viewer switch the room
  between day and evening light instead (recommended). b: a script-made
  mattress that slides out (would look crude).
- Q4, light from the surroundings. a: the `environment` attribute and a
  1k studio HDRI from Poly Haven (about 1.5 MB; recommended: reflections
  and soft light are most of "looks real"). b: keep the renderer's own
  soft light (no new attribute, less real).
- Q5, shadows when drawing in software (GitHub's machines). a: the
  renderer may leave them out when it must; drawn in software, the
  checks log that and check the rest, as the other budgets (prompts 59,
  95, 96) (recommended). b: always draw shadows, however slow.
- Q6, the price. a: the page's script computes it from the two choices
  and shows it in a `hud` (shows choices and scripts working together)
  (recommended). b: each option declares its price and the renderer
  adds them up (a shop-only idea in the language).

#### Tasks

- [x] 1. HoloML 0.2, second part: shadows, texture maps and tiling,
      `choice` and `option`, `environment`; SPEC.md, the checker,
      conformance samples for each new element, attribute, and problem.
- [x] 2. The browser: shadows, textures, choices, the environment, the
      limits; the copy of the parser and checker (`pnpm holoml:sync`).
- [x] 3. The sofa studio: the models, textures, and HDRI (checked CC0,
      sizes, credits), the room, the pages, the price script, the cart
      page, the about page. Published with GitHub Pages when holoml's
      pull request merges.
- [x] 4. The examples section and the start panel: its card, its
      picture, and its row.
- [x] 5. Checks U8 to U16 (tests/e2e/m18.e2e.ts, holoml's tests).
- [x] 6. Documents: both READMEs, SPEC, ARCHITECTURE, docs/privacy.md,
      THIRD-PARTY, AGENTS testing, HANDOFF; screenshots
      (docs/screenshots/m18) and the README's pictures (four since
      prompt 99).

#### Checks

| # | Check | Expected result |
|---|---|---|
| U8 | The language | holoml's tests: shadows, texture maps, repeat, choice and option, and environment have valid and problem samples; a 0.1 page may not use them |
| U9 | Shadows | With a graphics card, a lit model with shadows darkens the floor under it (the page's pixels, with and without); drawn in software, per Q5. Since the review of 2026-09-30, drawn in software the check reports "skipped", not "passed" |
| U10 | Textures | A material's pictures load within the page's limits, show on the model (the page's pixels take the picture's colours), and tile as `repeat` says |
| U11 | Choices | In their corner with their labels; mouse, keyboard, and screen readers pick an option; the material changes in place (read back) without loading a page; the script hears `change`; the text view shows the choices |
| U12 | Environment | The page's panorama lights the scene (a shiny test sphere reflects its colours) and counts against the limits |
| U13 | The sofa studio | Ready within 5 s from 127.0.0.1 with a graphics card (logged in software); every model and picture loaded, no problems; each fabric and leg choice changes the sofa; the price follows; "Add to cart" opens the cart page with the choices. Since the review of 2026-09-30, drawn in software the check reports "skipped", not "passed" |
| U14 | For everyone | The whole page from the keyboard (choices, the evening switch, the cart link); screen readers name the choices; the text view; with reduced motion nothing moves by itself |
| U15 | Efficient | An idle sofa studio draws no frames |
| U16 | Published | The sofa studio opens from its public address in the built app (by hand, as S8 and T9) |
| U17 | Regression | C to U pass, the unit tests, and holoml's tests |

#### Done when

- Part 1 is merged (browser pull request #34), U8 to U17 pass,
  screenshots are saved, and the owner accepts.

### Part 2 results (2026-09-27)

Built as planned (prompt 98, Q1 to Q6 a). holoml: the language on its
branch sofa-studio (commit b124c6c) and the sofa studio (d97207f), in a
pull request; the browser on branch m18-sofa-studio, based on pull
request #34's branch, with the copy synced from holoml's branch
(`pnpm holoml:sync sofa-studio`). After both merge: sync from holoml's
main, and U16.

Decisions made while building (within the plan):

- The sofa is Poly Haven's Sofa 01, a carved two-seater. All three of
  Poly Haven's sofas have one material, so prepare.mjs splits it: each
  triangle is Wood when at least three quarters of 21 points on it are
  dark in the sofa's own picture (its wood is darker than 0.2, its
  fabric lighter than 0.25). A first split ("mostly dark", at 0.32) put
  some of the skirt's long triangles in the wood, which showed as a
  zigzag of the old fabric once the fabric changed.
- The plan's "Legs" choice became "Wood": the sofa's frame and legs are
  one carved piece, so they change together (walnut, its own; oak and
  ebony, its picture recoloured).
- Fabrics: its own stone weave, and Poly Haven's rough linen (blue),
  velour velvet (red), "wool boucle" (a glen check, so named "Wool
  check"), and brown leather; herringbone was not among the CC0
  textures that fit. Every option's pictures load with the page, so a
  pick shows at once (about 12 MB in all, 100,000 triangles).
- The rug's red jacquard is recoloured grey, so the sofa stays the
  brightest thing; the walls are set warm grey in the page.
- The cart page reads the choices from the tab's session storage, where
  the page's script keeps them (a HoloML link's address cannot change),
  and the script sets them again when the visitor comes back.
- Evening: the fill light dims (and with it the light from the studio
  panorama, which follows the ambient lights, as the renderer's own
  soft light did in milestone 17; now in SPEC.md), the sun turns low and
  orange, and the table lamp lights a warm spot, with its shadow.
- Shadows: Three.js r186 removed PCFSoftShadowMap; its PCFShadowMap
  with a radius gives the soft edges. The sun's shadow view is fitted to
  the models marked `shadows` before each frame. Drawing in software,
  a page's shadows are left out and the console says so once; the
  notice is kept for things the page loses, since shadows change
  nothing a page means.
- A choice whose material the model does not have changes nothing, and
  the console says so (SPEC.md, as for `material`).
- For the tests: the fixture server serves .bin, .jpg, and .hdr, and
  generates striped pictures and an HDR panorama; `pnpm holoml:sync`
  reads files larger than 1 MB (the panorama is 1.6 MB), and the copy
  test compares the examples by git object id, in one git call per
  site (a git call per file took over 5 seconds for the sofa studio).

Checks are in tests/e2e/m18.e2e.ts, with the test pages
tests/fixtures/holoml/shadows.holoml, textures.holoml, choice.holoml
(and choice.js), environment.holoml, and environment-large.holoml, and
the sofa studio's copy in tests/fixtures/holoml/sofa-studio.

| # | Result |
|---|---|
| U8 | Pass. holoml's tests: 182 passed (a valid sample, v02-shadows-textures-choice; a problem sample, bad-choice, with 12 problems; newer-than-declared uses the new elements in a 0.1 page; the examples test checks the sofa studio's files, size, choices, and credits); lint and types clean |
| U9 | Pass. With a graphics card, the floor under the block marked `shadows` was darker than three quarters of the floor under the block without (one shadow light, two models with shadows). Drawn in software (HYPERSOL_TEST_SOFTWARE=1): no shadow lights, the console says why, and the check logged "shadows left out, drawing in software (ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) …)))" (Q5 a) |
| U10 | Pass. The stripes' address and tiling (3 by 1) read back, and tiling alone tiled the model's own picture (2 by 2); on the page, red and blue stripes, crossed at least 3 times in 80 pixels; the picture from another site (never asked for) and the 8192 by 8192 picture were left out with their reasons, and those models kept their own; the page's byte total was the model file and the stripes, the refused picture counting nothing |
| U11 | Pass. Both choices in their corners with their labels and options (an option without a value takes its label); the chosen option on the block at the start; a click on Red changed the material in place (the same page) and the script heard it; the right arrow picked Blue (the material's own roughness back: each option starts from the material's own look), then Striped (tiled 2); scripts read the value, the options, and the label, and set the value without an event; a value no option has is an error; the script-only choice was heard; screen readers find each choice as a group named by its label, with its options as radio buttons and the chosen one checked; the text view shows the choices |
| U12 | Pass. The green panorama made the mirror-like block green (green above red and blue by more than 40); the surroundings loaded, at full brightness; the page's byte total included the panorama. A panorama over the picture limit was left out with its reason; the scene showed with the renderer's own light |
| U13 | Pass. Ready within 5 s with a graphics card (drawn in software, logged: 7,003 ms); no problems, nothing left out, 8 models and the panorama loaded, 2 shadow lights and 8 models with shadows; each fabric and the ebony wood changed the sofa's material (read back by its picture's address) and the price; a click on "Add to cart" in the scene opened cart.html, which listed Linden two-seat sofa, Red velvet, Ebony, $1,650; back in the studio, the choices were as before |
| U14 | Pass. Tab went through the scene's models and links ("Add to cart", "About this studio") to the Fabric choice; the arrow keys chose the next fabric, then (after Tab) the next wood, then Evening (the lamp on, the fill below 0.1); screen readers find three groups, Fabric, Wood, and Light, with the chosen options checked; the text view showed the price, the choices, and the links; Shift+Tab reached "Add to cart", and Enter opened the cart page with those choices ($1,660) |
| U15 | Pass. No frames drawn in 2 s while idle, and none with reduced motion (nothing on the page moves by itself) |
| U16 | Pass (2026-09-28, prompt 99). After holoml #15 merged, the built app opened https://srajpal.github.io/holoml/sofa-studio/index.holoml (a one-off run with the network, not a test, as S8 and T9): HoloML 0.2, ready in 3.1 s, no problems, nothing left out, all 8 models and the panorama loaded, 2 shadow lights and 8 models with shadows; choosing Wool check changed the sofa (its picture from the published site) and the price to $1,600 |
| U17 | Full run, 2026-09-27: 247 of 252 checks passed. P2 failed because the material report now also names a material's colour picture and tiling; its expected object gains those two fields (null for that car; the check is otherwise the same), and milestone 14's checks passed again (19 of 19). D8's three copy and paste checks and K3's password copy failed: this computer's clipboard refused every use during the run and after it (PowerShell's Set-Clipboard and Get-Clipboard failed 10 of 10 tries), so they could not pass here; nothing in this change touches the clipboard, and they passed in milestone 17's full run and in pull request #34's automatic builds. Run again on 2026-09-28, with the clipboard working: D8 5 of 5, K1 to K3 3 of 3. After the last changes, the HoloML checks (milestones 14 to 18) passed again, 76 of 76, and milestone 18's drawn in software, 12 of 12; unit tests 261; holoml's tests 182; lint and types clean. Screenshots: docs/screenshots/m18/ (53 and 54 are the sofa studio) and the README screenshot, refreshed |

## Milestone 19 — Harbour Loft

Status: Done. Accepted by the owner on 2026-09-29 (prompt 122), after
holoml pull request #17 and the browser's #36 merged. Planned (prompt
113); the owner answered Q1 to Q6 with the recommendations and
approved the build (prompt 114). Pushed before the milestone (after
milestone 18's acceptance). Rule 13 check done (ARCHITECTURE.md section
3). Handed off mid-build on 2026-09-28 (prompt 116) with tasks 1 and 2
done; resumed in prompt 118, which also chose Harbour Loft for the
README's first picture. All six tasks are done. The owner merged holoml
pull request #17 (prompt 119) and the browser's #36 (prompt 121,
2026-09-29).

Goal: a flat to tour, for an estate agent. Walk through the rooms of a
loft by the harbour, open doors, switch lamps on and off, read about
each room on a panel, see where you are on a floor plan, look out at
the harbour, go up to the roof terrace, and book a viewing. It is
HoloML's first larger scene, and it needs what the showroom and the
sofa studio did not have: text of more than one line (holoml issue
#11), click actions without a script, links that arrive at a place
(prompt 87), and a view outside.

### How it would work (proposed)

- **HoloML 0.2, third part** (holoml repository: SPEC.md, the checker,
  conformance samples; 0.1 pages unchanged):
  - Paragraphs (#11, Q1): `panel`, a flat board of text placed and
    turned like a model. Its lines wrap to a `width` in metres; blank
    lines separate paragraphs; `size` is the height of a line, with a
    text colour and a background colour (or none). Find in page, the
    text view, and screen readers get its words.
  - Click actions without a script (Q2): `animate` gains `begin`
    (`load`, as now, or `click`: it runs when its target, or the
    element `trigger` names, is clicked or chosen with the keyboard),
    `toggle` (each click runs it forward, then back), and `label` (its
    name for the keyboard and screen readers). A door swings open and
    shut; a switch turns a lamp on and off. `sound` gains the same
    `begin`, `trigger`, and `label`. Each click action is a button in
    the page's outline ("Open or close: bedroom door"), so Tab and
    Enter reach it; scripts still hear the click.
  - Places and arriving (prompt 87, Q3): a page may have several
    `viewpoint` elements, each with an `id` and a `label`. An address
    ending in `#name` starts the viewer at that viewpoint (otherwise at
    the first), and the outline lists them as places to go ("Go to:
    Kitchen"). Following a link to another HoloML page of the same
    site fades out and in, instead of a cut (a cut with reduced
    motion).
  - The view outside (Q4): `sky` on `scene`, a panorama (HDR, PNG, or
    JPEG, from the page's own site) drawn behind everything in place of
    the background colour; `environment` can use the same file to light
    the scene. It is the sky from Coral Bay's list, which this site
    needs for its windows (prompt 102).
  - A floor plan (Q5): `plan`, a picture in a corner of the screen (as
    `hud`) with a marker for where the viewer is and which way they
    face; `area="x0 z0 x1 z1"` says which rectangle of the scene the
    picture shows.
- **The browser**: panels drawn as flat text, sharp at a step away;
  click actions and their buttons in the outline; named viewpoints and
  the fade between pages; the sky; the floor plan; pictures from the
  page's own site within its limits; the copy of the parser and checker
  (`pnpm holoml:sync`).
- **Harbour Loft** (holoml repository, examples/harbour-loft/,
  published with GitHub Pages like the others):
  - A loft of about 90 m²: a hall, an open living room and kitchen, a
    bedroom, a study, and a bathroom, with tall windows onto a harbour
    (a Poly Haven HDRI as the sky and the light). Walk mode; walls and
    furniture stop the walker.
  - Doors that open when clicked, with a sound; lamps with switches; a
    day and evening light (as the sofa studio's); a panel in each room
    with its size and a few lines about it; the floor plan in a corner.
  - A door out to the roof terrace: a second page, reached with a fade,
    arriving at its door (a named viewpoint), and a way back.
  - "Book a viewing": an ordinary page with a made-up form that sends
    nothing (there is no agent behind it); an about page with the
    credits.
  - Models (Q6): Poly Haven's CC0 furniture for the living room, the
    dining table, the study, and the bedroom; the walls, floors,
    kitchen worktops, and bathroom fittings made by the site's script
    from Poly Haven textures, as the sofa studio's room was (Poly Haven
    has no kitchen or bathroom fittings, and only three beds). About 30
    MB in all, well within a page's 128 MB.
- **The examples section and the start panel**: its card, its picture,
  and its row.

### Questions

- Q1, paragraphs. a: a new `panel` element, a flat board of wrapped
  text placed like a model (recommended: an estate agent's panel on a
  wall, readable from a step away). b: `label` wraps instead (it still
  turns to face the viewer, like a sign that follows you).
- Q2, doors and switches. a: click actions in the language (`animate`
  and `sound` with `begin="click"`, `trigger`, `toggle`, and `label`),
  each a button in the outline (recommended: the everyday case needs no
  code, and the keyboard and screen readers get it for free). b: the
  site's script does them (no change to the language).
- Q3, rooms and pages. a: the whole flat on one page, walked through,
  plus the roof terrace as a second page reached with a fade and a
  named viewpoint (recommended: a real tour, and it tries prompt 87's
  page transitions). b: a page per room, linked with fades. c: one page
  only; page transitions later.
- Q4, the view outside. a: `sky`, a panorama behind everything
  (recommended: the harbour through the windows is the site's point).
  b: a plain colour outside.
- Q5, the floor plan. a: a `plan` element with the viewer's place on it
  (recommended). b: leave it out; the panels name each room.
- Q6, the models. a: Poly Haven (CC0), with the kitchen and bathroom
  made by the site's script from Poly Haven textures (recommended:
  realistic, as the sofa studio). b: Kenney's Furniture Kit (CC0,
  low-poly, with every room's fittings; consistent but toy-like). c: CC
  BY models for the missing fittings, credited (needs your approval:
  prompt 85, Q3 a allows CC0 only).

### Tasks

- [x] 1. HoloML 0.2, third part: SPEC.md, the checker, and conformance
      samples for each new element, attribute, and problem (holoml
      branch `harbour-loft`).
- [x] 2. The browser: panels, click actions, named viewpoints and the
      fade, the sky, the floor plan; the copy of the parser and checker
      (`pnpm holoml:sync`, from holoml's `harbour-loft` branch for now).
- [x] 3. Harbour Loft: the models, textures, and HDRI (checked CC0,
      sizes, credits), the flat, the terrace page, the booking page,
      the about page (holoml branch `harbour-loft`: tools/download.mjs,
      tools/layout.mjs, tools/prepare.mjs, and the pages; prompt 118).
      Published with GitHub Pages when holoml's pull request merges.
- [x] 4. The examples section and the start panel: its card, its
      picture (`pnpm screenshots:examples`), and its row (prompt 118).
- [x] 5. Checks V1 to V12 (tests/e2e/m19.e2e.ts, holoml's tests), run on
      Windows, with `pnpm test:linux`, and in the automatic builds
      (V5's last version on Linux in the automatic builds only; see the
      results).
- [x] 6. Documents: both READMEs, SPEC, ARCHITECTURE, docs/privacy.md,
      THIRD-PARTY, AGENTS testing, HANDOFF; screenshots and the README's
      pictures.

### Checks (named V; milestone 18 used U)

| # | Check | Expected result |
|---|---|---|
| V1 | The language | holoml's tests: each new element and attribute has valid and problem samples; a 0.1 page may not use them |
| V2 | Panels | Lines wrap within the width and paragraphs stay apart (the page's pixels); Find in page finds the words; screen readers and the text view read them |
| V3 | Click actions | A click, and Enter on its outline button, opens a door, and the next closes it; a switch turns its lamp on and off; the sound plays (after the first click, as sounds must); with reduced motion each goes straight to its end; scripts still hear the clicks |
| V4 | Places | An address with `#name` starts at that viewpoint; an unknown name starts at the first; the outline's "Go to" moves the viewer there |
| V5 | Arriving | A link to another HoloML page of the same site fades out and in (the page's brightness over time); a cut with reduced motion; other links as before |
| V6 | The sky | The panorama shows behind the scene (the page's pixels take its colours), from the page's own site, counted against its limits |
| V7 | The floor plan | In its corner; its marker follows the viewer as they walk and turn |
| V8 | Harbour Loft | Ready within 5 s from 127.0.0.1 with a graphics card (logged in software); every model loaded, no problems; walls stop the walker; every door and lamp works; the terrace page and back; the booking page. Since the review of 2026-09-30, drawn in software the check reports "skipped", not "passed" |
| V9 | For everyone | The whole tour from the keyboard; screen readers name the rooms, doors, and switches; the text view; reduced motion |
| V10 | Efficient | An idle flat draws no frames |
| V11 | Published | From its public address in the built app (by hand, as S8, T9, and U16) |
| V12 | Regression | The full run on Windows, `pnpm test:linux`, the unit tests, holoml's tests, and the automatic builds |

### Decisions made while building (prompt 118)

- The flat's plan is data: tools/layout.mjs holds its walls and their
  openings, rooms, door hinges, and furniture; prepare.mjs writes the
  walls, windows, and furniture into index.holoml (between two
  comments) and draws the floor plan from the same numbers. The doors,
  lamps, panels, places, and links are written in the page by hand.
- Each model is one .glb, its pictures inside: the viewer fetches a
  model's files one after another, and as .gltf files with their
  pictures beside them the flat took 203 requests, the last at 3.6 s;
  now 56, all in by 1.3 s. Oak left the window sills and the basin, so
  fewer pictures repeat between files. The flat is 19 MB and 250,000
  triangles; the whole site 22 MB.
- Ready in 3.5 to 3.8 s the first time with a graphics card (5 s
  allowed): after the files arrive, the first drawing compiles the
  materials' shaders on the page's main thread; the seven lamp lights
  cost about 0.8 s of it (2.7 s without them). Kept, as the tour's
  point. A way to come in sooner is an open question for the viewer
  (ARCHITECTURE.md section 10, item 4).
- The outline: every model is a stop in it (milestone 15's rule), so
  the page puts its places, panels, links, doors, and lamps first (43
  stops) and its 110 walls and furniture after; its Light choice, on
  the screen, comes after the outline. The same open question lists
  ways the viewer could help.
- Looks: Poly Haven's marble_01 is stone tiles, so the worktops are
  plain white stone and the tiles the splashback; the floor tiles are
  recoloured grey and the duvet off-white; the parquet's roughness is
  raised (it glared in the sun); the picture frame's glass, opaque in
  Poly Haven's 1k files, is made clear; the lamps' own glow is taken
  out, and a small bright sphere grows when a lamp is switched on.
- Light: indoors the fill is 1.7 and the sun 3.5 (at 0.6 the walls read
  grey); outdoors 0.9 and 3; loft.js takes each page's own day values,
  and the evening is 0.07 and no sun.
- Door leaves fill their openings (0.98 by 2.09 m); the doors that are
  links (up to the terrace, back down) have ids, so a check can click
  the door itself.
- The design note (tools/DESIGN.md) is gone: the site's README says
  what readers need.
- The examples section's capture waits for a walker to land only when
  it has gravity; T8 checks the new card and row.

### Results so far (2026-09-28, Windows 11)

- V1: holoml's tests, 194 passed: the new conformance samples
  (v02-panels-click-places, bad-click-actions, and newer-than-declared
  grown), and Harbour Loft's pages valid, its files existing within 25
  MB and 400,000 triangles, and its credits; lint and type check clean.
- V2 to V10: `tests/e2e/m19.e2e.ts`, 9 checks, all passed in the full
  run. V8: ready in 3.8 s from 127.0.0.1 with this computer's graphics
  card (5 s allowed); its 120 models, 10 sounds, sky, light, and plan
  loaded, no problems; the walker stopped by the front wall and by the
  shut study door, and through it once open; a click on the study door
  (its sound played) and on the hall's switch; every door and lamp by
  its button; up to the terrace with a fade, and back to
  #terrace-door; the booking form sent nothing. V9: every place, panel,
  link, door, and lamp within 43 Tab stops, before the walls and
  furniture; the Light choice 112 stops later (see the decisions);
  Enter and Space; screen readers; the text view; reduced motion (a
  door at once, the terrace by a cut). V10: no frames while idle, by
  day, lit in the evening with the doors open, and with reduced motion.
- T8 (milestone 17) checks Harbour Loft's card and row: passed.
- The full run on Windows (V12): 261 checks, 260 passed. U2 (milestone
  18: a page's walking speed) read 4.83 m/s where the page says 4 and
  the check allows under 4.8; run alone three times, it passed. This
  milestone changed nothing about walking speeds (controls.ts: only the
  eye height a place sets, and the keys the outline's buttons keep);
  the check takes the viewer's place against the page's clock, and a
  late frame reads fast.
- The unit tests: 264 passed; lint and type check clean.
- Screenshots: docs/screenshots/m19 (`MILESTONE=m19 pnpm screenshots`),
  and the README's four pictures with Harbour Loft first (`pnpm
  screenshots:readme`, prompt 118).
- V11 (2026-09-28, prompt 119, after the owner merged holoml #17 and
  GitHub Pages published it): the built app opened
  https://srajpal.github.io/holoml/harbour-loft/index.holoml (a one-off
  run with the network, not a test, as U16): HoloML 0.2, ready in 8.0 s
  over the internet (20 MB), no problems, nothing left out, its 120
  models, 10 sounds, sky, light, and plan loaded, 7 places and 10
  click actions; the kitchen lights came on from their button; the
  terrace arrived through a fade, everything loaded. Pass.
- The copy of HoloML is synced from holoml's main (4d69a69, the merge
  of #17); only the copies' first comment line changed (the ref).
- `pnpm test:linux` (Ubuntu in Docker, drawing in software, as
  GitHub's machines): lint, types, and the unit tests pass (262, and
  2 skipped: the copy's checks against holoml beside it). V2 to V7
  pass. V8 to V10 ran out of the 60 seconds a check has: drawing in
  software, the flat takes about 30 s to load (V8 logged 30.6 s) and
  each frame seconds. V8 now presses every door and lamp together and
  then reads them, V9 goes on from where V8 leaves the flat instead of
  loading it again, and the three have limits for drawing in software
  (8, 5, and 4 minutes, as other long checks have 2 and 4); on Windows
  they still pass (V8 read 4.7 s while the Linux run shared the
  computer).
- The full `pnpm test:linux` run with the checks before that change
  (2026-09-29): 257 passed, 1 skipped, and V8 to V10 ran out of their
  60 seconds. Milestone 19's checks again on Linux after it
  (`pnpm test:linux tests/e2e/m19.e2e.ts`, 2026-09-29): V2 to V10, 9
  checks, all passed (V8 ready in 20.5 s, logged; V8 took 169 s, V9
  185 s, V10 62 s).
- The automatic builds of browser pull request #36 (2026-09-29): Windows
  passed; Linux passed 258 of 261 checks (1 skipped) and failed two,
  both reading the page too late on GitHub's slower machine, drawing in
  software. V5: the arriving page was busy over its first frame for more
  than the 4 s it waits at most before fading in, so when the check
  could ask it, it had faded in (as it should). V8: the door's sound
  (0.75 s) had ended before the check could see it playing. Fixed
  without loosening either: V5 now samples the page's brightness from
  the browser for 2.5 s after the page appears, and checks, against the
  page's own record of its fade, that nothing of its scene shows until
  it begins to fade in; then it lets the model come, as before, and the
  page fades in and is lit. A sound's report counts its plays, and V8
  checks the door's sound started. The automatic builds on that
  (3e6b852): V8 passed; V5 failed again, as it also wanted several black
  samples while the page was dark, and on GitHub's machine the page is
  busy over its first frame for all of its dark time, and the browser's
  pictures of it wait for it too (one sample before, then none until it
  was fading in). Now it wants only what can be seen there: the samples
  taken before the fade-in, all dark. Tried here with the page's
  processor slowed twenty times, drawing in software: the same one
  sample, and a pass. V8 passes on Windows, drawing in software, with
  `pnpm test:linux`, and in the automatic builds; V5 passes on Windows
  and drawing in software, and its first version passed with `pnpm
  test:linux`. Not yet: this V5 with `pnpm test:linux` and in the
  automatic builds (running).
- The automatic builds of #36's last commit (704edf1, with this V5): Linux
  passed (26 minutes) and Windows passed (19 minutes). Milestone 20's
  pull request #37, which contains it, passed on both too (see milestone
  20's results). This V5 has not run with `pnpm test:linux`.
- Merged (2026-09-29, prompt 121): the owner merged #36 (135aa25), after
  holoml #17 (prompt 119).

### Done when

- V1 to V12 pass, screenshots are saved, and the owner accepts.

## Milestone 20 — Sneaker store

Status: Done. Accepted by the owner on 2026-09-29 (prompt 122), after
holoml pull request #18 and the browser's #37 merged. Planned and started
(prompt 120): the owner said to start the next milestone and to take
the recommendations for its questions, so Q1 to Q5 are answered as
recommended and the build is approved. Rule 13 check done
(ARCHITECTURE.md section 3). Pushed before the milestone (milestone
19's branch, browser pull request #36, not yet accepted: this
milestone's branch starts from it). All six tasks are done. The owner
merged holoml pull request #18 and the browser's #37 (prompt 121,
2026-09-29).

Goal: a sneaker store, in place of Coral Bay, a resort (prompts 101 and
102): a wall of sneakers to pick up, turn, and see up close (the sole,
the laces), in their colourways and sizes, a cart across shoes, and a
checkout page with no real payment. HoloML's loading by area comes with
it (prompt 102): many shoes, each loaded when the viewer comes near.

### How it would work (proposed)

- **HoloML 0.2, fourth part** (holoml repository: SPEC.md, the checker,
  conformance samples; earlier pages unchanged):
  - Loading by area (prompt 87): a `group` with `load="near"` loads its
    models, and their pictures, only while the viewer is within `near`
    metres of it (default 10), and lets them go when the viewer is
    farther than half as much again; they count against the page's
    limits only while loaded. A group near the start loads with the
    page.
  - Stand-ins: a model's `stand-in` names a lighter model shown in its
    place until the model has loaded, and again once it is let go.
  - The scene API: a group's `loaded` (all its models in), and a `load`
    event as a group's models come in or are let go, so a script can
    show progress.
- **The browser**: the viewer loads and lets go by area as the viewer
  moves (releasing the memory), shows stand-ins, keeps the counts, and
  tells scripts; the copy of the parser and checker.
- **The sneaker store** (holoml repository, examples/sneaker-store,
  published with GitHub Pages like the others):
  - One sneaker, Shopify's (from the Khronos glTF sample assets, CC BY
    4.0, credited as its licence asks), in about ten colourways: its
    own three, and more made by recolouring its picture; a lighter
    stand-in for far away.
  - The store: a bright room with a wall of shelves on each side, a shoe
    in each colourway on them, a bench, and a counter; walk mode; the
    shelves load by area.
  - A shoe's page: a click on a shoe opens it with a fade, close up on a
    turntable to orbit around; its colourway (a choice: the shoe changes
    in place), its size (a choice for the script), "Turn it over" to see
    the sole (a click action), "Add to cart" (the script), and the cart
    on the screen.
  - The cart and checkout: an ordinary web page with the cart's shoes,
    sizes, and total, and a button that places nothing ("an example:
    nothing was ordered or charged"); no payment fields. The cart is
    kept in the tab's session storage across the store's pages.
  - An about page with the credits.
- **The examples section and the start panel**: its card, its picture,
  and its row.

### Questions (answered with the recommendations, prompt 120)

- Q1, the shoes. a: Shopify's sneaker from the Khronos glTF sample
  assets (CC BY 4.0: credited in the store's credits, its about page,
  and THIRD-PARTY), in about ten colourways made from its own picture
  (recommended: realistic, and no other good sneaker is free without an
  account; prompt 85, Q3 a allowed CC0 only, so this needs the owner's
  approval, given in prompt 120). b: sneakers made by the site's script
  (plain). c: the owner finds or buys models.
- Q2, loading by area. a: in the language: `load="near"` and `near` on a
  group, a model's `stand-in`, and the scene API's `loaded` and `load`
  event (recommended). b: the page's script adds and removes models
  itself (holoml.add and remove; no change to the language). c: leave
  it out.
- Q3, picking up a shoe. a: a click on a shoe opens its page with a
  fade, where it turns on a turntable and you orbit around it, choose
  its colourway and size, turn it over, and add it to the cart
  (recommended: every part is HoloML 0.2 as it stands, with the store's
  script). b: in place on the wall, a script moving the shoe and the
  viewer.
- Q4, the checkout. a: an ordinary web page with the cart and a button
  that places nothing, and no payment fields (recommended: "no real
  payment", and nothing like card details is asked for). b: a pretend
  card form that sends nothing.
- Q5, sizes and the cart. a: EU sizes 36 to 47 in a choice, and the
  cart in the tab's session storage (recommended, as the sofa studio
  kept its choices). b: US sizes too.

### Tasks

- [x] 1. HoloML 0.2, fourth part: SPEC.md, the checker, and conformance
      samples for loading by area, stand-ins, and the scene API's
      loading (holoml branch `sneaker-store`).
- [x] 2. The browser: loading and letting go by area, stand-ins, the
      counts, the scene API; the copy (`pnpm holoml:sync`, from holoml's
      `sneaker-store` branch for now).
- [x] 3. The sneaker store: the shoe, its colourways, and its stand-in
      (credited), the store, a shoe's page, the cart and checkout page,
      and the about page; published with GitHub Pages (when holoml's
      pull request is merged).
- [x] 4. The examples section and the start panel: its card, its
      picture, and its row.
- [x] 5. Checks W1 to W12 (tests/e2e/m20.e2e.ts, holoml's tests), run on
      Windows, with `pnpm test:linux`, and in the automatic builds
      (four clipboard checks fail on this computer, whose clipboard is
      broken, and pass elsewhere; see the results).
- [x] 6. Documents: both READMEs, SPEC, ARCHITECTURE, docs/privacy.md,
      THIRD-PARTY, AGENTS testing, HANDOFF; screenshots and the README's
      pictures.

### Checks (named W; milestone 19 used V)

| # | Check | Expected result |
|---|---|---|
| W1 | The language | holoml's tests: loading by area and stand-ins, and their problems, have samples; a 0.1 page may not use them |
| W2 | Loading by area | A group far from the viewer is not fetched at first (the server sees no request); walking near loads it; walking away lets it go, and the page's counted bytes drop; a group near the start loads with the page |
| W3 | Stand-ins | A model's stand-in shows until the model has loaded, and again once it is let go; the stand-in counts against the limits |
| W4 | Scripts | A group's `loaded`, and the `load` event as its models come in and are let go |
| W5 | Limits | Only loaded groups count: a page whose areas together pass the limits loads each area in turn |
| W6 | The store | Ready within 5 s from 127.0.0.1 with a graphics card (logged in software); no problems; the near shelves loaded and the far ones as stand-ins; walking along the wall loads each shelf; walls stop the walker. Since the review of 2026-09-30, drawn in software the check reports "skipped", not "passed" |
| W7 | A shoe | A click on a shoe opens its page with a fade; every colourway changes the shoe in place; "Turn it over" shows the sole; a size is chosen |
| W8 | The cart | "Add to cart" on two shoes; the cart on the screen counts them; the checkout page lists both with their sizes and the total, and its button places nothing |
| W9 | For everyone | The whole store from the keyboard; screen readers; the text view; reduced motion |
| W10 | Efficient | An idle store draws no frames; the page process's memory falls again after far shelves are let go |
| W11 | Published | From its public address in the built app (by hand, as V11) |
| W12 | Regression | The full run on Windows, `pnpm test:linux`, the unit tests, holoml's tests, and the automatic builds |

### Decisions made while building

- What `loaded` means for a group (SPEC.md, section 10): every model in
  it that is near enough to load has loaded or been left out (as
  `holoml.ready` counts), so one left out does not keep it waiting; the
  `load` event is told when that becomes true and when the group is let
  go, not while a script's new model loads into a group already in.
- A model that loads by area and would pass the page's totals (bytes or
  triangles, or the 64 model files) waits for room instead of being
  left out, and tries again when a group is let go. One left out for
  another reason (a file too large, a failed load, Esc) is tried again
  the next time the viewer comes near, and keeps its place in the Tab
  order.
- A model file or a picture is let go (its bytes and triangles no longer
  counted, its memory released) when the last model using it is let go.
  A model removed by a script releases its share but leaves the file
  loaded for the next, as before.
- A stand-in is drawn plain (as an instance where it can be) in a
  holder inside its model's, and is counted, like any model, for as long
  as the page shows it.
- The store (holoml examples/sneaker-store, made by tools/download.mjs
  and tools/prepare.mjs): a hall 26 m long with five bays on each wall,
  one colourway to a bay; each bay is a cubby wall of six shoes (their
  toes to one side and the other in turn) with the colourway's name and
  price above, and its six shoes are one group that loads by area
  (`near="7.5"`, measured to the bay's foot on the wall). A bay with one
  shoe on a ledge, tried first, left the shoes too small in a bright,
  empty wall. The two bays by the entrance load with the page.
- The shoe: each colourway is its own .glb (its pictures inside, at 512
  pixels; about 0.7 MB), so a bay's shoes are one file to load and let
  go; the shoe page's shoe has its pictures at 1024, and its colour
  choice puts each colourway's picture on it in place. The stand-in is
  the shoe with its points joined within 2 cm (the same part of its
  picture only), 2,445 triangles of 22,700, with a picture of 64 pixels.
- The shoe's licence leaves out logos and trademarks: the mark on its
  heel tab (in its colour, relief, and roughness pictures) and
  "///FOAM" on its midsole (in its relief) are painted out, and the
  credits say so. Its own three colours are kept; seven more are made by
  recolouring its knit and trim (the parts that differ between its three
  pictures), keeping their light and shade.
- A shoe's page: the shoe turns once on its turntable as the page opens
  (then the page is idle), and "Turn it over" (a click action) turns it
  about its middle; "Add to cart" is a click action with a chime whose
  click the script hears, so it is a button in the outline for the
  keyboard. `colourways.js` is a module the pages' scripts and the
  checkout page import, and prepare.mjs reads.
- W10's memory: the page's JavaScript heap and its ArrayBuffers (where a
  model's meshes are kept), measured after collecting garbage through
  the page's debugger; the process's working set is logged, as Windows
  keeps memory a process may use again.

### Results so far

- Task 1 (holoml `sneaker-store`, 06afc79 and 00d97a3): SPEC.md, the
  checker, and the samples; the copy synced from it (e9a276a).
- Task 2: the viewer loads and lets go by area (scene.ts), counts what
  is loaded now (budget.ts, pictures.ts), shows stand-ins, and gives
  scripts `loaded` and the `load` event (api.ts); the inspector shows a
  waiting model as waiting, not as a problem. Unit tests: 268 passed
  (four new: the totals a model may wait for, and pictures let go);
  lint and type check clean.
- W2 to W5 (tests/e2e/m20.e2e.ts, fixture pages areas.holoml,
  stand-in.holoml, and areas-limits.holoml): all pass on Windows, three
  runs, and drawing in software (HYPERSOL_TEST_SOFTWARE=1).
- Milestones 14 to 19's HoloML checks after the change: 85 passed.
- Task 3 (holoml `sneaker-store`, e1a3841, and its README and NOTICE,
  5349baa): holoml's tests 204 passed (four new, on the store's files,
  limits, stand-ins, colour choice, and credits), lint and type check
  clean. The store is ready in about 1.5 s from 127.0.0.1 (2.3 MB in 24
  files), with no problems.
- Task 4 (1bcea4a): the copy from holoml's `sneaker-store`, the card,
  its picture (`EXAMPLES_ONLY=sneaker-store pnpm screenshots:examples`,
  new: one example alone), and T8 with the new card and row: passes.
- W2 to W10 (tests/e2e/m20.e2e.ts): all 9 checks pass on Windows, in
  two full runs of the file (and the store's five alone before them),
  and drawing in software (HYPERSOL_TEST_SOFTWARE=1, 138 s).
- Milestone 19's fix for pull request #36 (V5 and V8 on GitHub's Linux
  machines, 3e6b852) merged into this branch (a75dfe1); W7, W8, and W9
  given the same care (816ee59): W8 counts the chime's plays, and W7's
  and W9's waits grow drawing in software.
- The full run on Windows (`pnpm test:e2e`, 2026-09-29, 12 minutes):
  270 checks, 265 passed and 5 failed. Four are the clipboard checks of
  D8 (copying a link and text, pasting) and K2 (the Passwords tab's
  copy): the Windows clipboard itself failed on this computer at the
  time (PowerShell's Set-Clipboard failed as well, again and again), and
  they failed the same run alone; they passed in milestone 19's full run,
  and nothing here touches the clipboard. The fifth, L9 (the main
  process held 40 ms where 20 ms is allowed, with 100,000 visits),
  passed alone. Not yet: those four again on a working clipboard.
- The copy of HoloML synced again from holoml's `sneaker-store`
  (5349baa, its README and NOTICE): only SOURCE.json changed.
- Screenshots: docs/screenshots/m20 (`MILESTONE=m20 pnpm screenshots`;
  the store, a shoe's page, and the checkout are 58 to 60), and the
  README's four pictures again (`pnpm screenshots:readme`), looked at.
- The full `pnpm test:linux` run (2026-09-29, 33 minutes, with milestone
  19's first V5 fix): lint and the unit tests pass (266, and 2 skipped:
  the copy's checks against holoml beside it), and 269 of 270
  end-to-end checks pass, 1 skipped: D8's and K2's clipboard checks
  pass there, where the clipboard works. W6: ready in 6.6 s, drawing in
  software (logged). W10: halfway down the hall six bays in, 5.0 MB
  counted and 5.9 MB of ArrayBuffers; by the entrance four, 3.6 MB and
  4.8 MB (the heap 6.7 MB both times; the working set 239 and 233 MB).
- Pull requests: holoml #18 and the browser's #37 (2026-09-29). Not
  yet: their automatic builds, and W11 by hand once #18 is merged and
  GitHub Pages publishes the store.
- The automatic builds (2026-09-29): holoml #18 passed on Linux and
  Windows. The browser's #37 (4450929, with milestone 19's last V5)
  passed on both: the unit tests 266 passed and 2 skipped, and the
  end-to-end checks 269 passed and 1 skipped of 270, on each. Linux took
  38 minutes 44 seconds of the 45 its job may take; Windows 20 minutes.
  On GitHub's Windows machine D8's and K2's clipboard checks passed.
- Merged (2026-09-29, prompt 121): the owner merged holoml #18 (a6c88d9)
  and the browser's #36 and #37 (585c5ae), and GitHub Pages published
  the store. The copy of HoloML is synced from holoml's main (a6c88d9);
  only the copies' first comment line (the ref) and SOURCE.json changed.
- W11 (2026-09-29, prompt 121): the built app opened
  https://srajpal.github.io/holoml/sneaker-store/index.holoml (a one-off
  run with the network, not a test, as V11): HoloML 0.2, ready in 3.2 s
  over the internet, no problems, nothing left out; 154 models, 2.4 MB
  and 429,084 triangles counted in 22 model files; 12 places and 12
  links. At the start the two bays nearest the viewer were loaded and
  the other eight showed their stand-ins. Down the hall the six far bays
  loaded and the four nearest the start were let go and showed their
  stand-ins again (5.3 MB, 973,884 triangles, 26 files). The Sunset
  shoe's link opened its page through a fade, in Sunset, with no
  problems; size 43 and "Add to cart" made the cart "1 pair · $125",
  and the checkout page listed the Sunset shoe in EU size 43 at $125.
  Pass.
- The Windows clipboard on this computer still failed on 2026-09-29
  (PowerShell's Set-Clipboard), so D8's and K2's four clipboard checks
  have not run again here; they pass on Linux and on GitHub's Windows
  machine.

### Done when

- W1 to W12 pass, screenshots are saved, and the owner accepts.

## Milestone 21 — Aquarium

Status: Done. Accepted by the owner on 2026-09-29 (prompt 125), after
holoml pull request #19 (prompt 124) and the browser's #38 merged;
HoloML 0.2 released as v0.2.0 on the owner's go (prompt 126), so all
nine tasks are done. Planned (prompt 121): the owner merged milestones
19 and 20 and asked for the next milestone, and this plan was drafted
with questions and recommendations. The owner answered Q1 to Q7 with
the recommendations (prompt 122), which, with prompt 121's "Next
milestone", is taken as approval of the plan and its build, as prompt
120 was. The plan's own check-ins stay: the fish are shown to the owner
before the tank is built around them (task 3), and HoloML 0.2 is tagged
after acceptance, when the owner says go (task 9). Rule 13 check done
(ARCHITECTURE.md section 3). Pushed before the milestone (branch
`m21-aquarium`, from main after #37).

Goal: an aquarium to visit (prompt 85). 5 to 10 real-looking fish of
different kinds swim around a big tank with their own swimming
movement, among rocks, plants, and bubbles, with light coming down
through the water. A Feed button drops food, and the fish swim to it
and eat. HoloML 0.2 gets its last part here, and 0.2 is tagged when the
milestone ends (milestone 17's plan, Q5 a).

### How it would work (proposed)

- **HoloML 0.2, fifth and last part** (holoml repository: SPEC.md, the
  checker, conformance samples; earlier pages unchanged):
  - Water: a `water` element fills a box with water (`position` and
    `size`; its top is the surface), with a `color` and a `clarity`
    (how many metres one can see through it). Things seen through the
    water fade into its colour with the distance the view travels
    through it, from inside the water or from outside through glass.
    With `caustics`, the moving net of light that the waves of the
    surface cast below plays over everything in the water. A renderer
    chooses how to draw it, holds the light still for reduced motion,
    and may leave the moving light out when it must (drawing in
    software), as with shadows.
  - Sounds from a place, which the spec promises for 0.2: a `sound`
    with a `position` comes from there, quieter with distance and
    silent beyond its `range`.
  - The scene API: a model's `animationSpeed` (how fast its own
    animation plays; 0 holds it still), so that a fish beats its tail
    faster when it hurries to food.
  - Movement along paths, the other item the spec lists as still to
    come in 0.2, moves to the ideas for later versions (Q3): the fish
    move by the site's script.
  - With that, 0.2 is complete: the spec no longer calls it a draft or
    lists anything still to come, and holoml is tagged v0.2.0 (Q6).
- **The browser**: water in the viewer's materials (the haze and the
  moving light), sounds from a place (the listener follows the
  viewer), and animation speed; the copy of the parser and checker.
- **The aquarium** (holoml repository, examples/aquarium, published
  with GitHub Pages like the others):
  - A walk-through tunnel along the floor of a big tank (Q2): water all
    round and overhead, the fish passing over and beside it, rocks,
    driftwood, and sand (Poly Haven, CC0), and water plants made by
    the site's tools, swaying.
  - 5 to 10 kinds of fish (Q1), each with a swimming animation (a glTF
    skin). A fish that comes without one gets a skeleton and a swim
    from the site's tools: tools/prepare.mjs bends its body in a wave
    from head to tail. The small kinds swim in a small school.
  - The fish move by the site's script: each kind at its own depth and
    pace, schools together, the big ones alone, all inside the water
    and clear of the tunnel, the rocks, and each other.
  - Bubbles rising from air stones (the script), heard from where they
    rise, and light through the water from the surface.
  - Feed: a button by the tunnel's glass (a click action with a sound;
    Enter on its button in the outline too). Flakes drop from the
    surface and sink, and the nearest fish swim to them and eat them,
    one by one.
  - A click on a fish, or its button in the outline, shows its name and
    a few lines about it on a panel by the glass.
  - Reduced motion: the fish, the bubbles, and the light hold still;
    Feed puts the food down and says that the fish have eaten.
  - Sounds (the water, the bubbles, the food's plop) made by a script
    in the repository, as Blockworld's were: no download.
  - An about page with the credits.
- **The examples section and the start panel**: its card, its picture,
  and its row.
- **The automatic builds**: the Linux job took 38 minutes 44 seconds of
  the 45 it may take (#37), and this milestone's checks add more (Q7).

### Questions (answered with the recommendations, prompt 122)

- Q1, the fish. Real-looking fish that are CC0 and free without an
  account are scarce. Only one was found: Khronos's Barramundi Fish (a
  glTF sample model, CC0, without animation). Poly Haven has no fish,
  Poly Pizza's are low-poly, and NOAA had none. Sketchfab and model
  generators such as Meshy need an account, and the Smithsonian's 3D
  collection turned this computer's requests away and its API needs a
  key; I may not make accounts or get keys. Two
  open sets have fish of unclear origin: ir-engine's ocean models claim
  CC0 with no record of each model's source, and several of their names
  read like prompts to a generator; another repository's fish were made
  by a generator. Real-looking fish under CC BY 4.0, free without an
  account, are in two places: Babylon.js's asset library (a grey
  snapper from its underwater demo, a shark, and a fish; not yet looked
  at closely), and Objaverse, the Allen Institute for AI's copy of
  about 800,000 of Sketchfab's free models on Hugging Face (each keeps
  its author and licence; 721,000 of them are CC BY 4.0).
  a: CC BY 4.0 fish, credited as the shoe was (the about page, the
  credits, and THIRD-PARTY), from those two places, and the
  Barramundi; CC BY 4.0 or CC0 only, never "non-commercial", "no
  derivatives", or "share alike". I pick 5 to 10 kinds, fish that come
  with their own swimming animation first, and show you their pictures
  and credits before building the tank around them (recommended:
  real-looking, and no account). b: CC0 only: the Barramundi with
  low-poly CC0 fish (not real-looking). c: you choose the fish (for
  example on Sketchfab, with your own account) and put the files in a
  folder, and I prepare and credit them.
- Q2, the aquarium's shape. a: a walk-through tunnel under a big tank
  (recommended: water all round and overhead, and the fish pass over
  you; the water's haze is simplest to get right from inside it). b: a
  dark gallery in front of one big window. c: a home tank on a stand,
  to orbit.
- Q3, how the fish move. a: by the site's script, with the scene API as
  it is and animation speed: wandering, schooling, and steering to
  food (recommended: more lifelike than loops, and feeding needs the
  script anyway); movement along paths moves to the ideas for later
  versions. b: a `path` element in the language: each fish follows a
  loop, and the script takes fish off their loops to feed.
- Q4, the water's look. a: the `water` element above (recommended: the
  page says where the water is and how clear it is; the renderer draws
  the haze and the moving light). b: only what 0.2 has now: blue light
  and a blue background (much less real). c: more general, separate
  pieces: fog for the whole scene, and a light that casts a moving
  picture (more for each page to set up, and fog cannot stop at the
  glass).
- Q5, sounds from a place. a: in 0.2 now, for the air stones and the
  feeder (recommended: small, and the spec promises it for 0.2). b:
  later; the aquarium's sounds come from everywhere, as sounds do now.
- Q6, tagging HoloML 0.2. a: after you accept this milestone, and when
  you say go, holoml's main is tagged v0.2.0 with a short release note
  on GitHub, as the browser's v0.9.0 was (recommended). b: 0.2 stays a
  draft until the documentation milestone (22).
- Q7, the automatic builds' time. a: split the end-to-end checks on
  each system into two jobs that run side by side (recommended: Linux
  from about 39 minutes to about 20, with room to grow). b: raise the
  limit from 45 minutes to 60.

### Tasks

- [x] 1. HoloML 0.2, fifth part: SPEC.md (water, sounds from a place,
      animation speed; paths to the ideas for later versions), the
      checker, and conformance samples (holoml branch `aquarium`).
- [x] 2. The browser: water, sounds from a place, and animation speed;
      the copy (`pnpm holoml:sync`, from holoml's `aquarium` branch for
      now).
- [x] 3. The fish (Q1): chosen, checked (licence, size, triangles),
      credited, and prepared (a swimming animation for those without
      one); shown to the owner before task 4 (approved, prompt 123).
- [x] 4. The aquarium: the tank and the tunnel, rocks, plants, bubbles,
      sounds, the script (swimming, feeding, and the fish's panel), and
      the about page; published with GitHub Pages when holoml's pull
      request is merged.
- [x] 5. The examples section and the start panel: its card, its
      picture, and its row.
- [x] 6. The automatic builds (Q7): the end-to-end checks in two parts
      side by side on each system (ci.yml and vitest.e2e.config.ts,
      written; the automatic builds of the pull request will show it).
- [x] 7. Checks X1 to X12 (tests/e2e/m21.e2e.ts, holoml's tests), run on
      Windows, with `pnpm test:linux`, and in the automatic builds.
- [x] 8. Documents: both READMEs, SPEC, ARCHITECTURE, docs/privacy.md,
      THIRD-PARTY, AGENTS testing, HANDOFF; screenshots and the
      README's pictures.
- [x] 9. HoloML 0.2 tagged (Q6), after the owner accepts the milestone.

### Checks (named X; milestone 20 used W)

| # | Check | Expected result |
|---|---|---|
| X1 | The language | holoml's tests: water, sounds from a place, and animation speed have valid and problem samples; a 0.1 page may not use them; the spec lists nothing still to come in 0.2 |
| X2 | Water | Through the water a far model takes more of the water's colour than a near one, and a model outside the water keeps its own (the page's pixels); the light moves over a floor in the water, and holds still with reduced motion; drawing in software it may be left out, and the console says so. Since the review of 2026-09-30, drawn in software the check reports "skipped", not "passed" |
| X3 | Sounds from a place | A sound with a position is quieter as the viewer walks away from it, and silent beyond its range; it comes from its side (the sound's report) |
| X4 | Animation speed | A script's animation speed makes a model's animation run that much faster, and 0 holds it still |
| X5 | The aquarium | Ready and drawn within 5 s from 127.0.0.1 with a graphics card (logged in software); every model loaded, no problems; the fish swim (their places change) and stay in the water, clear of the tunnel and the rocks; the tunnel's walls stop the walker. Since the review of 2026-09-30, drawn in software the check reports "skipped", not "passed" |
| X6 | Feeding | Feed (a click, and Enter on its button) drops the food; fish come to it and eat every flake within a minute; the sound plays |
| X7 | The fish | A click on a fish, and its button in the outline, shows its name and its lines on the panel. Since 2026-09-30 the check names the hawksbill sea turtle, which took the flatback's place (the review, E1) |
| X8 | For everyone | The whole visit from the keyboard; screen readers name the fish and the Feed button; the text view; reduced motion (everything holds still, and Feed says the fish have eaten) |
| X9 | Efficient | At least 30 frames a second while the fish swim, with a graphics card (logged in software, as T5); no frames in a hidden tab, and none while idle with reduced motion; the page's memory does not grow over two minutes of bubbles and feeding. Since the review of 2026-09-30, drawn in software the check reports "skipped", not "passed" |
| X10 | Published | From its public address in the built app (by hand, as W11) |
| X11 | The automatic builds | Each job finishes within its limit (Q7) |
| X12 | Regression | The full run on Windows, `pnpm test:linux`, the unit tests, holoml's tests, and the automatic builds |

### Decisions made while building

- Water: the haze is the length of the view's way through the water's
  box over its clarity, so what is seen through the water takes its
  colour in proportion, from inside the water or from outside through
  glass; labels and panels are left as they are, to be read (holoml
  7d17c35). The moving light goes on lit materials only, strongest on
  faces turned up to the surface and fainter with depth; it holds still
  with reduced motion and is left out drawing in software (the console
  says so), as shadows are.
- Sounds from a place: Web Audio's panner (equal power), the loudness
  falling in a straight line to nothing at the sound's range, full
  within a metre; the listener is the viewer, facing where the viewer
  looks. The page's hook soundLevels(id) reads what each ear hears, for
  X3.
- The fish (Q1 a): from Babylon.js's asset library, Objaverse's copies
  of Sketchfab's CC BY models, and Khronos's Barramundi. The site's
  tools convert five that use an old material form
  (specular-glossiness), turn each head to +z, size it to its length,
  and give the six without a swim a skeleton (a chain of bones along the
  body) and a wave from head to tail (the tuna's only behind its
  middle); the turtle's own skeleton gets flipper strokes.
- The tank: 24 m wide, 34 m long, and 6.5 m deep, with a glass tunnel
  26 m long (2.4 m in radius) along its floor and a gallery at the
  entrance; its walls, painted in the water's colour behind rockwork,
  fade into the water. Ledges along the tunnel and a rail at its end
  keep the walker off the glass.
- The fish swim by the site's script (Q3 a, aquarium.js): each heads
  for a wandering goal within its kind's depths at its kind's pace and
  turns no faster than its kind can; the small kinds keep together in
  schools; all keep clear of each other, the tunnel, the rocks, and the
  walls, and are pushed back if they ever cross; a fish's tail beats
  faster as it swims faster (`animationSpeed`, 0.5 to 2.5 times).
  Feeding drops 24 flakes from the surface by the feeder; the nearest
  fish that eat (not the sharks or the turtle) turn to the nearest flake
  within reach and eat it. A flake that reaches the sand stays there,
  and the corner of the screen says how many did.
- A click on the tunnel's glass finds the fish behind it (the script's
  own ray through the glass, since the glass is the nearest thing), and
  each kind's first fish is a click action with a sound, so that it is
  a button in the outline for the keyboard and screen readers.
- Found while building, in the viewer: new materials' shaders compile
  without blocking the page, a page behind another tab draws nothing,
  and the water's moving light samples a picture drawn once
  (ARCHITECTURE.md). Since a page is now ready before its shaders have
  compiled, X5 times the aquarium to its first drawn frame.
- Triangles (found on Linux, where the tank drew in software at a frame
  or so a second): a fish or a Poly Haven model may have at most so many
  triangles (fish.mjs and prepare.mjs; the shark 12,000, the turtle
  14,000, the mackerel 4,000, the boulder 5,000, the log 6,000, the
  shell 3,000); a more detailed file is made lighter by joining its
  vertices by place, one vertex for each part of its picture at each
  place, keeping a skeleton's joints and weights, and small parts such
  as eyes whole. Looked at beside the approved fish, they are the same;
  the mackerel's outline is a little less smooth close up.
- A page compiling shaders is not yet idle: since shaders compile
  without holding up the page, it draws once they are ready, which can
  be seconds later drawing in software. The checks that count an idle
  page's frames (P10, S6, U15, V10, W10) start from the harness's
  sceneStill: drawn, no shaders compiling, and the frame count holding.
  They check the same: an idle page draws nothing.
- The aquarium's checks may take up to 600 s each (TANK_TIME), as drawn
  in software they take minutes; not a requirement, as with
  Blockworld's. X9 counts frames once the page has been told its tab is
  behind (its hook `behind`), after a frame it had begun has finished.

### Results so far

- Task 3 (the fish, 2026-09-29): Sketchfab's public search (no account)
  for CC BY fish, matched with Objaverse's copies (its index and
  licence records on Hugging Face), Babylon.js's asset library, and
  Khronos's Barramundi; 17 candidates downloaded, looked at in the
  viewer's own Three.js, and 9 picked: 8 kinds of fish and a sea
  turtle, every one CC BY 4.0 or CC0 in Objaverse's record of when it
  was copied. Five use an old material form (specular-glossiness) that
  three.js no longer reads, and one carries colours for Babylon.js's own
  animation: the site's tools convert them. Sent to the owner for
  approval before the tank is built (the plan's check-in), and approved
  (prompt 123); the models are committed in holoml (2140889).
- The fish's tools (holoml `aquarium`, 90c3790): fish.mjs (the nine,
  each at a fixed version with its checksum and credit), download.mjs
  (all nine fetched and matching), and prepare.mjs with glb.mjs,
  fit.mjs, and rig.mjs. Prepared, the nine are 11.8 MB (48 MB as
  downloaded), each its length in metres with its head to +z, as drawn
  in the viewer's own Three.js: the shark and the bream keep their own
  swims; the barramundi, snapper, mackerel, clownfish, butterflyfish,
  and tuna get a skeleton and a wave from head to tail (the tuna's only
  behind its middle, as tuna swim, and straightened, as its file had it
  turned 17 degrees); the turtle's own skeleton gets flipper strokes.
  The model files were committed once the owner approved the fish
  (2140889).
- Task 1 (holoml `aquarium`, ed72075 and 7d17c35): SPEC.md, the
  checker (a size of three numbers more than 0, a range that needs a
  position, at most one water in a scene), a valid sample
  (v02-water-and-sound-places), a problem sample (bad-water), and the
  0.1 sample that may not use water; holoml's tests 209 passed, lint and
  types clean. Found while building: water leaves labels and panels as
  they are, to be read (7d17c35).
- Task 2: water.ts (the haze and the moving light in the materials'
  shaders), sound.ts (a panner and each ear's level for a sound from a
  place), scene.ts and api.ts (the water, a sound's place, a model's
  animation speed), and the page's hooks (water, waterFadeAt,
  soundLevels). Unit tests 273 passed (five new: the way through the
  water, its fade, its light, which materials it goes over, and the
  loudness with distance); lint and types clean.
- X2 to X4 (tests/e2e/m21.e2e.ts, fixture pages water.holoml,
  caustics.holoml, sound-place.holoml, and animation-speed.holoml): all
  pass on Windows with the graphics card and drawing in software
  (HYPERSOL_TEST_SOFTWARE=1; there the moving light is left out, as the
  check expects). X3 reads the real sound in each ear (Web Audio
  analysers): 4 m to the right, the left ear hears under a fifth of the
  right; 13 m away, past its 12 m range, silence.
- Task 4 (holoml `aquarium`, b1116c7 to 54f174a): the ocean tunnel, as
  in the decisions above: 30 fish of nine kinds (2 great white sharks, a
  flatback sea turtle, 2 tuna, 2 barramundi, 6 gilt-head bream, 8
  Atlantic mackerel, 4 grey snapper, 3 clownfish, and 2 copperband
  butterflyfish), rocks, rockwork, a log, shells, and sand from Poly
  Haven, swaying plants, bubbles from three air stones (18 each), each
  heard from where it rises, feeding, a board about each kind, the
  about page with the credits, and index.html for other browsers. The
  sounds (the water, the bubbles, the food's plop, and a blip) are made
  by tools/prepare.mjs. Published, it is 16.5 MB in 36 files (the
  models 15.9 MB). holoml's tests 215 passed (six new: its two pages,
  and its files and limits, its fish and their swims, its water and
  Feed button, and its credits).
- Found while building (the browser, 450e733): the aquarium's 40 or so
  shader programs compiled one after another on the page's main thread
  (3.7 s; on the screen after 4.9 s), so new materials now compile
  without blocking it; a HoloML page in a tab behind another still drew
  about a frame a second (Chromium counts a tab hidden by style as
  seen), so the shell now tells the page, and it draws nothing; and the
  water's light samples a picture drawn once, as computing it in the
  shader took seconds to compile on Windows for each material. The
  HoloML checks of milestones 14, 18, and 20 then caught clicks and
  screen points going astray while shaders compiled (the scene's places
  were not kept current meanwhile), fixed in the same change; holoml's
  SPEC.md says a page that cannot be seen need not be drawn (f7650ce).
- Task 5 (bd3fca3): the copy from holoml's `aquarium`, the card
  ("Ocean tunnel") and its picture (`EXAMPLES_ONLY=aquarium pnpm
  screenshots:examples`, taken again after the light changed, 31aed53),
  and the row; T8 with the new card and row passes.
- X5 to X9 (tests/e2e/m21.e2e.ts): all pass on Windows with the
  graphics card. X5: ready in 1636 ms and drawn in 2785 ms.
- HoloML 0.2 complete (holoml 682b64e): SPEC.md, the README, and the
  examples no longer call it a draft, and spec.test.ts checks that no
  sentence about 0.2 does, nor lists anything still to come in it
  (X1); holoml's tests 217 passed. Its NOTICE credits the fish
  (58607f1); the copy is synced from it (b90432b).
- The HoloML checks after the viewer's changes (milestones 14 to 21):
  102 passed (8 minutes).
- The full run on Windows (`pnpm test:e2e --reporter=verbose`,
  2026-09-29, 15.5 minutes): 278 checks, all passed, the clipboard's
  among them. Logged: X5, the aquarium ready in 2182 ms and drawn in
  3614 ms; X6, none of the 27 fish that eat within 3 m of the feeder
  before the food fell, and 3 came to it; X9, 145.5 frames a second
  while the fish swim, and over two minutes of bubbles and feeding the
  page's heap 11.6 MB then 11.9 MB, and its ArrayBuffers 10.8 MB both
  times. The unit tests 273 passed; lint and type check clean.
- Documents (31aed53): both READMEs, SPEC, ARCHITECTURE, CHANGELOG,
  docs/privacy.md, THIRD-PARTY, and AGENTS.md's testing list; the
  screenshots (docs/screenshots/m21: the tunnel, the shark's board, and
  feeding are 61 to 63) and the README's four pictures again, looked at.
- The full run on Linux on this computer (`pnpm test:linux`,
  2026-09-29, 53 minutes): lint and the unit tests pass (271, and 2
  skipped: the copy's checks against holoml beside it), and 274 of 278
  end-to-end checks pass, 1 skipped; X7, X8, and X9 failed. Drawn in
  software the aquarium made 1.5 frames a second: X7 and X8 ran out of
  their time (240 s and 300 s), and X9 counted two frames drawn before
  the page was told its tab was behind. The m21 file took 21 minutes.
- The pull requests (2026-09-29): holoml #19 and the browser's #38. The
  browser's automatic builds, the first in two parts on each system:
  Linux part 1 passed in 21 min 40 s, Windows part 1 in 15 min 34 s,
  and Windows part 2 in 10 min 51 s; Linux part 2 failed as on this
  computer, in 31 min 21 s (X5 drawn in 10.6 s there, X9 at 2.5 frames
  a second). holoml #19's Windows build failed: the aquarium's credits
  test split the file's lines on \n alone, and Git gives it Windows line
  ends there (fixed, 7469fb1).
- The fix: the most detailed models made lighter (holoml 43c5b30, as in
  the decisions above): from the tunnel 191,000 triangles in view
  (577,000), drawn in software on this computer 2.1 frames a second
  (0.87); published, the aquarium is 11.7 MB (the models 11.0 MB). The
  copy synced from it, the example's picture taken again, and the
  checks' time and X9's wait as above. Then: m21 in software on this
  computer, all 8 passed (6 minutes); with the graphics card X2 to X9 and
  T8 passed (X5 ready in 1307 ms and drawn in 2801 ms, X9 143.5 frames a
  second, the page's ArrayBuffers 6.2 MB where they were 10.8); and
  `pnpm test:linux tests/e2e/m21.e2e.ts`, all 8 passed (18 minutes, X7
  5.3 of them; X5 drawn in 17.3 s; X9 1.0 frames a second, and the heap
  11.1 MB then 11.3 MB).
- The automatic builds on the fix (d6b168d, 2026-09-29): every job
  within its 45 minutes (X11). Linux part 1 passed in 19 min 29 s and
  Windows part 2 in 11 min 5 s. Linux part 2 took 32 min 13 s: every
  m21 check passed there (17 minutes; X5 ready in 10.3 s and drawn in
  13.3 s, X9 1.0 frames a second and the heap 11.0 MB then 11.2 MB), and
  V5 (milestone 19) failed: the arriving page was busy for about 5 s
  drawing in software, so no picture of it came back before its fade-in
  began (in this pull request's first build, with the same viewer, it
  was not busy and V5 passed). Windows part 1 failed E6b (milestone 3):
  quitting took 6551 ms where 6000 are allowed. Both failed jobs run
  again: Linux part 2 passed (31 min 56 s), and Windows part 1 failed
  #10 (milestone 8): five of the 100 small downloads had all their bytes
  but were not marked finished within the minute (E6b passed). None of
  the three touches this milestone's changes, and each passed before on
  the same code; they are not changed.
- Prompt 124: holoml #19 merged (710d8b9), and GitHub Pages published
  it. The copy synced from holoml's main (only SOURCE.json and the
  copied files' first lines changed). X10: the built app opened
  https://srajpal.github.io/holoml/aquarium/index.holoml#tunnel from the
  internet: ready in 3751 ms and drawn in 3955 ms, 171 models loaded,
  no problems, 12.1 MB counted, the water's light shown; the fish swam
  (1.2 to 2.2 m in 3 s); Feed dropped the food and the fish ate it; the
  great white shark's button told about it on the board; the about page
  opened with its credits.
- The automatic builds on a860c28: both Windows jobs failed. Part 1: two
  unit tests ran out of their 5 s on a slow machine (the password
  vault's "Clear data" and the storage service's bad requests; 21 s for
  all the unit tests, where they take 13 to 15). Part 2: U15 (milestone
  18) counted one frame in its idle window: U14 had changed the sofa's
  choices, and the new shaders, compiled without holding up the page,
  were ready and drawn after U15 had begun, drawing in software. Fixed
  as in the decisions above; P10, S6, U13 to U15, V10, and W10 pass
  drawing in software on this computer and with the graphics card.
- The automatic builds on 0683a98 passed, every job within its 45
  minutes (X11, X12): Linux part 1 in 17 min 56 s and part 2 in 33 min 0
  s, Windows part 1 in 18 min 1 s and part 2 in 11 min 14 s. The owner
  merged the browser's #38 and accepted the milestone (prompt 125).
- Task 9 (prompt 126): holoml's main (710d8b9, the merge of #19) tagged
  v0.2.0 (annotated, as v0.1.0 and v0.1.1 were) and published as a
  GitHub release, "HoloML 0.2", with the release note the owner approved
  (https://github.com/srajpal/holoml/releases/tag/v0.2.0; not a
  pre-release). Every link in the note answers. The browser's copy of
  HoloML now comes from the tag (the same commit; only SOURCE.json and
  the copied files' first lines change).

### Done when

- X1 to X12 pass, screenshots are saved, and the owner accepts; then
  HoloML 0.2 is tagged (Q6).

## Milestone 22 — HoloML documentation

Status: Done, accepted 2026-10-07 (prompt 160: "checked the docs, very good"; Y6's reading with a screen reader by hand cleared by the owner, 2026-10-09, prompt 186). Built; checks ran from 2026-09-29. Planned (prompt 127): the owner asked for this
plan, and for HoloML's features to be checked while the documents are
made, with a plan for anything missing; that check was done for the
draft (below). The owner answered Q1 to Q7 with the recommendations and
approved the build (prompt 128). Rule 13 check done (ARCHITECTURE.md
section 3). By Q4 a, milestone 23 is now "HoloML 0.3" (the features
found missing), and the milestones after it moved one number on.

Goal: HoloML documented to recognised standards (prompt 115): a
specification written as W3C specifications are, with a formal grammar
and the scene API in the standard notation, and guides organised as
tutorials, how-to guides, reference, and explanation, published with
GitHub Pages at https://srajpal.github.io/holoml/ (where there is no
page today). With them, the features checked against the documents, and
what is missing planned (prompt 127).

### How it would work (proposed)

- **The specification.** holoml's SPEC.md stays the source, reviewed in
  pull requests; a build turns it into the published page. It follows
  W3C practice, though HoloML does not go through W3C's process:
  - An abstract, the status of the document (0.1 and 0.2 final; how to
    comment: GitHub issues), and a table of contents.
  - Conformance: the requirement words of BCP 14 (RFC 2119 and RFC
    8174: MUST, SHOULD, and MAY, in capitals, only where they are
    requirements), the classes that conform (documents, checkers, and
    renderers, each with what it must do), and which parts are
    normative (examples and notes are not).
  - Terminology, and the processing model in one place: reading a page,
    checking it, building the scene, loading, and drawing.
  - A formal grammar (Q2): the text syntax in ABNF (RFC 5234), and the
    structure (which element may hold which, and each attribute's
    values) as a RELAX NG schema made from the checker's own table, so
    that the two cannot drift apart.
  - The scene API in Web IDL (the notation W3C and WHATWG
    specifications use for web APIs), beside its tables.
  - Considerations, as W3C's reviews ask: security (from today's
    "Safety"), privacy (after W3C's security and privacy
    questionnaire), accessibility, and internationalization.
  - IANA considerations: the media type `model/vnd.holoml` in RFC
    6838's registration template (Q5).
  - References (normative: glTF 2.0, the URL standard, Web IDL, BCP 14,
    and Unicode; informative), an index of every element and attribute,
    the changes between versions, and acknowledgements.
  - The clarifications the feature check calls for (below), marked as
    such; what a page means does not change (Q6).
- **The guides**, organised by Diátaxis (a documentation framework that
  keeps four kinds of writing apart):
  - Tutorials: "Your first HoloML page" (a model, a place to stand,
    light, a label, and a link, opened in HyperSpace 3D), and "Your
    first script".
  - How-to guides, one task each, drawn from the example sites: models
    and materials; walking, walls, and gravity; lights, shadows,
    textures, surroundings, and sky; sound, and sounds from a place;
    text in the scene and on the screen; sliders and choices; doors and
    lamps; places and a floor plan; big sites (loading by area,
    stand-ins); water; preparing glTF models (size and triangles, as
    the aquarium taught); and publishing a site (a web server, the
    media type, GitHub Pages).
  - Reference: the specification; a page for each element (made from
    the checker's table and the specification); the scene API; the
    syntax error and problem codes; and HyperSpace 3D's limits, as one
    renderer's.
  - Explanation: why HoloML; how a renderer shows a page; the safety
    model; accessibility in 3D; and versions and what comes next.
  - Every HoloML example in them is checked by holoml's tests.
- **The site** (Q3, Q7): a home page at https://srajpal.github.io/holoml/
  (what HoloML is, the example sites with their pictures, the
  specification, and the guides), the specification at /spec/, and the
  guides under /docs/; the example sites stay at their addresses. Plain
  pages, light and dark, usable with the keyboard and screen readers
  (WCAG 2.2 AA), fetching nothing from other sites; built by holoml's
  Pages workflow.
- **The browser**: the examples section's link to the specification
  goes to the published specification instead of SPEC.md on GitHub.

### What the feature check found (prompt 127)

Done for this draft on 2026-09-29, and repeated at the end over the
finished documents.

- What matches: every element and attribute in the checker's table is
  used by HyperSpace 3D's viewer, except `meta` (the browser shows
  neither a page's description nor its author); every member in the
  scene API's tables is in the viewer's API; and every element and
  attribute has a valid conformance sample (a test already checks it).
- Missing from the specification, to be clarified in this milestone
  (no new features):
  - Which glTF 2.0 extensions a renderer reads. Files that need decoding
    (Draco or meshopt geometry, KTX2 pictures), common on the web, do
    not load in HyperSpace 3D, and nothing says whether they should.
  - What a renderer owes screen readers and the keyboard, now written
    element by element; the accessibility section gathers it.
  - The sections a standard has and HoloML's does not: conformance
    classes, terminology, security, privacy, accessibility, and
    internationalization considerations, references, and an index.
- Missing features (Q4):
  1. Names for models and groups. Screen readers and the text view hear
     a model's id or file name ("shark-1", "boulder.glb"); sounds, click
     actions, choices, places, and plans have a `label`, and models and
     groups do not.
  2. The language and direction of text: there is no `lang` or `dir`,
     so a page in another language, or with right-to-left text, cannot
     say so.
  3. Compressed models (Draco, meshopt, KTX2) in HyperSpace 3D: three.js,
     already used, has the decoders.
  4. Level of detail: a lighter model shown far away (the aquarium had
     to thin its models by hand).
  5. The scene API: scripts cannot start or stop an `animate`, go to a
     place or know which one the viewer is at, or change the water.
  6. A page's description (`meta`): HyperSpace 3D could show it, for
     example on the examples section's cards or in a tab's tooltip.
  7. Already listed for later versions: movement along paths, physics,
     named colours, styles shared between elements, and spaces shared by
     several people.

### Questions (answered with the recommendations, prompt 128)

- Q1, the specification's form. a: W3C style, as above (recommended:
  the conventions of web standards, which HoloML's readers know). b:
  IETF style: an Internet-Draft in RFC format, as plain text. c: today's
  plain Markdown, with only the missing sections added.
- Q2, the formal grammar. a: ABNF for the syntax, and RELAX NG (its
  compact form) for the structure, made from the checker's table
  (recommended: each is a standard, and the table keeps them true). b:
  XML Schema for the structure (HoloML is not XML, as an attribute may
  be written alone, so it would describe only the tree). c: JSON Schema
  for the tree a reader produces (what the conformance samples hold).
- Q3, making the pages. a: a build script in holoml with one new
  development package, `marked` (a Markdown reader, MIT licence, with
  no dependencies of its own; recommended). b: the same script with a
  Markdown reader written in the repository (no package, more to keep
  up). c: GitHub Pages' own Jekyll (Ruby, run on GitHub's side; the
  pages could not be built on this computer without installing it).
- Q4, the missing features. a: a new milestone after this one, "HoloML
  0.3", with features 1 to 6 and their checks, its plan drafted when
  this milestone ends, and the later milestones one number on
  (recommended: this milestone documents 0.2 as released, and new
  features need their own checks). b: add them to this milestone. c:
  list them in the roadmap only, for later.
- Q5, the media type. a: its registration template in the
  specification; registering it with IANA waits (recommended: a
  registration is public and lasting, and the owner's to make). b: also
  send the registration to IANA (a form on iana.org, in the owner's
  name).
- Q6, the clarifications. a: in 0.2's text, marked as clarifications
  with a note of the changes, and holoml tagged v0.2.1 when the
  milestone ends, on the owner's go (recommended: nothing a page means
  changes). b: leave 0.2's text as released, and put them into 0.3.
- Q7, where the documents live. a: in the holoml repository, published
  at https://srajpal.github.io/holoml/ (recommended). b: a repository of
  their own.

### Tasks

- [x] 1. The specification in W3C style (Q1): the sections above, BCP
      14, conformance classes, the considerations, IANA (Q5),
      references, the index, the changes, and the clarifications (Q6);
      holoml's tests keep it true (holoml `docs`, 3dadd41; the index,
      f69af9f).
- [x] 2. The formal grammar (Q2): ABNF, and the RELAX NG schema made from
      the checker's table, with tests (3dadd41).
- [x] 3. The scene API in Web IDL, with tests that it, the tables, and
      HyperSpace 3D's API list the same members (3dadd41; the browser's
      api.test.ts, f2c5973).
- [x] 4. The guides (Diátaxis): tutorials, how-to guides, reference, and
      explanation, every example checked by the tests (39a8ca5; the
      reference pages made from the code, f69af9f).
- [x] 5. The site (Q3, Q7): the home page, the specification, the guides,
      and the example sites; accessible, light and dark, and nothing
      fetched from other sites; published by holoml's Pages workflow
      (f69af9f and cdad9a4; published when holoml's pull request is
      merged).
- [x] 6. The browser: the examples section's link to the published
      specification, and T8 (f2c5973).
- [x] 7. The feature check repeated over the finished documents, and what
      is missing planned (Q4) in the roadmap (below; milestone 23).
- [x] 8. Checks Y1 to Y10, run on Windows, with `pnpm test:linux`, and in
      the automatic builds.
- [x] 9. Documents: both READMEs, ARCHITECTURE, CHANGELOG, HANDOFF, and
      AGENTS.md's testing list; screenshots, with the documentation in
      the browser; holoml tagged on the owner's go (Q6; the tag is
      v0.2.2, after the review's fixes). (Both ticked 2026-10-07, prompt
      162: done, and the milestone accepted in prompt 160.)

### Checks (named Y; milestone 21 used X)

| # | Check | Expected result |
|---|---|---|
| Y1 | The specification's form | An abstract, a status, conformance with BCP 14 and its classes, terminology, the processing model, the four considerations, IANA considerations, references, an index, and the changes; holoml's tests: the requirement words are in capitals and only in normative text, and the index lists every element, attribute, error code, and problem code |
| Y2 | The grammar | The ABNF covers every construct the parser reads, and names the rule each syntax error code breaks; the RELAX NG schema is the one made from the checker's table (a test makes it again and compares) |
| Y3 | The scene API | Its Web IDL and its tables list the same members, and HyperSpace 3D's API has every one (a test in each repository) |
| Y4 | The guides | All four kinds are there; every HoloML example in them passes the checker; every link within the site answers |
| Y5 | The site | https://srajpal.github.io/holoml/ answers with the home page, /spec/ with the specification, and the guides and example sites at their addresses; no page asks anything of another site |
| Y6 | For everyone | Headings in order, text for every picture, colour contrast to WCAG 2.2 AA in light and dark, and every page usable with the keyboard alone; read with a screen reader (Narrator) by hand |
| Y7 | The browser | The examples section's specification link opens the published specification; T8 passes |
| Y7b | A very tall page | (Added while building, as the specification, 52,000 pixels tall, drew blank in the layers view.) A section too large to draw as one lifted layer stays flat and draws, and the page's other sections still lift (tests/e2e/m22.e2e.ts) |
| Y8 | The feature check | Repeated over the finished documents; every gap is in the roadmap with its plan (Q4) |
| Y9 | Published | The site from its public address (by hand, as X10) |
| Y10 | Regression | The full run on Windows, `pnpm test:linux`, the unit tests, holoml's tests, and the automatic builds |

### Decisions made while building

- The specification's index (elements, attributes, terms, and codes) is
  made from the checker's table, the codes, and the terms by `pnpm
  reference:update`, which also writes three reference pages: elements
  and attributes (which there are and where each may be, from the
  checker's table; the words from the specification), the scene API
  (each member with its declaration in Web IDL and the words of
  section 10's tables), and the codes (with the conformance samples
  that show each). It stops when the specification and the checker
  disagree on an attribute being required or new in 0.2; they agreed on
  every one. The reference pages write the specification's requirement
  words in lower case, as the guides leave those words to the
  specification.
- The site links pages by relative addresses with their file names
  (`docs/how-to/index.html`), so `_site/index.html` opens from the disk
  as well as from GitHub Pages; headings get GitHub's anchors, so the
  same links work on GitHub and on the site; links to other files of
  the repository (the example sites' sources, the grammar files, the
  conformance samples) go to GitHub. The pages have no scripts at all,
  use the system's fonts, and follow the system's light or dark
  setting. Code is coloured (HoloML, JavaScript, and the grammars'
  comments), and tables scroll in regions the keyboard reaches.
- The home page links each example site to its address, whose index.html
  tells a browser without HoloML where to find index.holoml, as the
  READMEs do.
- The guides were drafted by three helper agents from a brief (plain
  English, British spelling, facts only from SPEC.md and the example
  sites), then every page was read against SPEC.md, the example sites
  and their tools, and HyperSpace 3D's code, with 13 changes in 10
  pages (for example: a floor plan is a picture that screen readers name, not
  something Tab reaches; where the walker starts without a viewpoint;
  which loft light a snippet showed). The publishing guide's check
  script was run on a valid page, a page with problems, and one with a
  syntax error.
- The browser's screenshots show the documentation from a pages-only
  build of the site (`node site/build.mjs <folder> --pages-only`,
  856 KB without the example sites), made into an ignored folder of the
  fixtures and removed afterwards.
- holoml's packages are now at version 0.2.1, for the tag at the end;
  they had stayed at 0.1.1 through v0.2.0.
- `pnpm holoml:sync` ends git's revisions with `--`: holoml's new docs/
  folder made the branch name `docs` ambiguous.
- Found in the screenshots: in the layers view (on by default), the
  specification drew nothing below its top bar. Its main section, 52,000
  pixels tall, was lifted as one 3D-transformed layer, and Chromium draws
  nothing of a layer larger than the graphics card can hold. Measured on
  this computer (device pixel ratio 1), a lifted section of 10,900
  pixels drew, with the graphics card and in software, and from about
  13,800 it drew partly or not at all. A section or picture larger than
  8,192 device pixels (CSS pixels times the pixel ratio) now stays flat,
  and the rest of the page still lifts (3249591; check Y7b, which fails
  without the limit).

### Results so far

- holoml (branch `docs`): 362 tests passed on Windows on 2026-09-29
  (Y1 to Y6 in part: the specification's form, requirement words,
  references, links, and index; the grammar; the Web IDL and the
  tables; every HoloML example in the specification (more than 25) and
  the guides; the reference pages up to date; and the site: every link
  and anchor within it, nothing asked of another site, one title and
  headings in order on every page, text for every picture, code and
  tables reachable by the keyboard, and every colour pair at WCAG 2.2 AA
  in light and dark). Lint and types clean.
- The site, looked at in the built-in browser from 127.0.0.1: the home
  page's example cards, the specification's contents, and the guides,
  light and dark; at 375 pixels wide no page scrolls sideways (the wide
  tables scroll in their own regions), and at desktop width no table
  does.
- The browser: unit tests 289 passed (16 new: api.test.ts, Y3, and the
  layers view's size limit); lint and types clean.
- The full end-to-end run on Windows (2026-09-29, before the layers
  fix): 278 checks in 21 files passed in 14 minutes 45 seconds, T8
  with the new address included (Y7). After the fix, the layers view's
  checks G1 to G9 and Y7b passed (14).
- Screenshots (`MILESTONE=m22 pnpm screenshots`, after the fix): 66
  pictures, 64 to 66 new: the site's example sites, the specification,
  and a how-to guide, in the browser. The README's four pictures
  refreshed (`pnpm screenshots:readme`) and looked at.
- holoml's pull request is #20 (Auto-fix on, prompt 129); the browser's
  copy of HoloML is synced from its `docs` branch (c60840f).
- Prompt 133: holoml #20 merged (3ce0ab2); CI and the Pages workflow
  passed on main, and the copy is synced from holoml's main.
- Y5: from its public address, https://srajpal.github.io/holoml/ answers
  with the home page (the experimental note and the six example sites),
  /spec/ with the specification, and the guides, the style, the
  pictures, and each example site's index.holoml at their addresses;
  the example sites' tools are not published (404).
- Y9 (2026-09-29): the built app, let reach the internet for this check
  only, opened the home page; the HoloML examples section's link opened
  https://srajpal.github.io/holoml/spec/ (Y7 in use): 56,239 pixels tall,
  its status "experimental", its main section not lifted and its text
  drawn; a how-to guide with its HoloML coloured; and Harbour Loft from
  the published site, ready with no problems.
- `pnpm test:linux` (2026-09-29, on e856aad: the layers fix and the
  pictures, before the About dialog's line): lint and types clean, unit
  tests 287 passed (the copy's 2 comparisons with the holoml folder
  skipped, as it is not in the container), and end to end 278 passed and
  1 skipped (C9's frame rate, as decided for drawing in software) in 22
  files, in 49 minutes 35 seconds; Y7b passed there (the tall page's
  text drawn in software).
- D11 with the About dialog's new line: milestone 2's checks, 43 of 43,
  passed on Windows.
- The automatic builds on #39 (run 36665616826): Windows part 1 failed
  twice. Y7b waited for the header to lift, but on GitHub's Windows
  machine the page had less room, its main section covered most of it,
  and the layers view took it for a wrapper and lifted its paragraphs:
  the page drew, but the check assumed a window width. Its page now has
  a second tall section, so the body is the container at any width, and
  the check runs at 1280 by 800 and at 1024 by 700; it passes at both,
  and still fails without the size limit. I2 (milestone 7) counted 79
  bytes for its 877-byte page: not near this milestone's changes, and
  passed in every run before (this computer, Linux in Docker, and the
  automatic builds); left unchanged and reported, as milestone 21's
  intermittent checks were. main's automatic builds had failed
  intermittently since milestone 21 as well (V5's fade on Linux three
  times, and once each: milestone 3's quit after the shell's 2-second
  wait, check #10's slow download in milestone 8, and a key press in the
  top bar), reported to the owner.
- Prompt 134 (2026-09-30), a review of both repositories and of the
  automatic builds. The builds' time is the end-to-end checks drawn in
  software: in run 36667528292 Linux part 2 took 31 min 40 s (m21 16 min
  45 s of it, the aquarium at 1.0 frame a second), Linux part 1 20 min
  32 s, Windows 12 min and 9 min 25 s. The end-to-end checks now run in
  four parts on each system (vitest.e2e.config.ts and ci.yml: part 1
  everything not listed, 2 milestones 14 to 17, 3 milestones 18 to 20, 4
  milestone 21), with a last job, "All checks", that passes only when
  every part has; no check is dropped or changed. Each part selects its
  files on this computer (`vitest list`); not checked yet on GitHub,
  which needs a push (since: run in four parts on GitHub for every pull
  request). The review's findings, and what else would
  shorten the builds (each needing the owner's decision), are in
  REVIEW-2026-09-30.md, not committed, as it lists weaknesses not yet
  fixed.
- Y8, the feature check repeated over the finished documents: nothing
  missing beyond milestone 23's list. Found and fixed: SPEC.md's note
  on a page from the computer (it may load from its folder and the
  folders inside it), and the sneaker store's tool comment (its
  stand-ins have a ninth of the shoe's triangles, not a seventh).

### Done when

- Y1 to Y10 pass, the documentation is published, and the owner
  accepts; then holoml is tagged v0.2.1 on the owner's go (Q6). (The
  tag made was v0.2.2, the third edition, 2026-10-01; there is no
  v0.2.1.)

## Milestone 23 — HoloML for VS Code

Status: Done, accepted by the owner on 2026-10-05 (prompt 153). Built
(2026-10-03) and merged into holoml's main (pull request #32,
2026-10-05, a64f1a2); Z1 to Z10 done, the checks by hand by the owner.
Not done: task 9's screenshots of the extension at work for holoml's
README (the extension changes nothing in the browser, whose screens
stay as milestone 22 left them). Plan approved
(2026-10-02): the owner chose the recommended answers to Q1 to Q4; build
approved 2026-10-03. Rule 13 check done (ARCHITECTURE.md section 3). The owner asked for a VS Code
extension for HoloML, kept in the holoml repository (the owner chose
holoml when asked after prompt 146), with no live preview (that needs
the browser for now) and no publishing (installed by hand). The owner
approved the new development tools it needs with the request (listed
below). The features come from what well-regarded extensions for
markup languages offer (researched 2026-10-02; sources at the end of
this section).

Goal: writing a HoloML page in VS Code feels like writing HTML there.
The editor colours the syntax, underlines mistakes as you type with the
checker's own words, suggests the elements and attributes allowed where
the cursor is, explains them on hover, and keeps the start and end tags
in step. The checks are the same as HyperSpace 3D's, because they use
holoml's own parser and checker.

### How it would work (proposed)

- **Where it lives.** A new package in the holoml repository,
  `packages/vscode`, beside `packages/parser` and `packages/schema`,
  which it uses directly through pnpm's workspace, so there is no copy
  to keep in step. A change to the language and the matching change to
  the extension land in one pull request, and the extension's tests run
  on every pull request, with holoml's.
- **A language server.** The work is done in a language server: a
  separate process that speaks the Language Server Protocol (LSP), the
  standard way editors ask a language's tools for errors, suggestions,
  and the like. The extension itself only starts it. The extensions for
  XML, YAML, Vue, Svelte, Astro, Prisma, GraphQL, and TOML all work this
  way: the editor stays responsive, and the same server works in other
  editors (Neovim, Zed, Helix, Sublime Text) without being written
  again (Q2).
- **A language service under the server.** Every feature is a plain
  function from text to an answer (the errors, the suggestions at a
  place, the hover text), the way VS Code's own HTML support is built.
  The server is a thin layer over them, and Vitest tests them directly,
  as holoml's other code is tested.
- **Two ways of reading a page.** The checks use holoml's strict
  parser and checker, so the editor and the browser never disagree.
  The parser stops at the first mistake and records only where things
  start. Suggestions, hover, folding, and the outline must work in a
  page that is half typed, so they use a forgiving scanner of the
  extension's own. It finds tags, attributes, and where each ends, as
  VS Code's HTML support does. holoml's parser stays as it is, and so
  does the copy the browser uses (Q3).
- **Hover text from holoml's documents.** The descriptions of
  elements, attributes, and error codes come from the reference pages
  and SPEC.md, gathered into the extension when it is built. Nothing
  is read from the internet or from the documents at run time.
- **What it never does.** No telemetry, no network requests, and no
  files fetched from the links in a page (a link to a model only opens
  that file when it is on the computer). A test checks that the built
  extension contains nothing that reaches the network. It runs no code
  from the files it opens, so it is marked safe in untrusted
  workspaces.
- **Installing.** `pnpm --filter holoml-vscode package` makes a .vsix
  file, the file VS Code installs an extension from. To install it, use
  "Install from VSIX…" in the Extensions view, or run
  `code --install-extension` with the file. It does not need the VS Code
  Marketplace or an account. It asks for VS Code 1.96 or newer, so
  editors built on VS Code take it as well (on the owner's computer,
  `code` on the PATH is Cursor, which is built on VS Code 1.96). The
  extension has its own version number, starting at 0.1.0, and says
  which HoloML versions it knows (0.1 and 0.2 today).
- **The name.** "HoloML" in the Extensions view, and `holoml-vscode` as
  the package name. A .vsix needs a publisher field: it is set to
  `holoml` and not registered anywhere until publishing is approved.

### Features

First, in this milestone, ranked by what the research found most
useful against its cost:

1. **Syntax colours** (a TextMate grammar, the pattern file VS Code
   colours text with): tags, attribute names and values, comments, and
   character references, in the same colours as HTML in every theme.
2. **Editing basics** (language configuration): comment toggling
   (`<!-- -->`), quotes and brackets closed as you type, a selection
   wrapped in quotes, and indentation after a start tag.
3. **Mistakes underlined as you type**: the parser's syntax error and
   every problem the checker finds, in the Problems panel, with the
   checker's code and wording, and the whole word or tag underlined.
4. **Suggestions**: only the elements allowed inside the current one,
   each element's attributes, an attribute's choices (such as a light's
   kinds), and only what the page's `version` has.
5. **Help on hover**: what an element or attribute is and its values,
   from the reference pages, with the version it came in; and what an
   error code means.
6. **Snippets**: a new page, a model, a light, a place to stand, a
   link, and a label.
7. **Tags kept in step**: the end tag written when a start tag is
   finished, and the matching tag renamed while you type over one
   (linked editing).
8. **The outline and folding**: the page's elements in the Outline view
   and in breadcrumbs, and folding by element and by comment.
9. **Colours**: a swatch beside every colour value, and VS Code's colour
   picker writing `#rrggbb`.
10. **Names**: go to the element a `#name` reference points to, and find
    every reference to a name. A duplicate name is underlined (the
    checker's own problem).
11. **Links to files**: Ctrl+click on a model, picture, sound, script,
    or surroundings file opens it when it is on the computer.

Later (not in this milestone; listed for a future plan):

- Fixes offered on a mistake ("did you mean `<model>`?", add a missing
  required attribute, add `version`).
- Renaming a name and every reference to it at once.
- Formatting a page (keeping comments and spacing needs care).
- A forgiving mode in holoml's parser, so that several syntax errors
  show at once.
- Instructions for using the server in other editors.
- Publishing to the VS Code Marketplace and Open VSX (each needs an
  account, so the owner's approval under rules 3 and 4).
- A live preview, once the browser can provide one.

Left out on purpose: colours by meaning (semantic tokens) add little in
a tag language that the grammar already colours. JavaScript inside
`<script>` needs nothing, as HoloML's scripts are always separate files.

### Software to install (approved with the request, prompt 146)

All of it goes in holoml's `packages/vscode`, either for development
or bundled into the extension; nothing is installed on the computer
itself:

- `vscode-languageserver`, `vscode-languageserver-textdocument`, and
  `vscode-languageclient` (Microsoft's LSP libraries; bundled into the
  extension).
- `@types/vscode`, pinned to 1.96 to match the oldest VS Code the
  extension asks for.
- `@vscode/vsce`, which makes the .vsix file (nothing is published with
  it).
- `esbuild` (already in holoml through Vitest; now listed directly).
  It bundles the extension and its server into two files, so the .vsix
  carries no `node_modules`.
- `@vscode/test-cli` and `@vscode/test-electron`, which run tests
  inside a real VS Code window, and `mocha` with its types, which they
  use.
- `vscode-tmgrammar-test`, which checks the syntax colours against
  sample files (otherwise a wrong grammar fails silently).

As installed (2026-10-03): vscode-languageclient and
vscode-languageserver 10.1.2, vscode-languageserver-textdocument 1.0.15,
@types/vscode 1.96.0, @vscode/vsce 4.0.0, esbuild 0.28.2, @vscode/test-cli
0.0.15, @vscode/test-electron 3.1.0, @types/mocha 10.0.10, and
vscode-tmgrammar-test 0.1.3. Two differences from the list: `mocha`
itself is not added, as @vscode/test-cli brings its own; and
vscode-textmate 7.0.4 and vscode-oniguruma 1.7.0, which come with
vscode-tmgrammar-test, are listed directly too, at the same versions,
because the test that colours every example page uses them (Z2). The
install script of @vscode/vsce-sign (which comes with @vscode/vsce and
signs extensions for the Marketplace) is refused in
pnpm-workspace.yaml: it may download its program, and nothing is
published.

### Questions (answered with the recommendations, 2026-10-02)

- Q1, where it goes in the roadmap.
  - a (recommended): milestone 23, right after the documentation, so
    HoloML 0.3 and the later milestones move one number on. Whoever
    writes 0.3's example pages has the extension, and 0.3's new
    elements reach it through the checker's table with no extra work.
    About a dozen mentions of milestones 23 to 29 in the two
    repositories' documents change number.
  - b: after HoloML 0.3, as 24, so that it starts with 0.3's language.
  - c: beside the numbered milestones, with no number, built between
    them.
- Q2, how the work is done.
  - a (recommended): a language server from the start. It is the usual
    way, the editor stays responsive, and it serves other editors later.
  - b: everything inside the extension. That is a little simpler now,
    but it works in VS Code only, and moving to a server later rewrites
    the plumbing.
- Q3, half-typed pages.
  - a (recommended): a forgiving scanner in the extension for
    suggestions, hover, folding, and the outline, with holoml's parser
    unchanged. Nothing the browser uses changes.
  - b: add to holoml's parser where each element and attribute ends,
    used by the extension and copied into the browser with
    `pnpm holoml:sync`. The scanner is still needed for suggestions in
    a page that does not parse.
- Q4, tests in a real VS Code. On this computer they use the VS Code
  that is installed (1.139). GitHub's machines have none, so
  `@vscode/test-electron` would download VS Code from Microsoft's
  update server, a new network request (rule 3).
  - a (recommended): allow that download in holoml's automatic builds
    only, a fixed version, checked against Microsoft's checksum. Tests
    that run on only one computer stop being run.
  - b: run the VS Code tests on this computer only. The automatic
    builds run the unit tests and the grammar tests, which need no
    VS Code.

### Tasks

- [x] 1. The package: holoml's `packages/vscode` and the extension's
      manifest (the language, `.holoml` files, the grammar, the
      snippets, VS Code 1.96 or newer, safe in untrusted workspaces, no
      telemetry); esbuild's bundle of the extension and the server; and
      a `package` script that makes the .vsix (its contents listed and
      checked).
- [x] 2. The syntax colours and the editing basics (features 1 and 2),
      with grammar tests against sample files.
- [x] 3. The language service and server (Q2), and mistakes underlined
      (feature 3) from holoml's parser and checker.
- [x] 4. The forgiving scanner (Q3), then suggestions, hover, and the
      snippets (features 4 to 6). The hover text is gathered from the
      reference pages and SPEC.md when the extension is built.
- [x] 5. Tags kept in step, the outline, and folding (features 7 and 8).
- [x] 6. Colours, names, and links to files (features 9 to 11).
- [x] 7. Tests: unit tests of every feature (Vitest), tests in a real
      VS Code (Q4), the grammar tests, and a test that the built
      extension contains nothing that reaches the network. holoml's
      automatic builds run them.
- [x] 8. Checks Z1 to Z10 on Windows, with the extension installed by
      hand from its .vsix in VS Code and in Cursor.
- [x] 9. Documents: in holoml, a how-to guide in its docs ("Write HoloML
      in VS Code": installing, the features, and what it does not do),
      the README, AGENTS.md's testing list, and the CHANGELOG; in this
      repository, ARCHITECTURE.md (the parts), TODO.md, and HANDOFF.md;
      and screenshots of the extension at work for holoml's README.
      (Ticked 2026-10-07, prompt 162: all done but the screenshots of
      the extension at work, which were never made; they stay open, in
      "Clearing up before milestone 25" below.)

### Checks (named Z; milestone 22 used Y)

| # | Check | Expected result |
|---|---|---|
| Z1 | Installs | `package` makes a .vsix with only the bundle, the grammar, the snippets, the licence, and the README. It installs by hand in VS Code and in Cursor, and opening a `.holoml` file turns it on (nothing loads before) |
| Z2 | Colours | Every sample in the grammar tests gets the expected colours; the HoloML example sites (the showroom, Blockworld, the sofa studio, Harbour Loft, the sneaker store, the aquarium) colour with no unmarked text |
| Z3 | Editing basics | Comment toggling, closing quotes, and indentation after a start tag work |
| Z4 | Mistakes | Every conformance file that should fail shows the same codes in the Problems panel as holoml's checker gives. Every file that should pass, and every example site, shows none. A mistake typed and then fixed appears and goes away while typing |
| Z5 | Suggestions | Inside each element, exactly the elements the checker's table allows; each element's attributes and each attribute's choices; nothing from 0.2 in a 0.1 page. They work in a page with a mistake in it |
| Z6 | Hover | Every element and attribute in the checker's table has hover text, with its version; every error and problem code has its meaning |
| Z7 | Tags kept in step | Typing `>` writes the end tag; typing over a start tag's name renames its end tag, and the reverse |
| Z8 | Outline, folding, colours, names, links | The outline lists the page's elements; elements and comments fold; colour values show swatches and the picker writes `#rrggbb`; go to definition and find references work for names; Ctrl+click opens a model's file |
| Z9 | Nothing leaves the computer | The built extension contains no network code (the test), and a session of editing the example sites makes no network request |
| Z10 | Regression | holoml's tests, lint, and type check; the extension's tests in a real VS Code; holoml's automatic builds; and this repository's unit tests, although nothing in the browser changes |

### Decisions made while building

- A model is suggested closed, `<model src="" />`: it may hold a
  material, but only to change one, so `/>` is what is usually wanted.
  Every other element that may hold others gets its end tag.
- After `>` or `</` the extension waits 100 ms before asking the server
  for the end tag, as VS Code's HTML support does, so that the change
  reaches the server first (the first run in an editor wrote no end
  tag).
- The end tag is written as text, and the cursor put back where the
  server's `$0` marks it: VS Code 1.139 leaves the cursor after a
  snippet that holds nothing but `$0`, even one inserted directly (found
  in VS Code, 2026-10-05).
- Each run of the tests inside VS Code starts a fresh profile whose
  settings turn off what in VS Code itself reaches the network (its AI
  features, telemetry, experiments, and update checks): the first run's
  log showed VS Code's own chat asking for GitHub.
- Hover text links to the published site: an element to its section of
  the specification and to its reference page; a mistake's code to the
  list of codes. A link in the specification to a file of the
  repository goes to the file on GitHub. Opening a link is the editor's,
  on a click; the extension fetches nothing.
- The licences of the packages bundled into the extension (MIT, ISC, and
  minimatch's Blue Oak) are gathered by build.mjs into
  THIRD-PARTY-NOTICES.txt, which the .vsix carries with LICENSE and
  NOTICE.
- `@holoml/schema` exports `COLOR_PATTERN` (one line added), so that the
  swatches use the checker's own pattern. Nothing else in the parser or
  the checker changes, and the browser's copy needs no sync.
- For HoloML files the extension turns on VS Code's linked editing
  (feature 7's renaming) and suggestions inside quotes (feature 4's
  values), as settings defaults a person can change.
- The tests inside VS Code open a visible VS Code window: unlike the
  browser's test windows, VS Code has no way to start off screen.
- holoml's test of its automatic builds (site/workflows.test.ts) lists
  CI's steps; it now lists the extension's three, as task 7 changes
  what CI runs.

### Results (Windows 11, 2026-10-03 to 2026-10-05)

- holoml: `pnpm test` 834 passed in 29 files (507 before; the extension
  adds 325, the guide's example and the workflow test the rest); `pnpm
  lint` and `pnpm typecheck` clean; `pnpm site:build` made 30 pages and
  checked their links.
- Z1: `pnpm --filter holoml-vscode package` made holoml-vscode.vsix (13
  files, 234 KB); its list of files is checked by a test. Installed with
  `code --install-extension` into a throwaway profile of VS Code 1.139.1:
  listed as holoml.holoml-vscode@0.1.0. In Cursor from the .vsix: not
  checked yet (see Z4 to Z8).
- Z2: the grammar's tests pass (vscode-tmgrammar-test, two files); every
  example page and valid conformance sample (55 pages) is coloured with
  every part of every tag scoped and nothing marked a mistake.
- Z4 to Z8 as unit tests: pass (every conformance sample and example
  site, every element's suggestions in 0.1 and 0.2, hover for every
  element, attribute, and code, and the rest).
- Z3 to Z8 inside an editor (test/vscode/extension.test.ts, ten checks):
  first run once in Cursor 0.50.5 (built on VS Code 1.96.2) on
  2026-10-03, as the installed VS Code would not start a second copy
  while it waited to finish an update: 8 passed; the end tag after `>`
  was not written, and VS Code has no command for asking linked editing
  (the check now types a letter into a start tag). Cursor contacted its
  own servers when it started, so it is not used for test runs again.
  In VS Code 1.139.1, after the owner restarted it (2026-10-05): 9
  passed, and the cursor was left after the new end tag; fixed (see the
  decisions), then all 10 passed.
- Z9: the bundles hold no network code (the test), and the language
  server, run with every way out to the network replaced by one that
  records and fails, answered for all 28 example pages with no attempt.
  A session of editing by hand: not checked yet.
- Z10: holoml's tests, lint, and type check pass; holoml's automatic
  builds on pull request #32 (2026-10-05): lint, types, the 834 tests,
  the .vsix made, and the ten checks inside VS Code 1.96.0 (downloaded,
  its checksum checked) passed on Windows and Linux. CodeQL raised two
  alerts in the new code, both fixed before the merge: the outline's
  text of an element took comments out with a regular expression (now
  by the places the reader found them), and a test looked for a host
  name in an address's text (now it checks every address asked about is
  a file). Merged 2026-10-05; the Pages workflow published the guide.
  This repository's unit tests: 502 passed in 58 files.
- By hand, done by the owner on 2026-10-05: Z1 in Cursor (installing
  the .vsix made from holoml's main), Z3's indentation as you type, and
  Z9's session of editing (no request from the extension).

### Done when

- Z1 to Z10 pass, the extension installs by hand from its .vsix, the
  documents are updated, and the owner accepts.

### Sources (researched 2026-10-02)

- VS Code's guides to language extensions (code.visualstudio.com/api):
  the overview, the language server guide, programmatic language
  features, language configuration, the syntax highlight guide,
  bundling, testing, and workspace trust.
- Extensions examined: Red Hat's XML and YAML, VS Code's HTML language
  service, Vue - Official (Volar), Svelte, Astro, Prisma, GraphQL, Even
  Better TOML (Taplo), and Microsoft's lsp-sample; also
  vscode-tmgrammar-test.

## Milestone 24 — HyperSpace 3D for Android

Status: Built (2026-10-05) and merged into main (pull request #53,
2026-10-07); the owner's checks on the tablet passed except blurred tab
cards, fixed the same day (Results, below). Accepted 2026-10-07
(prompt 161). Plan approved (2026-10-05, prompt 155): the
owner chose the recommended answers to Q1 to Q5 and approved the new
build tools; build approved (prompt 156). Rule 13 check done
(ARCHITECTURE.md section 3). Asked for in prompts 152 to 154. The owner asked
for the browser on the Android tablet connected to this computer, to
test how far it reaches; the code goes in this repository as
apps/android (prompt 154). HyperSpace 3D is built with Electron, which
runs on Windows, macOS, and Linux only, so Android needs a shell of its
own; most of what is drawn (the 3D room, the top bar, the HoloML viewer)
is web code that can come along.

Goal: on an Android tablet, HyperSpace 3D opens to its 3D room, shows a
live web page on a tilted panel that touch works on, keeps tabs as
cards, and shows HoloML pages that can be walked through with touch.

### The quick look (2026-10-05, prompt 153)

Before planning, HyperSpace 3D's HoloML viewer (built from main) and
the example sites were served from this computer on 127.0.0.1 and
opened in Chrome on the tablet over USB (`adb reverse`); a small HTML
page held each HoloML page's text and answered the viewer as the
browser's page preload does. Nothing was installed and nothing reached
the internet. The tablet: a K70 PRO, Android 16, a Mali-G57 graphics
chip, 2.9 GB of memory, 800 by 1280 pixels (711 by 1018 CSS pixels in
Chrome, portrait); Chrome 154.

- Harbour Loft, the ocean tunnel, and Blockworld loaded and drew as on
  the desktop. The other three sites were not tried.
- Touch: dragging turns the view, and tapping the page's own buttons
  (Harbour Loft's Day and Evening) works. Walking does not: it needs
  the arrow keys or W, A, S, D, and the tablet has neither. Blockworld's
  placing a block needs a right-click, and its help text names keys
  only.
- Frame rate, from Chrome's own frame callbacks over its debugging
  connection (USB): the ocean tunnel about 19 a second (the slowest
  frame 67 ms), Blockworld about 12 (the slowest 223 ms). Their checks
  ask for 30 a second with a graphics card, and measured about 145 (X9)
  and 143 (T5) on the owner's computer. A tablet like this one needs a
  lighter way of drawing: fewer pixels, fewer effects.

### How it would work (proposed)

- **An Android app in Kotlin** (apps/android), the shell's part on
  Android: tabs, the address bar's work, history, and settings, as the
  Electron main process and shell do on the desktop.
- **Pages in Android's own WebView** (Q1): the Chromium engine that
  Android keeps up to date through the Play Store, the same engine as
  the desktop's Electron. Each tab is a WebView.
- **The room behind, the page in front.** The 3D room and the top bar
  are the desktop's own web code, drawn by a WebView that fills the
  screen. A page's WebView sits on top of it, tilted in 3D with
  Android's own view transforms (rotation, perspective, scale), which
  keep touch landing where it appears, as CSS 3D does on the desktop.
  The two talk over a message channel, as the shell and main process
  do.
- **HoloML pages** as on the desktop: the page's text, the viewer
  script added by the app (as the page preload adds it), and the
  private line to the browser. The viewer comes from the desktop's
  build, packed into the app.
- **Touch in the HoloML viewer** (Q4): a stick on the screen to walk,
  drag to look, tap to click, and a long press for what a right-click
  does; shown when the device has touch and no keyboard. On the desktop
  too, for touch screens.
- **A lighter way of drawing** on devices like the tablet: the
  viewer's own drawing in software (half the pixels each way, no
  smoothed edges) offered as a setting, and the room's economy mode on
  by default on Android.
- **Installed by hand** over USB (`adb install`), signed with Android's
  debug key: no Play Store, no account.
- **Nothing new on the network.** The app asks for nothing beyond what
  pages ask for; no telemetry. The ad and tracker blocker, encrypted
  DNS, passwords, and site permissions come later (Q3).

### First version (Q3)

1. The room, with the desktop's themes and parallax from the tablet's
   tilt in place of the mouse.
2. One live page on a tilted panel: tap, type with the on-screen
   keyboard, scroll, links, pinch to zoom the page.
3. Tabs as cards: new, switch, close (a swipe), reopen.
4. The top bar: back, forward, reload, the address and search box.
5. HoloML pages, with touch to walk and look, and the examples section.
6. Rotation between portrait and landscape.

Later (each with its own plan): bookmarks and history, the blocker and
its shield, private tabs, downloads, passwords and site permissions,
the layers view, the instrument panel, phones, and the Play Store.

### Software to install (approved with the plan, prompt 155)

Already on this computer: Android Studio, the Android SDK (platforms up
to Android 16, build-tools 36, platform-tools with adb), and JDK 21
(with Android Studio).

New, for the app's build:
- Gradle, Android's build tool, through its wrapper (it downloads the
  pinned version from services.gradle.org on first use).
- The Android Gradle Plugin and Kotlin, and the AndroidX libraries the
  app uses (core, activity, webkit), from Google's Maven repository and
  Maven Central.
- JUnit for the app's unit tests, and AndroidX Test for the checks run
  on the tablet.
  (As built: JUnit 4.13.2 only; no checks on the device were written
  with AndroidX Test, so it is not added.)

These are new places that builds fetch from (rule 3); the owner
approved them with the plan (prompt 155).

### Questions (answered with the recommendations, prompt 155)

- Q1, the engine.
  - a (recommended): Android's own WebView. It is the Chromium engine,
    like the desktop's; Android keeps it up to date; the app stays
    small; pages behave as in Chrome, where the quick look ran.
  - b: GeckoView, Firefox's engine. It has tracking protection and
    browser extensions built in, but it is a second engine to test
    against, the HoloML viewer has never run on it, and the engine
    comes inside the app, making it many times larger.
- Q2, the first version's devices.
  - a (recommended): tablets, portrait and landscape, as the owner's
    tablet; phones later.
  - b: tablets and phones together.
- Q3, the first version's scope.
  - a (recommended): the six points above; the rest later.
  - b: also bookmarks, history, and the blocker in the first version
    (about twice the work).
- Q4, touch controls for HoloML.
  - a (recommended): in the viewer itself, so the desktop gains them
    for touch screens too.
  - b: on Android only.
- Q5, automatic builds.
  - a (recommended): GitHub Actions builds the app and runs its unit
    tests on Linux with each push; the checks on a device run by hand
    on the tablet.
  - b: build on this computer only.

### Tasks

- [x] 1. The app (apps/android): the Gradle project with the wrapper, the
      activity, the room's WebView, and the build of the room, the top
      bar, and the viewer into the app.
- [x] 2. A page on a tilted panel over the room, with touch and the keyboard,
      and the message channel between the page, the room, and the app.
- [x] 3. Tabs as cards, and the top bar's work.
- [x] 4. HoloML pages in a tab, with the viewer and its private line.
- [x] 5. Touch controls in the viewer (Q4), and the lighter drawing setting.
- [x] 6. Rotation, the tablet's tilt as parallax, and economy mode.
- [x] 7. Tests: unit tests (JUnit) of the app's logic, the viewer's touch
      controls in the desktop's tests, checks on the tablet by hand, and
      the automatic build (Q5). (AndroidX Test was planned for checks on
      the device; none were written, so it is not used: the device
      checks are by hand.)
- [x] 8. Checks AN1 to AN9 on the owner's tablet.
- [x] 9. Documents: README, ARCHITECTURE (the Android parts and decisions),
      AGENTS.md (building and testing the app), HANDOFF, TODO, and the
      screenshots, from the tablet (docs/screenshots/m24, on
      docs/progress.md; the README's four pictures stay the desktop's).

### Decisions made while building

- The room's code is shared, not copied: the room now places any page
  view with an element, a size, and a way to be shown (room.ts,
  RoomView; the desktop's tab view is one), reports each frame it draws
  (`onDrawn`), and says which card is under a point (`cardHit`); the
  top bar can leave out parts the browser does not have yet (`omit`).
  The desktop's behaviour is unchanged.
- The page goes onto the room's outline exactly: Android's view
  transforms cannot make every perspective, so the page's WebView is
  drawn through a 3 by 3 map from its rectangle to the four corners
  (an animation matrix), and each touch is mapped back by its inverse
  before the page gets it. Pinches and scrolls go through the same map.
- While a menu, the address bar's list, or the examples dialog is open
  over the page, the page's WebView hides and its last picture shows
  in its place in the room; a native view cannot be put under part of
  the room's page.
- The lighter drawing keeps smoothed edges: on the owner's tablet (a
  Mali-G57) a scene drawn without them showed nothing, in Chrome too,
  with no error. It is half the sharpness, and no shadows or moving
  light on water.
- A long press is a right-click once the finger has been held still
  for half a second, while it is still down: Android cancelled a touch
  held that long before it lifted, so waiting for the lift lost it.
- A swipe on a card needs the room's canvas to take touches itself
  (`touch-action: none`); otherwise the WebView took the swipe as a pan
  and cancelled it.
- The app is one window (`singleTask`): an address opened from another
  app opens in a new tab, not a second copy of the browser. It opens
  http pages too, marked "Not secure", as the desktop does.
- The room's page asks for nothing outside the app: a request the
  app's files do not answer (the WebView's favicon) is answered empty
  in the app, not sent.
- Not on Android in this first version: a HoloML page's text view and
  the other commands over the viewer's private line (Android has no
  isolated world, so the page's own scripts could reach that line);
  downloads (nothing is saved); and site permissions (camera,
  microphone, and the rest are refused). Pop-ups open in a new tab only
  when a tap asked for them.
- The app's id is io.github.srajpal.hyperspace3d, under the owner's
  GitHub name, as HyperSol has no domain; Android 10 is the oldest it
  runs on (the animation matrix).

### Results so far (the owner's tablet, 2026-10-05)

The tablet: a K70 PRO, Android 16, a Mali-G57, 2.9 GB of memory, 800
by 1280 pixels. Its Wi-Fi needed a hotel's sign-in for much of the
session, so most pages were served from this computer over USB (`adb
reverse`); the published example sites were opened once it was online.

- AN1: installs with `adb install`; from a cold start to the room
  showing its first tab took 3.8, 4.1, and 6.1 seconds in three runs
  (timed over USB, which adds a little): two of three within 5 seconds.
- AN2: the click-grid page on the tilted panel: all nine buttons, at
  the corners, the edges, and the middle, took their taps (portrait).
  Typing in the top bar and the start panel works, with the on-screen
  keyboard (the room lays itself out above it). Scrolling, pinching,
  and landscape: not checked yet.
- AN3: a new tab from the "+" card and the top bar; a swipe to the
  left on a card closes its tab; "Reopen closed tab" brings it back;
  the cards show their pages' pictures (a HoloML page's card shows
  none: its 3D is not in the picture). Switching by tapping a card: not
  checked yet.
- AN4: a link, then Back, works; Forward, Reload, and a search: not
  checked yet.
- AN5: Harbour Loft, the ocean tunnel, and Blockworld load and draw,
  from the published site and from local copies. The walk pad walks
  (into the tunnel), dragging looks around, Blockworld shows its Jump
  button, a tap breaks a block, and a long press places one. Harbour
  Loft's doors and the other three sites: not checked yet.
- AN6: the ocean tunnel at 33 frames a second with the lighter drawing
  (about 19 without, in the quick look). Passes.
- AN7: the room's page loads only from the app's own address
  (appassets.androidplatform.net); a HoloML page is fetched as its tab
  asks for it. The tablet's own network log: not checked yet.
- AN8: the tilt moves the room's parallax (the panel leans as the
  tablet tilts). Turning the tablet: not checked yet (it needs a hand
  on the tablet).
- AN9: the desktop's unit tests (512, with the touch controls' and the
  room page's), lint, and the type check pass; the app's 15 JUnit
  tests pass. The desktop's end-to-end run (2026-10-05, about 18
  minutes): 370 of 375 passed. The 5 that failed all read the system
  clipboard and found it empty (D8's copy a link, copy text, and paste;
  K2's copied password; M1's real click that copies), twice, the second
  time in a run of their three files alone. The clipboard was not
  usable from this session at all then: PowerShell's Set-Clipboard and
  Get-Clipboard failed too, and no program held it open, so the
  session's sandbox is the likely cause, not the change (no code here
  touches the clipboard). To confirm: those three files run from the
  owner's own terminal, or the automatic builds. The automatic builds:
  not run yet (they need a push).

The owner's checks on the tablet (2026-10-07, prompt 160): every item
above marked "not checked yet" was tested by hand and passed, and the
clipboard both ways, on the desktop too (so D8, K2, and M1's failures
were this session's, as thought). One fault: the tab cards looked very
blurred. Cause: the app turns on the room's economy mode, which draws
the room at half the display's pixel ratio; the tablet's is about 1.1,
so the room was drawn at about 0.56 and stretched. The room now takes
`economyFullResolution` (room.ts), which the Android app sets: economy
mode there keeps its 30 frames a second and no glow, at the display's
own resolution; the desktop's economy mode is unchanged (milestone
10's check L6 holds it below the display's). The cards' pictures are taken at
400 pixels wide and JPEG quality 80, as on the desktop (they were 320
and 75). Checked on the tablet: the cards' text and edges are sharp,
side by side with the earlier screenshot at the same zoom. The
ocean tunnel's frame rate with the sharper room (AN6) is not measured
again yet (measured later the same day: 56 to 59 frames a second;
"Clearing up before milestone 25"). The automatic builds on pull request #53 passed, the
Android job included. After the fix: type check, lint, the 512 unit
tests, and the app's 15 JUnit tests pass (2026-10-07).

### Checks (named AN, for Android)

| # | Check | Expected result |
|---|---|---|
| AN1 | Installs and opens | `adb install` puts the app on the tablet; it opens to the room in under 5 seconds |
| AN2 | A page on the panel | A web page shows on the tilted panel; taps, typing, scrolling, and links land where they appear, in portrait and landscape |
| AN3 | Tabs | New, switch, close, and reopen; the cards show their pages |
| AN4 | The top bar | Back, forward, reload, an address, and a search |
| AN5 | HoloML pages | Each example site loads and draws; with touch alone, walk, look, open Harbour Loft's doors, and place a block in Blockworld |
| AN6 | Drawing | The ocean tunnel at 30 frames a second or more with the lighter drawing on the tablet |
| AN7 | Nothing new on the network | The app makes no request but those its pages make (checked with the tablet's network log) |
| AN8 | Rotation and tilt | Turning the tablet keeps the page and the tabs; tilting moves the room's parallax |
| AN9 | Regression | The desktop's unit tests and end-to-end checks (the viewer's touch controls change shared code), and the automatic builds |

### Done when

- AN1 to AN9 pass on the owner's tablet, the documents are updated, and
  the owner accepts.

## Milestone 25 — HoloML 0.3

Status: Plan approved (2026-10-07, prompt 168): the owner chose the
recommended answers to Q1 to Q8 and approved the new tools. Build
approved (prompt 169). Rule 13 check done (ARCHITECTURE.md section 3: 44.7.0 is still the
newest stable release). Built 2026-10-07 on the branches m25-holoml-0.3
(this repository) and holoml-0.3 (holoml); merged in holoml (#39) and
here (#59), with what followed (#60, "After milestone 25", below). The
owner's checks on the tablet passed (prompt 174). Accepted 2026-10-08
(prompt 174). Asked for in prompts 127 and 128 (Q4 a): the
features milestone 22's check found missing, with the review's
additions (2026-09-30) and the language engineer's list (the roadmap's
notes above).

Goal: HoloML 0.3, a version that pages opt into with `version="0.3"`,
adding names for models and groups, the language and direction of text,
a lighter model shown far away, and more of the scene API; HyperSpace 3D
reading compressed models and showing a page's description; and the
specification saying what 0.2 left to each renderer (the look, limits,
a panorama's projection), so that a second renderer could match
HyperSpace 3D's pictures. Every 0.1 and 0.2 page keeps its meaning.

### How it would work (proposed)

New in the language (SPEC.md, the grammar, the checker, conformance
samples):

1. **Names for models and groups.** A `label` on `model` and `group`
   (as `sound`, `choice`, places, and plans already have), heard by
   screen readers and shown in the text view and the Scene inspector.
   Without one, what is heard today stays: the `id`, then the file's
   name.
   `<model src="fish/shark.glb" label="Blacktip reef shark" />`
2. **The language and direction of text.** `lang` (a language tag, as
   in HTML: `ar`, `en-GB`) and `dir` (`ltr`, `rtl`, or `auto`) on
   `holoml` and on every element that holds or shows text (`title`,
   `label`, `panel`, `hud`, `a`, `option`, and the `label` attributes),
   taken from the nearest element that says so, as in HTML (Q3). Screen
   readers get the language; labels, panels, and the screen's text are
   drawn in their direction; the text view says both.
3. **A lighter model far away (level of detail).** Q1 a: `far`, a
   lighter file, and `far-from`, the distance in metres from which it
   is shown, on `model`:
   `<model src="fish/shark.glb" far="fish/shark-far.glb" far-from="20" />`
   Near, the full model; farther than `far-from`, the lighter one. Only
   what is shown is loaded at first; the other loads as the viewer
   comes near it. It works with loading by area and stand-ins.
4. **More of the scene API** (section 10, Web IDL): an `animate` can be
   started and stopped (`start()`, `stop()`, `running`); the viewer can
   be sent to a place (`holoml.viewer.goTo("terrace")`) and says which
   place it is at (`holoml.viewer.place`, and a `place` event); the
   water's `color` and `clarity` can change; the floor plan is a thing
   scripts can find; `holoml.add` takes animations, click actions, and
   a panel or a link at the top level; a sound's place can be taken
   away again (`position = null`).

The specification, for every version (no new features; from the review
and the language engineer):

5. **The look written down**: how bright a light of a given
   `intensity` is, the tone mapping (HyperSpace 3D uses ACES filmic, in
   sRGB), the renderer's own soft light when a page has no
   `environment`, the field of view (HyperSpace 3D's is 50 degrees,
   vertical), and a panorama's projection (equirectangular) and which
   way its middle faces.
6. **Limits as the specification's own requirements** (Q7): what every
   renderer must manage at least (text, elements, files, decoded
   pixels and seconds of sound, lights, and the time a page may take),
   so that a page within them works in every renderer; today they are
   HyperSpace 3D's own, in a note.
7. **Readers**: what is reported for a further copy of an element a
   page may have only once (generalising `water`'s `too-many`), and
   whether text on both sides of a comment is one text.
8. **The RELAX NG grammar checked by a validator** in holoml's tests
   (Q5).

In HyperSpace 3D:

9. **Compressed models** (Q4): glTF files whose geometry is compressed
   (Draco, meshopt) or whose pictures are (KTX2), common on the web,
   load and draw. The decoders come with three.js, which the viewer
   already uses (Draco and Basis Universal, Apache 2.0; meshopt, MIT),
   and ship inside the browser, served from its own viewer address:
   nothing is fetched from anywhere but the page's own site. They run
   in the page's process, in workers; the limits count what they
   decode, as today. On Android too.
10. **A page's description** (Q2): a 0.3 page's (and an older page's)
    `<meta name="description">` shown as its tab's tooltip, at the top
    of the text view, and in the Scene inspector.
11. **0.3 in the viewer**: names, language and direction, far models,
    and the new scene API, on the desktop and on Android; the text view
    and the accessibility tree updated.

The examples (Q6 a): the existing sites take up what fits them, with
their checks updated: names for every fish, model, and group that a
screen reader reaches (the aquarium, Harbour Loft, the sneaker store,
the sofa studio, Blockworld, the showroom); far models for the
aquarium's fish (it had to thin its models by hand, milestone 21); the
sneaker store's shoes compressed (a smaller download); a
`description` on every site; and one new short page in the HoloML
examples, "Words in a room", with labels and panels in English, Arabic,
and Hebrew, to show `lang` and `dir`.

### Software to install (approved with the plan, prompt 168)

- Q5: a RELAX NG validator for holoml's tests, as a development
  package; which one is researched first and proposed with its
  licence (JavaScript validators of the compact form are few; Jing,
  the reference one, needs Java).
- Q6 a: `@gltf-transform/cli` (MIT) and its Draco encoder
  `draco3dgltf` (Apache 2.0) as development packages of holoml's
  example tools, to compress the sneaker store's shoes and make the
  test models; KTX2 test pictures from Khronos's glTF Sample Assets
  (CC0 or CC BY 4.0), fetched once by a tool and recorded with their
  SHA-256, as the examples' models are.
- Nothing new in the browser: the decoders are part of three.js.

### Questions (answered with the recommendations, prompt 168)

- Q1, a lighter model far away.
  - a (recommended): `far` and `far-from` on `model`: one lighter
    version, the case the examples have (the aquarium's fish), as
    simple to write as `stand-in`.
  - b: a `lod` element holding several `model`s, each with the
    distance it starts at: any number of levels, more to write and
    check.
  - c: none in the language; the renderer simplifies models itself
    (not reliable, and every renderer would differ).
- Q2, where HyperSpace 3D shows a page's description.
  - a (recommended): its tab's tooltip, the top of the text view, and
    the Scene inspector; the examples section's cards keep their own
    words.
  - b: also the examples section's cards, taken from each site's page
    (the browser would fetch each page to show the card).
  - c: nowhere; the specification only.
- Q3, where `lang` and `dir` may be written.
  - a (recommended): on `holoml` and on every element that holds or
    shows text, inherited as in HTML, so a page in one language says
    it once and a quote in another says it where it is.
  - b: on `holoml` only: one language and direction for the whole page.
- Q4, compressed models in HyperSpace 3D.
  - a (recommended): all three, Draco, meshopt, and KTX2, with the
    decoders from three.js shipped in the browser (about 0.9 MB:
    Draco's glTF decoder 0.25 MB, the Basis transcoder 0.59 MB, meshopt
    0.03 MB), served from the browser's own address, nothing from the
    network.
  - b: meshopt only (plain JavaScript, no WebAssembly, the smallest
    change; Draco and KTX2 files still left out with a notice).
  - c: none; the specification names them as optional only.
- Q5, the RELAX NG grammar checked by a validator.
  - a (recommended): yes: the agent researches a validator and proposes
    it, with its licence, before adding it.
  - b: no; the grammar stays generated from the checker's table and
    checked against it (as today).
- Q6, the examples.
  - a (recommended): the existing sites take up what fits them (names,
    far models for the fish, compressed shoes, descriptions), and one
    new short page, "Words in a room", shows `lang` and `dir`.
  - b: a new example site built around 0.3 (for example a small
    gallery with its labels in three languages), the existing sites
    unchanged.
  - c: no example changes; conformance samples and test pages only.
- Q7, limits.
  - a (recommended): the specification states the least every renderer
    must manage (a renderer may allow more), so a page within them
    works everywhere; HyperSpace 3D's own limits stay above them.
  - b: limits stay each renderer's choice, as today.
- Q8, the large-scene items (ARCHITECTURE.md, open question 4: compiling
  materials without holding up the first frame, a Tab stop for every
  model, and a model's files fetched one after another).
  - a: in this milestone, as they touch what names change (Tab stops).
  - b (recommended): a milestone of their own, or polish (29): they are
    the viewer's speed, not the language.

### Tasks

- [x] 1. HoloML 0.3 in holoml: SPEC.md (features 1 to 4, and 5 to 7 for
      every version), the grammar (ABNF, RELAX NG, Web IDL), the
      checker and parser, conformance samples for every new attribute,
      value, and problem, and the guides (a how-to for each feature).
- [x] 2. The viewer: names, language and direction, far models, the new
      scene API, and compressed models with the decoders shipped in the
      browser; the text view, the accessibility tree, and the Scene
      inspector; on Android too.
- [x] 3. The shell: a page's description (Q2).
- [x] 4. The examples (Q6), and the browser's copy of them (`pnpm
      holoml:sync`).
- [x] 5. The RELAX NG validator (Q5), after its approval (Jing, prompt
      170).
- [x] 6. Checks HL1 to HL10: unit tests beside the code, holoml's tests,
      and tests/e2e/m25.e2e.ts; run on Windows, with `pnpm test:linux`,
      and in the automatic builds.
- [x] 7. Documents: both READMEs, SPEC, ARCHITECTURE, THIRD-PARTY.md (the
      decoders), docs/privacy.md (nothing new on the network), AGENTS.md's
      testing list, both CHANGELOGs, HANDOFF, and TODO; the screenshots
      (`MILESTONE=m25 pnpm screenshots`, the previous set out of the
      tree) and the README's four pictures.
- [x] 8. HoloML 0.3 tagged v0.3.0, after the owner accepts the milestone
      and says go. (Ticked 2026-10-08, prompt 176: the release changes
      merged as holoml #40, the tag on its merge commit 64e4e3e, and a
      GitHub pre-release,
      https://github.com/srajpal/holoml/releases/tag/v0.3.0; the
      browser's copy of HoloML made from the tag.)

### Checks (named HL, for HoloML 0.3)

| # | Check | Expected result |
|---|---|---|
| HL1 | The language | holoml's tests: SPEC.md's form, the grammar against the checker's table (and the validator, Q5), a valid and an invalid conformance sample for every new attribute and value, and every 0.1 and 0.2 sample unchanged |
| HL2 | Names | A model's and a group's `label` is what screen readers hear and what the text view and the Scene inspector show; without one, the id, then the file's name, as before |
| HL3 | Language and direction | The accessibility tree carries each text's language; an Arabic or Hebrew label, panel, and screen text are drawn right to left; `auto` follows the text; the text view says both |
| HL4 | Compressed models | A Draco, a meshopt, and a KTX2 model load and draw (also in software); their decoded pictures and triangles count against the limits; a broken one is left out with a notice; nothing is fetched but the page's own files; on Android too |
| HL5 | Far models | Beyond `far-from` the lighter model is drawn and near it the full one, switching as the walker moves; only what is shown is loaded at first; with loading by area and stand-ins |
| HL6 | The scene API | Scripts start and stop an `animate`, send the viewer to a place and hear `place`, change the water, find the floor plan, add animations, click actions, a panel, and a link, and take a sound's place away |
| HL7 | A page's description | Shown where Q2 says, for 0.3 and older pages; none when a page has none |
| HL8 | Older pages | Every 0.1 and 0.2 example and fixture page draws and behaves as before (every earlier milestone's checks pass) |
| HL9 | The examples | Every fish and model a screen reader reaches has a name; the aquarium at 30 frames a second or more with its far models (with a graphics card) and drawing fewer triangles; the sneaker store's download smaller than before; "Words in a room" read correctly by a screen reader |
| HL10 | Regression and the published site | The full end-to-end run, the unit tests, the Android build and its checks by hand on the tablet; the published sites and specification checked by hand |

### Done when

- HL1 to HL10 pass, the documents and screenshots are updated, and the
  owner accepts; then HoloML 0.3 is tagged on the owner's go.

### Decisions made while building

- KTX2 pictures (owner, prompt 170, asked while building): the Basis
  transcoder, an Emscripten build, evaluates code as it starts, which a
  HoloML page's content policy forbids. It runs in workers of an unseen
  frame from the viewer's own address (`hypersol-viewer://app/ktx2-host.html`,
  viewer/ktx2-host.ts), with a policy of its own that allows that; the
  page's KTX2 loader talks to it over a MessagePort through stand-in
  workers. A HoloML page itself never gets `'unsafe-eval'`; it gets
  `'wasm-unsafe-eval'` (compiling WebAssembly, for Draco and Basis),
  blob: workers, and that one frame. On Android, where the viewer comes
  from the page's own site, three.js's own workers do it.
- The RELAX NG validator (Q5, prompt 170): Jing 20241231, the reference
  one, with its SHA-256 in holoml's tests; it needs Java, so its checks
  are skipped without Java and fail in the automatic builds without it.
  It found one fault in the schema made for 0.3 (one viewpoint at most),
  fixed before anything was published.
- The decoders are the files three.js's loaders name, which the build
  carries beside the viewer's scripts (the viewer imports none of them
  itself, so each is there once), served from the viewer's address: the
  viewer's loaders load only the viewer's own files, the files the
  page's limits counted, and blob: and data: (decoders.ts). The Android
  app's viewer carries the same files (its build, 2026-10-07).
- Names go where a screen reader reaches: every model and group in a
  page's outline (the viewer lists every model there) is named on the
  example sites, the walls and windows too ("Wall", "Tall window"). A
  model inside a link is left without a label: a link is named by its
  labels and panels and, from 0.3, by the labels of the models and
  groups in it, so a label there doubled the link's name (Harbour
  Loft's door up to the terrace, found by V9).
- The sneaker store, its shoe page, and its about page are HoloML 0.3
  now, for the names. The showroom first stayed a HoloML 0.1 site, so
  its hall and plinths were heard by their files' names; the owner had
  it moved to 0.3 (prompt 171): the hall, the plinths, and each car on
  its own page are named, and HL9 checks three of its pages. In the
  hall each car stays inside its link, named by its label. It keeps a
  page per colour, without scripts.
- The far fish keep under a third of their triangles (about a fifth;
  the mackerel 29 per cent, as its seams hold on to its corners), made
  by the example's tools/far.mjs, which welds, then simplifies with a
  smaller ratio until the fish is light enough; at 10 m and beyond.
- The KTX2 test picture is a carbon-fibre normal map from Khronos's
  "Chronograph Watch" (CC BY 4.0), not the sample assets' logo picture.
- Checks changed because what they check changed: the version a viewer
  does not know is 0.4 or 9.9 now, not 0.3 (review-134-viewer, holoml's
  tests); T8 has seven examples and Blockworld at 0.3; V9 hears the
  walls and furniture by their labels; W10's bay is 0.23 MB, not 0.7;
  X5 lets a far fish wait for its own model while its lighter version
  is drawn; holoml's site test expects seven example sites, and its
  aquarium test finds the air stones with their labels.
- tests/e2e/m25.e2e.ts runs in part 1 of the automatic builds (every
  file not listed in another part) until its time on GitHub's machines
  is known.

### Results so far (Windows 11, 2026-10-07)

- HL1: holoml's 883 tests pass (Jing with Java 17 among them), and its
  lint and type check are clean.
- HL2 to HL7, HL9: tests/e2e/m25.e2e.ts, 18 checks, pass, with m17 to
  m21 (the example sites' own checks, 50 with m25 in the last run). The
  ocean tunnel: 130 frames a second; its fish draw 35,863 triangles,
  132,266 if all were near. The sneaker store loads 0.76 MB at first
  (2.4 MB before). The unit tests (526) pass; lint and the type check
  are clean.
- HL8 and HL10, the full end-to-end run on this computer: 388 of 393
  checks pass. The five that fail all use the clipboard (D8's copy a
  link, copy text, and paste; K2; and M1's copy after a real click):
  each found the clipboard empty. Windows itself refused the clipboard
  at the time (PowerShell's Set-Clipboard failed five times of five), so
  another program was holding it; they are to be run again when it is
  free (`pnpm test:e2e tests/e2e/m2.e2e.ts tests/e2e/m9.e2e.ts
  tests/e2e/review-134-main.e2e.ts -t "D8|K2|copy"`). Nothing in this
  milestone touches the clipboard. (Run again by the owner: 7 passed,
  "After milestone 25", below.)
- On Linux (`pnpm test:linux` with m19, m20, m21, and m25, drawn in
  software): 43 pass and 7 are skipped (the budgets for a graphics
  card); the ocean tunnel draws 4 frames a second there, logged.
- The Android app builds, its unit tests pass, and it carries the
  decoders (`./gradlew testDebugUnitTest assembleDebug`); its checks on
  the tablet, the automatic builds, and the published sites: not
  checked yet when this was written. Since: the automatic builds passed
  (#59 and #60) and the tablet's checks passed (prompt 174); the
  published sites and specification checked by hand (HL10) were
  cleared by the owner (2026-10-09, prompt 186).
- Found while taking the screenshots, not part of this milestone:
  HoloML's content policy's `webrtc 'block'` is not a directive
  Chromium knows, so it is ignored (the console says so on every
  HoloML page), and a HoloML page can make a peer connection. The
  review of 2026-09-30 (M6) meant it to block them. Offered to the
  owner as a separate task, to be approved before it is built;
  approved and fixed in prompt 172 ("After milestone 25", below).

## Milestone 26 — Privacy and data tools

Status: Accepted 2026-10-08 (prompt 184), after pull request #63
merged. Plan approved (2026-10-08, prompt 178) with the recommended
answers to Q1 to Q7. Build approved (prompt 179). Rule 13
check done (ARCHITECTURE.md section 3: 44.7.0 is
still the newest stable release). The roadmap's fourth item, the
history search index cleared of a deleted entry's pieces at once, was
done by the review of 2026-09-30 (D6: schema 5 gives the index its own
secure-delete; scrub.test.ts checks it), so it is not in this plan.

Goal: three tools from GitHub issues #24, #26, and #27. Pages are
loaded over HTTPS unless the person chooses otherwise for a site. One
site's stored data can be seen and cleared without touching the
others. Bookmarks come in from another browser and go out to a file.
Nothing new is sent over the network.

### How it would work (proposed)

1. **HTTPS-only browsing (#24).**
   - An `http://` address is tried as `https://` first, for typed
     addresses, links, and redirects alike, with the rest of the
     address unchanged.
   - A site that cannot be reached that way gets a card in place of
     the page: "This site does not offer a secure connection". It has
     two buttons, "Go back" and "Continue to the site (not secure)".
     Nothing goes over plain HTTP until that button is clicked.
   - Continuing makes an exception for that site. How long it lasts is
     Q2. Exceptions are listed in Settings, each with Remove, and the
     site panel shows a site's exception and can remove it.
   - Private tabs keep their own exceptions, in memory only, gone when
     the last private tab closes.
   - Addresses that cannot have a certificate are never upgraded:
     `localhost`, loopback and private network addresses, and
     single-word host names. Q4 asks whether that is right.
   - A setting turns HTTPS-only off. Its default is Q1.
   - A redirect from https back to http on the same site counts as a
     failure, and gets the card, so it cannot loop.
2. **Per-site storage (#26).**
   - A list of the sites that keep data in the normal profile: cookies,
     site storage (local storage, IndexedDB, service workers, cache
     storage, file systems), and cached files. For each site it gives
     what can be known; Q5 says how much that is.
   - Clear removes one site's cookies and site storage, and its cached
     files, through Electron's `session.clearData` with that site's
     origins. The words say exactly what is cleared. Bookmarks,
     history, and saved passwords are kept.
   - A site's open tabs are reloaded after a clear, so a page does not
     write back what it still holds in memory.
   - Private tabs are never listed (their data is in memory and cleared
     when the last one closes, as now), and the list itself is never
     saved.
   - Where it lives is Q7. How sites are grouped is Q6.
3. **Bookmark import and export (#27).**
   - Import reads the bookmark file every browser exports (the
     "Netscape bookmark file", HTML), chosen with the system's file
     chooser. It is read as text by a small parser of our own: it is
     never shown as a page, and nothing in it runs.
   - A preview lists what would be added, and what is skipped and why
     (already bookmarked, not an http(s) address, malformed), with Add
     and Cancel. Nothing changes before Add.
   - Duplicates: an address already bookmarked is skipped and keeps its
     title. Folders: Q3.
   - Export writes the same format, every bookmark with its title, its
     date, and its icon, to a file chosen with the system's save
     dialog. History, passwords, and other data are never included.
   - Limits: a file of at most 10 MB and 20,000 bookmarks; past them,
     the import stops and says so.
   - Import and export are in the Library's Bookmarks tab.

### Software to install

None. The system file dialogs are Electron's own. Q6 b would add the
Public Suffix List, a data file (MPL 2.0), copied into the repository
with its SHA-256 and refreshed by a script run by hand, as the filter
lists are; the script would be one new fetch, from publicsuffix.org.

### Questions (answered with the recommendations, prompt 178)

- Q1, HTTPS-only's default.
  - a (recommended): on, for normal and private tabs. Most sites offer
    HTTPS, and a privacy browser should not fall back to HTTP quietly.
  - b: off by default, turned on in Settings.
  - c: on in private tabs only.
- Q2, how long an exception lasts.
  - a (recommended): continuing from the card makes an exception until
    the browser closes. A lasting one is set on purpose, in the site
    panel ("Always allow HTTP for this site") or in Settings, and stays
    until removed.
  - b: every exception lasts 30 days, then the card shows again.
  - c: every exception lasts until removed.
- Q3, folders in imported bookmarks (bookmarks have none today).
  - a (recommended): no folders. Imported bookmarks join the one list,
    and the folder each came from is shown with it in the preview only.
    Export writes one flat list.
  - b: add folders to bookmarks (a schema change, and a tree in the
    Library), kept on import and written on export.
- Q4, which addresses are never upgraded.
  - a (recommended): `localhost` and `*.localhost`, loopback addresses,
    private network addresses (10/8, 172.16/12, 192.168/16, fc00::/7,
    fe80::/10), and single-word host names (`router`, `nas`), as
    Chrome does.
  - b: loopback only; everything else upgraded.
- Q5, what the site list shows of each site's storage.
  - a (recommended): what the browser can count without guessing:
    cookies (how many, and their size), and for each kind of site
    storage whether the site has some. The words say that sizes of site
    storage and cached files are not shown per site, as Electron does
    not report them.
  - b: also sizes on disk for the kinds Chromium keeps in a folder per
    site (IndexedDB, file systems, service workers), read from the
    profile folder: closer to a size, but it depends on Chromium's
    folder layout, which may change.
- Q6, how sites are grouped.
  - a (recommended): by host name, as the shield and the zoom do. A
    cookie set for a parent domain (`.example.com`) is listed under
    that domain, and clearing a host says when such cookies stay.
  - b: by registrable domain (`news.example.co.uk` under
    `example.co.uk`), as Chromium and Firefox group them, using the
    Public Suffix List (a new data file and a new fetch, above).
- Q7, where per-site storage lives.
  - a (recommended): a fourth tab in the Library, "Sites", beside
    Bookmarks, History, and Passwords, with search. The site panel gets
    a link to its site there.
  - b: in Settings, under "Clear data".

### Tasks

- [x] 1. HTTPS-only: the upgrade in the shield's one onBeforeRequest
      listener, the redirect check, the card, the exceptions (normal
      and private), the setting, the site panel, Settings.
- [x] 2. Per-site storage: the site list (cookies, site storage, cache),
      clearing one site, reloading its tabs, the Library tab or the
      Settings section (Q7).
- [x] 3. Bookmark import and export: the parser and the writer (unit
      tested), the preview, the file dialogs, the limits.
- [x] 4. Checks PD1 to PD10: unit tests beside the code and
      tests/e2e/m26.e2e.ts. HTTPS is tested with local fixtures: a test
      host name mapped to 127.0.0.1 and a test certificate trusted only
      in test runs, so nothing leaves the computer.
- [x] 5. Documents: README, ARCHITECTURE (decisions, files, the privacy
      parts), docs/privacy.md (what is kept and where), AGENTS.md's
      testing list, CHANGELOG, HANDOFF, TODO; #24, #26, and #27 closed
      on merge; the screenshots (`MILESTONE=m26 pnpm screenshots`, the
      previous set out of the tree) and the README's four pictures.

### Checks (named PD, for privacy and data)

| # | Check | Pass when |
|---|---|---|
| PD1 | HTTPS upgrade | A typed `http://` address, a link, and a redirect to http all load over HTTPS with the same path and query; local addresses (Q4) are left alone |
| PD2 | No quiet fallback | A site without HTTPS gets the card, and no request goes over HTTP before "Continue"; Go back returns; an https-to-http redirect gets the card, not a loop |
| PD3 | Exceptions | Continue makes the exception Q2 says; it is listed in Settings and the site panel; Remove ends it, and the card shows again; it outlives a restart only when lasting |
| PD4 | Private tabs | A private tab's exception does not reach normal tabs, and is gone when the last private tab closes |
| PD5 | The setting | With HTTPS-only off, http loads as before; the setting persists |
| PD6 | The site list | Sites with cookies and site storage are listed, from several origins, with what Q5 says; private tabs' sites are not; the list is not saved |
| PD7 | Clearing one site | Its cookies, local storage, and IndexedDB go, and its open tab is reloaded; another site's data, bookmarks, history, and passwords stay; a parent domain's cookie is handled as Q6 says |
| PD8 | Bookmark import | The preview lists what is added and skipped; Add adds them; Cancel adds nothing; duplicates are skipped; Unicode and escaped titles are kept; a large file within the limits imports, and one past them stops with a message; malformed input is reported, and nothing in the file runs |
| PD9 | Bookmark export | The file is in the standard format, and importing it into an empty profile gives the same bookmarks (a round trip); it holds nothing but bookmarks |
| PD10 | Regression | Every earlier milestone's checks, the unit tests, and the automatic builds on Windows and Linux |

### Done when

- PD1 to PD10 pass, the documents and screenshots are updated, and the
  owner accepts the milestone.

### Decisions made while building

- Q5 a asked for "for each kind of site storage whether the site has
  some". Electron reports no such thing: per site it reports cookies
  only (session.cookies), and the cache only as one total. What a site
  holds in local storage, IndexedDB, and the rest could be learnt only
  from Chromium's own folders, which is Q5 b. So the Sites tab shows
  each site's cookies and open tabs, and says plainly that its other
  storage and its cached files are not reported per site; Clear removes
  them all. A site with neither cookies nor an open tab is not listed.
  The owner kept Q5 a as built (prompt 181).
- Clearing a site covers its origins on the usual ports and on any port
  an open tab of it uses: site storage is kept by origin, port and all,
  and the check (PD7, whose test site has a random port) found that the
  usual ports alone missed it. A site's storage on another port with no
  open tab is not reached.
- A redirect back to HTTP is refused only when it goes back to the very
  address that was upgraded (a loop); a redirect to another http://
  address on the same site is upgraded too, and a chain of them ends at
  Chromium's own redirect limit, which gets the card.
- Private tabs neither see nor make lasting exceptions: theirs last
  until the last private tab closes (the plan's "their own exceptions,
  in memory only").
- HTTPS-only is the desktop browser's: the Android app's pages are in
  Android's own WebView, which this milestone does not change.
- Test runs: the earlier checks' plain-HTTP test server is reached under
  names such as shop.test, which HTTPS-only would now upgrade. Test runs
  name them with --test-plain-http (main/launch-options.ts, test mode
  only), and HTTPS-only leaves them alone as it does local addresses,
  so those checks still check what they are about. HTTPS itself is
  checked with startDualFixtureServer and a certificate trusted by its
  fingerprint in test runs only (--test-trusted-cert).
- The dialogs for bookmark files are the system's; test runs show none,
  and a check names the file in the test log (nextFile).
- Found by the full run: a typed http:// address whose name cannot be
  looked up showed the "not found" card with the https:// address it
  was upgraded to (D7). The card, the tab, and the address bar now name
  the address that was asked for, and Retry asks for it again.
- Checks changed because what they check changed: E10 walks the
  Library's tabs with Shift+Tab, and meets the new Sites tab first.
- Found in the screenshots: the Sites tab's rows and the import
  preview's ran a name and its detail on one line, and the preview
  scrolled sideways; their rows are blocks now, as the Passwords tab's.

### Results so far (2026-10-08)

- Unit tests: 555 pass (new: storage/bookmark-file, privacy/https-only,
  site-data, and the service's import and export); lint and the type
  check are clean.
- tests/e2e/m26.e2e.ts: PD1 to PD9 pass, 9 checks.
- The full end-to-end run on Windows: 399 of 403 passed. The four that
  failed were this milestone's doing: D7 (a name not found shown with
  the https:// address it was upgraded to: fixed), E10 (the Library's
  new tab: the check lists it), and R5 (passes as written once D7 was
  fixed). Run again: D7, E10, R5, the shield's F checks, and PD1 to PD9
  pass (34 checks).
- On Linux (`pnpm test:linux` with m26, m2, m3, m4, m8,
  review-134-shell, and review-134-main): 148 pass.
- The screenshots (m26, 72; milestone 25's set out of the tree) and the
  README's four pictures, looked at.
- The full end-to-end run again, after the last fixes: 403 of 403
  passed (29 files), on Windows.
- The automatic builds of pull request #63 (prompts 182 and 183):
  CodeQL flagged the bookmark reader's single pass of tag removal
  (js/incomplete-multi-character-sanitization); a title is text
  wherever it goes, but the pass is now repeated until nothing changes.
  Then Windows part 2 failed T6 once: Blockworld's torch did not appear
  within 15 seconds of 5 and Q. It had not failed in the fifty failed
  builds before, passes here drawn in software (twice), and this
  milestone touches nothing of HoloML pages; run again, as a flaky
  check, and noted to be watched. The second try passed, and every
  part with it; #63 merged, closing #24, #26, and #27, and the owner
  accepted the milestone (prompt 184).

## Milestone 27 — Free camera and room navigation

Status: Done. Accepted 2026-10-09 (prompt 196), after pull request #71
merged with every automatic build passed. Plan approved (2026-10-09,
prompt 192) with the recommended answers to Q1 to Q6; build approved
(prompt 193). Drafted in prompt 191. Rule 13 check done (ARCHITECTURE.md section 3: 44.7.0 is
still the newest stable release).

Goal: leave the desk and look around the room, then come back to the
desk exactly as it was. Today the camera is fixed at the desk: it moves
only a little with the pointer (the parallax, up to 24 units) and always
looks at the page, from the one distance where the page is pixel-sharp
(packages/scene-core/src/layout.ts). This milestone adds a way to move
it freely, with the mouse, the keyboard, and a button, without ever
leaving the page blurred or a click landing somewhere unexpected.

### What is there today (the parts this touches)

- The camera (renderer/scene/room.ts): Three.js, field of view 40°,
  placed at (parallax x, parallax y, the pixel-sharp distance), looking
  at the middle of the page. The page is a CSS 3D panel drawn with the
  same camera; Chromium finds what a click hits through the 3D
  transform, so clicks land from any angle, but text is sharp only from
  the desk.
- What assumes the desk: the page's size and lean (computePanelLayout),
  the tab cards' arc (computeTabArc, in screen pixels), the horizon and
  sun (at the camera's height), the instrument panels' drift and the
  layers view's vanishing point (both fed by the parallax), and the
  checks that click on the page (C2, C3, H6, M3, M4, R4).
- Settings > Appearance > Page view: lean, its direction, "Room
  movement with the pointer" (the parallax), space around the page,
  "Flat and still", and "Default view".
- Drawn only when something changes; economy mode caps frames at 30 and
  turns the parallax off; reduced motion holds the camera still; a
  HoloML page that fills the window is drawn flat.

### How it would work (proposed)

1. **Looking around.** A "Look around" button in the top bar, a
   shortcut (Ctrl+Shift+K by default, changeable in Settings >
   Shortcuts), and, by Q5, dragging on the room itself start it. The
   camera then moves as Q1 says: by dragging, the wheel, and the keys
   (the arrows and W, A, S, D to turn and move, + and - or the wheel to
   come closer or go further, Page Up and Page Down to rise and sink).
2. **Coming back.** Escape, Home, the button again, or "Back to the
   desk" (a small notice at the top while away, which also says how to
   come back) return the camera to the desk in a quarter of a second,
   at once with reduced motion. Back at the desk the page is exactly
   where it was, to the pixel, so it is sharp again.
3. **Limits** (Q6). The camera stays in the room: above the floor, in
   front of the far horizon, within a distance of the desk, and never
   behind the page or inside a card.
4. **The page while away** (Q2). The page stays as it is (it keeps
   playing and loading) but takes no clicks or keys while the camera is
   away; a click on it brings the camera back to the desk first.
5. **The tab cards.** Clicking a card while away switches to its tab
   and returns to the desk, as a card click does now. The cards, the
   room, the horizon, and the glow keep their places in the world; the
   horizon no longer follows the camera's height while away.
6. **The other parts.** While away: the parallax is off, the instrument
   panels and the layers view stay as they are at the desk, and the top
   bar, menus, and panels work as usual (opening a panel does not bring
   the camera back). Opening a HoloML page that fills the window brings the
   camera back first; "Look around" is not offered there (pages cannot
   go full screen yet: it is refused until milestone 29). Without WebGL 2 it is not offered (the button
   says why).
7. **Economy mode** keeps its cap of 30 frames a second while moving;
   nothing is drawn while the camera is still, away or at the desk.
8. **Keyboard and screen readers.** Every movement has keys; the button
   has a name and a pressed state; entering and leaving are announced
   ("Looking around the room. Escape returns to the desk."); while away
   the keys go to the room, not the page.
9. **Starting** (Q3): the browser always starts at the desk.
10. **Android** (Q4): unchanged in this milestone; the tablet keeps its
    tilt.

### Software to install

None. Three.js (already installed) has the maths needed; the movement
is written for the room, as the HoloML viewer's is (viewer/controls.ts),
so the room's limits and keys are its own.

### Questions (answered with the recommendations, prompt 192)

- Q1, how the camera moves.
  - a (recommended): around the desk. Dragging turns the view around the
    page's middle, the wheel comes closer or goes further, and the keys
    also move it sideways and up and down. Hard to get lost, and the
    page stays in sight.
  - b: flying freely, as in a game: the mouse turns the head, W, A, S, D
    move. More freedom, and easier to get lost in a room that is mostly
    empty.
  - c: both, with a switch between them.
- Q2, the page while the camera is away.
  - a (recommended): it takes no clicks or keys; a click on it brings the
    camera back first. Nothing is typed or clicked at an angle where it
    is hard to see, and the page's text is never read blurred.
  - b: it stays live: clicks and keys reach it from any angle (Chromium
    finds the target), and the camera comes back only when asked.
- Q3, where the browser starts.
  - a (recommended): always at the desk.
  - b: where the camera was when the browser closed.
- Q4, the Android app.
  - a (recommended): unchanged in this milestone (it keeps its tilt);
    touch gestures for the room can come with a later Android milestone.
  - b: in this milestone too: two fingers turn the view, a pinch comes
    closer, and a button returns to the desk.
- Q5, dragging on the room.
  - a (recommended): dragging on the empty room (not the page, not a
    card, not the top bar) starts looking around, so the room invites
    it; a plain click there still does nothing.
  - b: only the button and the shortcut start it; dragging the room does
    nothing, as now.
- Q6, the limits.
  - a (recommended): the room's (step 3), so the room always shows.
  - b: none beyond the floor.

### Tasks

- [x] 1. The room's free camera: entering and leaving, the movement (Q1),
      the limits (Q6), the return to the exact desk pose, the horizon and
      glow kept in the world, and drawing only while moving.
- [x] 2. The page and the cards while away (Q2): input held, a click on
      the page or a card bringing the camera back, and the parallax,
      instrument panels, and layers view kept as at the desk.
- [x] 3. The controls: the top bar button, the shortcut (in Settings >
      Shortcuts), dragging on the room (Q5), the notice while away, the
      keys, announcements, reduced motion, economy mode, fill and full
      screen, and no WebGL 2.
- [x] 4. Checks FC1 to FC10: unit tests (the movement and its limits in
      packages/scene-core, beside parallax and layout) and
      tests/e2e/m27.e2e.ts.
- [x] 5. Documents: README, ARCHITECTURE (the room, the decisions),
      AGENTS.md's testing list, CHANGELOG, HANDOFF, TODO; the screenshots
      (`MILESTONE=m27 pnpm screenshots`, the previous set out of the
      tree, with a view of the room from away among them) and the
      README's four pictures.

### Checks (named FC, for free camera)

| # | Check | Pass when |
|---|---|---|
| FC1 | Entering and leaving | The button, the shortcut, and (Q5) a drag on the room start it; Escape, Home, the button, and the notice end it; back at the desk the page's corners on screen are the same as before to the pixel, and clicks land as before (C2's grid) |
| FC2 | The mouse | Dragging and the wheel move the camera as Q1 says, smoothly, and a plain click on the room still does nothing |
| FC3 | The keys | Every movement by the keys alone; the keys do not reach the page while away; the shortcut is changeable and the changed one works |
| FC4 | The limits | However far it is pushed (keys held, a long drag, the wheel), the camera stays above the floor, within the room's distance, and never behind the page (Q6) |
| FC5 | The page while away | As Q2 says: with a, a click or a key on the page does not reach it and brings the camera back; the page keeps loading and playing meanwhile |
| FC6 | The cards while away | A click on a card switches to its tab and returns to the desk; hovering and the rail's wheel work as at the desk |
| FC7 | Other states | Reduced motion: no animation, jumps; economy mode: at most 30 frames a second while moving; a HoloML page that fills the window brings the camera back and does not offer it; without WebGL 2 the button is unavailable and says why; a private tab works the same |
| FC8 | Screen readers | The button's name and pressed state; entering and leaving announced; the notice reachable by the keyboard |
| FC9 | Efficiency | Nothing drawn while the camera is still, away or at the desk; frames while moving at the display's rate (with a graphics card; logged in software, and skipped); idle after returning |
| FC10 | Regression | Every earlier milestone's checks (C2, C3, H6, M3, M4, and R4 among them, unchanged), the unit tests, and the automatic builds on Windows and Linux |

### Done when

- FC1 to FC10 pass, the documents and screenshots are updated, and the
  owner accepts the milestone.

### Decisions made while building

- The movement is its own (packages/scene-core/src/free-camera.ts, pure
  and unit tested), not the HoloML viewer's controls: the room's limits
  and its return to exactly the desk are what it is about. At the desk
  the camera is the fixed desk camera as before (the parallax); away,
  the free camera places it.
- The keys: the arrows turn; W and S (and + and -) come closer and go
  further; A and D slide sideways; Page Up and Page Down rise and sink;
  Shift moves three times as far; Home and Escape come back. A drag
  turns by a quarter of a degree a pixel.
- A limit added by check FC4 (Q6 a, "never behind the page"): turned to
  one side with the pivot slid the other way, the camera passed the
  page's plane beyond its edge, where the page shows its back. The
  camera now stays in front of the plane by a fifth of the desk's
  distance; the turn is held back first, then the pivot.
- The page while away (Q2 a): its panel takes pointer events of its own,
  so a class on the CSS layer holds them; and it is inert, so nothing
  gives it the keyboard (a webview taking the keyboard tells the shell
  nothing a check could rely on: test windows never take focus). A panel
  that closes while away gives the keyboard back to the notice; back at
  the desk, the page has it again if the notice had it.
- The horizon band (the plan's step 5): at a wide angle a flat band at a
  fixed place ended in the view. It now turns with the view, at the
  same distance and height, so it reaches across the view as a horizon
  does; the sun, the cards, the desk, and the floor keep their places in
  the world.
- The Android app shares the room: it is built with `lookAround: false`
  (Q4 a), so a touch dragged across the room there does not start it,
  and its top bar leaves the button out.
- Checks changed because what they check changed: M7 counts the
  shortcuts in Settings, 26 now with "Look around the room".
- Found by the owner while trying the build (prompt 194), not part of
  this milestone: in a development run (`pnpm dev`) the sneaker store's
  far shoes (Draco) could not be loaded, as the dev server prepares
  three's loaders in its own folder and the Draco and KTX2 loaders look
  for their decoders beside themselves; and the KTX2 transcoder's host
  page was looked for under the viewer's sources. The two loaders are
  now served as they are (viewer-deps.mjs, VIEWER_UNPREPARED) and the
  host is at the viewer's address's root in a development run too
  (viewer/decoders.ts). The development-run check in m16 now loads the
  compressed models' page as well: it fails without either fix (the
  Draco box failed; then the KTX2 box never finished) and passes with
  both. Built copies were not affected (HL4 passes).

### Results so far (Windows 11, 2026-10-09)

- Unit tests: 565 pass (new: packages/scene-core/src/free-camera.test.ts,
  9); lint and the type check are clean.
- tests/e2e/m27.e2e.ts: FC1 to FC9 pass, 13 checks. FC9 measured 137
  frames a second while looking around (graphics card); FC7 measured 23
  in economy mode (at most 30).
- FC10, the full end-to-end run: 418 of 421 passed (31 files). The
  three that failed: M7 (the shortcut count, changed as above, then
  passed); L9 (a search took 73 ms against 50 once, then passed run
  again, with and without this milestone's code); and C9 (the frame
  rate while the camera follows the pointer: 33 to 45 frames a second
  against 50, in six runs, three with this milestone's code, 39 to 45,
  and three without it, 37 to 42; this morning's full run passed C9 on
  the same code without the milestone, so this computer draws more
  slowly now than then, not because of the change). C9 is not changed;
  it is to be run again.
- The Android app: `pnpm --filter @hypersol/android build:web`, then
  Gradle's unit tests and the build pass (JDK 21, the Android SDK); not
  installed on the tablet (nothing it shows changes).
- The screenshots (m27, 75; milestone 26's set out of the tree) and the
  README's four pictures, looked at.
- On Linux (`pnpm test:linux` with m27, and m11 once): the first run
  failed FC3 once (it read where the camera was going before the shell
  had handled the key: the check now waits for each key's change), then
  12 pass and FC9's frame rate is skipped (drawn in software, 13 frames
  a second), in two runs; FC7 measured 19 in economy mode.
- The automatic builds of pull request #71 (prompt 195): the first
  failed L9 once on Windows (part 1: a search took 62.9 ms against 50;
  this milestone does not touch history, and L9 had missed once here
  too, then passed); run again, and with the fix of prompt 194 pushed,
  every part passed. #71 merged, and the owner accepted the milestone
  (prompt 196). L9 is noted to be watched, with C9 (to be run again on
  this computer).

## Milestone 28 — Lift to 3D

Status: Done. Accepted 2026-10-10 (prompt 201), after pull request #73
merged with every automatic build passed. Plan approved (2026-10-09,
prompt 198) with the recommended answers to Q1 to Q5, Q3 a's new kind
of request (a lifted model's file) with it; build approved (prompt
199). Drafted in prompt 197. Rule 13 check done (ARCHITECTURE.md
section 3: 44.7.0 is still the newest stable release). Built 2026-10-09
on the branch `m28-lift-to-3d`.

Goal: pictures and 3D models on ordinary web pages become objects in
the room. A picture lifts out of the page and stands in the room as a
framed picture; a model a page shows or links stands in the room as a
3D object you can turn and look at from every side (with milestone
27's free camera too). Nothing is lifted without asking, and nothing
the browser did not already have leaves the page without the owner's
agreement (Q1, Q3).

### What is there today (the parts this touches)

- The page preload reports the pictures in view (img, video, canvas; at
  least 16 pixels a side, up to 100), with their places and addresses
  (preload/layers.ts, shared/layers.ts). The shell keeps them per tab
  for this milestone (tab-view.ts), and nothing uses them yet. Pictures
  inside frames, CSS background pictures, and inline SVG are not
  reported.
- The tab cards are meshes in the room with pictures captured from the
  page (main/index.ts: capturePage, no network), hit by a ray
  (room.ts). Electron can capture one rectangle of a page the same way.
- No 3D model on an ordinary page is recognised. The HoloML viewer loads
  glTF models in a page's own process, within limits (viewer/budget.ts:
  32 MB a file, 2 million triangles, pictures up to 4096 pixels), from
  the page's own site only, with its decoders from the browser itself;
  the KTX2 transcoder runs in a sandboxed host of the viewer's own
  address (viewer/decoders.ts).
- The shell fetches nothing from the web (its content policy); the only
  thing the browser fetches for a page on its own is the page's named
  icon, through the page's own session after the shield (main/favicon.ts).

### How it would work (proposed)

1. **Lifting.** On a picture or a model, the right-click menu has "Lift
   into the room". By Q2, a "Lift" button in the top bar (with a
   shortcut) also lifts everything in view at once, up to 12 objects, so
   it works from the keyboard. A lifted picture rises out of the page
   where it is shown and settles beside the page, in an arc on the right
   (as the tab cards are on the left), facing the desk.
2. **Pictures** (Q1): captured from the page as it is drawn, the part in
   view, at the screen's resolution: no new request, and exactly what
   the page shows. A picture at least 48 pixels a side; a video lifts as
   a still of its current frame; a canvas as it is now.
3. **Models** (Q3): a page's `<model-viewer>` element, a `<model>`
   element, or a link to a `.glb` or `.gltf` file is recognised by the
   page preload and reported with the pictures. Lifted, the file is
   fetched by the main process through the page's own session after the
   shield (as the page's icon is), from the page's own site only, within
   the HoloML viewer's limits, and decoded in a sandboxed frame of the
   viewer's own address, which has no network and hands the room plain
   shapes and pictures (as the KTX2 transcoder's host does). The room
   draws it lit by its own lights, scaled to stand about as high as a
   card.
4. **Looking at them.** Hovering an object shows its name (the picture's
   text or the model's file name); dragging it turns it; a click brings
   it nearer, and again sends it back; with milestone 27's camera the
   whole arc can be walked round. Each has a close button that puts it
   back into the page.
5. **Their life** (Q4): lifted objects belong to their tab's page. They
   go when the page navigates or the tab closes, and when another tab
   is in front they wait. They are kept in memory only, never saved; a
   private tab's are the same.
6. **The rest.** Not offered on a HoloML page (its scene is already 3D)
   or without WebGL 2 (the menu entry and button say why). Reduced
   motion: objects appear in place without rising. Economy mode: as now.
   The layers view and lifting work together (a lifted picture is the
   page's picture as drawn, without the layers view's lift).
7. **Android** (Q5): unchanged in this milestone.

### Software to install

None. Three.js (installed) has the glTF loader the viewer uses already.

### Questions (answered with the recommendations, prompt 198)

- Q1, where a lifted picture's pixels come from.
  - a (recommended): captured from the page as it is drawn: no new
    request, and what you see is what lifts. A picture partly out of
    view lifts as far as it shows; its sharpness is the screen's.
  - b: fetched again from its address, at its full size, through the
    page's own session and the shield (a new kind of request, as the
    icon's): sharper, and whole even when partly out of view.
- Q2, how objects are lifted.
  - a (recommended): "Lift into the room" in the right-click menu for one,
    and a top bar button and a shortcut that lift everything in view (up
    to 12), so the keyboard alone can do it.
  - b: the right-click menu only.
- Q3, 3D models on pages.
  - a (recommended): in this milestone, fetched by the main process
    through the page's own session after the shield, from the page's
    own site only, within the viewer's limits, and decoded in a
    sandboxed frame (step 3). A new kind of request: made only when
    asked, by "Lift".
  - b: later; this milestone lifts pictures only, and recognises models
    without lifting them.
- Q4, how long lifted objects last.
  - a (recommended): as long as their page: gone when it navigates or its
    tab closes, never saved.
  - b: kept for the browser's session as a collection beside the desk,
    across pages (still never saved).
- Q5, the Android app.
  - a (recommended): unchanged in this milestone.
  - b: lifting by a long press on the tablet too.

### Tasks

- [x] 1. Finding what can be lifted: the picture report as it is, and
      models (`<model-viewer>`, `<model>`, links to `.glb` and `.gltf`),
      parsed and limited in the shell as the pictures are.
- [x] 2. Lifting pictures (Q1): the capture of one rectangle in the main
      process (only for the shell, only of its own tab's page), the
      objects in the room, rising out of the page, the arc, hover,
      turning, nearer and back, close.
- [x] 3. Lifting models (Q3): the fetch through the page's session and
      the shield, with the limits; the sandboxed decoding frame; the
      models in the room.
- [x] 4. The controls (Q2): the right-click entry, the top bar button and
      its shortcut, keyboard access and announcements; the states (HoloML
      pages, no WebGL 2, reduced motion, economy mode, private tabs, the
      page navigating, the tab closing or sleeping).
- [x] 5. Checks LT1 to LT10: unit tests beside the code and
      tests/e2e/m28.e2e.ts, with fixture pages of pictures, a video, a
      canvas, and models embedded and linked (the fixtures' own glTF
      files, no network).
- [x] 6. Documents: README, ARCHITECTURE (the room, the decisions, what
      is fetched and why), docs/privacy.md (what is captured, fetched,
      and kept), AGENTS.md's testing list, CHANGELOG, HANDOFF, TODO; the
      screenshots (`MILESTONE=m28 pnpm screenshots`, the previous set
      out of the tree) and the README's four pictures.

### Decisions made while building

- Where things are (ARCHITECTURE.md section 4, "Lifting into the
  room"): the page side in preload/lift.ts, its messages and checks in
  shared/lift.ts; the capture and the model's fetch in main/lift.ts and
  main/index.ts; the decoding frame in viewer/lift-host.ts, served at
  `hypersol-viewer://app/lift-host.html` with its own content policy
  (main/holoml.ts, LIFT_HOST_CSP), and framed by the shell
  (renderer/scene/lift-decoder.ts; the shell's own policy now has
  `frame-src hypersol-viewer:`); what it hands back, and its checks, in
  shared/lifted-shape.ts; the objects in the room in
  renderer/scene/lifted.ts; the menu, the button, the shortcut, and the
  order of capture, fetch, and decoding in renderer/lift.ts.
- Drawn over the page: the page is placed with CSS over the room's own
  canvas, so an object drawn there was hidden wherever it crossed the
  page (rising out of it, coming nearer). The objects have a second
  WebGL canvas of their own over the page, with the room's camera; they
  always stand between the page and the camera, which never goes behind
  the page, so this is right from every place the camera can be. Each
  object has a real button over where it is drawn, which takes the
  mouse, the keyboard, and screen readers. The room's parallax holds
  still while the pointer is on one, as over the page (found while
  checking: the object moved under the pointer).
- Where on the page: the preload reports where each thing is drawn now
  (the layers view's lift included), as far as it shows; a picture is
  captured from there and rises from there. The right-click menu learns
  what was clicked before it shows: the preload sends it at once, and
  waits for the answer, on the click itself.
- Which to lift, with more than 12 in view: models first, then
  pictures, each in the page's order (the first try took the largest
  first; with the layers view on, a picture pushed partly out of view
  by its lift then lost its place). A picture put back can be lifted
  again; it joins the end of the arc.
- The arc: the tab cards' arc mirrored on the right, its slots as high
  as a card at most and smaller when there are many, so all 12 fit
  without scrolling; the page leaves room for it (as for the cards'
  rail) while the tab in front has objects.
- A model's files: a file it names on another site is not fetched (the
  model shows without it); one on its own site that does not come, or
  passes a limit, refuses the model, with the reason in the notice
  (the first build left it out quietly). Each file up to 32 MB, all of
  a model's up to 128 MB (the viewer's limit for a page), 2 million
  triangles, pictures up to 4096 pixels a side (made at most 1024 for
  the room), 30 seconds. KTX2 pictures are made plain RGBA in the frame,
  as there is no graphics card there to ask. A file the loader cannot
  read is "it could not be read as a glTF model" in the notice, not the
  loader's own words.
- Refusals are said once, at the end: "Could not lift 4 models: …",
  each with its reason; lifting is said by the notice, a model arriving
  and putting back by the layer's own live region.
- A HoloML scene has no right-click menu (its orbit controls take the
  right button), so there the menu offers nothing; the button is
  unavailable and says why, and the shortcut's notice too. The menu's
  entry says why on a HoloML page where a menu does show.
- Without WebGL 2 the main process cannot know, so the menu still offers
  the entry; choosing it says why in the notice.
- A picture's frame and a model's placeholder take the theme's colours
  and change with it; a model's own colours are its own.
- The Android app shares the room: built with `lift: false` (Q5 a), and
  its top bar leaves the button out.
- Checks changed because what they check changed: M7 counts the
  shortcuts in Settings, 27 now with "Lift what is in view into the
  room".

### Checks (named LT, for lift)

| # | Check | Pass when |
|---|---|---|
| LT1 | Finding | Pictures (img, video, canvas) and models (`<model-viewer>`, `<model>`, links to `.glb`/`.gltf`) in view are found; a report that is malformed, too large, or names another scheme is refused |
| LT2 | Lifting a picture | "Lift into the room" on a picture puts it in the room with the page's own pixels (compared with the page), rising from where it was shown; nothing is requested from the network (Q1 a) |
| LT3 | Lifting everything | The top bar button and its shortcut lift every picture and model in view, up to 12, in the arc; again with more in view, still 12 |
| LT4 | Lifting a model | An embedded and a linked model come into the room with their shapes and pictures; only the page's own site is asked, through the page's session and the shield; a file over a limit, from another site, or that cannot be decoded is refused with a notice, and the rest lift (Q3) |
| LT5 | The decoding frame | The model is decoded in the sandboxed frame, which can reach no network (checked with a file that asks for an outside address) |
| LT6 | Looking at them | Hover names an object; a drag turns it; a click brings it nearer and back; close puts it back; the free camera reaches them |
| LT7 | Their life | They go when the page navigates or the tab closes, wait while another tab is in front, are never saved (the profile's files), and a private tab's go with it (Q4) |
| LT8 | Other states | Not offered on HoloML pages or without WebGL 2 (saying why); reduced motion; economy mode; the layers view on |
| LT9 | Keyboard and screen readers | Lifting by the keyboard alone; each object named; lifting and putting back announced |
| LT10 | Regression | Every earlier milestone's checks, the unit tests, and the automatic builds on Windows and Linux |

### Done when

- LT1 to LT10 pass, the documents and screenshots are updated, and the
  owner accepts the milestone.

### Results so far (Windows 11, 2026-10-09)

- Unit tests: 589 pass (new: shared/lift.test.ts, 9;
  shared/lifted-shape.test.ts, 3; main/lift.test.ts, 10; and one each in
  main/context-menu.test.ts and main/holoml.test.ts); lint and the type
  check are clean.
- tests/e2e/m28.e2e.ts: LT1 to LT9 pass, 25 checks, with the graphics
  card and drawn in software (`HYPERSOL_TEST_SOFTWARE=1`).
- LT10, the full end-to-end run (before the last two checks of LT6 and
  the refinements they check were added): 438 of 446 passed (32 files).
  The eight that failed:
  - five that read the system clipboard (D8's copy link, copy text, and
    paste; K2 and K3; M1's copy after a real click): the clipboard read
    back empty. The clipboard of this computer was out of use for every
    program at the time (PowerShell's Set-Clipboard failed too, "Requested
    Clipboard operation did not succeed", and still did an hour later; no
    window was holding it). On Linux (below) all five pass. To be run
    again here once the clipboard works.
  - LT6's new check (the room holding still on an object, the frames and
    the theme), added after that run's build; it passes with the build
    that has its code.
  - L9 (a history search took longer than 50 ms; it passed run again
    alone, as in milestone 27) and C9 (32.3 frames a second while the
    camera follows the pointer, then 44.7 run again, against 50; the
    range milestone 27 measured on this computer with and without its
    code; nothing is lifted in C9, so the new layer draws nothing). C9 is
    not changed; both stay on the watch list.
- On Linux (`pnpm test:linux` with m2, m9, review-134-main, and m28):
  95 of 95 pass, drawn in software, the clipboard checks among them.
- The Android app: `pnpm --filter @hypersol/android build:web`, then
  Gradle's unit tests and the build pass (Android Studio's JDK, the
  Android SDK); not installed on the tablet (lifting is left out there).
- The screenshots (m28, 78; milestone 27's set out of the tree, its
  links at commit 55a5d0c) and the README's four pictures, looked at.
- The automatic builds of pull request #73 (prompt 200): every part
  passed but Windows part 1, where two of these checks failed in
  GitHub's smaller window (about 1008 by 705 inside, against 1264 by 761
  here): LT2's right-click on the small picture landed outside the page,
  as the fixture's row of pictures was wider than the page once the arc
  took its room; and LT6's free-camera check asked the object to move
  more than 20 pixels on screen, where it moves 19 in that window. The
  lifting was right in both (the arc does not cover the page at that
  size: the page ends at x 772, the objects begin at 806). The row now
  wraps where the page is narrow, and the check waits for the camera to
  arrive and counts any move. All 25 pass here in a 1024 by 768 window
  (a change to the harness for that run only, not kept), and at the
  usual size with the graphics card and in software. Run again with
  that, every part passed; #73 merged, and the owner accepted the
  milestone (prompt 201). Still to be run again on this computer: the
  five clipboard checks (once its clipboard works), and C9; L9 is
  watched. Since: the clipboard checks passed in the full run of
  2026-10-10 (issue #75); C9 and L9 are issue #82.

## Issue #75: full screen and pointer lock

Status: Done. Accepted 2026-10-10, after pull request #83 merged with
every automatic build passed (the issue closed with it). Built on the
branch `issue-75-fullscreen`. Plan and build approved with the
recommended answers to Q1 to Q5 (2026-10-10). The first issue after the
milestones (prompt 203). Rule 13 check done
(ARCHITECTURE.md section 3: 44.7.0 still the newest stable release).

Goal: a video player's full-screen button and a game that holds the
pointer work as in other browsers, and the browser itself always says
so and how to leave, where no page can hide it.

### What there is today, and what a short experiment showed

- Both are refused to every page (main/permissions.ts,
  ALLOWED_WITHOUT_ASKING; since milestone 9), because a page in full
  screen could draw a fake top bar and the browser has no notice.
- Allowed for a moment on a branch (since reverted), a click on a
  page's full-screen button put the whole window into the system's full
  screen, and the page's box filled it; in the shell the page's webview
  is then the full-screen element, which is drawn over everything,
  including the browser's own top bar and notices. A notice in the
  browser's top layer (a "popover") is drawn over it: checked with a
  picture.
- Electron does not leave full screen on Escape (a browser's interface
  does that, and the shell has to): pressing Escape did nothing. Asking
  the page to leave from the main process works, and the window goes
  back.
- Pointer lock was refused in the test window ("WrongDocumentError"), as
  the hidden test windows never take the keyboard focus; the checks can
  make the page believe it has it (Chromium's focus emulation).

### How it would work (proposed)

1. **Full screen** (Q1, Q2): allowed to a web page after a real click or
   key, as Chromium requires, without a question. The page fills the
   whole screen; the room, the top bar, and the cards are hidden behind
   it. Escape always leaves: the main process sees the key before the
   page does, so no page can keep it; the page's own way out, a tab
   switch, closing the tab, leaving the page, a crash, and looking
   around also leave. Afterwards the window, the page, and the camera are
   exactly as before.
2. **Pointer lock** (Q3): allowed after a real click, the pointer
   hidden and given back by Escape (the main process again), a tab
   switch, or the window losing focus.
3. **The notice** (Q4): the browser's own, in its top layer, over the
   page: "127.0.0.1 is full screen. Press Esc to leave." (and "...has
   the pointer. Press Esc to get it back."), with the site as the
   address bar shows it; shown for 4 seconds on entering, and again when
   the pointer reaches the top edge of the screen; announced to screen
   readers. In the theme's colours.
4. **The rest**: private tabs the same; a HoloML page the same (its
   scripts may ask, as a page's may; the viewer itself asks for
   neither); lifted objects and the instrument panel hidden while full;
   economy mode and reduced motion unchanged. The Android app unchanged
   (Q5).

### Questions

- Q1, where full screen goes.
  - a (recommended): the whole screen, as other browsers do (what
    Electron does by itself).
  - b: the browser's window only: the page fills the window, the top
    bar and the room hidden, the window as it was.
- Q2, asking first.
  - a (recommended): no question, the notice instead (as Chrome and
    Firefox; only after a real click or key).
  - b: a prompt for each site, remembered as the camera's is.
- Q3, pointer lock.
  - a (recommended): with full screen, the same way (after a real click,
    the notice, Escape gives it back).
  - b: still refused; full screen only.
- Q4, when the notice shows.
  - a (recommended): for 4 seconds on entering, and again whenever the
    pointer reaches the top of the screen.
  - b: only on entering.
- Q5, the Android app.
  - a (recommended): unchanged (its pages are in Android's WebView,
    which has its own full screen).

### Tasks

- [x] 1. The main process: allow both to web pages after a gesture;
      Escape (and the other ways out) leave; the window put back.
- [x] 2. The shell: the notice in the top layer; the room, the top bar,
      lifted objects, and the instrument panel while full; the camera
      and the tab state afterwards.
- [x] 3. Checks FS1 to FS8 (below), in tests/e2e/issue-75.e2e.ts with a
      fixture page (a box that asks for full screen, a button that asks
      for the pointer), and unit tests for the rules.
- [x] 4. Documents: ARCHITECTURE (the decision; permissions), docs/
      privacy.md if anything changes there (nothing is sent), the
      CHANGELOG, the README's feature list, AGENTS.md's testing list,
      HANDOFF, TODO; the issue closed by the pull request.

### Decisions made while building

- Where things are (ARCHITECTURE.md section 4, "Full screen and pointer
  lock"): the rules and the notice's words in shared/fullscreen.ts; the
  permissions in main/permissions.ts; what each page holds, Escape, and
  leaving in main/fullscreen.ts; pointer lock reported by
  preload/fullscreen.ts; the notice in renderer/hud/hold-notice.ts;
  the rest in renderer/app.ts (onHold, releaseHeld).
- The notice is a popover, in the top layer. The page's webview goes
  into the top layer as the full-screen element after the main process
  has said so, and was drawn over the notice shown then (found by check
  FS4): the notice is shown again on the shell's own `fullscreenchange`,
  which brings it above.
- Escape: Electron does not leave full screen on Escape (a browser's
  interface does that), so the main process does it, before the page
  sees the key, on the page and on the shell. The page is taken out of
  both by a script run in a world of the main process's own, so a page
  that replaces `document.exitFullscreen` cannot stop it (the fixture
  does).
- The pointer at the top of the screen: told by the page's mouse events
  as the main process sees them (every frame's, so an embedded player's
  too), at most every 1.5 seconds.
- A page whose tab closes in full screen never says it left: the shell
  forgets it with its tab (found by check FS2).
- Pointer lock is given by Chromium only to a page in a window that has
  the system's focus; test windows never take it (they stay out of the
  way). FS5 runs with visible windows (`HYPERSOL_TEST_SHOW=1`) and is
  reported as skipped otherwise, as the budgets are in software.
- Looking around is not offered while a page holds either, and the
  camera comes back to the desk when one does.
- The check of the review of 2026-09-30 that full screen is refused
  (review-134-main.e2e.ts, M1) changed with the requirement: full screen
  is given after a click, with the notice, and Escape leaves.
- On Linux without a window manager (`pnpm test:linux`, as on GitHub's
  machines), a page that left full screen by itself once left the
  browser's own page at 1 by 1 pixel in a window of the right size, until
  the window's bounds were set again. After a page leaves full screen the
  main process now checks the browser's size against the window's and,
  if they differ, sets the bounds again (main/fullscreen.ts, mendWindow).
  FS2 checks the window back where it was and the browser as large as
  it: without the mending two checks fail on Linux, with it they pass.
- Each page's state is kept in a WeakMap: a "destroyed" listener of its
  own took each page past Node's ten, and the warning was an error in C1
  and in #12's check (found by the full run).
- Checks that found their own faults, not the browser's: the harness
  runs code in a page as if after a click, and a click's activation
  lasts a few seconds, so FS3 waits until the page has none; a click
  aimed before the page was laid out again after leaving missed, so the
  checks wait for it; and the pointer moves sent through the shell now
  and then reached nothing just after the window changed size (one run
  in about eight), so FS4's moves are given to the page itself.

### Checks (named FS)

| # | Check | Pass when |
|---|---|---|
| FS1 | Full screen | A click on a page's full-screen button fills the screen with the page's element; the page says so (`fullscreenchange`) |
| FS2 | Leaving | Escape leaves, and a page that listens for Escape and stops it cannot keep it; the page's own exit, a tab switch, closing the tab, and leaving the page leave too; the window's size and place, the page's size, and the camera are as before |
| FS3 | No click, no full screen | A page that asks without a click is refused, as before |
| FS4 | The notice | Shown over the page with the site and "Press Esc"; gone after 4 seconds; shown again at the top edge; announced; the page cannot cover it |
| FS5 | Pointer lock | A click on the page's button holds the pointer; the notice says so; Escape gives it back; a page cannot keep it |
| FS6 | Other states | Private tabs; a HoloML page's script; while looking around; lifted objects hidden while full and back after |
| FS7 | Keyboard and screen readers | The notice is announced; the keyboard is the page's while full and the shell's after |
| FS8 | Regression | Every earlier check, the unit tests, and the automatic builds on Windows and Linux |

### Results so far (Windows 11, 2026-10-10)

- Unit tests: 594 pass (new: shared/fullscreen.test.ts, 4; and one in
  main/permissions.test.ts); lint and the type check are clean.
- tests/e2e/issue-75.e2e.ts: FS1 to FS4, FS6, and FS7 pass, 7 checks,
  with the graphics card and drawn in software; FS5 (pointer lock) is
  reported as skipped in hidden windows and passes with
  `HYPERSOL_TEST_SHOW=1` (run once, a few seconds on screen). FS1 to FS4
  passed eight runs of eight once the checks' own faults were fixed.
- FS8, the full run (before the WeakMap change): 450 of 454 passed, 1
  skipped (FS5), in 33 files; the five clipboard checks passed (the
  clipboard works again). The three that failed: C1 and #12's check (the
  listener warning, fixed; both pass since) and C9 (35.3 frames a second
  against 50, as in milestones 27 and 28; issue #82). Since: m1, m6,
  review-134-main, and issue-75 run again, all pass but C9.
- On Linux (`pnpm test:linux`): issue-75, review-134-main, and m1 pass,
  FS5 skipped (with the mending of the window's size above).
- The automatic builds of pull request #83: every part passed; #83
  merged, closing #75, and the owner accepted the issue (2026-10-10).

## Issues and advisories of 2026-10-09 (prompts 188 and 189)

Five new issues (#66 to #68 here, #42 and #43 in holoml) and three
draft advisories here, filed by the owner from a review of earlier
snapshots (the browser at a8a7df8, holoml at v0.2.2); each was checked
against main and still applied. Approved in prompt 189 with the
recommendations: in this order, in ordinary public pull requests;
holoml released as 0.3.1 and the browser's copy made from that tag; and
SPEC.md's sentence on several `material` elements for one name.

| # | Item | Fix | Check |
|---|---|---|---|
| 1 | GHSA-h34m-3f58-vj6h: a private tab opened while the last private session was cleared read its data | The private session's requests wait for the clearing (the shield holds them); clearings run one after another | fixes-189 "GHSA-h34m" |
| 2 | GHSA-2mm9-j4r3-p2v2: a Show answered after the Library closed was shown on reopening | A Show answered after shown passwords were forgotten is dropped | fixes-189 "GHSA-2mm9" |
| 3 | GHSA-vv44-hw63-7mm7: a deleted sign-in's shown password under a new sign-in given its id | Shown passwords forgotten on Delete and whenever saved passwords change | fixes-189 "GHSA-vv44" |
| 4 | #68 and holoml #43: source-map-js 1.2.1 (GHSA-68fv-2mgg-jv7q) | PostCSS 8.5.29, source-map-js 1.2.2, lockfiles only | `pnpm audit` here finds nothing |
| 5 | #66: only the first `material` for a name applied | Each, in document order; SPEC.md says so (0.3, second edition) | fixes-189 "#66" |
| 6 | #67: a hit's normal turned as a direction | The normal matrix (inverse transpose) | fixes-189 "#67" |
| 7 | holoml #42: a choice's value bad by its kind reported twice | The checks between values pass over it | holoml's conformance sample choice-values-bad-by-kind |

Each check fails without its fix (run with the fix set aside).

Found on the way: holoml's `pnpm audit` also lists, in development
tools only, serialize-javascript and diff (through @vscode/test-cli's
mocha) and braces (through @gltf-transform/cli; no patched version).
Not part of #43; for the owner to decide.

Results so far (Windows 11, 2026-10-09):

- Here: the unit tests (556), lint, and the type check pass;
  tests/e2e/fixes-189.e2e.ts, 5 checks, pass.
- holoml (pull request #44): 885 tests, lint, the type check, and the
  site's build pass; its automatic builds passed.
- The full end-to-end run on Windows: 408 of 408 passed (30 files,
  21 minutes), with these fixes and HoloML 0.3.0's copy.
- holoml #44 merged; tagged v0.3.1 at 51af846, a pre-release (prompt
  190). The copy here is made from it (`pnpm holoml:sync v0.3.1
  --examples v0.3.1`: the checker and the version; the example sites
  unchanged). Then: the unit tests (556), lint, and the type check
  pass, and m14, m15, m17, m18, m25, review-134-viewer, and fixes-189
  pass, 115 checks.
- Pull request #69 merged (its 16 automatic checks passed) before the
  copy reached it; the copy goes in its own pull request, from the
  branch holoml-0.3.1.

## After milestone 25 (2026-10-08, prompt 172)

Both pull requests merged (holoml #39, the browser #59), and every
automatic build passed. The owner then asked for the items below.

- The clipboard checks again (D8, K2, and M1's copy, which had found
  the clipboard empty): run by the owner, 7 passed.
- The tablet: the owner's aquarium said the browser does not know
  HoloML 0.3, as the app on it was the build of 2026-10-07, before
  milestone 25. The app built from main (its unit tests pass) is
  installed over USB; the checks on the tablet are the owner's (they
  passed, prompt 174).
- Peer connections on HoloML pages, approved: the viewer takes the RTC
  constructors out of the page's JavaScript and refuses frames
  (viewer/guard.ts); the decoder's frame for KTX2 pictures is sandboxed,
  in a closed shadow root. The policy's `webrtc 'block'`, ignored by
  Chromium, is gone. Its check (review-134-main.e2e.ts, M6) fails
  without the guard and passes with it, and found that a folder opened
  from the computer did not serve `.ktx2` files: it does now. The
  published advisory GHSA-w263-76q5-f8fx said the policy blocked WebRTC;
  it is corrected.
- The large-scene items (Q8 b, ARCHITECTURE.md open question 4):
  compiling materials without holding up the first frame was done in
  milestone 21 already; a page whose screen has controls starts with
  "Skip to the screen's controls" (V9 checks it on Harbour Loft's Light
  choice); a model's files are fetched six at a time (budget.test.ts).
- D8's right-click that was lost now and then ("copies selected text",
  four times in a month of automatic builds, on Linux and Windows): it
  came while the tab opened behind was being captured for its card
  (which shows the hidden page to Chromium for a moment). The check
  now waits for that capture to end (the test log's `captures`), and
  the diagnostic sends the same button. Five runs of five pass here;
  the automatic builds are the check of it over time.
- No installers: milestones 30 and 31 are dropped. A fresh clone
  installs, builds, and passes the type check; CONTRIBUTING.md, "Making
  your own build", lists what a fork's packaged build needs. The ocean
  tunnel's picture in the examples, which showed the turtle under a
  non-commercial licence, is taken again.
- Results: unit tests 532 pass; lint and the type check are clean. On
  Windows, m2, m14, m15, m17, m18, m19, m20, m21, m25,
  review-134-viewer, and review-134-main pass (D8 five times of five,
  V9 after its step was set to start Tab from the page's top). On
  Linux (`pnpm test:linux` with m2, m19, and review-134-main): 71 pass
  and 2 are skipped (the budgets for a graphics card). The Android app
  builds from main and its unit tests pass. Not checked yet when this
  was written: the full run, the tablet, and packaging a build. Since:
  the tablet passed (prompt 174), and the full run passed 403 of 403
  with milestone 26 (above); packaging a build is a fork's to check
  now that the installers are dropped.
- The first automatic build of pull request #60 failed R9 on Windows
  (part 2; prompt 173): with the Scene part's picking on, three clicks
  on the car were each lost (the page had taken 5.3 s to load there),
  and R9's keyboard check failed after it, picking being left on. Run
  again, the part passed (R9 in 1.5 s), as R9 does here drawn in
  software, and every other part passed. R9 had not failed in the forty
  builds before, so it is noted to be watched, like D8 was.

## The review's last items (2026-10-07, prompt 160)

What the review of 2026-09-30 left for the owner, decided in prompt 160.

- H6, the repository's weight: done. The older screenshot sets (m1 to
  m21, about 160 MB) are taken out of the tree; docs/progress.md shows
  them from the repository at commit 64de0da, so nothing is lost and
  no history is rewritten (a clone still fetches the old pictures in
  the history; what stops is the growth of the tree). Kept: m22, the
  newest desktop set, m24, the tablet's, and the README's four. From
  now on `pnpm screenshots` saves 3D scenes as JPEG (quality 90),
  screens of the browser's own interface as PNG. The working agreement
  in AGENTS.md says so, in the wording the owner approved (prompt 161).
- H7, old branches: checked one by one. Every local branch is merged
  into main but three, each holding one prompt-log commit: prompt 112
  (in main already), prompt 159 (taken into this branch), and prompt
  140, which was missing from main's log and is restored. On GitHub,
  only m23-vscode is left, merged. Deleting the branches and the stale
  working copy (.claude/worktrees/sweet-volhard-d6177a) is left to the
  owner: the agent's tools refused to delete them.
- St6: the README's alt text no longer names "HyperSol, LLC" (it
  describes the 2001 picture's copyright line), and the two messages
  from a HoloML page's preload are named `hypersol:holoml-shown` and
  `hypersol:holoml-state`, as the other channels are.
- St7: holoml's rule 11 takes this repository's rule on pushing
  (owner, prompt 161).
- The security advisories: the seven here and the two in holoml are
  published (2026-10-07); the seven here first said their fix was "on
  the branch review-134-fixes (pull request to follow)", corrected to
  pull request #45 (commit c4b9e82) before publishing.
- `@types/node` and Node: researched (Node 24, 25, and 26's breaking
  changes against both repositories: none of the removed APIs is used;
  Vitest skips Node 25). Owner, prompt 161: the builds, the Linux
  container, and .nvmrc on Node 24, the Node inside Electron 44;
  `@types/node` 24; a Node 26 build beside them (lint, types, unit
  tests) until 26 becomes the long-term version; in both repositories.
  `engines` stays at 22.13 until this computer has Node 24.
- REVIEW-2026-09-30.md deleted, as the owner asked (to the Recycle Bin).

## Clearing up before milestone 25 (2026-10-07, prompt 162)

- Node: Node 24.21.0 is installed on this computer through nvm (Herd's),
  but not active: `C:\Program Files\nodejs` is a folder of the
  standalone installer's Node 22.16, where nvm puts its link, so `nvm
  use` cannot switch. Until the owner removes that installation, the
  agent puts nvm's 24.21.0 first on the path for its runs. `engines`
  stays at 22.13 until then. (Prompt 164: the owner removed it and
  switched nvm to 24.21.0, which is now the Node on this computer;
  `engines` asks for 24 or newer in both repositories. Removing it also
  took `%APPDATA%\npm`, where pnpm is, off the user PATH; the owner puts
  it back.)
- Branches: gone in both repositories, here and on GitHub (the owner,
  prompt 162). The old working copy's folder
  (.claude/worktrees/sweet-volhard-d6177a, 505 MB, no longer a git
  working tree) was left on disk; its one commit, prompt 112, is in the
  log; removed.
- Electron 44.7.0 (rule 13; ARCHITECTURE.md section 3). On Node 24.21
  with it, on this computer: type check, lint, the 512 unit tests, and
  the full end-to-end run, 375 of 375 (17.5 minutes; X9, the ocean
  tunnel, at 144.5 frames a second; T5, Blockworld, 117).
- Dependabot: its group updates (#54 here, holoml's #33) moved
  `@types/node` back to 26, and holoml's moved `@types/vscode` past
  the extension's engines.vscode, so vsce refused to package it (both
  builds failed). Both repositories' dependabot.yml now leave
  `@types/node`'s major alone, and holoml's `@types/vscode`'s minor and
  major. #54 also failed C5 and C6 on Windows (a page that did not
  load in 15 s); the same checks passed on #55 and in the full run here.
- The ocean tunnel on the tablet with the sharper room (AN6), measured
  2026-10-07 the way the first figure was (the page's own frame
  callbacks, over the WebView's debugging connection by USB), the
  published site opened from the start panel, the lighter drawing on:
  at the entrance 58.2, 56.5, and 56.2 frames a second in three runs of
  10 seconds; walked in with the pad, the shark overhead, 55.8, 57.8,
  and 59.5. The median frame took 16.7 ms, the slowest 33.5 to 66.8 ms.
  The page was 479 by 962 CSS pixels on the tilted panel, its canvas
  269 by 541 (half the sharpness). So the sharper room costs the scene
  nothing that shows, and AN6 (30 or more) passes with room to spare.
  Why the first figure (33, 2026-10-05) was lower was not looked into.
- Done with the owner's go (prompt 163): the code-scanning alerts
  dismissed, 18 here as used in tests (all in test code) and holoml's 2
  (one a false positive: what `plain()` gives is escaped again before it
  reaches a page; one in a test); issue #44 closed (#55 merged; the
  setting that requires actions named by commit is on in both
  repositories); and a GitHub release for holoml's v0.2.2 tag,
  https://github.com/srajpal/holoml/releases/tag/v0.2.2 (pre-release, as
  0.2.0).
- Later (owner, prompt 163): the screenshots of the VS Code extension
  at work for holoml's README (milestone 23, task 9).
- The automatic builds after #55 (prompts 165 and 166):
  - CodeQL failed on main: GitHub's default setup added the Android
    app's Kotlin by itself and cannot build it. It is off, and
    .github/workflows/codeql.yml scans the workflows, the JavaScript and
    TypeScript, and the Kotlin (compiled with Gradle); its first run, on
    #57, passed for all three.
  - M10's "a second sign-in in a tab waits its turn" failed once on
    Windows (#57): the check sent both requests at once and took the
    first to be asked first, which the network does not promise. It now
    sends the second once the first is held; what it checks is
    unchanged. The file passed on this computer, and that check three
    times more.
  - Lost clicks on GitHub's Linux machines (issue #30), each gone on a
    second run: D8's "copies selected text" on #56 (four right-clicks
    that never reached the page, though the page view was where the
    check aimed) and U5's slider on #57. Recorded, not changed.

## The review of 2026-09-30 (prompts 134 and 135)

The owner asked for a thorough, senior-level review of both
repositories and of the automatic builds (prompt 134), and then for its
recommendations to be taken and every finding fixed (prompt 135).

### What was reviewed, and how

- Ten reviewers in parallel, each reading every file of one area: the
  main process and preloads, the shell, the HoloML viewer, holoml's
  packages, holoml's examples and site and tools, the tests, the
  repositories' own written rules (Standards), the browser against its
  documents and the viewer against HoloML's specification (Spec), and
  the repositories' health. The lead read the code behind the findings
  ranked highest and ran what could be run (the unit tests, lint, and
  types in both repositories, `pnpm audit`, a probe of the built app, a
  timing probe of the checker, the turtle's own licence stamp, the logs
  of eight automatic builds, and two trial runs of milestone 21's file
  in the Linux container).
- Findings are ranked P1 (before anything is released), P2 (soon), P3
  (when the file is next touched), and marked as run, read, or likely.
  The findings' names used below (M for the main process, R for the
  shell, V for the viewer, L for the language, E for the examples, T
  for the tests, D and Sp for documents against code, St and Sm for
  standards and design, H for the repositories) are the review's.
- The review's file, REVIEW-2026-09-30.md, is kept out of the
  repository: it named weaknesses before they were fixed, and the
  repository is public. Where it is kept is the owner's decision.
- Not run by the review: the full end-to-end run, anything on macOS,
  the published site, a screen reader. Not reviewed: the geometry code
  in the examples' tools, and packaging (there is none yet).

### What was fixed, by area

Each line names the check that covers it. "Unit" is a `*.test.ts`
beside the code; the end-to-end files are tests/e2e/review-134-main,
-shell, -viewer, -harness, and -features (AGENTS.md, Testing).

The main process and preloads:

- M1. Every permission but the camera, microphone, and location is
  refused to a page that asks and to a page that only looks; copying
  text after a real click needs none; full screen and pointer lock stay
  refused until the browser has its own notice (milestone 27; the first
  wave had granted both, and the second refuses them again, to a page
  that asks and to one that looks). review-134-main "M1" (its full
  screen check waits for the refusal itself); unit main/permissions.
- M2. A site that asks for a client certificate gets none. Unit
  main/security (no end-to-end check: it would need a certificate in
  the system's store).
- M3. The shield is asked about WebSockets, requests that no tab made,
  and a tab's favicon. review-134-main "M3" (a WebSocket to a listed
  host; a service worker's request to a listed host blocked, and
  counted for the tab it serves; a listed favicon not fetched and
  counted, an own-site one fetched); unit main/privacy. The check found
  that a service worker's blocked request was counted for no tab, as
  it reaches the browser with no tab and only a referrer; it is now
  counted for every tab on the referrer's site (2026-09-30).
- M4. "Leave this page?" for a page that asks to be kept.
  review-134-main "M4"; unit main/leave-page.
- M5 and H4. A list update downloads the lists' text only; the page
  scripts come with the app and are checked by SHA-256; the GPL's text
  is beside the starter copy. Unit main/privacy; F9 (milestone 4).
  `pnpm filters:update` was run after its change (2026-09-30): the 13
  lists downloaded, the starter copy built to the same bytes as on
  2026-09-26 (the lists had not changed), the scripts' checksum
  recorded.
- M6. A HoloML file opened from a shared folder reads the files beside
  it only; a local page leaves for the web only after a real click or
  key press, without query and fragment; no peer connections.
  review-134-main "M6"; unit main/holoml, main/security.
- M7. Block reloads the pages that were given the camera or microphone,
  and that reload is not held up by "Leave this page?". review-134-main
  "M7"; unit main/permissions.
- M8. A link that leads to a download leaves the shield's site and
  count as they are. review-134-main "M8"; unit main/privacy.
- M9 and M10. A start that fails ends with a message; a crashed shell
  is reloaded once; page dialogs can be stopped; a HoloML file at the
  top of a drive opens; a tab that closes while its history is put
  back. review-134-main "M9" and "M10"; unit main/start-up, main/holoml,
  main/tab-history.
- M10, HTTP sign-in. A site or a proxy that asks for a user name and
  password gets a prompt in the tab's shell; what is typed goes to
  Chromium only, and is never saved or offered to the password manager;
  the prompt names the asker from the request's address and quotes the
  realm; one prompt a tab, a second waits its turn; leaving the page,
  closing the tab, or a crash cancels; only a page in a tab can ask, and
  a part of a page from another site cannot. review-134-features (four
  checks: the dialog and a right answer, Cancel and Escape and a wrong
  password, the prompt belonging to its tab, waiting one's turn, a long
  realm, a picture from another site); unit shared/sign-in,
  main/sign-in.
- D7. The window's size, place, and maximised state are remembered in
  settings.json and used again while the place is still on a display;
  else 1280 by 800, centred. Test windows stay 1280 by 800 unless
  `--test-remember-window`. review-134-features (two checks: a restart
  opens the window as left; a damaged saved size is set aside); unit
  main/window-bounds, shared/settings.
- St4. Ctrl+Shift+V (the text view of a HoloML page) is in the
  shortcuts table (`only: 'holoml'`), changeable in Settings >
  Shortcuts, and acts only with a HoloML page in front; M7 (milestone
  11) counts 25 shortcuts now. review-134-features (one check); unit
  shared/shortcuts.
- R6 (the main process's part). `site.set` names its origin, and is
  refused once the tab has left it. Unit shared/permissions,
  main/permissions.
- Sm7. One `siteKey` and one `hostOf` (shared/site.ts), read the same
  way by the main process and the shell. Unit shared/site.
- D13, E2, and issue #11's check measure inside the app: the layers
  preload says when its scan has settled (test runs only), the favicon
  fetch says how it ended, and the Library records when each search
  starts (m5, m2, m3).
- M11, in part. A dropped file's message is held to what the main
  process can know (unit main/security; review-134-main "M11"). See
  "not done", 6.
- V1. An answer sent as a download, or sandboxed, is not a HoloML page;
  a HoloML page keeps the site's own policy. review-134-main "V1"; unit
  main/holoml.
- D6. Deleted history and sign-ins are overwritten in the file. Unit
  main/storage/scrub.
- D11. Test mode only in a build that is not packaged, and a page's
  preload learns of a test run only from the argument the main process
  gives its process in test mode (shared/test-run.ts), never from the
  environment. Unit main/launch-options, main/security;
  review-134-viewer "D12" (the hooks there only because it is a test
  run).
- Sm4. "Only the shell may ask" in one helper, tab snapshots through
  it too; only the two one-way messages (close-ready, capture-keys)
  check their sender themselves. Unit main/ipc.
- "Open" on a downloaded program shows it in its folder. Unit
  main/downloads.

The shell:

- R1 to R7, each a group in review-134-shell: switching panels, error
  cards that go, the prompt and the notice that take no click for half
  a second, a filled HoloML page drawn flat, the address bar, the eight
  smaller faults, the room's drawing and its cards' click targets
  while the context is lost, and access. Unit renderer/url
  (how an address is shown, the site button's marker).
- St3. The sun's colours are theme tokens, and what the page preload
  draws takes the theme's colours. Unit H8 (now over the room's code
  too), packages/themes tokens, preload/theme-colours.
- Sm5. The list of setting names comes from the defaults. Unit
  shared/settings.
- Dead code and stale comments removed (the review's section 3).

The HoloML viewer:

- V2. A version the viewer does not know, or none, is refused.
  review-134-viewer "V2"; unit viewer/versions.
- V3 and V4. What a load holds is given back whole; triangles counted
  once decoded. review-134-viewer "V3", "V4"; unit viewer/budget.
- V5. Bounded work for any page (a model file's node graph, walls and
  walking, a panel's long word, numbers). Unit viewer/budget, physics,
  panels, values.
- V6. Limits on decoded pictures, decoded sound, and lights.
  review-134-viewer "V6"; unit viewer/budget, sound.
- V7 to V10 and D12, each named in review-134-viewer: a still walker
  with gravity, the text view's keys, a removed sound, the private line
  between the browser and the viewer, a script beside a problem, a
  graphics reset, hidden things, and the test hooks only in a test run.
  D12 is finished in the second wave: the Scene inspector's choosing
  and picking go to the page as `select:<index>`, `pick-on`, and
  `pick-off` on the HoloML command channel (main/inspect/index.ts), and
  `window.__holoml` in a normal run holds only `scene`. Unit
  viewer/main.
- Drawing in software at half resolution, without smoothed edges
  (prompt 135, the review's recommendation A). review-134-viewer's
  drawing check.
- Sp1 to Sp9, the viewer and the specification's third edition (the
  second wave, from holoml's decisions): a member a kind lacks set
  without error, `parent` through a link, frozen vectors, a sound's
  place not null; the frame event's dt; `holoml.add` leaving out an
  animate and a click sound with a console line; every paragraph of a
  panel inside a link in the text view; only the ambient lights in the
  scene dimming the surroundings; a model that needs an unsupported
  glTF extension left out; unlit materials changed by material, option,
  and script; the syntax-error card's code; a 0.1 page's hud not shown;
  values by the checker's own patterns (imported from
  `@hypersol/holoml`) and four-character whitespace. review-134-viewer
  (nine checks in its second group, "the viewer and the specification's
  third edition"); unit viewer/api, budget, values.

The tests and the automatic builds:

- The end-to-end checks run in four parts on each system, with an "All
  checks" job; a change to documents only skips them; the actions are
  named by commit (section 2 of the review).
- Repaired without changing what they assert: #10's slow download (it
  holds until released, and the wait is 180 s), I2 (waits for the
  bytes, not only the count), E6b (the 2 s wait is timed inside the
  app), V5 (a dark picture that began before the fade-in counts).
- The harness: no app left behind by a failed launch; a wait stops when
  the app has gone; navigateTo no longer waits on Chromium to
  acknowledge Enter; roomStill and caughtUp; hooks have the time their
  own waits need. review-134-harness checks the tools themselves.
- G9 is two checks now: the idle check, which runs everywhere, and the
  frame-time budget, which reports "skipped" in software. Milestone 5
  so has ten checks.
- The second wave: the viewer's checks hold a key for a given amount
  of the scene's own time (the viewer's `clock` hook, m14, m17, m18,
  m19), not of the test's clock, which a frame drawn slowly in software
  runs ahead of; and the budgets that need a graphics card, R3, S2, S6,
  T2, T5, U9, U13, V8, W6, X2, X5, and X9, are measured and logged when
  drawn in software, and the check reports "skipped", not "passed"
  (each is split so that what does not need a graphics card still
  runs). m21 names the hawksbill turtle. review-134-viewer has 22
  checks, review-134-features 7.
- The unit run allows 20 seconds a test.

HoloML (the holoml repository, branch `review-134-fixes`; its own
CHANGELOG.md, under 0.2.2, has the full list and its tests): the
checker's slow numbers (L1); an address with a control character is a
problem (L2); where a syntax error and a problem are reported is
written into the specification, and its value grammars and the checker
agree (L3, L5, L8); a 0.1 page is no longer held to 0.2's rules (L6);
`serialize()` writes a tree that reads back the same (L7); the RELAX NG
schema's patterns are written from the checker's own (L9); 44 new
conformance samples, and a test that every code has one (L4). Its
examples, site, and tools: the aquarium's turtle replaced, and a guard
that stops the tools when a file's licence stamp and its credit
disagree (E1); the site's builder refuses to empty a folder it did not
make (E2); the site is published only after lint, types, and the tests
pass (E3); the examples' scripts and tools (E4, E5). The specification
is 0.2's third edition, and the packages are at 0.2.2; nothing is
tagged since v0.2.0. Its pull request #21
(https://github.com/srajpal/holoml/pull/21) is open. The browser's copy
is made from that branch at 9e59907 (packages/holoml/SOURCE.json), and
is to be made from holoml's main once #21 is merged.

The repositories: Electron 44.5.1 (H2, and the rule 13 record in
ARCHITECTURE.md section 3); Dependabot, a rule for line ends, editor
settings, `.nvmrc`, a code of conduct, and issue and pull request
templates (H3, H8, H9); the rule on main requires "All checks" (H1);
`.claude/` ignored by git and by lint (H7); lint knows the types (H8:
a promise nobody awaits or catches, a promise where none is expected,
and an await on what is not one are errors; `pnpm lint` takes about
half a minute for it); the copy of HoloML's package file takes its
version from the copied packages (H5: `pnpm holoml:sync` writes it,
0.2.2 now, from holoml's `review-134-fixes` at 9e59907), and the
viewer imports the checker's value patterns from `@hypersol/holoml`.

The documents (St1, D1 to D13): ARCHITECTURE.md, docs/privacy.md,
README.md, CHANGELOG.md, THIRD-PARTY.md, AGENTS.md's Testing section,
HANDOFF.md, and this file, each sentence about the browser checked
against the code.

### Deliberately not done, and why

1. Thinning the screenshots (H6: 715 pictures, 187 MB, growing with
   each milestone). Keeping only the newest set changes a working
   agreement in AGENTS.md ("save screenshots of the main screens at the
   end of each milestone"): it needs the owner's wording first.
2. holoml's rule about pushing (St7: its AGENTS.md says "Do not push
   unless asked", this repository's rule 11 says push before and after
   a milestone). A rule is changed only with the owner's wording.
3. The README's alt text that reads "HyperSol, LLC" (St6). It
   describes what the 2001 picture itself says; whether the naming rule
   covers it is the owner's decision.
4. The three merged branches still on GitHub (fix/issues-17-to-22,
   m19-harbour-loft, m21-aquarium) and the old working copy under
   `.claude/worktrees` with its unpushed commit (H7). Deleting work
   needs the owner (rule 4).
5. Requiring actions to be named by commit in each repository's
   settings (H3). To be switched on only after both pull requests are
   merged: until then main's workflows name actions by tag, and the
   setting would stop them.
6. A dragged-in `.holoml` file (M11): the main process cannot confirm
   that a real drop happened, as the message comes from the page's
   preload. It checks everything it can know. Routing the drop through
   the shell would close it, and is not built.
7. Checks still measured by the test's own clock, or that sleep and
   then look (the test engineer's list): the fade's darkest moment
   (fadeMax, milestones 19 and 20); L9's 50 ms budget under load; and
   sleep-then-look in C5 and C8 (milestone 1), F10 (milestone 4), five
   places in milestone 8, and one each in milestones 3, 9, and 10 and
   in issue #18's check. Each needs a signal from the app that does not
   exist yet. (Issue #11's check, D13, and E2 came off this list in the
   second wave: the layers preload says when its scan has settled, the
   favicon fetch how it ended, and the Library when each search starts.)
8. `@types/node` is for Node 26 while the builds run Node 22 (H8). It
   changes many files at once and is left for a change of its own. (The
   lint rules know the types since the third wave: a promise left
   unawaited is an error; see "The repositories" above.)

Also open, for the owner to place (the roadmap above has them): the
items added to milestones 23, 24, 27, 28, and 29, and a budget run with
a graphics card in the automatic builds.

### Results

The final runs, after every branch was merged (2026-09-30):

- Unit tests: 502 passed (58 files).
- End-to-end checks, this computer (a graphics card): 372 checks in 27
  files, all passed, 19 min 18 s.
- End-to-end checks, the Linux container (`pnpm test:linux`, no
  graphics card): 372 checks, 35 min 54 s: 355 passed, 14 skipped (the
  budgets that software drawing cannot meet, reported as skipped), 3
  failed, each only there: L3 (milestone 10, the card's speaker; the
  click opened a new tab), and two of the review's shell checks (the
  error card of a failed tab asserted the instant the state changed;
  losing the graphics context on request). The three were repaired the
  same day, and one was a fault in the browser: GitHub's Linux machines
  lose the room's graphics context once soon after the start and
  restore it a second or two later, and while it was lost the cards'
  click targets stayed where the last drawn frame had put them, so the
  click meant for a card's speaker opened a new tab (the "+" card had
  been there). Hit testing now brings the layout up to date itself; a
  new check holds it, and fails without the fix on Windows too. After
  the repairs: m10 and review-134-shell in the container, 40 of 40;
  the same on Windows, 40 of 40.
- The automatic builds in four parts (pull request #39's run after
  fce1e63, before the fixes): all ten checks passed in 15 min 34 s,
  where the two-part builds took about 33.
- The automatic builds with the fixes, on both pull requests: holoml's
  #21 passed on Windows and Linux. The browser's #45, first run
  (c9c513c): Linux's four parts passed (8, 14, 9, and 8 minutes);
  Windows' three failed on what its machines are (a 1024 by 768
  display, so the window opens smaller than 1280 by 800 and cannot
  shrink below its 900 by 600; drawing in software, at half resolution
  since prompt 135): the two D7 checks compared with 1280 by 800, R6
  shrank the window below its smallest, V8's text view was too short
  to scroll three times there, V2's text rows were read from pixels
  at half resolution, and one close of the app took over five minutes
  and failed m7's file without a word. Repaired the same day: the
  checks compare with the size a fresh window gets on the machine and
  keep within its smallest; the text fixture has 240 lines; V2's
  pixels are their own check, skipped in software as the other pixel
  checks are; the harness ends an app that does not close within half
  a minute and says so. Second run: one failure, V8's space bar on
  Windows (a button had the keyboard); third run: V8 again (the space
  bar scrolls on the character it gives, which the check now sends,
  and each smooth scroll is waited for) and E2 (a search begun before
  the typing counted as its own). Fourth run: every check passed on
  both systems; #45 merged 2026-10-01 (after #39 and holoml's #21,
  2026-09-30). The copy of HoloML was from holoml's main (2cce09c);
  since 2026-10-01 it is from the tag v0.2.2 (dc2ad98, the same files:
  holoml had changed only its workflows since), and the copy's test
  passed (5 checks).
- Lint (with the rules that need the types, about half a minute) and
  the type check: clean.
- `pnpm test` in holoml: 505 passed, one file at a time (about 12 s).

## Bug issues after the review (2026-10-01)

Three issues the owner opened after the review, fixed easiest first:

- #51, the copy of HoloML's test: it read the holoml repository at
  SOURCE.json's name (`main`), so a copy made from a branch failed as
  soon as that branch moved on. It reads the recorded commit now, and a
  recorded tag must still name it. Checked with the copy made from
  main at 2cce09c (failed before, passes now), the copy from v0.2.2,
  and a tag that names another commit (fails).
- holoml #30, the ocean tunnel's fish: a push out of a rock could take
  a fish down through the sand, as a rock's ball reaches below it; 4 of
  300 seeded minutes broke a limit. Fixed in holoml (keepClear in
  ocean.js) with a fixed path that broke before and a grid of points;
  the copy here is from that branch, and X2 to X9 passed, 11 of 11.
- #50, E2 on GitHub's Windows machines: saved data that changed while
  someone typed in the history search (the visit just made, or its
  title) refreshed the Library at once, and so started a search of the
  half-typed words 16 ms after a key. While the search box waits for its
  pause, the Library leaves the refresh to the pause's search now. A new
  check changes the page's title in the middle of typing: before the
  fix it failed here (a search 89 ms after a key), and with it, m3's 22
  checks passed three times in a row.
- Holoml's #31 merged; the copy here is from holoml's main (267e66e,
  the same files).
- Pull request #52's first automatic build: part 1 failed on both
  systems, the rest passed. Windows: E2's count of searches read the
  main process's count and the shell's notes while a search was on its
  way (the refresh after the visit was saved, landing just before the
  typing), so one search was counted in one and not the other; both are
  now read while the Library is idle, at the start and at the end, and
  every search noted since is counted (the new check failed after it, as
  the box still held the first one's words). D13: a favicon of the page
  before (link-a's) landed on the next page: the shell drops a tab's
  favicon as soon as an address is typed, before the main process hears
  of the navigation and cancels the fetch, and one that ended in between
  was shown. A favicon now names the page it is for, and the shell takes
  it only for the page the tab shows. Linux: D8's right-click never
  brought a menu, three times at the same point; its cause is not known.
  The point is now aimed once the room is still (the tab opened behind
  brings the rail), and if every click is lost the failure says what the
  shell has there. m2, m3, and review-134-main: 83 of 83 here, and 83
  of 83 drawn in software.

## The roadmap: installers last (2026-09-29, prompt 129)

The owner moved the installers to the end of the roadmap, as the
browser is not ready for builds: free camera is now 25, lift to 3D 26,
and polish 27, and the Windows and Linux release (1.0) is 28 and the
macOS release 29. README, AGENTS.md, HANDOFF, and ARCHITECTURE follow.
The owner also asked whether the browser and HoloML should be marked
experimental. The findings (by MDN's definition, a technology with one
implementation, or a specification that may still change incompatibly,
is experimental; the IETF publishes such specifications "for
examination, experimental implementation, and evaluation"; SemVer's
0.x means that anything may change) went to the owner, who chose both
(prompt 131):

- HoloML: its specification's status, README, and site say it is
  experimental (one renderer so far; until 1.0 a later version may
  change or remove what an earlier one has), and that 0.1 and 0.2 are
  fixed rather than final (holoml d1d1e9c, in pull request #20); the
  v0.2.0 release is now a pre-release, and v0.2.1 will be one.
- The browser: its README and About dialog call it an experimental
  developer preview, not yet for everyday browsing (D11 checks the
  About dialog's line); its releases stay pre-releases until 1.0.

## Branch protection (2026-09-29, prompt 130)

At the owner's request (GitHub noted that neither main branch was
protected), each repository has two rulesets on its default branch,
made with GitHub's API on 2026-09-29:

- "Protect main": no deletion and no force pushes, for everyone, the
  owner included (rule 11: never rewrite published history).
- "Checks before merging into main": a pull request is merged only once
  its CI checks pass: the browser's four (Windows and Ubuntu, parts 1
  and 2) and holoml's two (Windows and Ubuntu). The repository's admins
  may bypass it: the owner can still merge past a check that fails for
  a reason outside the change, and the agreed direct pushes to main (a
  milestone's acceptance, a plan for approval) still go through.

To change them: each repository's Settings, Rules, Rulesets.

Changed 2026-09-30 (prompt 135): the browser's second ruleset now
requires one check, "All checks", in place of the parts by name ("The
review of 2026-09-30", above).

## The README: a broken link, and four pictures (2026-09-28, prompt 99)

The owner merged browser pull request #34 and holoml #15, found that the
README's link to https://srajpal.github.io/holoml/ did not work (GitHub
Pages has no page there, only one per example), and asked for four
pictures at the top of the README to show the variety of what the
browser does.

- The link now goes to the holoml repository,
  https://github.com/srajpal/holoml, with each example's published
  address beside it.
- Every link in both READMEs was checked on 2026-09-28: the web
  addresses answer 200 (the Pages root 404 before the fix), and every
  file and heading they name exists. The three examples' published
  sites answer 200, and so do the sofa studio's pages, models, pictures,
  and panorama; its tools are not published, as intended.
- Four pictures, in a two-by-two table with a line under each, all made
  by `pnpm screenshots:readme` in one window with four tabs, from local
  copies (no network): the sofa studio (readme.png, the newest), Blockworld
  (readme-game.png), a made-up sample page in the Daylight theme and the
  layers view (readme-layers.png), and the same page with the instrument
  panel (readme-instruments.png). The sample page and its pictures,
  "Field Notes", are made for this in tests/fixtures/readme/ (the
  fixture server now serves .svg).
- AGENTS.md's working agreement said the README opens with one
  picture, of the showroom; the owner approved its new wording (prompt
  100), now in AGENTS.md.
- The sofa studio's "About this studio" label sat in the upper left,
  half behind the Light choice in the README's first picture; it is
  now under "Add to cart", above the sofa, and both links grow lighter
  in the evening, where dark blue and grey were hard to read (holoml
  branch sofa-studio-about-label, merged as holoml #16; the browser's
  copy synced from holoml's main at the merge, 660b082, and the
  README's, the examples section's, and milestone 18's pictures taken
  again). U13 to U15 and T8 pass again.

## Proposal: four more HoloML example sites (2026-09-27, prompt 84)

Status: Answered (prompt 85): Q1 to Q5 a, as recommended; a fifth site
added, an aquarium (milestone 21); and a section in the browser to try
the examples, with screenshots (milestone 17). The roadmap table is
updated. Owner: before milestone 17, four more example sites: a small
game (like a very small Minecraft) with movement, action, lighting,
sound, and animation; then three commercial sites, all different, each
more complex than the last, with better graphics and movement.

### What HoloML 0.1 can and cannot do

0.1 has models, groups, lights, labels, links, material changes, simple
animation of position, rotation, and scale, and orbit or walk. It has no
sound, no way to react to a click other than following a link, no state
(nothing on a page can change because of what the viewer did), and walk
mode passes through everything. None of the four sites is possible
without adding to the language; the gaps the showroom found (holoml
issues #8 shadows, #9 changing a material in place, #10 walls that stop
the walker, #11 text of more than one line) are needed too. So this
work is also HoloML 0.2.

### The four sites (proposed)

1. **Blockworld** (the game). A small island of blocks, about 24 by 24
   and 8 high: grass, dirt, stone, sand, wood, leaves, water, with
   trees. First person: walk with gravity and a jump, blocked by
   blocks. Click to break a block (a crack animation and a sound);
   right-click to place the chosen block (keys 1 to 5 choose). A day
   and night cycle of a few minutes moves the sun and changes the
   light; torches can be placed at night (point lights). Sounds:
   footsteps, breaking, placing, birds by day, crickets at night. A
   small goal: find five gems in the stone and bring them to a chest,
   and the page says you won. Needs: sound, scripts (to add and remove
   blocks and keep score), collision and gravity, animated lights, and
   a renderer that draws thousands of identical blocks cheaply.
2. **Sofa studio** (small, commercial: a furniture shop). One sofa in a
   styled room to orbit around. Choose the fabric and the leg finish in
   place (no new page), open the sofa bed (an animation with a sound),
   see the price change with the choice, and a link to "add to cart"
   on an ordinary web page. Better graphics: textured fabrics, soft
   shadows, and a lit room. Needs: changing a material in place (#9),
   shadows (#8), sound, and text that changes (a script or a
   declarative choice).
3. **Harbour Loft** (medium: an apartment to tour for an estate
   agent). Walk through a furnished two-bedroom flat; walls and
   furniture stop you (#10). Doors open when clicked, with a sound;
   light switches turn lamps on and off; a daylight and evening
   switch; information panels with paragraphs (#11) in each room; a
   small floor plan showing where you are; a link to book a viewing.
   Needs: collision, click actions, light changes, multi-line text,
   and larger scenes.
4. **Coral Bay** (largest: a resort; replaced on 2026-09-28 by a
   sneaker store, prompts 101 and 102). An island resort outdoors and
   in: terrain, water with moving waves, palms swaying, boats sailing
   on paths, a golf cart you ride along a path between the beach, the
   pool, and the hotel lobby, rooms to tour, sunset lighting, and
   sounds that change with where you are (waves, pool, lobby music).
   Needs: movement along paths, positional sound, a sky and
   environment lighting, and the renderer's limits and loading kept in
   hand for a big scene (loading by area, simpler models far away).

All four live in the holoml repository next to the showroom, are
published with GitHub Pages, and are listed under the start panel's
"Try HoloML", as the showroom is. Each gets its own end-to-end checks
in the browser, like milestone 16.

### Questions

- Q1, how pages react. a: HoloML 0.2 adds scripts: JavaScript from the
  page's own site, run in the page's own sandboxed process (as any web
  page's script is), with a small documented scene API (find and change
  elements, add and remove them, events such as click, key, and enter
  an area, sound, a timer), plus a few declarative basics for common
  cases without a script (sound, click to play an animation or toggle a
  light, a material choice). Recommended: the game needs real logic,
  and HoloML stays readable for the simple cases. b: declarative only,
  no scripts: the commercial sites work, but the game shrinks to a fixed
  world where blocks can only be hidden and shown. c: scripts only.
- Q2, the three commercial sites. a: the sofa studio, the apartment
  tour, and the resort, as above (recommended: three different trades,
  and each adds movement and graphics the one before did not have).
  b: a museum gallery, a concert venue with a seat preview, and a theme
  park. c: name your own.
- Q3, where the models, textures, and sounds come from. a: CC0 packs
  only, credited anyway: Kenney (blocks, furniture, sounds), Quaternius
  (nature, buildings, people), and Poly Haven (skies, textured
  materials, some models) (recommended: free of conditions, and good
  enough for "better graphics"). b: also CC BY models (for example
  from Sketchfab) for more realism, each credited as its licence asks.
  c: our own, made by scripts (plain look).
  (Either a or b means downloading those files; your answer approves
  it for these sites.)
- Q4, how to split the work. a: one milestone per site, in the order
  of the owner's list, each adding the HoloML 0.2 features that site
  needs (spec, parser, checker, conformance, browser support, the site,
  checks): 17 Blockworld (sound, scripts, collision and gravity,
  animated lights, drawing many blocks), 18 Sofa studio (material
  choice, shadows, changing text), 19 Harbour Loft (click actions,
  multi-line text, larger scenes), 20 Coral Bay (paths, positional
  sound, sky, loading by area). Privacy and data tools move to 21,
  installers to 22 and 23. Recommended: each milestone ends with
  something to try. b: first one milestone for all of HoloML 0.2 in
  the language and the browser, then one for the four sites. c: the
  commercial sites first (17 to 19) and the game last (20), so scripts
  come after the simpler declarative features.
- Q5, sound. a: a page's sounds start only after the viewer's first
  click or key on it (as browsers require for web pages), the tab's
  mute and the shield apply, and sound files count against the page's
  limits like models (recommended). b: sounds may start at once.

### What happens next

On the answers, the first of the new milestones (per Q4) gets a full
plan with its tasks and checks for approval, with the Rule 13 check at
its start. The roadmap table is changed at that point, not before.

## The HoloML checks on GitHub's Linux machines (2026-09-27, prompt 93)

The automatic builds on main had failed since milestone 16's build. On
Windows, a unit test: the copied example sites got Windows line endings
on checkout, so their hashes no longer matched (fixed in the owner's
other session, browser pull request #33, with a .gitattributes rule).
On Linux, most of milestone 17's checks and milestone 16's
development-run check failed, and R3 (milestone 15) and K1 (milestone 9)
now and then. The agent had run milestone 17's checks only on a machine
with a graphics card, and had not looked at the automatic builds. The
owner asked for the Linux failures to be fixed, in a pull request
(prompt 93).

What was wrong, and what changed (the requirements are unchanged):

- GitHub's machines have no graphics card, so Chromium draws in software
  (SwiftShader), and a scene as big as Blockworld draws a frame far more
  slowly. The checks waited fixed times (a key held 0.6 s, a walker to
  land within 5 s, 0.3 s before comparing pictures), and got a frame or
  two in that time. They now wait for what they check: a key is held
  until the view has turned or the walker has moved (holdKeyUntil),
  waits for the walker to land are six times as long when drawing in
  software (sceneWait), and pictures are compared after new frames have
  been drawn (framesDrawn). Breaking and placing now aim at whatever
  block is under the crosshair once the walker stands still, and check
  that block and the face it points at.
- Clicks sent right after a page changes are sometimes lost there
  (issue #30): the checks that click Blockworld and the slider now click
  again when a click has no effect (clickUntil), as the other checks do.
- The two development-run checks start Electron themselves and missed
  the switch the harness gives on Linux (--enable-unsafe-swiftshader),
  so there was no WebGL 2 and the viewer showed its notice instead of
  the scene. The switches now come from one place (graphicsSwitches).
- The card check's car arrived after a fixed two seconds, which a slow
  machine can take before the first picture; the fixture server now
  holds the car until the check lets it through (a gate).
- T8 read a picture's size before it had loaded; it now waits for it.
- R3 and T2 (the browser answering within 200 ms) failed there with one
  answer of 1.2 to 1.5 s. The cause is not known yet; both now report
  the shell's long tasks and the main process's pauses when they fail,
  and T2 measures once the shell's own switch animation has finished.
- HYPERSOL_TEST_SOFTWARE=1 draws in software on any machine, as GitHub's
  machines do: with it, milestones 15 to 18 failed here as on GitHub
  (T6, T7, T8, S3), and pass after these changes (50 of 50).

Load budgets (owner, prompt 95): on the pull request's Linux run the
showroom took 9.3 s and Blockworld 5.7 s to load, against the 5-second
budgets of S2 and T5 (with a graphics card both load well under that).
The owner chose to treat them like the frame-rate budgets (prompt 59):
drawn in software, the load time is measured and logged, not checked;
with a graphics card, 5 s still applies.

Responsiveness budgets (owner, prompt 96): R3 and T2, the browser
answering within 200 ms while a heavy HoloML page loads, failed on both
machines with one stall of the shell (4.3 s on Linux, 0.5 to 0.8 s on
Windows). The stall report showed the shell's time in native code, not
in its scripts: drawing in software, the browser's page and the scene
share one software GPU process, which the scene's first draw (shaders,
environment lighting) keeps busy for seconds; with a graphics card the
shell answered within 12 ms. The owner chose to treat these budgets
like the others: drawn in software, the answer times and the stall
report are logged, not checked; with a graphics card, 200 ms still
applies.

Results: see the pull request's automatic builds.

## Linux on this computer, and three checks that retry (2026-09-28, prompts 103 and 104)

The owner asked whether to build a Linux VM to test everything instead
of relying on the automatic builds (prompt 103). Recommended and
approved (prompt 104): keep the automatic builds as the check pull
requests are merged on, and add a Linux run on this computer that
copies GitHub's Linux machines, with Docker (already installed here;
Windows 11 Home has no Hyper-V manager for a full VM, and a runner of
GitHub's builds on this computer would let anyone's pull request run
code on it).

- `pnpm test:linux` (tests/linux/): an Ubuntu 24.04 image with Node 22,
  pnpm, a virtual display, a throwaway keyring, openssl, and Electron's
  libraries; a fresh copy of the repository sent in for every run (the
  committed files with changes to tracked files); the CI job's steps,
  in a container of GitHub's size (4 processors, 16 GB), with no
  graphics card, so Chromium draws in software. pnpm's store and
  Electron's download stay in Docker volumes between runs. With
  arguments it runs chosen end-to-end files only.
- C4, C6, and D13, which failed once each on PR #35's Linux runs, retry
  as issue #30's checks do: C4's clicks into the fields use clickUntil,
  C6's hover a new moveUntil (a pointer move can be lost as a click
  can), and D13 loads its page again when the server counts two refused
  downloads open at once (the app cancels each before asking for the
  next; on a slow machine the server can take in the next request a
  moment before it sees the last close). Each retry is logged; what
  they assert is unchanged.

Results, 2026-09-28. The first `pnpm test:linux` built the image and ran
the whole end-to-end suite on Linux (the arguments meant to choose two
checks did not reach vitest; fixed, and checked since: `pnpm test:linux
tests/e2e/m1.e2e.ts -t "C4|C6"` ran only those 5 checks, in 20 seconds
with the image and caches in place). Every file passed: 251 checks, and
1 skipped (C9's frame rate, skipped where drawing is in software, as
on GitHub's machines), in 20 minutes, with the three retries in place
and none of them needed. Drawn in software, the budgets were logged, not
checked: the sofa studio ready in 12.6 s (U13), Blockworld in 4.4 s
(T5), the showroom in 6.3 s (S2), 14.3 frames a second during parallax
(C9). The same day, PR #35's automatic build passed on Windows and
Linux (run 36446383753). C4, C6, and D13 also pass on Windows.

## L9's measure of the main process (2026-09-27, prompts 106 and 107)

L9 read the main process's event-loop delay with monitorEventLoopDelay
and sat at 18 to 20 ms on Windows (once 20.005 ms, a failure). The cause
was the measure, not history work: an idle Windows process wakes only
every 15.6 ms (the system timer tick), so the monitor read 16.3 ms with
no requests at all, and once 24.3 ms. Kept awake with a chain of
setImmediate calls, the main thread showed no gap over 1.5 ms during
the searches, so searches in the worker, the 500 results passed back,
and the reply to the shell each take well under that. The history code
is unchanged. L9 now keeps the loop awake the same way while the
searches run and fails if any gap between two turns reaches 20 ms
(owner, prompt 107: option 1); the limit is unchanged. Local run
(Windows 11): L9 in seven runs, longest gap 0.6 to 1.5 ms (three runs
of the old measure on the same code read 16.1 to 18.2 ms); searches
after the first 1 to 32 ms, as before; all nine m10 checks passed. A
25 ms busy wait put into the main process during the searches read
26.5 ms and failed L9, so the probe catches a real hold.

CI on the pull request (#33): the probe keeps a processor busy, and on
GitHub's Windows runner one search then took 59 ms (limit 50). L9 now
runs the searches twice: first for the answer times with nothing else
running (as before), then again with the probe for the longest hold.
Both limits are unchanged. Local runs: holds 0.7 to 2.1 ms; one run's
answer times went to 65 ms while another session's tests were using
the machine, with the probe off, so that pass is as sensitive to a
busy machine as it was before. R3 (m15) failed on both runners in the
same CI run, as it does on main (run 36330814489); it is not part of
this change.

## GitHub issue #30: lost clicks on Linux CI (2026-09-27, prompt 74)

On GitHub's Linux runner a click sent right after a page appears or
changes sometimes never reaches the page (D8's right-click on main run
36294462404 and PR #29's first run; P4's label link on main run
36295974386; earlier C2 after a resize). A new harness helper,
clickUntil, clicks until the click's effect shows (up to three
attempts, each retry logged as "[harness] ... clicking again"); D8's
right-click and the link clicks in P4 and P9 use it. What each check
asserts is unchanged: the menu's entries, the page reached. C2, which
checks that clicks land, is left as it is. Local run: P4, P9, and D8
pass (9 of 9) with no retry.

## GitHub issues #17 to #22, #4, #5 (2026-09-27, prompt 66)

Owner: address the issues in both repositories and open pull requests to
have them verified. The browser's bug and document issues are fixed on
the branch fix/issues-17-to-22; the feature requests #23 to #28 wait for
the owner (rule 2). The holoml issues #1 to #5 are fixed in that
repository's pull request #6; its v0.1.1 tag and the copy into this
repository follow the merge.

| Issue | Fix | Check |
|---|---|---|
| #17 Sleeping tabs lose unsent edits in frames, shadow roots, stopped submits | preload/form-state.ts watches same-site frames at any depth and shadow roots (composedPath); a field counts while it differs from how the page first showed it; a submit no longer clears it by itself | issues-17-to-22.e2e.ts: frame, shadow root, stopped submit stay awake with their drafts; a field the page clears lets the tab sleep |
| #18 Sleeping interrupts capture | preload/capture.ts counts live camera, microphone, and screen tracks in the page's world; the sleep rule skips capturing tabs | Video-only and silent microphone tabs stay awake; a stopped stream lets the tab sleep; unit test in sleep.test.ts |
| #19 requestSubmit() makes an offer | Submit reports need the person's activation; the main process needs real input within 5 s | No offer from the script alone; a real sign-in still offers |
| #20 Filter tests depend on the build date | F9 turns daily updates off (the request count stays exact; the schedule keeps its own check); I6 derives the age from the built-in lists' date and waits for the tab count | F9, F10, I6 pass on their own and in the suite |
| #21 Status out of step across documents | README status and platforms, ARCHITECTURE's later screens | Read through README, ARCHITECTURE, HANDOFF, TODO |
| #22 Block leaves capture live | Block ends the site's live tracks in every tab and clears the marker | Through the site panel, two tabs on one site: both tracks end, the marker goes, a new request is refused |
| #4 History off the main process | Done in milestone 10 (history worker, L8, L9) | Closed with this pull request |
| #5 Pinned toolchain, reproducible checks | Done in milestones 11 and 12 (pnpm pinned, frozen lockfile, GitHub Actions) | Closed with this pull request |

Also: the HoloML viewer ignores numbers too large to draw and survives
a checker failure, until HoloML 0.1.1 (holoml #1, #3) is copied in.
HoloML 0.1.1 (holoml v0.1.1, commit 307315b) is now copied in with pnpm
holoml:sync (branch sync/holoml-0.1.1); the viewer keeps both guards as
a second line.

## GitHub issues #8 to #15 (2026-09-26, prompt 39)

QA of milestone 8 by the owner. Fixed on branch fix/github-issues-8-15,
in a pull request for the owner's review:

- #8 (P1) Private tabs no longer write site choices to settings.json:
  the layers view choice (shell) and the shield pause (main process,
  which now gets the asking tab) stay in memory for private tabs, apply
  to that site in every private tab while one is open, and are
  forgotten with the last one. Decided and documented: private choices
  are shared by private tabs, like their cookies.
- #9 (P2) The page's own transforms and animations, also ones added
  after an element was lifted, release it: our lift is taken off for one
  batched style read when choosing layers; style and class changes are
  now watched, ignoring our own --hs-lift updates (no loop).
- #10 (P2) Trimming the downloads list drops only finished downloads; a
  running one stays listed, cancellable, and keeps its name reserved.
- #11 (P2) Layer choosing is bounded: pinned elements are found once in
  6 ms slices and then kept current from the page's changes; candidates
  are capped; only relevant changes lead to choosing again. Budget: no
  long task (50 ms or more) on a changing 20,000-element page with the
  layers view on (the old code had 59 to 72 ms ones).
- #12 (P2) After a graphics reset the room draws again by itself;
  nothing is drawn while the context is lost.
- #13 (P2) Requests still waiting are bounded (300 per tab), as the list
  is; a request no longer followed stays counted.
- #14 (P3) Scrolling inside boxes (vertical and horizontal) refreshes
  the image report and re-measures the layers inside them.
- #15 (P3) docs/privacy.md, ARCHITECTURE.md, and HANDOFF.md corrected:
  downloaded files versus the session's list; the Downloads folder
  outside the app data folder; the real bounds and lifetimes of the
  instrument readouts and certificates (private tabs' now kept apart and
  cleared with the last private tab); private-tab choices; milestone
  state taken from this file.

New checks: unit (per-tab pause, pending bound, private certificates,
running downloads kept, style comparison); end-to-end #8 (m8), #9, #11,
#14 (m5), #10 (m8), #12 (m6). The #9, #11, #14, and #12 checks were
confirmed to fail against the previous code. One request check changed
with the requirement: the shield's pause request now names its tab.

Results on the branch (Windows 11, 2026-09-26): 187 unit tests; lint
and type check clean; end-to-end 137 of 140, the 3 failures being the
D8 clipboard checks while the Windows clipboard was unavailable to every
program on the machine (PowerShell's Set-Clipboard failed too). Not
checked: macOS and Linux.

Pull request #16 review (prompt 40), four P2 findings, all fixed on the
same branch:
- A fixed element added inside a lifted section did not release it: the
  scan now notes any change to what is pinned and chooses the layers
  again when it ends.
- A class on a lifted section that pins something inside it (".x #y
  {position: fixed}") left the pinned set stale: a restyle of, in, or
  around a layer now rechecks that element's whole subtree (in slices;
  elsewhere only the element, so restyling animations cause no rescans).
- Private data and choices were cleared when the last private page
  closed although a blank private tab was still open: the shell now
  tells the main process when its last private tab (blank ones
  included) closes, and only then is anything cleared.
- A download interrupted but able to resume counted as finished and
  could be trimmed: only downloads Electron reports as done are finished
  (new field "finished"); others stay listed, cancellable, and reserved,
  and show as paused.
New checks: a unit test for the resumable download (fails against the
reviewed code), an end-to-end check for the added fixed element and the
pinning class (the class case fails against the reviewed code; the
added-element case also passed there in two runs, since another change
chose the layers again within 3 s, so it guards the behaviour without
being shown to catch that regression), and the blank private tab added
to the #8 check. Results: 188 unit tests; 138 of 141 end-to-end checks,
the 3 failures again the D8 clipboard checks while the Windows clipboard
was unavailable.

Follow-up review of pull request #16 (prompt 41), one P1 finding, fixed:
closing the whole window (the app keeps running on macOS) did not clear
the private session, since only the shell's tab list signalled the end
of private browsing; a reopened window's private tab still read the old
cookie and local storage and found the shield paused. The main process
now clears the private session itself when the window closes or its
shell crashes, and a window reopened meanwhile waits for that to finish.
New check (m8, with the app kept running as on macOS): close the window,
reopen, open a private tab on the same site: no old cookie or storage,
and the shield blocks again. It fails against the reviewed code (the
cookie survived). Results: 188 unit tests; 139 of 142 end-to-end checks,
the 3 failures the D8 clipboard checks with the Windows clipboard
unavailable. Native macOS not tested.

## Rename to HyperSol HyperSpace 3D (2026-09-26, prompt 42)

Owner decision: the product is now HyperSol HyperSpace 3D, with
"HyperSpace 3D" as the short display name. Done:
- GitHub repository renamed to srajpal/hypersol-hyperspace-3d (GitHub
  redirects the old address); the local remote updated.
- The app: window title, start panel, messages, and the menu's About
  entry say "HyperSpace 3D"; About says "HyperSol HyperSpace 3D" and
  salutes HyperSol WebSurfer (2001) and the HyperSpace 3D concept (2001
  to 2003). Package metadata renamed; internal identifiers (the
  @hypersol scope, channels, switches, file names) unchanged.
- Profiles: an installed app's data folder follows the product name,
  but an existing "HyperSol WebSurfer 3D" folder is kept in use, so
  bookmarks, history, and settings survive (main/profile-folder.ts, unit
  tested). Development and test profiles live elsewhere and are
  unaffected.
- Docs and project instructions: README (with the history revised to
  show the early HyperSpace 3D concept screen without claiming it
  shipped), BRIEF, ARCHITECTURE, AGENTS (naming conventions), HANDOFF,
  docs/privacy.md. PROMPTS.md and earlier records keep the old name as
  history. HoloML (the holoml repository) is unchanged, as asked; its
  README and AGENTS.md still name the browser "HyperSol WebSurfer 3D"
  and link the old address (which redirects).

## New requests (2026-09-26, prompt 42): placed (prompt 43)

The owner approved the proposed order and asked to combine parts where
it makes sense (prompt 43). Combined, one milestone fewer:

| Request | Milestone | Why there |
|---|---|---|
| Site permissions panel: camera, microphone, and location (all refused today), per-site choices | 9, Passwords and site permissions | Both are per-site privacy decisions with the same shape: an offer or prompt on the page, a remembered per-site choice, and a place to review and revoke it |
| Reopen a closed tab; search tabs; mute a tab's audio; tab card options (small, medium, large, auto-hide, or a list in the top bar) | 10, Tabs and economy | All tab management |
| Economy mode: lower rendering resolution, fewer effects, a frame cap; sleeping inactive tabs (protecting forms, audio, downloads) | 10, Tabs and economy | Tab sleeping is tab work; with GitHub issue #4, all the memory and speed work lands together before the first release |
| App logo (from the early HyperSpace 3D cube) | 11, First release | Installers need icons; concepts in docs/branding/logo-concepts/; direction chosen 2026-09-26 (prompt 46): concept 4d |

Each still gets its plan and questions when its milestone starts.
