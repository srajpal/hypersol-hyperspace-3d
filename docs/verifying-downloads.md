# Downloads: starting one and checking one

The portable zips are listed in the README, under
[Download](../README.md#download), and on the
[releases page](https://github.com/srajpal/hypersol-hyperspace-3d/releases).
This page has the steps for starting one the first time, and the two
ways to check that a download is the file the release made.

## Starting it the first time

Nothing is signed, so each system asks once:

- **Windows:** start `HyperSpace3D.exe` in the unzipped folder.
  SmartScreen says the app is unrecognised: choose *More info*, then
  *Run anyway*.
- **macOS:** keep `HyperSpace 3D.app` where it is or drag it to
  Applications. Gatekeeper refuses to open it: go to System Settings,
  Privacy & Security, and choose *Open Anyway* under the message about
  it; or clear the mark in Terminal with
  `xattr -dr com.apple.quarantine "HyperSpace 3D.app"`.
- **Linux:** start `./HyperSpace3D` in the unzipped folder. On Ubuntu
  24.04 and other systems that restrict user namespaces, it stops at
  once with a message about `chrome-sandbox`: give that helper its
  rights first, in the unzipped folder, with
  `sudo chown root:root chrome-sandbox && sudo chmod 4755 chrome-sandbox`.

## Checksums

Beside each zip on the releases page is its SHA-256 (a fingerprint of
the file's bytes) in a `.sha256` file. Check a download with:

- Windows: `certutil -hashfile <the zip> SHA256`
- macOS: `shasum -a 256 <the zip>`
- Linux: `sha256sum -c <the .sha256 file>`

## Build provenance attestations

From 0.9.2 on, each zip also has a build provenance attestation, a
statement signed through GitHub that it was built by this repository's
release workflow from the release's tag. Each zip's *attested* badge
in the README's download table opens its own, which names the zip's
SHA-256, the workflow, the tag, and the commit.

Check the Windows zip with [GitHub's CLI](https://cli.github.com/),
naming the workflow and the tag so that nothing else of the repository
passes:

```bash
gh attestation verify HyperSpace3D-0.9.3-windows-x64.zip -R srajpal/hypersol-hyperspace-3d --signer-workflow srajpal/hypersol-hyperspace-3d/.github/workflows/release.yml --source-ref refs/tags/v0.9.3
```

or see them all on the repository's
[attestations page](https://github.com/srajpal/hypersol-hyperspace-3d/attestations).

An attestation shows where a zip came from, not that it is safe or
free of faults, and it is not code signing, so Windows and macOS still
ask once
([issue #127](https://github.com/srajpal/hypersol-hyperspace-3d/issues/127)).
