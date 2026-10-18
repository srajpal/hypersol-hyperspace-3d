# Entries for the curated lists

The promotion plan's step 10 (GitHub issue #97, 2026-10-17): one entry
for each of four lists, in each list's own format and under its own
rules, read from their contributing files that day. The owner submits
each from their own account (a fork, one commit, one pull request);
this file holds the exact text, where it goes, what the pull request
says, and whether the project qualifies today. Where each went is
recorded in HANDOFF.md once it is sent.

Facts the rules ask about, as of 2026-10-17: the browser repository
was created on 2026-09-25 (22 days ago) and has 0 stars; it has an
English README with screenshots, a portable zip for Windows, Linux,
and macOS on the 0.9.1 release, Electron 44, and the Apache 2.0
licence; the app's icon is 1024 by 1024 PNG; nothing in the name or the
icon is another company's.

## 1. electron/apps (electronjs.org/apps): ready now

The official Electron apps list, which the site electronjs.org/apps is
built from. Rules (its contributing.md): a folder under `apps/` named
with lowercase letters, numbers, and dashes, holding a `.yml` file and
a PNG icon of at least 256 by 256; `name`, `description`, `website`
(https), and `category` from its list are required; the app must be at
least 20 days old (it is: 22), open source with a README, a screenshot
in it, and a binary for at least one system; the description short,
starting with a capital, ending with a full stop, not starting with "A"
or "An", and not mentioning Electron; links over https. Screenshots are
optional, as https addresses with captions.

