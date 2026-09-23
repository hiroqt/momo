import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  Platform,
} from 'react-native';
import { typography } from '@/constants/theme';
import { isIpad, IPAD_FONT_SCALE } from '@/utils/device';

const getFontFamily = (fontWeight: TextStyle['fontWeight'], explicitFontFamily?: string) => {
  // If an explicit Poppins font family is already defined on the style, respect it
  if (
    explicitFontFamily &&
    Object.values(typography.fontFamily).includes(explicitFontFamily as any)
  ) {
    return explicitFontFamily;
  }

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
  const explicitFontFamily = resolvedStyle.fontFamily;
  const fontFamily = getFontFamily(resolvedStyle.fontWeight, explicitFontFamily);

  delete resolvedStyle.fontFamily;
  delete resolvedStyle.fontWeight;

  // Android font padding reset to prevent vertical clipping in badges and buttons
  if (Platform.OS === 'android') {
    (resolvedStyle as any).includeFontPadding = false;
  }

  if (isIpad()) {
    if (typeof resolvedStyle.fontSize === 'number') {
      resolvedStyle.fontSize = Math.round(resolvedStyle.fontSize * IPAD_FONT_SCALE);
    }
    if (typeof resolvedStyle.lineHeight === 'number') {
      resolvedStyle.lineHeight = Math.round(resolvedStyle.lineHeight * IPAD_FONT_SCALE);
    }
  }

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
