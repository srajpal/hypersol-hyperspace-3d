# HyperSol HyperSpace 3D: progress

What each finished milestone added, with screenshots of the main screens.
Moved here from the README on 2026-09-26 (owner, prompt 47).


Screenshots from each finished milestone, kept in
[docs/screenshots](screenshots). The roadmap and the current
milestone's tasks and checks are in [TODO.md](../TODO.md).

**Milestone 1: a live page in the 3D room.** A real website on a tilted
panel, clicks and typing working.

![Wikipedia on the tilted panel in the 3D room](screenshots/m1/1-wikipedia-tilted.png)

**Milestone 2: browsing basics.** Tabs as cards on an arc, the top bar,
the start panel, and error cards.

![Three tabs as cards on the left, a page tilted in the centre](screenshots/m2/1-tabs.png)

![The new-tab start panel with the "Nothing saved yet" empty state](screenshots/m2/2-start-panel.png)

![The "We couldn't find that site" error card](screenshots/m2/3-error-card.png)

**Milestone 3: memory and settings.** Bookmarks and history, the Library
and Settings panels, and a start panel with your data.

![The start panel showing a bookmark and recent history](screenshots/m3/2-start-panel.png)

![The Library panel showing today's history](screenshots/m3/4-library-history.png)

![The Settings panel: search engine, startup, clear browsing data](screenshots/m3/5-settings.png)

**Milestone 4: private by default.** Ad and tracker blocking with a
shield that counts and lists what was blocked, element hiding, a
"blocked" card with "Open anyway", pausing the shield per site, and
encrypted DNS through Quad9. Details in [docs/privacy.md](privacy.md).

![The shield popover listing a blocked ad image and tracker script](screenshots/m4/7-shield-popover.png)

![The "The shield blocked this page" card with Open anyway](screenshots/m4/8-blocked-card.png)

![Settings: encrypted DNS and ad and tracker blocking](screenshots/m4/6-settings-privacy.png)

**Milestone 5: depth layering.** A layers view breaks a page's main
sections and images apart into separate depths, following the room's
parallax; the page stays fully usable. It is on by default, with a
global switch in Settings and a choice remembered per site. The page
also reports where its images are, groundwork for lifting them into 3D
later.

![A page in the layers view: sections and images lifted at different depths](screenshots/m5/9-layers-view.png)

![The same page with the layers view off](screenshots/m5/10-layers-off.png)

![Settings: the layers view switch and per-site choices](screenshots/m5/11-settings-layers.png)

**Milestone 6: themes and look.** Two finished themes leaning into the
1980s and 1990s, switched with the button at the bottom right or in
Settings (which can also follow the system's light or dark setting). The
room, cards, panels, and window all follow the theme. Settings > Page
tilt trades the lean for sharper text.

![Nebula: synthwave sky, striped sun, neon grid](screenshots/m6/1-tabs.png)

![Daylight: pastel sky and grid, with the layers view](screenshots/m6/12-daylight-layers.png)

![Daylight: Settings with the theme choice and page tilt](screenshots/m6/14-daylight-settings.png)

**Milestone 7: instrument panel.** Floating panels with live readouts,
like a light DevTools in the room: dials and meters for the page in
front (load time, requests, data, blocked, CPU, memory, connection and
certificate) and for the browser (tabs, memory, frame rate, filter
lists, encrypted DNS, clock), plus the page's console and network list.
Off by default: Ctrl+Shift+I, the gauge button in the top bar, or
Settings, where each part can be switched on its own. The console and
network list maximize for reading.

![The instrument panel in Nebula](screenshots/m7/17-nebula-instruments.png)

![The instrument panel in Daylight](screenshots/m7/16-daylight-instruments.png)

**Milestone 8: everyday browser features.** Zoom buttons in the top bar
(remembered per site), find in page, a Downloads panel (files go to your
Downloads folder), printing, and private tabs that keep nothing.

![Zoom at 125% and the find bar](screenshots/m8/20-zoom-and-find.png)

![The Downloads panel](screenshots/m8/21-downloads.png)

![A private tab](screenshots/m8/22-private-tab.png)
