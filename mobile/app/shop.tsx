import React, { useState } from 'react';
import { View, Text, Modal, Image, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { BitcoinShoppingIcon, FavouriteIcon, GameController01Icon, SparklesIcon, Coins01Icon } from '@hugeicons/core-free-icons';
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
        subtitle={`🪙 ${credits}  |  ❤️ ${hearts}  |  🌟 ${xp}`}
        showBack={true}
        onBack={() => router.back()}
      />
      
      <View style={styles.tabSwitcher}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'credits' && styles.tabButtonActive]}
          onPress={() => setActiveTab('credits')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'credits' && styles.tabButtonTextActive]}>🪙 Credits</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'hearts' && styles.tabButtonActive]}
          onPress={() => setActiveTab('hearts')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'hearts' && styles.tabButtonTextActive]}>❤️ Lives</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'trade' && styles.tabButtonActive]}
          onPress={() => setActiveTab('trade')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'trade' && styles.tabButtonTextActive]}>🌟 Trade XP</Text>
        </TouchableOpacity>
      </View>

      <SmoothScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) + 88 }]}>
        {activeTab === 'credits' && (
          <>
            <View style={styles.headerBox}>
              <Image source={require("../assets/animations/coins_momo.png")} style={{ width: 100, height: 100, marginBottom: 12 }} resizeMode="contain" />
              <Text style={styles.headerTitle}>Momo's Magic Credits! ✨</Text>
              <Text style={styles.headerDesc}>
                Need a hint during a tough quiz? Stock up on Momo's magic credits so I can help you out! 🐾
              </Text>
            </View>

            <View style={styles.packagesContainer}>
              <PackageCard
                title="Little Pouch"
                reward="100 Credits"
                icon={<Text style={{ fontSize: 24 }}>🪙</Text>}
                price="$0.99"
                onPress={() => handlePurchase(100, '$0.99', 'credit')}
              />
              <PackageCard
                title="Momo's Backpack"
                reward="500 Credits"
                icon={<Text style={{ fontSize: 24 }}>💰</Text>}
                price="$3.99"
                recommended
                onPress={() => handlePurchase(500, '$3.99', 'credit')}
              />
              <PackageCard
                title="Treasure Chest"
                reward="1500 Credits"
                icon={<Text style={{ fontSize: 24 }}>💎</Text>}
                price="$9.99"
                onPress={() => handlePurchase(1500, '$9.99', 'credit')}
              />
            </View>
          </>
        )}

        {activeTab === 'hearts' && (
          <>
            <View style={[styles.headerBox, { backgroundColor: '#FEE2E2' }]}>
              <Image source={require("../assets/animations/hearts_momo.png")} style={{ width: 100, height: 100, marginBottom: 12 }} resizeMode="contain" />
              <Text style={[styles.headerTitle, { color: '#991B1B' }]}>Momo's Life Savers! ❤️</Text>
              <Text style={[styles.headerDesc, { color: '#991B1B' }]}>
                Ran out of lives? Don't worry! Momo has some extra hearts right here so you can keep studying! 🐕
              </Text>
            </View>

            <View style={styles.packagesContainer}>
              <PackageCard
                title="Single Heart"
                reward="1 Extra Life"
                icon={<Text style={{ fontSize: 24 }}>❤️</Text>}
                price="$0.99"
                onPress={() => handlePurchase(1, '$0.99', 'heart')}
              />
              <PackageCard
                title="High Five!"
                reward="5 Extra Lives"
                icon={<Text style={{ fontSize: 24 }}>💖</Text>}
                price="$2.99"
                recommended
                onPress={() => handlePurchase(5, '$2.99', 'heart')}
              />
              <PackageCard
                title="Full Bowl"
                reward="15 Extra Lives"
                icon={<Text style={{ fontSize: 24 }}>💝</Text>}
                price="$4.99"
                onPress={() => handlePurchase(15, '$4.99', 'heart')}
              />
            </View>
          </>
        )}

        {activeTab === 'trade' && (
          <>
            <View style={[styles.headerBox, { backgroundColor: '#FFFBEB' }]}>
              <Image source={require("../assets/animations/xp_momo.png")} style={{ width: 100, height: 100, marginBottom: 12 }} resizeMode="contain" />
              <Text style={[styles.headerTitle, { color: '#92400E' }]}>XP Trading Post! 🌟</Text>
              <Text style={styles.headerDesc}>
                You've been studying so hard! Trade your shiny XP stars here for extra credits or lives! Momo is so proud of you! 🎓
              </Text>
            </View>

            <View style={styles.packagesContainer}>
              <ExchangeCard
                title="A Quick Hint"
                reward="50 Credits"
                icon={<Text style={{ fontSize: 24 }}>💡</Text>}
                xpCost={500}
                onPress={() => handleExchange(500, 50, 'credit')}
              />
              <ExchangeCard
                title="Momo's Special"
                reward="150 Credits"
                icon={<Text style={{ fontSize: 24 }}>✨</Text>}
                xpCost={1200}
                recommended
                onPress={() => handleExchange(1200, 150, 'credit')}
              />
              <ExchangeCard
                title="Life Saver"
                reward="1 Extra Life"
                icon={<Text style={{ fontSize: 24 }}>❤️</Text>}
                xpCost={800}
                onPress={() => handleExchange(800, 1, 'heart')}
              />
              <ExchangeCard
                title="Five Lives Pack"
                reward="5 Extra Lives"
                icon={<Text style={{ fontSize: 24 }}>💖</Text>}
                xpCost={3500}
                onPress={() => handleExchange(3500, 5, 'heart')}
              />
            </View>
          </>
        )}
      </SmoothScrollView>

      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Image 
              source={require('../assets/animations/cheer_momo.png')} 
              style={{ width: 140, height: 140, marginBottom: 16 }} 
              resizeMode="contain" 
            />
            <Text style={styles.modalTitle}>Yay! It worked! 🐾</Text>
            <Text style={styles.modalDesc}>
              Momo is so happy! You got {successAmount} {successType === 'credit' ? 'credits' : 'extra lives'}! Now let's go crush those quizzes!
            </Text>
            <TouchableOpacity 
              style={styles.modalPurchaseBtn}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalPurchaseText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNotEnoughXpModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Image 
              source={require('../assets/animations/no_credits_momo.png')} 
              style={{ width: 140, height: 140, marginBottom: 16 }} 
              resizeMode="contain" 
            />
            <Text style={styles.modalTitle}>Not enough shiny XP! 🥺</Text>
            <Text style={styles.modalDesc}>
              Momo checked your stash, and you need {requiredXp} XP for this trade. You currently have {xp}. Keep taking quizzes to earn more stars!
            </Text>
            <TouchableOpacity 
              style={[styles.modalPurchaseBtn, { backgroundColor: '#D97706' }]}
              onPress={() => setShowNotEnoughXpModal(false)}
            >
              <Text style={styles.modalPurchaseText}>Got it, Momo!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPurchaseModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Image 
              source={require('../assets/animations/wealth_momo.png')} 
              style={{ width: 140, height: 140, marginBottom: 16 }} 
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
              >
                <Text style={styles.modalCancelText}>Nope</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalPurchaseBtnSecondary}
                onPress={confirmPurchase}
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

