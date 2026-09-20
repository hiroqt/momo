import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { PlatformPressable } from '@/components/common/PlatformPressable';
import { AppText as Text } from '@/components/common/app-text';
import { InstagramIcon } from './InstagramIcon';

export interface InstagramStoryButtonProps {
  onPress: () => void;
  title?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Story share button styled with solid Instagram brand color (#E1306C),
 * vector Instagram glyph, and clean typography (no inner gradient).
 */
export const InstagramStoryButton: React.FC<InstagramStoryButtonProps> = ({
  onPress,
  title = 'Share to Instagram Story',
  style,
}) => {
  return (
    <PlatformPressable
      style={[styles.container, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.btnRow}>
        <InstagramIcon size={20} color="#FFFFFF" strokeWidth={2.2} />
        <Text style={styles.buttonText}>{title}</Text>
      </View>
    </PlatformPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E1306C',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E1306C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
