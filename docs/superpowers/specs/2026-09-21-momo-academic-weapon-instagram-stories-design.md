# Design Specification: Momo Mascot "Academic Weapon" Instagram Stories Subsystem

- **Date:** 2026-09-21
- **Status:** Approved
- **Scope:** Architectural / Feature Subsystem
- **Author:** Antigravity Pairing Assistant

---

## 1. Executive Summary & Vision

The **Momo Academic Weapon Instagram Stories Subsystem** enables students to transform study triumphs—such as acing a difficult quiz, finishing an intense flashcard deck, or maintaining an unbroken daily study streak—into viral, aesthetic, "Spotify Wrapped"-style 9:16 vertical cards tailored for Instagram Stories.

Rather than posting plain scoreboards or generic app screenshots, the card pairs the expressive personality of **Momo** (the mascot) with culturally authentic student language ("Academic Weapon", "Lecture Destroyer", "Discipline on Lock") and an interactive challenge sticker prompt (*"Can you beat my 94% in Organic Chemistry?"*).

This design prioritizes organic social proof and self-expression, converting student pride into a viral growth loop.

---

## 2. Dynamic Persona & Challenge Engine

The subsystem includes a deterministic engine (`mobile/utils/academicWeapon.ts`) that maps study session performance to tailored editorial personas, color schemes, challenge lines, and Momo mascot moods.

### 2.1 Persona Matrix

| Trigger / Condition | Persona Title | Subtitle | Mascot Mood Asset | Default Challenge Prompt | Palette Accent |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Quiz Accuracy ≥ 85%** | `CERTIFIED ACADEMIC WEAPON` | `Unmatched recall in {subject}` | `cool_momo.png` (sunglasses) | `"Can you beat my {accuracy}% in {subject}?"` | Neon Violet (`#8B5CF6`) |
| **Quiz Accuracy 60% – 84%** | `MIDTERM SURVIVOR` | `Battled {total} questions in {subject}` | `cheer_momo.png` | `"Surviving {subject} one quiz at a time. Beat my score?"` | Electric Amber (`#F59E0B`) |
| **Flashcard Deck Completed (≥ 15 cards)** | `LECTURE DESTROYER` | `{cardCount} Concepts Memorized` | `xp_momo.png` | `"Already memorized the entire deck. Your move."` | Cyber Emerald (`#10B981`) |
| **Active Streak Milestone (≥ 3 days)** | `DISCIPLINE ON LOCK` | `{streak} Days & Still Undefeated` | `cheer_momo.png` | `"Day {streak}. Can your study streak even compete?"` | Crimson Flame (`#EF4444`) |
| **Late Night Study (11:00 PM – 4:30 AM)** | `MIDNIGHT SCHOLAR` | `Locked in at {time}` | `focus_momo.png` | `"Who needs sleep when you have Momo?"` | Deep Indigo (`#6366F1`) |

### 2.2 Customizable Challenge Taglines
Users can cycle through 3-4 witty challenge prompts before exporting:
1. *"Can you beat my score in {subject}?"*
2. *"Momo cooked, I ate. Who's topping this?"*
3. *"Exam ready before the professor even finishes the slides."*
4. *"Zero cramming, pure recall."*

---

## 3. Visual & Component Architecture

### 3.1 Component Hierarchy

```text
mobile/
├── components/
│   └── social/
│       ├── AcademicWeaponStoryCard.tsx   # 9:16 aspect ratio canvas container (1080x1920 logical)
│       └── AcademicWeaponShareModal.tsx  # Interactive preview modal with tagline switcher & export CTA
├── utils/
│   ├── academicWeapon.ts                 # Persona calculation, taglines, and mascot selection
│   └── shareStory.ts                     # Native view-shot snapshotting & Instagram Story export handler
```

### 3.2 "Spotify Wrapped" Visual Identity
The card is rendered with an exact 9:16 aspect ratio (`width: 360`, `height: 640` in preview, scaled to full resolution on capture):
1. **Background Canvas:** Deep obsidian black (`#09071A`) with ambient radial gradient glows using the active palette accent.
2. **Brutalist Header:** Slanted badge tag (`MOMO WRAPPED // ACADEMIC REPORT`) with oversized bold uppercase typography (`Poppins-Bold`).
3. **Mascot Spotlight:** Center-stage hero presentation of the Momo mascot with subtle ambient glow and animated floating elevation.
4. **Hero Stat Pill Grid:**
   - Primary metric (e.g. `94% ACCURACY`, `14-DAY STREAK`, or `50 CARDS`).
   - Secondary badges (XP earned, date/time, subject tag).
5. **Interactive Instagram Story Sticker Box:**
   - Styled to mimic Instagram's native quiz/question sticker: bright white container with dark text, rounded corners (`borderCurve: 'continuous'`), and quotation styling.
6. **Watermark & Attribution:**
   - Bottom branded bar with `momo_logo.png`, app store handle, and `momo.study • AI Study Platform`.

---

## 4. Technical Export Pipeline

### 4.1 Required Dependencies
To render and share high-resolution images natively on Expo:
- `react-native-view-shot`: Captures the `AcademicWeaponStoryCard` offscreen or in-modal ref as a high-density PNG.
- `expo-sharing`: Invokes the native platform share dialog on iOS and Android with image MIME type.

### 4.2 Sharing Flow

```text
User Taps "Flex on IG Story"
           ↓
Open AcademicWeaponShareModal (Card Preview + Prompt Picker)
           ↓
User Taps "Share to Instagram Story"
           ↓
captureRef(cardViewRef, { format: 'png', quality: 1.0 })
           ↓
Check Instagram Deep Link (instagram-stories://share)
     ├── Available on Device → Pass sticker asset / launch IG Stories
     └── Fallback → Sharing.shareAsync(uri) with system share sheet
```

---

## 5. User Journey & Entry Points

### 5.1 Quiz Review Screen (`mobile/components/study/QuizRunner.tsx`)
- On the post-quiz review screen (`isQuizFinished === true`), above or alongside the action buttons, a high-prominence gradient button:
  - **🔥 Flex on IG Story**
- Automatically populates the quiz subject/document title, percentage accuracy, correct/total count, and XP earned.

### 5.2 Flashcard Session Complete (`mobile/app/study/[studySetId].tsx` & `CelebrationModal.tsx`)
- On flashcard completion, the modal offers:
  - **Share Academic Weapon Card**
- Populates total flashcards mastered, session duration, and deck title.

### 5.3 Dashboard Streak Timeline (`mobile/app/(tabs)/index.tsx`)
- In the `styles.streakHeader` row (`🔥 {streak} Day Streak`), a dedicated **Share Streak** icon/pill button is added.
- Tapping triggers the modal with the user's active streak count, milestone tier, and discipline challenge prompt.

---

## 6. Verification & Quality Plan

1. **Static Typing & Lints:**
   - Ensure all new TypeScript interfaces (`AcademicWeaponData`, `PersonaConfig`, etc.) compile cleanly via `tsc --noEmit`.
2. **Snapshot Fidelity:**
   - Verify that the captured image contains no clipped text, preserves high resolution across retina iOS and Android displays, and respects continuous border curves.
3. **Graceful Fallbacks:**
   - If Instagram is not installed on the user's device, verify that the system share sheet opens seamlessly so the user can save to camera roll or share to other apps.
4. **Performance:**
   - View shot capture must execute asynchronously without blocking the UI thread or freezing the preview modal.
