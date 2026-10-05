> Current implementation — October 5, 2026: all nine onboarding steps use
> `mobile/assets/animations/momo-motion/` through the shared MomoAnimation
> player. Original artwork remains intact; isolated feature gestures on all 13 poses replace the old
> segmented rig and sprites. Confetti uses the new one-shot vector effect.
> Earlier video, sprite atlas, vector-rig assets and their builders were removed.
> The sections below are historical design iterations. Rebuild the current pack
> with `tools/momo-motion/build.py` and `tools/momo-motion/build-handoff.mjs`.

# Momo onboarding refresh

## Direction

Keep one violet action color (`#6D5CE7`), warm text, cream canvas
(`#FFFEFC`), and restrained peach/violet background waves. Full-body Momo
retains the existing blue cap, glasses, school sweater, and yellow book.
Onboarding remains a sequence of focused decisions with a persistent footer,
visible progress, Back, and Skip. Names are optional. Long steps scroll above
the footer, including when the keyboard is open.
Muted onboarding text uses `#69627C`, and accent text on tinted surfaces uses
the existing darker violet `#5847D2`. Their minimum measured contrast against
the onboarding canvas, peach, violet-soft, and muted input surfaces is 4.90:1
and 5.49:1 respectively. White button text on `#6D5CE7` is 4.84:1.

The preview has one primary action and explains that setup is local. The former
Google-labelled action did not authenticate; it has been removed rather than
presenting local persistence as account sign-in. No authentication provider,
API, server database, or document lifecycle changes are introduced. Native
starter previews now use local SQLite tables (`preview_sets`, `preview_items`)
with an atomic save and cascading item deletion. Home refreshes
its local previews on focus and displays them before waiting for the network;
the study viewer opens a curated local preview without requesting a nonexistent
server record. Regression tests cover that local-only path and preserve remote
retrieval for ordinary study sets.
Library also loads cached previews on focus and merges them with server
results, so an empty server library cannot hide the learner's starter deck.

## Motion requirement change

The October 2, 2026 request explicitly asks for image frames animated as video.
This replaces the prior static-only requirement in PRD section 6.8(3).
The 2.65-second welcome clip plays once per mounted setup flow, is muted,
does not loop, and does not delay Continue. Each following step now has its own full-body pose and a distinct one-shot Reanimated gesture, then remains still. Only the illustration moves; question text and controls stay in place.
Reduced Motion defaults to a static frame until the preference resolves;
playback errors and loading keep the poster visible. Backgrounding pauses
playback. Completing onboarding leaves the flow; the initial gate redirects
completed users away from its routes.

## Asset provenance and build

Assets were generated using the built-in imagegen tool, using the existing
`mobile/assets/animations/welcome_momo.png` as the identity reference.
No third-party character artwork was downloaded.

Final pose-sheet prompt: extend the reference Momo to full body with blue
trousers, cream sneakers, and a curved brown tail; preserve the face, blue MOMO
cap, glasses, school sweater, tie, and yellow book; use matte tactile 3D
textures with soft top-left studio lighting; create welcome, wave, reading,
and thumbs-up poses on a genuinely transparent 2×2 atlas with all feet and
tails visible and no extra objects, effects, labels, or watermark.

Final animation-sheet prompt: a transparent square 3×3 contact sheet of nine
consecutive frames of the exact same full-body monkey gently waving; keep the
body, face, book, cap, feet, lighting, and scale consistent while changing the
forearm and palm angle; neutral, lift, hand up, outward, inward, outward,
lower, almost neutral, neutral; keep generous transparent gutters around each
figure, no grid or labels, and no text except the cap logo. The earlier 4×2
candidate was rejected because its gutters were too narrow.

Deliverables are in `mobile/assets/onboarding/`:

- Four transparent full-body pose PNGs, with the original pose atlas.
- Nine normalized transparent PNG keyframes in `frames/`, with the final wave atlas.
- `momo-welcome.mp4`: silent H.264, 500×500, 60 fps, 2.65 seconds, about 202 KB.

To rebuild the final keyframes and video, run:

```sh
node tools/build-momo-welcome.mjs
```

