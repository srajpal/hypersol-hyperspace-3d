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
player) does not play. Electron is kept on its current stable line
(44.7.2 today), checked monthly for security releases.

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
record: every prompt is published in order (PROMPTS.md), each change
is a commit, and every milestone's plan, decisions, and check results
are in TODO.md. The agents worked under written rules (AGENTS.md):
build only what was approved, never invent a result, mark a step "not
checked yet" until it has run, and never weaken a test to get a pass.
About 2,000 tests run on every change: 607 unit tests, 463 end-to-end
checks that drive the real app on Windows, Linux, and macOS, and 885 in
HoloML, with its conformance samples. A review by ten agents, each
reading one area, found real faults, among them security ones, and
they were fixed and published as advisories. It is still young code:
read it, and report what you find.

## Is it safe to run an unsigned zip?

The zips are unsigned, as signing needs paid certificates and this is
a personal project, so Windows and macOS ask once before starting it
(the README's Download section shows how). Each zip has its SHA-256
beside it on the release, and the zips are built by GitHub Actions
from the tagged commit (`.github/workflows/release.yml`), so anyone can
see how they were made, or build their own from source.

## What does it send, and to whom?

Nothing about you. No telemetry and no crash reports. Its own requests
are only: the pages you open and what they name, your searches to the
search engine you chose (DuckDuckGo by default), DNS over HTTPS to
Quad9, and the filter lists' daily update (which can be turned off).
No update checks, no account, no sync. The privacy page lists every
one: https://github.com/srajpal/hypersol-hyperspace-3d/blob/main/docs/privacy.md Ads and trackers are
blocked by EasyList and EasyPrivacy through Ghostery's open-source
blocker, with a shield that shows what was blocked.

## Does it work on a Mac?

Yes, on Apple silicon and Intel, as a zip; Gatekeeper asks once. The
automatic builds run on macOS, and on a Mac the end-to-end checks
pass but two (TODO.md, "Issue #111"). Windows and Linux are the systems
it was built on and are checked most.

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
