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
- Harbour Loft (milestone 19): a flat by a harbour to tour, published at
  https://srajpal.github.io/holoml/harbour-loft/: walk through its
  rooms, open its doors and switch its lamps on (with a click, or from
  the keyboard), read about each room on its panel, see where you are
  on the floor plan, turn the day to evening, go up to the roof terrace
  (a second page, reached with a fade), and book a viewing (a form that
  sends nothing; the flat and its price are made up). It is in the
  HoloML examples section and the start panel.
- Loading by area (milestone 20), in HoloML 0.2 pages: a group with
  `load="near"` loads its models only while the viewer is within its
  `near` of it, and lets them go (their files, pictures, and memory, and
  their share of the page's limits) once the viewer is farther than half
  as much again; what would pass the limits waits until something is
  let go. A model's `stand-in`, a lighter copy, shows in its place until
  the model has loaded, and again once it is let go. Scripts read
  `loaded` and hear the `load` event.
- The sneaker store (milestone 20): one shoe in ten colourways on the
  walls of a store to walk through, each bay's shoes loaded as you come
  near, published at https://srajpal.github.io/holoml/sneaker-store/:
  open a shoe to see it on a turntable, turn it over, choose its colour
  and size, add it to your cart, and go to a checkout page that places
  nothing (the shoe is Shopify's, from the Khronos glTF sample models,
  CC BY 4.0; its name and prices are made up). It is in the HoloML
  examples section and the start panel.
- Water, sounds from a place, and animation speed (milestone 21), in
  HoloML 0.2 pages, which completes HoloML 0.2:
  - `water`: a box of water with a colour and a clarity. What is seen
    through it fades into its colour with the distance the view travels
    through the water, from inside it or from outside through glass;
    labels and panels stay as they are, to be read. With `caustics`,
    the light from its waves moves over what is in it; it holds still
    with reduced motion, and is left out when drawing in software (the
    console says so).
  - Sounds from a place: a sound with a `position` comes from there,
    quieter with distance, silent beyond its `range`, and from its
    side; the listener follows the viewer.
  - Scripts: a model's `animationSpeed` (0 holds its animation still;
    up to 4 times as fast) and a sound's `position`.
- HoloML pages are ready sooner: new materials' shaders compile without
  holding up the page (the last picture stays meanwhile). A HoloML page
  in a tab behind another draws nothing until its tab is in front again.
- The ocean tunnel (milestone 21): an aquarium to walk through,
  published at https://srajpal.github.io/holoml/aquarium/: a glass
  tunnel along the floor of a big tank, where 30 fish of nine kinds
  (sharks, a sea turtle, tuna, barramundi, and schools of smaller fish)
  swim over and around you among rocks, driftwood, plants, and rising
  bubbles, with the light from the waves on the sand. Feed them, and
  they come to eat; click a fish, or its button in the outline, to read
  about it. Its fish are CC BY 4.0 and CC0 models, credited on its about
  page. It is in the HoloML examples section and the start panel.
- HoloML's documentation (milestone 22): the HoloML examples section's
  link to the specification opens its published page,
  https://srajpal.github.io/holoml/spec/, part of HoloML's new site with
  tutorials, how-to guides, reference pages, and explanation. The
  viewer's scene API is checked against the specification's Web IDL.
- The About dialog says the browser is an experimental developer
  preview, not yet for everyday browsing (owner, prompt 131).
- Fixed: in the layers view, a very tall page (HoloML's specification is
  52,000 pixels tall) drew nothing below its top bar, as its long main
  section, lifted, was larger than the graphics card can draw as one
  layer. A section or picture that large now stays flat.

After a review of both repositories on 2026-09-30 (the ids in brackets
are the review's):

### Security

- A page that only looks at a permission, without asking, is now told
  what a page that asks is told: refused, for everything but the
  camera, microphone, and location. Before, such a page read "granted"
  for notifications, MIDI devices, reading the clipboard, idle
  detection, window placement, the installed fonts, and more. Copying
  text after a real click still needs no permission. [M1]
- A site that asks for a client certificate gets none. Before, the
  first one in the system's store was handed over without asking, in
  private tabs too. [M2]
- The shield now checks WebSocket connections, requests that come from
  no tab (a site's service worker's), and the page's icon, which the
  browser fetches for the tab's card; before, all three passed unseen.
  [M3]
- A page that asks to be kept (a `beforeunload` handler) can be left:
  the browser asks "Leave this page?". Before, typing an address, Back,
  and Reload did nothing on such a page, and a page could hold its tab
  for good. [M4]
- A filter list update downloads the lists' text only. The scripts the
  blocker runs inside web pages now come with the app and are checked
  against their SHA-256; before, each daily update downloaded them from
  a branch of another project that can change at any time. [M5]
- A HoloML file opened from Downloads, the desktop, Documents, the home
  folder, or the top of a drive can read only the files beside it, not
  the folders inside. A local HoloML page can leave for a web address
  only within five seconds of a real click or key press, and then
  without the address's query and fragment; no HoloML page can open a
  peer connection. [M6]
- An answer at a `.holoml` address that the site sends as a download,
  or sandboxes, is no longer run as a HoloML page, and a HoloML page
  keeps the site's own content policy and frame options beside HoloML's
  (before, they were replaced). [V1]
- Test mode, which keeps every request's address in memory, exists only
  in a build that is not packaged. [D11]
- The checks' test hooks are on a HoloML page only in a test run; in a
  normal run a page has only what the Scene inspector uses, frozen. The
  browser's commands to the viewer and the scene's state go over a
  private line, so a page's script can no longer give either. [D12,
  V10]
