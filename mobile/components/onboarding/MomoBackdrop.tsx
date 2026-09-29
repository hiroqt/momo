import React from 'react';
import { StyleSheet, View } from 'react-native';
import { onboardingColors } from '@/constants/theme';

interface MomoBackdropProps {
  children?: React.ReactNode;
}

/** A calm, brand-led canvas for first-run screens. */
export function MomoBackdrop({ children }: MomoBackdropProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: onboardingColors.canvas,
  },
  content: { flex: 1 },
});
