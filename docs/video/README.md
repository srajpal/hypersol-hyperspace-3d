# The video and the GIF

- hyperspace-3d.gif: nine seconds of Harbour Loft, from the door in the
  brick wall up to the roof terrace and the harbour (720 pixels wide,
  10 frames a second, under 5 MB so GitHub shows it). At the top of
  both READMEs (holoml's shows it by this file's raw address) and on
  the landing page.
- The one-minute video, `hyperspace-3d-<version>.webm` (1280 by 720,
  30 frames a second, VP8), is not committed: it is attached to the
  release it was made for (0.9.1's assets), linked from the landing
  page and the README. Releases published since 2026-10-20 are
  immutable, so a new video goes on the release's draft before it is
  published.

Both are made by `pnpm screenshots:video` (the promotion plan's step 6,
GitHub issue #93; TODO.md, "Issue #93", has the cut): the built app
drives Harbour Loft, lifting into the room, and looking around from
the local copies in tests/fixtures (tests/screenshots/video.capture.ts),
and tests/screenshots/video-encode.mjs encodes the frames with
Playwright's own ffmpeg and the GIF with tests/screenshots/gif.mjs. Run
it on a computer with a graphics card, after a change that shows in
them, and look at the result; the owner reviews the cut.
