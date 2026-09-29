# Privacy: what HyperSol HyperSpace 3D stores and sends

HyperSpace 3D has no telemetry: no analytics, no crash reports, no
usage counts. This page lists everything it keeps on your computer and
everything it sends over the network. It is updated whenever that
changes (AGENTS.md rule 9).

Status: as of milestone 8 (2026-09-26): ad and tracker blocking and
encrypted DNS are on by default. The layers view (milestone 5) and the
instrument panel (milestone 7) send nothing anywhere.

## Blocked by default

The privacy shield blocks ad and tracker requests on every page, using
open filter lists and Ghostery's open-source blocking engine
(`@ghostery/adblocker`, MPL-2.0). It also hides page elements the lists
name as ads (element hiding). A page whose address is itself on a list
shows "The shield blocked this page", with "Open anyway" (that address,
once, in that tab). The shield at the bottom right counts what was
blocked on the page in front; click it to see the list and to pause the
shield on that site.

The lists (ads and trackers; no cookie-banner or annoyance lists),
downloaded from Ghostery's copies on GitHub, all under
`https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/`:

| List | Path | Licence | In the app's starter copy |
|---|---|---|---|
| EasyList | `easylist/easylist.txt` | GPL-3.0-or-later or CC BY-SA 3.0 or later | Yes |
| EasyPrivacy | `easylist/easyprivacy.txt` | same | Yes |
| uBlock Origin filters, and its 2020 to 2024 additions | `ublock-origin/filters.txt`, `filters-2020.txt` to `filters-2024.txt` | GPL-3.0 | Yes |
| uBlock Origin privacy | `ublock-origin/privacy.txt` | GPL-3.0 | Yes |
| uBlock Origin badware risks | `ublock-origin/badware.txt` | GPL-3.0 | Yes |
| uBlock Origin quick fixes, resource abuse, unbreak | `ublock-origin/quick-fixes.txt`, `resource-abuse.txt`, `unbreak.txt` | GPL-3.0 | Yes |
| Peter Lowe's ad and tracking server list | `peter-lowe/serverlist.txt` | None stated | No: downloaded only |
| uBlock Origin resources | `ublock-origin/resources.json` | GPL-3.0 | Yes |

The app includes a starter copy (`apps/browser/resources/filters/`,
rebuilt before each release with `pnpm filters:update`, which records
each list's address, size, and SHA-256 in `starter.json`), so pages are
protected from the first one, before anything is downloaded. Peter
Lowe's list states no licence, so it is not included in the app; it is
only downloaded by a refresh.

Known limit: some list entries replace a tracker's script with a
harmless stand-in. The stand-in did not load in Electron in our checks,
so those requests are blocked outright instead.

## Stored on your computer

Everything is in the app data folder, except the files you download,
which go to your system's Downloads folder (see the table):

- Windows: `%APPDATA%\HyperSol HyperSpace 3D`
- macOS: `~/Library/Application Support/HyperSol HyperSpace 3D`
- Linux: `~/.config/HyperSol HyperSpace 3D`

An install from before the product was renamed (2026-09-26) keeps using
its folder named `HyperSol WebSurfer 3D`, with everything in it.

(Development and test runs use a separate throwaway folder, never this
one.)

| What | File | When it is written | How to delete it |
|---|---|---|---|
| Bookmarks | `hypersol.sqlite` | When you press the star or Ctrl+D | Remove them in the Library, or press the star again |
| History: each page's address, title, and time of visit | `hypersol.sqlite` | When a tab arrives at a page; the same page again in the same tab (a reload) adds nothing | Delete entries in the Library, "Clear all history", or Settings > Clear browsing data |
| Settings: search engine, what opens at startup, encrypted DNS mode, daily list updates on or off, sites where the shield is paused, whether pages open in the layers view, and the sites where you switched the layers view, the theme, the page tilt, the instrument panel's switches, and the zoom level of sites you zoomed | `settings.json` | When you change a setting, pause the shield on a site, or switch the layers view on a page | Delete the file; the defaults return. Settings > "Forget site choices" clears the layers view choices |
| Filter lists from the last update, and when they were downloaded | `filters/engine.bin`, `filters/engine.json` | After a list update | Delete the folder; the starter copy included in the app is used |
| Open tabs: their addresses and which one is in front | `session.json` | While you browse, shortly after tabs change | Reopened only when Settings > On startup is "Reopen your tabs from last time"; delete the file to forget them |
| Saved passwords: the site, the user name, and the password encrypted with your system's keychain (Windows' data protection, the macOS Keychain, or the Linux secret service); when each was saved and last used; sites where you chose "Never" | `hypersol.sqlite` | Only when you choose Save or Update after signing in, or Never | The Library's Passwords tab, or Settings > Clear browsing data > Saved passwords |
| How the address bar completes: each address you visited, how many times, and when last; made from your history | `hypersol.sqlite` | With each visit | Removing a suggestion (its × in the list) forgets that address's visits; clearing history clears it all |
| Your own shortcut keys, and how the page view is set (lean, movement, space) | `settings.json` | When you change them in Settings | Settings > Shortcuts > Reset, or delete the file |
| Camera, microphone, and location choices you made with Allow or Block, by site | `settings.json` | When you answer a site's request, or change it in the site panel | The site panel (set it back to Ask), or Settings > Site permissions > Forget |
| Cookies, site storage, and cache | Chromium's profile files in the same folder | By the sites you visit, as in any browser | Settings > Clear browsing data |
| Files you download (outside the app data folder) | Your system's Downloads folder | When you download them | Delete them there |
| The Downloads panel's list | Memory only | While downloads run and finish | It lasts this session; "Clear list" empties it (the files stay) |

