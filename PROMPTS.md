# PROMPTS.md: how HyperSpace 3D was built, prompt by prompt

Every prompt the owner gave the AI agents that built HyperSol HyperSpace
3D and HoloML, in order. Together with the commit history, TODO.md, and
the other documents, it shows how a large piece of software was planned,
built, tested, and steered through conversation.

How this record is kept:

- Each prompt keeps its meaning and its order. The text is lightly edited:
  spelling and typing slips are fixed, and nothing personal or private is
  included (there was none to remove beyond the founders' names, which
  the README tells as history). Short approvals such as "approved" are
  kept, because they show how each step was steered.
- Where a prompt only answers the agent's questions ("Q1: a") or
  approves a draft, a note above it says what was asked or approved,
  taken from the session records and the decisions in TODO.md (owner,
  prompt 61). The notes are not part of the prompt.
- Each entry gives the date, the AI model, and the effort level the tool
  was set to. Images and pasted output are summarised in a line.
- From 2026-09-24 to 2026-09-26 two agent sessions sometimes ran side by
  side; the numbering follows the order the prompts were given. Until
  2026-09-26 the log was kept word for word, with token counts and
  session tags; the owner then asked for this edited form (prompt 57).

## 1 — 2026-09-24 · Claude Fable 5.1, high effort

```text
I want to build HyperSol WebSurfer 3D: a web browser that displays everything in 3D. It enhances regular websites and can render 3DML, a new markup language for building fully 3D websites, like an automobile site where all the cars are 3D and you can walk around them to view them. It should be fast and efficient.

A 2D website displays in a 3D space, the components of the browser are in 3D, and it can render parts of the website in 3D automatically if possible.

It needs to be open source and run on Windows, Mac, Linux, iOS, and Android.

Create the 3DML language as well, in a separate repository, at the same time, so the language and the browser work well together. Keep the language clean and open source, like HTML.

The web browser needs all the modern features, has to look slick and futuristic, has to have themes, and has to have the best privacy.

Today people use a standard web browser where everything is flat.

Use any idea notes and sketches I supply, but do not treat every drawn screen as approved scope. Ask me important questions that would help build the first version, then wait for my answers. If I do not know an answer, explain the options and recommend a simple starting choice for me to approve. After I answer, draft a short BRIEF.md. Include the user, problem, full idea, first useful result, and features for later. Leave the detailed milestone plan for the planning step.

Show me the draft. After I approve it, save BRIEF.md. Do not write app code or start another step.
```

## 2 — 2026-09-24 · Claude Fable 5.1, high effort

```text
1) General public
2) Embed an existing engine
3) Desktop only
4) Page as a floating panel in a 3D room, and page sections (header, cards, images) lifted into layered depth like a parallax (with, as a minor part, detecting images and models on the page and turning them into 3D objects)
5) Load a 3D model file, place it in a scene, and let the user walk or orbit around it, with text labels and links; also lights, materials, and animation
6) Open any normal site and see it in the 3D browser interface, with themes
7) Explain the licenses to me, and if 3DML is taken, try to find a name that is not
8) Built-in ad and tracker blocking, no telemetry, and encrypted DNS
9) Mouse, keyboard, and touch only for now
```

## 3 — 2026-09-24 · Claude Fable 5.1, high effort

Approval of the brief (BRIEF.md). This also approved the two choices the
agent recommended in it: the Apache 2.0 license for both repositories,
and the name HoloML for the language, because the name 3DML was already
taken.

```text
Approved.
```

## 4 — 2026-09-24 · Claude Fable 5.1, high effort

```text
Read BRIEF.md and inspect the project. This will be an app on my computer. Recommend a rich architecture for the first result that can support later features. Explain your choices in plain language and check what is already available.

Review any sketches and design notes I supply. Ask me to describe anything you cannot see. Explain the main screens, how a person moves between them, where information comes from, and what needs saving. Cover waiting, empty, and error states where relevant. Without sketches, suggest a simple layout for me to review.

Draft ARCHITECTURE.md with the proposed parts and files, plus a short "Screens and style" section. Record the agreed layout, shared appearance, and open questions. Separate the first result from later screens and polish. Ask only the design questions needed now; leave detailed choices for the milestone that uses them.

Explain unfamiliar terms. Mark run and test steps "not checked yet" unless they have run. Show the draft, wait for my approval, then save it. Do not write app code, install software, add services, or set up hosting without a separate approval.
```

