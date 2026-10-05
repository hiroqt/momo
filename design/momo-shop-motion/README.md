# Momo Shop Studio

Twelve matching shop illustrations with editable SVG masters, transparent Lottie JSON and `.lottie` exports. Momo blue bags, warm gold embossed coins, pink hearts and violet XP stars connect each illustration to its existing shop function.

All animations are 256 × 256 vectors, 30 fps, two seconds, and play once. The main object stays fixed; drawstrings, zipper pulls, vault handles, glints, transfer tokens or page corners move. Hearts reveal solid pink upward inside a stationary outline with no opacity fade. Frame 59 is the completed reduced-motion poster. Prices, balances and quantities remain accessible app text rather than being baked into artwork.

| Asset | Mobile placement | Motion |
|---|---|---|
| shop-credit-pouch | Little Pouch / 100 credits and purchase preview | Knot turns and coin glints |
| shop-credit-backpack | Momo’s Backpack / 500 credits and purchase preview | Zipper pull turns and coin glints |
| shop-credit-vault | Treasure Vault / 1500 credits and purchase preview | Vault handle turns and coin glints |
| shop-heart-single | Single Heart / single-life trade and purchase preview | Heart fills upward |
| shop-heart-five | High Five / five-life trade and purchase preview | Five hearts fill in sequence |
| shop-heart-bowl | Full Bowl / 15 lives and purchase preview | Bowl of hearts fills; quantity stays in UI |
| shop-hint-credits | Quick Hint XP trade | Coin lightbulb glints above notebook |
| shop-special-credits | Momo’s Special XP trade | Reward ribbon and coin glint |
| shop-xp-badge | XP balance | Local highlight crosses fixed badge |
| shop-exchange-credits | Credit trade confirmation | XP chip travels toward coin |
| shop-exchange-hearts | Life trade confirmation | XP chip travels toward heart, then heart fills |
| shop-xp-needed | Insufficient XP modal | Notebook page corner turns |

## Figma desktop

Prepared development plugin: `figma/manifest.json`. In Figma desktop choose Plugins → Development → Import plugin from manifest, select that file, then run **Momo Shop Studio**. It builds a **Momo · Shop Studio** page with twelve editable components and an offline animation preview. Component descriptions record their purposes. Each component has SVG and 2× PNG export settings.

The current desktop document is `https://www.figma.com/design/hFFDpvBESGefE1PCutXqZN/Untitled`. During this run its layer tree showed the shop board, final XP components, editable vectors and footer. Figma continued reporting “Connection issue affecting saving”; cloud sync and the final visible canvas could not be confirmed. The local SVGs and exports are complete. `verification/figma-status.json` records that limitation.

The plugin imports vector master artwork and plays prebuilt Lottie data. Canvas edits do not automatically rewrite animation JSON; update the builder to keep both outputs consistent. No Figma timeline export is claimed.

## Mobile

`mobile/app/shop.tsx` serves both the standalone shop route and shop tab. The typed `SHOP_MOTION` registry lazily loads these files through the existing `MomoAnimation` player, which contains artwork within its parent, preserves aspect ratio, pauses when unfocused/backgrounded and respects reduced motion. Cards use 52 px on compact phones, 64 px on larger phones and 80 px on tablets. Modals mount their animation only when visible. Existing demo purchases, XP exchanges and success behavior are preserved; this pack makes no economy or API changes.

Open `preview.html` locally to play, scrub, inspect reduced motion, or download individual files. `momo-shop-board.svg` is a portable editable overview.

## Rebuild and verify

From the repository root:

```sh
python tools/momo-shop-motion/build.py
MOMO_LOTTIE_PACKAGE=/path/to/lottie-web node tools/momo-shop-motion/build-handoff.mjs
MOMO_PLAYWRIGHT_PACKAGE=/path/to/playwright MOMO_CHROMIUM_EXECUTABLE=/path/to/chromium node tools/momo-shop-motion/verify-render.mjs
npm --prefix mobile run lint
npm --prefix mobile test
```

The Python builder uses the existing `tools/momo-motion/build.py` helpers and their requirements. The offline preview embeds lottie-web; its MIT license is included. The renderer check captures all twelve animations at frames 0, 12, 24, 40 and 59, checks movement and verifies reduced-motion controls. Native device playback remains to be reviewed on an actual phone.
