import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Keyboard,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { AppText as Text } from '@/components/common/app-text';
import { colors, spacing, typography } from '@/constants/theme';

interface AgeScrollPickerProps {
  value: number;
  onChange: (age: number) => void;
  minAge?: number;
  maxAge?: number;
}

const ITEM_WIDTH = 56;
const AUDIO_POOL_SIZE = 6;

export const AgeScrollPicker: React.FC<AgeScrollPickerProps> = ({
  value,
  onChange,
  minAge = 13,
  maxAge = 80,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState<number>(300);
  
  // Track last tick index continuously so sound plays on every tick during scrolling
  const initialIndex = Math.max(0, Math.min(maxAge - minAge, value - minAge));
  const lastTickIndex = useRef<number>(initialIndex);

  // Audio player pool for ultra-responsive, zero-latency mechanical keyboard clicks while scrolling
  const audioSource = require('@/assets/sounds/keyboard_switch.wav');
  const playersPool = useRef<AudioPlayer[]>([]);
  const poolIndex = useRef<number>(0);

  // Configure audio session and pre-warm audio player pool
  useEffect(() => {
    try {
      setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
      });
    } catch {}

    const pool: AudioPlayer[] = [];
    for (let i = 0; i < AUDIO_POOL_SIZE; i++) {
      try {
        const player = createAudioPlayer(audioSource);
        pool.push(player);
      } catch (err) {
        console.warn('Failed to pre-warm audio player:', err);
      }
    }
    playersPool.current = pool;

    return () => {
      pool.forEach((p) => {
        try {
          p.pause();
        } catch {}
      });
    };
  }, []);

  // Array of valid ages from minAge to maxAge
  const ages = useMemo(() => {
    const list: number[] = [];
    for (let a = minAge; a <= maxAge; a++) {
      list.push(a);
    }
    return list;
  }, [minAge, maxAge]);

  const spacerWidth = Math.max(0, (containerWidth - ITEM_WIDTH) / 2);

  // Initial scroll to current value on mount or layout
  useEffect(() => {
    if (containerWidth > 0) {
      const index = Math.max(0, Math.min(ages.length - 1, value - minAge));
      const targetX = index * ITEM_WIDTH;
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: targetX, animated: false });
      }, 50);
    }
  }, [containerWidth]);

  // Trigger instant mechanical keyboard switch audio and rigid tactile haptic
  const playSwitchAction = () => {
    // Dismiss any active keyboard to prevent input blocking while scrolling
    try {
      Keyboard.dismiss();
    } catch {}

    // Round-robin cycling through player pool for responsive continuous clicks while scrolling
    try {
      const pool = playersPool.current;
      if (pool.length > 0) {
        const player = pool[poolIndex.current % pool.length];
        poolIndex.current++;
        player.seekTo(0);
        player.play();
      }
    } catch {}

    // Crisp rigid mechanical switch tactile haptic
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    } catch {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
  };

  // Handle scroll events: sounds play responsively on EVERY tick crossed even before finger lift
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const rawIndex = Math.round(offsetX / ITEM_WIDTH);
    const clampedIndex = Math.max(0, Math.min(ages.length - 1, rawIndex));

    if (clampedIndex !== lastTickIndex.current) {
      lastTickIndex.current = clampedIndex;
      playSwitchAction();
      const newAge = ages[clampedIndex];
      if (newAge !== undefined) {
        onChange(newAge);
      }
    }
  };

  // Step button adjust
  const handleStep = (delta: number) => {
    const nextAge = Math.max(minAge, Math.min(maxAge, value + delta));
    if (nextAge !== value) {
      lastTickIndex.current = nextAge - minAge;
      playSwitchAction();
      onChange(nextAge);
      const targetIndex = nextAge - minAge;
      scrollViewRef.current?.scrollTo({ x: targetIndex * ITEM_WIDTH, animated: true });
    }
  };

  return (
    <View
      style={styles.wrapper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Age selector: ${value} years old`}
      accessibilityValue={{ min: minAge, max: maxAge, now: value }}
    >
      {/* Centered Hero Number Display */}
      <View style={styles.heroDisplay}>
        <Text style={styles.heroAgeNumber}>{value}</Text>
        <Text style={styles.heroAgeLabel}>years old</Text>
      </View>

      {/* Stepper Controls & Ruler Reel */}
      <View style={styles.stepperContainer}>
        {/* Decrement Button */}
        <TouchableOpacity
          onPress={() => handleStep(-1)}
          disabled={value <= minAge}
          style={[styles.stepButton, value <= minAge && styles.stepButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Decrease age"
          activeOpacity={0.7}
        >
          <Text style={[styles.stepButtonText, value <= minAge && styles.stepButtonTextDisabled]}>-</Text>
        </TouchableOpacity>

        {/* Horizontal Scrolling Ruler Reel with Clean Keyboard Block Switch (No Underline) */}
        <View
          style={styles.reelContainer}
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
          {/* Mechanical Keyboard Block Switch Frame Cursor (Clean keycap border, zero underline) */}
          <View pointerEvents="none" style={styles.centerCursorWrap}>
            <View style={styles.switchBlockFrame} />
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={ITEM_WIDTH}
            decelerationRate="fast"
            bounces={false}
            onScroll={handleScroll}
            onMomentumScrollEnd={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              const rawIndex = Math.round(offsetX / ITEM_WIDTH);
              const clampedIndex = Math.max(0, Math.min(ages.length - 1, rawIndex));
              lastTickIndex.current = clampedIndex;
              const newAge = ages[clampedIndex];
              if (newAge !== undefined && newAge !== value) {
                onChange(newAge);
              }
            }}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingHorizontal: spacerWidth,
              alignItems: 'center',
            }}
          >
            {ages.map((age) => {
              const isSelected = age === value;
              const isNear = Math.abs(age - value) === 1;

              return (
                <TouchableOpacity
                  key={age}
                  style={styles.reelItem}
                  onPress={() => {
                    const targetIndex = age - minAge;
                    scrollViewRef.current?.scrollTo({ x: targetIndex * ITEM_WIDTH, animated: true });
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.reelText,
                      isNear && styles.reelTextNear,
                      isSelected && styles.reelTextSelected,
                    ]}
                  >
                    {age}
                  </Text>
                  {/* Ruler Tick Notch */}
                  <View
                    style={[
                      styles.rulerTick,
                      isNear && styles.rulerTickNear,
                      isSelected && styles.rulerTickSelected,
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Increment Button */}
        <TouchableOpacity
          onPress={() => handleStep(1)}
          disabled={value >= maxAge}
          style={[styles.stepButton, value >= maxAge && styles.stepButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Increase age"
          activeOpacity={0.7}
        >
          <Text style={[styles.stepButtonText, value >= maxAge && styles.stepButtonTextDisabled]}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Validation / Compliance Notice */}
      <Text style={styles.complianceNote}>
        Minimum study age is {minAge} · Maximum is {maxAge}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[12],
  },
  heroDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[16],
  },
  heroAgeNumber: {
    fontSize: 54,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    letterSpacing: -1,
    lineHeight: 60,
  },
  heroAgeLabel: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.medium,
    color: '#64748B',
    marginTop: -2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 8,
  },
  stepButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stepButtonDisabled: {
    opacity: 0.35,
    backgroundColor: '#F8FAFC',
    borderColor: '#F1F5F9',
  },
  stepButtonText: {
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: '#0F172A',
    lineHeight: 24,
  },
  stepButtonTextDisabled: {
    color: '#94A3B8',
  },
  reelContainer: {
    flex: 1,
    height: 84,
    position: 'relative',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
    zIndex: 2,
  },
  centerCursorWrap: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: ITEM_WIDTH,
    marginLeft: -(ITEM_WIDTH / 2),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  switchBlockFrame: {
    width: ITEM_WIDTH - 6,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },
  reelItem: {
    width: ITEM_WIDTH,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reelText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.medium,
    color: '#94A3B8',
  },
  reelTextNear: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.semiBold,
    color: '#475569',
  },
  reelTextSelected: {
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  rulerTick: {
    width: 2,
    height: 8,
    borderRadius: 1,
    backgroundColor: '#CBD5E1',
  },
  rulerTickNear: {
    height: 12,
    backgroundColor: '#94A3B8',
  },
  rulerTickSelected: {
    width: 3,
    height: 18,
    borderRadius: 1.5,
    backgroundColor: colors.primary,
  },
  complianceNote: {
    fontSize: typography.fontSize[11.5],
    color: '#64748B',
    textAlign: 'center',
    marginTop: spacing[14],
  },
});