## 5 — 2026-09-24 · Claude Fable 5.1, high effort

Answers to the questions on the ARCHITECTURE.md draft. 1, the layout
(approved: the page in the centre, tab cards in an arc on the left, a
sharp 2D top bar, and panels that slide in from the right). 3, the
camera (agree: a fixed desk view with a slight mouse parallax; free
movement comes later). 4, filter-list updates (agree: fetch updated
block lists, on by default, with a switch in Settings). 5, the default
search engine (agree: DuckDuckGo). Question 2, the default theme
(Nebula, a dark theme), got no answer here.

```text
Layout: approved.
Camera: agree.
4) Agree.
5) Agree.
```

## 6 — 2026-09-24 · Claude Fable 5.1, high effort

```text
Read BRIEF.md and ARCHITECTURE.md. Create AGENTS.md as the project instructions file for this tool, and use CLAUDE.md to point to it so other agents can read it. Confirm and use that filename. If you cannot confirm it, ask before saving.

Draft short rules: work only in this project; build only the part I approve; use only the agreed data and services; ask before adding software, deleting work, or resetting saved data. Ask when a requirement is unclear. Keep private data and secrets out. Never invent results or remove a requirement or test just to get a pass.

Use these repositories: https://github.com/srajpal/hypersol-websurfer-3d and https://github.com/srajpal/holoml. Keep the README and other things updated.

Save all prompts in PROMPTS.md, and add this note to CLAUDE.md and AGENTS.md, with the model and effort used (tokens too, if it can be done).

Add a testing section: where tests are kept, how to run them, and which earlier behavior to recheck. Include commands only after they have run; mark others "not checked yet". Show the rules and wait for approval before saving. Do not build the app. Later, propose needed rule updates for my approval.
```

## 7 — 2026-09-24 · Claude Fable 5.1, high effort

Approval of the drafted project rules: AGENTS.md, a CLAUDE.md that
points to it, and the format of this prompt log.

```text
Approve.
```

## 8 — 2026-09-24 · Claude Fable 5.1, high effort

```text
Add a history and story to the HyperSol WebSurfer 3D README.

HyperSol, LLC was formed in 2001 by Sunny Rajpal and Mauricio Sadicoff, who released version 1.0 of HyperSol WebSurfer (more information here: https://web.archive.org/web/20010922111629/http://www.hypersol.com/). At that time they had the idea for the first ever fully 3D web browser that renders sites in 3D. This is a salute to that idea on the 25th anniversary of HyperSol's formation. (Read the old web page for a bit of extra text to embellish this write-up.)

Make two folders, one for each project, so things do not get mixed up. Use your best judgement on that.

Initialize git, do the first commit, and push.
```

## 9 — 2026-09-24 · Claude Fable 5.1, high effort

```text
It all looks good. You can just use HyperSol, without the LLC or Inc., to refer to it in the future. Leave the founders' titles off. Update your docs, and write a handoff.
```

## 10 — 2026-09-24 · Claude Opus 5.5, high effort

