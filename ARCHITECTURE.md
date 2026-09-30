# HyperSol HyperSpace 3D — Architecture

Status: approved 2026-09-24. Run and test steps are marked "not checked yet"
until they have actually been executed. The milestone roadmap and current
plan are in TODO.md.

## 1. Summary

A desktop browser (Windows, macOS, Linux) built with Electron, TypeScript,
and Three.js. The browser's interface is a 3D scene. The focused web page
is a live Chromium view placed in that scene; other tabs float nearby as
3D cards. Privacy features run inside Electron's main process. HoloML, the
3D markup language, lives in a separate repository. The browser keeps a
copy of its parser and checker (packages/holoml, made by `pnpm
holoml:sync`) and has a viewer of its own, which draws a HoloML page with
Three.js inside that page's own sandboxed process (apps/browser/src/viewer).

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
  network cannot read or change the lookups. The network still sees the
  address each connection goes to and, as the connection is made, the
  site's name.
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

Rule 13 check, 2026-09-26 (start of milestone 11, the owner's feedback):
44.4.5 still the newest stable release. No upgrade needed.

The build machine: a Windows 11 laptop with a discrete graphics card
and integrated graphics, one 1920×1080 display at 100% scaling, a
touchpad, and no touch screen.

Rule 13 check, 2026-09-26 (start of milestone 12, the developer
preview): 44.4.5 still the newest stable release on npm ("latest";
45 is in alpha). No upgrade needed.

Rule 13 check, 2026-09-26 (start of milestone 13, HoloML): 44.4.5
(2026-09-23) is still the newest stable release; no 45 stable yet, and
no security release since. No upgrade needed.

Rule 13 check, 2026-09-27 (start of milestone 14, HoloML in the
browser): 44.4.5 is still the newest stable release, with no security
release since. No upgrade needed.

Rule 13 check, 2026-09-27 (start of milestone 15, HoloML hardening):
44.4.5 is still the newest stable release; no 45 stable yet, and no
security release since. No upgrade needed.

Rule 13 check, 2026-09-27 (start of milestone 16, car showroom): 44.4.5
is still the newest stable release on npm ("latest"; 45 is in alpha),
with no security release since. No upgrade needed.

Rule 13 check, 2026-09-27 (start of milestone 17, Blockworld): 44.4.5 is
still the newest stable release on npm, with no security release since.
No upgrade needed.

Rule 13 check, 2026-09-27 (start of milestone 18, with walking speed and
the slider, prompt 92): 44.4.5 is still the newest stable release on npm
("latest"; 45 is in alpha), and no release since mentions a security
fix. No upgrade needed.

Rule 13 check, 2026-09-28 (start of milestone 19, Harbour Loft, prompt
113): 44.4.5 (2026-09-23) is still the newest stable release on npm
("latest"; 45 is in alpha, 45.0.0-alpha.12), with no release since. No
upgrade needed.

Rule 13 check, 2026-09-28 (start of milestone 20, the sneaker store,
prompt 120): 44.4.5 (2026-09-23) is still the newest stable release on
npm ("latest"; 45 is in alpha, 45.0.0-alpha.13 of 2026-09-28), with no
stable release since. No upgrade needed.

Rule 13 check, 2026-09-29 (start of milestone 21, the aquarium, prompt
121): 44.4.5 (2026-09-23) is still the newest stable release on npm
("latest"; 45 is in alpha, still 45.0.0-alpha.13 of 2026-09-28), with no
release of any line since. No upgrade needed.

Rule 13 check, 2026-09-29 (start of milestone 22, HoloML's
documentation, prompt 128): 44.5.0 (2026-09-29) is now the newest
stable release on npm ("latest"), with 43.7.6 and 42.11.9 the same day;
45 is still in alpha (45.0.0-alpha.13). 44.5.0's release notes list no
security fixes: features, crash fixes, and performance (its one mention
of security is a WebAuthn security key). The browser stays on 44.4.5,
the same supported line, as this milestone releases no browser; the
rule's upgrade comes before a public release.

Rule 13 check, 2026-09-30 (the review, prompts 134 and 135): 44.5.1
(2026-09-30) is the newest stable release on npm ("latest"; 43.7.7 and
42.11.10 came the same day), its notes reading "Backported fixes from
upstream ANGLE, Chromium, Dawn and V8", which is how Electron ships
Chromium's security fixes. The browser is upgraded to 44.5.1. From now
on a release whose notes name backported fixes from Chromium or V8 is
taken as a security release, whether or not the word appears. No check
was recorded at the start of milestones 2, 5, and 6 (milestone 1's is
recorded as not done); they cannot be made up afterwards.

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
| Ad/tracker blocking | @ghostery/adblocker-electron 2.18.2 (MPL-2.0; with @ghostery/adblocker and its page script, installed 2026-09-26). The app owns the session's request listener and asks the package's engine about each web page request; the package's page script (run from preload/page.ts) does element hiding | Open source, uBlock-compatible lists, built for Electron. The package has no allow-once or per-site switch, so the app's own listener adds "open anyway", pausing a site, and per-tab counts. Asked about (main/privacy/shield.ts): every request a web page (a webview tab) makes, WebSocket connections (lasting two-way connections a page opens to a server; `ws:` and `wss:` addresses) among them; requests that no tab made, such as a service worker's (a script a site leaves running in the background, apart from any tab), asked about with the address they name as their referrer as the page, and blocked without being counted, as there is no tab to count them for; and a tab's favicon, which the main process fetches for the card: the shield is asked before it is fetched, and a listed one is not fetched and is counted. Not asked about: the shell's own requests and its developer tools', and the app's own while they are under way (list updates, the DNS check, a favicon the shield has passed: main/privacy/own-requests.ts). Until the review of 2026-09-30, WebSockets, requests without a tab, and favicons passed unseen. |
| Lists | Ads and trackers (EasyList, EasyPrivacy, uBlock Origin's lists, Peter Lowe's), from Ghostery's copies on GitHub; named in resources/filters/lists.json and docs/privacy.md | Owner decision 2026-09-26 (prompt 29, Q1 a). |
| First start | A starter copy of the lists is included in the app (resources/filters/starter.bin, rebuilt by `pnpm filters:update`); a saved copy from the last refresh is used when present and valid | Pages are protected from the first one (Q2 a). Lists without a stated licence (Peter Lowe's) are download-only. |
| Filter-list updates | Fetched once a day through Electron's net.fetch (Chromium's network stack, so encrypted DNS applies), on by default, switchable in Settings, plus "Update now"; parsed in a worker thread; a failure keeps the lists in use and retries after an hour. An update downloads the lists' text only (rules about addresses and page elements). The blocker's page scripts (uBlock Origin's "resources", which the blocker runs inside web pages) come with the app, inside the starter copy, and change only when `pnpm filters:update` rebuilds it before a release: before each build the starter copy is checked against its SHA-256 recorded in starter.json (SHA-256: a checksum, a short fingerprint of a file's exact contents), and the scripts inside it against theirs; a saved copy built with any other scripts is not used (main/privacy/filters-build.ts, filters.ts) | Keeps blocking current without holding up the main process (parsing takes about 0.8 s). Until the review of 2026-09-30 an update also downloaded the scripts, from a branch of another project that can change at any time, and ran them in every page within a day. |
| Blocked pages | A page on a list is cancelled and the main process tells the shell, which shows the blocked card; "Open anyway" lets that address through once in that tab | Electron drops a cancelled page load without a failure event (found in the F5 check). |
| Which page the shield counts for | A tab's record (its site, its count, its list of what was blocked) is the record of the page it shows. A request for a new page starts a record that waits: it becomes the tab's when the page arrives, and is dropped if the page never does (a link that leads to a download, an answer with no content). A blocked page's record is the tab's at once, as its card shows, and so is a failed page's | Review of 2026-09-30: before, a link to a download made the download's host the tab's site, the count fell to 0, and "pause" offered the wrong site. |
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
| Zoom | Minus, level, and plus in the top bar; Ctrl/Cmd with plus, minus, 0; Ctrl + mouse wheel (the page's zoom-changed event); steps from 25% to 500%; remembered per site in settings.json. Zoom set in a private tab is never saved: the shell keeps it in memory by site, for private tabs, until the last private tab closes | Milestone 8 (owner, prompts 36 and 37). Private tabs' zoom in memory since the review of 2026-09-30: before, a private tab's zoom was lost at each new page. |
| Find in page | Ctrl/Cmd+F: a find bar under the top bar using the webview's findInPage, with count, next and previous | Milestone 8. |
| Downloads | Saved straight to the system's Downloads folder, never over an existing file ("name (1).ext"); a Downloads panel with progress, open, show in folder, cancel, clear; Ctrl/Cmd+J; a dot on the menu while one runs; the list lasts the session and keeps the last 100 finished ones, never dropping a download that is not done (running, or interrupted but able to resume; it stays cancellable and keeps its file name reserved; GitHub issue #10, PR #16 review). "Open" never starts a program: a file the system would run or install (by its extension: .exe, .msi, .bat, .sh, .app, .jar, and the like, listed in shared/downloads.ts) is shown in its folder instead | Milestone 8, owner Q2 a. A page can start a download by itself, so starting a program must be the person's own act in their file manager (review of 2026-09-30). |
| Printing | Ctrl/Cmd+P and the menu open the system's print dialog for the page; the page prints flat: the layers view's styles have an @media print rule that takes the lift and shadows off (milestone 9, owner feedback on milestone 8; K10 compares PDFs with the view on and off) | Milestone 8; flat printing milestone 9. |
| Saved passwords | A sign-in submitted by real input (the form's submit, its button, or Enter) is reported by the page preload (preload/passwords.ts, main frame only, isolated world) to the main process, which takes the origin from the sending frame, never from the page's words. It offers Save, Never for this site, or Not now (Update for a known account) in a bar under the top bar; the password waits in main-process memory until answered. Passwords are encrypted with Electron's safeStorage (the system keychain: DPAPI on Windows, Keychain on macOS, the secret service on Linux; Linux's fixed-key fallback counts as no keychain) and kept in hypersol.sqlite (schema 2: logins and login_never). Filling: nothing on load; a click on a sign-in field (or the down arrow) shows the saved accounts for that exact origin in a list in a closed shadow root; picking one asks for the password, which the main process gives only within 5 seconds of real input in that page. http sites are saved too, marked "not secure". Never in private tabs; no import, no sync. Managed in the Library's Passwords tab (search, show, copy through the main process's clipboard, delete, the "never" list); Clear data removes them only when ticked | Milestone 9 (owner, prompt 38: Q1 a, Q2 a, Q3 a; prompt 45: Q1 b fill on click, Q3 a http with a warning). A page's scripts cannot read a password the person did not choose to use. |
| Site permissions | Camera, microphone, and location ask with a prompt under the top bar: Allow, Allow this time, Block. The prompt takes no click or key press for its first half second (hud/arm.ts), so a click already on its way when a page makes the prompt appear answers nothing. Allow and Block are remembered per origin in settings.json (sitePermissions); private tabs keep theirs in memory, forgotten with the last private tab, and do not inherit normal tabs' choices. "This time" lasts until the tab leaves the site or closes. Every other permission is refused (main/permissions.ts), to a page that asks and to a page that only looks: a page that never asked reads "denied" or "prompt", never "granted", for notifications, MIDI, reading the clipboard, idle detection, window management, local fonts, and everything else (until the review of 2026-09-30 a page that looked was told "granted" for all of these, Electron's answer when nothing else is said). One thing needs no permission: putting text on the clipboard (a "Copy" button), which Chromium itself allows only during a real click or key press. Full screen and holding the pointer (pointer lock) are refused until the browser has a notice of its own that says so and how to leave. A site that asks for a client certificate (a certificate on the computer that says who its owner is) gets none, in private tabs too (main/security.ts); with no such rule Electron hands over the first one in the system's store without asking. A site panel from the top bar's site button shows and changes the site's choices, and closes when its tab leaves that site. The button shows a lock only for a page that loaded over https and "Not secure" only for one that loaded over http; neither for a start tab, a failed or crashed page (a certificate error's card among them), or while another site's address is still on its way in (renderer/url.ts, siteMarker). Settings lists the choices and forgets them one site at a time: the change names the site (forgetSitePermissions in shared/settings.ts), so a copy that is out of date cannot write an old choice back. Location uses only the operating system's location service (no network location service or API key; K7 ran with every host but 127.0.0.1 blocked and still got a position on Windows 11). Electron reports no "capture started or stopped" event, so the marker (camera, microphone, location icons in the site button, and LIVE on the tab card) means "given to this page": from the grant until the tab leaves the site | Milestone 9 (owner, prompt 45, Q2 a). |
| Download notice | A notice at the bottom when a download finishes (Open, Show in folder) or fails (Downloads); a broken connection counts as a failure at once, even if it could resume. It goes after 8 seconds unless the pointer or keyboard is on it. Like the permission prompt, its actions take no click or key press for its first half second (hud/arm.ts; Dismiss always does), and Open shows a program in its folder instead of starting it (see Downloads) | Milestone 9, owner feedback on milestone 8. The half second since the review of 2026-09-30: a page chooses the moment its download's notice appears, always at the same place. |
| New private tab from "+" | The "+" in the top bar opens a tab; its arrow, or a right-click on it, offers New tab and New private tab | Milestone 9, owner feedback on milestone 8. |
| Reopening closed tabs | Ctrl/Cmd+Shift+T and the menu; the last 25 closed tabs of the session, in memory; reopened in place. The main process keeps each page's back and forward history (main/tab-history.ts, memory only, the last 60 closed pages, private tabs' forgotten with the last one) and puts it into the new page with navigationHistory.restore. Electron restores only into a page that has never navigated, so the new page's webview gets the address about:blank#hypersol-restore, which the main process turns into "load nothing" as the page is created; the history goes in once the page is attached. Private tabs are not kept for reopening | Milestone 10. |
| Tab search, mute, card size, how tabs are shown | Ctrl/Cmd+Shift+A or the menu: a filterable list of tabs. Sound: the main process forwards each page's audio-state-changed; a speaker on the card, in the lists, and "Mute tab" in the menu mute the tab (webview setAudioMuted; muting belongs to the tab). Settings > Tabs: card size Small 0.8, Medium 1, Large 1.3; Cards or List in the top bar (a row of small tabs under the top bar, 34 px, which the page makes room for). "Cards that hide" (milestone 10) was removed in milestone 11 at the owner's request (prompt 50); a saved "autohide" reads as Cards | Milestone 10; reviewed by the owner in prompt 50. |
| Economy mode | Settings > Economy: Off, On, or On when running on battery (the default; the main process forwards powerMonitor's on-battery and on-ac; test runs start as on mains power). It draws the room's WebGL at half the device pixel ratio (at least 0.5), hides the glow, sun, and horizon band, stops parallax and switch animations, removes scanlines and HUD glows (a data-economy attribute), and caps the room at 30 frames a second; pages are untouched. ECO shows in the top bar | Milestone 10. |
| Sleeping tabs | Settings > Economy: after 5, 15, 30 (default), or 60 minutes out of view, or never; in economy mode after 5 minutes at most. A check runs every 30 s. Never the tab in front, a start or loading tab, a tab making sound, one whose page started a running download (downloads now record the page), one with text typed into a form and not sent (preload/form-state.ts: fields in the page, in frames of the same site, and in shadow roots; a field counts while it differs from how the page first showed it, so a submit the page stops keeps the tab awake, GitHub issue #17; frames from other sites cannot be seen), or one capturing from the camera, microphone, or screen, even silently (preload/capture.ts counts the live tracks in the page's own world, issue #18). A sleeping tab's webview is removed (its page and memory go); the card keeps its snapshot, marked ASLEEP; opening it makes a new page with the old history (as reopening) | Milestone 10. |
| Blocking the camera or microphone | Block in the site panel ends what the site's pages are already capturing, in every tab on the site in that session (normal and private tabs keep separate choices), and clears the in-use marker; new requests are refused. It ends the capture by reloading each page that was given the camera or microphone (main/permissions.ts, revoke), and that reload is not held up by a page that asks to be kept (see Leaving a page) | GitHub issue #22: before, the old stream stayed live. Review of 2026-09-30: asking the page's own world to stop its tracks left a hostile page capturing under a marker that had gone out; a reload ends it whatever the page's scripts do. |
| Password offers | An offer needs a sign-in the person made: the page reports a submit only during their own click or key press (navigator.userActivation), and the main process also needs real input to that page within 5 s, as for filling | GitHub issue #19: a script's requestSubmit() alone made an offer. |
| Leaving a page that asks to be kept | A page with a `beforeunload` handler (webmail with a draft, a half-filled form) asks to be kept once the person has clicked or typed in it. When its tab is about to go elsewhere or reload, the main process asks "Leave this page?" with Leave and Stay (Escape, or closing the box, stays) on the window (main/leave-page.ts, from the page's will-prevent-unload event in main/guests.ts). Test runs open no box: the ask is recorded and answered by the check | Review of 2026-09-30: Electron keeps such a page unless the app says otherwise, and the app said nothing, so typing an address, Back, and Reload did nothing on it, without a word, and a hostile page could hold a tab for good. |
| Page dialogs | Every web page has Electron's safeDialogs on (main/security.ts): after a page's second alert or confirm in a row, the dialog offers to stop them | Review of 2026-09-30: a page that calls alert() without end could only be left by ending the app. |
| Only the shell may ask | The request channels the shell uses (saved data, privacy, the instrument panel, downloads, permissions, saved passwords, tab histories, opening a file) are each registered through one helper, handleFromShell (main/ipc.ts): any sender that is not the app's own shell is answered with a refusal and the handler is not called. Tab snapshots check instead that the asking page hosts the tab it names, and the two one-way messages (close-ready, capture-keys) check their sender themselves | Review of 2026-09-30: the rule was written out by hand in seven handlers; all were right, and the eighth would have been one forgotten line from a hole. |
| When the app cannot go on | A throw during start-up (a full disk, a data folder that cannot be written) shows "HyperSpace 3D couldn't start" with the reason and the data folder, and ends the app, waiting for the history worker to stop first. A shell that crashes is reloaded once; a second crash within a minute shows "HyperSpace 3D has stopped" and ends the app (main/start-up.ts, main/index.ts). Test runs write the message to the log in place of the box | Review of 2026-09-30: a failed start used to leave a process with no window holding the single-instance lock, so every later launch quit at once; a crashed shell left a dead window. |
| History off the main process | GitHub issue #4: history reads and writes run in a worker thread (main/storage/history-worker.ts) with its own connection to hypersol.sqlite (WAL; both connections wait up to 5 s for each other); if the worker fails, the main thread takes over. Schema 3: an FTS5 index with the trigram tokenizer (substring matches as before; under three characters the plain LIKE search) and a history_latest table of each address's latest visit, kept by triggers | Milestone 10. Budgets: with 100,000 visits a search or the recent list answers within 50 ms, and the main process is never held 20 ms (L9). |
| Address bar completion | Milestone 11 (owner, prompt 51, Q1 a). Typing completes the rest of a visited site in place, selected (a whole site's root while no "/" is typed, then pages), and a list shows the best matches from history and bookmarks with "Search ... for" last. Matching runs in the history worker: schema 4 gives each address's latest-visit row a visit count and a key (the address without the scheme or "www.", lower case, indexed for "starts with"); ranking is visits weighted by the last visit's age (1 under 4 days, down to 0.1 after 90). Enter goes to the real address of what the bar shows; removing a row forgets that address's visits | Median of five suggestions with 100,000 visits under 50 ms (about 3 ms warm). |
| Page fit | The tilted page takes the tallest height whose widest fit still reaches both sides of the free area, then that width, centred between the limits (scene-core computePanelLayout). Before milestone 11 it shrank around its centre to fit the near edge, leaving a gap on the far side (owner, prompt 50) | Both sides within 2 px (unit tests at 5, 10, 20 degrees, both directions). |
| View settings | Settings > Appearance and view (Q3 a): how far the page leans (0 to 20 degrees), which way (right or left edge back), room movement (off, subtle 0.5, normal 1 times the parallax), space around the page (compact 16, normal 36, roomy 72 px on the right and bottom, and the left without the rail), "Flat and still" (0 degrees, movement off), and "Default view" (10 degrees, right edge back, normal movement and space; owner, prompt 53) | Milestone 11. |
| Settings layout | Sections listed on the left, one page each (General; Appearance and view; Tabs; Privacy and security; Economy; Instrument panel; Shortcuts; Clear data), and a search across all sections by names and related words that shows the matching groups with their controls (Q2 a). Each group lists its controls' test ids, so a search result, the menu's "Keyboard shortcuts", or a test can bring a control into view | Milestone 11. |
| Shortcuts | One table (shared/shortcuts.ts) of actions and key combinations ("Mod" is Cmd on macOS, Ctrl elsewhere); the person's own combination replaces an action's defaults, saved in settings.json (shortcuts) and checked there: a modifier or a function key, not copy, paste, cut, undo, redo, or select all, and no combination used twice. While Settings waits for new keys, the shell tells the main process (hypersol:capture-keys), which then lets key presses through instead of acting on them. The menus' hints and tooltips follow the table | Milestone 11. |
| Menus closing | The top bar's menus, the site panel, and tab search close on a press elsewhere, on the keyboard moving elsewhere, and when the window loses focus (hud/dismiss.ts). A click in a page never reaches the shell as a press, but it moves the focus to the page's webview, which the focus check sees | Milestone 11 (owner, prompt 50). |
| Preload bundles | The shell's preload and the page preload share no project module (preload/preload-graph.test.ts): a shared module becomes a separate chunk file, which a sandboxed preload cannot load (found 2026-09-26: the shell's bridge failed to load). Page-side password messages live in shared/page-passwords.ts for this reason | Sandboxed preloads load one file. |
| Private tabs | Ctrl/Cmd+Shift+N and the menu: a tab whose page uses an in-memory session (partition "hypersol-private"), with the same shield and readouts, and permission prompts whose choices stay in memory (milestone 9); no history; never saved for "reopen your tabs"; its cookies, storage, and cache are cleared when the last private tab closes; links from it open private; marked on its card, in the top bar, and on its start panel. Site choices made from private tabs (layers view, shield pause) stay in memory, apply to every private tab on that site while one is open, and are forgotten with the last one; zoom set in a private tab is kept the same way, in the shell's memory, and never saved; the back and forward history of a private page that closed or went to sleep is kept in the main process's memory (for a sleeping private tab to wake with) and forgotten with the last private tab (main/tab-history.ts); the shield's pause request names its tab so the main process can tell (GitHub issue #8). "The last private tab" includes blank private tabs, which have no page yet: the shell tells the main process when its last private tab closes, and only then are the private session's data, pauses, and certificates cleared. The main process also clears them itself when the window closes or its shell crashes (every tab goes with it), and a window reopened meanwhile (macOS keeps the app running) waits for that to finish (PR #16 follow-up review). The shell may only attach webviews to the default or this partition | Milestone 8, owner Q3 a. |
| Page tilt | Settings > Page tilt, 0 to 20 degrees, default 10; a --tilt on the command line wins | Less tilt gives sharper text (milestone 1 note). |
| Graphics resets | When the WebGL context is lost, the room stops drawing; when it is restored, it draws again at once and Three.js uploads its textures again (GitHub issue #12). While it is lost, pages are still placed: they follow a resize and a tab switch. A HoloML page's viewer does the same for its scene: once its context is back it makes the light from its surroundings again, asks for its shaders, and draws (review of 2026-09-30) | The room draws only on demand, so a restore must ask for a frame itself. |
| No WebGL 2 | Where Chromium cannot start WebGL 2 (no graphics driver, some virtual machines, WebGL switched off), the room is not drawn and its tab cards take no clicks, but the page (CSS 3D), top bar, and panels work; a notice says "This computer can't draw the 3D room", why, and how to show tabs as a list (hud/room-message.ts). Test mode's --test-no-webgl starts the shell without WebGL (check N7) | Milestone 12 (owner, prompt 60): before, the window stayed empty. |
| HoloML pages | A `.holoml` address or the `model/vnd.holoml` media type marks a HoloML page (main/holoml.ts, through the shield's one onHeadersReceived listener), unless the site sent the answer to be saved (`Content-Disposition: attachment`) or sandboxed it (a `sandbox` directive in its content policy): such an answer is not a HoloML page and is left exactly as sent, so it is downloaded, or shown as text under the site's own policy, with no viewer. A HoloML page is shown as `text/plain; charset=utf-8`, and HoloML's content policy is added beside the site's own policies, which stay, with everything else the site sent (its frame options among them): a page must satisfy every policy, so the stricter one wins. HoloML's policy: scripts only from `hypersol-viewer:` and the page's own site; connections and images from the page's own site, data:, blob:; no forms, no base address, no peer connections (`webrtc 'block'`). The page preload confirms it with the main process, hides the text, and adds the viewer's script (`hypersol-viewer://app/assets/viewer.js`, served from out/renderer only to pages that ask); the viewer draws the scene in the tab's own sandboxed page process with Three.js and its glTF loader. The page keeps its own address in the tab, history, bookmarks, and reopened tabs. The tab in front fills the window flat (room.setFill); zoom and the layers view are off for it. Files from the computer: Ctrl+O, the menu, or a drop; each opened folder gets a random name for this run (`hypersol-file://<name>/<file>`); only that folder and those inside it are served, and only files of the kinds a HoloML page uses (.holoml, .gltf, .glb, .bin, .png, .jpg, .jpeg, .webp, .hdr, .js, .mjs, .ogg, .mp3, .wav); never history, and only the person opens such an address. A file opened from a folder that holds many unrelated files (Downloads, the desktop, Documents, the home folder, or a drive's root) gets the files beside it only, not the folders inside, and its console says why. A local page may go to another file in its opened folder; it may leave for a web address only within 5 seconds of a real click or key press on it, and then without the address's query string and fragment (main/security.ts, decidePageNavigation), so its script cannot send what it read away in them (the address's path is left as written). A dropped file's message comes from a page's preload, and the main process cannot see the drop itself, so it holds the message to what it can know: a web page in one of the shell's tabs, its main frame, one file at a time, a path that names a .holoml file (isAcceptableDrop) | Milestone 14 (owner, prompt 65: Q1 a fill the window, Q2 a models from the page's own site, Q3 a files by Ctrl+O and drop, Q4 a a tagged copy of the parser, Q5 a errors on a card, problems in the console). Nothing from a page runs in a privileged process. Review of 2026-09-30: before, any answer at a `.holoml` address had the site's `Content-Disposition`, content policy, and frame options replaced and was run in the site's origin, which undid the two ways a site makes uploads safe; and a local page's script could read every allowed file under its folder (all of Downloads, say) and go to any web address with what it read. |
| HoloML limits and access | The viewer fetches each model and every file its glTF names itself (viewer/budget.ts), counting bytes as they arrive: one file 32 MB, a page's models, sounds, and pictures 128 MB in all; a model or picture left out stops counting at once. Triangles (each mesh as often as the scene uses it) and picture sizes (PNG, JPEG, WebP headers) are read from the files before anything is decoded: 2 million triangles in all, pictures (a model's, a material's, and the surroundings') up to 4096 by 4096. Also 2 MB of page text, 10,000 elements, 64 model files, and 30 seconds a file. Since the review of 2026-09-30 the limits also cover what files become, not only their bytes: the page's pictures, decoded, may come to 134,217,728 pixels in all (eight of the largest size); its sounds, decoded, to 600 seconds in all (they are decoded one at a time); 32 lights that shine from a place or a direction, those in model files included (later ones are left out), 4 of them casting shadows (later ones light the scene without shadows); and a place, a size, or a scale beyond 1,000,000 (metres, or times) falls back to its default, with a line in the console (viewer/values.ts, REACH). What each load holds of the page's totals (bytes, triangles, pixels, seconds) is kept in one place, its claim (budget.ts, Claim), and given back whole when the load fails, is refused, or is let go; a file that arrives and cannot be read is not fetched again on the same page; a model's triangles are counted again once it is decoded, the copies the file itself asks for included. A page without scripts cannot hold its tab either: counting a model file's triangles, walls, walking, and wrapping a panel's text are bounded for any page. What crosses a limit is left out and marked with a red box, and a notice (role status) says what and why. Esc or the top bar's stop button stops pending loads (the page tells the shell it is busy through its preload); leaving the page releases the scene. A hidden outline in the page lists the title, links, and named things (models, groups, labels) in page order: Tab moves through it and outlines the object in the scene; focus moves to the next item if its object is left out. The text view (top-bar button, Ctrl+Shift+V) shows that outline as a plain page. With reduced motion, animations show their end state | Milestone 15 (owner, prompt 77: Q1 a the limits, Q2 a leave out and mark, Q3 a reduced motion and a text view, Q5 a links and named things). The limits keep one page from exhausting memory; the browser's own controls are in another process. |
| Scene inspector | With a HoloML page in front, the instrument panel's right column gains a Scene part: the objects as a tree (the first 2,000; the rest counted), the selected one's line of text, bounds, position, rotation, scale, triangles, and pictures, a pick button (a click in the scene selects rather than follows a link), and every problem and left-out model with line and column. The main process reads it once a second with executeJavaScript, only for pages it marked as HoloML, and keeps only known fields within fixed sizes (parseSceneReadout in shared/inspect.ts). What it calls is `window.__holoml`, which the viewer puts on every HoloML page, frozen: in a normal run it holds only what this part uses (`scene`, read-only; `select` and `pick`, which act on the page's own scene alone). In a test run it also holds the read-only hooks the end-to-end checks use: the page's preload, which the page cannot touch, marks the viewer's script element when HYPERSOL_TEST=1 is in its environment, and the viewer reads the mark and removes it before any script of the page runs (viewer/main.ts, preload/holoml.ts) | Milestone 15 (Q4 a, one place for developer tools). The page's facts are checked, never trusted; nothing is stored. Review of 2026-09-30: before, about forty test hooks were on every HoloML page in every run, where the page's own scripts could read and call them. Still open: the page preload reads HYPERSOL_TEST itself, so this mark does not yet depend on the app being unpackaged as the main process's test mode does (section 11); TODO.md lists it as a check for the installers. |
| HoloML showroom | HoloML's showroom lives in the holoml repository (examples/showroom: the hall, a page per car and colour, an about page; Kenney's Car Kit cars, CC0, split into Paint, Glass, Lights, Trim, and Wheels by tools/prepare-cars.mjs; hall and plinths made by a script), published by GitHub Pages at https://srajpal.github.io/holoml/showroom/. The start panel's "Try HoloML" section links to its index.holoml; nothing is fetched until the link is clicked. `pnpm holoml:sync` copies the showroom byte for byte into tests/fixtures/holoml/showroom from a tag, branch, or commit (`--examples <ref>`, from milestone 17 every example; `--showroom` still works), recorded in packages/holoml/SOURCE.json with each file's hash; the copy test checks it. The README's screenshots (`pnpm screenshots:readme`; four since prompt 99: Harbour Loft since prompt 118, the sofa studio before, Blockworld, a made-up sample page in layers, and the instrument panel) are served locally too. In development runs (`pnpm dev`) the viewer's scheme passes every request to the renderer's dev server (the entry by its file path, /@fs/...), so the viewer and the modules it imports load as the built viewer does | Milestone 16 (owner, prompt 81: Q1 a GitHub Pages and the start panel link, Q2 a Kenney's Car Kit, Q3 a the full site, Q4 a gaps as holoml issues #8 to #11, Q5 a the README screenshot). |
| Page layer never scrolls | The CSS layer that holds the pages is `overflow: clip` (styles.css). With the 3D renderer's own `hidden`, Chromium scrolled the layer to bring a focused page into view, and the page was drawn away from where the room placed it | Found in milestone 16 (a HoloML page opened from the start panel sat 89 pixels left, over the tab rail); m16.e2e.ts checks the drawn page matches the room's placement. |
| HoloML 0.2 in the viewer | A page's version is read once (viewer/versions.ts), and each feature asks whether the page is at least 0.2, so a later version keeps what the earlier ones have; a version the viewer does not know, or a page that names none, is refused with a card and not drawn (HoloML's specification, section 11; review of 2026-09-30: such a page was drawn as 0.1). A 0.2 page's scripts (`script` in `head`) run as modules from the page's own site, after the scene is built, in the page's own sandboxed process; the content policy allows `'self'` scripts besides the viewer. They get one object, `holoml` (viewer/api.ts): handles on elements ("things"), checked arguments, add and remove (holoml.add parses and checks HoloML text and builds it like the page), click, key, and frame events, aim() under the crosshair, the viewer's place, the background. Screen text (`hud`) is page DOM in the corners (role status), shown in the text view. Walls and gravity: viewer/physics.ts, a 0.6 by 1.8 m walker against the solid models' boxes in a 2 m grid, rebuilt when solid things change. Lights' position, intensity, and colour, and the background, can be animated; in a 0.2 page with ambient lights, the soft light from the surroundings (the viewer's own, or the page's panorama) follows them, so night can be dark. Walk mode (every version) turns with the left and right arrows and looks up and down with Page Up and Page Down, so a page with a crosshair can be used from the keyboard alone | Milestone 17 (owner, prompts 85 and 86: Q1 a the scene API, Q5 a the 0.2 draft). A script that never stops holds only its own page's process; the browser's controls are in another. |
| Sound on HoloML pages | `sound` files are fetched within the page's limits like models (budget.ts) and played with Web Audio (viewer/sound.ts), only after the first trusted click or key on the page. The browser also keeps a HoloML tab muted until then: the page's preload, in its own world where page scripts cannot reach, tells the shell of that first input (hypersol-holoml-state, activated), and the shell's tab view keeps this gate apart from the tab's own mute | Milestone 17 (owner, prompt 85, Q5 a: as browsers require for web pages). Holding the viewer's own sounds alone would not stop a page's script from playing sound. |
| Drawing many models | A model file is loaded once (a template); a model without its own materials or animation is an instance of the file's meshes (InstancedMesh, viewer/instances.ts), so thousands of blocks are a few draw calls; others get clones. Instances follow their holders' world matrices when told they moved; picking maps an instance back to its element. The limit counts model files (64), and each model drawn counts its triangles | Milestone 17. Blockworld: about 1,200 blocks in 14 draw calls. |
| HoloML examples section | A dialog (hud/examples.ts) with a card per example site (renderer/examples.ts: name, line, what it shows, picture), Open and Source, and links to the holoml repository and its specification; opened from the start panel's "Try HoloML", the menu, and Ctrl+Shift+E (a remappable shortcut). The pictures are part of the browser, made by `pnpm screenshots:examples` from the local copies; nothing is fetched until a link is chosen. `pnpm holoml:sync` copies every example into the test fixtures | Milestone 17 (owner, prompt 85, and prompt 86, Q2 a; the repository links, prompt 88). |
| Walking speeds and sliders | HoloML 0.2 `speed` and `turn-speed` on the viewpoint set walk mode's pace (controls.ts: 2.2 metres a second and 90 degrees a second unless the page says; looking up and down from the keyboard goes as fast as turning; Shift still doubles walking); `holoml.viewer.speed` and `turnSpeed` change them while the page is open. A `slider` is the page's own `<input type="range">` in its screen corner, labelled by its text, so the mouse, touch, the keyboard, and screen readers use it as on any web page, Tab reaches it after the scene's outline, and the text view shows it; moving it sends the page's scripts `change` (scene.ts, api.ts). While it has the keyboard it keeps only its own keys (keptByControl in controls.ts); other keys still walk and reach scripts | Milestone 18, first part (owner, prompts 91 and 92: walking felt slow; a speed setting and a slider in Blockworld, whose code shows how). A native control needs no new accessibility work and cannot be mistaken for a click in the scene. |
| Shadows, pictures, choices, and surroundings | HoloML 0.2's second part (scene.ts, pictures.ts). Shadows: a light marked `shadows` casts soft shadows (Three.js shadow maps, PCF, 2048 pixels for the sun, fitted each frame to the models marked `shadows`, which cast and receive them); drawing in software (no graphics card) they are left out and the console says so. Material pictures: `map`, `normal-map`, and `roughness-map` on `material` and `option`, fetched within the limits from the page's own site, each address once, decoded with createImageBitmap, as glTF's own (colour in sRGB, the others as data), tiled by `repeat` (which tiles the model's own pictures too). A `choice` is a fieldset of the page's own radio buttons in its corner (the arrow keys move between options, screen readers name the group by its label); picking an option gives the target model's named material that option's look, made once from the material's own look and kept; every option's pictures load with the page, so a pick shows at once; scripts hear `change` and read and set `value`. Models a choice changes are drawn as their own copies, not instances. `environment` on the scene: an HDR (HDRLoader, part of three) or PNG or JPEG panorama from the page's own site, turned into the scene's environment light (PMREM) in place of the viewer's own, and dimmed with the page's ambient lights like it | Milestone 18, second part (owner, prompt 98: Q1 a the declarative choice, Q4 a the environment, Q5 a shadows left out in software). No new package; the limits count every picture. |
| Panels, click actions, places, fades, sky, and plan | HoloML 0.2's third part (scene.ts, panels.ts, pictures.ts). A `panel` is a canvas picture of its words, wrapped to its width at about 1,000 pixels a metre (at most 4,096 a side), on a flat unlit board, with a plain back; its words are also in the page (Find in page) and in the outline after its button. Click actions: an `animate` or `sound` with `begin="click"` joins its trigger (its `trigger`, or the animation's target); a click on the trigger, or on what it holds (the innermost trigger wins), runs them, a toggle forward and then back from where it is; the pointer and the outline show triggers; each trigger's button takes the place of its item in the outline (after a panel's), and Enter and Space on it do the same and tell scripts of a click without a point (keptByControl keeps those keys for it). Places: in a page with several viewpoints, the address's `#name` picks the start (else the first), and "Go to" buttons and links to `#name` go through the address, so Back returns; going to a place fades out and in over 180 ms. Leaving for another HoloML page of the same site fades out over 260 ms; a page opened that way (a same-site HoloML referrer, a new navigation) starts dark and fades in once its scene is drawn with nothing left to load, or after 4 s. `sky`: the page's panorama as the scene's background, dimmed with its ambient lights; one file used as sky and surroundings is fetched and counted once; PNG and JPEG panoramas are decoded flipped, since WebGL does not flip an ImageBitmap. `plan`: the page's picture in its corner, fetched and size-checked within the limits, with a marker placed each frame from the camera's position and direction | Milestone 19 (owner, prompt 114: Q1 to Q5 a). No new package. |
| Loading by area and stand-ins | HoloML 0.2's fourth part (scene.ts, budget.ts, pictures.ts, api.ts). A `group` with `load="near"` is an area: after the view is set up, and before each frame is drawn, the viewer measures from the camera to each area's place and loads its models once within its `near` (10 m unless the page says), lets them go beyond 1.5 times that, and lets go first so what comes in has room; a model loads while every area around it is in. Areas within reach of the start load with the page, so `holoml.ready` waits for them only. A model file (a template) and a material's picture count their users: the last model let go releases its bytes and triangles from the counts and its meshes, materials, pictures, and decoded images from memory, and a pool of its instances goes with it; a load that finishes after its model was let go is dropped. What would pass the page's totals (bytes, triangles, 64 files) waits instead of being left out, and tries again when an area is let go; a model left out for another reason is tried again the next time the viewer comes near. A model removed by a script releases its share but leaves its file loaded, as before. A `stand-in` is loaded with the page into a holder inside its model's, drawn plain (an instance where it can be), counted like a model, solid and casting shadows as the model, and a click on it is a click on the model; it shows while the model is not loaded. Scripts read `loaded` (a model's file; a group's models near enough to load, all loaded or left out) and hear `load` when an area's models are all in and when it is let go. The inspector shows a waiting model as waiting, not as a problem | Milestone 20 (owner, prompt 120: Q1 to Q5 a, the recommendations; loading by area from prompt 87). No new package. |
| Water, sounds from a place, and animation speed | HoloML 0.2's fifth part (water.ts, sound.ts, scene.ts, api.ts). `water`: the viewer adds two pieces of shader code to every model material as it is compiled (onBeforeCompile, with its own program key), gone over again whenever models load or change: each vertex's place in the world (after skinning and instancing), and, after the colours reach the screen's colour space (as three.js does fog), a mix into the water's colour by the length of the way from the eye to the point that lies inside the water's box (a slab test), divided by `clarity`. With `caustics`, lit materials get light added before tone mapping: a net of soft, wavy threads (the edges of cells in a tiling picture of 256 by 256 pixels that the viewer draws once, written for this; nothing copied), sampled twice at different sizes as the two drift past each other, strongest on faces turned up to the surface, fainter with depth, and as bright as the page's lights that shine from a place allow (the pattern computed in the shader took seconds to compile on Windows, for each material); it moves with the frames (keeping the scene drawing), holds still with reduced motion, and is left out drawing in software, with a console message, as shadows are. Panels and labels (text to read), the background, and the sky are left as they are. A sound with a `position` is a marker in its parent (so it moves with a group) and is played through a Web Audio panner (equal power, linear distance: full within 1 metre, silent from its `range`); the listener follows the camera each frame while a placed sound exists; two analysers on the panner's left and right give the page's hooks each ear's level. A model's `animationSpeed` is its animation mixer's time scale | Milestone 21 (owner, prompt 122: Q4 a the water element, Q5 a sounds from a place in 0.2, Q3 a the fish moved by scripts). No new package. |
| Shaders, and HoloML pages behind other tabs | New materials' shaders compile without blocking the page (three.js's compileAsync, with KHR_parallel_shader_compile where the graphics card has it): when models arrive or materials change, the viewer asks for them all at once and keeps the last frame on the screen until they are ready, keeping where everything is current meanwhile for clicks. A HoloML page in a tab behind another is told so by the shell (room.ts, then the tab view, the page's preload, and the viewer: "behind" and "in-front" on the HoloML command channel), since a tab hidden by style is still seen by Chromium, which only slows its frames: behind, nothing that moves asks for frames (animations, the water's light, a script's frame handler), and a change from outside a frame still draws once, for the tab's card | Milestone 21: the aquarium's shaders took 3.7 s of the page's main thread one after another (on the screen after 4.9 s; now ready in 1.6 s and drawn in 2.8 s, check X5), and it drew about a frame a second behind another tab. No new package. |
| The browser and a HoloML page's viewer | The shell's commands to a HoloML page (stop, the text view on and off, behind and in front; the preload also accepts pick-on, pick-off, and select:<index>, which nothing sends yet) reach the page's preload from the tab view (hypersol:holoml-command) and go on to the viewer over a message channel (a private two-ended line between two scripts); the scene's state (loading, the text view, drawn) comes back over it and on to the shell (hypersol-holoml-state). The viewer asks for the line as it starts, before any script of the page exists; only the first asking is answered, and the page's scripts run once the line is there. A command that comes before the viewer has asked waits for it. Messages on the page's window are neither commands nor state (viewer/main.ts, preload/holoml.ts) | Review of 2026-09-30: both went as messages on the window, which a page's script can post: "in front" defeated the rule that a hidden tab draws nothing, and a script could tell the shell its scene was drawn or loading. |
| HoloML drawn in software | Where Chromium draws in software (no graphics card: some virtual machines and remote desktops, GitHub's machines), the viewer draws the scene with half as many pixels each way and without smoothed edges (no anti-aliasing), and says so once in the console; shadows and the water's moving light are left out there, as before (viewer/scene.ts) | Owner, prompt 135 (the review's recommendation). Measured in the review with the ocean tunnel: 1.0 frame a second on GitHub's Linux machines before; 3.0 in the Linux container on this computer with the change. |
| The text view and a still walker | In the text view the scene is not shown: it takes no keys and no pointer and draws nothing, and the window itself scrolls the text, so the arrow keys, Page Up, Page Down, and the space bar scroll it (viewer/controls.ts, paused). A walk page with gravity whose walker stands still asks for no frames. A thing a script hides takes no click and no link and stops no walker, whether it is drawn as an instance or as its own copy. A sound removed while its file is decoded never plays | Review of 2026-09-30: the hidden scene took the keys and kept drawing; a page with gravity never went idle; hidden things could still be hit; a removed sound played and could not be stopped. |
| Window frame, reconsidered | Standard OS frame kept | Considered in milestone 6: a custom frame would lose native dragging, snapping, and accessibility; the theme now sets the frame's light or dark scheme. |
| Bookmarks and history | SQLite through Node's built-in node:sqlite (owner decision 2026-09-25, prompt 20) | Fast search over thousands of rows; standard for browsers. Built into Electron's Node, so no native module and no extra package. |
| Deleted means overwritten | Every connection to hypersol.sqlite is opened with SQLite's `secure_delete` on (main/storage/scrub.ts), so a deleted row's text is overwritten with zeros in the file, where SQLite otherwise only marks the space as free. After a deletion the person asked for (a visit, every visit to an address, "Clear all history", a saved sign-in, clearing the sign-ins, a site taken off the "never" list) the write-ahead log (the file beside the database where changes wait before they are written into it) is written into the database and emptied, so the text is not left there either. Known limit: after single visits are deleted, the history search index can still hold three-letter pieces of their addresses and titles (the trigram index marks entries as deleted and removes them later); "Clear all history" empties the index. The operating system or the drive may keep older copies of the file; the browser cannot reach those | Review of 2026-09-30: "Clear all history" deleted the rows and left their text in the file. A unit test reads the file's and the log's bytes after each kind of deletion (storage/scrub.test.ts). |
| Address bar: what it shows | While the keyboard is elsewhere, the bar shows the tab's address with the end of its host always in view: when the scheme and host do not fit, labels are left out from the host's left, never its right (`https://…google.com.long.evil.example/`), keeping at least the site's own name; a user name and password in the address are never shown. The whole address shows when the bar takes the keyboard. Left unedited, it shows where the tab is now when it loses the keyboard. An address typed stays in the bar while it loads (renderer/url.ts, displayAddress; hud/toolbar.ts) | Review of 2026-09-30: the raw address was shown from its left, so a long host could show a trustworthy-looking start and hide whose page it was. |
| Access in the shell | The screen reader's list of tabs keeps its buttons, and the keyboard on them, as tabs change; an error card is an alert named by its heading; About and the HoloML examples keep Tab inside and put the keyboard back where it was when they close (hud/dialog-focus.ts); the arrow keys, Home, and End move through the top bar's menus; text being composed with an input method (the way languages such as Japanese and Chinese are typed, several key presses to a character) is not completed in place, and its Enter loads nothing; Escape in the shell stops a loading page once nothing else is open for it to close. Switching panels runs the open panel's own close, so a password shown in the Library is hidden again and a shortcut waiting for its new keys stops waiting | Review of 2026-09-30 (the shell's findings R1 and R7). Not checked with a screen reader or a real input method: both are on the roadmap (TODO.md, milestone 27). |
| UI widgets (address bar, menus) | Lit web components | Tiny, standards-based, no framework lock-in; themed with CSS variables. |
| Build | electron-vite (Vite) now; electron-builder planned for the installers (milestones 28 and 29; not yet installed) | Fast dev reload; installers for Windows, macOS, Linux. |
| Toolchain | Node 22.13 or newer; pnpm 12.4.1 pinned in package.json (`packageManager`, with the pnpm version recorded in the lockfile); installs use `--frozen-lockfile` | Reproducible installs (GitHub issue #5). |
| Tests | Vitest (unit), Playwright (Electron end-to-end); `pnpm test:linux` runs them in a Docker container that copies GitHub's Linux machines (tests/linux/, prompts 103 and 104). The automatic builds (.github/workflows/ci.yml) run on Windows and Linux for every pull request and every push to main, the end-to-end checks in four parts side by side on each system, with a last job, "All checks", that passes only when every part has; a change to documents only (the `*.md` files at the top and the docs folder, which no check reads) skips the parts. Section 11 has the details | Standard, cross-platform. The container finds Linux problems on this computer; the automatic builds on GitHub stay the check a pull request is merged on, and the rule on main names "All checks" alone, so it needs no change when the parts do. |
| Repos | hypersol-hyperspace-3d (browser; renamed from hypersol-websurfer-3d on 2026-09-26), holoml (language) | Each useful on its own. HoloML's packages are not published to npm: the browser keeps a copy of the parser and checker (packages/holoml), made from the holoml repository by `pnpm holoml:sync` and checked file by file against the hashes in its SOURCE.json. |
| License | Apache 2.0 both; spec text also CC BY 4.0 | Per brief. |

## 5. Parts (browser repository)

pnpm monorepo. Package names use the @hypersol scope.

```
hypersol-hyperspace-3d/
  README.md, BRIEF.md, ARCHITECTURE.md, TODO.md, HANDOFF.md, PROMPTS.md,
  AGENTS.md (CLAUDE.md imports it), CHANGELOG.md, CONTRIBUTING.md,
  SECURITY.md, CODE_OF_CONDUCT.md, THIRD-PARTY.md
  LICENSE, NOTICE, AUTHORS     Apache 2.0, its notice, and the authors
  package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.base.json,
  eslint.config.js
  vitest.config.ts             the unit tests; vitest.e2e.config.ts: the
                               end-to-end checks and their four parts;
                               vitest.shots.config.ts,
                               vitest.readme.config.ts, and
                               vitest.examples.config.ts: the screenshots
  .github/                     workflows/ci.yml (the automatic builds),
                               dependabot.yml (weekly updates proposed for
                               the packages and the actions), the issue
                               and pull request templates
  .editorconfig, .gitattributes, .nvmrc
                               editor settings, Unix line ends, Node 22
  apps/
    browser/                   the Electron app
      electron.vite.config.ts
      viewer-deps.mjs          what the viewer imports from Three.js's
                               examples, for development runs
      src/
        main/                  main process
          index.ts             app start, single instance, window, app menu,
                               tab snapshot requests
          ipc.ts               handleFromShell: request channels that
                               answer only the shell
          start-up.ts          what to say and do when the app cannot
                               start, or its shell crashes twice
          launch-options.ts    command-line options (section 11)
          profile-folder.ts    the data folder, kept from before the rename
          guests.ts            per web page: shortcuts, new windows,
                               right-click menu, favicons, history, leaving
          shortcuts.ts, popups.ts, context-menu.ts
                               the rules behind those, unit tested
          favicon.ts           favicons fetched within limits
          leave-page.ts        "Leave this page?"
          security.ts          webview lock-down, allowed addresses, a
                               page's own navigations, no client
                               certificates, dropped files
          permissions.ts       site permissions (milestone 9): what is
                               asked, what is refused, Block
          passwords/           index.ts (offers, filling, the shell's
                               requests), vault.ts (the saved sign-ins,
                               encrypted with the system keychain)
          tab-history.ts       closed and sleeping pages' back and forward
                               history (milestone 10)
          holoml.ts            HoloML pages: recognising them, their
                               headers and content policy, the viewer's
                               script, files opened from the computer
                               (milestone 14)
          downloads.ts         downloads to the Downloads folder, the list
          test-hooks.ts        logs for the end-to-end tests (test runs only)
          inspect/             monitor.ts (per-tab requests, console,
                               certificates; unit tested), index.ts (session
                               events, metrics, the shell's requests, the
                               Scene part)
          privacy/             index.ts (the session's request listener,
                               element hiding answers, the shell's privacy
                               requests), shield.ts (per-tab decisions and
                               counts), own-requests.ts (the app's own
                               requests, which the shield leaves alone),
                               filters.ts (starter and saved lists,
                               refresh), filters-build.ts (builds the
                               engine with the app's own page scripts,
                               checked by SHA-256), filters-worker.ts
                               (runs that off the main thread), dns.ts
                               (encrypted DNS mode and reachability check)
          storage/             database.ts (node:sqlite bookmarks, history,
                               sign-ins, schema version), history.ts (the
                               history queries), history-backend.ts and
                               history-worker.ts (history in a worker
                               thread), scrub.ts (connection settings;
                               deleted text overwritten), settings-file.ts
                               (settings.json, session.json), files.ts
                               (write through a temporary file),
                               service.ts (answers the shell's requests)
        shared/
          commands.ts          messages between main and the shell; the
                               bridge's type
          data.ts              saved-data requests and their checks
          settings.ts          settings, search engines, their checks
          shortcuts.ts         the one table of shortcuts, and the checks
                               on the person's own keys
          privacy.ts           privacy requests (shield, lists, DNS) and checks
          layers.ts            layers view messages between shell and page
          inspect.ts           instrument panel requests and checks
          downloads.ts         download requests, safe unique file names,
                               which files are programs
          permissions.ts       site permissions: kinds, choices, prompt answers, checks
          passwords.ts         saved password requests from the shell, offers
          page-passwords.ts    password requests from a page's preload (kept
                               apart from passwords.ts, see Preload bundles)
          tabs.ts              restoring a closed or sleeping tab's history
          page-state.ts        typed-in-a-form and capture reports from the
                               page preload
          holoml-page.ts       HoloML pages: channels between the page
                               preload, the main process, and the shell;
                               the viewer's and local files' schemes
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
          form-state.ts        tells the shell when a form has typed text
                               (milestone 10)
          capture.ts           counts live camera, microphone, and screen
                               tracks, so a capturing tab stays awake
          page-state.ts        sends both of those to the shell
          holoml.ts            hands a HoloML page to the viewer, carries
                               the shell's commands and the scene's state
                               over a private line; opens a dropped
                               .holoml file (milestone 14)
        viewer/                the HoloML viewer, run inside a HoloML page
                               (milestone 14): main.ts (reads and checks the
                               page, the error card, the outline and text
                               view, runs a 0.2 page's scripts), scene.ts
                               (Three.js scene, links, animation, what the
                               inspector reads), controls.ts (orbit and
                               walk), values.ts (attribute values),
                               versions.ts (the versions it reads),
                               budget.ts (counted loading and the limits,
                               milestone 15); milestone 17: api.ts (the
                               scene API), physics.ts (walls and gravity),
                               instances.ts (drawing many models),
                               sound.ts; milestone 18: pictures.ts (a
                               material's pictures and the panorama of
                               the surroundings; since milestone 19 the
                               sky and a floor plan too); milestone 19:
                               panels.ts (panels' wrapped text);
                               milestone 20: loading by area and
                               stand-ins (scene.ts), what is let go
                               (budget.ts, pictures.ts); milestone 21:
                               water.ts (the water's haze and moving
                               light), sounds from a place (sound.ts)
        renderer/              the 3D shell (one Chromium page)
          index.html, main.ts, styles.css
          app.ts               controller: tabs, pages, room, top bar, commands
          data.ts              the shell's saved-data requests
          scene/               room.ts (Three.js room, camera, cards, switch
                               animation, input), tab-view.ts (one tab's page,
                               shimmer, error cards), tab-card.ts,
                               start-panel.ts
          hud/                 Lit components: toolbar.ts (nav buttons,
                               address bar, bookmark star, menu, loading
                               strip), tab-strip.ts (tabs as a list),
                               tab-search.ts, library.ts, settings.ts,
                               about.ts, examples.ts (the HoloML examples),
                               shield.ts (count and popover),
                               site-panel.ts, prompts.ts (permission
                               prompts and password offers), notice.ts
                               (the download notice), arm.ts (the half
                               second before either takes a click),
                               find-bar.ts, downloads.ts,
                               theme-button.ts (theme switch),
                               controls.ts (dial, meter, readout, switch),
                               instruments.ts (the instrument panel),
                               room-message.ts (the notice without WebGL
                               2), dismiss.ts (menus that close),
                               dialog-focus.ts (Tab kept inside dialogs),
                               panel-styles.ts
          examples.ts, examples/
                               HoloML's example sites and their pictures
          zoom.ts              zoom steps (unit tested)
          instruments.ts       fills the instrument panel while it shows;
                               inspect-format.ts: its wording (unit tested)
                               Tabs are 3D cards under scene/, or a list
                               (hud/tab-strip.ts).
          state/               tabs.ts (the tab list and focus),
                               closed-tabs.ts (tabs to reopen), sleep.ts
                               (which tabs may sleep)
          url.ts, load-errors.ts
                               address-or-search, how the bar shows an
                               address, the site button's marker; error
                               card wording
          themes/              applies @hypersol/themes values to CSS
                               variables and Three.js materials
      resources/filters/       lists.json (which lists, from where),
                               starter.bin and starter.json (the starter
                               copy, with its checksums), NOTICE.md
                               (sources and licences), GPL-3.0.txt (the
                               licence the starter copy is passed on under)
      scripts/filters-update.mjs
                               rebuilds the starter copy (pnpm filters:update)
  packages/
    scene-core/                @hypersol/scene-core: room layout math,
                               PagePanel interface, camera rig. No Electron
                               imports, so it can be unit tested and reused
                               by HoloML rendering later.
    themes/                    @hypersol/themes: theme schema, the two
                               built-in themes (nebula.ts, daylight.ts),
                               their tokens as CSS variables and the
                               contrast helpers (tokens.ts)
    holoml/                    @hypersol/holoml: a copy of HoloML's parser
                               and checker, and its scene API in Web IDL,
                               from the holoml repository (the tag or
                               branch and the commit are in SOURCE.json,
                               with each file's hash), made by sync.mjs
                               and copies.mjs (pnpm holoml:sync); a test
                               checks the copy
  docs/
    privacy.md                 what is blocked, what is stored, what is fetched
    progress.md                each milestone, with screenshots
    name-checks.md             trademark and file extension checks
    screenshots/               progress screenshots, one folder per
                               milestone, and the README's four
    branding/, history/        logo concepts; the 2001 to 2003 concept screen
  tests/
    e2e/                       Playwright drives the built app: m1 to m22
                               (one file a milestone; there is no m13),
                               issues-17-to-22, and the review of
                               2026-09-30's four files (review-134-main,
                               -shell, -viewer, -harness); harness.ts
                               (launching, waiting, input) and
                               fixture-server.ts (the local test site)
    fixtures/                  sample pages served from 127.0.0.1;
                               holoml/showroom/, blockworld/, sofa-studio/,
                               harbour-loft/, sneaker-store/, and aquarium/
                               are HoloML's examples, copied by pnpm
                               holoml:sync (milestones 16 to 21); readme/
                               is the README's sample page
    screenshots/               capture.shots.ts (pnpm screenshots),
                               readme.capture.ts, examples.capture.ts
    linux/                     Dockerfile and run.mjs (pnpm test:linux)
```

## 6. Parts (HoloML repository, created alongside)

```
holoml/
  SPEC.md                      the language: version 0.1 (milestone 13),
                               and 0.2, which grew with the example
                               sites (milestones 17 to 21); from
                               milestone 22 in the form of W3C
                               specifications (0.2's second edition;
                               its third, with corrections, after the
                               review of 2026-09-30), with an index
                               made from the code
  CHANGELOG.md                 what changed with each release (since the
                               review of 2026-09-30)
  spec/                        its grammar (milestone 22): the syntax in
                               ABNF (by hand), the structure in RELAX NG
                               (made from the checker's table, pnpm
                               grammar:update), the scene API in Web IDL
  docs/                        the guides (milestone 22): tutorials,
                               how-to guides, reference (elements, API,
                               and codes made by pnpm reference:update),
                               and explanation; every example checked
  site/                        build.mjs (pnpm site:build, with marked):
                               the published site from SPEC.md, docs/,
                               and examples/, checking every link
  LICENSE, LICENSE-SPEC        Apache 2.0 and CC BY 4.0
  packages/
    parser/                    @holoml/parser: text to a tree with line and
                               column; strict syntax; no dependencies
    schema/                    @holoml/schema: the element and attribute
                               rules as data (rules.ts), and check(), which
                               lists every problem with its place
  conformance/                 valid/, syntax-errors/, problems/: each
                               .holoml with the .expected.json any reader
                               must give (pnpm conformance:update writes
                               them, for review)
  examples/showroom/           the showroom (milestone 16): a hall of five
                               cars, a page per car and colour, an about
                               page, index.html for other browsers; tools/
                               writes the pages, hall, and cars (from
                               Kenney's Car Kit, CC0)
  examples/blockworld/         Blockworld (milestone 17): a small block
                               game in HoloML 0.2, its script game.js;
                               tools/ writes the blocks (Kenney's Voxel
                               Pack, CC0), copies the sounds (Kenney's
                               sound packs, CC0), and makes the birds and
                               crickets
  examples/sofa-studio/        the sofa studio (milestone 18): a shop page
                               with choices of fabric and wood, shadows,
                               and a studio's light (Poly Haven, CC0)
  examples/harbour-loft/       Harbour Loft (milestone 19): a flat to tour,
                               with panels, doors and lamps, places, a
                               sky, and a floor plan (Poly Haven, CC0)
  examples/sneaker-store/      the sneaker store (milestone 20): a shoe in
                               ten colourways on shelves loaded by area
                               (Khronos's sample shoe, CC BY 4.0)
  examples/aquarium/           the ocean tunnel (milestone 21): 30 fish
                               swum by aquarium.js through water, with
                               bubbles and feeding; tools/ fetches the
                               fish (CC BY 4.0 and CC0) and Poly Haven's
                               rocks (CC0), gives the fish without one a
                               swim, and makes the tank and the sounds
  examples/tools/              what the examples' tools share: sounds,
                               shapes, pictures, and the download cache
  .github/workflows/ci.yml     lint, types, and tests on Windows and Linux
  .github/workflows/pages.yml  builds and publishes the site with GitHub
                               Pages, only after lint, the type check,
                               and the tests pass: the home page at
                               https://srajpal.github.io/holoml/, the
                               specification at /spec/, the guides
                               under /docs/, and each example site at
                               its own address (without its tools/)
```

Decisions (milestone 13, owner prompt 63): files are `.holoml`, served
as `model/vnd.holoml`; the syntax is strict (the first mistake stops the
parse, with its line and column); version 0.1 covers everything
milestone 14 shows; the packages stay in the repository, unpublished.
Tests hold SPEC.md and the code together: every code, element, and
attribute in the code must be in SPEC.md with an example and in a valid
sample.

Decisions (milestone 22, owner prompt 128, Q1 to Q7 a): the
specification follows W3C's conventions (BCP 14 requirement words,
conformance classes, a processing model, the four considerations, an
IANA template for `model/vnd.holoml`, references, an index, and the
changes), without going through a standards body; the syntax is given in
ABNF and the structure in RELAX NG made from the checker's table; the
guides follow Diataxis; the site is built by one script with one
development package, `marked`, and published by holoml's Pages workflow;
the missing features found by the feature check became milestone 23,
HoloML 0.3; the media type is not registered with IANA; the
clarifications go into 0.2's text as its second edition, tagged v0.2.1
at the end, on the owner's go. Tests keep the documents true: the
grammar, the Web IDL and the scene API's tables, the reference pages,
the index, every HoloML example in the guides, and the site's links,
headings, pictures' text, keyboard access, and colour contrast.
HyperSpace 3D's copy of HoloML includes the Web IDL, and its own test
holds the viewer's API to it.

After the review of 2026-09-30 (prompts 134 and 135): the specification
is 0.2's third edition and holoml's packages are at 0.2.2, with a change
log. The language is the same; the checker is stricter in places and no
longer slow on a long run of digits, and the aquarium's turtle is
replaced (THIRD-PARTY.md). Neither v0.2.1 nor v0.2.2 is tagged yet; the
newest tag is v0.2.0. HyperSpace 3D's copy (packages/holoml/SOURCE.json)
names the branch and commit it was made from.

## 7. Data flow

1. The user types in the address bar or the start panel. The shell
   decides between an address and a search (DuckDuckGo) and loads it in
   the tab's webview.
2. Chromium loads the page. The shield (main/privacy/) checks every
   request from a web page against the filter lists and blocks listed
   ones, WebSocket connections and requests that no tab made (a service
   worker's) among them; the page preload asks for element hiding; Quad9
   resolves the host name over DNS over HTTPS.
3. The webview's events update the tab list, which updates the address
   bar, loading strip, title, and card.
4. The main process sends the shell what only it sees: shortcut key
   presses, new-tab requests from pages, and favicons (each shown to the
   shield before it is fetched).
5. Shortly after a page settles, and when switching away from it, the
   shell asks the main process for a snapshot (only of its own tabs) and
   paints it onto the tab's card. A HoloML page settles before its models
   arrive, so its viewer also says when it has drawn the scene with
   nothing left to load and the view still (after it is ready, and after
   each later loading, such as a script's models), and the shell takes the
   picture again then (prompt 89).

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
- inspect: the instrument panel's readouts, and the Scene part of a
  HoloML page (shared/inspect.ts);
- downloads: the list, and open, show in folder, cancel, and clear
  (shared/downloads.ts);
- permissions: prompt answers and the site panel (shared/permissions.ts);
- passwords: save offer answers and the Library's Passwords tab
  (shared/passwords.ts);
- tabs: a closed or sleeping page's history into a new page
  (shared/tabs.ts);
- openFile: opens a HoloML file from the computer, a file dropped on the
  window or, with none, one chosen in the system's file chooser; answers
  the address to load;
- captureKeys: tells the main process that Settings is waiting for a
  shortcut's new keys, so key presses pass through meanwhile;
- closeReady: the answer to prepare-close, once the open tabs are saved.
Each is checked in the main process and accepted only from the shell:
the request channels through one helper (main/ipc.ts, handleFromShell),
the rest by their own check of the sender.
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
| Settings and theme | settings.json in the app data folder | Human readable. The window's size is not saved: it opens at 1280 by 800 |
| History, bookmarks (a bookmark keeps the page's small icon too) | hypersol.sqlite in the app data folder | Delete-able from the Library panel and Settings. Deleted history and sign-ins are overwritten in the file (section 4, "Deleted means overwritten") |
| Saved passwords, and sites never to save for | hypersol.sqlite (logins, login_never), the password encrypted with the system keychain | Delete-able in the Library's Passwords tab and with Settings > Clear browsing data > Saved passwords |
| Remembered camera, microphone, and location choices | settings.json (sitePermissions), by origin | Changed in the site panel; forgotten in Settings |
| Private tabs' permission choices; "Allow this time" | Memory only | Forgotten with the last private tab; "this time" when the tab leaves the site |
| An unanswered offer to save a password | Memory only, in the main process | Until answered, replaced, or the tab closes |
| Recently closed tabs and pages' back and forward history | Memory only (the shell: last 25 closed tabs; the main process: histories of the last 60 closed pages) | Gone when the app closes. Private tabs are never on the list to reopen; a private page's history, kept for a sleeping private tab to wake with, goes when the last private tab closes |
| Tab size, how tabs are shown, economy mode, sleep time | settings.json | Settings > Tabs and Settings > Economy |
| View settings and the person's own shortcut keys | settings.json (tiltDirection, parallax, pageMargin, shortcuts) | Settings > Appearance and view, Settings > Shortcuts |
| Visit counts and address keys for completion | hypersol.sqlite (history_latest.visits, .key) | Kept and cleared with the history; a removed suggestion forgets that address's visits |
| History search index, latest visit per address | hypersol.sqlite (history_fts, history_latest) | Kept with the history and cleared with it |
| Open tabs | session.json in the app data folder | Used only when startup is set to reopen them |
| Cookies, cache, site storage | Chromium profile folder managed by Electron | Standard browser behaviour |
| Filter lists | filters/engine.bin and engine.json in the app data folder (the last refresh); the starter copy in the app otherwise | Refreshed daily; switchable in Settings; "Update now" |
| Paused sites, DNS mode, list updates switch | settings.json | Changed in the shield popover and Settings |
| Layers view: global switch and per-site choices | settings.json | Changed in Settings and by switching the view on a page |
| Theme and page tilt | settings.json | Changed in Settings and with the theme button |
| Zoom per site | settings.json | Changed with the zoom buttons and shortcuts; not from private tabs |
| Zoom set in private tabs, per site | Memory only, in the shell | Forgotten with the last private tab; never in settings.json |
| The tab cards' pictures of their pages, and the pages' icons | Memory only, in the shell | Gone with the tab; private tabs' too |
| Downloaded files | The system's Downloads folder | The list in the Downloads panel lasts the session |
| Private tabs' cookies, storage, cache | Memory only (an in-memory session) | Cleared when the last private tab closes |
| Instrument panel switches and console level | settings.json | Changed in Settings, the top-bar button, and the panel |
| Instrument readouts (requests, console messages) | Memory only, in the main process, per tab | The last 300 of each, and up to 300 requests still waiting; forgotten with the page or tab |
| Certificates checked (for the panel) | Memory only, per host | Up to 500, until the app closes; private tabs' apart, cleared with the last private tab |
| Site choices from private tabs (layers, shield pause) | Memory only | Shared by private tabs while one is open; never in settings.json (issue #8) |
| Image rectangles of the page in front | Memory only, in the shell | Not saved or sent anywhere |

Nothing leaves the machine except user-initiated page loads (including
the favicon a page names, fetched through that page's own session, as a
browser tab does, once the shield has passed it), encrypted DNS lookups to the named resolver
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
Cmd+Tab is the macOS app switcher). Escape closes what is open (a menu,
a panel, the address bar's list); with nothing open for it to close,
Escape in the shell stops a loading page. Mouse and touch:
click or tap cards and buttons; scroll inside the page scrolls the page.
No free camera movement in the first result.

### States

- Waiting: progress strip under the address bar; a new panel shows a soft
  shimmer until first paint; tab cards show a spinner until a snapshot.
- Empty: new tab shows a start panel with a search box, bookmarks grid,
  and recent history. With no data: "Nothing saved yet" with a hint.
  Library with no history or bookmarks: same wording.
- Error: shown inside the panel as a card with a plain message, the
  address, and Retry; announced to screen readers as an alert named by
  its heading; gone when the page loads again, however the load began.
  Cases: address not found, connection failed,
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
  motion setting they are instant, the loading strip and shimmer stop
  moving, the camera holds still (no parallax), and a loading card shows
  a still mark in place of its spinner. The room's resolution follows
  the display's pixel ratio when it changes (a window moved to another
  screen).
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
  Three.js materials, so a theme changes both at once. The retro sun's
  three colours are theme tokens too (sunTop, sunMiddle, sunBottom), and
  what the page preload draws inside web pages (the layers view's
  outline, the list of saved sign-ins) takes its colours from the theme
  in use. Unit tests look for colours written into the code: H8 in the
  shell's styles, its hud/ files, and the room's code (scene/), and
  preload/theme-colours.test.ts in the page preload.

### Later screens and polish (not built yet)

Free camera and room navigation, image lift-to-3D, extensions, sync, a
theme editor, custom fonts, sound design, VR. (Built since this list was
first written: the downloads panel and find in page in milestone 8, and
HoloML pages in milestone 14.)

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
   node:sqlite; better-sqlite3 is dropped. Linux: the automatic builds
   run the saved-data checks there (since 2026-09-26). macOS not checked.
4. Large HoloML scenes, found with Harbour Loft (milestone 19; for an
   owner decision, not built). (a) The first drawing of a scene compiles
   its materials' shaders on the page's main thread: the flat's files
   are all in by 1.3 s, and it is ready at 3.5 to 3.8 s on this computer
   the first time (7 lamp lights cost about 0.8 s of that). Compiling
   without blocking (Three.js's compileAsync, with the browser's
   parallel shader compiling) before the first frame would let a page
   come in sooner. (b) Every model of a page is a stop in its outline
   (milestone 15's rule), so the flat's 120 models are 120 Tab stops;
   the page puts its places, doors, lamps, and links first (43 stops),
   but its Light choice, on the screen, comes after the outline, about
   110 stops later. Listing models without an id as text rather than
   stops, putting the screen's controls before the outline, or a key to
   jump to them, would each help. (c) The viewer fetches a model's files
   one after another, so a model as one .glb loads fastest (the flat's,
   as .gltf files with their pictures beside them, took 203 requests
   and 2.3 s more).

## 11. Run and test

Checked on Windows 11, 2026-09-24 and since; on Windows and Linux in the
automatic builds since 2026-09-26; on Linux in a container on this
computer (`pnpm test:linux`) since 2026-09-28. macOS not checked yet.
- Toolchain: Node 22.13 or newer; pnpm 12.4.1 (pinned)
- Install: `pnpm install --frozen-lockfile`
- Develop: `pnpm dev` (starts the Electron app with live reload, using a
  throwaway profile in the ignored `userData/dev` folder)
- Build: `pnpm build` (output in apps/browser/out)
- Unit tests: `pnpm test` (each test may take up to 20 seconds)
- Lint and type check: `pnpm lint`, `pnpm typecheck`
- End-to-end: `pnpm test:e2e` (every milestone's checks and the review's,
  [TIME]; needs openssl on PATH for the certificate-error check, which
  Git for Windows provides)
- Linux, as GitHub's machines run it: `pnpm test:linux` (needs Docker)

The automatic builds (.github/workflows/ci.yml) run for every pull
request and every push to main, on Windows and Linux. Each system runs
the end-to-end checks in four parts side by side, so a build takes as
long as its longest part (vitest.e2e.config.ts, HYPERSOL_E2E_PART):
part 2 is milestones 14 to 17's files and the viewer's checks from the
review, part 3 milestones 18 to 20's, part 4 milestone 21's (the ocean
tunnel, the slowest drawn in software), and part 1 everything else,
with lint, the type check, and the unit tests; a new file is in part 1
until it is given a part, and a part number that does not exist stops
the run. Each job may take 30 minutes. A last job, "All checks", passes
only when every part has; the rule on main names it alone. A change to
documents only (the `*.md` files at the top and the docs folder, which
no check reads) skips the parts, and "All checks" passes at once. The
actions are named by commit, and Dependabot proposes updates to them
and to the packages each week (.github/dependabot.yml).

Progress screenshots: `MILESTONE=m3 pnpm screenshots` builds the app and
saves its main screens to docs/screenshots/m3/ (Electron's own capture,
local test pages only).

Not checked yet: `pnpm package` (installers per OS, milestones 28 and 29).

Launch options, in any run: `--start-url=<address>` (default: a start
tab), `--tilt=<0 to 20>`, `--hypersol-user-data=<folder>`. In runs from
source (not a packaged app), F12 opens DevTools for the shell.

Test mode is `HYPERSOL_TEST=1` in the environment, and only in a build
that is not packaged: a packaged app ignores it and every switch below
(main/launch-options.ts; review of 2026-09-30). In test mode the main
process keeps logs for the checks in memory (every request's address,
private tabs' too, among them), the shell has read-only test hooks,
pages get a stand-in camera and microphone, the app acts as if on mains
power, list updates run only from a local address, "Leave this page?"
and the messages of a failed start go to the log instead of a box, and
a download's Open is recorded, not done. Its switches:
- `--search-url=<address with %s>`: the search engine;
- `--filters-base=<address>`: where list updates are downloaded from;
- `--dns-probe=<address>`: where the encrypted DNS check asks;
- `--showroom-url=<address>` and `--examples-base=<address>`: local
  copies of HoloML's showroom and of every example (these four
  addresses must be on 127.0.0.1);
- `--downloads-dir=<folder>`: where downloads are saved;
- `--test-no-keychain`: as if the system keychain were missing;
- `--test-no-webgl`: the shell and pages without WebGL;
- `--test-sleep-minute-ms=<N>`: a "minute" for sleeping tabs;
- `HYPERSOL_TEST_BACKGROUND=1` (set by the test harness unless
  HYPERSOL_TEST_SHOW=1): the window opens off screen, without focus or a
  taskbar button, and Chromium keeps drawing it;
- `HYPERSOL_TEST_KEEP_RUNNING=1`: the app keeps running when its last
  window closes, as on macOS, so quitting can be tested on any platform.

The tests also pass Chromium's `--host-resolver-rules` so that no name
resolves except this machine, and, with HYPERSOL_TEST_SOFTWARE=1,
switches that make Chromium draw in software.
