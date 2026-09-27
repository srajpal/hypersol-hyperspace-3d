# TODO.md — Roadmap and current plan

Product: HyperSol HyperSpace 3D (renamed from HyperSol WebSurfer 3D on
2026-09-26; see "Rename" at the end).

Status key: **Done**; **Current** (plan approved, build not yet
approved); **Later** (listed, not approved to build).
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
| 12 | Developer preview 0.9.0 | Source release for developers: privacy and proofreading pass, legal and project files, automatic builds and tests on Windows and Linux (GitHub issue #5), Electron check, trademark and `.holo` checks, version 0.9.0 | In progress (prompt 58) |
| 13 | HoloML v0.1 language | Spec (HTML-like tags, glTF models), schema, parser, conformance samples | Later (H1 a, H2 a, prompt 58) |
| 14 | HoloML in the browser | `.holo` page mode: models, orbit and walk, labels, links, lights, materials, animation | Later |
| 15 | Car showroom demo | Demo site with walk-around 3D cars | Later |
| 16 | Windows and Linux release 1.0 | Installers, the app logo and icons, signing, updates (the questions put off in prompt 55) | Later |
| 17 | macOS release | Signing, notarization, Mac checks | Later |
| 18 | Free camera and room navigation | Move freely around the room | Later |
| 19 | Lift to 3D | Images and 3D models on 2D pages become objects | Later |
| 20 | Polish | Custom font, sound design, theme editor, motion tuning | Later |
| — | Further out | HoloML scripting, extensions, sync, theme marketplace, Tor or VPN, VR, iOS and Android | Later |

Milestones 1 to 11 built the browser. On 2026-09-26 (prompts 54 to 58)
the owner chose to release it as source for developers first (milestone
12, a 0.9.0 developer preview), follow the HoloML path (13 to 15), and
ship installers as 1.0 afterwards (16 for Windows and Linux, 17 for
macOS; mobile later). Entries below that say "milestone 11" or "12" for
the installer release now mean 16. The
instrument panel was added as milestone 7 on 2026-09-26 (prompt 35); on
the same day the everyday browser features moved ahead of the first
release as milestone 8, with a Passwords milestone 9 (prompt 37); then
(prompts 42 and 43) site permissions joined Passwords as milestone 9,
the tab requests and economy mode became milestone 10, and the first
release is now milestone 11. Earlier entries below that say "milestone
7", "8", or "10" for the release now mean 11.

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
- Later polish goes after the first release (20), so it cannot delay a
  working browser.

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
| D11 | About | Automated | Shows versions; Escape closes |
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
at the start (ARCHITECTURE.md section 3). All tasks done; waiting for
the owner's look-and-feel check (F11), the optional live check (L1), and
acceptance. Screenshots: docs/screenshots/m4/.

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
same day for milestone 4 (ARCHITECTURE.md section 3). Milestone 4 still
awaits the owner's acceptance (F11).

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
| G9 | Efficiency | Idle and scrolling stay within the milestone 1 budget with the view on |
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
later. Milestone 9 was pushed first; its acceptance is still to come
(the owner will test it with this milestone's list). Electron security
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
| L9 | History budget | Unit benchmark: 100,000 visits, search and recent within 50 ms, main thread held at most 20 ms |
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

Status: In progress. Plan and build approved 2026-09-26 (prompt 58),
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
- [ ] 9. Version 0.9.0; the README's developer section; the release notes.
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
| N6 | Pending one rerun. Full local run with N7: 166 of 170 passed; D8's copy and paste (3) and K2's copy failed because the Windows clipboard was failing for every program on the machine at the time (PowerShell's Set-Clipboard failed too). The same checks pass in GitHub Actions. To rerun locally when the clipboard works |
| N7 | Pass, locally and in GitHub Actions on Windows and Linux |

### Done when

- N1 to N7 pass, the owner has read the edited PROMPTS.md and the new
  project files, and says go for the 0.9.0 tag and release.

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