The files are ready in this folder: `electron-apps/hypersol-hyperspace-3d/`
holds `hypersol-hyperspace-3d.yml` and `hypersol-hyperspace-3d-icon.png`
(the app's 1024-pixel icon). The category is Productivity, as the Min
browser's entry there is; the four screenshots are the README's, by
their raw addresses on main.

Steps:

1. Fork https://github.com/electron/apps on GitHub, clone the fork, and
   copy the folder `docs/launch/electron-apps/hypersol-hyperspace-3d/`
   from this repository into its `apps/` folder.
2. Optional check: in the fork, `npm install && npm test` runs its
   checks over every app's file, including the new one.
3. Commit ("Add HyperSol HyperSpace 3D"), push, and open the pull
   request with this title and text:

   Title: `Add HyperSol HyperSpace 3D`

   Text:

   > HyperSol HyperSpace 3D is an open-source desktop web browser with
   > a 3D interface: ordinary websites float as panels in a 3D room,
   > page sections lift into layered depth, and fully 3D sites written
   > in HoloML open as places to walk through. Built with Electron 44
   > and Three.js; Apache 2.0; no telemetry.
   >
   > - Repository: https://github.com/srajpal/hypersol-hyperspace-3d
   > - Site: https://srajpal.github.io/hypersol-hyperspace-3d/
   > - Release 0.9.1, a portable zip for Windows, macOS, and Linux:
   >   https://github.com/srajpal/hypersol-hyperspace-3d/releases/tag/v0.9.1
   >
   > The README has screenshots and a GIF; the icon and the name are
   > the project's own.

4. After the merge, the entry appears on electronjs.org/apps within a
   day or two (their release process).

## 2. awesome-electron: not yet (100 stars and 30 days)

sindresorhus/awesome-electron (about 27,000 stars; active). Rules
(its contributing.md): the project must be at least 30 days old and
have at least 100 stars; one pull request per suggestion, 100% ready
when opened; the format `[title](link) - Description.`, added at the
bottom of the relevant section; the description short, starting with a
capital, ending with a full stop, not starting with "A" or "An", not
mentioning Electron; open-source apps need an English README with a
screenshot and a binary for at least one system; the pull request's
title useful, its text linking the thing and saying why.

Today the repository is 22 days old with 0 stars, so this one waits.
When both are met (the stars first, which the launch posts of step 12
work toward), the entry goes at the bottom of "Apps" > "Open Source" >
"Other" in readme.md:

```markdown
- [HyperSpace 3D](https://github.com/srajpal/hypersol-hyperspace-3d) - Web browser with a 3D interface, and a viewer for HoloML, a markup language for 3D websites.
```

Pull request title: `Add HyperSpace 3D`. Text:

> https://github.com/srajpal/hypersol-hyperspace-3d
>
> An open-source desktop browser with a 3D interface: ordinary
> websites as panels in a 3D room, page sections lifted into depth,
> and fully 3D sites written in HoloML, a markup language kept in its
> own repository. Portable zips for Windows, macOS, and Linux on the
> releases page; README with screenshots and a GIF; Apache 2.0. It
> belongs here as a browser built on Electron that does something no
> other does with the page.

(The list's own guideline, verbatim: "If you just created something,
wait at least 30 days before submitting" and "The project repo should
have at least 100 stars.")

## 3. awesome-threejs: ready now, with a proposed sub-section

AxiomeCG/awesome-threejs (about 1,000 stars; last change 2026-07).
Rules (its contributing.md): the submission must be "really awesome";
a short description following the convention, crediting the author by
a GitHub or Twitter profile; prefer the repository link over a demo's;
the right category, or propose a new one in the pull request. Its
format:

```markdown
- [Name](link): description by [@author](profile)
```

Its sections are Books, Courses, Articles, Inspiration, Videos,
Resources, Tools, Libraries, Demonstrations (Water, Collision
detection), and Community; nothing holds applications or languages
built on three.js, so the pull request proposes a sub-section
"Applications" under "# Demonstrations", with two entries, one project
in two repositories:

```markdown
## Applications

- [HyperSpace 3D](https://github.com/srajpal/hypersol-hyperspace-3d): Open-source desktop browser whose interface is a three.js scene: ordinary websites on panels in a 3D room, and fully 3D sites written in HoloML by [@srajpal](https://github.com/srajpal)
- [HoloML](https://github.com/srajpal/holoml): Markup language for fully 3D websites, rendered with three.js: a specification, a parser and checker, seven example sites, and a viewer for any browser by [@srajpal](https://github.com/srajpal)
```

Pull request title: `Add HyperSpace 3D and HoloML under a new Demonstrations > Applications sub-section`. Text:

> Two entries for one project that is built on three.js, under a
> proposed sub-section, as no existing one holds applications:
>
> - HyperSpace 3D, https://github.com/srajpal/hypersol-hyperspace-3d:
>   an open-source desktop browser (Electron) whose whole interface is
>   a three.js scene; the 3D room, the tilted pages, and the HoloML
>   viewer are three.js, with the glTF loader and the Draco, meshopt,
>   and KTX2 decoders.
> - HoloML, https://github.com/srajpal/holoml: a markup language for
>   3D websites, with its specification, a parser and checker, and
>   seven example sites (a car showroom, a block game, a flat to tour,
>   an aquarium), each rendered with three.js and openable in any
>   browser at https://srajpal.github.io/holoml/.
>
> If a different section suits better, happy to move them.

## 4. awesome-webgl: ready now, one entry for HoloML

sjfricke/awesome-webgl (about 1,500 stars; last change 2026-04). Rules
(its CONTRIBUTING.md): one pull request per suggestion; the format
`[NAME](LINK) - DESCRIPTION.` with the description simple and ending
with a period; titles capitalised; the pull request's title
descriptive; additions at the bottom of the relevant category, except
the libraries section, which is alphabetical; new categories welcome.
Its bullets are `*`.

The fit is HoloML, not the desktop browser: the list is about WebGL
itself, and HoloML's viewer draws with WebGL 2 in any browser. Under
"## Libraries" > "### Others", which holds the engines and frameworks
(Babylon.js, PlayCanvas, Three.js), in alphabetical order, after
"GLGE" and before "Lightgl.js":

```markdown
* [HoloML](https://github.com/srajpal/holoml) - Markup language for fully 3D websites, with a specification, a parser and checker, example sites, and a WebGL 2 viewer for any browser.
```

Pull request title: `Add HoloML to Libraries > Others`. Text:

> HoloML, https://github.com/srajpal/holoml: an open markup language
> for 3D websites (Apache 2.0, the specification CC BY 4.0), with a
> specification, a parser and checker, seven example sites, and a
> viewer that draws with WebGL 2 in any browser
> (https://srajpal.github.io/holoml/). Placed alphabetically among the
> engines and frameworks under Others; a "Languages" sub-category would
> suit as well if you prefer.

## What to record afterwards

For each pull request sent: the list, the pull request's address, the
date, and its outcome, in HANDOFF.md's step 10 line and in TODO.md
under "Issue #97". If a maintainer asks for a change, the agent
redrafts here.
