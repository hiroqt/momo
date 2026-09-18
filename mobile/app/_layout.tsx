import React, { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { colors, typography } from "@/constants/theme";

import { CreditsProvider } from '../context/CreditsContext';

export default function RootLayout() {
  const isIOS = Platform.OS === "ios";

  const [loaded, error] = useFonts({
    [typography.fontFamily.regular]: require("@/assets/fonts/Poppins-Regular.ttf"),
    [typography.fontFamily.medium]: require("@/assets/fonts/Poppins-Medium.ttf"),
    [typography.fontFamily.semiBold]: require("@/assets/fonts/Poppins-SemiBold.ttf"),
    [typography.fontFamily.bold]: require("@/assets/fonts/Poppins-Bold.ttf"),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <CreditsProvider>
      <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          animationDuration: 350,
          gestureEnabled: true,
          fullScreenGestureEnabled: isIOS,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
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
            animation: "fade",
            animationDuration: 350,
          }}
        />
        <Stack.Screen
          name="generation/[jobId]"
          options={{
            headerShown: false,
            animation: "fade",
            animationDuration: 350,
          }}
        />
        <Stack.Screen
          name="study/[studySetId]"
          options={{
            headerShown: false,
            animation: "fade",
            animationDuration: 350,
          }}
        />
      </Stack>
    </SafeAreaProvider>
    </CreditsProvider>
  );
}