```text
Read BRIEF.md, ARCHITECTURE.md, AGENTS.md, and any TODO.md or HANDOFF.md.

If TODO.md does not exist, propose a roadmap for the full idea, with a useful result for each milestone. Otherwise preserve its names, completed work, and results. When creating or changing the roadmap, explain where screen layout, navigation, shared style, and later polish belong, and why. Recommend tasks within feature milestones or a separate design milestone when useful, not a fixed order for every app.

Recommend the next unfinished target whose prerequisites are ready. Deal with an unresolved failure first. For a small requested change, keep the roadmap and plan only that change. Name the target and why it comes next.

Before finalizing a target that changes screens or style, review our notes and ask specific questions about the decisions still needed. Cover relevant actions, navigation, content, layout, colors, text style, and waiting, empty, or error states. Ask up to three questions at a time, wait for answers, and offer simple choices when I am unsure. Do not repeat settled questions or add every sketched screen to this build.

Break only this target into manageable tasks. Propose checks for agreed behavior, design choices, relevant failures, and earlier working features. Explain the expected results and plan any tests or sample inputs needed; I do not need to supply test files.

Show the plan. After approval, save it in TODO.md, including design tasks and checks. Propose any needed brief, design, or rules update before changing it. Keep later work listed but not approved to build. Do not write app code. Wait for separate build approval.
```

## 11 — 2026-09-24 · Claude Fable 5.1, high effort

```text
Add a rule to commit after changes; if there are a bunch of commits, remind me to push.

When a new session is started and CLAUDE.md is read, make the session a remote control session. Keep this in CLAUDE.md so it only works in Claude Code. If there is an issue with that, let me know.
```

## 12 — 2026-09-24 · Claude Opus 5.5, high effort

Answers to the milestone 1 plan's questions. Q1, the fallback if clicks
or typing fail on the tilted page (a: show the page flat and sharp, with
the 3D room around it). Q2, the parallax, the view shifting with the
mouse (a: pause it while the pointer is over the page). Q3, the window
frame (a: the standard system title bar for now).

```text
Q1: a
Q2: a
Q3: a
```

## 13 — 2026-09-24 · Claude Opus 5.5, high effort

Approval of the milestone 1 plan (a live page in the 3D room), to be
saved in TODO.md with the matching doc updates, and committed.

```text
Approved to save and commit.
```

## 14 — 2026-09-24 · Claude Fable 5.1, high effort

```text
<context>
Read BRIEF.md, ARCHITECTURE.md, AGENTS.md, and any TODO.md or HANDOFF.md (all Markdown docs).
</context>

<role>
You are a senior technical lead reviewing this project from multiple stakeholder perspectives.
</role>

<goal>
Review the documentation from four perspectives: technical, product/UX, operational, and business. For each, note strengths, risks, and gaps, and suggest improvements.
</goal>

<instructions>
1. Analyze each perspective separately.
2. Highlight contradictions or missing information across perspectives.
3. Provide actionable recommendations for each.
4. Keep each section under 200 words.
5. Think step by step before answering.
</instructions>
```

## 15 — 2026-09-24 · Claude Fable 5.1, high effort

```text
Implement, commit, and push.
```

## 16 — 2026-09-24 · Claude Opus 5.5, high effort

```text
Reread the Markdown files; some have changed. Then proceed with the install and milestone 1.
```

## 17 — 2026-09-25 · Claude Opus 5.5, high effort

Attachment: a screenshot of the app showing wikipedia.org on the tilted
panel, with text typed into Wikipedia's search box.

```text
I tested it. I was able to go to wikipedia.org, type things, and go to other sites. The text looks a little blurry, but otherwise things worked.
```

## 18 — 2026-09-25 · Claude Opus 5.5, high effort

```text
Push your changes, move on to the next milestone, and run the tests.
```

## 19 — 2026-09-25 · Claude Opus 5.5, high effort

Answers to the milestone 2 plan's questions. Q1, links that ask for a
new window (a: open as a new tab in front; Ctrl-click or middle-click
opens it behind). Q2, more tabs than fit in the arc (a: the arc scrolls,
and cards stay full size). Q3, a right-click menu and a card for
certificate errors (a: add both). The other assumptions: the focused tab
card always shows its close button, the menu holds New tab, Close tab,
and About, and cards open and close in 250 ms.

```text
Q1: a
Q2: a
Q3: a
Your other assumptions are good.
Continue with the next milestone, and test as appropriate.
Commit and push at the end.
```

## 20 — 2026-09-25 · Claude Opus 5.5, high effort

