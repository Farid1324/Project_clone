# Product metadata provenance

Product descriptions/requirements and cover artwork have separate provenance. The November 23 cover update replaces symbolic title cards with downloaded game covers and appropriate gift-card demo designs, while retaining original promotional illustrations. See [artwork provenance](artwork-provenance.md) for every image source and edition check.

`backend/database/seeders/data/product-details.json` contains 36 original, short game summaries (24 PC titles and 12 console titles) authored for this assignment, plus normalized Windows requirement snapshots for the 24 PC titles. Both regional Stardew Valley listings share the game's summary/specifications. Gift-card descriptions, console/gift-card device/account requirements, compatibility notices, delivery text and activation steps are authored in `DemoMarketplaceSeeder`. All 45 seeded product variants receive metadata.

PC specifications were fetched November 19, 2026 UTC (November 20 locally) from Steam's public store app-details JSON endpoint at `https://store.steampowered.com/api/appdetails?appids=<app-id>&l=english`, using `pc_requirements.minimum` and `pc_requirements.recommended`. Each record retains its actual captured_at and store source_url. Source HTML was normalized offline into plain-text technical label/value pairs; no marketing description or external artwork was imported during that requirements-only milestone. The subsequent artwork update is documented separately. Empty recommended sections remain empty rather than invented. The local raw/import tooling is ignored, and no application/seed runtime depends on Steam being reachable.

The public API app IDs were checked against their returned names. The 24 sources are listed below; specifications may change, so each product page links its current source. These are Windows snapshots, not OS compatibility guarantees. Older publisher entries such as Stardew Valley still list older Windows versions; the page separately explains the current Steam Windows client's Windows 10-or-later requirement, as shown on the [Steam Stardew Valley listing](https://store.steampowered.com/app/413150/Stardew_Valley/). Some Steam packages now use expanded names (for example a remaster/GOTY label); source facts do not certify the demo's fictional edition/entitlement.

| Demo title | Steam source |
| --- | --- |
| Elden Ring | [1245620](https://store.steampowered.com/app/1245620/) |
| Cyberpunk 2077 | [1091500](https://store.steampowered.com/app/1091500/) |
| Baldur's Gate 3 | [1086940](https://store.steampowered.com/app/1086940/) |
| Hogwarts Legacy | [990080](https://store.steampowered.com/app/990080/) |
| Red Dead Redemption 2 | [1174180](https://store.steampowered.com/app/1174180/) |
| The Witcher 3: Wild Hunt | [292030](https://store.steampowered.com/app/292030/) |
| Stardew Valley | [413150](https://store.steampowered.com/app/413150/) |
| Hollow Knight | [367520](https://store.steampowered.com/app/367520/) |
| Hades | [1145360](https://store.steampowered.com/app/1145360/) |
| Disco Elysium: The Final Cut | [632470](https://store.steampowered.com/app/632470/) |
| Terraria | [105600](https://store.steampowered.com/app/105600/) |
| No Man's Sky | [275850](https://store.steampowered.com/app/275850/) |
| Sid Meier's Civilization VI | [289070](https://store.steampowered.com/app/289070/) |
| Cities: Skylines | [255710](https://store.steampowered.com/app/255710/) |
| Euro Truck Simulator 2 | [227300](https://store.steampowered.com/app/227300/) |
| Celeste | [504230](https://store.steampowered.com/app/504230/) |
| Dead Cells | [588650](https://store.steampowered.com/app/588650/) |
| Slay the Spire | [646570](https://store.steampowered.com/app/646570/) |
| Subnautica | [264710](https://store.steampowered.com/app/264710/) |
| Portal 2 | [620](https://store.steampowered.com/app/620/) |
| Sekiro: Shadows Die Twice | [814380](https://store.steampowered.com/app/814380/) |
| Dark Souls III | [374320](https://store.steampowered.com/app/374320/) |
| Resident Evil 4 | [2050650](https://store.steampowered.com/app/2050650/) |
| DOOM Eternal | [782330](https://store.steampowered.com/app/782330/) |

Activation guidance was paraphrased into short backend-managed steps using official platform support references:

- Steam games: [Steam key activation support](https://help.steampowered.com/en/faqs/view/2A12-9D79-C3D7-F870). Steam gift-card steps use wallet-code redemption rather than the game activation menu.
- Microsoft/Xbox: sign in to the intended Microsoft account and redeem at redeem.microsoft.com, consistent with [Microsoft account redemption guidance](https://support.microsoft.com/en-us/accessibility/microsoft-account/use-a-screen-reader-to-manage-your-account-billing-and-subscriptions).
- Nintendo: account/region and the eShop's Enter Code/Redeem Code menu, based on [Nintendo Americas support](https://en-americas-support.nintendo.com/app/answers/detail/a_id/22429/p/897/c/186) and [Nintendo UK support](https://www.nintendo.com/en-gb/Support/Troubleshooting/How-to-Redeem-a-Download-Code-on-Nintendo-eShop-1226548.html).
- PlayStation gift cards: Redeem Code and account-country matching, based on [PlayStation voucher support](https://www.playstation.com/en-us/support/store/redeem-ps-store-voucher-code/).

All prices, seller ratings, gift-card denominations/regions, entitlements and stock are fictional fixtures. Region notices describe the demo's seeded Global/Europe/US rules, not an externally verified eligibility service. No user should attempt redemption: every inventory key is nonredeemable, and payment/delivery remain disabled. Source links exist to explain the modeled compatibility facts and to check current real-world requirements, not to imply platform affiliation.
