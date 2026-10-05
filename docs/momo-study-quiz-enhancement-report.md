# Momo study and quiz enhancement report

This extends the [five-page UI report](momo-mobile-ui-enhancement-report.md) with the same cream, lavender, violet, dimensional study icons, rounded cards, and task-specific Momo motion. Study cards, notes, quiz interaction, and session results were developed in parallel and integrated into the existing offline study route.

## What changed and why

| Area | Change | Design benefit |
| --- | --- | --- |
| Study modes | Notes, Cards, and Quiz are offered only when usable saved content exists. Switching an active session asks whether to keep studying or start the other mode. | The choices describe real material and protect students from accidentally losing a session. |
| Flashcards | Scrollable question, explicit reveal, readable answer/context, and “Got it” or “Review again” self-check. Progress counts cards actually reviewed. | Long material remains readable, while the student attempts recall before seeing the answer. |
| Study notes | Searchable, filtered reviewer cards with readable explanations and source references. | Students can find context and return to practice from one study space. |
| Quiz cards | Clear question type, labeled choices or typed answer, hint, explicit Check, feedback, and Next. | One main action at each stage makes the sequence predictable. |
| Feedback | Correct answer, explanation, and source are readable before continuing. New questions return to the top; long feedback scrolls into view. | Students can learn from each attempt without losing their place or missing feedback below the screen. |
| First-session celebration | Actual XP and study-item count, two dimensional-icon stats, wrapping buttons and safe-area scrolling; removed the invented one-day streak and unsupported saved-progress promise. | The first completion is encouraging and readable on small phones without claiming unverified progress. |
| Results | Actual correct count and earned XP, missed-question review, practice again, sharing, and Library return. Flashcard percentages say “Self-check.” | Encouragement remains connected to observable practice; self-report is not presented as verified mastery. |

## Logic and motion

- Typed grading uses normalized exact matching, including case and whitespace normalization. It rejects misleading substrings; it does not infer synonyms or partially correct answers.
- Multiple-choice letter keys and labeled answers are resolved before choices shuffle. Correctness survives repeated restarts, including options whose entire text is one letter.
- Answer commits are synchronous and idempotent within the session. Repeated Check taps and competing timeout events cannot award XP or charge a heart twice. Paid reveal is locked before charging, and immediate checking of a revealed answer earns no XP.
- Correct answers award the existing question-type XP. Wrong answers and timeouts cost one local heart; skips and paid reveals award no XP and cost no heart. Incorrect correct-answer heart refunds and streak bonus grants were removed.
- Timers pause while the app is inactive, the question overview is open, or feedback is being read. Expiry displays feedback and requires Next. Returning to a question does not reset its time.
- Answer reveal fades briefly; selected/correct/incorrect states communicate quiz decisions; Outcome artwork marks feedback, and Momo illustrates completion. Reduced Motion suppresses transition/scroll animation and uses the mascot's supported still state. Playback follows screen focus and app activity.
- Restart clears the old score and share state, then starts a new shuffled practice session. Skipping commits a skipped result rather than silently counting an unanswered question as correct.

## Validation

| Check | Result |
| --- | --- |
| Mobile unit tests | **63 passed**, including flashcard gating/final scores, valid study modes, malformed content, reviewer filtering, shuffle correctness, exact grading, duplicate commits, paid-reveal races, final XP, and feedback visibility. |
| TypeScript / mobile lint | **Passed** (`npm run lint`, which runs `tsc --noEmit`). |
| Whitespace/diff validation | **Passed** (`git diff --check`). |
| iPhone 17 Pro, iOS 26.5 | **Passed** — study reveal/self-check, Notes and Quiz mode switching, MCQ/True-False/identification/fill-in-the-blank, 3/4 correct and 50 XP, missed-answer review, restart, timeout feedback and 0 XP result. |
| Compact iPhone SE, extra-large text and system dark appearance | **Passed** — long flashcard explanations, four-card completion at 100% self-check, corrected first-session celebration and reachable controls, all four quiz types, keyboard input, missed-answer review and restart. The app keeps its configured light theme. |
| Pixel 8a, Android 17 / API 37 | **Passed** — five pages, shop dialogs, offline flashcards, native story chooser/cancel, Library return, Notes/mode switching, all four quiz types, 3/4 and 50 XP, missed-answer review/restart, timeout feedback and 0 XP. The integrated checks ran in consecutive native stages on the same development build. |
| iOS five-page/share regression | **Passed** — Dashboard, Library, Shop, AI, Settings, offline sample cards, 75% self-check, native story export/cancel, and Library return. |

Native flow scripts: `study-session.yaml`, `quiz-session.yaml`, `quiz-timer.yaml`, `compact-study.yaml`, and the combined `study-quiz-journey.yaml` in `mobile/.maestro/`. Seed local QA decks first with `seed-study-fixture.py`; its `--cleanup` option removes only those fixtures. The combined journey includes the original five-page, shop, and sharing checks.

A native iOS recording and representative frames were inspected for reveal, feedback, typed input, result, and timeout continuity. Native screenshots are saved in the Codex visualization gallery. Synthetic QA decks were removed from both iOS simulators and the Android emulator after validation; the compact-device celebration preference was restored.

## Scope and practical limits

The source-only/Nemotron generation path, authentication, document lifecycle, and retained study material are unchanged. No flashcards are silently converted into generated quiz content. Existing local preview wallet balances are preserved; this work does not establish the server-enforced production economy or payment readiness. The existing answer sync path is retained, without claiming new durable session-resume support.

Native QA decks are synthetic local fixtures seeded only into isolated simulator storage. They make all four question types, long card explanations, incorrect feedback, and timed expiry repeatable without creating remote study sets or making live AI requests. The fixture script removes only its own prefixed decks.

Instagram image handoff and fallback remain covered by the earlier report. Publishing to Instagram requires an installed account-enabled app; no posts were published. Simulator functional checks do not establish release-build frame-rate performance or physical-device accessibility/performance validation.