The tool uses FFmpeg to extract each pose, align feet and body anchors, preserve
transparent PNGs, composite the exact canvas color for H.264, interpolate
keyframes, and add short opening/closing holds. It never upscales the source
artwork. Expo Video handles native playback and lifecycle cleanup.

## Research limitation

Both Appllama skills were read and applied. The configured Appllama MCP server
currently reports `Not logged in`, and its authorization page requires Pro.
Appllama reference research and `get_credits` are therefore still outstanding;
no competitor-screen research is claimed.

## Verification

TypeScript, the project's lint command, and all eight mobile tests pass after integration.
Storage tests cover restoration into a fresh local database instance, persisted
rename/deletion, failed writes, and recovery from a failed initial read. These
adapter tests complement native checks; they do not substitute for SQLite on iOS.
The iPhone 17 simulator pass verified all eight steps, optional-name progression,
track selection, format changes, daily-goal selection, personalized preview,
completion into the study space, and opening the local Nursing flashcards.
The oversized initial poster found during verification was fixed with explicit
image dimensions and a clipped hero container. Native video text analysis is
disabled to avoid presenting incidental video controls.
The replay dialog exposes separate Cancel and Replay Guide accessibility
buttons. Its nested touchable wrappers previously grouped the entire dialog.
After rebuilding Metro's stale cache, the native skip path immediately shows
a four-card Study Skills preview; SQLite contains one set and four items.
After terminating and relaunching Expo Go, the same preview remains visible
and opens to “What is active recall?” with all four flashcards.
The iPhone 17 pass at Dynamic Type Extra Large verified the welcome, optional
name, study choices, high-school grade details, styles, daily rhythm,
personalized preview, and completion layout. With the software keyboard
visible, the name input and Next action remain above it. The recorded flow
creates a Grade 12 Mathematics preview, and Library shows both saved previews.
Reduce Motion was enabled through iOS Settings → Accessibility → Motion.
The welcome hero stayed static for eight consecutive one-second samples after
the transition (identical decoded cropped-frame hashes). The poster is visible
and Continue remains available. Simulator preferences were restored afterward.
An iPhone SE (3rd generation) simulator verified the compressed welcome,
optional name with software keyboard, daily rhythm, sample preview, and
completion into Home with four Language Learning preview cards. Backgrounding
at step 3 and reopening Expo Go retained that step and its age selection.
Topic/year/grade chips have a 44-point minimum height and announce their
selected state. Lower choices on long steps remain in a ScrollView; touch
scroll gestures still need verification because the native automation did
not move that viewport reliably.
A Pixel 8a emulator with Expo Go 57.0.9 boots the app, but native computer
control cannot attach to its standalone qemu process. The observed Android
screen was Home from an existing completed setup; this is not evidence for
Android onboarding, hardware-back, keyboard, or video verification. The test
emulator was shut down after inspection.
The iPad Pro 11-inch simulator verified the full-screen background, centered
welcome content, optional-name input with software keyboard, Skip from that
step, the completion screen, and Home with a four-card Study Skills preview.
The tablet's remaining configuration steps were not independently exercised.
The test tablet was shut down after inspection.
Simulator screenshots and recordings are kept under the ignored
`tmp/onboarding-verification/` directory. Android flow and hardware-back,
the remaining tablet steps, touch gestures, and release performance checks remain before
calling the entire flow complete. Encoding at 60 fps does not establish
60 fps application performance; release-device measurement remains separate.

## Completion audit

| Requested result | Current evidence | Status |
|---|---|---|
| Apply Appllama design skills | Installed skills, design direction, native verification notes | Applied |
| Use Appllama MCP for research | Fresh OAuth attempt still shows “Appllama MCP is part of Pro”; no MCP tools available | Blocked by account access |
| Full-body monkey assets | Four transparent poses plus source atlases | Implemented and inspected |
| Image frames animated as video | Nine PNG frames, rebuild script, local silent 2.65-second H.264 clip | Implemented and inspected |
| Full background matching the app | Violet/cream/peach canvas rendered on iPhone 17, SE, and iPad | Verified on iOS |
| User-centric onboarding | Optional name, Skip, persistent actions, tailored local preview, restart persistence | Verified on iOS |
| Smooth and clean behavior across supported platforms | iOS recordings and keyboard checks; static Reduced Motion check; type check and eight tests pass | Remaining Android/touch/release-device checks required |

