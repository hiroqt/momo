import React, { useEffect, useState, useRef } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
  Image,
  Easing,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  CheckmarkCircle02Icon,
  SparklesIcon,
  BookOpen01Icon,
  Search01Icon,
  Edit02Icon,
  Folder01Icon,
} from '@hugeicons/core-free-icons';
import { getGenerationStatus, retryGeneration } from '../../lib/api/generations';
import { PlatformPressable } from '../../components/common/PlatformPressable';
import { SmoothScrollView } from '../../components/common/SmoothScrollView';
import { GenerationJob } from '../../types';

const CRAFTING_MESSAGES = [
  'Momo is speed-reading your document...',
  'Momo is spotting key concepts & core themes...',
  'Momo is turning notes into bite-sized flashcards...',
  'Momo is cooking up tricky multiple choice questions...',
  'Momo is crafting custom high-yield questions...',
  'Momo is distilling definitions & essential formulas...',
  'Momo is building challenging true or false statements...',
  'Momo is formulating concise identification items...',
  'Momo is fact-checking & cross-referencing answer keys...',
  'Momo is organizing questions by difficulty level...',
  'Momo is putting the final touches on your study pack...',
  'Momo is making sure you ace your next exam...',
];

const CRAFTING_SUBTITLES = [
  'Momo is crafting custom high-yield questions from your notes. No cap, this is gonna be good!',
  'Extracting the most testable concepts and formulas to build your ultimate reviewer.',
  'Generating diverse question styles to lock in your memory for test day.',
  'Cross-verifying facts directly against your uploaded source material.',
  'Hang tight! Momo is putting the final touches on your study pack.',
];

