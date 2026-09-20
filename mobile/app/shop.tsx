import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar as RNStatusBar,
  ScrollView,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { AppText as Text } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCredits } from '../context/CreditsContext';
import { isIpad } from '../utils/device';
import { SmoothScrollView } from '../components/common/SmoothScrollView';
import { PlatformPressable } from '../components/common/PlatformPressable';
import { colors, spacing, typography } from '@/constants/theme';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Coins01Icon,
  Coins02Icon,
  HeartIcon,
  HeartPulseIcon,
  HeartPlusIcon,
  StarIcon,
  SparklesIcon,
  Diamond01Icon,
  BulbIcon,
  Exchange01Icon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';

// Easing curves adhering strictly to the expo-animation skill
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);      // Strong ease-out for entering UI
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);  // Smooth ease-in-out for layout reflow and exit

// Fluid UI-thread rotating chevron adhering to expo-animation cubic-bezier curves
function AnimatedChevron({ expanded, color }: { expanded: boolean; color: string }) {
  const rotation = useSharedValue(expanded ? 180 : 0);

  useEffect(() => {
    rotation.set(
      withTiming(expanded ? 180 : 0, {
        duration: 220,
        easing: EASE_IN_OUT,
      })
    );
  }, [expanded]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <HugeiconsIcon icon={ArrowDown01Icon} size={16} color={color} />
    </Animated.View>
  );
}

