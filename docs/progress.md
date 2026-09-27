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

**Milestone 9: passwords and site permissions** (accepted 2026-09-26). After you sign in, the browser offers to save
the password, encrypted with your system's keychain; later, clicking the
sign-in field lists the saved account, and picking it fills the form.
The Library has a Passwords tab. Sites ask before using the camera,
microphone, or location (Allow, Allow this time, Block), with a site
panel behind the lock in the top bar and a LIVE mark on the tab. Also: a
notice when a download finishes or fails, New private tab under "+",
and pages print flat.

![The offer to save a password after signing in](screenshots/m9/23-password-offer.png)

![The saved sign-in listed under the field](screenshots/m9/24-sign-in-list.png)

![The Library's Passwords tab](screenshots/m9/25-library-passwords.png)

![A site asking for the camera and microphone](screenshots/m9/26-permission-prompt.png)

![The site panel, with the camera and microphone given to the page](screenshots/m9/27-site-panel.png)

![The download notice](screenshots/m9/28-download-notice.png)

![New tab and New private tab under "+"](screenshots/m9/29-new-tab-menu.png)

**Milestone 10: tabs and economy** (accepted 2026-09-26). Reopen a closed tab (Ctrl+Shift+T) with its back history,
search your tabs (Ctrl+Shift+A), and mute a tab from the speaker on its
card. Settings > Tabs sets the card size and whether tabs show as
cards, cards that hide, or a list in the top bar. Economy mode (on by
itself when running on battery) draws the room more simply at 30 frames
a second, and unused tabs go to sleep to free memory. History searches
now run on their own thread with an index, fast even with 100,000
visits.

![A tab playing sound: the speaker on its card](screenshots/m10/30-sound-on-card.png)

![Search tabs](screenshots/m10/31-tab-search.png)

![Tabs as a list in the top bar](screenshots/m10/32-tab-list.png)

![Economy mode on (ECO), with the Tabs and Economy settings](screenshots/m10/33-economy-and-tabs-settings.png)

**Milestone 11: your feedback** (accepted 2026-09-26). The address bar completes sites you have visited as you
type and lists the best matches. The leaning page now reaches both
sides of the window, and Settings > Appearance and view sets how far
and which way it leans, how much the room moves, and the space around
it, or "Flat and still" in one step. Settings has sections and a
search; every shortcut is listed and can be changed. Menus close when
you click elsewhere, "Cards that hide" is gone, and the Library's
search empties between tabs.

![The page reaching both sides of the window](screenshots/m11/34-wider-page.png)

![Address bar completion and suggestions](screenshots/m11/35-address-completion.png)

![Settings: sections, and the page view](screenshots/m11/36-settings-appearance.png)

![Settings search finds a setting in another section](screenshots/m11/37-settings-search.png)

![Keyboard shortcuts, each changeable](screenshots/m11/38-settings-shortcuts.png)

**Milestone 12: developer preview 0.9.0** (accepted and released
2026-09-26). The browser is ready to share as source:
project and legal files, version 0.9.0, and automatic builds and tests
on Windows and Linux. Where a computer cannot draw the 3D room, the
browser now still works and says why.

![About: version 0.9.0 and the copyright line](screenshots/m12/39-about-0.9.0.png)

![Without WebGL 2: pages still work, and a notice explains](screenshots/m12/40-no-webgl-notice.png)

**Milestone 13: HoloML 0.1** (accepted 2026-09-27). The language is
written down in the holoml repository, with a parser, a checker, and
sample pages; no new browser screens.

**Milestone 14: HoloML pages in the browser** (built 2026-09-27, waiting
for acceptance). A `.holoml` page shows its 3D scene across the window,
flat and still, with models, labels, links, lights, and animation; a
page with a mistake says where it is.

![A HoloML page: cars, labels, and a linked model](screenshots/m14/41-holoml-scene.png)

![A HoloML page with a mistake: the line and column](screenshots/m14/42-holoml-mistake.png)
