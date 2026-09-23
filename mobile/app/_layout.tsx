import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { colors, typography } from "@/constants/theme";

// Keep splash screen visible while loading fonts and initializing
SplashScreen.preventAutoHideAsync().catch(() => {});

export { ErrorBoundary } from "expo-router";

import { CreditsProvider } from '../context/CreditsContext';
import { OnboardingProvider, useOnboarding } from '../context/OnboardingContext';
import { useRouter, useSegments } from 'expo-router';
import { MomoLoadingScreen } from '@/components/common/MomoLoadingScreen';
import { SyncStatusPill } from '@/components/common/SyncStatusPill';

function InitialGate({
  fontsReady,
  children,
}: {
  fontsReady: boolean;
  children: React.ReactNode;
}) {
  const { isLoaded, hasCompletedWelcome, hasSeenMomoIntro } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    // Hide the native splash screen immediately so the animated Momo loading begins
    SplashScreen.hideAsync().catch(() => {});

    // Duration for the 3D jungle leaves slide-in and Momo bounce-in animation at the opening of the app
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const isReady = fontsReady && isLoaded && minTimeElapsed;

  useEffect(() => {
    if (!isReady) return;
    const inAuth = segments[0] === '(auth)';
    if (!hasCompletedWelcome && !inAuth) {
      router.replace('/(auth)/welcome');
    } else if (hasCompletedWelcome && !hasSeenMomoIntro && !segments.join('/').includes('momo-intro')) {
      router.replace('/(auth)/momo-intro');
    }
  }, [isReady, hasCompletedWelcome, hasSeenMomoIntro, segments, router]);

  if (!isReady) {
    return (
      <MomoLoadingScreen
        title="momo"
        mascotSize={250}
        mascotType="loading"
      />
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const isIOS = Platform.OS === "ios";

  const [loaded, error] = useFonts({
    [typography.fontFamily.regular]: require("@/assets/fonts/Poppins-Regular.ttf"),
    [typography.fontFamily.medium]: require("@/assets/fonts/Poppins-Medium.ttf"),
    [typography.fontFamily.semiBold]: require("@/assets/fonts/Poppins-SemiBold.ttf"),
    [typography.fontFamily.bold]: require("@/assets/fonts/Poppins-Bold.ttf"),
  });

  const fontsReady = loaded || !!error;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CreditsProvider>
        <OnboardingProvider>
          <InitialGate fontsReady={fontsReady}>
            <SafeAreaProvider>
              <StatusBar style="dark" />
              <SyncStatusPill />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: isIOS ? "fade" : "default",
                  animationDuration: 350,
                  gestureEnabled: true,
                  fullScreenGestureEnabled: isIOS,
                  contentStyle: {
                    backgroundColor: colors.background,
                  },
                }}
              >
                <Stack.Screen
                  name="(auth)/welcome"
                  options={{
                    headerShown: false,
                    animation: isIOS ? "fade" : "default",
                  }}
                />
                <Stack.Screen name="(auth)/momo-intro" options={{ animation: isIOS ? 'fade' : 'default' }} />
                <Stack.Screen
                  name="(tabs)"
                  options={{
                    headerShown: false,
                    animation: "none",
                  }}
                />
                <Stack.Screen
                  name="documents/upload"
                  options={{
                    presentation: "modal",
                    animation: "slide_from_bottom",
                    animationDuration: 350,
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="create/[documentId]"
                  options={{
                    headerShown: false,
                    animation: isIOS ? "fade" : "default",
                    animationDuration: 350,
                  }}
                />
                <Stack.Screen
                  name="generation/[jobId]"
                  options={{
                    headerShown: false,
                    animation: isIOS ? "fade" : "default",
                    animationDuration: 350,
                  }}
                />
                <Stack.Screen
                  name="study/[studySetId]"
                  options={{
                    headerShown: false,
                    animation: isIOS ? "fade" : "default",
                    animationDuration: 350,
                  }}
                />
                <Stack.Screen
                  name="shop"
                  options={{
                    headerShown: false,
                    animation: isIOS ? "fade" : "default",
                    animationDuration: 350,
                  }}
                />
                <Stack.Screen
                  name="chat"
                  options={{
                    headerShown: false,
                    animation: isIOS ? "slide_from_right" : "default",
                    animationDuration: 300,
                  }}
                />
              </Stack>
            </SafeAreaProvider>
          </InitialGate>
        </OnboardingProvider>
      </CreditsProvider>
    </GestureHandlerRootView>
  );
}
