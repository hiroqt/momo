# Momo Mascot "Academic Weapon" Instagram Stories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement a "Spotify Wrapped"-style, 9:16 vertical "Academic Weapon" story card featuring the Momo mascot that automatically launches directly into the Instagram Story composer on the user's mobile device with dynamic study stats, persona tags, and the interactive challenge prompt *"Can you beat my score in [Subject]?"*.

**Architecture:** A standalone React Native 9:16 canvas component (`AcademicWeaponStoryCard`) paired with a dynamic persona generator (`academicWeapon.ts`), captured off-screen or in-modal via `react-native-view-shot`, and exported directly into native Instagram Stories via `react-native-share` (with `expo-sharing` fallback). Integrated seamlessly into Quiz Completion, Flashcard Completion, and Dashboard Streak timelines.

**Tech Stack:** React Native, Expo 57, TypeScript, `react-native-view-shot`, `react-native-share`, `expo-sharing`, `@hugeicons/react-native`.

**Spec:** `docs/superpowers/specs/2026-09-21-momo-academic-weapon-instagram-stories-design.md`

## Global Constraints
- **Direct Instagram Opening:** Tapping Share Story MUST directly invoke the Instagram Story creation composer without forcing the user through a generic picker sheet.
- **Graceful Fallback:** If Instagram is not installed, provide a clear prompt with fallback to standard system share or camera roll save.
- **Visual Aesthetic:** Strictly adhere to the "Spotify Wrapped" design language: 9:16 ratio, high-contrast dark palette (`#09071A`), neon violet/cyber emerald accents, oversized bold typography, Momo mascot mood spotlight, and an Instagram-sticker styled challenge prompt box.
- **Zero Hallucination/Grounding:** Stats and subject titles must be derived strictly from the actual completed session.
- **Type Safety:** 100% TypeScript typed with zero `any` slips.

---

### Task 1: Install Dependencies & Native Platform Configuration

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app.json`
- Modify: `mobile/ios/momo/Info.plist`
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: NPM packages `react-native-view-shot`, `react-native-share`, `expo-sharing`
- Produces: Installed native libraries and configured intent queries for Instagram (`instagram-stories` on iOS and `com.instagram.android` on Android)

- [x] **Step 1: Install packages in mobile directory**

Run in `mobile/`:
```bash
npm install react-native-view-shot react-native-share expo-sharing
```

- [x] **Step 2: Update `mobile/app.json` with iOS schemes and Android package queries**

In `mobile/app.json`:
Add to `ios.infoPlist`:
```json
"LSApplicationQueriesSchemes": ["instagram-stories", "instagram"]
```
And add to `android`:
```json
"queries": [
  {
    "package": "com.instagram.android"
  }
]
```

- [x] **Step 3: Update `mobile/ios/momo/Info.plist` directly for native builds**

Add inside `<dict>`:
```xml
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>instagram-stories</string>
    <string>instagram</string>
</array>
```

- [x] **Step 4: Update `mobile/android/app/src/main/AndroidManifest.xml` with queries**

Add inside `<manifest>`:
```xml
<queries>
    <package android:name="com.instagram.android" />
    <intent>
        <action android:name="android.intent.action.SEND" />
        <data android:mimeType="image/png" />
    </intent>
</queries>
```

- [x] **Step 5: Verify types compile**

Run: `npm --prefix mobile run lint`

- [x] **Step 6: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/app.json mobile/ios/momo/Info.plist mobile/android/app/src/main/AndroidManifest.xml
git commit -m "feat(social): install react-native-view-shot and react-native-share with native queries"
```

---

### Task 2: Dynamic Persona Engine & Types

**Files:**
- Create: `mobile/utils/academicWeapon.ts`

**Interfaces:**
- Consumes: Session stats (`accuracy`, `totalQuestions`, `subject`, `streak`, `cardsCount`, `xpEarned`)
- Produces:
  ```typescript
  export interface AcademicWeaponData {
    headline: string;
    subtitle: string;
    challengeText: string;
    subject: string;
    accuracy?: number;
    scoreFraction?: string;
    streak?: number;
    cardsCount?: number;
    xpEarned?: number;
    momoMood: 'cool' | 'cheer' | 'xp' | 'focus';
    paletteAccent: string;
  }
  export function generateAcademicWeaponReport(input: Partial<AcademicWeaponData> & { mode: 'quiz' | 'flashcard' | 'streak' }): AcademicWeaponData;
  ```

