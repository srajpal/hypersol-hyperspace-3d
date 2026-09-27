# HANDOFF.md

The state of the project for whoever picks it up next, person or agent.
Last updated 2026-09-27 (milestone 12, the 0.9.0 developer preview,
accepted and released; milestone 13, HoloML v0.1 in the holoml
repository, accepted; milestone 14, HoloML pages in the browser,
accepted; HoloML 0.1.1 copied in; milestone 15, HoloML hardening, is
being built; plan in TODO.md).

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
  built), 15 HoloML hardening (resource limits, accessible scene
  navigation, an inspector: GitHub issues #23, #25, #28), 16 a car
  showroom demo; 17 privacy and data tools (HTTPS-only, per-site
  storage, bookmark import and export: #24, #26, #27); then installers
  as 1.0 (18 for Windows and Linux, 19 for macOS), with mobile later
  (owner, prompt 67).
- The logo direction is chosen (concept 4d in
  docs/branding/logo-concepts/); the real icons come with the installers.
- HyperSol, the company founded in 2001, no longer exists. This is a
  personal project honouring it, not marketed for now. Copyright: "The
  HyperSpace 3D Authors" and "The HoloML Authors" (AUTHORS files).

Two repositories, both on `main`, kept as sibling folders (never one
inside the other):

- Browser: https://github.com/srajpal/hypersol-hyperspace-3d (renamed
  from hypersol-websurfer-3d; GitHub redirects the old address)
- Language: https://github.com/srajpal/holoml

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

- With the installers (milestone 18): Windows signing (Microsoft's
  Artifact Signing recommended, or SignPath Foundation), updates
  (automatic from GitHub Releases recommended), Linux formats (AppImage
  and .deb recommended), the Windows installer type (per user
  recommended).
- With the macOS release (milestone 19): the Apple Developer Program for
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
- No installers, signing, or updates (milestones 18 and 19).
- No installers attached to releases: v0.9.0 is source only.