The implementation is reviewable, but the full requested goal is not signed
off. The MCP access requirement has recurred across multiple goal turns and
cannot be resolved by changing application code. Native automation also cannot
control the standalone Android emulator reliably, and this workspace has no
connected release-test handset for the skill's physical-device FPS gate.

## Per-step animation and simplicity update (October 2)

> Superseded by "Per-step motion and simplification (refresh)" below. Kept for history.

The latest request replaces repeated stills with a different animation on every
onboarding screen. PRD §6.8(3) has been updated explicitly. No backend/API changes.

| Step | Distinct pose and animation | Visible decision |
| --- | --- | --- |
| Welcome | Existing frame-based wave video | Begin |
| Name | Hand-on-chest bow; small dip and return | Optional name |
| Age | Listening pose; head/body tilt and straighten | Age wheel |
| Path | Pointing pose; short motion to the right | Three initial paths, More exposes all six |
| Details | Thinking pose; small tilt and lift | Grade or year and optional subject |
| Formats | Open-book presentation; gently moves forward | Momo chooses, or expand four individual formats |
| Rhythm | Seated reading pose; settles down | Three daily targets and reminder preference |
| Preview | Closed-book presentation; proud little lift | One sample and Open action |
| Completion | Arms raised; single short hop | One study tip and Open action |

All movements end at neutral; none loops or blocks Next. Individual timing
segments are 160–280 ms. Reanimated runs transforms on the UI thread. Live
Reduce Motion changes and backgrounding cancel spatial animation and reset
the illustration. The static accessible state is the default while the OS
preference resolves. Returning from the background does not replay the gesture.

New original artwork was generated with imagegen using the existing Momo pose
atlas as its identity reference: eight isolated full-body poses on a transparent
4×2 sheet, identical cap/glasses/uniform/fur, with full feet and tails. The sheet
is `momo-step-atlas.png`; extracted poses live in `steps/`. Rebuild them using
`node tools/build-momo-steps.mjs`. The inspected 1774×887 source is cropped and
padded to 448×448 without upscaling. The poses use the same visual family as the
welcome video.

Removed repeated greetings, the notes-to-reviewer diagram, subject suggestion
chips, the ready badge, and the three-tip completion list. Grade labels and
helper copy are shorter. Expanded options preserve all original study paths and
formats; subject entry stays unrestricted. Existing local sample-deck behavior
is retained.

Fresh MCP authorization was retried for this update. The signed-in connection
page still explicitly reports “Appllama MCP is part of Pro.” No MCP research or
credit balance can be claimed. Earlier simulator evidence above applies to the
previous layout; the revised layout requires a fresh flow check. Release-device
performance, Android, and touch gesture verification remain outstanding.

### Fresh iOS evidence for the revised flow

The final build was reloaded and all eight setup steps plus completion were
recorded on iPhone 17 (`tmp/onboarding-verification/per-step-final.mp4`).
Screenshots were inspected for each new pose and concise layout. Expanded paths
expose all six options; choosing Medicine & Nursing and collapsing retains it.
Expanded formats expose all four; turning off the all-formats choice opens the
individual choices with Flashcards retained, and collapsing shows Edit formats
(1). The name remains optional; program is now explicitly optional too.
Completion from the first revised recording opened Home with the four-card
Nursing sample. Final recording includes the image-load animation-start fix and
accessible mascot wrappers. Cropped frame strips confirm the listening rotation
and completion hop; broader recording inspection does not establish release FPS.

Final `npm run lint` (TypeScript), all eight `npm test` cases, and
`git diff --check` pass. These tests cover sample-deck/offline persistence, not
visual animations. Revised keyboard interaction could not be verified because
the Device Hub controller did not focus the field and reported no available
window for coordinate input. Fresh Reduce Motion, smaller-phone/tablet, Android,
manual gesture and release-device checks remain outstanding for this revision.

### Accessibility and compact-device follow-up

