# Momo Motion Studio

28 animations: 13 image-backed Momo animations and 15 vector effects, built from the repository's Momo artwork. The
Figma desktop plugin contains live previews, scrubbing, playback speed,
background selection, reduced-motion preview, and JSON/dotLottie/SVG export.

Figma document: [Momo Motion Studio](https://www.figma.com/design/hFFDpvBESGefE1PCutXqZN/).

Version 5 preserves the exact original PNG bytes, shading, texture and complete
hands. Earlier segmented vector exports are superseded. All 28 exports were
rendered in Chromium; all 13 full-body poses were visually inspected. Figma
desktop reports the v3 board and updated 496 KB wave preview. Figma currently
reports changes pending reconnection; cloud sync is not confirmed.

## Deliverables

- `../../mobile/assets/animations/momo-motion/`: 28 transparent Lottie JSON files.
- `lottie/`: the same animations packaged as compressed `.lottie` files.
- `svg/`: static SVG masters with intact embedded images for Momo and editable vectors for effects. Confetti masters show a mid-burst pose.
- `momo-motion-board.svg`: complete artwork board, also directly importable into Figma.
- `momo-motion-pack.zip`: complete handoff, source artwork and rebuild tools.
- `preview.html`: standalone, offline preview with downloads; open in a browser.
- `figma/manifest.json`: importable Figma desktop development plugin. No network,
  account, paid plugin, credentials, or external asset URL is required.
- `manifest.json`: durations, playback, still frames, source references and hashes.
- `../../mobile/components/mascot/MomoAnimation.tsx`: typed Expo playback helper.
- `verification/`: rendered frames and machine-readable render verification.

The 13 full-body masters cover every individual PNG pose in
`mobile/assets/onboarding/` and `mobile/assets/onboarding/steps/`, plus the
web hero cutout. The sprite atlases and their extracted animation frames are
sequences of these poses, rather than additional independent characters.
Referenced torso portraits remain available for avatars and share cards.
The superseded onboarding rigs, unused sprite atlases, extracted video frames
and old animation builders have been removed.

See [the complete mobile placement map](../../docs/momo-mobile-animation-map.md) for all 28 live mobile placements and responsive sizing.

## Motion and app placement

| Moment | Asset | Playback |
| --- | --- | --- |
| Sign in, first welcome | `momo-welcome`, `momo-wave`, `momo-hero` | 4 s local gesture loop |
| Introduction and thanks | `momo-bow` | 4 s local gesture loop |
| Learner preferences, tutor listening | `momo-listen` | 4 s local gesture loop |
| Next action and guidance | `momo-point` | 4 s local gesture loop |
| Library, study, reading | `momo-reading` | 4 s local gesture loop |
| Tutor reasoning and math | `momo-thinking` | 4 s local gesture loop |
| Preview a reviewer | `momo-present` | 4 s local gesture loop |
| Ready to study | `momo-ready` | 4 s local gesture loop |
| Milestone, completion | `momo-proud`, `momo-cheer` | 4 s loop; dismiss with panel |
| Calm empty state or break | `momo-rest` | 4 s local gesture loop |
| Active daily streak | `streak-fire` | 2 s loop |
| New streak milestone | `streak-ignite` | 1.4 s, once |
| Quiz, onboarding, level completion | `confetti-burst`, `confetti-gentle` | 3.2 / 2.8 s, once |
| Preparing study material | `book-loading` | 2.4 s local gesture loop |
| Direct document upload | `document-upload` | 2 s loop |
| Reading document | `document-scan` | 2 s loop |
| Reviewer ready | `reviewer-ready` | 1.4 s, once |
| Quiz feedback | `answer-correct`, `answer-retry` | 0.8 s, once |
| Session rewards | `xp-reward`, `coin-reward` | 1.4 s, once |
| Heart restored | `heart-refill` | 2 s, once |
| Available offline | `offline-saved` | 1.4 s, once |
| Pending progress sync | `sync-working` | 2 s loop |

All files use a transparent 512 × 512 composition at 30 fps. Every Momo export
embeds the original full image unchanged. No alpha thresholding, tracing, colour flattening or whole-body movement is applied.
All 13 poses animate isolated source-image features with overlapping masks and
local pivots. Wave, welcome and hero wave a hand; ready moves the thumbs-up;
listen and thinking move their hands; point moves the pointing hand and cuff;
cheer moves both fists; bow nods the head; reading, present and proud move their
book grips; rest moves the tail tip. The body and feet stay fixed. Original source
bytes are shared by the feature and base layers; the joint underlap stays covered.
Rendered source comparisons allow only a small antialiased mask-edge difference
(less than 0.1% of pixels), confined to the isolated feature.

This updates PRD §6.8 to follow the user's source-quality and local-gesture
requirements. Heart refill reveals a solid pink colour from bottom to top through
a moving interior mask; the heart itself never scales or fades.

Flames flicker through contour changes with a fixed base and rising embers.
Coins turn edge-on, expose their rim and catch a moving metallic reflection.
Rewards resolve to a held finish; confetti fades completely.

Reduced Motion retains a source-pose still, holds the flame still and hides
confetti. Navigation and tab surfaces stay steady, consistent with PRD §6.8.
Animations indicate a state visually; actual completion, quota, XP, streaks and
sync results must continue to come from existing app data.

## Figma desktop

The plugin was authored for this pack. Import it using Plugins → Development →
Import plugin from manifest, select `figma/manifest.json`, then run Momo Motion
Studio. The first run imports the complete artwork board onto the current
page and names it **Momo · Motion Studio**. **Build Figma board** also selects
the board; reopening the plugin does not duplicate it on that page. Version 5
uses a separate board so the original design remains available.
The panel previews and exports the prepared Lottie animations.

SVG edits on the Figma canvas do **not** rewrite the saved motion data. Use
the source builder to regenerate animation curves after changing source art.
This is a Figma artwork board and Lottie preview/export workflow; the saved
curves are not native Figma Motion timeline objects.

Figma's supported SVG import and plugin methods are documented in
[the Figma Plugin API](https://developers.figma.com/docs/plugins/api/figma/)
and [plugin manifest reference](https://developers.figma.com/docs/plugins/manifest/).

## Expo usage

Use inside an Expo Router screen or its descendants:

```tsx
import { MomoAnimation } from '@/components/mascot/MomoAnimation';

<MomoAnimation name="momo-reading" size={240}
  accessibilityLabel="Momo reading your study material" />

<MomoAnimation name="streak-fire" size={44} active={streak > 0} />

// Change replayKey for a new completion event. Do not loop a celebration.
<MomoAnimation name="confetti-burst" size={360}
  active={completionVisible} replayKey={completedSessionId} />
```

The helper loads only the chosen source JSON, pauses on background/screen blur,
observes live OS Reduce Motion changes, and keeps one-shot animations finished
when returning to the screen. It works from bundled files without network access.
The helper is used in onboarding, completion celebrations, streak display,
upload processing, generation progress, math solving, shop rewards and the
study companion card. The web hero and three process illustrations use the
same corrected pack through `web/app/components/MomoMotion.tsx`.

Mascot JSON files are about 251–496 KB each, except the high-resolution hero
at 2.3 MB. dotLottie files compress these to about 190–375 KB and 1.7 MB for
hero. Embedded original images trade larger files for exact source fidelity.
Avoid running many mascots simultaneously. Desktop rendering was verified;
native iOS/Android performance and playback still need a release-build device
check. Keep only one full-body mascot active per visible illustration area.

## Rebuild and verify

```sh
python3 -m venv /tmp/momo-motion-venv
/tmp/momo-motion-venv/bin/pip install -r tools/momo-motion/requirements.txt
/tmp/momo-motion-venv/bin/python tools/momo-motion/build.py

# Install lottie-web in a temporary directory; no app dependency changes.
npm install --prefix /tmp/momo-motion-preview lottie-web@5.13.0
MOMO_LOTTIE_PACKAGE=/tmp/momo-motion-preview/node_modules/lottie-web \
  node tools/momo-motion/build-handoff.mjs

python3 tools/momo-motion/verify.py
cd mobile
npm run lint
npm test
```

`tools/momo-motion/verify-render.mjs` renders every animation with Playwright.
Set `MOMO_PLAYWRIGHT_PACKAGE` and, if needed, `MOMO_CHROMIUM_EXECUTABLE` to your
installed runtime paths. It checks all 13 local gestures, stationary pixels outside each feature, reduced-motion playback and
single-shot confetti, and records browser errors. Structural checks validate
Bezier topology, loop endpoint equality, package contents, source coverage, exact embedded-source bytes and unclipped image bounds.

No changes to backend APIs, database, authentication, provider or grounding
behaviour are required for this asset pack.

`verify-feature-pixels.py` checks rendered gesture isolation and increasing solid
heart-color coverage after `verify-render.mjs`. Run it with the Pillow environment.
