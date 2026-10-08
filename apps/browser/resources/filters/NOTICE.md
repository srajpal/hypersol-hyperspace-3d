# Filter lists: sources and licences

`starter.bin` is the privacy shield's blocking engine built from the
filter lists below (the ones marked "shipped"), unchanged, by
`pnpm filters:update` (apps/browser/scripts/filters-update.mjs).
`starter.json` records each list's address, size, and SHA-256, the date
it was built, and the SHA-256 of `starter.bin` itself. The lists are the
work of their authors and keep their own licences; they are not covered
by this repository's Apache 2.0 licence.

`starter.bin` is used and passed on under the GNU General Public License,
version 3, whose full text is beside this file in `GPL-3.0.txt`: uBlock
Origin's filters and resources are under GPL-3.0, and EasyList and
EasyPrivacy, which offer a choice of two licences, are taken under
GPL-3.0 as well. The lists' texts, from which `starter.bin` can be built
again with `pnpm filters:update`, are at the addresses in `starter.json`.

| List | Source | Licence | Shipped |
|---|---|---|---|
| EasyList, EasyPrivacy | The EasyList authors, https://easylist.to/ | GPL-3.0-or-later, or CC BY-SA 3.0 or later (https://easylist.to/pages/licence.html) | Yes |
| uBlock Origin filters (filters, 2020 to 2024, privacy, badware, quick fixes, resource abuse, unbreak) and resources | Raymond Hill and the uAssets contributors, https://github.com/uBlockOrigin/uAssets | GPL-3.0 (https://github.com/uBlockOrigin/uAssets/blob/master/LICENSE) | Yes |
| Peter Lowe's ad and tracking server list | https://pgl.yoyo.org/adservers/ | None stated | No: downloaded by a refresh only |

All lists are fetched from Ghostery's copies at
https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/.
The uBlock Origin resources are scripts the blocker runs inside web
pages. They are fetched only when `starter.bin` is built; the app's own
daily refresh downloads the list texts and keeps the scripts it came
with.

`GPL-3.0.txt` and this file must ship alongside any packaged build of
the app (the project makes none; CONTRIBUTING.md, "Making your own
build"). THIRD-PARTY.md at the repository root lists
these and the app's other third-party parts.