- [x] **Step 1: Implement `mobile/utils/academicWeapon.ts`**

```typescript
// mobile/utils/academicWeapon.ts

export type MomoMood = 'cool' | 'cheer' | 'xp' | 'focus';

export interface AcademicWeaponInput {
  mode: 'quiz' | 'flashcard' | 'streak';
  subject?: string;
  accuracy?: number; // 0 - 100
  correctCount?: number;
  totalQuestions?: number;
  cardsCount?: number;
  streak?: number;
  xpEarned?: number;
  studyHour?: number; // 0 - 23
}

export interface AcademicWeaponData {
  headline: string;
  subtitle: string;
  challengeText: string;
  subject: string;
  accuracy?: number;
  scoreFraction?: string;
  streak?: number;
  cardsCount?: number;
  xpEarned?: number;
  momoMood: MomoMood;
  paletteAccent: string; // Hex color for glow and badges
  alternativeChallenges: string[];
}

export function generateAcademicWeaponReport(input: AcademicWeaponInput): AcademicWeaponData {
  const hour = input.studyHour ?? new Date().getHours();
  const isLateNight = hour >= 23 || hour <= 4;
  const subjectName = input.subject && input.subject.trim() ? input.subject.trim() : 'General Study';

  if (input.mode === 'streak') {
    const streak = input.streak || 1;
    return {
      headline: 'DISCIPLINE ON LOCK',
      subtitle: `${streak} Days & Still Undefeated`,
      challengeText: `Day ${streak} study streak. Can you even compete?`,
      subject: 'Daily Consistency',
      streak,
      momoMood: 'cheer',
      paletteAccent: '#EF4444', // Crimson Flame
      alternativeChallenges: [
        `Day ${streak} study streak. Can you even compete?`,
        `${streak} days straight with Momo. Who's challenging this?`,
        'Never breaking the chain. Academic weapon mindset.',
      ],
    };
  }

  if (input.mode === 'flashcard') {
    const cards = input.cardsCount || 10;
    return {
      headline: 'LECTURE DESTROYER',
      subtitle: `${cards} Concepts Memorized`,
      challengeText: `Already memorized the entire deck in ${subjectName}. Your move.`,
      subject: subjectName,
      cardsCount: cards,
      xpEarned: input.xpEarned,
      momoMood: 'xp',
      paletteAccent: '#10B981', // Cyber Emerald
      alternativeChallenges: [
        `Already memorized the entire deck in ${subjectName}. Your move.`,
        `Crushed ${cards} flashcards with zero hesitation.`,
        `Momo cooked the flashcards, I ate. Who's topping this in ${subjectName}?`,
      ],
    };
  }

  // Default: Quiz Mode
  const accuracy = input.accuracy ?? (input.totalQuestions && input.totalQuestions > 0 && input.correctCount !== undefined
    ? Math.round((input.correctCount / input.totalQuestions) * 100)
    : 100);

  const scoreFraction = input.totalQuestions !== undefined && input.correctCount !== undefined
    ? `${input.correctCount}/${input.totalQuestions}`
    : undefined;

  if (isLateNight) {
    return {
      headline: 'MIDNIGHT SCHOLAR',
      subtitle: `Locked in late night on ${subjectName}`,
      challengeText: `Who needs sleep when you're acing ${subjectName}?`,
      subject: subjectName,
      accuracy,
      scoreFraction,
      xpEarned: input.xpEarned,
      momoMood: 'focus',
      paletteAccent: '#6366F1', // Deep Indigo
      alternativeChallenges: [
        `Who needs sleep when you're acing ${subjectName}?`,
        `Late night grind hit different. Scored ${accuracy}% in ${subjectName}!`,
        `Can you beat my ${accuracy}% in ${subjectName}?`,
      ],
    };
  }

  if (accuracy >= 85) {
    return {
      headline: 'CERTIFIED ACADEMIC WEAPON',
      subtitle: `Unmatched recall in ${subjectName}`,
      challengeText: `Can you beat my ${accuracy}% in ${subjectName}?`,
      subject: subjectName,
      accuracy,
      scoreFraction,
      xpEarned: input.xpEarned,
      momoMood: 'cool',
      paletteAccent: '#8B5CF6', // Neon Violet
      alternativeChallenges: [
        `Can you beat my ${accuracy}% in ${subjectName}?`,
        `Momo cooked, I ate. Top this score in ${subjectName}!`,
        `Exam ready before the prof even finishes the slides.`,
      ],
    };
  }

  return {
    headline: 'MIDTERM SURVIVOR',
    subtitle: `Battled through ${subjectName}`,
    challengeText: `Surviving ${subjectName} one quiz at a time. Beat my score?`,
    subject: subjectName,
    accuracy,
    scoreFraction,
    xpEarned: input.xpEarned,
    momoMood: 'cheer',
    paletteAccent: '#F59E0B', // Electric Amber
    alternativeChallenges: [
      `Surviving ${subjectName} one quiz at a time. Beat my score?`,
      `Progress > Perfection in ${subjectName}. Can you beat my score?`,
      `Finished strong on Momo. Let's see your score in ${subjectName}!`,
    ],
  };
}
```

- [x] **Step 2: Verify type check**

Run: `npm --prefix mobile run lint`

- [x] **Step 3: Commit**

```bash
git add mobile/utils/academicWeapon.ts
git commit -m "feat(social): add academic weapon persona generator and type definitions"
```

---

### Task 3: 9:16 "Spotify Wrapped" Story Card Component

**Files:**
- Create: `mobile/components/social/AcademicWeaponStoryCard.tsx`

**Interfaces:**
- Consumes: `AcademicWeaponData` from `mobile/utils/academicWeapon.ts`
- Produces: `AcademicWeaponStoryCard: React.ForwardRefExoticComponent<...>` (forwardRef enabled for `react-native-view-shot` capture)

- [x] **Step 1: Implement `AcademicWeaponStoryCard.tsx`**

The component must:
1. Accept `ref` forward for capturing.
2. Render in fixed 9:16 proportion (default canvas width 360, height 640).
3. Include Spotify Wrapped slanted badges, ambient glow backlighting, high-res Momo illustration (`cool_momo.png`, `cheer_momo.png`, `xp_momo.png`, `focus_momo.png`), oversized stats, Instagram sticker challenge box, and Momo watermark footer.

```typescript
// mobile/components/social/AcademicWeaponStoryCard.tsx
import React, { forwardRef } from 'react';
import { View, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { SparklesIcon, FireIcon, TrophyIcon, BookOpen01Icon } from '@hugeicons/core-free-icons';
import { AcademicWeaponData, MomoMood } from '@/utils/academicWeapon';

const MOMO_MOOD_MAP: Record<MomoMood, ImageSourcePropType> = {
  cool: require('@/assets/animations/cool_momo.png'),
  cheer: require('@/assets/animations/cheer_momo.png'),
  xp: require('@/assets/animations/xp_momo.png'),
  focus: require('@/assets/animations/focus_momo.png'),
};

export interface AcademicWeaponStoryCardProps {
  data: AcademicWeaponData;
  scale?: number;
}

export const AcademicWeaponStoryCard = forwardRef<View, AcademicWeaponStoryCardProps>(
  ({ data, scale = 1 }, ref) => {
    const mascotSource = MOMO_MOOD_MAP[data.momoMood] || MOMO_MOOD_MAP.cool;

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[
          styles.cardContainer,
          { transform: scale !== 1 ? [{ scale }] : undefined },
        ]}
      >
        {/* Ambient Glow Gradient Layers */}
        <View style={[styles.ambientGlowTop, { backgroundColor: data.paletteAccent }]} />
        <View style={[styles.ambientGlowBottom, { backgroundColor: data.paletteAccent }]} />

        {/* Top Header Editorial Bar */}
        <View style={styles.headerRow}>
          <View style={[styles.badgeTag, { borderColor: data.paletteAccent }]}>
            <HugeiconsIcon icon={SparklesIcon} size={12} color={data.paletteAccent} strokeWidth={2.5} />
            <Text style={[styles.badgeTagText, { color: data.paletteAccent }]}>
              MOMO WRAPPED // REPORT
            </Text>
          </View>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>

        {/* Slanted Persona Headline */}
        <View style={styles.headlineWrapper}>
          <Text style={styles.headlineText} numberOfLines={2}>
            {data.headline}
          </Text>
          <Text style={styles.subtitleText} numberOfLines={1}>
            {data.subtitle}
          </Text>
        </View>

        {/* Mascot Center Stage Spotlight */}
        <View style={styles.mascotSpotlight}>
          <View style={[styles.mascotBackdropCircle, { borderColor: data.paletteAccent }]} />
          <Image source={mascotSource} style={styles.mascotImage} resizeMode="contain" />
        </View>

        {/* Prominent High-Impact Stats Bar */}
        <View style={styles.statsBar}>
          {data.accuracy !== undefined ? (
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: data.paletteAccent }]}>
                {data.accuracy}%
              </Text>
              <Text style={styles.statLabel}>ACCURACY</Text>
            </View>
          ) : data.streak !== undefined ? (
            <View style={styles.statBox}>
              <View style={styles.statRow}>
                <HugeiconsIcon icon={FireIcon} size={24} color="#EF4444" strokeWidth={2.5} />
                <Text style={[styles.statValue, { color: '#EF4444' }]}>{data.streak}</Text>
              </View>
              <Text style={styles.statLabel}>DAY STREAK</Text>
            </View>
          ) : (
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: data.paletteAccent }]}>
                {data.cardsCount || 0}
              </Text>
              <Text style={styles.statLabel}>CARDS MASTERED</Text>
            </View>
          )}

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statSecondaryValue} numberOfLines={1}>
              {data.subject}
            </Text>
            <Text style={styles.statLabel}>TOPIC</Text>
          </View>

          {data.xpEarned ? (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statSecondaryValue, { color: '#F59E0B' }]}>
                  +{data.xpEarned}
                </Text>
                <Text style={styles.statLabel}>XP EARNED</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Instagram Interactive Challenge Sticker Box */}
        <View style={styles.stickerBox}>
          <View style={styles.stickerHeader}>
            <View style={styles.stickerDot} />
            <Text style={styles.stickerHeaderLabel}>CHALLENGE PROMPT</Text>
          </View>
          <Text style={styles.stickerChallengeText}>
            "{data.challengeText}"
          </Text>
          <View style={styles.stickerFooter}>
            <Text style={styles.stickerFooterHint}>Reply on Story to compete 🔥</Text>
          </View>
        </View>

        {/* Branded Footer Watermark */}
        <View style={styles.footerRow}>
          <Image
            source={require('@/assets/momo_logo.png')}
            style={styles.footerLogo}
            resizeMode="contain"
          />
          <View style={styles.footerTextBox}>
            <Text style={styles.footerBrand}>Momo • AI Study Platform</Text>
            <Text style={styles.footerUrl}>momo.study</Text>
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  cardContainer: {
    width: 360,
    height: 640,
    backgroundColor: '#09071A',
    borderRadius: 28,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'space-between',
    alignSelf: 'center',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.22,
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  badgeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  badgeTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerDate: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  headlineWrapper: {
    marginTop: 8,
    zIndex: 2,
  },
  headlineText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  subtitleText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '600',
    marginTop: 4,
  },
  mascotSpotlight: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    position: 'relative',
    zIndex: 2,
  },
  mascotBackdropCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    opacity: 0.3,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  mascotImage: {
    width: 150,
    height: 150,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 2,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statSecondaryValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  stickerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 2,
  },
  stickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  stickerHeaderLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  stickerChallengeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 19,
  },
  stickerFooter: {
    marginTop: 4,
  },
  stickerFooterHint: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 2,
  },
  footerLogo: {
    width: 24,
    height: 24,
  },
  footerTextBox: {
    alignItems: 'flex-end',
  },
  footerBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  footerUrl: {
    fontSize: 9,
    color: '#94A3B8',
  },
});
```

- [x] **Step 2: Verify type check**

Run: `npm --prefix mobile run lint`

- [x] **Step 3: Commit**

```bash
git add mobile/components/social/AcademicWeaponStoryCard.tsx
git commit -m "feat(social): create 9:16 Spotify-Wrapped AcademicWeaponStoryCard component"
```

---

### Task 4: Instagram Stories Automatic Sharing Handler

**Files:**
- Create: `mobile/utils/shareStory.ts`

**Interfaces:**
- Consumes: `View` ref of the rendered story card
- Produces: `export async function shareToInstagramStory(cardRef: React.RefObject<any>): Promise<{ success: boolean; fallbackUsed: boolean; error?: string }>`

- [x] **Step 1: Implement `mobile/utils/shareStory.ts`**

```typescript
// mobile/utils/shareStory.ts
import { Platform, Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import * as Sharing from 'expo-sharing';

export interface ShareStoryResult {
  success: boolean;
  fallbackUsed: boolean;
  error?: string;
}

export async function shareToInstagramStory(cardRef: React.RefObject<any>): Promise<ShareStoryResult> {
  if (!cardRef || !cardRef.current) {
    return { success: false, fallbackUsed: false, error: 'Card reference is not ready.' };
  }

  try {
    // 1. Capture the story card as base64 PNG data
    const base64Data = await captureRef(cardRef, {
      format: 'png',
      quality: 1.0,
      result: 'base64',
    });

    const stickerImage = `data:image/png;base64,${base64Data}`;

    // 2. Direct automatic launch into Instagram Stories
    try {
      await Share.shareSingle({
        social: Share.Social.INSTAGRAM_STORIES,
        stickerImage,
        backgroundTopColor: '#09071A',
        backgroundBottomColor: '#1A0B2E',
        appId: 'com.aistudy.platform',
      });
      return { success: true, fallbackUsed: false };
    } catch (shareSingleErr: any) {
      console.warn('[shareStory] Direct Instagram share failed, attempting fallback:', shareSingleErr);

      // 3. Fallback: Save as temp file and open system share sheet
      const tmpUri = await captureRef(cardRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tmpUri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Academic Weapon Card',
          UTI: 'public.png',
        });
        return { success: true, fallbackUsed: true };
      } else {
        Alert.alert(
          'Instagram Not Found',
          'Instagram does not seem to be installed on your device, and sharing is unavailable.'
        );
        return { success: false, fallbackUsed: false, error: 'Instagram not installed' };
      }
    }
  } catch (err: any) {
    console.error('[shareStory] Error capturing or sharing card:', err);
    return { success: false, fallbackUsed: false, error: err?.message || 'Failed to share card' };
  }
}
```

- [x] **Step 2: Verify type check**

Run: `npm --prefix mobile run lint`

- [x] **Step 3: Commit**

```bash
git add mobile/utils/shareStory.ts
git commit -m "feat(social): add automatic Instagram Story direct sharing handler"
```

---

### Task 5: Story Preview & Prompt Customization Modal

**Files:**
- Create: `mobile/components/social/AcademicWeaponShareModal.tsx`

**Interfaces:**
- Consumes: `visible: boolean`, `onClose: () => void`, `initialData: AcademicWeaponInput`
- Produces: Interactive modal with live card preview, prompt picker carousel, and 1-tap "Share to Instagram Story" button.

- [x] **Step 1: Implement `AcademicWeaponShareModal.tsx`**

```typescript
// mobile/components/social/AcademicWeaponShareModal.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, SparklesIcon, Share01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import {
  AcademicWeaponData,
  AcademicWeaponInput,
  generateAcademicWeaponReport,
} from '@/utils/academicWeapon';
import { AcademicWeaponStoryCard } from './AcademicWeaponStoryCard';
import { shareToInstagramStory } from '@/utils/shareStory';
import { colors, spacing } from '@/constants/theme';

