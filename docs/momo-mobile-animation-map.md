# Momo mobile animation placements

The 28-file pack remains available to the mobile app. Each illustration fits its
parent width and the current window bounds, keeps its aspect ratio, and renders
with `contain`. Requested size is a maximum; compact phones and landscape shrink
the artwork. Window changes recalculate sizing. Tablet artwork stays within its
requested size. Celebrations scroll within the available screen height, and the
sync indicator clears the safe area.

| Animation | Mobile placement | Trigger |
| --- | --- | --- |
| `momo-wave` | Welcome onboarding, step 1 | Visible onboarding step |
| `momo-welcome` | Welcome onboarding, step 2; study companion | Visible step or companion category |
| `momo-listen` | Welcome onboarding, step 3; study companion | Preferences or listening tip |
| `momo-point` | Welcome onboarding, step 4 | Study choices |
| `momo-thinking` | Welcome step 5, generation, math, tutor thinking | Visible thinking state |
| `momo-present` | Welcome step 6; completed generation | Sample preview or confirmed completed job |
| `momo-ready` | Welcome step 7, companion | Daily goal or ready to practice |
| `momo-proud` | Welcome step 8, shop, quiz completion | Sample preview, trade screen or a completed quiz with at least one correct answer |
| `momo-cheer` | Welcome step 9, intro, celebration, shop success | Completion or successful trade |
| `momo-bow` | Flashcard session completion | Finished flashcard session |
| `momo-reading` | Upload, loading, study companion, quiz completion | Reading, loading, or a completed quiz to practice again |
| `momo-rest` | Empty study library | No saved study sets |
| `momo-hero` | Empty tutor conversation | First greeting before messages |
| `streak-fire` | Home streak card | Positive server-reported daily streak |
| `streak-ignite` | Home streak card | Refreshed streak increases during the mounted home session; then fire resumes |
| `confetti-burst` | Intro and first milestone celebration | Completion; plays once |
| `confetti-gentle` | Available asset; not mounted in the current quiz results | Reserved for a future explicit milestone |
| `book-loading` | Generation progress | Job is being prepared; pauses on error |
| `document-upload` | Upload progress badge | Sending selected documents |
| `document-scan` | Upload progress badge | Reading registered documents |
| `reviewer-ready` | Generation completion | Confirmed completed generation |
| `answer-correct` | Quiz answer feedback | Checked correct answer; plays once while feedback is visible |
| `answer-retry` | Quiz answer feedback | Checked incorrect, skipped, revealed or expired answer; plays once |
| `xp-reward` | Flashcard results | Positive earned session XP |
| `coin-reward` | Shop trade success | Successful XP-to-credit trade |
| `heart-refill` | Shop trade success | Successful XP-to-heart trade; solid color fills upward |
| `offline-saved` | Study screen beneath the header | Local cache write succeeds, or cached content is opened offline |
| `sync-working` | Global sync status pill | Mutation queue actively syncing; paused while waiting to sync |

The asset registry loads JSON only when a player mounts. Hidden screens and
backgrounded apps pause playback. Reduced Motion holds the same illustration at
its poster frame and suppresses confetti. One-shot effects do not restart when a
screen regains focus. A new answer or event uses a replay key.

Source-image features remain isolated: hands, head, fists, book grips or tail
move while the torso and feet stay fixed. No source images were changed for this
integration. Backend, quota, XP and study-session logic remain the sources of
actual state.

Validation: TypeScript, mobile tests including compact/landscape/tablet sizing,
placement audit for all 28 assets, and an iOS production bundle export. Physical
native-device playback and release performance remain unverified.

## Shop asset pack

The shop adds 12 vector animations to the existing 28-animation Momo pack (40 total). Credit and life packages show matching product art, XP trades use hint/reward illustrations, confirmations show XP-to-credit or XP-to-heart exchanges, and insufficient XP shows a study notebook. See `design/momo-shop-motion/README.md` for the complete placement map. Cards resize to 52/64/80 px on compact phones, larger phones and tablets; the shared player preserves proportions and reduced-motion posters. Existing economy and demo purchase behavior are unchanged.

## Study and quiz follow-up

Flashcard answers enter with a 180 ms fade after explicit reveal; Reduced Motion reveals immediately. Quiz checks display outcome artwork, correct answer, explanation and source reference before the student taps Next. Feedback may scroll into view; this movement is immediate under Reduced Motion. New questions and restarts reset the viewport without animation. Overview uses a brief native fade, disabled under Reduced Motion. Choice and review states remain visible in text and color. Quiz results use Momo proud/reading artwork without claiming mastery.

First-session celebration shows actual XP and study-item count, with no invented streak or saved-progress claim. Its modal transition respects Reduced Motion; the scrollable content clears native safe areas and retains readable buttons on compact phones.
