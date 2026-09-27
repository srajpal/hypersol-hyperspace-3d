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
- Prompt log: PROMPTS.md (every prompt the owner gives, verbatim)
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

- The company is "HyperSol", with no "LLC" or "Inc." after it.
- The founders are named without job titles.
- The browser is "HyperSol HyperSpace 3D"; its short display name, used
  in the app's own interface, is "HyperSpace 3D" (renamed 2026-09-26,
  owner, prompt 42; it was "HyperSol WebSurfer 3D" before).
- The original 2001 product is "HyperSol WebSurfer". "HyperSpace 3D" was
  also the title of an early HyperSol concept screen (2001 to 2003); do
  not claim that concept shipped. The language is "HoloML", file
  extension `.holo`.
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
    PROMPTS.md, read its last heading and use the next number. Every
    entry carries a session tag.
13. Security cadence: at the start of each milestone, check Electron's
    release notes for security releases. Upgrade to the current supported
    stable line before any public release. Record the version and the
    date checked in ARCHITECTURE.md section 3.

## Prompt log

Applies to the project owner's sessions only; contributors do not log
prompts. Every prompt from the owner is appended to PROMPTS.md, verbatim,
in order, before the work for it begins. Each entry records: number,
date, model, effort level, session tag (model name plus the first eight
characters of the session id), and the session context tokens reported
by the tool at logging time (per-prompt token counts are not available;
say so rather than estimate).

Redaction: secrets, keys, and personal data (addresses, phone numbers,
non-public names) are replaced with placeholders such as
`[redacted-token]` and the replacement is noted under the entry. Images
and attachments are summarised in one line, never embedded.

Do not edit earlier entries except to correct a factual error, and note
the correction.

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
  docs/screenshots/<milestone>/ with `MILESTONE=mN pnpm screenshots`, and
  add them to docs/progress.md; the README keeps a short progress
  paragraph that links there. (Added 2026-09-25, prompt 21; the progress
  page split out 2026-09-26, prompt 47.)
- Owner-only automation (Remote Control at session start, the prompt-log
  reminder) lives in CLAUDE.local.md, which is gitignored, so
  contributors' sessions never inherit it. HANDOFF.md holds a copy for
  recreating it on a new machine.

## Testing

Where tests live:
- Unit tests next to the code they test: `*.test.ts` in each package and
  in apps/browser/src.
- End-to-end tests in tests/e2e (Playwright driving the Electron app).
- Test fixture pages in tests/fixtures, served from 127.0.0.1.
- HoloML conformance fixtures in the holoml repo under conformance/.

How to run (from the repo root; first recorded 2026-09-24 on Windows 11
after they ran; macOS and Linux not checked yet). Counts are as of the
date given and grow with each milestone; TODO.md has the latest.
- Toolchain: Node 22.13 or newer; pnpm 12.4.1, pinned in package.json.
- Install: `pnpm install --frozen-lockfile`
- Unit: `pnpm test` (Vitest; 235 tests passed on 2026-09-26)
- Lint and type check: `pnpm lint` and `pnpm typecheck` (both clean)
- End-to-end: `pnpm test:e2e` builds the app, then runs Playwright
  against it (about six minutes; 167 checks on 2026-09-26). Needs openssl on PATH for
  the certificate-error check (Git for Windows includes one). Every
  host except 127.0.0.1 is blocked during the run, and the test windows
  ignore the real mouse, so a resting cursor cannot disturb results. See
  TODO.md for results.
- Test windows stay out of the way (owner request, 2026-09-25): they
  open off screen, never take focus, and have no taskbar button, so the
  computer can be used during a run; `pnpm screenshots` works the same
  way. To watch a run in normal windows, set HYPERSOL_TEST_SHOW=1 (for
  example `HYPERSOL_TEST_SHOW=1 pnpm test:e2e`); then leave the machine
  alone while it runs. Check C1 confirms background windows are off
  every display and unfocused.

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
- Filter lists: `pnpm filters:update` rebuilds the starter copy from the
  internet (run before a release; first run 2026-09-26).
- Milestone 6 checks H1 to H7 (same command): theme switch, Settings >
  Theme with "Match the system", the room and window following the
  theme, page tilt, the layers view's outline; H5 (contrast) and H8 (no
  hard-coded colours) are unit tests.
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
- Later milestones add: per-OS installers (12).

Rules for tests: a failing test is reported, not deleted. A test is
changed only when the requirement it checks has changed, and the doc that
states the requirement is updated in the same change.
