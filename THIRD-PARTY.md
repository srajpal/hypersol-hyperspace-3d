# Third-party software

HyperSpace 3D is built on other open-source projects. Each keeps its own
licence; this repository's Apache 2.0 licence covers only HyperSpace 3D's
own code. The list covers what goes into the app when it is built; tools
used only for building and testing (TypeScript, Vite, Vitest, Playwright,
ESLint, and the like) are not part of the app and are listed in the
package files.

Checked 2026-09-30: the Runtime table against the installed packages
(each one's package.json version and licence field) and pnpm-lock.yaml,
and the test fixtures against each example's own models/CREDITS.md. The
filter lists' licences are as recorded on 2026-09-26 (their sources were
not read again), and the pictures in `docs/` were not gone through
again.

## Runtime

| Project | Version | Licence | Used for |
|---|---|---|---|
| [Electron](https://www.electronjs.org/) | 44.7.0 | MIT; it includes Chromium, Node.js, and V8 under their own licences (BSD-3-Clause and others), listed in Electron's `LICENSES.chromium.html` | The browser engine and the app shell |
| [Three.js](https://threejs.org/) | 0.186.1 | MIT | The 3D room, and the HoloML viewer (with the loaders and controls from its examples) |
| The decoders of compressed glTF files, as three.js carries them in its examples (examples/jsm/libs): [Draco](https://github.com/google/draco)'s glTF decoder (draco/gltf), the [Basis Universal](https://github.com/BinomialLLC/basis_universal) transcoder (basis), and [meshoptimizer](https://github.com/zeux/meshoptimizer)'s decoder (meshopt_decoder.module.js) | as in three.js 0.186.1 | Apache-2.0 (Draco, Google; Basis Universal, Binomial), MIT (meshoptimizer, Arseny Kapoulkine) | Reading HoloML models whose geometry or pictures are compressed (milestone 25) |
| [Lit](https://lit.dev/) (lit and lit-html 3.3.3, lit-element 4.2.2, @lit/reactive-element 2.1.2, @lit-labs/ssr-dom-shim 1.6.0) | 3.3.3 | BSD-3-Clause | The top bar, panels, and other controls |
| [Ghostery adblocker](https://github.com/ghostery/adblocker) (@ghostery/adblocker, -electron, -electron-preload, -content, and -extended-selectors, all 2.18.2; @ghostery/url-parser 1.3.1) | 2.18.2 | MPL-2.0 | Ad and tracker blocking, element hiding |
| @remusao/guess-url-type, small, and trie (2.1.0); smaz, smaz-compress, and smaz-decompress (2.2.0); all used by the adblocker | 2.1.0 to 2.2.0 | MPL-2.0 | Parts of the adblocker |
| [tldts](https://github.com/remusao/tldts) (tldts-experimental, tldts-core) | 7.4.15 | MIT | Site names for the adblocker |
| @types/trusted-types | 2.0.7 | MIT | Type definitions used by Lit |
| [HoloML](https://github.com/srajpal/holoml) parser and checker, and its scene API in Web IDL (packages/holoml, copied from the repository; the tag or branch and commit are in its SOURCE.json) | 0.3 (its first edition, 2026-10-07; HoloML's own packages are at 0.2.2 until 0.3 is tagged) | Apache-2.0, The HoloML Authors | Reading and checking HoloML pages |

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
- Harbour Loft (tests/fixtures/holoml/harbour-loft). Its furniture,
  lamps, and plants, the textures of its floors, tiles, worktop
  splashback, brick wall, fabrics, and decking, and the harbour (Simon's
  Town harbour: the sky and the light) are from Poly Haven
  (https://polyhaven.com, CC0 1.0; credited, with each artist, in its
  models/CREDITS.md); the recoloured duvet and floor tiles and the
  re-encoded pictures are made from them. Its pages, script, the walls,
  windows, doors, kitchen, bathroom, bed, wardrobe, and terrace (made by
  its script), the floor plan, and the door and switch sounds are
  Apache-2.0, The HoloML Authors.
- The sneaker store (tests/fixtures/holoml/sneaker-store). Its shoe is
  "Materials Variants Shoe" © 2021 Shopify, Inc., from the Khronos glTF
  Sample Assets (https://github.com/KhronosGroup/glTF-Sample-Assets),
  under the Creative Commons Attribution 4.0 International licence (CC BY
  4.0, https://creativecommons.org/licenses/by/4.0/; credited, with every
  change made to it, in its models/CREDITS.md, and on its about page):
  seven of its ten colourways are recoloured from its picture, and the
  mark on its heel and the lettering on its sole are painted out, as the
  licence leaves out logos and trademarks. Its pages, scripts, hall,
  bays, bench, counter, plants, turntable, and chime (made by its
  script) are Apache-2.0, The HoloML Authors. Since milestone 25 the
  shoe's shapes are compressed with Draco by its tools (glTF Transform).
- The ocean tunnel, an aquarium (tests/fixtures/holoml/aquarium). Its
  fish, as its models/CREDITS.md lists them:
  - Great white shark: "shark.glb" by the Babylon.js authors,
    https://github.com/BabylonJS/Assets/blob/master/meshes/shark.glb,
    CC BY 4.0.
  - Hawksbill sea turtle: "Hawksbill Turtle" by Bindestrek,
    https://sketchfab.com/3d-models/bd6c9327fd52469782f055a182659bd2,
    CC BY 4.0.
  - Gilt-head bream: "Bream Fish ( Dorade Royale)" by BlueMesh,
    https://sketchfab.com/3d-models/a3d0e1a597794a9bb74739a13cfc8b77,
    CC BY 4.0.
  - Atlantic mackerel: "Mackerel" by Amy Scott-Murray,
    https://sketchfab.com/3d-models/4e73d0ba00744cd7af781ff44637b0a7,
    CC BY 4.0.
  - Barramundi: "Barramundi Fish" by Microsoft,
    https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/BarramundiFish,
    CC0 1.0.
  - Grey snapper: "greySnapper_vertColor.glb (from the underwater scene
    demo)" by the Babylon.js authors,
    https://github.com/BabylonJS/Assets/tree/master/meshes/Demos/UnderWaterScene/fish,
    CC BY 4.0.
  - Tuna: "Tuna Fish" by GoldenZtuff,
    https://sketchfab.com/3d-models/c5fad940863f47f784d792ca95e16b42,
    CC BY 4.0.
  - Clownfish: "Clownfish" by zixisun02,
    https://sketchfab.com/3d-models/47ba2679d91a4f14b3fc0bf8e3805af5,
    CC BY 4.0.
  - Copperband butterflyfish: "Copperband Butterflyfish" by Dsanchez13,
    https://sketchfab.com/3d-models/f96d04dc6ccb4fe4861622ea24fae361,
    CC BY 4.0.

  CC BY 4.0 is the Creative Commons Attribution 4.0 International
  licence (https://creativecommons.org/licenses/by/4.0/); CC0 1.0 is at
  https://creativecommons.org/publicdomain/zero/1.0/. Each fish was
  changed for the tank by the example's tools, as its CREDITS.md says:
  its materials made drawable by three.js, turned, sized, and centred,
  its pictures made smaller, where its file had no swim, given a
  skeleton and one (made for the example), and the great white shark and
  the mackerel made lighter (fewer triangles). Since milestone 25 each
  fish also has a lighter version for far away (<fish>-far.glb), made
  from it by the example's tools (glTF Transform), under the fish's own
  licence and credit. The fish are credited on the example's about page
  too.

  The turtle was replaced on 2026-09-30. Until then it was a flatback
  sea turtle by DigitalLife3D, credited here and in HoloML as CC BY 4.0.
  That was wrong: the file's own licence stamp says CC BY-NC 4.0, which
  does not allow commercial use (found by the review of 2026-09-30). The
  hawksbill turtle takes its place, and HoloML's tools now stop when a
  file's stamp disagrees with its credit. Pictures taken before the
  change still show the old turtle until they are taken again: the
  ocean tunnel's picture in the HoloML examples section
  (apps/browser/src/renderer/examples/aquarium.jpg) and the progress
  screenshots of the ocean tunnel in which the turtle can be seen (61
  and 63 in docs/screenshots/m21 and m22).

  What each licence rests on, from the example's CREDITS.md: the
  Sketchfab models (the turtle, bream, mackerel, tuna, clownfish, and
  butterflyfish) come from Objaverse, the Allen Institute for AI's copy
  of Sketchfab's free models
  (https://huggingface.co/datasets/allenai/objaverse), and each file
  carries Sketchfab's own stamp of its author and licence. The shark's
  and the snapper's files carry no stamp: their licence rests on the
  Babylon.js asset library's own statement (its README says the work is
  under CC BY 4.0 unless an asset's folder says otherwise, its LICENSE
  file is that licence's text, and neither file's folder says otherwise;
  read 2026-09-30, at commit ddad48e).

  Its boulder, log, shell, and sand are from Poly Haven
  (https://polyhaven.com, CC0 1.0; credited, with each artist, in its
  models/CREDITS.md), the boulder, the log, and the shell made lighter.
  Its pages, script, tank, tunnel, gallery, plants, bubbles, food, air
  stones, and sounds (made by its tools) are Apache-2.0, The HoloML
  Authors.
- Words in a room (tests/fixtures/holoml/words): text only, Apache-2.0,
  The HoloML Authors.
- The compressed test models (tests/fixtures/holoml/compressed,
  milestone 25, check HL4), made by its make.mjs from Khronos's glTF
  Sample Assets (https://github.com/KhronosGroup/glTF-Sample-Assets),
  each download recorded with its SHA-256: "Box" and "Box Textured",
  © 2017 Cesium, and a picture of "Chronograph Watch" (its
  carbon-fibre normal map), © 2025 Darmstadt Graphics Group GmbH, all
  under CC BY 4.0, as its CREDITS.md says.
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

The starter engine (apps/browser/resources/filters/starter.bin) is used
and passed on under the GNU General Public License, version 3: uBlock
Origin's filters and resources are under it, and EasyList and
EasyPrivacy, which offer a choice of two licences, are taken under it
as well. The licence's full text is in the repository, beside the
engine:
[apps/browser/resources/filters/GPL-3.0.txt](apps/browser/resources/filters/GPL-3.0.txt).
uBlock Origin's resources are scripts the blocker runs inside web
pages; they are fetched only when the starter engine is built, never by
the app's own list refresh.

Details, sources, and checksums: [apps/browser/resources/filters/NOTICE.md](apps/browser/resources/filters/NOTICE.md).

## Fonts, images, and other material

The app uses the system's own fonts. The images in `docs/` are made for
this project, except the 2001 to 2003 HyperSol concept screen in
`docs/history/`, shown as history.

The HoloML examples section shows a picture of each example
(apps/browser/src/renderer/examples/), taken in HyperSpace 3D by `pnpm
screenshots:examples` from the copies above; the showroom's cars and
Blockworld's blocks in them are Kenney's (CC0), and the sofa studio's
sofa, furniture, fabrics, and light and Harbour Loft's furniture,
textures, and harbour are Poly Haven's (CC0), the sneaker store's
shoe is Shopify's "Materials Variants Shoe" (CC BY 4.0, as above), and
the ocean tunnel's fish are those credited above (CC BY 4.0, and the
barramundi CC0), among Poly Haven's rocks, log, and sand (CC0). The
ocean tunnel's picture was taken before its turtle was replaced (see
above), so the turtle in it is still the flatback by DigitalLife3D,
whose licence is CC BY-NC 4.0 (non-commercial); the picture is to be
taken again with `pnpm screenshots:examples`.
