# Security

HyperSpace 3D is a web browser, so security problems matter even in a
developer preview.

## Reporting a problem

Please report security problems privately, through GitHub's private
vulnerability reporting: on this repository's page, open **Security**,
then **Report a vulnerability**. Do not open a public issue for them.

Include what you found, how to reproduce it, and what it could let an
attacker do. You will get an answer as soon as possible; this is a
personal project maintained in spare time, so please allow a few days.

## What is in scope

- The app's own code in this repository: the main process, the preloads,
  the shell, and how pages are isolated from it and from each other.
- How saved data (history, bookmarks, passwords, settings) is stored.
- The privacy promises in [docs/privacy.md](docs/privacy.md).

Problems in Chromium itself belong to the Chromium project, and problems
in Electron to the Electron project; the app follows Electron's stable
releases to pick up their fixes.

## Supported versions

Only the latest code on `main` and the latest release are supported.
