import React, { useState } from 'react';
import { View, Text, Modal, Image, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCredits } from '../context/CreditsContext';
import { PageHeader } from '../components/common/PageHeader';
import { SmoothScrollView } from '../components/common/SmoothScrollView';
import { PlatformPressable } from '../components/common/PlatformPressable';

export default function ShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<'credits' | 'hearts' | 'trade'>('credits');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  const [successType, setSuccessType] = useState<'credit' | 'heart'>('credit');

  const [showNotEnoughXpModal, setShowNotEnoughXpModal] = useState(false);
  const [requiredXp, setRequiredXp] = useState(0);

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState(0);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseType, setPurchaseType] = useState<'credit' | 'heart'>('credit');

  const { credits, xp, hearts, addCredits, addHeart, convertXPToCredits, convertXPToHearts } = useCredits();

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
    }, 500); // slight delay to allow purchase modal to close first
  };

  const handleExchange = (xpCost: number, rewardAmount: number, type: 'credit' | 'heart') => {
    if (xp < xpCost) {
      setRequiredXp(xpCost);
      setShowNotEnoughXpModal(true);
      return;
    }
    
    const rewardLabel = type === 'credit' ? `${rewardAmount} magic credits` : `${rewardAmount} extra lives`;
    
    Alert.alert(
      'Momo says: Trade time! 🐾',
      `Do you want to give Momo ${xpCost} of your shiny XP for ${rewardLabel}?`,
      [
        { text: 'Nevermind', style: 'cancel' },
        {
          text: 'Trade!',
          onPress: () => {
            let success = false;
            if (type === 'credit') {
              success = convertXPToCredits(xpCost, rewardAmount);
            } else {
              success = convertXPToHearts(xpCost, rewardAmount);
            }

            if (success) {
              setSuccessAmount(rewardAmount);
              setSuccessType(type);
              setShowSuccessModal(true);
            } else {
              Alert.alert('Oops!', 'Momo dropped the shiny XP. Try again later!');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <PageHeader
        title="Momo's Shop"
        subtitle="Power up your study journey"
        showBack={true}
        onBack={() => router.back()}
      />

      {/* Live Currency Balance Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statPill}>
          <Text style={styles.statEmoji}>🪙</Text>
          <View style={styles.statTextGroup}>
            <Text style={styles.statValue} numberOfLines={1}>{credits.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Credits</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statPill}>
          <Text style={styles.statEmoji}>❤️</Text>
          <View style={styles.statTextGroup}>
            <Text style={styles.statValue} numberOfLines={1}>{hearts.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Lives</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statPill}>
          <Text style={styles.statEmoji}>🌟</Text>
          <View style={styles.statTextGroup}>
            <Text style={styles.statValue} numberOfLines={1}>{xp.toLocaleString()}</Text>
            <Text style={styles.statLabel}>XP</Text>
          </View>
        </View>
      </View>
      
      {/* Category Tabs */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'credits' && styles.tabButtonActive]}
          onPress={() => setActiveTab('credits')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabButtonText, activeTab === 'credits' && styles.tabButtonTextActive]} numberOfLines={1}>
            🪙 Credits
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'hearts' && styles.tabButtonActive]}
          onPress={() => setActiveTab('hearts')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabButtonText, activeTab === 'hearts' && styles.tabButtonTextActive]} numberOfLines={1}>
            ❤️ Lives
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'trade' && styles.tabButtonActive]}
          onPress={() => setActiveTab('trade')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabButtonText, activeTab === 'trade' && styles.tabButtonTextActive]} numberOfLines={1}>
            🌟 Trade XP
          </Text>
        </TouchableOpacity>
      </View>

      <SmoothScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 24) + 32 },
        ]}
      >
        {activeTab === 'credits' && (
          <>
            <View style={styles.headerBox}>
              <Image 
                source={require("../assets/animations/coins_momo.png")} 
                style={styles.mascotImage} 
                resizeMode="contain" 
              />
              <Text style={styles.headerTitle}>Momo's Magic Credits! ✨</Text>
              <Text style={styles.headerDesc}>
                Need a hint during a tough quiz? Stock up on Momo's magic credits so I can help you out! 🐾
              </Text>
            </View>

            <View style={styles.packagesContainer}>
              <PackageCard
                title="Little Pouch"
                reward="100 Credits"
                icon={<Text style={styles.packageEmoji}>🪙</Text>}
                price="$0.99"
                onPress={() => handlePurchase(100, '$0.99', 'credit')}
              />
              <PackageCard
                title="Momo's Backpack"
                reward="500 Credits"
                icon={<Text style={styles.packageEmoji}>💰</Text>}
                price="$3.99"
                recommended
                onPress={() => handlePurchase(500, '$3.99', 'credit')}
              />
              <PackageCard
                title="Treasure Chest"
                reward="1500 Credits"
                icon={<Text style={styles.packageEmoji}>💎</Text>}
                price="$9.99"
                onPress={() => handlePurchase(1500, '$9.99', 'credit')}
              />
            </View>
          </>
        )}

        {activeTab === 'hearts' && (
          <>
            <View style={[styles.headerBox, { backgroundColor: '#FEF2F2' }]}>
              <Image 
                source={require("../assets/animations/hearts_momo.png")} 
                style={styles.mascotImage} 
                resizeMode="contain" 
              />
              <Text style={[styles.headerTitle, { color: '#991B1B' }]}>Momo's Life Savers! ❤️</Text>
              <Text style={[styles.headerDesc, { color: '#B91C1C' }]}>
                Ran out of lives? Don't worry! Momo has some extra hearts right here so you can keep studying! 🐕
              </Text>
            </View>

            <View style={styles.packagesContainer}>
              <PackageCard
                title="Single Heart"
                reward="1 Extra Life"
                icon={<Text style={styles.packageEmoji}>❤️</Text>}
                price="$0.99"
                onPress={() => handlePurchase(1, '$0.99', 'heart')}
              />
              <PackageCard
                title="High Five!"
                reward="5 Extra Lives"
                icon={<Text style={styles.packageEmoji}>💖</Text>}
                price="$2.99"
                recommended
                onPress={() => handlePurchase(5, '$2.99', 'heart')}
              />
              <PackageCard
                title="Full Bowl"
                reward="15 Extra Lives"
                icon={<Text style={styles.packageEmoji}>💝</Text>}
                price="$4.99"
                onPress={() => handlePurchase(15, '$4.99', 'heart')}
              />
            </View>
          </>
        )}

        {activeTab === 'trade' && (
          <>
            <View style={[styles.headerBox, { backgroundColor: '#FFFBEB' }]}>
              <Image 
                source={require("../assets/animations/xp_momo.png")} 
                style={styles.mascotImage} 
                resizeMode="contain" 
              />
              <Text style={[styles.headerTitle, { color: '#92400E' }]}>XP Trading Post! 🌟</Text>
              <Text style={[styles.headerDesc, { color: '#B45309' }]}>
                You've been studying so hard! Trade your shiny XP stars here for extra credits or lives! Momo is so proud of you! 🎓
              </Text>
            </View>

            <View style={styles.packagesContainer}>
              <ExchangeCard
                title="A Quick Hint"
                reward="50 Credits"
                icon={<Text style={styles.packageEmoji}>💡</Text>}
                xpCost={500}
                onPress={() => handleExchange(500, 50, 'credit')}
              />
              <ExchangeCard
                title="Momo's Special"
                reward="150 Credits"
                icon={<Text style={styles.packageEmoji}>✨</Text>}
                xpCost={1200}
                recommended
                onPress={() => handleExchange(1200, 150, 'credit')}
              />
              <ExchangeCard
                title="Life Saver"
                reward="1 Extra Life"
                icon={<Text style={styles.packageEmoji}>❤️</Text>}
                xpCost={800}
                onPress={() => handleExchange(800, 1, 'heart')}
              />
              <ExchangeCard
                title="Five Lives Pack"
                reward="5 Extra Lives"
                icon={<Text style={styles.packageEmoji}>💖</Text>}
                xpCost={3500}
                onPress={() => handleExchange(3500, 5, 'heart')}
              />
            </View>
          </>
        )}
      </SmoothScrollView>

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
            <Text style={styles.modalTitle}>Yay! It worked! 🐾</Text>
            <Text style={styles.modalDesc}>
              Momo is so happy! You got {successAmount} {successType === 'credit' ? 'credits' : 'extra lives'}! Now let's go crush those quizzes!
            </Text>
            <TouchableOpacity 
              style={styles.modalPurchaseBtn}
              onPress={() => setShowSuccessModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPurchaseText}>Awesome!</Text>
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
            <Text style={styles.modalTitle}>Not enough shiny XP! 🥺</Text>
            <Text style={styles.modalDesc}>
              Momo checked your stash, and you need {requiredXp} XP for this trade. You currently have {xp}. Keep taking quizzes to earn more stars!
            </Text>
            <TouchableOpacity 
              style={[styles.modalPurchaseBtn, { backgroundColor: '#D97706' }]}
              onPress={() => setShowNotEnoughXpModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPurchaseText}>Got it, Momo!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            <Text style={styles.modalTitle}>Ready to get {purchaseType === 'credit' ? 'Credits' : 'Lives'}? 🦴</Text>
            <Text style={styles.modalDesc}>
              Momo asks: Do you want to buy {purchaseAmount} {purchaseType === 'credit' ? 'credits' : 'lives'} for {purchasePrice}?
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setShowPurchaseModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Nope</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalPurchaseBtnSecondary}
                onPress={confirmPurchase}
                activeOpacity={0.8}
              >
                <Text style={styles.modalPurchaseText}>Yes, please!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface PackageCardProps {
  title: string;
  reward: string;
  price: string;
  recommended?: boolean;
  icon: React.ReactNode;
  onPress: () => void;
}