Private tabs (Ctrl+Shift+N, or New private tab in the menu) keep none
of this: their pages are not added to history, are not reopened with
"reopen your tabs", and their cookies, site storage, and cache live in
memory only and are cleared when the last private tab closes. Choices
made for a site from a private tab (switching the layers view, pausing
the shield) are kept in memory only: they apply to that site in every
private tab while one is open, never to normal tabs, never reach
`settings.json`, and are forgotten when the last private tab closes.
So are the certificates recorded for the instrument panel from private
tabs. Zooming in a private tab is not saved at all (the next page opens
at the site's usual zoom). Files downloaded in a private tab are still saved to the
Downloads folder, and bookmarks you add in one are kept, as in other
browsers. The shield and encrypted DNS work the same in private tabs.

If `settings.json` is damaged, it is renamed to
`settings.json.damaged-<date and time>` and kept for inspection, and the
defaults are used. If `hypersol.sqlite` cannot be opened, nothing is
recorded until it can be, and the Library says so.

Kept in memory only, never on disk:
- the shield's per-page lists of what was blocked, forgotten with the
  page or tab;
- the positions of the images on the page in front (for a later 3D
  feature), forgotten with the page or tab;
- the instrument panel's readouts for each tab: its last 300 requests
  and console messages, and up to 300 requests still waiting for an
  answer (beyond that the oldest waiting one is no longer followed),
  forgotten with the page or tab;
- the certificates Chromium checked, by site: up to 500, kept until the
  app closes (those from private tabs apart, until the last private tab
  closes).

The instrument panel reads what the browser already sees; it makes no
requests of its own, and it leaves certificate checking to Chromium
unchanged. If the saved filter lists are
damaged or were built by another version, the starter copy is used.

Kept in memory only: the tabs you closed this session (so you can
reopen them) and the back and forward history of pages you closed or
that went to sleep, all gone when the app closes, and never for private
tabs; an offer to save a password until you answer it;
"Allow this time" until the tab leaves the site; and choices made in
private tabs, until the last private tab closes. Nothing is saved or
filled in private tabs.

Passwords are never filled by themselves: a saved one goes into a page
only when you click a sign-in field and pick the account, and only on
the exact site it was saved for. Without a working system keychain,
nothing is saved, and the offer says why.

HoloML files opened from the computer (Ctrl+O, the menu, or dropping a
file on the window): the page may read its own folder, and the folders
inside it, for as long as the app runs; the permission is kept in memory
only. These pages are not added to history, and a tab reopened after a
restart asks you to open the file again.

To keep a tab awake while it has unsent text or uses the camera or
microphone, the page's own process notes that it does (never the text
or the pictures) and tells the browser only yes or no; nothing is
stored.

