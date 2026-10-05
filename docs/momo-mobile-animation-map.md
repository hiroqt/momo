# Momo mobile animation placements

The complete 28-file pack is used by the mobile app. Each illustration fits its
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
| `momo-ready` | Welcome step 7, companion, quiz completion | Daily goal or ready to practice |
| `momo-proud` | Welcome step 8, shop, quiz mastery | Sample preview, trade screen or mastery |
| `momo-cheer` | Welcome step 9, intro, celebration, shop success | Completion or successful trade |
| `momo-bow` | Flashcard session completion | Finished flashcard session |
| `momo-reading` | Upload, loading, study companion | Reading or loading study material |
| `momo-rest` | Empty study library | No saved study sets |
| `momo-hero` | Empty tutor conversation | First greeting before messages |
| `streak-fire` | Home streak card | Positive server-reported daily streak |
| `streak-ignite` | Home streak card | Refreshed streak increases during the mounted home session; then fire resumes |
| `confetti-burst` | Intro and first milestone celebration | Completion; plays once |
| `confetti-gentle` | Quiz results | Mastery of at least 70%; plays once |
| `book-loading` | Generation progress | Job is being prepared; pauses on error |
| `document-upload` | Upload progress badge | Sending selected documents |
| `document-scan` | Upload progress badge | Reading registered documents |
| `reviewer-ready` | Generation completion | Confirmed completed generation |
| `answer-correct` | Quiz answer feedback | Checked correct answer; 1.25× playback fits the existing feedback interval |
| `answer-retry` | Quiz answer feedback | Checked incorrect answer; 1.25× playback |
| `xp-reward` | Quiz and flashcard results | Positive earned session XP |
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
