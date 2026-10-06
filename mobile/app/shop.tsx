import type { ShopMotionName } from '@/lib/animations/shopMotion';
import { MomoAnimation } from '@/components/mascot/MomoAnimation';
import { StudyIcon } from '@/components/common/StudyIcon';
import { formatBalance, tradeEligibility } from '@/utils/shopRules';
import React, { useState, useRef } from 'react';
import {
  View,
  Alert,
  ScrollView,
  useWindowDimensions,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
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
  CheckmarkCircle01Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';

import { canRefillHearts, heartPackGrant } from '../lib/study/heartCapacity';

const CREDIT_PACKS = [
  { art: 'shop-credit-pouch' as const, title: 'Little Pouch', reward: '100 credits', subtext: 'For a few hints or explanations', price: '$0.99', amount: 100, icon: Coins01Icon, iconColor: '#B45309', iconBgColor: '#FEF3C7', accentColor: '#92400E' },
  { art: 'shop-credit-backpack' as const, title: "Momo's Backpack", reward: '500 credits', subtext: 'For regular study sessions', price: '$3.99', amount: 500, icon: Coins02Icon, iconColor: colors.primary, iconBgColor: colors.primarySoft, accentColor: colors.primary },
  { art: 'shop-credit-vault' as const, title: 'Treasure Vault', reward: '1,500 credits', subtext: 'The lowest price per credit', price: '$9.99', amount: 1500, badgeText: 'BEST VALUE', icon: Diamond01Icon, iconColor: '#0284C7', iconBgColor: '#E0F2FE', accentColor: '#0369A1' },
];

const LIFE_PACKS = [
  { art: 'shop-heart-single' as const, title: 'Single Heart', reward: '1 extra life', subtext: 'One more try in a quiz', price: '$0.99', amount: 1, icon: HeartIcon, iconColor: '#DC2626', iconBgColor: '#FEE2E2', accentColor: '#B91C1C' },
  { art: 'shop-heart-five' as const, title: 'High Five', reward: '3 extra lives', subtext: 'A few more chances to practice', price: '$2.99', amount: 3, icon: HeartPulseIcon, iconColor: '#DC2626', iconBgColor: '#FEE2E2', accentColor: '#B91C1C' },
  { art: 'shop-heart-bowl' as const, title: 'Full Bowl', reward: 'Refill to 5 lives', subtext: 'Preview: tops up every missing heart', price: '$4.99', amount: 5, refill: true, badgeText: 'BEST VALUE', icon: HeartPlusIcon, iconColor: '#991B1B', iconBgColor: '#FEE2E2', accentColor: '#991B1B' },
];

const XP_TRADES = [
  { art: 'shop-hint-credits' as const, title: 'Quick Hint', reward: '50 credits', subtext: 'Spend XP on a little help', xpCost: 500, amount: 50, type: 'credit' as const, icon: BulbIcon, iconColor: '#B45309', iconBgColor: '#FEF3C7' },
  { art: 'shop-special-credits' as const, title: "Momo's Special", reward: '150 credits', subtext: 'More credits per XP', xpCost: 1200, amount: 150, type: 'credit' as const, icon: SparklesIcon, iconColor: colors.primary, iconBgColor: colors.primarySoft },
  { art: 'shop-heart-single' as const, title: 'Single Life', reward: '1 extra life', subtext: 'Restore one quiz life', xpCost: 800, amount: 1, type: 'heart' as const, icon: HeartIcon, iconColor: '#DC2626', iconBgColor: '#FEE2E2' },
  { art: 'shop-heart-five' as const, title: 'Five Lives', reward: '5 extra lives', subtext: 'More lives per XP', xpCost: 3500, amount: 5, type: 'heart' as const, icon: HeartPulseIcon, iconColor: '#DC2626', iconBgColor: '#FEE2E2' },
];

export default function ShopScreen({ isTab = false }: { isTab?: boolean } = {}) {
  const router = useRouter();
  const actionPending = useRef(false);
  const pendingSuccess = useRef(false);
  const insets = useSafeAreaInsets();

  const [selectedCategory, setSelectedCategory] = useState<'credits' | 'lives' | 'xp'>('credits');

  // Purchase modal
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState(0);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseType, setPurchaseType] = useState<'credit' | 'heart'>('credit');
  const [purchaseArt, setPurchaseArt] = useState<ShopMotionName>('shop-credit-pouch');
  const [purchaseRefill, setPurchaseRefill] = useState(false);

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

  const selectedPurchaseArt = purchaseArt;

  const handlePurchase = (pack: { amount: number; refill?: boolean; art: ShopMotionName }, price: string, type: 'credit' | 'heart') => {
    actionPending.current = false;
    const amount = type === 'heart' ? heartPackGrant(hearts, pack) : pack.amount;
    if (!amount) {
      Alert.alert('Five-heart limit', 'Choose a refill that fits your missing hearts.');
      return;
    }
    setPurchaseArt(pack.art);
    setPurchaseRefill(type === 'heart' && !!pack.refill);
    setPurchaseAmount(amount);
    setPurchasePrice(price);
    setPurchaseType(type);
    setShowPurchaseModal(true);
  };

  const openSuccess = () => {
    // iOS waits for native dismissal before presenting the next modal.
    if (Platform.OS === 'ios') pendingSuccess.current = true;
    else setShowSuccessModal(true);
  };
  const finishConfirmationDismissal = () => {
    if (pendingSuccess.current) {
      pendingSuccess.current = false;
      setShowSuccessModal(true);
    }
  };

  const confirmPurchase = () => {
    if (actionPending.current) return;
    // A refill grants whatever is missing at confirmation time; fixed packs must still fit.
    const grant = purchaseType === 'heart' ? heartPackGrant(hearts, { amount: purchaseAmount, refill: purchaseRefill }) : purchaseAmount;
    if (!grant) {
      setShowPurchaseModal(false);
      Alert.alert('Five-heart limit', 'This refill no longer fits your missing hearts.');
      return;
    }
    actionPending.current = true;
    setShowPurchaseModal(false);
    if (purchaseType === 'credit') {
      addCredits(grant);
    } else {
      addHeart(grant);
    }
    setSuccessAmount(grant);
    setSuccessType(purchaseType);
    openSuccess();
  };

  const handleExchange = (xpCost: number, rewardAmount: number, type: 'credit' | 'heart') => {
    actionPending.current = false;
    if (type === 'heart' && !canRefillHearts(hearts, rewardAmount)) {
      Alert.alert('Five-heart limit', 'Choose a refill that fits your missing hearts.');
      return;
    }
    if (!tradeEligibility(xp, xpCost).eligible) {
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
    if (actionPending.current) return;
    actionPending.current = true;
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
      openSuccess();
    } else if (tradeType === 'heart' && !canRefillHearts(hearts, tradeRewardAmount)) {
      Alert.alert('Five-heart limit', 'No XP was spent. This refill no longer fits your missing hearts.');
    } else {
      setRequiredXp(tradeXpCost);
      setShowNotEnoughXpModal(true);
    }
  };

  const isAndroid = Platform.OS === 'android';
  const statusBarHeight = isAndroid ? RNStatusBar.currentHeight || 0 : 0;
  const headerTopPadding = isAndroid
    ? Math.max(insets.top, statusBarHeight, spacing[28]) + spacing[12]
    : Math.max(insets.top, spacing[16]);

  return (
    <View testID="shop-screen" style={styles.screen}>
      <View style={[styles.headerBar, { paddingTop: headerTopPadding }]}>
        <View style={styles.headerLeftCol}>
          {!isTab && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)');
              }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Study shop</Text>
            <Text style={styles.headerSubtitle}>Choose what helps you keep going</Text>
          </View>
        </View>
      </View>

      <SmoothScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 24) + (isTab ? 96 : 32) },
        ]}
      >
        <View style={styles.walletCard}>
          <Text style={styles.walletEyebrow}>YOUR BALANCE</Text>
          <Text style={styles.walletTitle}>Ready for your next session</Text>
          <View style={styles.walletGrid}>
            <BalanceTile icon={Coins01Icon} label="Credits" value={formatBalance(credits)} color="#B45309" background="#FFFBEB" />
            <BalanceTile icon={HeartIcon} label="Lives" value={formatBalance(hearts)} color="#DC2626" background="#FEF2F2" />
            <BalanceTile art="shop-xp-badge" icon={StarIcon} label="Study XP" value={formatBalance(xp)} color="#7C3AED" background="#F5F3FF" />
          </View>
        </View>

        <View style={styles.featuredCard}>
          <View style={styles.featuredTextGroup}>
            <Text style={styles.featuredEyebrow}>STUDY SUPPORT</Text>
            <Text style={styles.featuredTitle}>A little help, more progress</Text>
            <Text style={styles.featuredDesc}>Get help with a tough question, add quiz lives, or use the XP you earned.</Text>
          </View>
          <MomoAnimation name="momo-proud" active={false} style={styles.featuredImage} />
        </View>

        <Text style={styles.catalogTitle}>What do you need?</Text>
        <Text style={styles.catalogSubtitle}>Compare all the options in one place.</Text>
        <Text style={styles.catalogDisclosure}>Listed prices are for preview. No payment is taken.</Text>
        <View style={styles.categoryTabs} accessibilityRole="tablist">
          {([
            { id: 'credits', label: 'Credits', icon: Coins01Icon },
            { id: 'lives', label: 'Quiz lives', icon: HeartIcon },
            { id: 'xp', label: 'Use XP', icon: StarIcon },
          ] as const).map((category) => {
            const isSelected = selectedCategory === category.id;
            return (
              <TouchableOpacity
                key={category.id}
                testID={`shop-category-${category.id}`}
                style={[styles.categoryTab, isSelected && styles.categoryTabSelected]}
                onPress={() => setSelectedCategory(category.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={category.label}
              >
                <HugeiconsIcon icon={category.icon} size={16} color={isSelected ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.categoryTabText, isSelected && styles.categoryTabTextSelected]}>{category.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedCategory === 'credits' && (
          <View style={styles.catalogSection}>
            <SectionHeader icon={Coins01Icon} iconColor="#B45309" title="Credits for helpful hints" subtitle="Choose an amount that fits your study plans." />
            <View style={styles.offerList}>
              {CREDIT_PACKS.map((pack) => (
                <PackageCard key={pack.amount} {...pack} onPress={() => handlePurchase(pack, pack.price, 'credit')} />
              ))}
            </View>
          </View>
        )}

        {selectedCategory === 'lives' && (
          <View style={styles.catalogSection}>
            <SectionHeader icon={HeartIcon} iconColor="#DC2626" title="More tries for your quizzes" subtitle="Keep practicing after you use a life." />
            <View style={styles.offerList}>
              {LIFE_PACKS.map((pack) => (
                <PackageCard key={pack.art} {...pack} onPress={() => handlePurchase(pack, pack.price, 'heart')} />
              ))}
            </View>
          </View>
        )}

        {selectedCategory === 'xp' && (
          <View style={styles.catalogSection}>
            <SectionHeader icon={Exchange01Icon} iconColor={colors.primary} title="Use the XP you earned" subtitle={`Available: ${xp.toLocaleString()} XP. Trade it for study support.`} />
            <View style={styles.offerList}>
              {XP_TRADES.map((trade) => (
                <ExchangeCard
                  key={`${trade.type}-${trade.amount}`}
                  {...trade}
                  onPress={() => handleExchange(trade.xpCost, trade.amount, trade.type)}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.shopNote}>
          <HugeiconsIcon icon={BulbIcon} size={18} color={colors.primary} />
          <View style={styles.shopNoteText}>
            <Text style={styles.shopNoteTitle}>How this shop works</Text>
            <Text style={styles.shopNoteBody}>Credits are for study help. Lives give you more quiz attempts. Study XP can be exchanged for either.</Text>
            <Text style={styles.shopNoteDisclosure}>Purchases are a preview in this build. No payment is taken.</Text>
          </View>
        </View>
      </SmoothScrollView>

      {/* Purchase Confirmation Modal */}
      <Modal
        visible={showPurchaseModal}
        transparent={true}
        animationType="fade"
        onDismiss={finishConfirmationDismissal}
        onRequestClose={() => setShowPurchaseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} accessibilityViewIsModal bounces={false}>
            {showPurchaseModal && <MomoAnimation name={selectedPurchaseArt} active={showPurchaseModal} style={styles.modalImage} replayKey={`${purchaseType}:${purchaseAmount}`} />}
            <Text style={styles.modalTitle}>Preview this pack</Text>
            <Text style={styles.modalDesc}>
              Add a demo pack of{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {purchaseAmount} {purchaseType === 'credit' ? 'Magic Credits' : 'Extra Lives'}
              </Text>{' '}
              to this device.
            </Text>
            <Text style={styles.purchaseDisclosure}>No payment is taken.</Text>

            <View style={styles.modalDetailBox}>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Item:</Text>
                <Text style={styles.modalDetailValue}>
                  {purchaseAmount} {purchaseType === 'credit' ? 'Credits' : 'Lives'}
                </Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Listed price:</Text>
                <Text style={[styles.modalDetailValue, { color: colors.primary, fontWeight: '700' }]}>
                  {purchasePrice}
                </Text>
              </View>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                testID="shop-cancel-purchase"
                accessibilityRole="button" accessibilityLabel="Cancel demo pack"
                onPress={() => setShowPurchaseModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalPurchaseBtnSecondary}
                testID="shop-confirm-purchase"
                accessibilityRole="button" accessibilityLabel="Add demo pack, no payment"
                onPress={confirmPurchase}
                activeOpacity={0.8}
              >
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} color="#FFFFFF" />
                <Text style={styles.modalPurchaseText}>Add demo pack</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Trade Confirmation Modal */}
      <Modal
        visible={showTradeModal}
        transparent={true}
        animationType="fade"
        onDismiss={finishConfirmationDismissal}
        onRequestClose={() => setShowTradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} accessibilityViewIsModal bounces={false}>
            {showTradeModal && <MomoAnimation name={tradeType === 'credit' ? 'shop-exchange-credits' : 'shop-exchange-hearts'} style={styles.modalImage} replayKey={`${tradeType}:${tradeRewardAmount}`} />}
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
                testID="shop-cancel-trade"
                accessibilityRole="button" accessibilityLabel="Keep my XP"
                onPress={() => setShowTradeModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Keep XP</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalPurchaseBtnSecondary, { backgroundColor: '#D97706' }]}
                testID="shop-confirm-trade"
                accessibilityRole="button" accessibilityLabel={`Exchange ${tradeXpCost} XP for ${tradeRewardAmount} ${tradeType === "credit" ? "credits" : "lives"}`}
                onPress={confirmTrade}
                activeOpacity={0.8}
              >
                <HugeiconsIcon icon={Exchange01Icon} size={18} color="#FFFFFF" />
                <Text style={styles.modalPurchaseText}>Trade Now</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} accessibilityViewIsModal bounces={false}>
            {showSuccessModal && <MomoAnimation name="momo-cheer" active={showSuccessModal} style={styles.modalImage} />}
            {showSuccessModal && <MomoAnimation name={successType === 'credit' ? 'coin-reward' : 'heart-refill'} size={72} />}
            <View style={styles.successHalo}>
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={24} color="#059669" />
              <Text style={styles.successBadgeText}>Balance updated</Text>
            </View>
            <Text style={styles.modalTitle}>Success!</Text>
            <Text style={styles.modalDesc}>
              You received{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {successAmount} {successType === 'credit' ? 'Credits' : 'Extra Lives'}
              </Text>
              . They are ready for your next study session on this device.
            </Text>
            <TouchableOpacity 
              style={styles.modalPurchaseBtn}
              testID="shop-success-done"
              accessibilityRole="button" accessibilityLabel="Done, return to shop"
              onPress={() => setShowSuccessModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPurchaseText}>Awesome</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Not Enough XP Modal */}
      <Modal
        visible={showNotEnoughXpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNotEnoughXpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} accessibilityViewIsModal bounces={false}>
            {showNotEnoughXpModal && <MomoAnimation name="shop-xp-needed" style={styles.modalImage} replayKey={requiredXp} />}
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
              testID="shop-continue-studying"
              accessibilityRole="button" accessibilityLabel="Continue studying"
              onPress={() => { setShowNotEnoughXpModal(false); router.push("/(tabs)"); }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPurchaseText}>Continue Studying</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function BalanceTile({ art, icon, label, value, color, background }: {
  icon: any;
  art?: ShopMotionName;
  label: string;
  value: string;
  color: string;
  background: string;
}) {
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={[styles.balanceTile, { backgroundColor: background }]}>
      <StudyIcon name={label === "Credits" ? "coin" : label === "Lives" ? "heart" : "streak"} size={32} />
      <Text style={styles.balanceValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.balanceLabel} numberOfLines={1}>{label}</Text>
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
  art: ShopMotionName;
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
  art,
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
  const { width } = useWindowDimensions();
  const artSize = isPadDevice ? 80 : width < 360 ? 52 : 64;

  return (
    <PlatformPressable
      testID={`shop-pack-${art}`}
      style={[styles.card, badgeText ? styles.cardHighlight : null]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${reward}, ${price}. ${subtext}. Preview purchase`}
    >
      {badgeText && (
        <View style={styles.cardBadge}>
          <HugeiconsIcon icon={SparklesIcon} size={11} color="#FFFFFF" />
          <Text style={styles.cardBadgeText}>{badgeText}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={[styles.productArt, { width: artSize }]}>
          <MomoAnimation name={art} size={artSize} active={false} replayKey={art} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Text style={[styles.cardReward, { color: accentColor }]} numberOfLines={1}>{reward}</Text>
          <Text style={styles.cardSubtext} numberOfLines={2}>{subtext}</Text>
        </View>
        <View style={styles.priceActionBtn}>
          <Text style={styles.priceActionText} numberOfLines={1}>{price}</Text>
        </View>
      </View>
    </PlatformPressable>
  );
}

interface ExchangeCardProps {
  art: ShopMotionName;
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
  art,
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
  const { width } = useWindowDimensions();
  const artSize = isPadDevice ? 80 : width < 360 ? 52 : 64;

  return (
    <PlatformPressable
      style={[styles.card, badgeText ? styles.cardHighlightTrade : null]}
      onPress={onPress}
      accessibilityRole="button"
      testID={`shop-trade-${art}`}
      accessibilityLabel={`${title}, ${reward}, costs ${xpCost.toLocaleString()} XP. ${subtext}`}
    >
      {badgeText && (
        <View style={[styles.cardBadge, { backgroundColor: '#D97706' }]}>
          <HugeiconsIcon icon={SparklesIcon} size={11} color="#FFFFFF" />
          <Text style={styles.cardBadgeText}>{badgeText}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={[styles.productArt, { width: artSize }]}>
          <MomoAnimation name={art} size={artSize} active={false} replayKey={art} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Text style={[styles.cardReward, { color: '#B45309' }]} numberOfLines={1}>{reward}</Text>
          <Text style={styles.cardSubtext} numberOfLines={2}>{subtext}</Text>
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
    backgroundColor: colors.background,
  },

  headerBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: isPadDevice ? spacing[28] : spacing[20],
    paddingBottom: spacing[14],
  },
  headerLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    minHeight: 48,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: isPadDevice ? 26 : 23,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    lineHeight: isPadDevice ? 34 : 30,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  container: {
    paddingHorizontal: isPadDevice ? spacing[28] : spacing[16],
    paddingTop: spacing[18],
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  walletCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E8DFF2',
    padding: isPadDevice ? 20 : 16,
    marginBottom: spacing[14],
  },
  walletEyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.2,
  },
  walletTitle: {
    color: colors.text,
    fontSize: isPadDevice ? 20 : 17,
    fontWeight: typography.fontWeight.bold,
    marginTop: 2,
    marginBottom: spacing[14],
  },
  walletGrid: {
    flexDirection: 'row',
    gap: isPadDevice ? spacing[12] : spacing[8],
  },
  balanceTile: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: isPadDevice ? 16 : 12,
    gap: 3,
  },
  balanceValue: {
    color: colors.text,
    fontSize: isPadDevice ? 24 : 20,
    fontWeight: typography.fontWeight.bold,
    lineHeight: isPadDevice ? 30 : 26,
  },
  balanceLabel: {
    color: colors.textSecondary,
    fontSize: isPadDevice ? 12 : 10.5,
    fontWeight: typography.fontWeight.medium,
  },
  featuredCard: {
    backgroundColor: '#F1E8FF',
    borderRadius: 22,
    padding: isPadDevice ? 22 : 17,
    marginBottom: spacing[24],
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: isPadDevice ? 150 : 130,
  },
  featuredTextGroup: {
    flex: 1,
    zIndex: 1,
  },
  featuredEyebrow: {
    color: '#7C3AED',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  featuredTitle: {
    color: '#352452',
    fontSize: isPadDevice ? 22 : 18,
    fontWeight: typography.fontWeight.bold,
    lineHeight: isPadDevice ? 28 : 23,
    marginBottom: 4,
  },
  featuredDesc: {
    color: '#6D5C81',
    fontSize: isPadDevice ? 13 : 11.5,
    lineHeight: isPadDevice ? 19 : 17,
  },
  featuredImage: {
    width: isPadDevice ? 128 : 100,
    height: isPadDevice ? 128 : 100,
    marginLeft: spacing[8],
  },
  catalogTitle: {
    fontSize: isPadDevice ? 22 : 20,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  catalogSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing[8],
  },
  catalogDisclosure: {
    fontSize: 11.5,
    color: '#4338CA',
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[14],
  },
  categoryTabs: {
    flexDirection: 'row',
    backgroundColor: '#F0E8FA',
    padding: 4,
    borderRadius: 16,
    gap: 3,
    marginBottom: spacing[20],
  },
  categoryTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  categoryTabSelected: {
    backgroundColor: colors.primary,
  },
  categoryTabText: {
    fontSize: isPadDevice ? 14 : 11.5,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
  categoryTabTextSelected: {
    color: '#FFFFFF',
  },
  catalogSection: {
    marginBottom: spacing[20],
  },
  sectionHeaderBox: {
    marginBottom: spacing[14],
  },
  sectionHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginBottom: 3,
  },
  sectionIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: isPadDevice ? 18 : 16,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  offerList: {
    gap: spacing[10],
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E8DFF2',
    overflow: 'hidden',
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
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 3,
    paddingHorizontal: 9,
    marginTop: spacing[10],
    marginLeft: spacing[14],
    borderRadius: 8,
  },
  cardBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.4,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isPadDevice ? 18 : 14,
    gap: isPadDevice ? 14 : 10,
    minHeight: 90,
  },
  productArt: {
    width: isPadDevice ? 80 : 64,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconSquircle: {
    width: isPadDevice ? 52 : 42,
    height: isPadDevice ? 52 : 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: isPadDevice ? 14 : 12,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  cardReward: {
    fontSize: isPadDevice ? 19 : 16,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 3,
  },
  cardSubtext: {
    fontSize: isPadDevice ? 12 : 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  priceActionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: isPadDevice ? 15 : 10,
    paddingVertical: 9,
    borderRadius: 11,
    minWidth: isPadDevice ? 84 : 64,
    alignItems: 'center',
  },
  priceActionText: {
    fontSize: isPadDevice ? 14 : 12.5,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  tradeActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 11,
    paddingHorizontal: isPadDevice ? 12 : 8,
    paddingVertical: 7,
    minWidth: isPadDevice ? 85 : 69,
  },
  tradeActionText: {
    fontSize: isPadDevice ? 15 : 13,
    fontWeight: typography.fontWeight.bold,
    color: '#92400E',
  },
  tradeActionSub: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semiBold,
    color: '#B45309',
  },
  shopNote: {
    flexDirection: 'row',
    gap: spacing[10],
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: spacing[16],
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  shopNoteText: {
    flex: 1,
  },
  shopNoteTitle: {
    fontSize: 13,
    fontWeight: typography.fontWeight.bold,
    color: '#312E81',
    marginBottom: 3,
  },
  shopNoteBody: {
    fontSize: 11.5,
    lineHeight: 17,
    color: '#475569',
  },
  shopNoteDisclosure: {
    fontSize: 11.5,
    lineHeight: 17,
    color: '#4338CA',
    fontWeight: typography.fontWeight.semiBold,
    marginTop: spacing[8],
  },
  purchaseDisclosure: {
    color: '#4338CA',
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: spacing[14],
  },

  /* MODALS */
  modalOverlay: {
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.55)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
  },
  modalScroll: { width: "100%", maxWidth: isPadDevice ? 480 : 330, maxHeight: "90%", borderRadius: 22, flexGrow: 0 },
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
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8DFF2',
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
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8DFF2',
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
