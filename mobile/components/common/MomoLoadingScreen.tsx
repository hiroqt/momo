import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { MomoBackdrop } from '@/components/onboarding/MomoBackdrop';
import { onboardingColors, spacing, typography } from '@/constants/theme';

const MASCOT_SOURCES = {
  loading: require('@/assets/animations/momo_loading.png'),
  icon: require('@/assets/momo_logo.png'),
};

interface MomoLoadingScreenProps {
  title?: string;
  subtitle?: string;
  mascotSize?: number;
  mascotType?: 'loading' | 'icon';
  showSpinner?: boolean;
  showMascot?: boolean;
  fullScreen?: boolean;
  variant?: 'default' | 'splash';
  style?: StyleProp<ViewStyle>;
}

export function MomoLoadingScreen({
  title = 'momo',
  subtitle,
  mascotSize = 250,
  mascotType = 'loading',
  showSpinner = true,
  showMascot = true,
  fullScreen = true,
  variant = 'default',
  style,
}: MomoLoadingScreenProps) {
  const content = (
    <View style={[styles.container, fullScreen && styles.fullScreen, style]}>
      {showMascot && (
        <Image
          source={MASCOT_SOURCES[mascotType]}
          style={{ width: mascotSize, height: mascotSize }}
          resizeMode="contain"
          accessibilityLabel="Momo preparing your study space"
        />
      )}
      <Text style={[styles.title, variant === 'splash' && styles.splashTitle]}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {showSpinner && (
        <ActivityIndicator
          style={styles.spinner}
          size="small"
          color={onboardingColors.primary}
        />
      )}
    </View>
  );

  if (variant === 'splash') {
    return <View style={styles.splash}>{content}</View>;
  }

  return (
    <MomoBackdrop>
      {content}
    </MomoBackdrop>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[24],
  },
  fullScreen: {
    width: '100%',
    height: '100%',
  },
  splash: {
    flex: 1,
    backgroundColor: '#FBF8F0',
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 28,
    color: onboardingColors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: spacing[8],
  },
  splashTitle: {
    fontSize: 25,
    letterSpacing: -0.8,
    marginTop: 0,
  },
  subtitle: {
    maxWidth: 320,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize[14],
    color: onboardingColors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight[20],
    marginTop: spacing[4],
  },
  spinner: {
    marginTop: spacing[16],
  },
});