```text
The look and feel are good; approved. Pin the + card. Keep some screenshots from every milestone to show progress. Do the Electron check, use node:sqlite, and continue with milestone 3.
```

## 21 — 2026-09-25 · Claude Opus 5.5, high effort

Answers to the milestone 3 plan's questions. Q1, how to bookmark a page
(a: a star in the address bar and Ctrl+D, one flat list). Q2, how long
history is kept (a: until you clear it). Q3, what goes in Settings (a:
the search engine, what opens at startup, and clearing browsing data).
"Add the rule" approves the proposed AGENTS.md rule: save screenshots at
the end of each milestone.

```text
Q1: a, Q2: a, Q3: a. Add the rule.
```

## 22 — 2026-09-25 · Claude Opus 5.5, high effort

Approval of the final milestone 3 plan (bookmarks, history, and the
Library and Settings panels), to be saved in TODO.md and built.

```text
Approved; build. Commit and push at the end.
```

## 23 — 2026-09-25 · Claude Opus 5.5, high effort

```text
Commit and push.
```

## 24 — 2026-09-25 · Claude Opus 5.5, high effort

```text
Update your docs for the following: when you run tests, make sure the window is not above everything else, because it gets in the way. Can you continue to run tests with the windows not on top?
```

## 25 — 2026-09-25 · Claude Opus 5.5, high effort

```text
Commit if you need to, and take a look at the GitHub issues on the hypersol-websurfer-3d repository. Make any fixes you can, but if something will be addressed in a future milestone, leave a comment saying so. Tell me when you have made the commits, and I can check the PR manually.
```

## 26 — 2026-09-25 · Claude Opus 5.5, high effort

```text
Comments added to the PR; review them.
```

## 27 — 2026-09-25 · Claude Opus 5.5, low effort

```text
One P2 blocker remains: the new favicon test helper at line 195 leaves a timer running after the stream is cancelled. It produces five uncaught "Controller is already closed" errors. Although 123 assertions pass, the unit-test command fails; I reproduced this in isolation.

Cancel the pending timer and settle its promise when the stream closes, then rerun the unit suite. That is the only remaining blocker I found. Native macOS and Linux remain untested.
```

## 28 — 2026-09-26 · Claude Opus 5.5, low effort

```text
Merged the PR; continue with milestone 4.
```

## 29 — 2026-09-26 · Claude Opus 5.5, low effort

