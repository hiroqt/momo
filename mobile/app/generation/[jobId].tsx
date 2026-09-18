import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
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
import { MomoMaker } from '../../components/mascot/MomoMaker';
import { GenerationJob } from '../../types';

export default function GenerationProgressScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [job, setJob] = useState<GenerationJob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Animated smooth progress bar
  const progressAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    let interval: any = null;

    const poll = async () => {
      try {
        const data = await getGenerationStatus(jobId);
        setJob(data);

        // Animate to new progress value smoothly
        Animated.timing(progressAnim, {
          toValue: data.progress || 15,
          duration: 400,
          useNativeDriver: false,
        }).start();

        if (data.status === 'COMPLETED' && data.study_set_id) {
          clearInterval(interval);
          setTimeout(() => {
            router.replace(`/study/${data.study_set_id}`);
          }, 600);
        } else if (data.status === 'FAILED') {
          clearInterval(interval);
          setErrorMsg(data.message || 'Generation failed. Please try again.');
        }
      } catch (err: any) {
        setErrorMsg(err.message);
      }
    };

    poll();
    interval = setInterval(poll, 1400);

    return () => clearInterval(interval);
  }, [jobId]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setErrorMsg(null);
    try {
      await retryGeneration(jobId);
      setIsRetrying(false);
    } catch (err: any) {
      setErrorMsg('Retry failed: ' + err.message);
      setIsRetrying(false);
    }
  };

  const steps = [
    { title: 'Speed-reading your notes', icon: BookOpen01Icon, threshold: 10 },
    { title: 'Spotting main character topics', icon: Search01Icon, threshold: 25 },
    { title: 'Extracting high-yield facts', icon: SparklesIcon, threshold: 45 },
    { title: 'Momo crafting questions', icon: Edit02Icon, threshold: 70 },
    { title: 'Fact-checking & verifying answers', icon: CheckmarkCircle02Icon, threshold: 85 },
    { title: 'Packaging your study pack', icon: Folder01Icon, threshold: 95 },
  ];

  const currentProgress = job?.progress || 10;
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
            paddingTop: Math.max(insets.top, 24) + 20,
            paddingBottom: Math.max(insets.bottom, 24) + 20,
          },
        ]}
      >
        <View style={styles.card}>
          {/* Animated Momo Crafting Mascot */}
          <View style={styles.mascotBox}>
            <MomoMaker size={145} />
          </View>

          <Text style={styles.title}>Cooking up your reviewer</Text>
          <Text style={styles.subtitle}>
            Momo is crafting custom high-yield questions from your notes. No cap, this is gonna be good!
          </Text>

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
                            color="#059669"
                            strokeWidth={2.4}
                          />
                        ) : isCurrent ? (
                          <HugeiconsIcon
                            icon={s.icon}
                            size={18}
                            color="#4F46E5"
                            strokeWidth={2.2}
                          />
                        ) : (
                          <HugeiconsIcon
                            icon={s.icon}
                            size={16}
                            color="#94A3B8"
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

              <View style={styles.spinnerRow}>
                <ActivityIndicator size="small" color="#4F46E5" />
                <Text style={styles.stageMessage}>
                  {job?.message || 'Momo is crafting your study pack...'}
                </Text>
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
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
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
    marginBottom: 8,
  },
  formatRow: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: -8,
  },
  formatLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  formatBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  formatBadge: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  formatBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 24,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  stepsList: {
    marginBottom: 24,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCol: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  currentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4F46E5',
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  stepText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
    flex: 1,
  },
  stepPassed: {
    color: '#0F172A',
    fontWeight: '600',
  },
  stepCurrent: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 8,
  },
  stageMessage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  errorBox: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 6,
  },
  errorDetail: {
    fontSize: 13,
    color: '#991B1B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
