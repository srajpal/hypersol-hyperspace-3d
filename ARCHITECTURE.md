# HyperSol HyperSpace 3D — Architecture

Status: approved 2026-09-24. Run and test steps are marked "not checked yet"
until they have actually been executed. The milestone roadmap and current
plan are in TODO.md.

## 1. Summary

A desktop browser (Windows, macOS, Linux) built with Electron, TypeScript,
and Three.js. The browser's interface is a 3D scene. The focused web page
is a live Chromium view placed in that scene; other tabs float nearby as
3D cards. Privacy features run inside Electron's main process. HoloML, the
3D markup language, lives in a separate repository and plugs into the same
Three.js scene through a renderer package.

## 2. Terms used in this document

- Electron: a framework that packages Chromium (Chrome's engine) and
  Node.js into a desktop app.
- Main process: the Node.js side of an Electron app. Owns windows, tabs,
  network settings, and files on disk. Has full system access.
- Renderer process: a Chromium page. Our 3D interface ("the shell") is
  one renderer. Each web page a user opens runs in its own renderer.
- Preload script: a small script Electron runs inside a page before the
  page's own code. Used to expose a safe, narrow bridge to the main
  process, and to inject our depth-layering behaviour into web pages.
- IPC (inter-process communication): messages between main and renderer.
- WebGL: the browser's built-in 3D graphics API. Three.js sits on top of it.
- CSS 3D transforms: standard CSS that rotates and positions HTML elements
  in 3D space, rendered by Chromium's compositor at full speed.
- Offscreen rendering: Electron rendering a page to an image instead of
  the screen, so we can paint it onto a 3D surface.
- DoH (DNS over HTTPS): encrypted lookups of website addresses, so the
  network cannot see or tamper with which sites you visit.
- SQLite: a small single-file database. Chrome and Firefox store history
  and bookmarks this way.
- Monorepo: one git repository holding several packages that version and
  build together.

## 3. What was checked on this machine (2026-09-24)

Available: Node 22.16, npm 10.9, pnpm 12.4, git 2.45, Python 3.13,
.NET 9, CMake 3.28, VS Code.
Not available: Rust, C++ compiler (cl, clang, gcc).
Consequence: choose a TypeScript stack; native modules must ship prebuilt
binaries.

Electron 44.4.5 was installed on 2026-09-24 (milestone 1), resolved by
pnpm as the newest 44.x release (Node 24.21.0, Chromium 152.0.7977.130
inside it). The AGENTS.md rule 13 check of Electron's release notes for
security releases was not done at the start of milestone 1: the registry
lookup was blocked by the session's permission check.

Rule 13 check, 2026-09-25 (before milestone 3, at the owner's request):
44.4.5 is the newest stable release (npm "latest", published
2026-09-23); the supported lines are 44, 43 (43.7.5), and 42 (42.11.8);
45 is in alpha. Its release notes list no security fixes, only
"backported fixes from upstream ANGLE, Chromium, Dawn, PDFium and V8".
No upgrade needed.

Rule 13 check, 2026-09-26 (start of milestone 4): 44.4.5 is still the
newest stable release (npm "latest"); no newer stable major line. No
upgrade needed.

Rule 13 check, 2026-09-26 (start of milestone 7, the instrument panel):
44.4.5 still the newest stable release. No upgrade needed.

Rule 13 check, 2026-09-26 (start of milestone 8, everyday features):
44.4.5 still the newest stable release. No upgrade needed.

Rule 13 check, 2026-09-26 (start of milestone 9, passwords and site
permissions): 44.4.5 (2026-09-23) still the newest stable release on
releases.electronjs.org; no security notes listed. No upgrade needed.

Rule 13 check, 2026-09-26 (start of milestone 10, tabs and economy):
44.4.5 still the newest stable release. No upgrade needed.

Graphics on the build machine: NVIDIA GeForce RTX 4050 Laptop GPU and
AMD Radeon integrated graphics; one 1920×1080 display at 100% scaling;
touchpad, no touch screen.

## 4. Decisions and reasons

| Decision | Choice | Why |
|---|---|---|
| App framework | Electron, current supported stable line (44 as of 2026-09-24) | Bundles Chromium; one codebase for three desktop OSes; huge ecosystem; matches "embed an existing engine". Electron ships no Widevine DRM module, so DRM video (Netflix, Disney+, Spotify web) does not play; documented limitation, not planned. |
| Language | TypeScript everywhere | One language for shell, main process, HoloML parser; easiest for contributors. |
| 3D library | Three.js | Most used open-source web 3D library; supports both WebGL objects and live DOM in one scene. |
| Focused page in 3D | Live panel via CSS 3D transform (Three.js CSS3DRenderer), using an Electron `<webview>` element in the shell | Sharp text, native input, zero pixel copying. `WebContentsView` is a flat native layer and cannot be transformed in 3D. On attach, any page-requested preload is replaced by the trusted page preload (page.ts: element hiding and the layers view) and safe web preferences are forced. |
| Fallback if tilted input fails | Focused page faces the viewer flat, room stays 3D around it | Keeps sharp text and native input; tab cards and transitions still tilt. Decided 2026-09-24. |
| Background tabs in 3D | Snapshot textures on WebGL cards | Cheap; lit and occluded like real objects. |
| Upgrade path | Offscreen rendering to GPU textures | Lets pages curve, bend, and receive lighting later; hidden behind the PagePanel interface. |
| Page depth layering | A layers view (milestone 5): the page preload lifts the page's top-level sections and its images into separate depths. Bounded work (GitHub issue #11): pinned elements are found once, in 6 ms slices, then kept current from the page's changes (a restyle near a layer rechecks that element's whole subtree, and any change to what is pinned chooses the layers again, PR #16 review); at most 400 section candidates (a longer list is a feed, not sections) and 2000 images are looked at, and only changes that can affect the choice lead to choosing again. The page's own transforms and animations, including ones added after an element was lifted, release it (issue #9); scrolling inside boxes re-measures the layers in them and refreshes the image report (issue #14). Each lifted element gets its own CSS perspective transform around one shared vanishing point, which follows the room's parallax; styles go in through webFrame.insertCSS. Elements that are fixed or sticky or contain such parts, and elements the page already transforms or animates, are skipped; at most 24 sections and 24 images | Interactive, no copying: clicks and typing land where they appear. No ancestor gains a transform, so the page's pinned parts stay pinned (a transform on the body would unpin them). The page's 3D cannot share the room's 3D space, so the view happens inside the page panel. |
| Layers view on or off | On by default (owner, prompt 31). Settings: "Open pages in the layers view" (global); switching the view on a page (button in the top bar, Ctrl/Cmd+Shift+L) is remembered for its site and wins over the global switch; Settings clears the site choices | Owner decision Q2. A switch applies to the tab in front at once, and to other tabs on their next page load. |
| Shell and page messages | The shell sends the layers state with the webview's own send; the page preload reports image rectangles with sendToHost; both checked (shared/layers.ts) | The main process is not needed, and the page's own scripts cannot see either message. |
| Ad/tracker blocking | @ghostery/adblocker-electron 2.18.2 (MPL-2.0; with @ghostery/adblocker and its page script, installed 2026-09-26). The app owns the session's request listener and asks the package's engine about each web page request; the package's page script (run from preload/page.ts) does element hiding | Open source, uBlock-compatible lists, built for Electron. The package has no allow-once or per-site switch, so the app's own listener adds "open anyway", pausing a site, and per-tab counts; only webview tabs are filtered, never the shell. |
| Lists | Ads and trackers (EasyList, EasyPrivacy, uBlock Origin's lists, Peter Lowe's), from Ghostery's copies on GitHub; named in resources/filters/lists.json and docs/privacy.md | Owner decision 2026-09-26 (prompt 29, Q1 a). |
| First start | A starter copy of the lists is included in the app (resources/filters/starter.bin, rebuilt by `pnpm filters:update`); a saved copy from the last refresh is used when present and valid | Pages are protected from the first one (Q2 a). Lists without a stated licence (Peter Lowe's) are download-only. |
| Filter-list updates | Fetched once a day through Electron's net.fetch (Chromium's network stack, so encrypted DNS applies), on by default, switchable in Settings, plus "Update now"; parsed in a worker thread; a failure keeps the lists in use and retries after an hour | Keeps blocking current without holding up the main process (parsing takes about 0.8 s). |
| Blocked pages | A page on a list is cancelled and the main process tells the shell, which shows the blocked card; "Open anyway" lets that address through once in that tab | Electron drops a cancelled page load without a failure event (found in the F5 check). |
| Stand-in scripts | Requests the lists would redirect to a harmless stand-in (a data: address) are blocked outright | The stand-ins did not load in Electron in the F1 check. |
| Broken sites | The shield popover's "Pause the shield on this site" (saved in settings.json by host name); the page reloads | Owner decision (Q3 a). |
| Encrypted DNS | Electron app.configureHostResolver after app ready, secureDnsMode "secure", resolver Quad9 (https://dns.quad9.net/dns-query) | Built into Chromium. The resolver sees every hostname, so it is a named third-party service: Quad9 is a non-profit with a no-logging policy. Owner may change it. Settings offers Secure (default) or Automatic (falls back to the network's DNS). |
| Encrypted DNS failure | Error card "Encrypted DNS is blocked on this network" with "Use this network's DNS for now", which switches to Automatic for the session. Shown when a lookup fails in Secure mode and a DNS-over-HTTPS question to the resolver (about dns.quad9.net) gets no DNS answer | Secure mode has no fallback, so captive portals and corporate networks would otherwise fail every lookup with no explanation. Chromium reports both cases as "name not resolved", so the app asks the resolver. |
| Spellchecker | Off by default | Electron otherwise downloads dictionaries from a CDN on Windows and Linux, contradicting the privacy statement. |
| Default search engine | DuckDuckGo | Privacy-respecting default; changeable in Settings. |
| Telemetry | None. No analytics, no crash reporter. | Brief requirement. |
| Camera | Fixed desk view with subtle mouse parallax; parallax pauses while the pointer is over the page | Simple and predictable; targets never move under the cursor. Free movement is a later milestone. |
| Window frame | Standard OS title bar | Reliable on all three OSes; a custom frame is considered in the theme milestone. |
| Tab ownership | The shell owns the tabs: each tab is a `<webview>` the shell creates once and keeps in its page | Follows from the milestone 1 decision to show pages as webviews in the shell: a webview lives in the shell's page and reloads if moved, so the shell must own it. The main process keeps the jobs only it can do: shortcuts, new-window rules, the right-click menu, favicons, snapshots. Changed in milestone 2 from "TabManager in the main process"; confirmed with the milestone 2 approval (prompt 20). |
| Keyboard shortcuts | Handled in the main process (before-input-event) for the shell and every page | Work wherever the keyboard focus is, including inside a page; the page never sees the shortcut keys. |
| New windows | Always a tab: in front, or behind for Ctrl-click and middle-click; blocked unless the page had a click or key press in the last 5 seconds | Owner decision 2026-09-25 (prompt 19); 5 seconds matches Chromium's user-activation window. |
| Right-click menu | Built in the main process from Chromium's context-menu data | Electron has none by default. |
| App menu | None on Windows and Linux; standard app, Edit, and Window menus on macOS | Clipboard shortcuts need the Edit roles on macOS. |
| Saved-data requests | One checked request channel from the shell to the main process (shared/data.ts); only the shell may use it; every request is validated before anything is read or written | Keeps the database and files in the main process; the shell cannot reach the file system. |
| History recording | The main process records a visit when a tab commits a navigation to a web address; the same address again in the same tab (a reload) adds nothing; the title follows when the page reports it | Failed loads are not recorded; titles are never taken from the previous page. |
| Closing and quitting | Before the window closes, the shell saves the open tabs and confirms (at most 2 s); a requested quit is then resumed, while an ordinary window close stays a close | Keeps the latest tabs; Quit still quits on macOS, where closing the last window keeps the app running (GitHub issue #3, PR #7 review). |
| Damaged saved data | A damaged settings.json is renamed aside and defaults are used; if the database cannot open, browsing continues and nothing is recorded | The app always starts. |
| Settings | JSON file in the app data folder | Simple, human-readable, easy to back up. |
| Product name | HyperSol HyperSpace 3D; "HyperSpace 3D" in the app's own interface (window title, start panel, messages). The installed app's data folder follows the product name, but an existing folder from the earlier name "HyperSol WebSurfer 3D" is kept in use (main/profile-folder.ts), so profiles, bookmarks, and settings survive; development and test profiles are unaffected | Renamed 2026-09-26 (owner, prompt 42). Internal identifiers (package scope, channels, switches, file names) are unchanged on purpose. |
| Themes | Nebula (dark, default) and Daylight (light) in packages/themes; each sets the HUD's CSS variables, the room (sky decorations, grid, desk, glow, fog, lights), the cards, and the layers view's outline, and switches at run time. Settings > Theme: Nebula, Daylight, or Match the system; a button at the bottom right switches the two. The window's background and title-bar scheme (nativeTheme) follow | Milestone 6 (agent's design, prompt 32; owner direction prompt 29: 1980s and 1990s). Contrast is unit tested against WCAG AA. |
| Instrument panel | Milestone 7 (owner, prompts 33 to 35): floating glass panels in the shell's overlay, leaning in with CSS perspective and drifting with the room's parallax: a right column (page readouts, browser gauges) and a bottom strip (console, network list); the page's layout leaves room for them; the desk slab hides while the strip shows. The console and network list each maximize to fill most of the window for reading (owner, prompt 36). Off by default; Settings has the main switch, one per part, and the console level; top-bar button and Ctrl/Cmd+Shift+I; "DevTools" opens the page's real DevTools | Overlay panels keep text sharp and input simple while still floating in the room. The controls (dials, meters, readouts, switches; hud/controls.ts) take the kinds from the owner's reference and the look from the themes. |
| Instrument readouts | The main process (main/inspect/) records, in memory only: per tab, request starts (from the one before-request listener, main/privacy), completions and failures (session events), and console messages, the last 300 of each, plus up to 300 requests still waiting (the oldest waiting one is dropped beyond that; GitHub issue #13); per host, the certificate Chromium checks (setCertificateVerifyProc passing Chromium's own verdict through with -3), up to 500, kept until the app closes, with private tabs' kept apart and cleared with the last private tab (issue #15); process memory and CPU (app.getAppMetrics). The shell asks once a second while the panel shows, only for what changed | No new network use and nothing stored; the certificate verdict stays Chromium's (I3 confirms an invalid certificate still fails). |
| Zoom | Minus, level, and plus in the top bar; Ctrl/Cmd with plus, minus, 0; Ctrl + mouse wheel (the page's zoom-changed event); steps from 25% to 500%; remembered per site in settings.json (not from private tabs) | Milestone 8 (owner, prompts 36 and 37). |
| Find in page | Ctrl/Cmd+F: a find bar under the top bar using the webview's findInPage, with count, next and previous | Milestone 8. |
| Downloads | Saved straight to the system's Downloads folder, never over an existing file ("name (1).ext"); a Downloads panel with progress, open, show in folder, cancel, clear; Ctrl/Cmd+J; a dot on the menu while one runs; the list lasts the session and keeps the last 100 finished ones, never dropping a download that is not done (running, or interrupted but able to resume; it stays cancellable and keeps its file name reserved; GitHub issue #10, PR #16 review) | Milestone 8, owner Q2 a. |
| Printing | Ctrl/Cmd+P and the menu open the system's print dialog for the page; the page prints flat: the layers view's styles have an @media print rule that takes the lift and shadows off (milestone 9, owner feedback on milestone 8; K10 compares PDFs with the view on and off) | Milestone 8; flat printing milestone 9. |
| Saved passwords | A sign-in submitted by real input (the form's submit, its button, or Enter) is reported by the page preload (preload/passwords.ts, main frame only, isolated world) to the main process, which takes the origin from the sending frame, never from the page's words. It offers Save, Never for this site, or Not now (Update for a known account) in a bar under the top bar; the password waits in main-process memory until answered. Passwords are encrypted with Electron's safeStorage (the system keychain: DPAPI on Windows, Keychain on macOS, the secret service on Linux; Linux's fixed-key fallback counts as no keychain) and kept in hypersol.sqlite (schema 2: logins and login_never). Filling: nothing on load; a click on a sign-in field (or the down arrow) shows the saved accounts for that exact origin in a list in a closed shadow root; picking one asks for the password, which the main process gives only within 5 seconds of real input in that page. http sites are saved too, marked "not secure". Never in private tabs; no import, no sync. Managed in the Library's Passwords tab (search, show, copy through the main process's clipboard, delete, the "never" list); Clear data removes them only when ticked | Milestone 9 (owner, prompt 38: Q1 a, Q2 a, Q3 a; prompt 45: Q1 b fill on click, Q3 a http with a warning). A page's scripts cannot read a password the person did not choose to use. |
| Site permissions | Camera, microphone, and location ask with a prompt under the top bar: Allow, Allow this time, Block. Allow and Block are remembered per origin in settings.json (sitePermissions); private tabs keep theirs in memory, forgotten with the last private tab, and do not inherit normal tabs' choices. "This time" lasts until the tab leaves the site or closes. Every other permission request is refused, as before; permission checks other than camera, microphone, and location keep Electron's default answer. A site panel from the top bar's site button (lock, or "Not secure") shows and changes the site's choices; Settings lists and forgets them. Location uses only the operating system's location service (no network location service or API key; K7 ran with every host but 127.0.0.1 blocked and still got a position on Windows 11). Electron reports no "capture started or stopped" event, so the marker (camera, microphone, location icons in the site button, and LIVE on the tab card) means "given to this page": from the grant until the tab leaves the site | Milestone 9 (owner, prompt 45, Q2 a). |
| Download notice | A notice at the bottom when a download finishes (Open, Show in folder) or fails (Downloads); a broken connection counts as a failure at once, even if it could resume. It goes after 8 seconds unless the pointer or keyboard is on it | Milestone 9, owner feedback on milestone 8. |
| New private tab from "+" | The "+" in the top bar opens a tab; its arrow, or a right-click on it, offers New tab and New private tab | Milestone 9, owner feedback on milestone 8. |
| Preload bundles | The shell's preload and the page preload share no project module (preload/preload-graph.test.ts): a shared module becomes a separate chunk file, which a sandboxed preload cannot load (found 2026-09-26: the shell's bridge failed to load). Page-side password messages live in shared/page-passwords.ts for this reason | Sandboxed preloads load one file. |
| Private tabs | Ctrl/Cmd+Shift+N and the menu: a tab whose page uses an in-memory session (partition "hypersol-private"), with the same shield and readouts, and permission prompts whose choices stay in memory (milestone 9); no history; never saved for "reopen your tabs"; its cookies, storage, and cache are cleared when the last private tab closes; links from it open private; marked on its card, in the top bar, and on its start panel. Site choices made from private tabs (layers view, shield pause) stay in memory; zoom from a private tab is not saved at all, apply to every private tab on that site while one is open, and are forgotten with the last one; the shield's pause request names its tab so the main process can tell (GitHub issue #8). "The last private tab" includes blank private tabs, which have no page yet: the shell tells the main process when its last private tab closes, and only then are the private session's data, pauses, and certificates cleared. The main process also clears them itself when the window closes or its shell crashes (every tab goes with it), and a window reopened meanwhile (macOS keeps the app running) waits for that to finish (PR #16 follow-up review). The shell may only attach webviews to the default or this partition | Milestone 8, owner Q3 a. |
| Page tilt | Settings > Page tilt, 0 to 20 degrees, default 10; a --tilt on the command line wins | Less tilt gives sharper text (milestone 1 note). |
| Graphics resets | When the WebGL context is lost, the room stops drawing; when it is restored, it draws again at once and Three.js uploads its textures again (GitHub issue #12) | The room draws only on demand, so a restore must ask for a frame itself. |
| Window frame, reconsidered | Standard OS frame kept | Considered in milestone 6: a custom frame would lose native dragging, snapping, and accessibility; the theme now sets the frame's light or dark scheme. |
| Bookmarks and history | SQLite through Node's built-in node:sqlite (owner decision 2026-09-25, prompt 20) | Fast search over thousands of rows; standard for browsers. Built into Electron's Node, so no native module and no extra package. |
| UI widgets (address bar, menus) | Lit web components | Tiny, standards-based, no framework lock-in; themed with CSS variables. |
| Build | electron-vite (Vite) now; electron-builder planned for milestone 11 (not yet installed) | Fast dev reload; installers for Windows, macOS, Linux. |
| Toolchain | Node 22.13 or newer; pnpm 12.4.1 pinned in package.json (`packageManager`, with the pnpm version recorded in the lockfile); installs use `--frozen-lockfile` | Reproducible installs (GitHub issue #5). |
| Tests | Vitest (unit), Playwright (Electron end-to-end) | Standard, cross-platform. |
| Repos | hypersol-hyperspace-3d (browser; renamed from hypersol-websurfer-3d on 2026-09-26), holoml (language) | Each useful on its own; browser depends on holoml packages via npm. |
| License | Apache 2.0 both; spec text also CC BY 4.0 | Per brief. |

## 5. Parts (browser repository)

pnpm monorepo. Package names use the @hypersol scope.

```
hypersol-hyperspace-3d/
  BRIEF.md
  ARCHITECTURE.md
  LICENSE                      Apache 2.0
  package.json, pnpm-workspace.yaml, tsconfig.base.json
  apps/
    browser/                   the Electron app
      electron.vite.config.ts
      src/
        main/                  main process
          index.ts             app start, single instance, window, app menu,
                               tab snapshot requests
          guests.ts            per web page: shortcuts, new windows,
                               right-click menu, favicons
          shortcuts.ts, popups.ts, context-menu.ts
                               the rules behind those, unit tested
          security.ts          webview lock-down, allowed addresses
          launch-options.ts    command-line options
          downloads.ts         downloads to the Downloads folder, the list
          test-hooks.ts        logs for the end-to-end tests (test runs only)
          inspect/             monitor.ts (per-tab requests, console,
                               certificates; unit tested), index.ts (session
                               events, metrics, the shell's requests)
          privacy/             index.ts (the session's request listener,
                               element hiding answers, the shell's privacy
                               requests), shield.ts (per-tab decisions and
                               counts), filters.ts (starter and saved lists,
                               refresh), filters-worker.ts (builds the
                               engine off the main thread), dns.ts
                               (encrypted DNS mode and reachability check)
          storage/             database.ts (node:sqlite bookmarks and
                               history, schema version), settings-file.ts
                               (settings.json, session.json), files.ts
                               (write through a temporary file),
                               service.ts (answers the shell's requests)
        shared/
          commands.ts          messages between main and the shell
          data.ts              saved-data requests and their checks
          settings.ts          settings, search engines, their checks
          privacy.ts           privacy requests (shield, lists, DNS) and checks
          layers.ts            layers view messages between shell and page
          inspect.ts           instrument panel requests and checks
          downloads.ts         download requests, safe unique file names
          permissions.ts       site permissions: kinds, choices, prompt answers, checks
          passwords.ts         saved password requests from the shell, offers
          page-passwords.ts    password requests from a page's preload (kept
                               apart from passwords.ts, see Preload bundles)
        preload/
          shell.ts             safe bridge exposed to the 3D shell
          page.ts              injected into every web page: the blocker's
                               element-hiding script and the layers view;
                               no Node access
          layers.ts            the layers view and image rectangles in the
                               page; layers-plan.ts: its arithmetic (unit
                               tested)
          passwords.ts         sign-in reports and the saved sign-ins list
                               under a field (milestone 9)
        renderer/              the 3D shell (one Chromium page)
          index.html, main.ts
          app.ts               controller: tabs, pages, room, top bar, commands
          scene/               room.ts (Three.js room, camera, cards, switch
                               animation, input), tab-view.ts (one tab's page,
                               shimmer, error cards), tab-card.ts,
                               start-panel.ts
          hud/                 Lit components: toolbar.ts (nav buttons,
                               address bar, bookmark star, menu, loading
                               strip), library.ts, settings.ts, about.ts,
                               shield.ts (count and popover),
                               theme-button.ts (theme switch),
                               controls.ts (dial, meter, readout, switch),
                               instruments.ts (the instrument panel),
                               find-bar.ts, downloads.ts (milestone 8).
          zoom.ts              zoom steps (unit tested)
          instruments.ts       fills the instrument panel while it shows;
                               inspect-format.ts: its wording (unit tested)
                               Tabs are 3D cards under scene/, not a 2D strip.
          state/               tabs.ts: the tab list and focus
          url.ts, load-errors.ts
                               address-or-search, error card wording
          themes/              applies @hypersol/themes values to CSS
                               variables and Three.js materials
      resources/filters/       lists.json (which lists, from where),
                               starter.bin and starter.json (the starter
                               copy), NOTICE.md (sources and licences)
      scripts/filters-update.mjs
                               rebuilds the starter copy (pnpm filters:update)
  packages/
    scene-core/                @hypersol/scene-core: room layout math,
                               PagePanel interface, camera rig. No Electron
                               imports, so it can be unit tested and reused
                               by HoloML rendering later.
    themes/                    @hypersol/themes: theme schema, the two
                               built-in themes (nebula.ts, daylight.ts),
                               contrast helpers
    holoml-renderer/           (planned) @hypersol/holoml-renderer: maps
                               HoloML nodes to Three.js objects. Skeleton in
                               milestone 11; real work in a later milestone.
  docs/
    screens.md                 (planned) layout notes and states
    screenshots/               progress screenshots, one folder per milestone
    privacy.md                 what is blocked, what is stored, what is fetched
  tests/
    e2e/                       Playwright drives the built app (m1 to m8 checks)
    fixtures/                  sample pages served from 127.0.0.1
    screenshots/               progress screenshots (pnpm screenshots)
```

## 6. Parts (HoloML repository, created alongside)

```
holoml/
  SPEC.md                      the language, written like a small HTML spec
  LICENSE, LICENSE-SPEC        Apache 2.0 and CC BY 4.0
  packages/
    parser/                    @holoml/parser: text to a node tree; zero deps
    schema/                    @holoml/schema: element and attribute rules
  examples/
    showroom/                  the car showroom demo (later milestone)
  conformance/                 sample files and expected trees for any renderer
```

First result scope for this repo: README, SPEC.md outline, empty parser
package with one passing test. Language design itself is a later milestone.

## 7. Data flow

1. The user types in the address bar or the start panel. The shell
   decides between an address and a search (DuckDuckGo) and loads it in
   the tab's webview.
2. Chromium loads the page. The shield (main/privacy/) checks every
   request from a web page against the filter lists and blocks listed
   ones; the page preload asks for element hiding; Quad9 resolves the
   host name over DNS over HTTPS.
3. The webview's events update the tab list, which updates the address
   bar, loading strip, title, and card.
4. The main process sends the shell what only it sees: shortcut key
   presses, new-tab requests from pages, and favicons.
5. Shortly after a page settles, and when switching away from it, the
   shell asks the main process for a snapshot (only of its own tabs) and
   paints it onto the tab's card.

The shell's bridge (preload/shell.ts) is its only way to reach the main
process. It exposes read-only facts (platform, versions) and:
- onCommand: messages from the main process (shortcuts, new tabs,
  favicons, saved-data changes, prepare-close);
- captureTab: a snapshot of one of the shell's own tabs;
- data: saved-data requests (bookmarks, history, settings, open tabs,
  clearing data), each checked in the main process by parseDataRequest
  (shared/data.ts) and accepted only from the shell;
- privacy: shield reports, "open anyway", pausing a site, filter list
  status and "Update now", encrypted DNS status, the reachability check,
  and "use this network's DNS", each checked by parsePrivacyRequest
  (shared/privacy.ts) and accepted only from the shell;
- permissions: prompt answers and the site panel (shared/permissions.ts);
- passwords: save offer answers and the Library's Passwords tab
  (shared/passwords.ts);
- closeReady: the answer to prepare-close, once the open tabs are saved.
Each is checked in the main process and accepted only from the shell.
The main process also sends shield counts per tab, blocked pages, and
filter list changes as commands.
6. The page preload (preload/layers.ts) lifts sections and images when
   the shell turns the layers view on, keeps them current as the page
   changes, scrolls, and resizes, and reports the rectangles of the
   images in view (untransformed layout, CSS pixels) to the shell, which
   keeps them per tab for a later lift-to-3D milestone.
7. The main process writes a history entry when a tab arrives at a web
   page. Bookmarks and settings are written when the user acts, and the
   open tabs shortly after they change. The main process tells the shell
   when saved data changes, so the Library, start panels, and star stay
   current.

## 8. What is saved, and where

| Data | Where | Notes |
|---|---|---|
| Settings, theme, window size | settings.json in the app data folder | Human readable |
| History, bookmarks | hypersol.sqlite in the app data folder | Delete-able from the Library panel and Settings |
| Saved passwords, and sites never to save for | hypersol.sqlite (logins, login_never), the password encrypted with the system keychain | Delete-able in the Library's Passwords tab and with Settings > Clear browsing data > Saved passwords |
| Remembered camera, microphone, and location choices | settings.json (sitePermissions), by origin | Changed in the site panel; forgotten in Settings |
| Private tabs' permission choices; "Allow this time" | Memory only | Forgotten with the last private tab; "this time" when the tab leaves the site |
| An unanswered offer to save a password | Memory only, in the main process | Until answered, replaced, or the tab closes |
| Open tabs | session.json in the app data folder | Used only when startup is set to reopen them |
| Cookies, cache, site storage | Chromium profile folder managed by Electron | Standard browser behaviour |
| Filter lists | filters/engine.bin and engine.json in the app data folder (the last refresh); the starter copy in the app otherwise | Refreshed daily; switchable in Settings; "Update now" |
| Paused sites, DNS mode, list updates switch | settings.json | Changed in the shield popover and Settings |
| Layers view: global switch and per-site choices | settings.json | Changed in Settings and by switching the view on a page |
| Theme and page tilt | settings.json | Changed in Settings and with the theme button |
| Zoom per site | settings.json | Changed with the zoom buttons and shortcuts; not from private tabs |
| Downloaded files | The system's Downloads folder | The list in the Downloads panel lasts the session |
| Private tabs' cookies, storage, cache | Memory only (an in-memory session) | Cleared when the last private tab closes |
| Instrument panel switches and console level | settings.json | Changed in Settings, the top-bar button, and the panel |
| Instrument readouts (requests, console messages) | Memory only, in the main process, per tab | The last 300 of each, and up to 300 requests still waiting; forgotten with the page or tab |
| Certificates checked (for the panel) | Memory only, per host | Up to 500, until the app closes; private tabs' apart, cleared with the last private tab |
| Site choices from private tabs (layers, shield pause) | Memory only | Shared by private tabs while one is open; never in settings.json (issue #8) |
| Image rectangles of the page in front | Memory only, in the shell | Not saved or sent anywhere |

Nothing leaves the machine except user-initiated page loads (including
the favicon a page names, fetched through that page's own session, as a
browser tab does), encrypted DNS lookups to the named resolver
(including the one reachability question after a failed lookup in
Secure mode), and filter-list refreshes (docs/privacy.md). The
spellchecker dictionary download is turned off. Any future update check
would be a fourth item here and needs the owner's approval first.

## 9. Screens and style

### Layout for the first result (approved)

The Room: one full-window 3D scene, seen from a fixed "desk" camera with a
slight parallax that follows the mouse. Parallax pauses while the pointer
is over the page and eases back (about 250 ms); it resumes over the room.
The window uses the standard OS title bar.

- Centre: the focused page, a large upright panel, gently tilted toward
  the viewer, with a soft glow edge in the theme's accent colour.
- Left rail: tab cards, stacked in a shallow arc, each a snapshot with
  title and favicon. Click to focus; the cards animate as the focused
  page slides into the centre. Close on hover. "+" card at the end.
  Since 2026-09-26 (owner, prompt 33) the cards are two-thirds of their
  first size, and the rail shows only with two or more tabs; with one
  tab the page takes the space, and a "+" button at the left of the top
  bar (or Ctrl/Cmd+T) opens another.
- Top HUD (2D overlay, always sharp): new tab, back, forward, reload,
  address and search bar, layers view button, bookmark star, menu button. Loading progress is a thin strip under the bar.
- Right side, on demand: a slide-in Library panel (bookmarks, history) or
  Settings panel. Only one open at a time. Escape closes it.
- Bottom-right: theme switch and privacy shield (count of blocked
  requests on the current page). Both built (milestones 4 and 6).

Movement: standard browser shortcuts (Ctrl/Cmd+T new tab, Ctrl/Cmd+W
close, Ctrl/Cmd+L address bar, Ctrl+Tab next tab on every platform since
Cmd+Tab is the macOS app switcher). Mouse and touch:
click or tap cards and buttons; scroll inside the page scrolls the page.
No free camera movement in the first result.

### States

- Waiting: progress strip under the address bar; a new panel shows a soft
  shimmer until first paint; tab cards show a spinner until a snapshot.
- Empty: new tab shows a start panel with a search box, bookmarks grid,
  and recent history. With no data: "Nothing saved yet" with a hint.
  Library with no history or bookmarks: same wording.
- Error: shown inside the panel as a card with a plain message, the
  address, and Retry. Cases: address not found, connection failed,
  certificate not valid (no Retry and no way to proceed; Go back only),
  blocked by the privacy shield (with "open anyway"), page crashed
  ("This page went dark"), encrypted DNS blocked on this network (with
  "use this network's DNS for now").
- Right-click menu on a page: back, forward, reload; on a link, open in
  new tab and copy link address; on selected text, copy; in a text
  field, cut, copy, paste, select all.
- Library and Settings panels: waiting ("Loading…"), empty ("Nothing
  saved yet" with a hint, or "Nothing found" for a search), and error
  ("Couldn't open your saved data"). Destructive actions ask to confirm
  in place. Focus moves into a panel when it opens and back when it
  closes.
- Motion: tab switches animate over 250 ms; with the system's reduced
  motion setting they are instant and the loading strip and shimmer
  stop moving.
- Privacy status: the shield icon shows a count; clicking opens a small
  popover listing what was blocked.

### Shared appearance

- Two built-in themes: Nebula (dark, default) and Daylight (light).
  Each theme defines: background gradient, panel glass colour, accent,
  text colours, glow strength, and 3D room lighting.
- Style: glass panels, thin luminous edges, restrained motion (200 to
  300 ms), one accent colour per theme. Fonts: a system sans-serif stack
  for the first result; a custom font is a later decision.
- All colours are CSS variables in the HUD and matching values in the
  Three.js materials, so a theme changes both at once.

### Later screens and polish (not in the first result)

Free camera and room navigation, HoloML page mode, image lift-to-3D,
downloads panel, find in page, extensions, sync, theme editor, custom
fonts, sound design, VR.

## 10. Open questions

1. Theme look: built in milestone 6 (agent's design, awaiting the owner's
   review): Nebula, a synthwave night (indigo sky, magenta horizon,
   striped retro sun, violet grid, cyan accent, faint scanlines), and
   Daylight, a pastel 1990s day (pale blue sky, pink horizon, teal
   accent, lavender grid). Values in packages/themes. Owner direction (2026-09-26,
   prompt 29): lean further into the 1980s and 1990s aesthetic; the
   owner will review the look more fully once themes and depth layering
   are in.
2. Live-panel input on a rotated page: answered by the milestone 1
   spike (TODO.md task 8). Clicks, hover, scrolling, links, and real
   keyboard typing work at the default tilt (owner check 2026-09-25),
   so the flat-page fallback is not used. Remaining: text is slightly
   soft when tilted (revisit tilt and sharpness in milestone 6).
   Found in milestone 2: input sent in the same instant a page appears,
   moves, or resizes can be routed to the shell instead of the page.
   A pointer that has already arrived is routed correctly, so mouse use
   is not affected; a touch tap at that instant might be (recheck with
   C14 on a touch screen). This was the cause of the intermittent C2.
3. Prebuilt better-sqlite3 binaries for the chosen Electron line on all
   three OSes. Check first whether Electron's bundled Node provides
   node:sqlite, which would remove the only native module. Checked
   2026-09-24 on Windows: node:sqlite works in Electron 44.4.5 (Node
   24.21.0, SQLite 3.53.4). Decided 2026-09-25 (prompt 20): use
   node:sqlite; better-sqlite3 is dropped. macOS and Linux not checked.

## 11. Run and test

Checked on Windows 11, 2026-09-24 and since (macOS and Linux not
checked yet):
- Toolchain: Node 22.13 or newer; pnpm 12.4.1 (pinned)
- Install: `pnpm install --frozen-lockfile`
- Develop: `pnpm dev` (starts the Electron app with live reload, using a
  throwaway profile in the ignored `userData/dev` folder)
- Build: `pnpm build` (output in apps/browser/out)
- Unit tests: `pnpm test`
- Lint and type check: `pnpm lint`, `pnpm typecheck`
- End-to-end: `pnpm test:e2e` (milestone 1 to 3 checks, about 120
  seconds; needs openssl on PATH for the certificate-error check, which
  Git for Windows provides)

Progress screenshots: `MILESTONE=m3 pnpm screenshots` builds the app and
saves its main screens to docs/screenshots/m3/ (Electron's own capture,
local test pages only).

Not checked yet: `pnpm package` (installers per OS, milestone 11).

Launch options, for development and tests: `--start-url=<address>`
(default: a start tab), `--tilt=<0 to 20>`,
`--hypersol-user-data=<folder>`; `HYPERSOL_TEST=1` turns on the test
hooks and allows `--search-url=<address with %s>`;
`HYPERSOL_TEST_BACKGROUND=1` (test mode only, set by the test harness
unless HYPERSOL_TEST_SHOW=1) opens the window off screen, without focus
or a taskbar button, and tells Chromium to keep drawing it;
`HYPERSOL_TEST_KEEP_RUNNING=1` (test mode only) keeps the app running
when its last window closes, as on macOS, so quitting can be tested on
any platform. The tests
also pass Chromium's `--host-resolver-rules` so that no name resolves
except this machine.
