# Show HN

Hacker News's rules for Show HN: it must be something people can try
(it is: the viewer in any browser, and the zips), the title starts
"Show HN:", and the title says plainly what it is, without superlatives
or exclamation marks. Titles are cut at 80 characters.

## Title (choose one)

1. `Show HN: HyperSpace 3D – an open-source browser with a 3D interface`
   (67 characters)
2. `Show HN: HoloML, a markup language for 3D websites, and a browser for it`
   (72)
3. `Show HN: A 3D web browser we imagined in 2001, built with AI agents`
   (67)

Recommended: 1. It says what the thing is; the 2001 story and the AI
agents are in the first comment, where they invite questions rather
than arguments. The playground is live, so 2 is a fair choice too:
it gives the language the front.

## Link

https://srajpal.github.io/hypersol-hyperspace-3d/

(The landing page: the pictures, the GIF, the seven examples that open
in the browser, and the downloads. Not the repository: a visitor who
can try something in ten seconds stays longer.)

## First comment

Posted at once, under the owner's account.

> Hi HN. HyperSpace 3D is a desktop browser (Electron, so real
> websites work) whose interface is a 3D room: the page sits on a
> tilted panel, tabs are cards in an arc, a layers view lifts a page's
> sections to different depths, and you can lift a page's pictures and
> 3D models off it into the room. It blocks ads and trackers, uses
> encrypted DNS, loads pages over HTTPS only, and has no telemetry.
>
> Alongside it is HoloML, a small HTML-like language for fully 3D
> pages: glTF models, lights, labels, links, sound, and a little
> script. You don't need to install anything to see it. This opens a
> flat by a harbour that you can walk through, in your own browser:
> https://srajpal.github.io/hypersol-hyperspace-3d/viewer/?page=https://srajpal.github.io/holoml/harbour-loft/index.holoml
>
> There's also a playground where you edit a page and see it change:
> https://srajpal.github.io/holoml/playground/
>
> Some background: in 2001 a friend and I made a free Windows browser
> called HyperSol WebSurfer, and our next idea was a browser you look
> into rather than at. It never got past a concept screen. This year is
> 25 years since, so I built it. I didn't write the code: AI coding
> agents did, over 203 prompts in 17 days, and every prompt is
> published in the repository (PROMPTS.md) beside the commits. My part
> was the brief, the plans, the approvals, and checking. About 2,000
> tests (unit, end-to-end against the real app on Windows, Linux, and
> macOS, and the language's conformance samples) are how I know it
> does what it says. The article has the whole story: <ARTICLE>
>
> It's an experimental developer preview: portable zips for Windows,
> macOS, and Linux, unsigned, so each system asks once; each zip has a
> build provenance attestation you can check with `gh`. Apache 2.0.
> I'd love to hear what breaks, and what you'd want a 3D page to do.
>
> Browser: https://github.com/srajpal/hypersol-hyperspace-3d
> Language: https://github.com/srajpal/holoml

## Questions to expect

faq.md has the answers. The ones most likely in the first hour, in
the order they tend to come:

1. Isn't this just a gimmick? Who wants a tilted page?
2. Why Electron? Why not a real engine?
3. How is this different from A-Frame, X3D, or model-viewer?
4. "Built by AI": did you read the code? Can it be trusted?
5. Is it safe to run an unsigned zip?
6. Does it work on my Mac?
