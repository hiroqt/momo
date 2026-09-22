import React from 'react';
import { View, ViewProps, Platform } from 'react-native';
import { GlassContainer as ExpoGlassContainer } from 'expo-glass-effect';
import { useGlassCapability } from './useGlassCapability';

export interface GlassContainerProps extends ViewProps {
  /**
   * The distance at which glass elements start affecting each other.
   * Controls when glass elements begin to merge together on iOS 26+.
   */
  spacing?: number;
  children?: React.ReactNode;
}

/**
 * Groups multiple GlassSurface / GlassButton elements together.
 * On iOS 26+, uses native GlassContainer for visual blending/merging.
 * On Android or fallback platforms, renders a standard View.
 */
export const GlassContainer: React.FC<GlassContainerProps> = ({
  spacing,
  children,
  style,
  ...rest
}) => {
  const { canUseLiquidGlass } = useGlassCapability();

  if (canUseLiquidGlass && Platform.OS === 'ios') {
    return (
      <ExpoGlassContainer spacing={spacing} style={style} {...rest}>
        {children}
      </ExpoGlassContainer>
    );
  }

  return (
    <View style={style} {...rest}>
      {children}
    </View>
  );
};
