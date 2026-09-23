import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/common/app-text';
import { JungleBackdrop } from '@/components/onboarding/JungleBackdrop';
import { useOnboarding } from '../../context/OnboardingContext';
import { getStarterTopic } from '../../lib/data/sampleDeck';
import { colors } from '@/constants/theme';

const TIPS = [
  { title: 'Flip to remember', body: 'Try answering each flashcard before you reveal the back.' },
  { title: 'Bring your notes', body: 'Upload a document to make cards tied to your own study material.' },
  { title: 'Keep your streak', body: 'A short practice session each day helps the ideas stick.' },
];

export default function MomoIntroScreen() {
  const router = useRouter();
  const { firstName, studyTrack, highSchoolGrade, collegeYear, collegeCourse, finishMomoIntro } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const appear = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;
  const topic = getStarterTopic({ studyTrack, highSchoolGrade, collegeYear, collegeCourse }).label;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(appear, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, tension: 45, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [appear, rise]);

  const continueToDashboard = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await finishMomoIntro();
      Animated.timing(appear, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        router.replace('/(tabs)');
      });
    } catch (error) {
      console.warn('Could not save Momo introduction state:', error);
      setBusy(false);
    }
  };

  return (
    <JungleBackdrop>
      <BlurView intensity={65} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.scrim} />
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: appear, transform: [{ translateY: rise }] }]}>
          <Text style={styles.eyebrow}>YOUR STUDY COMPANION</Text>
          <Image source={require('@/assets/animations/welcome_momo.png')} style={styles.momo} resizeMode="contain" accessibilityLabel="Momo welcoming you" />
          <View style={styles.card}>
            <Text style={styles.title}>Welcome{firstName ? `, ${firstName}` : ''}!</Text>
            <Text style={styles.subtitle}>I'm Momo. Your {topic.toLowerCase()} preview is ready. Here are a few tricks to get started.</Text>
            {TIPS.map((tip, index) => (
              <View key={tip.title} style={styles.tipRow}>
                <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
                <View style={styles.tipText}>
                  <Text style={styles.tipTitle}>{tip.title}</Text>
                  <Text style={styles.tipBody}>{tip.body}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.button} onPress={continueToDashboard} disabled={busy} accessibilityRole="button" accessibilityLabel="Continue to dashboard">
              <Text style={styles.buttonText}>{busy ? 'Opening...' : 'Let’s go to my dashboard'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    </JungleBackdrop>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15, 23, 42, 0.22)' },
  safeArea: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  content: { alignItems: 'center', width: '100%', maxWidth: 440, alignSelf: 'center' },
  eyebrow: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  momo: { width: 210, height: 205, marginBottom: -22, zIndex: 2 },
  card: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 28, padding: 22, paddingTop: 28, shadowColor: '#111827', shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  title: { fontSize: 27, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, textAlign: 'center', marginBottom: 20 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  number: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  numberText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  tipText: { flex: 1 },
  tipTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  tipBody: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 2 },
  button: { backgroundColor: colors.primary, borderRadius: 15, paddingVertical: 15, alignItems: 'center', marginTop: 5 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
