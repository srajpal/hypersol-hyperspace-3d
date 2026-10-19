# Mastodon and Bluesky

One thread on each, posted an hour after the Show HN, linking the
landing page (not the Hacker News post). Bluesky allows 300 characters
a post; Mastodon allows 500 on most servers. The posts below fit
Bluesky's 300, so the same thread works on both. Every picture and clip
needs its alt text, given under each.

## The clips

Cut from the video (`_video/hyperspace-3d-0.9.1.webm`, made by `pnpm
screenshots:video`) or taken from the GIF; each a few seconds, without
sound (the video has none). The scenes are in the order of the video's
cut (TODO.md, "Issue #93").

| Clip | From the video | Alt text |
|---|---|---|
| A | The room: four tabs as cards and the page on the tilted panel, switching tabs | A web browser drawn as a 3D room: a web page on a tilted panel, and four tabs as cards in an arc on its left; the page changes as a card is chosen |
| B | Harbour Loft, from the terrace door up to the roof terrace (the GIF) | Walking through a door in a brick wall, up the stairs to a roof terrace, and the harbour full of boats below |
| C | Pictures and a shoe lifted off a page into the room, one brought nearer and turned | A shop's web page in the 3D room; its pictures and a sneaker rise off the page and stand beside it; the sneaker comes nearer and turns |
| D | Looking around the room, and Escape back to the page | The view leaves the desk and turns around the 3D room, then returns to the page |

Turning the WebM into clips is the owner's to do with any editor; if a
script for it is wanted, it is a small follow-up to `pnpm
screenshots:video` (Playwright's ffmpeg can cut WebM; MP4 needs a full
ffmpeg, which would be new software, AGENTS.md rule 4).

## The thread

**1** (clip A)

> HyperSpace 3D: an open-source web browser with a 3D interface. Any
> website sits on a panel in a 3D room, tabs are cards beside it, and
> you can lift a page's pictures and 3D models off it into the room.
> Free, Apache 2.0, no telemetry. 🧵
> https://srajpal.github.io/hypersol-hyperspace-3d/

(Counted 2026-10-19: every post here is under 300 characters with its
links written out in full: 285, 281, 202, 229, and 217. Post 4's
`<ARTICLE>` adds the article's address; keep that one short, or show
it as a link card.)

**2** (clip B)

> It also reads HoloML, a small HTML-like language for 3D web pages.
> This is Harbour Loft, a HoloML page. You can walk through it in your
> own browser, no install:
> https://srajpal.github.io/hypersol-hyperspace-3d/viewer/?page=https://srajpal.github.io/holoml/harbour-loft/index.holoml

(The long link: on Bluesky, add it as a link card or shorten its shown
text; Mastodon counts every link as 23 characters.)

**3** (clip C)

> Pictures and glTF models on ordinary pages can be lifted into the
> room, turned, brought nearer, and put back. A model is fetched only
> from the page's own site and read where it cannot reach the network.

**4** (clip D)

> The story: in 2001 a friend and I made a free browser, HyperSol
> WebSurfer, and dreamed of one you look into, not at. 25 years later
> I built it, by directing AI coding agents: 203 prompts in 17 days,
> every one published. <ARTICLE>

**5**

> It's an experimental developer preview: portable zips for Windows,
> macOS, and Linux.
> Browser: https://github.com/srajpal/hypersol-hyperspace-3d
> Language: https://github.com/srajpal/holoml
> I'd love to hear what breaks.

## Hashtags

Mastodon finds posts by hashtag, so add a few to the first post there:
`#OpenSource #WebDev #ThreeJS #3D #Browser`, and `#ClaudeCode` on the
fourth. Bluesky needs none.
