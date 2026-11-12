# The launch kit

Everything the owner posts on launch day (GitHub issue #99, the
promotion plan's step 12), drafted for the owner's edits. The owner
posts every piece from their own accounts; the agents post nothing
(AGENTS.md rules 3 and 4). [lists.md](lists.md) is step 10's, the
curated lists, sent before the day.

| File | What |
|---|---|
| [show-hn.md](show-hn.md) | The Show HN title, link, and first comment |
| [faq.md](faq.md) | Answers ready for the questions that will come, to paste and adapt |
| [reddit.md](reddit.md) | Posts for r/programming, r/webdev, r/threejs, r/electronjs, r/opensource, and r/ClaudeAI |
| [threejs-forum.md](threejs-forum.md) | A showcase post for the Three.js forum |
| [social.md](social.md) | Threads for Mastodon and Bluesky, with the clips |

## Before the day

Each of these is the owner's. The launch waits until all are done,
because every post sends people to these places.

- [x] The video attached to the 0.9.1 release (`gh release upload
      v0.9.1 _video/hyperspace-3d-0.9.1.webm`): there, and its link
      answers 200 (checked 2026-10-20).
- [ ] A line about the video in 0.9.1's release notes, which have none.
- [x] holoml #66 merged (the GIF at the top of holoml's README;
      2026-10-19).
- [ ] The landing page and the viewer looked at in Firefox and Safari,
      and from the keyboard.
- [ ] One zip each unzipped and started on Windows, a Mac, and Linux,
      following the README's Download steps word for word.
- [x] The playground live on the holoml site (holoml #58, merged
      2026-10-20): https://srajpal.github.io/holoml/playground/, linked
      in the posts below.
- [ ] The article (docs/story.md) posted a day or two before, so the
      posts can link it. Its address goes in the places marked
      `<ARTICLE>` below.
- [ ] Electron's security releases checked (AGENTS.md rule 13; last
      2026-10-20, 44.9.2, in 0.9.2, published that day). If a security
      release is out, it goes in a 0.9.3 first. The check must be made
      again on launch day. On 2026-11-11: Electron 45 is the newest
      stable line, 44 is still a supported one, and 0.9.3, a security
      release on Electron 44, is in preparation. The posts name no
      Electron version; where one links a release (0.9.2 today), its
      "Before posting: check the version" note says so.
- [ ] Clips cut from the video for the social posts (social.md lists
      them): short MP4s or GIFs under each service's limits.
- [ ] The issue list tidy: "good first issue" and "help wanted" where
      they fit (done in step 8), and nothing stale at the top.

## Still missing before launch

Found by a review of the kit on 2026-11-11. None is drafted here; each
is the owner's to write or to approve as work.

- A one-sentence pitch: what it is and why someone would try it, the
  same words everywhere.
- A specific ask of readers: the posts end with "what breaks"; one
  thing to do (try a page, write one, file an issue) would be clearer.
- An MP4 of the video. The release has a WebM, which plays poorly on
  iOS and on social sites. MP4 needs a full ffmpeg, which would be new
  software (AGENTS.md rule 4; social.md, "The clips").
- The comparison page: A-Frame, X3D, model-viewer, and the others
  (holoml issue #59, open; the promotion plan's step 17). faq.md's
  answer links holoml's "Why HoloML" page meanwhile.
- Loading feedback before the web viewer's first frame (holoml issue
  #51, open): the screen stays dark for about ten seconds before
  Harbour Loft draws (TODO.md, "The promotion plan", results), and
  Harbour Loft is the first link in most posts.
- The three `[owner: ...]` placeholders to fill: in story.md, what
  happened to HyperSol (under "2001", line 49) and how much of the
  code the owner read (the end of "What the agents got wrong, and
  what caught it", line 196); in faq.md, the same answer in the
  owner's words ("Built by AI", line 57).
- `<ARTICLE>`: the article's address, once it is posted, in
  show-hn.md, reddit.md, and social.md.

## On the day

A weekday, Tuesday to Thursday. Hacker News is busiest from about
8:00 to 11:00 in the morning, US Eastern time, and a post made then has
the US and Europe awake while it is on the front page.

A conflict in this plan (found 2026-11-11): everything below is on one
day, Tuesday to Thursday, but r/webdev allows showcases only on
Saturdays (reddit.md, "r/webdev"; read its rules on the day), so its
post cannot be on that day.

**A proposal, for the owner to decide:** spread the posts over about
two weeks, so that each gets its own answers and what the first
readers find can be fixed before the largest audience. First the
Three.js forum and r/threejs, who know how it is drawn; some days
later Show HN, Tuesday to Thursday, with Mastodon and Bluesky an hour
after; then the other subreddits one or two a day, r/webdev on a
Saturday. Until the owner decides, the steps below stand as written.

1. **Show HN** first (show-hn.md). Post the first comment at once.
   Then stay: answer every question for the first three or four
   hours, kindly and briefly; faq.md has the long answers. Never ask
   anyone to upvote, and do not share a link that goes straight to the
   post for votes: Hacker News penalises both.
2. **Mastodon and Bluesky** an hour later (social.md), linking the
   landing page, not the Hacker News post.
3. **Reddit** across the day, spaced out, one subreddit at a time
   (reddit.md). Read each subreddit's rules on the day: several allow
   a project post only on a set day or with a set flair.
4. **The Three.js forum** (threejs-forum.md), any time that day.
5. In the evening, note the numbers (stars, visitors in each
   repository's Insights, Traffic) in HANDOFF.md: they are the start of
   step 19's monthly look.

## After

- Answer issues and Discussions within a day or two for the first
  weeks; a newcomer's first issue is the best chance to keep them.
- awesome-electron once the browser has 100 stars (it is 30 days old
  since 2026-10-25; lists.md, section 2).
- Step 13, the case study and the talk proposals, the week after,
  with the launch's numbers to cite.
