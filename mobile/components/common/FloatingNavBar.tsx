import React, { useEffect, useState, useRef, useCallback } from "react";
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  Pressable,
  Animated as RNAnimated,
  Platform,
  Keyboard,
  useWindowDimensions,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Easing,
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
  GlassSurface,
  GlassButton,
  GlassContainer,
  triggerGlassHaptic,
  glassRadius,
} from "@/components/glass";
import {
  Home01Icon,
  BookOpen01Icon,
  UserCircleIcon,
  Store01Icon,
  Add01Icon,
  Upload01Icon,
  Camera01Icon,
  ArrowRight01Icon,
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
  onFabAction?: (action: 'upload' | 'solve' | 'studysets') => void;
}

export const FloatingNavBar: React.FC<FloatingNavBarProps> = ({
  state,
  navigation,
  activeIndex: customActiveIndex,
  progressAnim,
  onTabPress,
  onFabAction,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  const isTablet = isIpad() && windowWidth >= 600;
  const isCompact = windowWidth <= 380;
  const defaultDockWidth = Math.min(windowWidth * 0.92, isTablet ? 620 : 368);
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

  // Drawer slide-up animation value (0 = closed, 1 = open)
  const fabAnim = useRef(new RNAnimated.Value(0)).current;

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

  const openFabMenu = useCallback(() => {
    fabAnim.stopAnimation();
    setIsFabOpen(true);
    RNAnimated.spring(fabAnim, {
      toValue: 1,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [fabAnim]);

  const closeFabMenu = useCallback(() => {
    fabAnim.stopAnimation();
    RNAnimated.timing(fabAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsFabOpen(false);
    });
  }, [fabAnim]);

  const toggleFabMenu = useCallback(() => {
    if (isFabOpen) {
      closeFabMenu();
    } else {
      openFabMenu();
    }
  }, [isFabOpen, openFabMenu, closeFabMenu]);

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
  }, [effectiveActiveIndex, progressAnim, indicatorAnim]);

  if (isKeyboardVisible) {
    return null;
  }

  const bottomOffset = isTablet ? insets.bottom + spacing[16] : Math.max(insets.bottom, spacing[12]) + spacing[4];
  const horizontalPadding = isTablet ? spacing[12] : spacing[6];
  const innerWidth = Math.max(dockWidth - horizontalPadding * 2, 60);

  // 5 slots: Tab 0, Tab 1, Center FAB, Tab 2, Tab 3
  const slotWidth = innerWidth / 5;

  const fallbackTranslateX = indicatorAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [
      horizontalPadding,
      horizontalPadding + slotWidth,
      horizontalPadding + slotWidth * 3,
      horizontalPadding + slotWidth * 4,
    ],
    extrapolate: 'clamp',
  });

  const handleUploadPress = () => {
    closeFabMenu();
    if (onFabAction) {
      onFabAction('upload');
    } else {
      router.push('/documents/upload');
    }
  };

  const handleMathSolvePress = () => {
    closeFabMenu();
    if (onFabAction) {
      onFabAction('solve');
    } else {
      router.push('/math/solve');
    }
  };

  const handleStudySetsPress = () => {
    closeFabMenu();
    if (onFabAction) {
      onFabAction('studysets');
    } else if (onTabPress) {
      onTabPress(1);
    } else {
      router.push('/(tabs)/library');
    }
  };

  const handleTabSelect = (tabName: string, targetIndex: number) => {
    triggerGlassHaptic('selection');
    setOptimisticIndex(targetIndex);
    if (onTabPress) {
      onTabPress(targetIndex);
    } else if (navigation && state) {
      const routeIndex = state?.routes?.findIndex((r: any) => r.name === tabName) ?? targetIndex;
      const event = navigation.emit({
        type: "tabPress",
        target: state.routes[routeIndex]?.key,
        canPreventDefault: true,
      });

      if (effectiveActiveIndex !== targetIndex && !event.defaultPrevented) {
        navigation.navigate(tabName);
      }
    }
  };

  return (
    <>
      <View
        style={[
          styles.dockWrapper,
          {
            bottom: bottomOffset,
          },
        ]}
        pointerEvents="box-none"
      >
        <GlassSurface
          variant="prominent"
          radius={isTablet ? glassRadius.navBarTablet : glassRadius.navBarPhone}
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
              slotWidth={slotWidth}
              horizontalPadding={horizontalPadding}
            />
          ) : (
            <RNAnimated.View
              pointerEvents="none"
              style={[
                styles.slidingIndicator,
                {
                  width: slotWidth,
                  transform: [{ translateX: fallbackTranslateX }],
                },
              ]}
            />
          )}

          {/* 5-Slot Navigation Row grouped with native GlassContainer */}
          <GlassContainer spacing={8} style={styles.tabsRow}>
            {/* Slot 0: Home (Tab 0) */}
            <TabItem
              tab={TABS[0]}
              pageIndex={0}
              isFocused={effectiveActiveIndex === 0}
              progressAnim={progressAnim}
              isTablet={isTablet}
              isCompact={isCompact}
              onPress={() => handleTabSelect(TABS[0].name, 0)}
            />

            {/* Slot 1: Library (Tab 1) */}
            <TabItem
              tab={TABS[1]}
              pageIndex={1}
              isFocused={effectiveActiveIndex === 1}
              progressAnim={progressAnim}
              isTablet={isTablet}
              isCompact={isCompact}
              onPress={() => handleTabSelect(TABS[1].name, 1)}
            />

            {/* Slot 2: CENTER ENHANCED FAB BUTTON */}
            <CenterFabButton
              isTablet={isTablet}
              isOpen={isFabOpen}
              onPress={toggleFabMenu}
            />

            {/* Slot 3: Shop (Tab 2) */}
            <TabItem
              tab={TABS[2]}
              pageIndex={2}
              isFocused={effectiveActiveIndex === 2}
              progressAnim={progressAnim}
              isTablet={isTablet}
              isCompact={isCompact}
              onPress={() => handleTabSelect(TABS[2].name, 2)}
            />

            {/* Slot 4: Profile (Tab 3) */}
            <TabItem
              tab={TABS[3]}
              pageIndex={3}
              isFocused={effectiveActiveIndex === 3}
              progressAnim={progressAnim}
              isTablet={isTablet}
              isCompact={isCompact}
              onPress={() => handleTabSelect(TABS[3].name, 3)}
            />
          </GlassContainer>
        </GlassSurface>
      </View>

      {/* Action Drawer Sliding Up from Bottom */}
      <Modal
        visible={isFabOpen}
        transparent
        animationType="none"
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={closeFabMenu}
      >
        <View style={styles.modalRoot} accessibilityViewIsModal>
          {/* Dimmed backdrop */}
          <TouchableWithoutFeedback onPress={closeFabMenu}>
            <RNAnimated.View
              style={[
                styles.modalBackdrop,
                {
                  opacity: fabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ]}
            />
          </TouchableWithoutFeedback>

          {/* Drawer Container Going Up */}
          <RNAnimated.View
            style={[
              {
                transform: [
                  {
                    translateY: fabAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [520, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <GlassSurface
              variant="prominent"
              radius={30}
              style={[styles.drawerCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}
            >
            {/* Drawer Handle Bar */}
            <View style={styles.drawerHandleWrap}>
              <View style={styles.drawerHandleBar} />
            </View>

            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <View style={styles.drawerHeaderLeft}>
                <Text style={styles.drawerTitle}>What would you like to do?</Text>
                <Text style={styles.drawerSubtitle}>Start with notes, a question, or a saved reviewer.</Text>
              </View>
              <GlassButton
                variant="subtle"
                size="icon"
                radius={16}
                onPress={closeFabMenu}
                accessibilityLabel="Close drawer"
                style={styles.drawerCloseBtn}
                contentStyle={{ width: 48, height: 48 }}
              >
                <Text style={styles.drawerCloseText}>✕</Text>
              </GlassButton>
            </View>

            {/* Action Tiles List */}
            <View style={styles.drawerActionsList}>
              {/* Tile 1: Upload Document */}
              <Pressable
                style={[styles.drawerActionTile, styles.drawerPrimaryAction]}
                onPress={handleUploadPress}
                android_ripple={{ color: 'rgba(255,255,255,0.24)' }}
                accessibilityRole="button"
                accessibilityLabel="Create a reviewer from a document"
              >
                <View style={[styles.drawerActionIconWrap, styles.primaryIconWrap]}>
                  <HugeiconsIcon icon={Upload01Icon} size={22} color={colors.onPrimary} strokeWidth={2.4} />
                </View>
                <View style={styles.drawerActionTextCol}>
                  <View style={styles.drawerActionTitleRow}>
                    <Text style={[styles.drawerActionTitle, styles.primaryActionText]}>Create a reviewer</Text>
                    <View style={[styles.drawerBadge, styles.primaryBadge]}>
                      <Text style={[styles.drawerBadgeText, styles.primaryActionText]}>START HERE</Text>
                    </View>
                  </View>
                  <Text style={[styles.drawerActionDesc, styles.primaryActionDesc]}>
                    Upload notes to make flashcards and practice questions
                  </Text>
                </View>
                <View style={styles.drawerActionArrow}>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.onPrimary} strokeWidth={2.2} />
                </View>
              </Pressable>

              {/* Tile 2: Solve a Problem */}
              <Pressable
                style={styles.drawerActionTile}
                onPress={handleMathSolvePress}
                android_ripple={{ color: colors.primaryRipple }}
                accessibilityRole="button"
                accessibilityLabel="Solve a problem"
              >
                <View style={[styles.drawerActionIconWrap, styles.mathIconWrap]}>
                  <HugeiconsIcon icon={Camera01Icon} size={22} color="#D97706" strokeWidth={2.4} />
                </View>
                <View style={styles.drawerActionTextCol}>
                  <View style={styles.drawerActionTitleRow}>
                    <Text style={styles.drawerActionTitle}>Solve a Problem</Text>
                    <View style={[styles.drawerBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.drawerBadgeText, { color: '#B45309' }]}>Vision AI</Text>
                    </View>
                  </View>
                  <Text style={styles.drawerActionDesc}>
                    Scan an equation or tricky problem for instant step-by-step guidance
                  </Text>
                </View>
                <View style={styles.drawerActionArrow}>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#98A2B3" strokeWidth={2.2} />
                </View>
              </Pressable>

              {/* Tile 3: Study Sets */}
              <Pressable
                style={styles.drawerActionTile}
                onPress={handleStudySetsPress}
                android_ripple={{ color: colors.primaryRipple }}
                accessibilityRole="button"
                accessibilityLabel="Open study library"
              >
                <View style={[styles.drawerActionIconWrap, styles.studySetsIconWrap]}>
                  <HugeiconsIcon icon={BookOpen01Icon} size={22} color={colors.primary} strokeWidth={2.4} />
                </View>
                <View style={styles.drawerActionTextCol}>
                  <View style={styles.drawerActionTitleRow}>
                    <Text style={styles.drawerActionTitle}>View Study Sets</Text>
                    <View style={[styles.drawerBadge, { backgroundColor: colors.primarySoft }]}>
                      <Text style={[styles.drawerBadgeText, { color: colors.primary }]}>Your Library</Text>
                    </View>
                  </View>
                  <Text style={styles.drawerActionDesc}>
                    Review generated decks, study flashcards, and track quiz streaks
                  </Text>
                </View>
                <View style={styles.drawerActionArrow}>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#98A2B3" strokeWidth={2.2} />
                </View>
              </Pressable>
            </View>
            </GlassSurface>
          </RNAnimated.View>
        </View>
      </Modal>
    </>
  );
};

const ReanimatedIndicator: React.FC<{
  progressAnim: SharedValue<number>;
  slotWidth: number;
  horizontalPadding: number;
}> = ({ progressAnim, slotWidth, horizontalPadding }) => {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const clampedProgress = Math.max(0, Math.min(3, progressAnim.value));
    const tx = interpolate(
      clampedProgress,
      [0, 1, 2, 3],
      [
        horizontalPadding,
        horizontalPadding + slotWidth,
        horizontalPadding + slotWidth * 3,
        horizontalPadding + slotWidth * 4,
      ],
      Extrapolation.CLAMP
    );
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
          width: slotWidth,
        },
        animatedStyle,
      ]}
    />
  );
};

interface CenterFabButtonProps {
  isTablet: boolean;
  isOpen: boolean;
  onPress: () => void;
}

const CenterFabButton: React.FC<CenterFabButtonProps> = ({
  isTablet,
  isOpen,
  onPress,
}) => {
  const btnDimension = isTablet ? 54 : 48;

  return (
    <View style={styles.centerFabSlot}>
      <View style={styles.centerFabWrap}>
        <GlassButton
          variant="primary"
          size="icon"
          radius={glassRadius.full}
          haptic="medium"
          activeScale={0.92}
          onPress={onPress}
          style={[
            styles.centerFabBtn,
            isTablet && styles.centerFabBtnTablet,
            isOpen && styles.centerFabBtnOpen,
          ]}
          contentStyle={{ width: btnDimension, height: btnDimension }}
          accessibilityLabel="Open creation drawer"
        >
          <HugeiconsIcon
            icon={Add01Icon}
            size={isTablet ? 26 : 22}
            color="#FFFFFF"
            strokeWidth={2.8}
          />
        </GlassButton>
      </View>
    </View>
  );
};

interface TabItemProps {
  tab: TabConfig;
  pageIndex: number;
  isFocused: boolean;
  progressAnim?: SharedValue<number>;
  isTablet?: boolean;
  isCompact?: boolean;
  onPress: () => void;
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  pageIndex,
  isFocused,
  progressAnim,
  isTablet = false,
  isCompact = false,
  onPress,
}) => {
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;
  const iconSize = isTablet ? 26 : isCompact ? 17.5 : 19.5;

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
      return {
        opacity: isFocused ? 1 : 0,
        transform: [{ scale: isFocused ? 1 : 0.88 }],
      };
    }
    const dist = Math.abs(progressAnim.value - pageIndex);
    const active = interpolate(
      dist,
      [0, 0.65],
      [1, 0],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      dist,
      [0, 0.65],
      [1, 0.88],
      Extrapolation.CLAMP
    );
    return {
      opacity: active,
      transform: [{ scale }],
    };
  });

  const inactiveAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    if (!progressAnim) {
      return {
        opacity: isFocused ? 0 : 1,
        transform: [{ scale: isFocused ? 0.88 : 1 }],
      };
    }
    const dist = Math.abs(progressAnim.value - pageIndex);
    const active = interpolate(
      dist,
      [0, 0.65],
      [1, 0],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      dist,
      [0, 0.65],
      [0.88, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: 1 - active,
      transform: [{ scale }],
    };
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
        {/* Inactive state (grey icon only, centered) */}
        <Reanimated.View
          pointerEvents="none"
          style={[styles.tabItemInactive, inactiveAnimatedStyle]}
        >
          <HugeiconsIcon
            icon={tab.icon}
            size={iconSize}
            color={colors.textMuted}
            strokeWidth={1.8}
          />
        </Reanimated.View>

        {/* Active state (primary icon + full name label) */}
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
            style={[
              styles.tabLabel,
              styles.activeTabLabel,
              isCompact && styles.tabLabelCompact,
            ]}
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
    width: "92%",
    maxWidth: isPadDevice ? 620 : 368,
    height: isPadDevice ? 72 : 58,
    paddingHorizontal: isPadDevice ? spacing[12] : spacing[6],
    paddingVertical: isPadDevice ? spacing[8] : spacing[5],
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
  tabItemInactive: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabItemInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: isPadDevice ? spacing[8] : spacing[3.5],
  },
  tabItemActiveOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabLabel: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[11.5],
    letterSpacing: typography.letterSpacing[-0.2],
  },
  activeTabLabel: {
    fontWeight: typography.fontWeight.extraBold,
    color: colors.primary,
  },
  tabLabelCompact: {
    fontSize: 9.5,
    letterSpacing: -0.4,
  },

  // Enhanced Center FAB Button
  centerFabSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    zIndex: 10,
  },
  centerFabWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerFabBtn: {
    width: isPadDevice ? 54 : 48,
    height: isPadDevice ? 54 : 48,
    borderRadius: (isPadDevice ? 54 : 48) / 2,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  centerFabBtnTablet: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  centerFabBtnOpen: {
    opacity: 0.95,
  },

  // Drawer modal styling
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    position: "relative",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  drawerCard: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#101828',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.14,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  drawerHandleWrap: {
    alignItems: "center",
    paddingVertical: 6,
  },
  drawerHandleBar: {
    width: 40,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: '#D0D5DD',
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  drawerHeaderLeft: {
    flex: 1,
  },
  drawerTitle: {
    fontSize: 21,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  drawerSubtitle: {
    fontSize: 12.5,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  drawerCloseBtn: {
    marginLeft: 12,
  },
  drawerCloseText: {
    fontSize: 14,
    fontWeight: "bold",
    color: '#667085',
  },
  drawerActionsList: {
    gap: 12,
  },
  drawerActionTile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.74)' : '#F5F7FB',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    overflow: 'hidden',
  },
  drawerPrimaryAction: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  primaryIconWrap: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  primaryBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  primaryActionText: {
    color: colors.onPrimary,
  },
  primaryActionDesc: {
    color: 'rgba(255,255,255,0.86)',
  },
  drawerActionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  uploadIconWrap: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  mathIconWrap: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  studySetsIconWrap: {
    backgroundColor: '#F4EBFF',
    borderWidth: 1,
    borderColor: '#D6BBFB',
  },
  drawerActionTextCol: {
    flex: 1,
  },
  drawerActionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  drawerActionTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  drawerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  drawerBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
  },
  drawerActionDesc: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  drawerActionArrow: {
    marginLeft: 8,
    padding: 4,
  },
});