function PackageCard({ title, reward, price, recommended = false, icon, onPress }: any) {
  return (
    <PlatformPressable style={[styles.card, recommended && styles.cardRecommended]} onPress={onPress}>
      {recommended && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedText}>MOMO'S FAVORITE</Text>
        </View>
      )}
      <View style={styles.cardLeft}>
        <View style={styles.iconCircle}>
          {icon}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardCredits}>{reward}</Text>
        </View>
      </View>
      <View style={styles.cardPriceBox}>
        <Text style={styles.cardPrice}>{price}</Text>
      </View>
    </PlatformPressable>
  );
}

function ExchangeCard({ title, reward, xpCost, recommended = false, icon, onPress }: any) {
  return (
    <PlatformPressable style={[styles.card, recommended && { borderColor: '#D97706', borderWidth: 2 }]} onPress={onPress}>
      {recommended && (
        <View style={[styles.recommendedBadge, { backgroundColor: '#D97706' }]}>
          <Text style={styles.recommendedText}>MOMO'S CHOICE</Text>
        </View>
      )}
      <View style={styles.cardLeft}>
        <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
          {icon}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardCredits}>{reward}</Text>
        </View>
      </View>
      <View style={[styles.cardPriceBox, { backgroundColor: '#FEF3C7', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
        <Text style={[styles.cardPrice, { color: '#B45309', fontSize: 15 }]}>{xpCost}</Text>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#D97706' }}>XP</Text>
      </View>
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
      android: { elevation: 1 },
    }),
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  container: { padding: 20 },
  headerBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerDesc: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  packagesContainer: {
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  cardRecommended: {
    borderColor: '#4F46E5',
    borderWidth: 2,
  },
  recommendedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  recommendedText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  cardCredits: {
    fontSize: 14,
    color: '#64748B',
  },
  cardPriceBox: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalOverlay: {
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: 'white', 
    padding: 24, 
    borderRadius: 24, 
    alignItems: 'center', 
    width: '80%'
  },
  modalTitle: {
    fontSize: 20, 
    fontWeight: '800', 
    color: '#1E293B', 
    marginBottom: 8, 
    textAlign: 'center'
  },
  modalDesc: {
    fontSize: 16, 
    color: '#64748B', 
    textAlign: 'center', 
    marginBottom: 24
  },
  modalPurchaseBtn: {
    backgroundColor: '#4F46E5', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 12, 
    width: '100%'
  },
  modalPurchaseBtnSecondary: {
    flex: 1, 
    backgroundColor: '#4F46E5', 
    paddingVertical: 12, 
    borderRadius: 12
  },
  modalPurchaseText: {
    color: 'white', 
    fontWeight: 'bold', 
    textAlign: 'center', 
    fontSize: 16
  },
  modalActionsRow: {
    flexDirection: 'row', 
    gap: 12, 
    width: '100%'
  },
  modalCancelBtn: {
    flex: 1, 
    backgroundColor: '#F1F5F9', 
    paddingVertical: 12, 
    borderRadius: 12
  },
  modalCancelText: {
    color: '#475569', 
    fontWeight: 'bold', 
    textAlign: 'center', 
    fontSize: 16
  }
});