Answers to the milestone 4 plan's questions (ad and tracker blocking).
Q1, which filter lists (a: ads and trackers, from EasyList, EasyPrivacy,
uBlock Origin's lists, and Peter Lowe's list). Q2, protection before any
list is downloaded (a: ship a starter copy of the lists, refreshed
before each release). Q3, what to do when a site breaks (a: a "Pause on
this site" switch in the shield popover). E11 is milestone 3's look-and-
feel check. "Build" also approved installing the ad-blocking package.

```text
Q1: a
Q2: a
Q3: a

E11, look and feel: so far so good. I will wait to comment more until themes are introduced and the ability to break parts of the page out into 3D is working. But I like the '80s and '90s aesthetic; let's lean into that more.

Build the next milestone.
```

## 30 — 2026-09-26 · Claude Opus 5.5, low effort

Sent while milestone 4 was being built.

```text
Do some tests, and then continue to the next milestone.
```

## 31 — 2026-09-26 · Claude Opus 5.5, low effort

Answers to the milestone 5 plan's questions (depth layering). Q1, what
depth looks like (b: a layers view on demand that breaks the page apart;
the other options were subtle depth always on, or both). Q2, when it is
on (the owner's own answer, as written). Q3, image positions (a: record
them for a later milestone, with no visible feature yet).

```text
Q1: b, to start.
Q2: on by default for now, but definitely with a per-site and a global setting for whether it is on at start.
Q3: a.
Approved to build.
```

## 32 — 2026-09-26 · Claude Opus 5.5, low effort

```text
Go ahead with milestone 6, and then give me a concise list of what to test and approve, and I will do it then.
```

## 33 — 2026-09-26 · Claude Opus 5.5, low effort

Attachment: an image of dark sci-fi interface controls (glowing cyan dials,
sliders, and readouts on metal bezels with orange accents), stock art given
as a style reference.

```text
I tested all the requested items. Milestone 4: pass. Milestone 5: pass. Milestone 6: pass. The only thing about the look and feel is the size of the tabs: too large; they take up too much space on the screen. They should be smaller, and hidden unless more than one tab is open, maybe with a smaller add-tab button to open the first tab (or the keyboard shortcut). Bookmarks work. Image flattening works. Push, and then continue to the next milestone.

Let's add some UI upgrades to one of the milestones, or make a new one. We should make the UI a little busier with information about the browser, the sites, or other things. Use an example like this for the controls in the UI. Think about the DevTools console in Chrome. This should be an option that can be switched on and off in Settings. Ask questions if you need to.
```

## 34 — 2026-09-26 · Claude Opus 5.5, low effort

Sent while the tab-card change was being made.

```text
Don't change the aesthetics to match the image I sent; create controls that match our aesthetic.
```

## 35 — 2026-09-26 · Claude Opus 5.5, low effort

Answers to the questions on the new instrument panel, a panel of live
readouts like a light DevTools. Q1, where it goes in the roadmap (a: a
new milestone 7, before the first release). Q2, what it shows (the
options were page readouts, a console and network list, and browser
gauges). Q3, where it sits (the options were a dock at the bottom, a
dock on the right, or floating panels in the 3D room). The other
assumptions: off by default; turned on from Settings, a top-bar button,
or Ctrl+Shift+I; and a button that opens the full DevTools.

```text
Q1: a
Q2: all, with settings to manage them all
Q3: floating panels along the sides, and the bottom if needed
Your other assumptions are good.
Save and build.
```

## 36 — 2026-09-26 · Claude Opus 5.5, low effort

```text
There should be a button to maximize the console and the network list, so you can read them better. We also need buttons to zoom the web page in and out. We need a password manager as well, as it did not save my password. Let me know which milestone is best for these things; just keep track if it is not time yet. Everything else is approved.

The clipboard checks passed (7 test files and 126 tests passed on my run).

Continue to the next milestone.
```

## 37 — 2026-09-26 · Claude Opus 5.5, low effort

Answers to the questions on the next milestones. Q1, their order (a:
everyday browser features next, including zoom, then passwords, then the
first release). Q2, downloads (a: save straight to the Downloads folder,
with a downloads panel). Q3, private browsing (a: private tabs in the
same window, clearly marked).

```text
Q1: a
Q2: a
Q3: a
Push first, and then start the next milestone. Always push before and after a milestone as needed.
```

## 38 — 2026-09-26 · Claude Opus 5.5, low effort

Answers to the milestone 9 questions on passwords. Q1, how passwords are
protected (a: encrypted with the system's own keychain, with no master
password). Q2, where they are managed (a: a Passwords tab in the
Library). Q3, importing from another browser (a: not now). The rest is
feedback on milestone 8.

```text
Q1: a
Q2: a
Q3: a

The download worked, but there was no visual confirmation that it had finished downloading. Printing to PDF: not the best looking, but something to look into later.

I opened a private tab; it should be an option under the + sign at the top. Go ahead and accept this milestone, and commit everything. I will run some other tests and post some GitHub issues next, so do not continue to the next milestone. Use my feedback before making plans.
```

## 39 — 2026-09-26 · Claude Opus 5.5, low effort

```text
The GitHub issues are ready to view. Fix them and open a PR for review. Let me know if you have any questions.
```

## 40 — 2026-09-26 · Claude Opus 5.5, low effort

```text
Check the comments on the PR.
```

## 41 — 2026-09-26 · Claude Opus 5.5, low effort

```text
One issue still exists; check the comments on the PR.
```

## 42 — 2026-09-26 · Claude Opus 5.5, low effort

Attachment: an early HyperSol concept screen titled "HyperSpace 3D" (a
blue 3D cube over a progress bar, "Copyright 2001-2003 HyperSol, LLC"),
given as a starting point for logo ideas.

```text
The PR is merged.

Let's add these features to a list and decide when to add them:
- Reopen a closed tab
- Search tabs, and mute audio
- A site permissions panel: camera, microphone, and location requests are currently denied. Clear, per-site controls would make more everyday sites usable while preserving privacy.
- Economy mode: offer a lower rendering resolution, fewer effects, and an optional frame cap. Consider sleeping inactive tabs later, with protection for forms, audio, and downloads. Our 30-tab benchmark makes memory management worth prioritizing.
- Tab options: size (small, medium, large), auto-hide (a list in the toolbar), none (a list in the toolbar)
- An app logo (I attached an original, very early concept; let's get some ideas based on it)

I do have an important change for the repository:

Rename the current product to HyperSol HyperSpace 3D, using HyperSpace 3D as the short display name. Rename the existing GitHub repository to hypersol-hyperspace-3d and update the local remotes and relevant links. This authorizes the repository rename.

Update the branding, documentation, and project instructions consistently. Preserve historical references to the original HyperSol WebSurfer, keep HoloML unchanged, and preserve existing user profiles, bookmarks, and settings. Avoid blindly replacing internal identifiers.

Revise the README's historical claims to acknowledge the original HyperSpace 3D screenshot without claiming it shipped. Build and run the relevant tests, then report what changed and anything requiring my action.
```

## 43 — 2026-09-26 · Claude Opus 5.5, low effort

```text
You can add the original HyperSpace 3D image to the README, as well as the concept for the next step from WebSurfer. Then update the HoloML repository to match the new name. But first, evaluate whether HSML (HyperSpace Markup Language) is a better name and whether it is available. Advise me.

The milestones look good, unless you can combine parts into one. Don't worry about the local folder.
```

## 44 — 2026-09-26 · Claude Opus 5.5, low effort

```text
Keep HoloML, and update its README. Plan the next milestone. But I could not see the three images on my phone, because they are SVGs.
```

## 45 — 2026-09-26 · Claude Opus 5.5, low effort

Answers to the milestone 9 plan's questions. Q1, how passwords are
filled (b: only when you click the sign-in field and pick the account,
never automatically as the page loads). Q2, the buttons on the
permission prompt for camera, microphone, and location (a: Allow, Allow
this time, and Block). Q3, passwords on plain http sites (a: save and
fill them, with a "not secure" warning). The logo notes refer to three
logo sketches the agent drew from the early concept screen in prompt 42.

```text
Q1: b
Q2: a
Q3: a

Logo: mix 1 and 3 (I like the grid lines from 3), with no sun (a little hyperspace effect instead), and put "Now in 3D" in a cheesy '90s font, either above or on the sides of the cube.

Let me see the logos before starting on the milestone.
```

## 46 — 2026-09-26 · Claude Opus 5.5, low effort

```text
I like logo 2, but put "Now in" on one side and a bigger "3D" on the other. Then you can start the next milestone.
```

## 47 — 2026-09-26 · Claude Opus 5.5, low effort

```text
Move the Progress section from the README to its own page, and keep just a short, concise paragraph about progress in the README, with a link to the full progress page with the screenshots.
```

## 48 — 2026-09-26 · Claude Opus 5.5, low effort

```text
What is the next milestone?
```

## 49 — 2026-09-26 · Claude Opus 5.5, low effort

```text
Let's push, complete the next milestone, and then list the tests.
```

## 50 — 2026-09-26 · Claude Opus 5.5, low effort

The message was sent twice after an interruption; it is kept once.

```text
I tested everything in milestone 9 and accept it.
I tested milestone 10 and accept it.

1. I think the hiding cards behave strangely; let's leave only two options (show as cards and show as a list).
2. The address bar needs to autocomplete previous sites (like other browsers).
3. The window that displays the site needs to be wider; there is too much space on the right. Also, maybe have some adjustable settings in case you do not want so much of an angle. Think of some adjustable settings for that, and add them.
4. The settings (dots) menu needs to close if you click off it.
5. Organize Settings better, with a better look and feel, maybe with multiple levels; there are too many settings now. Allow a search in Settings to find something.
6. Show the available shortcuts somewhere, and allow remapping.
7. The Library search box should reset when changing tabs.

Commit and push the current work if it is not pushed, and show me a plan for the items I just listed.
```

## 51 — 2026-09-26 · Claude Opus 5.5, low effort

Answers to the milestone 11 plan's questions, which came from the
feedback in prompt 50. Q1, address bar completion (a: fill in the rest
of a visited site as you type, with a list of matches under the bar,
like Chrome). Q2, the Settings layout (a: sections listed on the left,
one page each, with search across all of them). Q3, the view settings
(a: how far and which way the page leans, how much the room moves, and
the space around the page, plus a "Flat and still" preset).

```text
Q1: a
Q2: a
Q3: a
```

## 52 — 2026-09-26 · Claude Opus 5.5, low effort

Approval to build milestone 11, the owner's feedback from prompt 50 with
the answers in prompt 51.

```text
Build.
```

## 53 — 2026-09-26 · Claude Opus 5.5, low effort

```text
Add a default button for the appearance in Settings (next to "Flat and still"). After that, commit and push. What is left to finish version 1?
```

## 54 — 2026-09-26 · Claude Opus 5.5, low effort

```text
I tested milestone 11 and accept it. Plan milestone 12.

Why did we choose v0.1? It should be either 1.0 or 0.8, as it has everything but the HoloML integration, right?

We should do a Windows and Linux release first, Mac second, and then mobile.

Give me the best way to do code signing and more information on updates, and let's discuss the other things one at a time. Give me questions and options for all those decisions.
```

## 55 — 2026-09-26 · Claude Opus 5.5, low effort

```text
What if we don't do builds and leave it to developers while we follow the HoloML path? How does that affect the questions asked?
```

## 56 — 2026-09-26 · Claude Opus 5.5, low effort

Answers to the milestone 12 questions, after the owner chose a source-
only release for developers (prompt 55). A, the roadmap (a: a small
developer preview as milestone 12, then HoloML). B, the version tag (a:
0.9.0, "developer preview"). C, automatic builds and tests on GitHub (a:
GitHub Actions on Windows and Linux). E, a trademark and `.holo` check
(a: now, with the results recorded). F, security reports (a: GitHub's
private vulnerability reporting). D, the legal identity, is discussed in
the rest of the prompt.

```text
A: a, B: a, C: a, E: a, F: a.

But let's discuss legal identity. HyperSol, the company, no longer exists. This is a pet project, and it is not for marketing the product at this time.
```

## 57 — 2026-09-26 · Claude Opus 5.5, low effort

Answers to the legal questions. D1, the copyright line (a: "The
HyperSpace 3D Authors", with an AUTHORS file). D2, the HyperSol name (a:
keep "HyperSol HyperSpace 3D", with a README line that the company no
longer exists and this is a personal project honouring it). D3, how
outside contributions are licensed (a: Apache 2.0's own terms, with no
extra paperwork). D4, the HoloML repository (a: the same, "The HoloML
Authors"). "Delete the folder" refers to an empty folder a graphics
driver had left in the project.

```text
D1: a, D2: a, D3: a, D4: a. Delete the folder.

Let's also review everything for privacy, not just the software but things like PROMPTS.md. I wanted a full record of how this software was made, as a demonstration of orchestrating a large software build, but I don't want any esoteric, inane, or personal information in it (and no typos). Figure out the best way to do this.

Then let's kick off whatever we need to finish HyperSpace 3D and to start on HoloML. Ask questions if you need to.
```

## 58 — 2026-09-26 · Claude Opus 5.5, low effort

Answers to the privacy and HoloML questions. P1, old text already public
in the git history (a: clean the current files only, and leave the
history). P2, names in the README story (b: keep both founders' names).
P3, the commit email from now on (b: keep the current address, not
GitHub's private one). H1, HoloML's syntax (a: HTML-like tags). H2, 3D
model files (a: glTF 2.0).

```text
P1: a, P2: b, P3: b, H1: a, H2: a.
Push and build.
```

## 59 — 2026-09-26 · Claude Opus 5.5, low effort

Answer to the question on check C9, the frame-rate test, on GitHub's
test machines, which have no graphics card. The owner chose a: skip only
the frame-rate part where Chromium draws in software, and say so in the
log; local runs keep the full check. The other options were to keep it
strict and let the Windows run fail, or to lower the bar there.

```text
A
```

## 60 — 2026-09-26 · Claude Opus 5.5, low effort

Answer to the question on computers where Chromium cannot draw WebGL 2
(the app showed an empty window).

```text
Add the message: a clear "can't draw the 3D room".
```

## 61 — 2026-09-26 · Claude Opus 5.5, low effort

```text
I accept milestone 12. Tag and release 0.9.0.
The only issue with PROMPTS.md is that some prompts are just the answers to questions I was asked, like "Q1-a" or just "A". That is not helpful for instructive purposes, so where still available, annotate them with the question that was asked, and if not available, remove the ones where the information does not provide anything useful.
```

## 62 — 2026-09-26 · Claude Opus 5.5, low effort

```text
Let's continue with milestone 13. Can you use the extension .hlml or .holoml?
```

## 63 — 2026-09-26 · Claude Opus 5.5, low effort

Answers to the milestone 13 plan's questions (HoloML v0.1). Q1, the file
extension (a: `.holoml`, which nothing else uses; `.hlml` was taken).
Q2, how strict the syntax is (a: strict and HTML-like, every mistake
stopping with its line and column). Q3, what v0.1 covers (a: everything
milestone 14 will show: models, groups, the viewpoint, lights, labels,
links, material changes, and simple animation). Q4, automatic tests for
the holoml repository (a: GitHub Actions on Windows and Linux).

```text
Q1: a, Q2: a, Q3: a, Q4: a. Build.
Remember what we discussed about annotating the prompts that are only answers.
Confirm the repository and what will go there.
```

## 64 — 2026-09-27 · Claude Opus 5.5, low effort

```text
I accept milestone 13. Plan milestone 14.
```

## 65 — 2026-09-27 · Claude Opus 5.5, low effort

Answers to the milestone 14 plan's questions (HoloML pages in the
browser). Q1, how a HoloML page appears (a: the scene fills the window
below the top bar, and the tilted panel and the room step aside while
that tab is in front). Q2, where a page's models may come from (a: the
page's own site only, for now). Q3, HoloML files on the computer (a:
open them too, with Ctrl+O or by dragging a file onto the window, with
models only from the file's folder and the folders inside it). Q4, how
the browser gets the parser and checker (a: tag the holoml repository
v0.1.0 and keep a copy of its packages here, made by a script, with a
test that the copy matches the tag). Q5, mistakes in a page (a: a syntax
error shows a card with the line and column; other problems go to the
instrument panel's console, and the rest of the scene is shown).

```text
Q1: a, Q2: a, Q3: a, Q4: a, Q5: a. Build.
```

## 66 — 2026-09-27 · Claude Opus 5.5, low effort

Sent while milestone 14 was being built.

```text
Next, address the issues in both repositories and open PRs to have them verified.
```

## 67 — 2026-09-27 · Claude Opus 5.5, low effort

Answers to where the feature requests go (GitHub issues #23 to #28). Q1,
HoloML hardening: #23 resource limits for heavy scenes, #25 keyboard and
screen-reader navigation of scenes, #28 a source and scene inspector (a:
a milestone of their own right after milestone 14, before the car
showroom). Q2, browser features: #24 HTTPS-only mode, #26 per-site
storage management, #27 bookmark import and export (a: one milestone
before the 1.0 installers).

```text
Q1: a, Q2: a.
Checking the PR.
```