iOS Settings confirmed Reduce Motion enabled. In the new recording
`per-step-reduce-motion.mp4`, decoded welcome-region frames remain identical
for consecutive seconds (hash `208a19261e8920f1856baf335d849801`). The capture
and accessibility controller disagreed about the decision-step timing, so this
recording proves the welcome fallback only; it does not prove the bow fallback.
Reduce Motion and Auto-Play Message Effects were restored to their original
values (off and on respectively); animated images/video autoplay remain on.

On the updated iPhone SE, the optional name field and Next button remain visible
above the software keyboard (`se-revised-keyboard.png`); Done dismisses it and
advances to age. A touch drag reveals More study paths while the footer stays
fixed. This resolves the previously unverified scroll gesture for this specific
compact choice list. Compact decision artwork is reduced to 128 pt (144 pt hero
slot), and path/style questions shortened to reduce initial overflow. Full-body
art remains 196 pt on larger phones. Expanded choices still scroll as needed.

## Per-step motion and simplification (refresh)

Request: every onboarding screen gets a different Momo animation, with fewer
cards and less text. Stays within PRD §6.8(3); no backend, API, or
`OnboardingContext` changes. Pose and motion per screen live in
`mobile/components/onboarding/momoSteps.ts`.

| # | Step | Pose (full-body) | Motion | Headline | Subline | Controls |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Meet Momo | welcome video | `wave-video`: existing silent wave, plays once | Less overwhelm. More "I've got this." | Turn your notes into a reviewer. | "Let's begin" |
| 2 | About you | `momo-bow` | `bow-dip`: fade in from 0.95, then a 10 pt dip and return | What should Momo call you? | Optional. | Name input |
| 3 | Your level | `momo-listen` | `head-tilt`: rotate −7° → 4° → 0 | How old are you? | Helps Momo match your pace. | Age wheel |
| 4 | Study path | `momo-point` | `slide-point`: slide in from −28 pt, nudge +10 pt toward the choices | What are you studying? | Pick the closest match. | Pills: College, High school (+ selected), "More" reveals all six |
| 5 | Study details | `momo-thinking` | `ponder-bob`: two soft lifts (−6, −4 pt) with a 3° tilt | Your study focus | This tunes your examples. | Grade or year pills + one optional text field |
| 6 | Study style | `momo-present` | `book-pop`: scale 0.92 → 1.06 → 1 | How do you like to study? | Momo can pick for you. | "Let Momo pick" pill; "Choose my own" reveals four format pills |
| 7 | Daily rhythm | `momo-rest` | `drop-settle`: drop from −22 pt, 3 pt landing settle | A little time, every day | Start with something realistic. | 10 / 20 / 45 min pills + native "Remind me daily" switch |
| 8 | Your preview | `momo-proud` | `rise-peek`: rise 18 pt with fade-in, then a 3° chin-up | Your sample is ready | {sample title} · saved on this device | "Open my sample" + Back |
| 9 | Completion (`momo-intro.tsx`) | `momo-cheer` | `double-hop`: hop −16 pt, then −6 pt, 1.04 scale on the first | You're ready{, name} | Your {topic} reviewer is waiting. | "Open my study space" |

The nine poses and nine motions are pairwise unique, enforced by
`mobile/__tests__/onboardingMomo.test.ts`.

**Assets.** The half-body `assets/animations/*.lottie.json` files are 4-second
idle loops around one embedded close-up PNG; using them would break §6.8(3)
(full-body, no loops) and mix two art styles in one flow. `magic_sparkles.json`
is a decorative sparkle layer and `momo_confetti.json` is confetti for a minor
event, both excluded by the PRD and the anti-slop rules. The flow therefore
renders no Lottie; `lottie-react-native` stays installed and unused here. No
dependency changed. Adding confetti to completion needs a PRD amendment first.

