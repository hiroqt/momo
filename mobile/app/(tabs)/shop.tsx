import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { BitcoinShoppingIcon, ArrowLeft01Icon, Coins01Icon, GameController01Icon } from '@hugeicons/core-free-icons';
import { useCredits } from '../../context/CreditsContext';
import { PageHeader } from '../../components/common/PageHeader';
import { SmoothScrollView } from '../../components/common/SmoothScrollView';
import { PlatformPressable } from '../../components/common/PlatformPressable';

export default function ShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { credits, xp, addCredits, convertXPToCredits } = useCredits();
  const [activeTab, setActiveTab] = useState<'buy' | 'exchange'>('buy');

  const handlePurchase = (amount: number, price: string) => {
    Alert.alert(
      'Confirm Purchase',
      `Buy ${amount} credits for ${price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: () => {
            addCredits(amount);
            Alert.alert('Success', `You have successfully purchased ${amount} credits!`);
          },
        },
      ]
    );
  };

  const handleExchange = (xpCost: number, creditReward: number) => {
    if (xp < xpCost) {
      Alert.alert('Not enough XP', `You need ${xpCost} XP but you only have ${xp}. Keep taking quizzes!`);
      return;
    }
    
    Alert.alert(
      'Confirm Exchange',
      `Convert ${xpCost} XP into ${creditReward} credits?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exchange',
          onPress: () => {
            if (convertXPToCredits(xpCost, creditReward)) {
              Alert.alert('Success', `You exchanged ${xpCost} XP for ${creditReward} credits!`);
            } else {
              Alert.alert('Error', 'Something went wrong.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <PageHeader
        title="Shop"
        subtitle={`${credits} Credits | ${xp} XP`}
        showBack={true}
        onBack={() => router.back()}
      />
      
      <View style={styles.tabSwitcher}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'buy' && styles.tabButtonActive]}
          onPress={() => setActiveTab('buy')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'buy' && styles.tabButtonTextActive]}>Buy Credits</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'exchange' && styles.tabButtonActive]}
          onPress={() => setActiveTab('exchange')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'exchange' && styles.tabButtonTextActive]}>Exchange XP</Text>
        </TouchableOpacity>
      </View>

      <SmoothScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) + 88 }]}>
        {activeTab === 'buy' ? (
          <>
            <View style={styles.headerBox}>
              <HugeiconsIcon icon={BitcoinShoppingIcon} size={48} color="#4F46E5" />
              <Text style={styles.headerTitle}>Purchasing Credits</Text>
              <Text style={styles.headerDesc}>
                Get more credits to reveal answers and ace your quizzes!
              </Text>
            </View>

            <View style={styles.packagesContainer}>
              <PackageCard
                title="Starter Pack"
                credits={100}
                price="$0.99"
                onPress={() => handlePurchase(100, '$0.99')}
              />
              <PackageCard
                title="Student Pro"
                credits={500}
                price="$3.99"
                recommended
                onPress={() => handlePurchase(500, '$3.99')}
              />
              <PackageCard
                title="Exam Master"
                credits={1500}
                price="$9.99"
                onPress={() => handlePurchase(1500, '$9.99')}
              />
            </View>
          </>
        ) : (
          <>
            <View style={[styles.headerBox, { backgroundColor: '#FFFBEB' }]}>
              <HugeiconsIcon icon={GameController01Icon} size={48} color="#D97706" />
              <Text style={[styles.headerTitle, { color: '#92400E' }]}>Exchange XP</Text>
              <Text style={styles.headerDesc}>
                Convert your hard-earned Quiz XP into Reveal Credits!
              </Text>
            </View>

            <View style={styles.packagesContainer}>
              <ExchangeCard
                title="Quick Swap"
                credits={50}
                xpCost={500}
                onPress={() => handleExchange(500, 50)}
              />
              <ExchangeCard
                title="Smart Conversion"
                credits={150}
                xpCost={1200}
                recommended
                onPress={() => handleExchange(1200, 150)}
              />
              <ExchangeCard
                title="Bulk Exchange"
                credits={500}
                xpCost={3500}
                onPress={() => handleExchange(3500, 500)}
              />
            </View>
          </>
        )}
      </SmoothScrollView>
    </View>
  );
}

function PackageCard({ title, credits, price, recommended = false, onPress }: any) {
  return (
    <PlatformPressable style={[styles.card, recommended && styles.cardRecommended]} onPress={onPress}>
      {recommended && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedText}>BEST VALUE</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardCredits}>{credits} Credits</Text>
      </View>
      <View style={styles.cardPriceBox}>
        <Text style={styles.cardPrice}>{price}</Text>
      </View>
    </PlatformPressable>
  );
}

function ExchangeCard({ title, credits, xpCost, recommended = false, onPress }: any) {
  return (
    <PlatformPressable style={[styles.card, recommended && { borderColor: '#D97706', borderWidth: 2 }]} onPress={onPress}>
      {recommended && (
        <View style={[styles.recommendedBadge, { backgroundColor: '#D97706' }]}>
          <Text style={styles.recommendedText}>MOST POPULAR</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardCredits}>{credits} Credits</Text>
      </View>
      <View style={[styles.cardPriceBox, { backgroundColor: '#FEF3C7' }]}>
        <Text style={[styles.cardPrice, { color: '#B45309', fontSize: 14 }]}>{xpCost} XP</Text>
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
    fontSize: 14,
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
});