// Collapsible accordion container: zero delay, instant responsive collapse, zero remaining ghost content
interface CollapsibleSectionProps {
  expanded: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ expanded, children }: CollapsibleSectionProps) {
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const animatedHeight = useSharedValue(0);
  const animatedOpacity = useSharedValue(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0 && h !== contentHeight) {
      setContentHeight(h);
      if (expanded) {
        animatedHeight.set(h);
        animatedOpacity.set(1);
      }
    }
  };

  useEffect(() => {
    if (contentHeight === null) return;

    if (expanded) {
      animatedHeight.set(
        withTiming(contentHeight, {
          duration: 260,
          easing: EASE_OUT,
        })
      );
      animatedOpacity.set(
        withTiming(1, {
          duration: 220,
          easing: EASE_OUT,
        })
      );
    } else {
      animatedHeight.set(
        withTiming(0, {
          duration: 220,
          easing: EASE_IN_OUT,
        })
      );
      animatedOpacity.set(
        withTiming(0, {
          duration: 160,
          easing: EASE_IN_OUT,
        })
      );
    }
  }, [expanded, contentHeight]);

  const animatedStyle = useAnimatedStyle(() => {
    if (contentHeight === null) {
      return {
        height: expanded ? undefined : 0,
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
      };
    }
    return {
      height: animatedHeight.get(),
      opacity: animatedOpacity.get(),
      overflow: 'hidden',
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <View
        onLayout={handleLayout}
        style={
          contentHeight === null && !expanded
            ? styles.collapsibleMeasuring
            : styles.collapsibleContent
        }
      >
        {children}
      </View>
    </Animated.View>
  );
}

export default function ShopScreen({ isTab = false }: { isTab?: boolean } = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isPadDevice = isIpad();

  // ScrollView ref and category position tracking for focus on expand
  const scrollViewRef = useRef<ScrollView>(null);
  const creditsSectionY = useRef(0);
  const heartsSectionY = useRef(0);
  const tradeSectionY = useRef(0);

  const scrollToSection = (targetY: number) => {
    if (!scrollViewRef.current) return;
    const destY = Math.max(0, targetY - 10);
    scrollViewRef.current.scrollTo({
      y: destY,
      animated: true,
    });
    // Secondary alignment after height animation finishes to ensure accurate focus
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: destY,
        animated: true,
      });
    }, 240);
  };

  // Category expansion states
  const [expandedCredits, setExpandedCredits] = useState(false);
  const [expandedHearts, setExpandedHearts] = useState(false);
  const [expandedTrade, setExpandedTrade] = useState(false);

  // Purchase modal
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState(0);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseType, setPurchaseType] = useState<'credit' | 'heart'>('credit');

  // Trade modal
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeXpCost, setTradeXpCost] = useState(0);
  const [tradeRewardAmount, setTradeRewardAmount] = useState(0);
  const [tradeType, setTradeType] = useState<'credit' | 'heart'>('credit');

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  const [successType, setSuccessType] = useState<'credit' | 'heart'>('credit');

  // Insufficient XP modal
  const [showNotEnoughXpModal, setShowNotEnoughXpModal] = useState(false);
  const [requiredXp, setRequiredXp] = useState(0);

  const { credits, xp, hearts, addCredits, addHeart, convertXPToCredits, convertXPToHearts } = useCredits();

  const toggleCredits = () => {
    setExpandedCredits((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          scrollToSection(creditsSectionY.current);
        }, 50);
      }
      return next;
    });
  };

  const toggleHearts = () => {
    setExpandedHearts((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          scrollToSection(heartsSectionY.current);
        }, 50);
      }
      return next;
    });
  };

  const toggleTrade = () => {
    setExpandedTrade((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          scrollToSection(tradeSectionY.current);
        }, 50);
      }
      return next;
    });
  };

  const handlePurchase = (amount: number, price: string, type: 'credit' | 'heart') => {
    setPurchaseAmount(amount);
    setPurchasePrice(price);
    setPurchaseType(type);
    setShowPurchaseModal(true);
  };

  const confirmPurchase = () => {
    setShowPurchaseModal(false);
    if (purchaseType === 'credit') {
      addCredits(purchaseAmount);
    } else {
      addHeart(purchaseAmount);
    }
    setSuccessAmount(purchaseAmount);
    setSuccessType(purchaseType);
    setTimeout(() => {
      setShowSuccessModal(true);
    }, 350);
  };

  const handleExchange = (xpCost: number, rewardAmount: number, type: 'credit' | 'heart') => {
    if (xp < xpCost) {
      setRequiredXp(xpCost);
      setShowNotEnoughXpModal(true);
      return;
    }
    setTradeXpCost(xpCost);
    setTradeRewardAmount(rewardAmount);
    setTradeType(type);
    setShowTradeModal(true);
  };

  const confirmTrade = () => {
    setShowTradeModal(false);
    let success = false;
    if (tradeType === 'credit') {
      success = convertXPToCredits(tradeXpCost, tradeRewardAmount);
    } else {
      success = convertXPToHearts(tradeXpCost, tradeRewardAmount);
    }

    if (success) {
      setSuccessAmount(tradeRewardAmount);
      setSuccessType(tradeType);
      setTimeout(() => {
        setShowSuccessModal(true);
      }, 350);
    }
  };

  const isAndroid = Platform.OS === 'android';
  const statusBarHeight = isAndroid ? RNStatusBar.currentHeight || 0 : 0;
  const headerTopPadding = isAndroid
    ? Math.max(insets.top, statusBarHeight, spacing[28]) + spacing[12]
    : Math.max(insets.top, spacing[16]);

  return (
    <View style={styles.screen}>
      {/* INTEGRATED HEADER WITH LIVE CURRENCY PILLS */}
      <View style={[styles.headerBar, { paddingTop: headerTopPadding }]}>
        <View style={styles.headerContentRow}>
          <View style={styles.headerLeftCol}>
            {!isTab && (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => router.back()}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  size={isPadDevice ? 24 : 20}
                  color={colors.text}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle} numberOfLines={1}>
              Shop
            </Text>
          </View>

          {/* Currency Pills embedded directly in the Header */}
          <View style={styles.headerCurrencies}>
            {/* Credits Pill */}
            <View style={[styles.headerPill, styles.headerPillGold]}>
              <HugeiconsIcon icon={Coins01Icon} size={isPadDevice ? 16 : 13} color="#D97706" />
              <Text style={styles.headerPillText}>{credits.toLocaleString()}</Text>
            </View>

            {/* Lives Pill */}
            <View style={[styles.headerPill, styles.headerPillCrimson]}>
              <HugeiconsIcon icon={HeartIcon} size={isPadDevice ? 16 : 13} color="#EF4444" />
              <Text style={styles.headerPillText}>{hearts.toLocaleString()}</Text>
            </View>

            {/* Study XP Pill */}
            <View style={[styles.headerPill, styles.headerPillPurple]}>
              <HugeiconsIcon icon={StarIcon} size={isPadDevice ? 16 : 13} color="#8B5CF6" />
              <Text style={styles.headerPillText}>
                {xp >= 10000 ? `${(xp / 1000).toFixed(1)}k` : xp.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Main Shop Scrollable View */}
      <SmoothScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 24) + (isTab ? 96 : 32) },
        ]}
      >
        {/* Featured in Shop Whole Card */}
        <View style={styles.featuredCard}>
          <View style={styles.featuredHeader}>
            <View style={styles.featuredBadge}>
              <HugeiconsIcon icon={SparklesIcon} size={13} color="#FFFFFF" />
              <Text style={styles.featuredBadgeText}>FEATURED IN SHOP</Text>
            </View>
          </View>
          <View style={styles.featuredContent}>
            <View style={styles.featuredTextGroup}>
              <Text style={styles.featuredTitle}>Power Up Your Learning</Text>
              <Text style={styles.featuredDesc}>
                Unlock AI hints for tricky equations, keep quiz streaks protected with extra lives, and exchange earned XP for study boosters.
              </Text>
            </View>
            <Image 
              source={require("../assets/animations/wealth_momo.png")} 
              style={styles.featuredImage} 
              resizeMode="contain" 
            />
          </View>
        </View>

        {/* CATEGORY 1: MAGIC CREDITS */}
        <View
          onLayout={(e) => {
            creditsSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <SectionHeader
            icon={Coins01Icon}
            iconColor="#D97706"
            title="Magic Credits"
            subtitle="Instant AI hints, problem solving, and reviewer explanations"
          />
          <View style={styles.packagesContainer}>
            {/* Default featured single card */}
            <PackageCard
              title="Momo's Backpack"
              reward="500 Credits"
              subtext="Most popular pack for active students"
              price="$3.99"
              badgeText="POPULAR"
              icon={Coins02Icon}
              iconColor={colors.primary}
              iconBgColor={colors.primarySoft}
              accentColor={colors.primary}
              onPress={() => handlePurchase(500, '$3.99', 'credit')}
            />

            {/* Remaining options revealed with smooth Reanimated ease effect */}
            <CollapsibleSection expanded={expandedCredits}>
              <View style={styles.extraCardsGroup}>
                <PackageCard
                  title="Little Pouch"
                  reward="100 Credits"
                  subtext="Perfect for a quick study session"
                  price="$0.99"
                  icon={Coins01Icon}
                  iconColor="#D97706"
                  iconBgColor="#FEF3C7"
                  accentColor="#D97706"
                  onPress={() => handlePurchase(100, '$0.99', 'credit')}
                />
                <PackageCard
                  title="Treasure Vault"
                  reward="1,500 Credits"
                  subtext="Best value for exams and midterms"
                  price="$9.99"
                  badgeText="BEST VALUE"
                  icon={Diamond01Icon}
                  iconColor="#0284C7"
                  iconBgColor="#E0F2FE"
                  accentColor="#0284C7"
                  onPress={() => handlePurchase(1500, '$9.99', 'credit')}
                />
              </View>
            </CollapsibleSection>

            {/* Buy More / Show Less Toggle Button */}
            <TouchableOpacity
              style={styles.expandToggleBtn}
              onPress={toggleCredits}
              activeOpacity={0.7}
            >
              <Text style={styles.expandToggleText}>
                {expandedCredits ? 'Show Less' : 'Buy More Credits (3 options)'}
              </Text>
              <AnimatedChevron expanded={expandedCredits} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* CATEGORY 2: QUIZ LIVES */}
        <View
          onLayout={(e) => {
            heartsSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <SectionHeader
            icon={HeartIcon}
            iconColor="#EF4444"
            title="Quiz Lives"
            subtitle="Replenish energy to protect your streaks and conquer tough quizzes"
          />
          <View style={styles.packagesContainer}>
            {/* Default featured single card */}
            <PackageCard
              title="High Five Pack"
              reward="5 Extra Lives"
              subtext="Recommended for marathon quizzes"
              price="$2.99"
              badgeText="POPULAR"
              icon={HeartPulseIcon}
              iconColor="#DC2626"
              iconBgColor="#FEE2E2"
              accentColor="#DC2626"
              onPress={() => handlePurchase(5, '$2.99', 'heart')}
            />

            {/* Remaining options revealed with smooth Reanimated ease effect */}
            <CollapsibleSection expanded={expandedHearts}>
              <View style={styles.extraCardsGroup}>
                <PackageCard
                  title="Single Heart"
                  reward="1 Extra Life"
                  subtext="One more chance to beat the quiz"
                  price="$0.99"
                  icon={HeartIcon}
                  iconColor="#EF4444"
                  iconBgColor="#FEE2E2"
                  accentColor="#EF4444"
                  onPress={() => handlePurchase(1, '$0.99', 'heart')}
                />
                <PackageCard
                  title="Infinite Bowl"
                  reward="15 Extra Lives"
                  subtext="Complete safety net for finals week"
                  price="$4.99"
                  badgeText="BEST VALUE"
                  icon={HeartPlusIcon}
                  iconColor="#991B1B"
                  iconBgColor="#FEE2E2"
                  accentColor="#991B1B"
                  onPress={() => handlePurchase(15, '$4.99', 'heart')}
                />
              </View>
            </CollapsibleSection>

            {/* Buy More / Show Less Toggle Button */}
            <TouchableOpacity
              style={styles.expandToggleBtn}
              onPress={toggleHearts}
              activeOpacity={0.7}
            >
              <Text style={styles.expandToggleText}>
                {expandedHearts ? 'Show Less' : 'Buy More Lives (3 options)'}
              </Text>
              <AnimatedChevron expanded={expandedHearts} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* CATEGORY 3: XP TRADING POST */}
        <View
          onLayout={(e) => {
            tradeSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <SectionHeader
            icon={Exchange01Icon}
            iconColor="#D97706"
            title="XP Trading Post"
            subtitle="Turn your hard-earned study stars into free credits and lives"
          />
          <View style={styles.packagesContainer}>
            {/* Default featured single card */}
            <ExchangeCard
              title="Momo's Special"
              reward="150 Credits"
              subtext="Triple credit pack with huge discount"
              xpCost={1200}
              badgeText="POPULAR"
              icon={SparklesIcon}
              iconColor={colors.primary}
              iconBgColor={colors.primarySoft}
              onPress={() => handleExchange(1200, 150, 'credit')}
            />

            {/* Remaining options revealed with smooth Reanimated ease effect */}
            <CollapsibleSection expanded={expandedTrade}>
              <View style={styles.extraCardsGroup}>
                <ExchangeCard
                  title="Quick Hint"
                  reward="50 Credits"
                  subtext="Get unstuck on a challenging question"
                  xpCost={500}
                  icon={BulbIcon}
                  iconColor="#D97706"
                  iconBgColor="#FEF3C7"
                  onPress={() => handleExchange(500, 50, 'credit')}
                />
                <ExchangeCard
                  title="Single Life"
                  reward="1 Extra Life"
                  subtext="Restore one life with study effort"
                  xpCost={800}
                  icon={HeartIcon}
                  iconColor="#EF4444"
                  iconBgColor="#FEE2E2"
                  onPress={() => handleExchange(800, 1, 'heart')}
                />
                <ExchangeCard
                  title="Five Lives Stash"
                  reward="5 Extra Lives"
                  subtext="Full protection pack from your hard work"
                  xpCost={3500}
                  badgeText="BEST VALUE"
                  icon={HeartPulseIcon}
                  iconColor="#DC2626"
                  iconBgColor="#FEE2E2"
                  onPress={() => handleExchange(3500, 5, 'heart')}
                />
              </View>
            </CollapsibleSection>

            {/* Explore More / Show Less Toggle Button */}
            <TouchableOpacity
              style={styles.expandToggleBtn}
              onPress={toggleTrade}
              activeOpacity={0.7}
            >
              <Text style={styles.expandToggleText}>
                {expandedTrade ? 'Show Less' : 'Explore More Trades (4 options)'}
              </Text>
              <AnimatedChevron expanded={expandedTrade} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </SmoothScrollView>

      {/* Purchase Confirmation Modal */}
      <Modal
        visible={showPurchaseModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Image 
              source={require('../assets/animations/wealth_momo.png')} 
              style={styles.modalImage} 
              resizeMode="contain" 
            />
            <Text style={styles.modalTitle}>Confirm Acquisition</Text>
            <Text style={styles.modalDesc}>
              You are acquiring{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {purchaseAmount} {purchaseType === 'credit' ? 'Magic Credits' : 'Extra Lives'}
              </Text>{' '}
              for <Text style={{ fontWeight: '700', color: colors.text }}>{purchasePrice}</Text>.
            </Text>

            <View style={styles.modalDetailBox}>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Item:</Text>
                <Text style={styles.modalDetailValue}>
                  {purchaseAmount} {purchaseType === 'credit' ? 'Credits' : 'Lives'}
                </Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Price:</Text>
                <Text style={[styles.modalDetailValue, { color: colors.primary, fontWeight: '700' }]}>
                  {purchasePrice}
                </Text>
              </View>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setShowPurchaseModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalPurchaseBtnSecondary}
                onPress={confirmPurchase}
                activeOpacity={0.8}
              >
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} color="#FFFFFF" />
                <Text style={styles.modalPurchaseText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Trade Confirmation Modal */}
      <Modal
        visible={showTradeModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Image 
              source={require('../assets/animations/xp_momo.png')} 
              style={styles.modalImage} 
              resizeMode="contain" 
            />
            <Text style={styles.modalTitle}>Confirm XP Exchange</Text>
            <Text style={styles.modalDesc}>
              Exchange your earned study XP for valuable in-app study boosters.
            </Text>

            <View style={styles.tradeComparisonBox}>
              <View style={styles.tradeSide}>
                <View style={[styles.tradeIconBadge, styles.tradeIconBadgePurple, { marginBottom: 6 }]}>
                  <HugeiconsIcon icon={StarIcon} size={16} color="#8B5CF6" />
                </View>
                <Text style={styles.tradeSideAmount}>{tradeXpCost.toLocaleString()}</Text>
                <Text style={styles.tradeSideLabel}>XP Spent</Text>
              </View>

              <View style={styles.tradeArrowCircle}>
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} color="#64748B" />
              </View>

              <View style={styles.tradeSide}>
                <View style={[
                  styles.tradeIconBadge, 
                  tradeType === 'credit' ? styles.tradeIconBadgeGold : styles.tradeIconBadgeCrimson, 
                  { marginBottom: 6 }
                ]}>
                  <HugeiconsIcon 
                    icon={tradeType === 'credit' ? Coins01Icon : HeartIcon} 
                    size={16} 
                    color={tradeType === 'credit' ? '#D97706' : '#EF4444'} 
                  />
                </View>
                <Text style={[
                  styles.tradeSideAmount, 
                  { color: tradeType === 'credit' ? '#D97706' : '#EF4444' }
                ]}>
                  +{tradeRewardAmount}
                </Text>
                <Text style={styles.tradeSideLabel}>{tradeType === 'credit' ? 'Credits' : 'Lives'}</Text>
              </View>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setShowTradeModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Keep XP</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalPurchaseBtnSecondary, { backgroundColor: '#D97706' }]}
                onPress={confirmTrade}
                activeOpacity={0.8}
              >
                <HugeiconsIcon icon={Exchange01Icon} size={18} color="#FFFFFF" />
                <Text style={styles.modalPurchaseText}>Trade Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Image 
              source={require('../assets/animations/cheer_momo.png')} 
              style={styles.modalImage} 
              resizeMode="contain" 
            />
            <View style={styles.successHalo}>
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={24} color="#059669" />
              <Text style={styles.successBadgeText}>Added to Account</Text>
            </View>
            <Text style={styles.modalTitle}>Success!</Text>
            <Text style={styles.modalDesc}>
              You received{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {successAmount} {successType === 'credit' ? 'Credits' : 'Extra Lives'}
              </Text>
              . They have been added to your balance and are ready for your next study session.
            </Text>
            <TouchableOpacity 
              style={styles.modalPurchaseBtn}
              onPress={() => setShowSuccessModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPurchaseText}>Awesome</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Not Enough XP Modal */}
      <Modal
        visible={showNotEnoughXpModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Image 
              source={require('../assets/animations/no_credits_momo.png')} 
              style={styles.modalImage} 
              resizeMode="contain" 
            />
            <View style={[styles.successHalo, { backgroundColor: '#FEF3C7' }]}>
              <HugeiconsIcon icon={AlertCircleIcon} size={20} color="#D97706" />
              <Text style={[styles.successBadgeText, { color: '#B45309' }]}>More XP Needed</Text>
            </View>
            <Text style={styles.modalTitle}>Keep Studying!</Text>
            <Text style={styles.modalDesc}>
              This trade requires <Text style={{ fontWeight: '700', color: '#D97706' }}>{requiredXp.toLocaleString()} XP</Text>. 
              You currently have <Text style={{ fontWeight: '700', color: colors.text }}>{xp.toLocaleString()} XP</Text>.
            </Text>

            {/* Progress bar to target */}
            <View style={styles.xpProgressContainer}>
              <View style={styles.xpProgressTrack}>
                <View 
                  style={[
                    styles.xpProgressFill, 
                    { width: `${Math.min(100, Math.round((xp / Math.max(requiredXp, 1)) * 100))}%` }
                  ]} 
                />
              </View>
              <View style={styles.xpProgressMeta}>
                <Text style={styles.xpProgressLabel}>{xp.toLocaleString()} / {requiredXp.toLocaleString()} XP</Text>
                <Text style={styles.xpProgressPercent}>
                  {Math.min(100, Math.round((xp / Math.max(requiredXp, 1)) * 100))}%
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.modalPurchaseBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowNotEnoughXpModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPurchaseText}>Continue Studying</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionHeader({
  icon,
  iconColor,
  title,
  subtitle,
}: {
  icon: any;
  iconColor: string;
  title: string;
  subtitle: string;
}) {
  const isPadDevice = isIpad();

  return (
    <View style={styles.sectionHeaderBox}>
      <View style={styles.sectionHeaderTitleRow}>
        <View style={[styles.sectionIconBadge, { backgroundColor: iconColor + '18' }]}>
          <HugeiconsIcon icon={icon} size={isPadDevice ? 18 : 15} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

interface PackageCardProps {
  title: string;
  reward: string;
  subtext: string;
  price: string;
  badgeText?: string;
  icon: any;
  iconColor: string;
  iconBgColor: string;
  accentColor: string;
  onPress: () => void;
}

function PackageCard({
  title,
  reward,
  subtext,
  price,
  badgeText,
  icon,
  iconColor,
  iconBgColor,
  accentColor,
  onPress,
}: PackageCardProps) {
  const isPadDevice = isIpad();

  return (
    <PlatformPressable
      style={[styles.card, badgeText ? styles.cardHighlight : null]}
      onPress={onPress}
    >
      {badgeText && (
        <View style={styles.cardBadge}>
          <HugeiconsIcon icon={SparklesIcon} size={11} color="#FFFFFF" />
          <Text style={styles.cardBadgeText}>{badgeText}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={[styles.iconSquircle, { backgroundColor: iconBgColor }]}>
          <HugeiconsIcon icon={icon} size={isPadDevice ? 28 : 22} color={iconColor} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Text style={[styles.cardReward, { color: accentColor }]} numberOfLines={1}>{reward}</Text>
          <Text style={styles.cardSubtext} numberOfLines={1}>{subtext}</Text>
        </View>
        <View style={styles.priceActionBtn}>
          <Text style={styles.priceActionText} numberOfLines={1}>{price}</Text>
        </View>
      </View>
    </PlatformPressable>
  );
}

interface ExchangeCardProps {
  title: string;
  reward: string;
  subtext: string;
  xpCost: number;
  badgeText?: string;
  icon: any;
  iconColor: string;
  iconBgColor: string;
  onPress: () => void;
}

function ExchangeCard({
  title,
  reward,
  subtext,
  xpCost,
  badgeText,
  icon,
  iconColor,
  iconBgColor,
  onPress,
}: ExchangeCardProps) {
  const isPadDevice = isIpad();

  return (
    <PlatformPressable
      style={[styles.card, badgeText ? styles.cardHighlightTrade : null]}
      onPress={onPress}
    >
      {badgeText && (
        <View style={[styles.cardBadge, { backgroundColor: '#D97706' }]}>
          <HugeiconsIcon icon={SparklesIcon} size={11} color="#FFFFFF" />
          <Text style={styles.cardBadgeText}>{badgeText}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={[styles.iconSquircle, { backgroundColor: iconBgColor }]}>
          <HugeiconsIcon icon={icon} size={isPadDevice ? 28 : 22} color={iconColor} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Text style={[styles.cardReward, { color: '#B45309' }]} numberOfLines={1}>{reward}</Text>
          <Text style={styles.cardSubtext} numberOfLines={1}>{subtext}</Text>
        </View>
        <View style={styles.tradeActionBtn}>
          <HugeiconsIcon icon={StarIcon} size={13} color="#D97706" />
          <Text style={styles.tradeActionText} numberOfLines={1}>{xpCost.toLocaleString()}</Text>
          <Text style={styles.tradeActionSub}>XP</Text>
        </View>
      </View>
    </PlatformPressable>
  );
}

const isPadDevice = isIpad();

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  /* INTEGRATED HEADER BAR WITH CURRENCY PILLS */
  headerBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: isPadDevice ? spacing[28] : spacing[16],
    paddingBottom: isPadDevice ? spacing[14] : spacing[10],
    zIndex: 10,
  },
  headerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: isPadDevice ? 48 : 38,
    gap: 10,
  },
  headerLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  iconBtn: {
    width: isPadDevice ? 42 : 34,
    height: isPadDevice ? 42 : 34,
    borderRadius: isPadDevice ? 21 : 17,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: isPadDevice ? typography.fontSize[22] : typography.fontSize[18],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    letterSpacing: typography.letterSpacing[-0.3],
  },
  headerCurrencies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isPadDevice ? 10 : 6,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingVertical: isPadDevice ? 7 : 5,
    paddingHorizontal: isPadDevice ? 12 : 8,
    borderRadius: isPadDevice ? 14 : 10,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  headerPillGold: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  headerPillCrimson: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  headerPillPurple: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  headerPillText: {
    fontSize: isPadDevice ? 13.5 : 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  /* SCROLL CONTENT CONTAINER */
  container: {
    paddingHorizontal: isPadDevice ? 36 : 20,
    paddingTop: 16,
    maxWidth: isPadDevice ? 860 : undefined,
    width: isPadDevice ? '100%' : undefined,
    alignSelf: isPadDevice ? 'center' : undefined,
  },

  /* FEATURED WHOLE HERO CARD */
  featuredCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: isPadDevice ? 24 : 18,
    padding: isPadDevice ? 22 : 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  featuredHeader: {
    marginBottom: 6,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  featuredContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  featuredTextGroup: {
    flex: 1,
  },
  featuredTitle: {
    fontSize: isPadDevice ? 21 : 17,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 4,
  },
  featuredDesc: {
    fontSize: isPadDevice ? 13.5 : 12,
    color: '#4338CA',
    lineHeight: isPadDevice ? 20 : 17,
  },
  featuredImage: {
    width: isPadDevice ? 98 : 76,
    height: isPadDevice ? 98 : 76,
    flexShrink: 0,
  },

  /* SECTION HEADERS */
  sectionHeaderBox: {
    marginTop: 6,
    marginBottom: 10,
  },
  sectionHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  sectionIconBadge: {
    width: isPadDevice ? 28 : 24,
    height: isPadDevice ? 28 : 24,
    borderRadius: isPadDevice ? 9 : 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: isPadDevice ? 18 : 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: isPadDevice ? 13 : 11.5,
    color: '#64748B',
    marginLeft: isPadDevice ? 36 : 32,
  },

  /* PACKAGES LIST */
  packagesContainer: {
    marginBottom: 20,
  },
  extraCardsGroup: {
    paddingTop: isPadDevice ? 12 : 9,
    gap: isPadDevice ? 12 : 9,
  },
  collapsibleMeasuring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
  },
  collapsibleContent: {
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: isPadDevice ? 18 : 15,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  cardHighlight: {
    borderColor: colors.primaryBorder,
    backgroundColor: '#FAFAFF',
  },
  cardHighlightTrade: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFEFA',
  },
  cardBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderBottomLeftRadius: 10,
    zIndex: 2,
  },
  cardBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isPadDevice ? 16 : 13,
    gap: 12,
  },
  iconSquircle: {
    width: isPadDevice ? 52 : 44,
    height: isPadDevice ? 52 : 44,
    borderRadius: isPadDevice ? 16 : 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: isPadDevice ? 15.5 : 13.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  cardReward: {
    fontSize: isPadDevice ? 14.5 : 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  cardSubtext: {
    fontSize: isPadDevice ? 12 : 11,
    color: '#64748B',
  },
  priceActionBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: isPadDevice ? 15 : 12,
    paddingVertical: isPadDevice ? 9 : 7,
    borderRadius: isPadDevice ? 13 : 9,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: isPadDevice ? 78 : 64,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priceActionText: {
    fontSize: isPadDevice ? 14.5 : 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  tradeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: isPadDevice ? 13 : 10,
    paddingVertical: isPadDevice ? 9 : 7,
    borderRadius: isPadDevice ? 13 : 9,
    borderWidth: 1,
    borderColor: '#FDE68A',
    minWidth: isPadDevice ? 84 : 70,
    justifyContent: 'center',
  },
  tradeActionText: {
    fontSize: isPadDevice ? 14 : 12.5,
    fontWeight: '800',
    color: '#B45309',
  },
  tradeActionSub: {
    fontSize: isPadDevice ? 11.5 : 10,
    fontWeight: '700',
    color: '#D97706',
  },

  /* EXPAND / COLLAPSE TOGGLE BUTTON */
  expandToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: isPadDevice ? 12 : 10,
    paddingHorizontal: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: isPadDevice ? 14 : 11,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
    marginTop: isPadDevice ? 12 : 9,
  },
  expandToggleText: {
    fontSize: isPadDevice ? 14 : 12.5,
    fontWeight: '700',
    color: colors.primary,
  },

  /* MODALS */
  modalOverlay: {
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.55)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF', 
    padding: isPadDevice ? 32 : 22, 
    borderRadius: isPadDevice ? 28 : 22, 
    alignItems: 'center', 
    width: '100%',
    maxWidth: isPadDevice ? 480 : 330,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalImage: {
    width: 96,
    height: 96,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18, 
    fontWeight: '800', 
    color: '#0F172A', 
    marginBottom: 6, 
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 13, 
    color: '#64748B', 
    textAlign: 'center', 
    lineHeight: 19,
    marginBottom: 16,
  },
  modalDetailBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 6,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalDetailLabel: {
    fontSize: 12.5,
    color: '#64748B',
  },
  modalDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  modalActionsRow: {
    flexDirection: 'row', 
    gap: 10, 
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1, 
    backgroundColor: '#F1F5F9', 
    paddingVertical: 12, 
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPurchaseBtnSecondary: {
    flex: 1.3, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary, 
    paddingVertical: 12, 
    borderRadius: 12,
  },
  modalCancelText: {
    color: '#475569', 
    fontWeight: '700', 
    textAlign: 'center', 
    fontSize: 14,
  },
  modalPurchaseBtn: {
    backgroundColor: colors.primary, 
    paddingVertical: 12, 
    borderRadius: 12, 
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPurchaseText: {
    color: '#FFFFFF', 
    fontWeight: '700', 
    textAlign: 'center', 
    fontSize: 14,
  },

  /* TRADE COMPARISON IN MODAL */
  tradeComparisonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  tradeSide: {
    alignItems: 'center',
    flex: 1,
  },
  tradeSideAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  tradeSideLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  tradeArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeIconBadge: {
    width: isPadDevice ? 34 : 28,
    height: isPadDevice ? 34 : 28,
    borderRadius: isPadDevice ? 11 : 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeIconBadgeGold: {
    backgroundColor: '#FEF3C7',
  },
  tradeIconBadgeCrimson: {
    backgroundColor: '#FEE2E2',
  },
  tradeIconBadgePurple: {
    backgroundColor: '#EDE9FE',
  },

  /* SUCCESS & XP BADGES IN MODAL */
  successHalo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  successBadgeText: {
    color: '#065F46',
    fontWeight: '700',
    fontSize: 11.5,
  },

  /* XP PROGRESS BAR IN MODAL */
  xpProgressContainer: {
    width: '100%',
    marginBottom: 18,
  },
  xpProgressTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  xpProgressFill: {
    height: '100%',
    backgroundColor: '#D97706',
    borderRadius: 4,
  },
  xpProgressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpProgressLabel: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  xpProgressPercent: {
    fontSize: 11.5,
    color: '#B45309',
    fontWeight: '700',
  },
});
