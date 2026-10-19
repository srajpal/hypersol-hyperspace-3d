# Reddit

One post per subreddit, each written for its readers, spread across
the day, never two at once. Before each, read the subreddit's sidebar
and rules **on the day**: several allow a project post only on a set
day, with a set flair, or from accounts with some history there, and
the rules change. If a subreddit's rules do not allow it, skip it.
Reply to comments for the first hours; faq.md has the answers.

`<ARTICLE>` is the article's address once posted (docs/story.md);
`<PLAYGROUND>` the playground's, if it is live.

## r/programming

Reads the engineering, not the product. Usually a link post: the
article fits better than the landing page.

**Title:** 203 prompts, 17 days: what it took to have AI agents build a
browser and a 3D markup language, with every prompt published

**Link:** `<ARTICLE>`

**First comment:**

> Author here. The browser is HyperSpace 3D (Electron, Three.js) and
> the language is HoloML; both are Apache 2.0. The part I'd most like
> opinions on is the one about what the agents got wrong and which
> tests caught it: a security rule Chromium silently ignored, checks
> that passed because they looked too early, and the 17 checks that
> failed on a Mac. The prompts are in PROMPTS.md in the repository,
> beside the commits: https://github.com/srajpal/hypersol-hyperspace-3d

## r/webdev

Self-promotion is often limited to a weekly thread or "Showoff
Saturday"; check, and post there if so.

**Title:** I made a small HTML-like language for 3D web pages, and a
viewer that opens them in any browser

**Text:**

> HoloML is a markup language for pages that are 3D scenes: glTF
> models, lights, labels, links between pages, sound after the first
> click, and scripts from the page's own site. It's strict like XML (a
> mistake stops the page with its line and column) but written like
> HTML. Every model has a name for screen readers, and every page has a
> text view.
>
> Try one in your browser, no install: Harbour Loft, a flat to walk
> through:
> https://srajpal.github.io/hypersol-hyperspace-3d/viewer/?page=https://srajpal.github.io/holoml/harbour-loft/index.holoml
>
> The language: https://github.com/srajpal/holoml (spec, parser,
> checker, seven example sites). There's also a desktop browser with a
> 3D interface that reads it: https://srajpal.github.io/hypersol-hyperspace-3d/
>
> It's experimental. I'd love to know what you'd want a 3D page to do
> that it can't.

## r/threejs

Three.js people want to know how it is drawn.

**Title:** A browser whose interface is a Three.js room, and a markup
language that becomes Three.js scenes

**Text:**

> HyperSpace 3D is an Electron browser where the room, the tab cards,
> and anything you lift off a page are Three.js, with the live page
> placed in the room by CSS 3D transforms so it stays sharp and
> clickable. HoloML pages are drawn by a Three.js viewer: glTF with
> Draco, meshopt, and KTX2, shadows, panoramas for light, water with
> moving light, loading by area as you walk, and stand-ins far away.
>
> Seven examples open in any browser from here:
> https://srajpal.github.io/hypersol-hyperspace-3d/ (Harbour Loft and
> the ocean tunnel show the most).
>
> Code (Apache 2.0): https://github.com/srajpal/hypersol-hyperspace-3d,
> the viewer is apps/browser/src/viewer. Happy to answer anything about
> how it's drawn.

Attach the GIF (docs/video/hyperspace-3d.gif) if the subreddit allows
pictures in posts.

## r/electronjs

**Title:** HyperSpace 3D: a web browser built on Electron 44, with a 3D
interface

**Text:**

> An experimental browser: each tab is an Electron `<webview>` placed
> in a Three.js room with CSS 3D transforms, background tabs as
> snapshots, ad and tracker blocking with @ghostery/adblocker-electron,
> DNS over HTTPS, HTTPS-only, passwords in the system keychain through
> safeStorage, and history in SQLite through node:sqlite in a worker.
> 463 end-to-end checks drive the real app with Playwright on Windows,
> Linux, and macOS.
>
> Portable zips for all three: https://github.com/srajpal/hypersol-hyperspace-3d/releases/tag/v0.9.1
>
> Things that were harder than expected, if anyone's curious: clicks
> landing on a tilted webview, full screen and pointer lock with the
> browser's own notice, and keeping test windows off screen and
> unfocused on all three systems.

(Each technical claim checked against the code on 2026-10-19:
safeStorage in main/passwords/vault.ts, node:sqlite in
main/storage/database.ts, history's worker in main/storage/history.ts.)

## r/opensource

**Title:** HyperSpace 3D and HoloML: an open-source 3D web browser and
markup language, Apache 2.0, built in the open with every prompt
published

**Text:**

> Two repositories, both Apache 2.0 (HoloML's specification also CC BY
> 4.0): a desktop browser with a 3D interface, and a markup language
> for 3D web pages with a written specification, a grammar, a schema,
> and conformance samples, so anyone can write a second viewer.
>
> It was built by AI coding agents that I directed, and the whole
> process is public: the prompts (PROMPTS.md), the plans and the test
> results (TODO.md), and the rules the agents worked under (AGENTS.md).
> No telemetry, no accounts.
>
> https://github.com/srajpal/hypersol-hyperspace-3d
> https://github.com/srajpal/holoml
>
> Good first issues are marked in both. Contributions come under
> Apache 2.0's own terms; no contributor agreement.

## r/ClaudeAI

Check the flair for projects made with Claude, and use it.

**Title:** A browser and a 3D markup language in 17 days, 203 prompts
to Claude Code, every prompt published

**Text:**

> I directed Claude Code (mostly Opus 5.5, early on Fable 5.1) to
> build HyperSpace 3D, a desktop browser with a 3D interface, and
> HoloML, a markup language for 3D web pages. I didn't write the code.
>
> What worked:
> - A brief, an architecture, and written rules before any code. The
>   rules (AGENTS.md) are mostly about honesty: never invent a result,
>   mark a command "not checked yet" until it has run, never weaken a
>   test to get a pass.
> - Every milestone a plan with questions first; my answers were often
>   just "Q1 a, Q2 a".
> - Tests as the check on the agent: about 2,000 of them, including
>   end-to-end checks against the real app on three systems.
> - A review by ten parallel agents, each reading one area. It found
>   security faults the tests had not.
>
> What didn't: checks that passed because they looked too early,
> things only a person sees (blurred cards on a tablet, an upside-down
> sky), and a Mac the code had never met.
>
> The prompts: https://github.com/srajpal/hypersol-hyperspace-3d/blob/main/PROMPTS.md
> The whole story: `<ARTICLE>`
> Try a page in your browser: https://srajpal.github.io/hypersol-hyperspace-3d/

**[owner: PROMPTS.md also lists three prompts given to Codex; say so
if anyone asks which tools were used.]**
