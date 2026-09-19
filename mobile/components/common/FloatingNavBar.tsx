import React, { useEffect, useState, useRef } from "react";
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Keyboard,
} from "react-native";
import { AppText as Text } from "@/components/common/app-text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Home01Icon,
  BookOpen01Icon,
  UserCircleIcon,
  BitcoinShoppingIcon,
} from "@hugeicons/core-free-icons";

interface TabConfig {
  name: string;
  label: string;
  icon: any;
}

const TABS: TabConfig[] = [
  { name: "index", label: "Home", icon: Home01Icon },
  { name: "library", label: "Library", icon: BookOpen01Icon },
  
  { name: "profile", label: "Profile", icon: UserCircleIcon },
];

interface FloatingNavBarProps {
  state: any;
  descriptors?: any;
  navigation: any;
}

export const FloatingNavBar: React.FC<FloatingNavBarProps> = ({
  state,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [dockWidth, setDockWidth] = useState(340);

  // Smooth sliding indicator animation value (interpolates 0 -> 1 -> 2)
  const indicatorAnim = useRef(new Animated.Value(state.index)).current;

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

  // Animate indicator smoothly when the active tab index changes
  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: state.index,
      useNativeDriver: true,
      speed: 22,
      bounciness: 4,
    }).start();
  }, [state.index]);

  if (isKeyboardVisible) {
    return null;
  }

  const bottomOffset = Math.max(insets.bottom, spacing[12]) + spacing[4];
  const horizontalPadding = spacing[6];
  const innerWidth = Math.max(dockWidth - horizontalPadding * 2, 60);
  const tabWidth = innerWidth / TABS.length;

  const translateX = indicatorAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [
      horizontalPadding,
      horizontalPadding + tabWidth,
      horizontalPadding + tabWidth * 2,
      horizontalPadding + tabWidth * 3,
    ],
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
        <Animated.View
          style={[
            styles.slidingIndicator,
            {
              width: tabWidth,
              transform: [{ translateX }],
            },
          ]}
        />

        {/* Tab Items Row */}
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const routeIndex = state.routes.findIndex((r: any) => r.name === tab.name);
            const isFocused = state.index === routeIndex;
            return (
              <TabItem
                key={tab.name}
                tab={tab}
                isFocused={isFocused}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: state.routes[routeIndex]?.key,
                    canPreventDefault: true,
                  });

                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(tab.name);
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

interface TabItemProps {
  tab: TabConfig;
  isFocused: boolean;
  onPress: () => void;
}

const TabItem: React.FC<TabItemProps> = ({ tab, isFocused, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View
      style={[styles.tabButtonWrapper, { transform: [{ scale: scaleAnim }] }]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        // Removed unconstrained android_ripple to eliminate the large grey flash
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
    </Animated.View>
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
    gap: spacing[6],
    borderRadius: 24,
  },
  tabLabel: {
    fontSize: typography.fontSize[13],
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