- HoloML's limits now hold for a model that arrives and cannot be
  decoded (it keeps nothing of the page's totals and is not fetched
  again at each approach), and a model's triangles are counted again
  once it is decoded. [V3, V4]
- A HoloML page without scripts can no longer hang its tab: a model
  file whose parts refer to each other many levels deep, a solid or a
  viewpoint placed beyond 1,000,000 metres, and one very long word in a
  panel are each handled in bounded time. [V5]
- New HoloML limits on what files become, not only on their bytes: the
  page's decoded pictures up to 134,217,728 pixels in all, its decoded
  sounds up to 600 seconds in all, 32 lights, and 4 lights that cast
  shadows. [V6]
- The copy of HoloML's checker (HoloML 0.2.2) and the viewer no longer
  take time that grows with the square of a long run of digits in a
  value (one of 40,000 digits took two seconds to refuse). [L1]

### Fixed

- Switching from one panel to another closes the first properly: a
  password shown in the Library is hidden again, and a shortcut waiting
  for its new keys stops waiting. [R1]
- An error card goes when its page loads again, however the load began
  (a failed tab that sleeps and wakes showed its page under the old
  card). [R2]
- A HoloML page that fills the window is drawn flat: the camera goes to
  the centre at once, though the pointer is over the page. [R4]
- The address bar shows the end of a long host, not its start, and
  never a user name or password; the whole address shows when the bar
  takes the keyboard. The lock shows only for a page that loaded over
  https, not for a certificate error's card. [R5]
- Enter on a completed address loads the address shown; the site panel
  closes when its tab leaves the site; "Forget" in Settings forgets one
  site only; find is stopped on the tab it ran on; the console stays
  where it was scrolled to; Enter on a tab's Close button closes that
  tab; a typed address stays in the bar while it loads. [R6]
- The room asks for no frames for a loading card that is out of view,
  follows the display's pixel ratio when it changes, and places pages
  while its WebGL context is lost. [R6]
- Access: the screen reader's list of tabs keeps the keyboard as tabs
  change; error cards are announced; About and the HoloML examples keep
  Tab inside; with reduced motion the camera holds still and a loading
  card shows a still mark; text being composed is not completed in
  place; the arrow keys, Home, and End move through menus. [R7]
- Block for the camera or microphone reloads the pages that were given
  them, so the capture ends whatever the page does. [M7]
- A link that leads to a download leaves the shield's site and count as
  they were. [M8]
- A start that fails (a full disk, a data folder that cannot be
  written) ends with a message; before, it left a process without a
  window that made every later launch quit at once. A shell that
  crashes is reloaded once. [M9, M10]
- A page that calls alert() without end can be stopped from its second
  dialog; a HoloML file at the top of a drive opens. [M10]
- Deleted history and saved sign-ins are overwritten in the database
  file, not only marked as free space. [D6]
- A HoloML page of a version the viewer does not know, or that names
  none, is refused with a card; before, it was drawn as 0.1. [V2]
- A HoloML walk page with gravity goes idle when its walker stands
  still. [V7]
- In a HoloML page's text view the arrow keys, Page Up, Page Down, and
  the space bar scroll the text, and the hidden scene draws nothing.
  [V8]
- A HoloML sound removed while its file is decoded no longer plays. [V9]
- In HoloML pages: a script runs though another element on its line has
  a problem; the scene is drawn again after the graphics card resets;
  what a script hides takes no click and stops no walker; a sound from
  a place with a range under a metre is heard within it. [V10]
- The list of saved sign-ins under a field follows the theme (it stayed
  dark in Daylight), and the retro sun's colours come from the theme.
  [St3]
- For developers: end-to-end checks that raced or measured by the
  test's own clock were repaired without changing what they assert (the
  slow download, the instrument panel's bytes, the wait at quitting,
  the fade), and a wait stops at once when the app has gone.

### Changed

- Where Chromium draws in software (no graphics card), a HoloML scene
  is drawn with half as many pixels each way and without smoothed
  edges, so that it moves more smoothly; the console says so once.
- The ocean tunnel's turtle is a hawksbill sea turtle ("Hawksbill
  Turtle" by Bindestrek, CC BY 4.0). The flatback it replaces was
  credited as CC BY 4.0 but licensed CC BY-NC 4.0 (non-commercial).
  [E1]
- Built on Electron 44.5.1, with its backported Chromium, V8, ANGLE,
  and Dawn fixes. [H2]
- The copy of HoloML's parser and checker is HoloML 0.2.2, the
  specification's third edition: the same language, stricter in places.
- Zoom set in a private tab is kept in memory for its site while a
  private tab is open (it was lost at each new page), and never saved.
- The permission prompt and the download notice take no click or key
  press for their first half second, and "Open" on a downloaded program
  shows it in its folder instead of starting it. [R3]
- Esc in the top bar stops a page that is still loading, once nothing
  else is open for it to close.
- For developers: the automatic builds run the end-to-end checks in
  four parts on each system, with an "All checks" job that the rule on
  main requires; a change to documents only skips them; actions are
  named by commit, and Dependabot proposes updates each week. The
  repository gains a code of conduct, issue and pull request templates,
  and editor and line-ending settings. [H1, H3, H8, H9]

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
