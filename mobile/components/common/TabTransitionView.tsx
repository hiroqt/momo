import React from 'react';
import { StyleSheet, StyleProp, ViewStyle, View } from 'react-native';
import { colors } from '@/constants/theme';

export interface TabTransitionViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tabName?: 'index' | 'library' | 'profile' | string;
  enableSwipe?: boolean;
}

/**
 * TabTransitionView provides a clean, unified container styling for individual tab contents.
 * Multi-page horizontal swipe gestures, revealing next page & disappearing previous page transitions,
 * dynamic frosted blur, and bottom tab bar synchronization are orchestrated at the layout level.
 */
export const TabTransitionView: React.FC<TabTransitionViewProps> = ({
  children,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
