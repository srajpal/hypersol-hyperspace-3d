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
- HoloML showroom (milestone 16): the start panel's new "Try HoloML"
  section links to HoloML's showroom, five cars in a hall to walk around
  in three colours each, published at
  https://srajpal.github.io/holoml/showroom/ (nothing is fetched until
  the link is clicked). The README's screenshot now shows it.
- Fixed: HoloML pages stayed blank in development runs (`pnpm dev`): the
  viewer is now served through the renderer's dev server there.
- Fixed: a page could be drawn away from where the room placed it after
  focus moved into it (the page layer scrolled); most visible as a HoloML
  page opened from the start panel sitting over the tab rail.
- HoloML 0.2 pages, the first part of the 0.2 draft (milestone 17):
  - Scripts from the page's own site (`<script src>` in `head`), with a
    small scene API, `holoml`: find, change, add, and remove things,
    click, key, and frame events, the thing under the crosshair, the
    viewer's place, and sounds. Inline scripts and scripts from other
    sites do not run; a script that never stops leaves the browser
    answering.
  - Sound (`<sound>`): nothing plays before the first click or key on
    the page, the tab's mute applies, and sound files count against the
    page's limits.
  - Text on the screen (`<hud>`), in the text view and read by screen
    readers; a crosshair in walk mode.
  - Walls and gravity: `solid` things stop the walker; `gravity` and
    `jump` on the viewpoint (Space jumps, Shift runs).
  - Walking from the keyboard alone: the left and right arrows now turn
    (they moved sideways before; A and D still do), and Page Up and Page
    Down look up and down.
  - Lights' brightness, colour, and position, and the background, can
    be animated; night can be dark.
  - Models used many times are drawn together, so a scene of thousands
    of blocks stays smooth. The model limit now counts model files (64).
- Blockworld (milestone 17): a small block game published by HoloML at
  https://srajpal.github.io/holoml/blockworld/: break and place blocks,
  find five gems, bring them to the chest, and see day turn to night.
- The HoloML examples section (milestone 17): a card with a picture for
  each HoloML example, opened from the start panel's "Try HoloML", the
  menu, or Ctrl+Shift+E, with links to HoloML's repository, its
  specification, and each example's source. Nothing is fetched until a
  link is chosen.
- Fixed: a HoloML tab's card could show the page before its scene was
  drawn (an empty room, or only its labels); the card's picture is now
  taken again once the scene is drawn with nothing left to load.
- Walking speeds and sliders (milestone 18, first part): a HoloML 0.2
  page says how fast the viewer walks and turns (`speed`, `turn-speed`),
  a script can change it (`holoml.viewer.speed`, `turnSpeed`), and
  `slider` puts a labelled slider on the screen for the page's script
  (the `change` event). Blockworld walks faster (4.3 metres a second),
  turns faster (120 degrees a second), and has a Speed slider. Looking
  up and down from the keyboard now goes as fast as turning.
- Shadows, textured materials, choices, and light from the surroundings
  (milestone 18, second part), in HoloML 0.2 pages:
  - Shadows: a light marked `shadows` casts soft shadows from the models
    marked `shadows`. On a computer that draws 3D in software (no
    graphics card), they are left out, and the console says so.
  - A material's own pictures (`map`, `normal-map`, `roughness-map`),
    tiled by `repeat`, from the page's own site; they count against the
    page's limits like models.
  - Choices (`choice` and `option`): options on the screen that change a
    model's material in place, used with the mouse, touch, the keyboard
    (the arrow keys, as radio buttons), and screen readers, and shown in
    the text view; scripts hear each pick and can make one.
  - `environment`: a panorama of the surroundings (HDR, PNG, or JPEG)
    lights the scene.
- The sofa studio (milestone 18): a HoloML shop page published at
  https://srajpal.github.io/holoml/sofa-studio/: choose a sofa's fabric
  and wood in place, watch the price follow, switch between day and
  evening light, and go on to a cart page (there is no shop behind it).
  It is in the HoloML examples section and the start panel.
- Panels, click actions, places, a fade, a sky, and a floor plan
  (milestone 19, first part), in HoloML 0.2 pages:
  - `panel`: text of more than one line on a flat board in the scene,
    wrapped to its width; Find in page finds its words, and screen
    readers and the text view read them.
  - Click actions: an animation or a sound can begin when a thing is
    clicked (`begin="click"`, `trigger`, `toggle`), such as a door that
    opens and closes or a switch for a lamp. Each trigger is a button in
    the scene's outline, for the keyboard and screen readers; with
    reduced motion, each goes straight to its end.
  - Places: several viewpoints, and an address ending in `#name` starts
    at one; the outline's "Go to" and links to `#name` move the viewer
    there, and Back returns.
  - Following a link to another HoloML page of the same site fades out
    and in (a cut with reduced motion).
  - `sky`, a panorama drawn behind the scene (PNG and JPEG panoramas are
    decoded with the sky at the top); `plan`, a floor plan in a corner
    of the screen with the viewer's place and direction on it.

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
