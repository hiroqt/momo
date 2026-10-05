# Momo native regression flows

Start Metro and install the Expo development build on an isolated iOS Simulator or Android emulator. These flows use the offline four-card onboarding preview; they do not require an AI provider, network account, payment, or Instagram login.

From the repository root:

```sh
maestro --udid <device-id> test mobile/.maestro/all-pages.yaml --test-output-dir /tmp/momo-ui-validation
```

Use a fresh test profile, or one with the four-card preview and less than 500 XP. Bootstrap finishes the optional guest preview onboarding and returns to Home. A journey awards 45 local XP, so reset the isolated test profile before it reaches the XP guard threshold. The flows retain data by default.

- `pages.yaml`: five screens, library search/clear, shop categories, AI modes and return navigation.
- `shop-confirmations.yaml`: disclosed purchase preview, cancel, insufficient XP and return to studying.
- `study-share.yaml`: three correct cards and one review-again, 75% self-check, Story preview, native PNG handoff and return to Library.
- `all-pages.yaml`: combined journey.
- `compact-layout.yaml`: compact screen navigation, Settings shortcut and AI return; run after setting the test device to extra-large system text.

Run only one iOS Simulator driver at a time. Screenshots and Maestro diagnostics are written outside the repository. On iOS, dismissing the native share sheet preserves the preview. Expo's Android chooser API does not report cancellation; the preview remains usable after a generic handoff, without claiming a published Story. An installed Instagram app and a physical device are needed to verify its actual draft/posting behavior.

## Study and quiz validation

Seed the synthetic mixed deck and timed quiz into an isolated installed development build. Seeding stops the app so its SQLite cache can be changed safely, and preserves other decks. Complete guest preview onboarding first.

```sh
python3 mobile/.maestro/seed-study-fixture.py ios <simulator-uuid>
# Android: use --adb /absolute/path/to/adb if adb is not on PATH
python3 mobile/.maestro/seed-study-fixture.py android <emulator-id>
maestro --udid <device-id> test mobile/.maestro/study-quiz-journey.yaml --test-output-dir /tmp/momo-study-validation
```

- `study-session.yaml`: reveal, self-check, mode-switch confirmation, Notes and Quiz entry.
- `quiz-session.yaml`: shuffled MCQ, True/False, identification and fill-in-the-blank; one wrong answer, explanations, actual final XP, missed-answer review and restart.
- `quiz-timer.yaml`: expiry retains feedback until Next, then a zero-score/zero-XP result.
- `compact-study.yaml`: cold-launch four-card self-check with a long explanation and completion; use extra-large system text.
- `study-quiz-journey.yaml`: the original five-page/shop/share journey followed by all new study/quiz checks.

The mixed quiz earns 50 local XP, costs one heart, and the timed quiz costs another heart. Use an isolated test profile with sufficient hearts and below the shop's XP guard threshold. These are native functional tests, not live AI or production-economy tests.

Remove only the seeded QA decks after testing:

```sh
python3 mobile/.maestro/seed-study-fixture.py ios <simulator-uuid> --cleanup
python3 mobile/.maestro/seed-study-fixture.py android <emulator-id> --cleanup
```
