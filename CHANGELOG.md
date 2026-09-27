# Changelog

## Unreleased

- HoloML pages (milestone 14): a `.holoml` address shows its 3D scene
  across the window, with models, material changes, lights, labels,
  links, animation, and orbit or walk movement by mouse, keyboard, and
  touch. Ctrl+O, the menu, or dropping a file opens one from the
  computer. Mistakes show a card with their line and column.
- HoloML hardening (milestone 15):
  - Limits per page (GitHub issue #23): 2 MB of text, 10,000 elements,
    64 models, 32 MB for one model file and 128 MB for all of them,
    pictures up to 4096 by 4096 pixels, 2 million triangles, and 30
    seconds for a model to load. What crosses a limit is left out and
    marked; the rest shows, and a notice says why.
  - Esc, or the top bar's stop button, stops models still loading.
  - Tab moves through a scene's links and named things in page order,
    with an outline in the scene; a hidden outline of the scene is there
    for screen readers (#25).
  - A text view (a top-bar button, or Ctrl+Shift+V) shows the scene as a
    plain page of names and links. With the system's reduced motion on,
    animations show their end at once.
  - The instrument panel's Scene part (#28): the scene's objects as a
    tree, the selected one's line of text, bounds, position, rotation,
    scale, triangles, and pictures, a pick button, and every problem and
    left-out model with its line and column.

## 0.9.0 — developer preview (2026-09-26)

The first public version of HyperSol HyperSpace 3D, released as source
for developers. There are no installers yet: build and run it from
source as described in [CONTRIBUTING.md](CONTRIBUTING.md). Version 1.0
comes with installers for Windows and Linux (milestone 16), after HoloML
(milestones 13 to 15).

What it contains (milestones 1 to 11; [docs/progress.md](docs/progress.md)
has screenshots of each):

- Real web pages on a tilted panel in a 3D room, with clicks, typing,
  scrolling, and links landing where they should.
- Tabs as cards in the room, or as a list in the top bar; tab search,
  mute, reopening closed tabs with their history, sleeping tabs, and an
  economy mode.
- An address bar with completion from bookmarks and history, a start
  panel, and a right-click menu.
- Bookmarks, history (searchable, kept in a local SQLite database), and
  the Library.
- The shield: ad and tracker blocking with open filter lists, element
  hiding, a blocked-page card with "open anyway", a pause per site, and
  encrypted DNS.
- The layers view, which lifts a page's parts to different depths.
- Two themes, Nebula (dark) and Daylight (light), or matching the system.
- An instrument panel with page readouts, certificates, console, network
  list, and browser gauges.
- Zoom, find in page, downloads, printing, and private tabs.
- A password manager using the system's keychain, and site permissions.
- Settings in sections with search, remappable shortcuts, and view
  settings (tilt, parallax, page margin).
- No telemetry. What the browser stores and sends is listed in
  [docs/privacy.md](docs/privacy.md).

For developers:

- Unit tests (Vitest), lint, type checks, and end-to-end checks
  (Playwright driving the app) for every milestone.
- GitHub Actions runs all of them on Windows and Linux for every push.
- Security reports through GitHub's private vulnerability reporting
  ([SECURITY.md](SECURITY.md)).

Known limits:

- Checked on Windows 11, and on Windows and Linux (Ubuntu) by GitHub
  Actions. macOS is untested.
- The 3D room needs WebGL 2. Where Chromium cannot start it (no graphics
  driver, some virtual machines), pages still work without the room and
  a notice says so.
- Electron ships no DRM module, so video from Netflix and similar
  services will not play.
- Built on Electron 44.4.5 (Chromium 152).
