# Changelog

## 0.9.0 — developer preview (not yet released)

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
