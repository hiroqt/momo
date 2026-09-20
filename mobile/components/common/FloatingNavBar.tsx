import React, { useEffect, useState, useRef } from "react";
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  Pressable,
  Animated as RNAnimated,
  Platform,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { AppText as Text } from "@/components/common/app-text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useRouter } from "expo-router";
import { isIpad } from "@/utils/device";
import {
  Home01Icon,
  BookOpen01Icon,
  UserCircleIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons";

export interface TabConfig {
  name: string;
  label: string;
  icon: any;
}

export const TABS: TabConfig[] = [
  { name: "index", label: "Home", icon: Home01Icon },
  { name: "library", label: "Library", icon: BookOpen01Icon },
  { name: "shop", label: "Shop", icon: Store01Icon },
  { name: "profile", label: "Profile", icon: UserCircleIcon },
];

const TAB_NAME_TO_PAGE_INDEX: Record<string, number> = {
  index: 0,
  library: 1,
  shop: 2,
  profile: 3,
};

export interface FloatingNavBarProps {
  state?: any;
  descriptors?: any;
  navigation?: any;
  activeIndex?: number;
  progressAnim?: SharedValue<number>;
  onTabPress?: (index: number) => void;
}

export const FloatingNavBar: React.FC<FloatingNavBarProps> = ({
  state,
  navigation,
  activeIndex: customActiveIndex,
  progressAnim,
  onTabPress,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const isTablet = isIpad();
  const defaultDockWidth = Math.min(windowWidth * 0.9, isTablet ? 620 : 360);
  const [dockWidth, setDockWidth] = useState(defaultDockWidth);

  const activeIndex = customActiveIndex !== undefined ? customActiveIndex : (state?.index ?? 0);

  // Instantaneous optimistic active index for 0ms active indicator feedback
  const [optimisticIndex, setOptimisticIndex] = useState<number | null>(null);

  useEffect(() => {
    setOptimisticIndex(null);
  }, [activeIndex]);

  const effectiveActiveIndex = optimisticIndex !== null ? optimisticIndex : activeIndex;

  // Native-driven sliding indicator for standard React Navigation fallback
  const indicatorAnim = useRef(new RNAnimated.Value(effectiveActiveIndex)).current;

  // Keyboard show/hide listener to prevent covering input fields
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false),
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Animate fallback indicator smoothly on native driver when active tab changes
  useEffect(() => {
    if (!progressAnim) {
      RNAnimated.spring(indicatorAnim, {
        toValue: effectiveActiveIndex,
        useNativeDriver: true,
        speed: 36,
        bounciness: 2,
      }).start();
    }
  }, [effectiveActiveIndex, progressAnim]);

  if (isKeyboardVisible) {
    return null;
  }

  const bottomOffset = isTablet ? insets.bottom + spacing[16] : Math.max(insets.bottom, spacing[12]) + spacing[4];
  const horizontalPadding = isTablet ? spacing[12] : spacing[6];
  const innerWidth = Math.max(dockWidth - horizontalPadding * 2, 60);
  const tabWidth = innerWidth / TABS.length;

  const fallbackTranslateX = indicatorAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [
      horizontalPadding,
      horizontalPadding + tabWidth,
      horizontalPadding + tabWidth * 2,
      horizontalPadding + tabWidth * 3,
    ],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[
        styles.dockWrapper,
        {
          bottom: bottomOffset,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={styles.dockCard}
        onLayout={(e) => {
          const width = e.nativeEvent.layout.width;
          if (width > 0 && Math.abs(width - dockWidth) > 1) {
            setDockWidth(width);
          }
        }}
      >
        {/* Hardware-Accelerated Sliding Indicator Pill */}
        {progressAnim ? (
          <ReanimatedIndicator
            progressAnim={progressAnim}
            tabWidth={tabWidth}
            horizontalPadding={horizontalPadding}
          />
        ) : (
          <RNAnimated.View
            pointerEvents="none"
            style={[
              styles.slidingIndicator,
              {
                width: tabWidth,
                transform: [{ translateX: fallbackTranslateX }],
              },
            ]}
          />
        )}

        {/* Tab Items Row */}
        <View style={styles.tabsRow}>
          {TABS.map((tab, idx) => {
            const pageIndex = TAB_NAME_TO_PAGE_INDEX[tab.name];
            const isFocused = pageIndex !== undefined && effectiveActiveIndex === pageIndex;
            return (
              <TabItem
                key={tab.name}
                tab={tab}
                pageIndex={pageIndex ?? idx}
                isFocused={isFocused}
                progressAnim={progressAnim}
                onPress={() => {
                  const targetIndex = pageIndex ?? idx;
                  setOptimisticIndex(targetIndex);
                  if (onTabPress) {
                    onTabPress(targetIndex);
                  } else if (navigation && state) {
                    const routeIndex = state?.routes?.findIndex((r: any) => r.name === tab.name) ?? idx;
                    const event = navigation.emit({
                      type: "tabPress",
                      target: state.routes[routeIndex]?.key,
                      canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                      navigation.navigate(tab.name);
                    }
                  }
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

const ReanimatedIndicator: React.FC<{
  progressAnim: SharedValue<number>;
  tabWidth: number;
  horizontalPadding: number;
}> = ({ progressAnim, tabWidth, horizontalPadding }) => {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const clampedProgress = Math.max(0, Math.min(TABS.length - 1, progressAnim.value));
    const tx = horizontalPadding + clampedProgress * tabWidth;
    return {
      transform: [{ translateX: tx }],
    };
  });

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        styles.slidingIndicator,
        {
          width: tabWidth,
        },
        animatedStyle,
      ]}
    />
  );
};

interface TabItemProps {
  tab: TabConfig;
  pageIndex: number;
  isFocused: boolean;
  progressAnim?: SharedValue<number>;
  onPress: () => void;
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  pageIndex,
  isFocused,
  progressAnim,
  onPress,
}) => {
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;
  const isTablet = isIpad();
  const iconSize = isTablet ? 26 : 20;

  const handlePressIn = () => {
    RNAnimated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    RNAnimated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  // UI-thread animated crossfade driven 1:1 by swipe progress
  const activeAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    if (!progressAnim) {
      return { opacity: isFocused ? 1 : 0 };
    }
    const dist = Math.abs(progressAnim.value - pageIndex);
    const active = interpolate(
      dist,
      [0, 0.65],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity: active };
  });

  const inactiveAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    if (!progressAnim) {
      return { opacity: isFocused ? 0 : 1 };
    }
    const dist = Math.abs(progressAnim.value - pageIndex);
    const active = interpolate(
      dist,
      [0, 0.65],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity: 1 - active };
  });

  return (
    <RNAnimated.View
      style={[styles.tabButtonWrapper, { transform: [{ scale: scaleAnim }] }]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={null}
        style={styles.tabButton}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={tab.label}
      >
        {/* Inactive state (grey icon, muted label) */}
        <Reanimated.View
          pointerEvents="none"
          style={[styles.tabItemInner, inactiveAnimatedStyle]}
        >
          <HugeiconsIcon
            icon={tab.icon}
            size={iconSize}
            color={colors.textMuted}
            strokeWidth={1.8}
          />
          <Text
            style={[styles.tabLabel, styles.inactiveTabLabel]}
            numberOfLines={1}
          >
            {tab.label}
          </Text>
        </Reanimated.View>

        {/* Active state (violet icon, bold primary label) */}
        <Reanimated.View
          pointerEvents="none"
          style={[styles.tabItemInner, styles.tabItemActiveOverlay, activeAnimatedStyle]}
        >
          <HugeiconsIcon
            icon={tab.icon}
            size={iconSize}
            color={colors.primary}
            strokeWidth={2.4}
          />
          <Text
            style={[styles.tabLabel, styles.activeTabLabel]}
            numberOfLines={1}
          >
            {tab.label}
          </Text>
        </Reanimated.View>
      </Pressable>
    </RNAnimated.View>
  );
};

const isPadDevice = isIpad();

const styles = StyleSheet.create({
  dockWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  dockCard: {
    width: "90%",
    maxWidth: isPadDevice ? 620 : 360,
    height: isPadDevice ? 72 : 58,
    backgroundColor: colors.surface,
    borderRadius: isPadDevice ? 36 : 30,
    paddingHorizontal: isPadDevice ? spacing[12] : spacing[6],
    paddingVertical: isPadDevice ? spacing[8] : spacing[5],
    borderWidth: 1.5,
    borderColor: colors.border,
    position: "relative",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 22,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  slidingIndicator: {
    position: "absolute",
    top: isPadDevice ? 6 : 5,
    bottom: isPadDevice ? 6 : 5,
    backgroundColor: colors.primarySoft,
    borderRadius: isPadDevice ? 30 : 24,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    zIndex: 1,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    height: "100%",
    zIndex: 2,
  },
  tabButtonWrapper: {
    flex: 1,
    height: "100%",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderRadius: isPadDevice ? 30 : 24,
  },
  tabItemInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: isPadDevice ? spacing[8] : spacing[4],
  },
  tabItemActiveOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabLabel: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[12],
    letterSpacing: typography.letterSpacing[-0.2],
  },
  activeTabLabel: {
    fontWeight: typography.fontWeight.extraBold,
    color: colors.primary,
  },
  inactiveTabLabel: {
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
  },
});