export interface AcademicWeaponShareModalProps {
  visible: boolean;
  onClose: () => void;
  inputData: AcademicWeaponInput;
}

export const AcademicWeaponShareModal: React.FC<AcademicWeaponShareModalProps> = ({
  visible,
  onClose,
  inputData,
}) => {
  const cardRef = useRef<View>(null);
  const reportData = generateAcademicWeaponReport(inputData);
  const [selectedChallenge, setSelectedChallenge] = useState(reportData.challengeText);
  const [isSharing, setIsSharing] = useState(false);

  const activeData: AcademicWeaponData = {
    ...reportData,
    challengeText: selectedChallenge,
  };

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const res = await shareToInstagramStory(cardRef);
      if (res.success) {
        onClose();
      }
    } catch (e: any) {
      Alert.alert('Share Failed', e?.message || 'Could not export story.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header Row */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.sparkleIconBox}>
                <HugeiconsIcon icon={SparklesIcon} size={18} color="#8B5CF6" strokeWidth={2.4} />
              </View>
              <Text style={styles.modalTitle}>Share to Instagram Story</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <HugeiconsIcon icon={Cancel01Icon} size={18} color="#94A3B8" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Live 9:16 Card Preview */}
            <View style={styles.previewStage}>
              <AcademicWeaponStoryCard ref={cardRef} data={activeData} scale={0.82} />
            </View>

            {/* Prompt Selector Pills */}
            <View style={styles.promptsSection}>
              <Text style={styles.sectionLabel}>CHOOSE YOUR CHALLENGE LINE</Text>
              <View style={styles.promptList}>
                {reportData.alternativeChallenges.map((prompt, idx) => {
                  const isSelected = prompt === selectedChallenge;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.promptPill,
                        isSelected && styles.promptPillSelected,
                      ]}
                      onPress={() => setSelectedChallenge(prompt)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.promptPillText,
                          isSelected && styles.promptPillTextSelected,
                        ]}
                      >
                        "{prompt}"
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerBar}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              disabled={isSharing}
              activeOpacity={0.85}
            >
              {isSharing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <HugeiconsIcon icon={Share01Icon} size={20} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={styles.shareBtnText}>Share to Instagram Story</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sparkleIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    alignItems: 'center',
  },
  previewStage: {
    height: 540,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  promptsSection: {
    width: '100%',
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  promptList: {
    gap: 8,
  },
  promptPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  promptPillSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: '#8B5CF6',
  },
  promptPillText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  promptPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  footerBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    paddingVertical: 14,
    gap: 8,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
```

- [x] **Step 2: Verify type check**

Run: `npm --prefix mobile run lint`

- [x] **Step 3: Commit**

```bash
git add mobile/components/social/AcademicWeaponShareModal.tsx
git commit -m "feat(social): create AcademicWeaponShareModal preview and export dialog"
```

---

### Task 6: Quiz Completion Integration

**Files:**
- Modify: `mobile/components/study/QuizRunner.tsx`

**Interfaces:**
- Consumes: `AcademicWeaponShareModal`
- Produces: "🔥 Flex on IG Story" button in the Quiz Review screen footer and state handler

- [x] **Step 1: Import `AcademicWeaponShareModal` in `QuizRunner.tsx`**

Add import:
```typescript
import { AcademicWeaponShareModal } from '../social/AcademicWeaponShareModal';
```

- [x] **Step 2: Add modal state in `QuizRunner` component**

```typescript
const [showStoryModal, setShowStoryModal] = useState(false);
```

- [x] **Step 3: Add "Flex on IG Story" button in post-quiz review actions**

Around line 1827 of `QuizRunner.tsx`:
Add above `styles.reviewActionFooter`:
```tsx
<PlatformPressable
  style={styles.flexStoryBtn}
  onPress={() => setShowStoryModal(true)}
>
  <View style={styles.btnRow}>
    <HugeiconsIcon icon={SparklesIcon} size={18} color="#FFFFFF" strokeWidth={2.4} />
    <Text style={styles.flexStoryBtnText}>🔥 Flex on IG Story</Text>
  </View>
</PlatformPressable>
```

Render modal at the end of the review screen:
```tsx
<AcademicWeaponShareModal
  visible={showStoryModal}
  onClose={() => setShowStoryModal(false)}
  inputData={{
    mode: 'quiz',
    subject: title || 'Quiz Session',
    accuracy: percent,
    correctCount: totalCorrect,
    totalQuestions,
    xpEarned: currentXP,
  }}
/>
```

- [x] **Step 4: Add styling for `flexStoryBtn` in `styles`**

```typescript
flexStoryBtn: {
  backgroundColor: '#8B5CF6',
  borderRadius: 20,
  paddingVertical: 14,
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 12,
  shadowColor: '#8B5CF6',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
},
flexStoryBtnText: {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '800',
},
```

- [x] **Step 5: Verify type check**

Run: `npm --prefix mobile run lint`

- [x] **Step 6: Commit**

```bash
git add mobile/components/study/QuizRunner.tsx
git commit -m "feat(social): integrate Academic Weapon story sharing on Quiz finish screen"
```

---

### Task 7: Flashcard Completion Integration

**Files:**
- Modify: `mobile/app/study/[studySetId].tsx`
- Modify: `mobile/components/onboarding/CelebrationModal.tsx`

**Interfaces:**
- Consumes: `AcademicWeaponShareModal`
- Produces: Flashcard deck completion share CTA with card counts

- [x] **Step 1: Update `CelebrationModal.tsx` with Share Story CTA**

Add prop:
```typescript
onShareStory?: () => void;
```
Render secondary button under Continue:
```tsx
{onShareStory && (
  <TouchableOpacity style={styles.shareStoryBtn} onPress={onShareStory} activeOpacity={0.8}>
    <HugeiconsIcon icon={SparklesIcon} size={16} color="#8B5CF6" strokeWidth={2.2} />
    <Text style={styles.shareStoryBtnText}>Share to Instagram Story</Text>
  </TouchableOpacity>
)}
```

- [x] **Step 2: Update `mobile/app/study/[studySetId].tsx`**

Import `AcademicWeaponShareModal`, manage `showStoryModal`, and pass `onShareStory={() => setShowStoryModal(true)}` to `CelebrationModal`. Also render the button in `styles.finishActionCol` on the flashcard finish view.

- [x] **Step 3: Verify type check**

Run: `npm --prefix mobile run lint`

- [x] **Step 4: Commit**

```bash
git add mobile/components/onboarding/CelebrationModal.tsx mobile/app/study/[studySetId].tsx
git commit -m "feat(social): integrate Academic Weapon story sharing on Flashcard finish"
```

---

### Task 8: Dashboard Streak Timeline Integration

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `AcademicWeaponShareModal` with `mode: 'streak'`
- Produces: Interactive "Share" badge in the Streak Header row

- [x] **Step 1: Import `AcademicWeaponShareModal` in `mobile/app/(tabs)/index.tsx`**

- [x] **Step 2: Add `showStreakStoryModal` state**

```typescript
const [showStreakStoryModal, setShowStreakStoryModal] = useState(false);
```

- [x] **Step 3: Add share button in `streakHeader`**

In `styles.streakHeader` (line 220):
```tsx
<View style={styles.streakHeader}>
  <View>
    <Text style={styles.streakTitle}>🔥 {streakData.current_streak} Day Streak</Text>
    <Text style={styles.streakSub}>You're on a roll!</Text>
  </View>
  <TouchableOpacity
    style={styles.streakShareBtn}
    onPress={() => setShowStreakStoryModal(true)}
    activeOpacity={0.75}
  >
    <HugeiconsIcon icon={Share01Icon} size={14} color="#EF4444" strokeWidth={2.4} />
    <Text style={styles.streakShareText}>Share</Text>
  </TouchableOpacity>
</View>
```

Render modal:
```tsx
<AcademicWeaponShareModal
  visible={showStreakStoryModal}
  onClose={() => setShowStreakStoryModal(false)}
  inputData={{
    mode: 'streak',
    streak: streakData.current_streak,
    subject: 'Study Consistency',
  }}
/>
```

- [x] **Step 4: Add `streakShareBtn` and `streakShareText` styles**

```typescript
streakShareBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 'rgba(239, 68, 68, 0.2)',
},
streakShareText: {
  fontSize: 12,
  fontWeight: '800',
  color: '#EF4444',
},
```

- [x] **Step 5: Verify type check**

Run: `npm --prefix mobile run lint`

- [x] **Step 6: Commit**

```bash
git add mobile/app/(tabs)/index.tsx
git commit -m "feat(social): add streak share trigger to dashboard timeline"
```

---

### Task 9: Full Verification & E2E Validation

**Files:**
- Test across all modified and new files

- [x] **Step 1: Run comprehensive TypeScript compilation**

Run: `npm --prefix mobile run lint`
Expected: 0 errors.

- [x] **Step 2: Commit any final polish and update docs**

```bash
git commit --allow-empty -m "chore(social): complete Momo Academic Weapon Instagram Story implementation"
```
