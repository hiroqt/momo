import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  TextInputProps,
  TextProps,
  TextStyle,
} from 'react-native';
import { typography } from '@/constants/theme';

const getFontFamily = (fontWeight: TextStyle['fontWeight']) => {
  if (fontWeight === 'bold') {
    return typography.fontFamily.bold;
  }

  const numericWeight = Number(fontWeight ?? typography.numericWeight.regular);

  if (numericWeight >= typography.numericWeight.bold) {
    return typography.fontFamily.bold;
  }

  if (numericWeight >= typography.numericWeight.semiBold) {
    return typography.fontFamily.semiBold;
  }

  if (numericWeight >= typography.numericWeight.medium) {
    return typography.fontFamily.medium;
  }

  return typography.fontFamily.regular;
};

const resolveTypographyStyle = (style: TextProps['style']): TextStyle => {
  const resolvedStyle = { ...StyleSheet.flatten(style) };
  const fontFamily = getFontFamily(resolvedStyle.fontWeight);

  delete resolvedStyle.fontFamily;
  delete resolvedStyle.fontWeight;

  return {
    ...resolvedStyle,
    fontFamily,
  };
};

export const AppText = forwardRef<React.ComponentRef<typeof NativeText>, TextProps>(
  ({ style, ...props }, ref) => (
    <NativeText ref={ref} {...props} style={resolveTypographyStyle(style)} />
  ),
);

AppText.displayName = 'AppText';

export const AppTextInput = forwardRef<
  React.ComponentRef<typeof NativeTextInput>,
  TextInputProps
>(({ style, ...props }, ref) => (
  <NativeTextInput ref={ref} {...props} style={resolveTypographyStyle(style)} />
));

AppTextInput.displayName = 'AppTextInput';
