import React from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  StatusBar as RNStatusBar,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  isModal?: boolean;
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

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topPadding,
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        <View style={styles.leftCol}>
          {showBack && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleBack}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={isModal ? 'Close' : 'Go back'}
            >
              <HugeiconsIcon
                icon={isModal ? Cancel01Icon : ArrowLeft01Icon}
                size={20}
                color={colors.text}
                strokeWidth={2}
              />
            </TouchableOpacity>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[12],
    zIndex: 10,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  leftCol: {
    minWidth: 40,
    flexShrink: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceMuted,
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
    fontSize: typography.fontSize[17],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: typography.letterSpacing[-0.3],
  },
  titleAlignLeft: {
    textAlign: 'left',
  },
  subtitle: {
    fontSize: typography.fontSize[12],
    color: colors.textMuted,
    marginTop: spacing[1],
    textAlign: 'center',
  },
  subtitleAlignLeft: {
    textAlign: 'left',
  },
  rightCol: {
    minWidth: 40,
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  placeholder: {
    width: 36,
  },
});