**Simplified.** Row cards became pills; icons, per-option descriptions, goal
tag badges, the "your study companion" brand line, the visible "step · n of 8"
label (kept in the progress bar's accessibility label), the completion tip line,
and the stage 8 preview card were removed. The reminder checkbox is a native
`Switch`. Stage 8 now uses the shared sticky footer CTA. All data inputs are
unchanged: name, age, track, grade/year/program, formats, daily goal, reminders.

**Motion specs.**
- Momo: one-shot, 420–700 ms, `Easing.bezier(0.23, 1, 0.32, 1)`, segments of
  160–320 ms, transform + opacity only on the UI thread. Every motion ends at
  x=0, y=0, rotate=0, scale=1, opacity=1. Plays once after the image loads.
- Content: opacity-only `FadeIn` 200 ms with 60 ms stagger on headline, subline
  and controls. No translate, so layout never shifts. Footer does not animate.
- Press: pills and primary CTAs scale to 0.97 over 120 ms (Reanimated CSS
  transition), with one light haptic per selection.
- Reduce Motion: `AnimatedMomo` keeps its live `AccessibilityInfo` listener and
  shows a static pose (static by default until the setting resolves). Screens
  skip `entering` via `useReducedMotion()`. Press feedback switches from scale to
  a 0.8 opacity dip. Backgrounding cancels and resets Momo's motion.

**Research.** No Appllama MCP tools were available in this session, so no MCP
research is claimed. Design decisions come from the appllama-app-design,
expo-animation and impeccable skill docs.

**Verification.** `npx tsc --noEmit` (exit 0), `npm run lint` (same check, exit
0), `npm test` 9/9 pass (8 existing + the new uniqueness test), and
`git diff --check` on the changed files is clean. Not verified visually in this
pass: no simulator recording or screenshots of the refreshed layout were taken.
Outstanding: on-device walk of all nine motions, Reduce Motion fallback, Android,
release-device FPS, and a Dynamic Type XL check of the pill wrapping.

## Rigged vector Momo (supersedes the two sections above)

Request: Momo should move every body part like a vector Lottie, feel more
engaging, and never sit on a circle or halo. The user chose to relax PRD
§6.8(3) (now amended) to allow looping full-body acts, one-shot pill icons and
a single confetti burst on completion.

**Rig.** `tools/build-momo-lottie.mjs` draws Momo as shape layers (no raster
images) and writes `mobile/assets/animations/momo-rig/<act>.json`. Parts, each
with its own joint pivot: head, ears, eyes (open and happy variants), glasses,
four mouths (grin, smile, "o", "hmm"), cap, torso, upper and lower arms posed by
two-bone IK, legs and a two-segment tail. A stage null scales the rig to 94% so
hops and raised arms stay inside the 512 × 512 frame. Every act is a seamless
120-frame loop at 30 fps (4 s) with blinks, breathing, ear flicks, tail sway
and cap follow-through layered on the main gesture. Rebuild with
`node tools/build-momo-lottie.mjs`.

| # | Step | Act | Main gesture |
| --- | --- | --- | --- |
| 1 | Meet Momo | `wave` | Raised arm waves in two bursts; head tilts toward it |
| 2 | About you | `tip-cap` | Hand rises to the brim, cap lifts and tips while Momo nods |
| 3 | Your level | `listen` | Hand cupped at the ear, head tilted, ear perks, two "uh-huh" nods |
| 4 | Study path | `point` | Straight arm points down to the choices with finger taps; body leans in |
| 5 | Study details | `think` | Hand on chin, eyes up, then an "aha" hop with both arms up |
| 6 | Study style | `present-book` | Holds an open book forward, a page flips, happy squint |
| 7 | Daily rhythm | `march` | Marches in place: legs lift, arms swing, body bobs |
| 8 | Your preview | `proud` | Hands on hips, chest puff, wink, foot tap |
| 9 | Completion | `cheer` | Arms-up fist pumps with squash-and-stretch hops, plus confetti once |

`mobile/__tests__/onboardingMomo.test.ts` checks that acts never repeat, files
are vector-only, at least 12 parts move per act (head, both arms, cap and tail
always), and every animated property matches at the loop point.

**App.** `MomoLottie.tsx` plays the act on every step, including the welcome
(the 3D welcome video is no longer used, so the flow keeps one art style). It
fades in with `FadeInDown` 280 ms and pauses in the background. Under Reduce
Motion it shows the act's `stillFrame` with no loop, no entrance, no confetti,
and pill icons stay still. Choice pills, the welcome feature row, the reminder
row and the preview summary use bare Hugeicons that pop in once and bounce on
select; there are no circle chips anywhere. Removed: `AnimatedMomo.tsx` (PNG
poses with halo and badge). `WelcomeMomo.tsx` and the PNG pose atlases are now
unused by onboarding.