Not stored: other form entries, the downloads list (the files
themselves are, in the Downloads folder), and anything about how you
use the browser itself.

Site permissions: a site can use your camera, microphone, or location
only after you allow it; everything else a site can ask for (for
example notifications) is refused. Your location comes from your
operating system's location service; the browser adds no location
service of its own.

## Sent over the network

Only these. Everything except the list updates is started by you, and
the list updates can be turned off:

- The pages you open, including the images, scripts, and the favicon each
  page names (fetched through that page's own session, as a browser tab
  does; at most 256 KB, given up after 5 seconds, and cancelled when you
  leave the page).
- HoloML pages (`.holoml` addresses) and the 3D models, sounds,
  scripts, and pictures (a material's and the panorama of the
  surroundings, milestone 18; the sky and a floor plan, milestone 19)
  they name: only from the page's own site
  (the page's content policy allows nothing else), through the page's
  own session, so the shield and encrypted DNS apply as for any page.
  The browser's HoloML viewer itself comes from the app, not the
  network. Every model, sound, and picture file counts against the
  page's limits as it arrives (milestones 15, 17, 18, and 19); a file that
  crosses one is not fetched further. A HoloML
  0.2 page's scripts (milestone 17) run in the page's own sandboxed
  process like a web page's, and can reach only its own site; their
  scene API gives them the scene, where you look in it, and your
  clicks and keys on the page, nothing else. Its sounds play only after your first click or key on the page,
  and the tab's mute applies. The instrument panel's Scene part reads
  the scene from the page in memory only, and keeps nothing.
- HoloML's examples: the start panel's "Try HoloML" links (milestones 16
  and 17) and the HoloML examples section (the menu, or Ctrl+Shift+E)
  open the example sites HoloML publishes with GitHub Pages at
  `https://srajpal.github.io/holoml/` (the showroom, Blockworld, the
  sofa studio, Harbour Loft, the sneaker store, the ocean tunnel), only
  when you choose one; each is then an ordinary HoloML page. The sofa studio's script
  keeps your fabric and wood for its cart page, Harbour Loft's your
  choice of day or evening for its other pages, and the sneaker store's
  its cart (the shoes, colours, and sizes you added), in that tab's
  session storage, on this computer, as any site's script may; the
  browser adds nothing to it. Harbour Loft's booking page is a form
  that sends nothing and keeps nothing, and the sneaker store's
  checkout page asks for nothing and sends nothing. The ocean tunnel
  keeps nothing. A HoloML page that
  loads by area (milestone 20) fetches a group's models from its own
  site as you come near them. The
  section's links to HoloML's repository, its specification, and each
  example's source open `https://github.com/srajpal/holoml` pages the
  same way. The start panel and the section fetch nothing themselves:
  their pictures are part of the app.
- Searches typed in the address bar or start panel go to the search engine
  chosen in Settings (DuckDuckGo by default).
- DNS lookups for the sites you open go encrypted (DNS over HTTPS) to
  Quad9, `https://dns.quad9.net/dns-query`, a non-profit with a
  no-logging policy. Quad9 sees the names of the sites you visit; your
  network does not. Settings > Encrypted DNS: Secure (the default: Quad9
  only) or Automatic (Quad9 where possible, otherwise your network's
  DNS).
- If a site cannot be found while in Secure mode, the app asks Quad9 one
  question (about its own name, dns.quad9.net) to see whether Quad9 can
  be reached. If not, the page says "Encrypted DNS is blocked on this
  network" and offers "Use this network's DNS for now", which uses
  Automatic until you close the app.
- Filter list updates, when Settings > "Update the filter lists every
  day" is on (the default): once a day, the addresses in the table
  above, through the same encrypted DNS; a failed update keeps the lists
  in use and is tried again an hour later. "Update now" in Settings
  fetches them at once. Turn the switch off and nothing is downloaded
  unless you press "Update now".

Nothing else: no app update checks, no dictionary downloads (the spell
checker is off), no account, no sync.
