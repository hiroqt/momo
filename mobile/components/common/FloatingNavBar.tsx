import React, { useEffect, useState, useRef } from "react";
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  Pressable,
  Animated as RNAnimated,
  Platform,
  Keyboard,
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
  profile: 2,
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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [dockWidth, setDockWidth] = useState(340);

  const activeIndex = customActiveIndex !== undefined ? customActiveIndex : (state?.index ?? 0);

  // Native-driven sliding indicator for standard React Navigation fallback
  const indicatorAnim = useRef(new RNAnimated.Value(activeIndex)).current;

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
        toValue: activeIndex,
        useNativeDriver: true,
        speed: 24,
        bounciness: 4,
      }).start();
    }
  }, [activeIndex, progressAnim]);

  if (isKeyboardVisible) {
    return null;
  }

  const bottomOffset = Math.max(insets.bottom, spacing[12]) + spacing[4];
  const horizontalPadding = spacing[6];
  const innerWidth = Math.max(dockWidth - horizontalPadding * 2, 60);
  const tabWidth = innerWidth / TABS.length;

  const fallbackTranslateX = indicatorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      horizontalPadding,
      horizontalPadding + tabWidth,
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
            const isFocused = pageIndex !== undefined && activeIndex === pageIndex;
            return (
              <TabItem
                key={tab.name}
                tab={tab}
                isFocused={isFocused}
                onPress={() => {
                  if (tab.name === "shop") {
                    router.push("/shop");
                    return;
                  }
                  if (onTabPress) {
                    onTabPress(pageIndex ?? idx);
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
    const tx = interpolate(
      progressAnim.value,
      [0, 1, 2],
      [
        horizontalPadding,
        horizontalPadding + tabWidth,
        horizontalPadding + tabWidth * 3,
      ],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX: tx }],
    };
  });

  return (
    <Reanimated.View
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
  isFocused: boolean;
  onPress: () => void;
}

const TabItem: React.FC<TabItemProps> = ({ tab, isFocused, onPress }) => {
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;

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
        <HugeiconsIcon
          icon={tab.icon}
          size={20}
          color={isFocused ? colors.primary : colors.textMuted}
          strokeWidth={isFocused ? 2.4 : 1.8}
        />
        <Text
          style={[
            styles.tabLabel,
            isFocused ? styles.activeTabLabel : styles.inactiveTabLabel,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
      </Pressable>
    </RNAnimated.View>
  );
};

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
    maxWidth: 360,
    height: 58,
    backgroundColor: colors.surface,
    borderRadius: 30,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
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
    top: 5,
    bottom: 5,
    backgroundColor: colors.primarySoft,
    borderRadius: 24,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[4],
    borderRadius: 24,
  },
  tabLabel: {
    fontSize: typography.fontSize[12],
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
