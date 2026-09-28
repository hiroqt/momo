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
      <View pointerEvents="none" style={[styles.orb, styles.violetOrb]} />
      <View pointerEvents="none" style={[styles.orb, styles.peachOrb]} />
      <View pointerEvents="none" style={[styles.orb, styles.smallOrb]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: onboardingColors.background,
  },
  content: { flex: 1 },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  violetOrb: {
    width: 360,
    height: 360,
    top: -180,
    right: -120,
    backgroundColor: onboardingColors.primarySoft,
  },
  peachOrb: {
    width: 310,
    height: 310,
    bottom: -155,
    left: -135,
    backgroundColor: onboardingColors.peachSoft,
  },
  smallOrb: {
    width: 130,
    height: 130,
    top: '42%',
    right: -80,
    backgroundColor: '#F1E9FF',
  },
});
