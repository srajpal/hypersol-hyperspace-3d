# Third-party software

HyperSpace 3D is built on other open-source projects. Each keeps its own
licence; this repository's Apache 2.0 licence covers only HyperSpace 3D's
own code. The list covers what goes into the app when it is built; tools
used only for building and testing (TypeScript, Vite, Vitest, Playwright,
ESLint, and the like) are not part of the app and are listed in the
package files.

Checked 2026-09-26 against the installed packages (their package.json
licence fields).

## Runtime

| Project | Version | Licence | Used for |
|---|---|---|---|
| [Electron](https://www.electronjs.org/) | 44.4.5 | MIT; it includes Chromium, Node.js, and V8 under their own licences (BSD-3-Clause and others), listed in Electron's `LICENSES.chromium.html` | The browser engine and the app shell |
| [Three.js](https://threejs.org/) | 0.186.0 | MIT | The 3D room |
| [Lit](https://lit.dev/) (lit, lit-html, lit-element, @lit/reactive-element, @lit-labs/ssr-dom-shim) | 3.3.3 | BSD-3-Clause | The top bar, panels, and other controls |
| [Ghostery adblocker](https://github.com/ghostery/adblocker) (@ghostery/adblocker, -electron, -electron-preload, -content, -extended-selectors, @ghostery/url-parser) | 2.18.2 | MPL-2.0 | Ad and tracker blocking, element hiding |
| @remusao/guess-url-type, small, smaz, smaz-compress, smaz-decompress, trie (used by the adblocker) | 2.1 to 2.2 | MPL-2.0 | Parts of the adblocker |
| [tldts](https://github.com/remusao/tldts) (tldts-experimental, tldts-core) | 7.4.15 | MIT | Site names for the adblocker |
| @types/trusted-types | 2.0.7 | MIT | Type definitions used by Lit |
| [HoloML](https://github.com/srajpal/holoml) parser and checker (packages/holoml, copied from the repository; the tag or branch and commit are in its SOURCE.json) | 0.2 draft | Apache-2.0, The HoloML Authors | Reading and checking HoloML pages |

The Mozilla Public License 2.0 applies file by file: the adblocker's
files stay under MPL-2.0 and their source is available from the link
above; using them does not change the licence of HyperSpace 3D's own
code.

## Test fixtures

Not part of the app. The end-to-end tests and screenshots use copies of
HoloML's examples (tests/fixtures/holoml, copied by `pnpm holoml:sync`):

- The showroom (tests/fixtures/holoml/showroom). Its cars are from
  Kenney's Car Kit (https://kenney.nl, CC0 1.0: no conditions; credited
  in its models/CREDITS.md); its pages, hall, and plinths are
  Apache-2.0, The HoloML Authors.
- Blockworld (tests/fixtures/holoml/blockworld). Its block textures are
  from Kenney's Voxel Pack, and its footsteps, breaking, placing, gem,
  chest, and winning sounds from Kenney's Impact Sounds, Interface
  Sounds, and Music Jingles (https://kenney.nl, CC0 1.0; credited in its
  models/CREDITS.md). Its page, script, block models, and the birds and
  crickets (made by a script) are Apache-2.0, The HoloML Authors.
- The sofa studio (tests/fixtures/holoml/sofa-studio). Its sofa,
  furniture, fabric, rug, and floor textures, and its studio light are
  from Poly Haven (https://polyhaven.com, CC0 1.0: no conditions;
  credited, with each artist, in its models/CREDITS.md); the sofa's
  material split, the oak and ebony pictures, and the rug's grey are
  made from them. Its pages, script, room, and rug are Apache-2.0, The
  HoloML Authors.
- Some checks use Blockworld's blocks in pages of their own
  (walls.holoml, shadows.holoml, textures.holoml, choice.holoml, and
  environment.holoml).

## Filter lists

The privacy shield's starter engine is built from public filter lists,
unchanged. They are the work of their authors and keep their own
licences:

| List | Licence |
|---|---|
| EasyList, EasyPrivacy ([easylist.to](https://easylist.to/)) | GPL-3.0-or-later, or CC BY-SA 3.0 or later |
| uBlock Origin filters and resources ([uAssets](https://github.com/uBlockOrigin/uAssets)) | GPL-3.0 |
| Peter Lowe's ad and tracking server list ([pgl.yoyo.org](https://pgl.yoyo.org/adservers/)) | None stated; not shipped, only downloaded by a list refresh |

Details, sources, and checksums: [apps/browser/resources/filters/NOTICE.md](apps/browser/resources/filters/NOTICE.md).

## Fonts, images, and other material

The app uses the system's own fonts. The images in `docs/` are made for
this project, except the 2001 to 2003 HyperSol concept screen in
`docs/history/`, shown as history.

The HoloML examples section shows a picture of each example
(apps/browser/src/renderer/examples/), taken in HyperSpace 3D by `pnpm
screenshots:examples` from the copies above; the showroom's cars and
Blockworld's blocks in them are Kenney's (CC0), and the sofa studio's
sofa, furniture, fabrics, and light are Poly Haven's (CC0).