function PackageCard({ title, reward, price, recommended = false, icon, onPress }: PackageCardProps) {
  return (
    <PlatformPressable
      style={[styles.card, recommended && styles.cardRecommended]}
      onPress={onPress}
    >
      {recommended && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedText}>⭐ MOMO'S FAVORITE</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.iconCircle}>
          {icon}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.cardCredits} numberOfLines={1}>{reward}</Text>
        </View>
        <View style={styles.cardPriceBox}>
          <Text style={styles.cardPrice} numberOfLines={1}>{price}</Text>
        </View>
      </View>
    </PlatformPressable>
  );
}

interface ExchangeCardProps {
  title: string;
  reward: string;
  xpCost: number;
  recommended?: boolean;
  icon: React.ReactNode;
  onPress: () => void;
}

function ExchangeCard({ title, reward, xpCost, recommended = false, icon, onPress }: ExchangeCardProps) {
  return (
    <PlatformPressable
      style={[styles.card, recommended && styles.cardRecommendedTrade]}
      onPress={onPress}
    >
      {recommended && (
        <View style={styles.recommendedBadgeTrade}>
          <Text style={styles.recommendedTextTrade}>✨ MOMO'S CHOICE</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={[styles.iconCircle, styles.iconCircleTrade]}>
          {icon}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.cardCredits} numberOfLines={1}>{reward}</Text>
        </View>
        <View style={styles.cardPriceBoxTrade}>
          <Text style={styles.cardPriceTrade} numberOfLines={1}>{xpCost.toLocaleString()}</Text>
          <Text style={styles.cardPriceLabelTrade}>XP</Text>
        </View>
      </View>
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statEmoji: {
    fontSize: 20,
  },
  statTextGroup: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerBox: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    marginBottom: 20,
  },
  mascotImage: {
    width: 90,
    height: 90,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 6,
    textAlign: 'center',
  },
  headerDesc: {
    fontSize: 13,
    color: '#4338CA',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  packagesContainer: {
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardRecommended: {
    borderColor: '#6366F1',
    backgroundColor: '#FAF5FF',
  },
  cardRecommendedTrade: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFDF5',
  },
  recommendedBadge: {
    backgroundColor: '#6366F1',
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    borderBottomRightRadius: 10,
  },
  recommendedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  recommendedBadgeTrade: {
    backgroundColor: '#D97706',
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    borderBottomRightRadius: 10,
  },
  recommendedTextTrade: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  packageEmoji: {
    fontSize: 24,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  iconCircleTrade: {
    backgroundColor: '#FEF3C7',
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  cardCredits: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  cardPriceBox: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    flexShrink: 0,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardPriceBoxTrade: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 78,
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardPriceTrade: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B45309',
  },
  cardPriceLabelTrade: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  modalOverlay: {
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: 'white', 
    padding: 24, 
    borderRadius: 24, 
    alignItems: 'center', 
    width: '100%',
    maxWidth: 340,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalImage: {
    width: 110,
    height: 110,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 19, 
    fontWeight: '800', 
    color: '#1E293B', 
    marginBottom: 8, 
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 14, 
    color: '#64748B', 
    textAlign: 'center', 
    lineHeight: 20,
    marginBottom: 20,
  },
  modalPurchaseBtn: {
    backgroundColor: '#4F46E5', 
    paddingHorizontal: 24, 
    paddingVertical: 13, 
    borderRadius: 14, 
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionsRow: {
    flexDirection: 'row', 
    gap: 12, 
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1, 
    backgroundColor: '#F1F5F9', 
    paddingVertical: 13, 
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPurchaseBtnSecondary: {
    flex: 1.2, 
    backgroundColor: '#4F46E5', 
    paddingVertical: 13, 
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#475569', 
    fontWeight: '700', 
    textAlign: 'center', 
    fontSize: 15,
  },
  modalPurchaseText: {
    color: 'white', 
    fontWeight: '700', 
    textAlign: 'center', 
    fontSize: 15,
  },
});
