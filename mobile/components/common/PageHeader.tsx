import React from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  StatusBar as RNStatusBar,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { isIpad } from '@/utils/device';
import { ArrowLeft01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { GlassButton, GlassSurface } from '@/components/glass';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  isModal?: boolean;
  glass?: boolean;
  onBack?: () => void;
  titleLeftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  showBack = true,
  isModal = false,
  glass = false,
  onBack,
  titleLeftAction,
  rightAction,
  style,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAndroid = process.env.EXPO_OS === 'android';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const statusBarHeight = isAndroid ? (RNStatusBar.currentHeight || 0) : 0;
  const topPadding = isAndroid
    ? Math.max(insets.top, statusBarHeight, spacing[28]) + spacing[14]
    : Math.max(insets.top, spacing[16]);

  const headerContent = (
    <View style={styles.contentRow}>
      <View style={styles.leftCol}>
        {showBack && (
          <GlassButton
            variant="subtle"
            size="icon"
            radius={isIpad() ? 23 : 18}
            haptic="light"
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={isModal ? 'Close' : 'Go back'}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.iconBtnWrapper}
            contentStyle={{
              width: isIpad() ? 46 : 36,
              height: isIpad() ? 46 : 36,
            }}
          >
            <HugeiconsIcon
              icon={isModal ? Cancel01Icon : ArrowLeft01Icon}
              size={isIpad() ? 24 : 20}
              color={colors.text}
              strokeWidth={2}
            />
          </GlassButton>
        )}
      </View>

      <View style={[styles.titleCol, titleLeftAction ? styles.titleColWithLeftAction : undefined]}>
        {titleLeftAction ? (
          <View style={styles.titleRow}>
            {titleLeftAction}
            <View style={styles.titleTextWrapper}>
              <Text style={[styles.title, styles.titleAlignLeft]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[styles.subtitle, styles.subtitleAlignLeft]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.rightCol}>
        {rightAction || <View style={styles.placeholder} />}
      </View>
    </View>
  );

  const containerStyle: StyleProp<ViewStyle> = [
    styles.container,
    glass && styles.glassContainer,
    {
      paddingTop: topPadding,
    },
    style,
  ];

  if (glass) {
    return (
      <GlassSurface
        variant="regular"
        radius={0}
        hasBorder={false}
        style={containerStyle}
      >
        {headerContent}
      </GlassSurface>
    );
  }

  return (
    <View style={containerStyle}>
      {headerContent}
    </View>
  );
};

const isPadDevice = isIpad();

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: isPadDevice ? spacing[28] : spacing[16],
    paddingBottom: isPadDevice ? spacing[16] : spacing[12],
    zIndex: 10,
  },
  glassContainer: {
    backgroundColor: 'transparent',
    borderBottomColor: 'rgba(226, 232, 240, 0.65)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: isPadDevice ? 52 : 40,
  },
  leftCol: {
    minWidth: isPadDevice ? 48 : 40,
    flexShrink: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  iconBtnWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    overflow: 'hidden',
  },
  titleColWithLeftAction: {
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    maxWidth: '100%',
  },
  titleTextWrapper: {
    flexShrink: 1,
  },
  title: {
    fontSize: isPadDevice ? typography.fontSize[22] : typography.fontSize[17],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: typography.letterSpacing[-0.3],
  },
  titleAlignLeft: {
    textAlign: 'left',
  },
  subtitle: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[12],
    color: colors.textMuted,
    marginTop: spacing[1],
    textAlign: 'center',
  },
  subtitleAlignLeft: {
    textAlign: 'left',
  },
  rightCol: {
    minWidth: isPadDevice ? 48 : 40,
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  placeholder: {
    width: isPadDevice ? 46 : 36,
  },
});
