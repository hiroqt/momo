import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppText as Text } from '@/components/common/app-text';
import { MomoAnimation } from '@/components/mascot/MomoAnimation';
import { MomoBackdrop } from '@/components/onboarding/MomoBackdrop';
import { useAuth } from '@/context/AuthContext';
import { colors, onboardingColors } from '@/constants/theme';

export default function SignInScreen() {
  const auth = useAuth();
  const router = useRouter();

  return (
    <MomoBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.mascot}><MomoAnimation name="momo-rest" size={184} /></View>
          <Text style={styles.eyebrow}>A STUDY SPACE THAT STAYS YOURS</Text>
          <Text style={styles.title} accessibilityRole="header">Keep your learning close</Text>
          <Text style={styles.subtitle}>Sign in with Google to keep your reviewers with your account and sync study progress when you’re online.</Text>

          <View style={styles.benefits}>
            <Text style={styles.benefit}>Your reviewers stay connected to your account</Text>
            <Text style={styles.benefit}>Pick up your study progress when you’re online</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              testID="opening-google-sign-in"
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              accessibilityState={{ disabled: !auth.configured || auth.busy, busy: auth.busy }}
              disabled={!auth.configured || auth.busy}
              onPress={() => { auth.clearNotice(); void auth.signInWithGoogle(); }}
              style={({ pressed }) => [styles.googleButton, (pressed || auth.busy) && styles.pressed, !auth.configured && styles.disabled]}
            >
              {auth.busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.googleButtonText}>Continue with Google</Text>}
            </Pressable>
            {!auth.configured && <Text style={styles.unavailable}>Google sign-in isn’t configured in this build yet. You can still explore as a guest.</Text>}
            {!!auth.noticeMessage && <Text testID="opening-auth-notice" accessibilityRole="alert" style={styles.notice}>{auth.noticeMessage}</Text>}
            <Pressable
              testID="opening-continue-guest"
              accessibilityRole="button"
              accessibilityLabel="Continue as guest"
              onPress={() => { auth.continueAsGuest(); router.replace('/(auth)/welcome'); }}
              style={({ pressed }) => [styles.guestButton, pressed && styles.pressed]}
            >
              <Text style={styles.guestButtonText}>Continue as guest</Text>
            </Pressable>
            <Text style={styles.footer}>You can add an account later in Settings.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </MomoBackdrop>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24, maxWidth: 560, width: '100%', alignSelf: 'center' },
  mascot: { alignItems: 'center', marginBottom: 8 },
  eyebrow: { color: onboardingColors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1.1, textAlign: 'center', marginBottom: 10 },
  title: { color: onboardingColors.text, fontSize: 30, lineHeight: 38, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: onboardingColors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  benefits: { gap: 8, marginTop: 22, paddingHorizontal: 8 },
  benefit: { color: onboardingColors.text, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  actions: { marginTop: 28 },
  googleButton: { minHeight: 54, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  googleButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  guestButton: { minHeight: 50, marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: onboardingColors.border, backgroundColor: onboardingColors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  guestButtonText: { color: onboardingColors.text, fontSize: 14, fontWeight: '700' },
  unavailable: { color: onboardingColors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 },
  notice: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 },
  footer: { color: onboardingColors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 14 },
  pressed: { opacity: 0.72 },
});
