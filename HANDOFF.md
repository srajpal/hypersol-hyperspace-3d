# HANDOFF.md

State of the project for whoever picks it up next, human or agent.
Last updated 2026-09-26 (milestones 9 and 10 built, waiting for acceptance).

## Where things stand

The product is HyperSol HyperSpace 3D ("HyperSpace 3D" in the app),
renamed from HyperSol WebSurfer 3D on 2026-09-26 along with the
repository. TODO.md's roadmap is the authority on milestone state; this
is a summary. Milestones 1 to 8 are done and accepted by the owner (the
latest on 2026-09-26): a 3D browser with tabs as cards (hidden while
there is one tab), bookmarks, history, Library and Settings, ad and
tracker blocking with a shield, encrypted DNS through Quad9, a layers
view, the Nebula and Daylight themes, an instrument panel (readouts,
console, network list), zoom, find in page, downloads, printing, and
private tabs. Milestone 9 (passwords, site permissions, and the
milestone 8 feedback: download notice, private tab under "+", flat
printing) and milestone 10 (reopen, search, and mute tabs; card size
and how tabs are shown; economy mode; sleeping tabs; history in a
worker thread, GitHub issue #4) are built, their checks pass, and both
wait for the owner's acceptance (TODO.md has the results). Then 11
(First release, with the chosen logo direction, concept 4d in
docs/branding/logo-concepts/). HoloML keeps its name (owner, prompt 44;
HSML was checked and advised against, prompt 43); the holoml repository
now names the browser HyperSol HyperSpace 3D. GitHub issues #8 to #15
(QA of milestone 8) were fixed in PR #16, merged 2026-09-26; #4 is done
in milestone 10; #5 (continuous integration) stays proposed for the
first release (milestone 11). The Electron security check was last done
at the start of milestone 10 (44.4.5 current). Progress screenshots live
in docs/screenshots/<milestone>/; capture them with
`MILESTONE=mN pnpm screenshots` when a milestone is finished and add
them to docs/progress.md (the README has a short progress paragraph
that links there).

A four-perspective documentation review (technical, product/UX,
operational, business) ran on 2026-09-24. Its doc fixes and rule updates
are applied. The items that still need an owner decision are listed
under "Open items from the review" below.

Two repositories, both pushed to `main`:

- Browser: https://github.com/srajpal/hypersol-hyperspace-3d
  (renamed from hypersol-websurfer-3d on 2026-09-26)
  Local: `C:\dev\Projects\Claude\hypersol-websurfer-3d` (the folder
  keeps its old name; renaming it is optional)
- Language: https://github.com/srajpal/holoml
  Local: `C:\dev\Projects\Claude\holoml`

The two local folders sit side by side. Never nest one in the other.

## Read these first, in order

1. AGENTS.md (rules; CLAUDE.md imports it)
2. BRIEF.md (what we are building and for whom)
3. ARCHITECTURE.md (how, and what is still open)
4. TODO.md (roadmap, current milestone tasks and checks)
5. README.md (the story and public face)
6. PROMPTS.md (every owner prompt, verbatim, with model and effort)

The holoml repo has its own README.md and AGENTS.md, which defer to the
browser repo for rules and the prompt log.

## Decisions already made (do not reopen without the owner)

- First result: open any normal site in a 3D interface on Windows, macOS,
  Linux, with tabs, address bar, bookmarks, history, two themes, and
  privacy on by default. Desktop only. Mouse, keyboard, touch. Milestones
  1 to 10 in TODO.md make up the first result (the instrument panel
  became milestone 7 and the everyday features and passwords 8 and 9 on
  2026-09-26; the first release is 10).
- Stack: Electron (current supported stable line, 44 as of 2026-09-24),
  TypeScript, Three.js, Lit, SQLite (node:sqlite, built into
  Electron's Node), @ghostery/adblocker-electron (milestone 4),
  electron-vite, Vitest, Playwright; planned and not yet installed:
  electron-builder (milestone 11). Reasons in ARCHITECTURE.md section 4.
  Toolchain: Node 22.13 or newer, pnpm 12.4.1 pinned.
- Focused page is a live Chromium view (an Electron `<webview>`) placed
  with CSS 3D transforms; background tabs are snapshot textures;
  offscreen rendering is the upgrade path, hidden behind a PagePanel
  interface. If tilted input fails, the fallback is a flat, face-on live
  page in the 3D room. On attach, any page-requested preload is replaced
  by the trusted page preload.
- Layout: fixed "desk" camera with mouse parallax (paused while the
  pointer is over the page), standard OS title bar, focused page centre,
  tab cards in a left arc, sharp 2D HUD on top, Library and Settings
  panels sliding in from the right. Ctrl+Tab switches tabs on every
  platform.
- Themes: Nebula (dark, default) and Daylight (light).
- Privacy: ad and tracker blocking, DNS over HTTPS in "secure" mode via
  Quad9 with a Settings switch to Automatic and an error card when DoH is
  blocked, spellchecker off, no telemetry, no crash reporter. Filter
  lists refresh on a schedule through Electron's net.fetch, on by
  default, switchable in Settings. Default search: DuckDuckGo.
- Known limitation: no DRM video (Electron ships no Widevine).
- Language name: HoloML, extension `.holo`. "3DML" was taken.
- License: Apache 2.0 for both repos; HoloML spec text also CC BY 4.0.
- Naming: "HyperSol" with no LLC or Inc; founders without titles.

## Open questions (ARCHITECTURE.md section 10)

1. Exact theme colours and accent; any owner sketches. Decide in the
   theme milestone.
2. Whether clicks land correctly on a live page rotated in 3D. Answered
   by the milestone 1 spike (TODO.md task 8). Fallback is a flat,
   face-on live page; texture mode stays the later upgrade path.
3. Resolved: node:sqlite (works in Electron 44.4.5 on Windows; owner
   decision 2026-09-25).

## Open items from the review (need an owner decision)

These are recommendations that survived adversarial verification but
change scope, add a service, or cost money. None is applied.

- Three-OS continuous integration (GitHub Actions) as a milestone 1 task,
  so macOS and Linux get signal before milestone 11. Needs approval as a
  service under rule 3.
- Code signing and notarisation: Apple Developer Program and a Windows
  signing route. Paid accounts with lead time; start before milestone 11.
- An update channel (for example a version check against GitHub
  Releases) so Chromium security fixes reach users. Needs a privacy
  statement amendment.
- SECURITY.md with a disclosure contact, and CONTRIBUTING.md before
  outside pull requests are invited.
- Positioning: consider "early adopters and web developers" for v0.1 and
  gate "general public" on everyday essentials plus auto-update. Add a
  prior-art paragraph (VRML, X3D, A-Frame, model-viewer) to BRIEF.md and
  holoml/README.md.
- Legal identity: name the licensor and copyright holder; run a recorded
  trademark and `.holo` search; add THIRD-PARTY.md for the MPL blocker
  engine and filter-list licences.
- Product gaps for milestone 2 onward: accessibility baseline
  (DOM-mirrored tab list, reduced motion, contrast), tab-arc overflow
  rule, onboarding and bookmark import, a touch equivalent for tab close,
  context-menu behaviour, permission prompts, certificate errors,
  depth-layering per-site off switch and heuristics, a readability
  threshold for check C13.
- Milestone 1 details: define C2 as OS-level clicks at projected
  coordinates, define "idle" for C9, decide the guest result channel for
  fixtures, record GPU and display scaling of the build machine, list
  the downloads the install itself performs.

## Machine facts (checked 2026-09-24)

Node 22.16, npm 10.9, pnpm 12.4.1, git 2.45, Python 3.13, .NET 9,
CMake 3.28. No Rust, no C++ compiler. `gh` is logged in as srajpal.
NVIDIA GeForce RTX 4050 Laptop GPU plus AMD Radeon integrated graphics;
one 1920×1080 display at 100% scaling; touchpad, no touch screen.
Electron 44.4.5 is installed in the repo (not globally).

## How to resume

1. In the Claude desktop app, CLAUDE.local.md turns on Remote Control
   first, then the owner's prompt is logged in PROMPTS.md before any
   work, with a session tag. Read the last heading first and use the
   next number. If CLAUDE.local.md is missing, recreate it from the copy
   below.
2. Do only what the prompt approves. Milestones 4 to 6 are done (accepted
   2026-09-26, prompt 33); the smaller tab cards are in. Milestone 7
   (Instrument panel) is done (accepted, prompt 36). Milestone 8 (Everyday
   browser features) is done (accepted, prompt 38). Do not start
   milestone 9 (Passwords) yet: the owner is testing and will post
   GitHub issues first, and asked that their feedback shape the plan.
   The Passwords answers and the milestone 8 feedback are in TODO.md.
   The first release is 10. Push before and after each milestone (AGENTS.md rule 11). Tick tasks and record check results in
   TODO.md as they actually run. At the end of each milestone, save
   screenshots (owner request, prompt 20).
3. Any new package needs approval first (rule 4 in AGENTS.md). The
   installed set and versions are listed in TODO.md, milestone 1.
4. Update README.md, ARCHITECTURE.md, TODO.md, and this file whenever a
   decision or the project state changes. Update the Testing section of
   AGENTS.md only with commands that have actually run.
5. Commit after each completed change. Push before and after each
   milestone, otherwise only when the owner asks; remind them when five
   or more commits are waiting.
6. One active session per working tree. A second session works in the
   other folder or waits.

## CLAUDE.local.md (copy for a new machine)

Save this as `CLAUDE.local.md` in the repo root. It is gitignored.

```markdown
# CLAUDE.local.md — owner only, gitignored

Claude Code only. This file is not committed. If it is missing on a new
machine, recreate it from the copy in HANDOFF.md.

At the start of every session, in this order:

1. Turn on Remote Control for this session by calling the session
   management tool `set_remote_control` with `enabled: true` and
   `session_id: "self"`. If that tool is not available (for example in
   the terminal CLI), skip this silently. If the call is refused or
   fails, say so in one line and carry on.
2. Log the owner's prompt in PROMPTS.md (verbatim, with date, model,
   effort, session tag, and session tokens if available) before starting
   the work, following the Prompt log section of AGENTS.md.
```

The holoml repo uses the same file, with step 2 pointing at the browser
repo's PROMPTS.md.

## Things not yet done, on purpose

- Milestones 1 and 2 are done; milestone 3 is built and awaits
  acceptance; milestones 4 onward are listed in TODO.md but not approved
  to build.
- No code in the holoml repo yet.
- Nothing owed from earlier milestones.
- No SPEC.md in holoml (outline is part of milestone 11).
- No git tags, branches, CI, issue templates, SECURITY.md, CONTRIBUTING.md,
  or GitHub settings.
- No memory files saved outside the repo; everything is in these docs.
