# Filter lists: sources and licences

`starter.bin` is the privacy shield's blocking engine built from the
filter lists below (the ones marked "shipped"), unchanged, by
`pnpm filters:update` (apps/browser/scripts/filters-update.mjs).
`starter.json` records each list's address, size, and SHA-256, and the
date it was built. The lists are the work of their authors and keep
their own licences; they are not covered by this repository's Apache 2.0
licence.

| List | Source | Licence | Shipped |
|---|---|---|---|
| EasyList, EasyPrivacy | The EasyList authors, https://easylist.to/ | GPL-3.0-or-later, or CC BY-SA 3.0 or later (https://easylist.to/pages/licence.html) | Yes |
| uBlock Origin filters (filters, 2020 to 2024, privacy, badware, quick fixes, resource abuse, unbreak) and resources | Raymond Hill and the uAssets contributors, https://github.com/uBlockOrigin/uAssets | GPL-3.0 (https://github.com/uBlockOrigin/uAssets/blob/master/LICENSE) | Yes |
| Peter Lowe's ad and tracking server list | https://pgl.yoyo.org/adservers/ | None stated | No: downloaded by a refresh only |

All lists are fetched from Ghostery's copies at
https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/.
The full licence texts must ship alongside the app's installers
(milestone 18). THIRD-PARTY.md at the repository root lists these and
the app's other third-party parts.