export default function GenerationProgressScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [job, setJob] = useState<GenerationJob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Optimistic auto-progress state (advances quickly, then holds near end at ~92% during backend traffic)
  const [simulatedProgress, setSimulatedProgress] = useState(12);
  const progressAnim = useRef(new Animated.Value(12)).current;
  const currentProgressRef = useRef(12);

  // Dynamic rotating Momo crafting messages
  const [msgIndex, setMsgIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const textFadeAnim = useRef(new Animated.Value(1)).current;

  // Gentle bouncing mascot float
  const mascotBounceAnim = useRef(new Animated.Value(0)).current;

  // 1. Mascot breathing bounce loop
  useEffect(() => {
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotBounceAnim, {
          toValue: -8,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(mascotBounceAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    bounceLoop.start();
    return () => bounceLoop.stop();
  }, []);

  // 2. Rotating crafting messages with smooth crossfade
  useEffect(() => {
    const textInterval = setInterval(() => {
      Animated.timing(textFadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setMsgIndex((prev) => (prev + 1) % CRAFTING_MESSAGES.length);
        setSubIndex((prev) => (prev + 1) % CRAFTING_SUBTITLES.length);
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });
    }, 2500);

    return () => clearInterval(textInterval);
  }, []);

  // 3. Simulated progress ticker (fast initial ramp up, smoothly slows down and holds near 92% until done)
  useEffect(() => {
    const simInterval = setInterval(() => {
      const cur = currentProgressRef.current;
      if (cur >= 92.5) return; // plateau / hold near end while backend traffic finishes

      let increment = 0;
      if (cur < 30) {
        increment = 2.8; // fast start
      } else if (cur < 60) {
        increment = 1.8; // brisk pace
      } else if (cur < 80) {
        increment = 1.1; // steady progress
      } else if (cur < 88) {
        increment = 0.5; // gentle deceleration
      } else {
        increment = 0.15; // micro-crawl plateauing at ~92%
      }

      const nextVal = Math.min(92.5, cur + increment);
      currentProgressRef.current = nextVal;
      setSimulatedProgress(nextVal);

      Animated.timing(progressAnim, {
        toValue: nextVal,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    }, 200);

    return () => clearInterval(simInterval);
  }, []);

  // 4. Polling backend generation status
  useEffect(() => {
    let interval: any = null;
    let isFinished = false;

    const poll = async () => {
      if (isFinished) return;
      try {
        const data = await getGenerationStatus(jobId);
        setJob(data);

        // If backend reports higher progress, jump to it
        if (data.progress && data.progress > currentProgressRef.current) {
          const clamped = Math.min(data.progress, 92.5);
          currentProgressRef.current = clamped;
          setSimulatedProgress(clamped);
          Animated.timing(progressAnim, {
            toValue: clamped,
            duration: 350,
            useNativeDriver: false,
          }).start();
        }

        if (data.status === 'COMPLETED' && data.study_set_id) {
          isFinished = true;
          clearInterval(interval);
          currentProgressRef.current = 100;
          setSimulatedProgress(100);

          // Swiftly animate to 100% completion
          Animated.timing(progressAnim, {
            toValue: 100,
            duration: 350,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();

          setTimeout(() => {
            router.replace(`/study/${data.study_set_id}`);
          }, 550);
        } else if (data.status === 'FAILED') {
          isFinished = true;
          clearInterval(interval);
          setErrorMsg(data.message || 'Generation failed. Please try again.');
        }
      } catch (err: any) {
        setErrorMsg(err.message);
      }
    };

    poll();
    interval = setInterval(poll, 1400);

    return () => {
      isFinished = true;
      clearInterval(interval);
    };
  }, [jobId]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setErrorMsg(null);
    currentProgressRef.current = 15;
    setSimulatedProgress(15);
    Animated.timing(progressAnim, {
      toValue: 15,
      duration: 300,
      useNativeDriver: false,
    }).start();

    try {
      await retryGeneration(jobId);
      setIsRetrying(false);
    } catch (err: any) {
      setErrorMsg('Retry failed: ' + err.message);
      setIsRetrying(false);
    }
  };

  const steps = [
    { title: 'Speed-reading your notes', icon: BookOpen01Icon, threshold: 15 },
    { title: 'Spotting main character topics', icon: Search01Icon, threshold: 35 },
    { title: 'Extracting high-yield facts', icon: SparklesIcon, threshold: 55 },
    { title: 'Momo crafting questions', icon: Edit02Icon, threshold: 75 },
    { title: 'Fact-checking & verifying answers', icon: CheckmarkCircle02Icon, threshold: 88 },
    { title: 'Packaging your study pack', icon: Folder01Icon, threshold: 98 },
  ];

  const currentProgress = simulatedProgress;
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const selectedFormats = job?.generation_config?.question_types || [];
  const formatLabelMap: Record<string, string> = {
    flashcard: 'Flashcards',
    multiple_choice: 'Multiple Choice',
    true_false: 'True / False',
    identification: 'Identification',
  };

  return (
    <View style={styles.screen}>
      <SmoothScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, spacing[24]) + spacing[20],
            paddingBottom: Math.max(insets.bottom, spacing[24]) + spacing[20],
          },
        ]}
      >
        <View style={styles.card}>
          {/* Animated Momo Crafting Mascot with float */}
          <Animated.View
            style={[
              styles.mascotBox,
              { transform: [{ translateY: mascotBounceAnim }] },
            ]}
          >
            <Image 
              source={require('@/assets/animations/creating_momo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>

          <Text style={styles.title}>Creating your reviewer</Text>
          
          {/* Smoothly animated rotating subtitle */}
          <Animated.View style={{ opacity: textFadeAnim }}>
            <Text style={styles.subtitle}>
              {CRAFTING_SUBTITLES[subIndex]}
            </Text>
          </Animated.View>

          {/* Selected formats being cooked */}
          {selectedFormats.length > 0 && (
            <View style={styles.formatRow}>
              <Text style={styles.formatLabel}>Selected Formats:</Text>
              <View style={styles.formatBadges}>
                {selectedFormats.map((fmt: string) => (
                  <View key={fmt} style={styles.formatBadge}>
                    <Text style={styles.formatBadgeText}>{formatLabelMap[fmt] || fmt}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>We could not finish creating your reviewer.</Text>
              <Text style={styles.errorDetail}>{errorMsg}</Text>
              <PlatformPressable
                style={styles.retryBtn}
                onPress={handleRetry}
                disabled={isRetrying}
              >
                <Text style={styles.retryBtnText}>
                  {isRetrying ? 'Restarting...' : 'Try Again'}
                </Text>
              </PlatformPressable>
            </View>
          ) : (
            <>
              {/* Animated Progress Bar */}
              <View style={styles.progressContainer}>
                <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
              </View>

              {/* Steps checklist */}
              <View style={styles.stepsList}>
                {steps.map((s, idx) => {
                  const isPassed = currentProgress >= s.threshold;
                  const isCurrent =
                    currentProgress >= s.threshold - 15 && currentProgress < s.threshold;

                  return (
                    <View key={idx} style={styles.stepItem}>
                      <View style={styles.iconCol}>
                        {isPassed ? (
                          <HugeiconsIcon
                            icon={CheckmarkCircle02Icon}
                            size={18}
                            color={colors.success}
                            strokeWidth={2.4}
                          />
                        ) : isCurrent ? (
                          <HugeiconsIcon
                            icon={s.icon}
                            size={18}
                            color={colors.primary}
                            strokeWidth={2.2}
                          />
                        ) : (
                          <HugeiconsIcon
                            icon={s.icon}
                            size={16}
                            color={colors.textDisabled}
                            strokeWidth={1.8}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepText,
                          isPassed && styles.stepPassed,
                          isCurrent && styles.stepCurrent,
                        ]}
                      >
                        {s.title}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Dynamic Rotating Momo Crafting Stage Message */}
              <View style={styles.spinnerRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Animated.View style={{ opacity: textFadeAnim, flexShrink: 1 }}>
                  <Text style={styles.stageMessage} numberOfLines={2}>
                    {CRAFTING_MESSAGES[msgIndex]}
                  </Text>
                </Animated.View>
              </View>
            </>
          )}
        </View>
      </SmoothScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing[20],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing[24],
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  mascotBox: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[12],
    marginBottom: spacing[16],
  },
  logoImage: {
    width: 150,
    height: 150,
  },
  formatRow: {
    alignItems: 'center',
    marginBottom: spacing[20],
    marginTop: -spacing[8],
  },
  formatLabel: {
    fontSize: typography.fontSize[11.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing[0.5],
    marginBottom: spacing[6],
  },
  formatBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[6],
  },
  formatBadge: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: 8,
  },
  formatBadgeText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  title: {
    fontSize: typography.fontSize[20],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[6],
    letterSpacing: typography.letterSpacing[-0.3],
  },
  subtitle: {
    fontSize: typography.fontSize[13],
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing[20],
    lineHeight: typography.lineHeight[18],
  },
  progressContainer: {
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing[24],
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  stepsList: {
    marginBottom: spacing[24],
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[14],
  },
  iconCol: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[10],
  },
  currentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  stepText: {
    fontSize: typography.fontSize[14],
    color: colors.textDisabled,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  stepPassed: {
    color: colors.text,
    fontWeight: typography.fontWeight.semiBold,
  },
  stepCurrent: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[10],
    paddingTop: spacing[8],
  },
  stageMessage: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
  },
  errorBox: {
    padding: spacing[16],
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  errorDetail: {
    fontSize: typography.fontSize[13],
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing[16],
    lineHeight: typography.lineHeight[18],
  },
  retryBtn: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
    borderRadius: 10,
  },
  retryBtnText: {
    color: colors.onPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[14],
  },
});
