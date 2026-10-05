# Momo mobile UI enhancement report

The five screens now share a calmer study identity: violet actions, warm cream and lavender surfaces, rounded cards, readable hierarchy, and consistent navigation. Momo stays close to the learning task, while the primary action remains easy to find.

Dashboard/Library, AI/Settings, and Shop/Share were developed in parallel, then integrated through shared icons, theme tokens, navigation and native regression fixes.

## What changed and why

| Area | Enhancement | Benefit for studying |
| --- | --- | --- |
| Dashboard | A prominent study-session card, shortcuts to notes and Momo, readable streak calendar, and illustrated deck rows. Empty decks are excluded from the study action. | Students can start studying immediately or see how to create their first set. UTC streak dates match the backend's study-day records. |
| Library | A clear Add notes action, search, selected format/folder states, larger touch targets, and study cards with separated titles, metadata, and actions. | Finding a reviewer takes less effort; long titles and narrow screens have more room. Existing local storage and queued mutations remain intact. |
| Shop | Credits, lives, and XP exchanges have distinct categories and illustrated packs. Confirmation dialogs explain the reward and cost. Preview purchases are visibly disclosed. | Students can compare study support without confusing XP, credits, and quiz lives. Listed prices do not imply that a payment was taken. |
| Momo AI | Ask Momo, Review, and Visuals are presented as focused modes with useful starting prompts, a clear composer, and loading/error states. | Students can choose a task before composing a request and understand when work is in progress. |
| Settings | Study preferences, upload usage, privacy, and offline guidance appear in separate readable cards. Account loading, unavailable usage, and guest preview states are explicit. | Students can understand their study routine and data retention without technical details or invented account information. |
| Instagram sharing | A branded portrait story preview presents the reviewer, self-check score, earned XP, and available study metrics. The final flashcard answer is included; three correct answers out of four produce 75% and 45 XP. The native handoff carries the actual PNG, with image-sharing and save/export fallbacks. | Students can share a reviewable image; the UI distinguishes opening a share sheet from saving or publishing a story. |

## Visuals and motion

Shared dimensional SVG icons use gradients, extruded edges, and soft shadows to give books, cards, folders, and study tools a consistent clay-like appearance. They remain small illustrations beside readable text labels.

Motion describes a feature or outcome: streak ignition, listening/thinking/reading poses, pack previews, XP trades, heart refills, and reward feedback. Resting catalog artwork and dashboard study artwork use still frames. Reduced Motion displays suitable still artwork; playback pauses when the app or study page is inactive. Tabs keep visible labels and their state. Expo Router owns tab selection and Back behavior, so returning from AI restores the selected page. Lazy screens retain their own input and scroll state. Tab changes do not slide, and motion does not replace action labels or status text.

## Validation

| Check | Result |
| --- | --- |
| Mobile unit tests | **42 passed**. Coverage includes page decisions, filters, quotas, shop rules, motion assets, story handoff/fallbacks, capture dimensions, and flashcard score calculation. |
| TypeScript / mobile lint command | **Passed** (`tsc --noEmit`). |
| Combined native journey: iPhone 17 Pro, iOS 26.5 | **Passed** — five pages, shop preview/cancel, XP guard, offline flashcards, 75% result, native PNG export, share-sheet cancellation, and return to Library. |
| Combined native journey: Pixel 8a, Android 17 / API 37 | **Passed** — five pages and AI return navigation, purchase preview/cancel, insufficient-XP guard, offline flashcards, 75% result, native image chooser and return to Library. |
| Compact iPhone SE, extra-large system text | **Passed** — all five screens, Settings-to-Library shortcut and AI return navigation. The app retains its configured light theme with the system in dark appearance. |
| Exported native PNGs | **Verified** at 1080 × 1920 pixels from the iOS and Android captured files. |

Native flows are saved in `mobile/.maestro/`: `bootstrap.yaml`, `pages.yaml`, `shop-confirmations.yaml`, `study-share.yaml`, and the combined `all-pages.yaml`, plus `compact-layout.yaml`. They cover the five screens, library filtering, shop dialogs, offline sample flashcards, self-check results, and the story preview/export controls.

## Practical limits preserved

- Purchases remain a disclosed preview; no real payment verification is claimed. XP exchanges use the existing local economy.
- Guest account details and unavailable upload usage are shown honestly. Account sign-out is not connected in this preview.
- Actual Instagram posting requires the installed Instagram app and cannot be verified on the current emulator setup. No published posts were attempted.
- The Nemotron generation path and source-only grounding requirements are unchanged. Original uploads remain temporary for 3 days; generated study material remains persistent. Creating new material still requires internet.
- Native simulator checks do not establish release-build frame-rate performance or production authentication/payment readiness.

## Study and quiz follow-up

The later study-card, notes, and quiz enhancement is documented in [Momo study and quiz enhancement report](momo-study-quiz-enhancement-report.md). It adds a consistent practice flow, long-content layouts, deterministic grading, safe option shuffling, reward/reveal guards, and native study/quiz regression flows. The validation table above records the original five-page enhancement snapshot; the companion report records the final expanded checks.
