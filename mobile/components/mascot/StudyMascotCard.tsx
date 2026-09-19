import React, { useState, useRef, useEffect } from "react";
import { colors, mascotColors, spacing, typography } from "@/constants/theme";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Easing,
} from "react-native";
import { AppText as Text } from "@/components/common/app-text";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import Svg, { Circle, Path, Rect, G, Ellipse } from "react-native-svg";
import {
  getDailyStudyQuote,
  getRandomStudyQuote,
  StudyQuote,
} from "../../lib/data/studyQuotes";

// Import the Lottie JSON mascot animation

/**
 * High-fidelity Vector SVG Chibi Monkey component with dynamic animations that
 * change based on the active study quote (Focus bounce for Lock In, Sassy wobble for Real Talk,
 * Ethereal float for Manifesting, Studious nod for Scholar Era, Neural pulse for Brain Gains, etc.).
 *
 * Momo's eyes are modeled directly after the delete & end confirmation modal:
 * large obsidian pupils with pure-white upper catchlight reflections, secondary sparkles,
 * bottom iris highlights, and zero eyebrows for a pure cute chibi look.
 */

import { Image } from 'react-native';

export interface DynamicChibiMomoProps {
  quote: StudyQuote;
  isBouncing?: boolean;
}

export function DynamicChibiMomo({ quote, isBouncing = false }: DynamicChibiMomoProps) {
  let source;
  switch (quote.category) {
    case 'lock_in': source = require('../../assets/animations/thinking_momo.png'); break;
    case 'real_talk': source = quote.vibe === 'funny' ? require('../../assets/animations/cool_momo.png') : require('../../assets/animations/thinking_momo.png'); break;
    case 'manifesting': source = require('../../assets/animations/happy_momo.png'); break;
    case 'scholar_era': source = require('../../assets/animations/thinking_momo.png'); break;
    case 'brain_gains': source = require('../../assets/animations/thumbs_up.png'); break;
    case 'boss_energy': source = require('../../assets/animations/cool_momo.png'); break;
    case 'dopamine_check': source = require('../../assets/animations/happy_momo.png'); break;
    default: source = require('../../assets/animations/thinking_momo.png'); break;
  }
  return <Image source={source} style={{ width: 94, height: 94 }} resizeMode="contain" />;
}

export interface StudyMascotCardProps {
  onPressAction?: () => void;
}

