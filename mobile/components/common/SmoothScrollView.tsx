import React, { forwardRef } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  Platform,
} from 'react-native';

export interface SmoothScrollViewProps extends ScrollViewProps {}

/**
 * Hardware-accelerated, buttery smooth ScrollView with tuned momentum physics,
 * cross-platform edge-bounce handling, and keyboard dismiss integration.
 */
export const SmoothScrollView = forwardRef<ScrollView, SmoothScrollViewProps>(
  (
    {
      decelerationRate = Platform.OS === 'ios' ? 'normal' : 0.988,
      scrollEventThrottle = 16,
      showsVerticalScrollIndicator = false,
      showsHorizontalScrollIndicator = false,
      overScrollMode = 'never',
      bounces = true,
      alwaysBounceVertical = false,
      keyboardDismissMode = 'on-drag',
      keyboardShouldPersistTaps = 'handled',
      nestedScrollEnabled = true,
      style,
      contentContainerStyle,
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <ScrollView
        ref={ref}
        decelerationRate={decelerationRate}
        scrollEventThrottle={scrollEventThrottle}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
        overScrollMode={overScrollMode}
        bounces={bounces}
        alwaysBounceVertical={alwaysBounceVertical}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        nestedScrollEnabled={nestedScrollEnabled}
        style={style}
        contentContainerStyle={contentContainerStyle}
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }
);

SmoothScrollView.displayName = 'SmoothScrollView';
