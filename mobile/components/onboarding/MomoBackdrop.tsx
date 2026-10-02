import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { onboardingColors } from '@/constants/theme';

interface MomoBackdropProps {
  children?: React.ReactNode;
}

/** A calm, brand-led canvas for first-run screens. */
export function MomoBackdrop({ children }: MomoBackdropProps) {
  return (
    <View style={styles.container}>
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox="0 0 400 900"
        preserveAspectRatio="none"
        pointerEvents="none"
        accessible={false}
      >
        <Path d="M0 0H400V100C260 40 180 140 0 100Z" fill={onboardingColors.background} />
        <Path d="M0 620C120 580 235 770 400 650V900H0Z" fill={onboardingColors.backgroundWarm} />
        <Path d="M0 805C150 740 255 905 400 805V900H0Z" fill={onboardingColors.peachSoft} />
      </Svg>
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