export function StudyMascotCard({ onPressAction }: StudyMascotCardProps) {
  const [currentQuote, setCurrentQuote] = useState<StudyQuote>(() =>
    getDailyStudyQuote(),
  );
  const [isBouncing, setIsBouncing] = useState(false);

  // Animation values for interactive tap feedback & quote transition
  const mascotScale = useRef(new Animated.Value(1)).current;
  const mascotRotate = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(1)).current;
  const bubbleTranslateY = useRef(new Animated.Value(0)).current;

  const handleNextQuote = () => {
    // Spring bounce and playful wiggle on mascot
    setIsBouncing(true);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(mascotScale, {
          toValue: 0.88,
          duration: 80,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(mascotScale, {
          toValue: 1.12,
          friction: 4,
          tension: 180,
          useNativeDriver: true,
        }),
        Animated.spring(mascotScale, {
          toValue: 1,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(mascotRotate, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(mascotRotate, {
          toValue: -1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(mascotRotate, {
          toValue: 0.5,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(mascotRotate, {
          toValue: 0,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setIsBouncing(false);
    });

    // Smooth transition of the quote text
    Animated.sequence([
      Animated.parallel([
        Animated.timing(bubbleOpacity, {
          toValue: 0.08,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(bubbleTranslateY, {
          toValue: -3,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      const nextQuote = getRandomStudyQuote(currentQuote.id);
      setCurrentQuote(nextQuote);

      Animated.parallel([
        Animated.spring(bubbleOpacity, {
          toValue: 1,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(bubbleTranslateY, {
          toValue: 0,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const isFunny = currentQuote.vibe === "funny";

  const rotateDeg = mascotRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-5deg", "0deg", "5deg"],
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handleNextQuote}
      activeOpacity={0.92}
      accessibilityLabel="Momo study quotes card, tap for a new vibe"
    >
      {/* Top Header Row: Mascot, Names, Gen Z Badges */}
      <View style={styles.topRow}>
        <View style={styles.mascotInfo}>
          {/* Enhanced Mascot Avatar Box */}
          <Animated.View
            style={[
              styles.mascotBox,
              {
                transform: [{ scale: mascotScale }, { rotate: rotateDeg }],
              },
            ]}
          >
            <View style={styles.mascotAura} />
            <DynamicChibiMomo quote={currentQuote} isBouncing={isBouncing} />
          </Animated.View>

          {/* Title and Category Tag Column */}
          <View style={styles.headerTextCol}>
            <View style={styles.nameRow}>
              <Text style={styles.mascotName}>Momo</Text>
              <View style={styles.buddyBadge}>
                <HugeiconsIcon
                  icon={SparklesIcon}
                  size={11}
                  color={colors.warning}
                  strokeWidth={2.4}
                />
              </View>
            </View>

            {/* Subtitle / Status Line */}
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.statusText}>AI Companion • Ready</Text>
            </View>

            {/* Category Tags Row */}
            <View style={styles.tagRow}>
              <View
                style={[
                  styles.categoryChip,
                  isFunny ? styles.funnyChip : styles.seriousChip,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isFunny ? styles.funnyText : styles.seriousText,
                  ]}
                >
                  {currentQuote.categoryLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Enhanced Quote Speech Container (Full Width, Zero Overlapping) */}
      <View style={styles.speechContainerWrapper}>
        <View style={styles.speechArrow} />
        <Animated.View
          style={[
            styles.speechContainer,
            {
              opacity: bubbleOpacity,
              transform: [{ translateY: bubbleTranslateY }],
            },
          ]}
        >
          <Text style={styles.quoteText}>“{currentQuote.quote}”</Text>
          <View style={styles.quoteDivider} />
          <View style={styles.quoteFooter}>
            <View style={styles.authorBadge}>
              <Text style={styles.authorSparkle}>✦</Text>
              <Text style={styles.quoteAuthor}>{currentQuote.author}</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing[16],
    marginBottom: spacing[20],
    borderWidth: 1,
    borderColor: colors.primarySoftStrong,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing[12],
  },
  mascotInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[14],
    flex: 1,
  },
  mascotBox: {
    width: 98,
    height: 98,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  mascotAura: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surface,
    opacity: 0.85,
  },
  lottieView: {
    width: 94,
    height: 94,
  },
  svgContainer: {
    width: 94,
    height: 94,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextCol: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: spacing[4],
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
    marginBottom: spacing[3],
  },
  mascotName: {
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.text,
    letterSpacing: typography.letterSpacing[-0.3],
  },
  buddyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: 8,
    gap: spacing[3.5],
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  buddyBadgeText: {
    fontSize: typography.fontSize[9.5],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.warning,
    letterSpacing: typography.letterSpacing[0.4],
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    marginBottom: spacing[6],
  },
  onlineDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: colors.successAccent,
  },
  statusText: {
    fontSize: typography.fontSize[11.5],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
    letterSpacing: typography.letterSpacing[-0.1],
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[9],
    paddingVertical: spacing[3.5],
    borderRadius: 20,
    gap: spacing[5],
    borderWidth: 1,
  },
  funnyChip: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
  },
  seriousChip: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoftStrong,
  },
  categoryEmoji: {
    fontSize: typography.fontSize[12],
  },
  categoryText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing[-0.1],
  },
  funnyText: {
    color: colors.danger,
  },
  seriousText: {
    color: colors.primaryPressed,
  },
  speechContainerWrapper: {
    position: "relative",
    marginTop: spacing[2],
  },
  speechArrow: {
    position: "absolute",
    top: -5,
    left: 43.5,
    width: 11,
    height: 11,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.border,
    transform: [{ rotate: "45deg" }],
    zIndex: 2,
  },
  speechContainer: {
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[14],
    paddingBottom: spacing[13],
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3.5,
    borderLeftColor: colors.primaryLight,
  },
  quoteText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text,
    lineHeight: typography.lineHeight[21.5],
    letterSpacing: typography.letterSpacing[-0.15],
  },
  quoteDivider: {
    height: 1,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing[11],
    marginBottom: spacing[8],
    opacity: 0.8,
  },
  quoteFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
  },
  authorSparkle: {
    fontSize: typography.fontSize[9.5],
    color: colors.primaryLight,
  },
  quoteAuthor: {
    fontSize: typography.fontSize[11.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    letterSpacing: typography.letterSpacing[0.1],
  },
});
