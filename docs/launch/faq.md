# Answers for launch day

Ready answers to the questions most likely to come, to paste and
adapt in Hacker News threads, Reddit comments, and replies. Each is
short enough for a comment; the links go deeper. Keep the tone: thank
the asker, agree with what is fair, say plainly what is not done.

## Isn't a 3D browser a gimmick?

For everyday reading, a flat page is the right shape, and HyperSpace 3D
keeps it: the page you are reading is a live, sharp Chromium page,
tilted only a little, and the room is around it, not in the way. Where
depth helps is with things that are 3D already, and with seeing more
at once: tabs you can see as cards, a page's pictures and models
lifted out to turn over, and pages that are places, like a flat to
walk through or a shop where you turn a shoe over. Whether that is
worth a new kind of browser is a fair question, and it is why this is
an experiment and a developer preview, not a product.

## Why Electron? Why not write an engine?

Because the first thing it had to do was show the real web, and
nothing short of Chromium does that today. Electron bundles Chromium
with one codebase for Windows, macOS, and Linux, so every site works
from day one, and the work could go into the 3D interface instead of a
rendering engine. The cost: the zips are 120 to 160 MB, and Electron
ships no Widevine, so DRM video (Netflix, Disney+, Spotify's web
player) does not play. The app is kept on a supported stable line of
Electron and updated with its security releases, which are checked at
least once a month and before every release.

(Before posting: if someone asks which Electron, read the version from
the newest release's notes; none is written here, so that it cannot go
stale.)

## How is HoloML different from A-Frame, X3D, or model-viewer?

- **A-Frame** is a JavaScript framework: its scenes are HTML elements
  running inside a normal web page, and they need A-Frame's script to
  draw. A HoloML page is its own document type, like an HTML page: it
  needs no script to draw, a browser reads it, and links between HoloML
  pages work as links do.
- **X3D** (and VRML before it) describes 3D scenes in depth, for tools
  and for specialists. HoloML is deliberately small, for people writing
  pages by hand, and leaves the models themselves to glTF 2.0, the open
  standard nearly every 3D tool exports.
- **model-viewer** puts one model on an HTML page. HoloML is a whole
  page that is a scene: many models, places to walk, lights, sound,
  labels, and links.
- HoloML is strict where HTML is forgiving: a mistake stops the page
  with its line and column, and conformance samples pin down how every
  page must be read, so a second viewer cannot guess differently from
  the first. More: https://srajpal.github.io/holoml/docs/explanation/why-holoml.html

## "Built by AI": did you read the code? Can it be trusted?

**[owner: one honest paragraph in your own words: how much of the code
you read, and what you looked at most.]** What can be said from the
record: the prompts of the build, 1 to 203, are published in order
(PROMPTS.md; since then a prompt is recorded only on request, and one
has been, 204), each change is a commit, and every milestone's plan,
decisions, and check results are in TODO.md. The agents worked under
written rules (AGENTS.md): build only what was approved, never invent a result, mark a step "not
checked yet" until it has run, and never weaken a test to get a pass.
There are about 2,000 tests: 621 unit tests and 485 end-to-end checks
that drive the real app, run on Windows and Linux on every change (on
macOS, lint, types, the unit tests, and the build on every change, and
the end-to-end checks on main, as an experiment), and 897 in HoloML,
with its conformance samples. A review by ten agents, each
reading one area, found real faults, among them security ones, and
they were fixed and published as advisories. It is still young code:
read it, and report what you find.

## Is it safe to run an unsigned zip?

The zips are unsigned, as signing needs paid certificates and this is
a personal project, so Windows and macOS ask once before starting it
(the README's Download section shows how). Each zip has its SHA-256
beside it on the release, and the zips are built by GitHub Actions
from the tagged commit (`.github/workflows/release.yml`), so anyone can
see how they were made, or build their own from source. From 0.9.2 on
each zip also has a build provenance attestation, signed through
GitHub, that proves it came from that workflow and that commit:
`gh attestation verify <the zip> -R srajpal/hypersol-hyperspace-3d
--signer-workflow srajpal/hypersol-hyperspace-3d/.github/workflows/release.yml --source-ref
refs/tags/v0.9.2` checks it (the README's Download section has the
line to copy), and the repository's attestations page lists them all.
It binds the zip's exact bytes to that build; it does not say the
source or the zip is safe or free of faults, and it is not code
signing.

(Before posting: check the version. The line above names 0.9.2; if a
newer release is out, name its tag.)

## Should I use this as my everyday browser?

Not yet. It is an experimental developer preview from one person, in
spare time, and young code. Try it, look around with it, and say what
breaks, but keep banking and anything else sensitive in the browser
you already trust. Two things to know before relying on it. It follows
Electron's stable releases to pick up Chromium's security fixes:
Electron's release notes are checked at least once a month and before
every release, and a security release goes into a new version of the
app. And it has no automatic update and no update check: a newer
version is a newer zip on the releases page, which you download
yourself, so an old copy stays old until you replace it. Only the
latest release is supported (SECURITY.md).

## What does it send, and to whom?

Nothing about you. No telemetry and no crash reports. Its own requests
are only: the pages you open and what they name, your searches to the
search engine you chose (DuckDuckGo by default), DNS over HTTPS to
Quad9, and the filter lists' daily update (which can be turned off).
No update checks, no account, no sync. The privacy page lists every
one: https://github.com/srajpal/hypersol-hyperspace-3d/blob/main/docs/privacy.md

Ads and trackers are
blocked by EasyList and EasyPrivacy through Ghostery's open-source
blocker, with a shield that shows what was blocked.

## Does it work on a Mac?

Yes, on Apple silicon and Intel, as a zip; Gatekeeper asks once. The
automatic builds run on macOS: lint, types, the unit tests, and the
build on every change, and the end-to-end checks on main, as an
experiment (GitHub's small Mac fails some that a real one passes). On
a Mac in hand (an iMac Pro, 2026-10-15) the end-to-end checks pass
but for two things: one frame-rate check (C9) reads about 30 frames a
second where it asks for at least 50, which measures the check's own
loop, as the room itself draws at about 60 there; and now and then
the app crashes when a page's DevTools open (TODO.md, "Issue #111").
Windows and Linux are the systems it was built on and are checked
most.

(Before posting: that whole run on the Mac was of 463 checks; the 22
added since have not all been run there.)

## Why no installer?

A portable zip is the honest form for a developer preview: unzip,
start, delete the folder to remove it. Installers, signing, and
automatic updates are not planned; a fork may make its own
(CONTRIBUTING.md, "Making your own build").

## Can HoloML pages be dangerous?

They are drawn in the page's own sandboxed process, scripts only from
the page's own site, with limits on file sizes, triangles, pictures,
and a script's time, so a heavy page cannot take the machine down. Peer
connections, frames, and plugins are taken out of the page. Sound
waits for the first click or key.

## Is there VR? Phones?

Not yet. An Android tablet app exists in the repository (built from
source); phones, iOS, and VR are ideas for later.

## What happened in 2001? (two lines)

In 2001 two friends made HyperSol WebSurfer, a free Windows browser
with themes and pop-up control, and imagined a browser you look into,
not at, called HyperSpace 3D. It never shipped; this is that idea, 25
years later.

## How can I help?

Try it and file what breaks. Issues marked "good first issue" and
"help wanted" are a start in both repositories, and Discussions are
open for ideas. A second HoloML viewer, written from the
specification, would be the best test the language could have.
