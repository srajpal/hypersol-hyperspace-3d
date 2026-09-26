# TODO.md — Roadmap and current plan

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
| 9 | Passwords | A password manager: offer to save on sign-in, fill on return, view and delete; encrypted with the system's keychain | Later (questions answered, prompt 38; plan waits for the owner's GitHub issues) |
| 10 | First release v0.1 | Installers for Windows, macOS, Linux; per-OS checks; holoml first-result scope (SPEC.md outline, parser package with one test); full regression pass | Later |
| 11 | HoloML v0.1 language | Spec, schema, parser, conformance samples | Later |
| 12 | HoloML in the browser | `.holo` page mode: models, orbit and walk, labels, links, lights, materials, animation | Later |
| 13 | Car showroom demo | Demo site with walk-around 3D cars | Later |
| 14 | Free camera and room navigation | Move freely around the room | Later |
| 15 | Lift to 3D | Images and 3D models on 2D pages become objects | Later |
| 16 | Polish | Custom font, sound design, theme editor, motion tuning | Later |
| — | Further out | HoloML scripting, extensions, sync, theme marketplace, Tor or VPN, VR, iOS and Android | Later |

Milestones 1 to 10 make up the first useful result in BRIEF.md. The
instrument panel was added as milestone 7 on 2026-09-26 (prompt 35), and
on the same day (prompt 37) the everyday browser features moved ahead
of the first release as milestone 8, with a new Passwords milestone 9;
the first release is now milestone 10. Earlier entries below that say
"milestone 7" or "milestone 8" for the release now mean 10.

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
- Later polish goes after the first release (14), so it cannot delay a
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
| C9 | Idle efficiency | Automated: count frames | No redraws while idle; about 60 fps during parallax |
| C10 | Load failure | Automated: stop the server, then load a page | Plain "couldn't load" text; app does not crash |
| C11 | Page crash | Automated: force the page's process to crash | App survives; message with Reload |
| C12 | Layout and style code | Vitest (unit) | Panel position and tilt correct; parallax cap and pause hold; one theme value yields matching CSS and 3D colour |
| C13 | Real sites | Manual, by the owner: Wikipedia, DuckDuckGo, YouTube | Text readable at the default tilt; video plays; parallax feels calm |
| C14 | Touch | Manual: tap and scroll | Works, or marked "not checked" without a touch screen |
| C15 | macOS and Linux | — | "Not checked" until milestone 7 |

### Check results (Windows 11, 2026-09-24)

Machine: NVIDIA GeForce RTX 4050 Laptop GPU plus AMD Radeon integrated
graphics, one 1920×1080 display at 100% scaling, touchpad, no touch
screen. Clicks in the automated checks are sent with Playwright's mouse
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
  Proposed as a task in milestone 10 (first release), before real users
  build up large histories.
- #5: continuous integration for build, lint, types, and tests needs the
  owner's approval of a service (AGENTS.md rule 3, for example GitHub
  Actions). Windows, macOS, and Linux coverage belongs with milestone 10's
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
  font is milestone 16).

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

### Owner feedback on milestone 8 (2026-09-26, prompt 38), not yet planned

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

Not planned yet: the owner will post GitHub issues first and asked that
their feedback shape the plan. Answers already given:

- Q1 a: passwords encrypted with the system's own keychain (Electron's
  safeStorage), unlocked by the system sign-in; no master password.
- Q2 a: managed in a Passwords tab in the Library (search, view, copy,
  delete).
- Q3 a: no import for now; passwords are saved as you sign in.
- Assumptions shown with the questions (not yet confirmed or refused):
  offer to save on sign-in; fill only on the same site; never in
  private tabs; no sync.

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

