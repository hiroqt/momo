import React, { forwardRef } from 'react';
import { View, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { AcademicWeaponData, MomoMood } from '@/utils/academicWeapon';

const MOMO_MOOD_MAP: Record<MomoMood, ImageSourcePropType> = {
  cool: require('@/assets/animations/cool_momo.png'),
  cheer: require('@/assets/animations/cheer_momo.png'),
  xp: require('@/assets/animations/xp_momo.png'),
  focus: require('@/assets/animations/focus_momo.png'),
};

export interface AcademicWeaponStoryCardProps {
  data: AcademicWeaponData;
  scale?: number;
}

export const AcademicWeaponStoryCard = forwardRef<View, AcademicWeaponStoryCardProps>(
  ({ data, scale = 1 }, ref) => {
    const mascotSource = MOMO_MOOD_MAP[data.momoMood] || MOMO_MOOD_MAP.cool;

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[
          styles.cardContainer,
          { transform: scale !== 1 ? [{ scale }] : undefined },
        ]}
      >
        {/* Ambient Glow Gradient Layers */}
        <View style={[styles.ambientGlowTop, { backgroundColor: data.paletteAccent }]} />
        <View style={[styles.ambientGlowBottom, { backgroundColor: data.paletteAccent }]} />

        {/* Top Header Editorial Bar */}
        <View style={styles.headerRow}>
          <View style={[styles.badgeTag, { borderColor: data.paletteAccent }]}>
            <Text style={[styles.badgeTagText, { color: data.paletteAccent }]}>
              {data.userName ? `${data.userName.toUpperCase()} STREAK` : 'STUDENT STREAK'}
            </Text>
          </View>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>

        {/* Slanted Persona Headline */}
        <View style={styles.headlineWrapper}>
          <Text style={styles.headlineText} numberOfLines={2}>
            {data.headline}
          </Text>
          <Text style={styles.subtitleText} numberOfLines={1}>
            {data.subtitle}
          </Text>
        </View>

        {/* Mascot & Stats Stage - Anchored with 0 Gap */}
        <View style={styles.mascotAndStatsContainer}>
          {/* Mascot Center Stage Spotlight */}
          <View style={styles.mascotSpotlight}>
            <View style={[styles.mascotBackdropCircle, { borderColor: data.paletteAccent }]} />
            <Image source={mascotSource} style={styles.mascotImage} resizeMode="contain" />
          </View>

          {/* Prominent High-Impact Stats Bar */}
          <View style={styles.statsBar}>
            {data.streak !== undefined ? (
              /* Streak Mode: Just the Days Streak (no topic / daily consistency) */
              <View style={[styles.statBox, { flex: 1 }]}>
                <View style={styles.statValueContainer}>
                  <View style={styles.statRow}>
                    <Text style={styles.fireEmoji}>🔥</Text>
                    <Text style={[styles.statValue, { color: '#EF4444', fontSize: 26 }]}>{data.streak}</Text>
                  </View>
                </View>
                <Text style={styles.statLabel}>
                  {data.streak === 1 ? 'DAY STREAK' : 'DAYS STREAK'}
                </Text>
              </View>
            ) : (
              /* Quiz / Flashcard Mode: Accuracy/Cards + Topic (+ XP) */
              <>
                {data.accuracy !== undefined ? (
                  <View style={[styles.statBox, { flex: data.xpEarned ? 1 : 1 }]}>
                    <View style={styles.statValueContainer}>
                      <Text style={[styles.statValue, { color: data.paletteAccent }]}>
                        {data.accuracy}%
                      </Text>
                    </View>
                    <Text style={styles.statLabel}>ACCURACY</Text>
                  </View>
                ) : (
                  <View style={[styles.statBox, { flex: data.xpEarned ? 1 : 1 }]}>
                    <View style={styles.statValueContainer}>
                      <Text style={[styles.statValue, { color: data.paletteAccent }]}>
                        {data.cardsCount || 0}
                      </Text>
                    </View>
                    <Text style={styles.statLabel}>CARDS</Text>
                  </View>
                )}

                <View style={styles.statDivider} />

                <View style={[styles.statBox, { flex: data.xpEarned ? 1.25 : 1 }]}>
                  <View style={styles.statValueContainer}>
                    <Text style={styles.statTopicValue} numberOfLines={1}>
                      {data.subject}
                    </Text>
                  </View>
                  <Text style={styles.statLabel}>TOPIC</Text>
                </View>

                {data.xpEarned ? (
                  <>
                    <View style={styles.statDivider} />
                    <View style={[styles.statBox, { flex: 1 }]}>
                      <View style={styles.statValueContainer}>
                        <Text style={[styles.statXpValue, { color: '#F59E0B' }]}>
                          +{data.xpEarned}
                        </Text>
                      </View>
                      <Text style={styles.statLabel}>XP EARNED</Text>
                    </View>
                  </>
                ) : null}
              </>
            )}
          </View>
        </View>

        {/* Instagram Interactive Challenge Sticker Box */}
        <View style={styles.stickerBox}>
          <View style={styles.stickerHeader}>
            <View style={styles.stickerDot} />
            <Text style={styles.stickerHeaderLabel}>CHALLENGE PROMPT</Text>
          </View>
          <Text style={styles.stickerChallengeText}>
            "{data.challengeText}"
          </Text>
          <View style={styles.stickerFooter}>
            <Text style={styles.stickerFooterHint}>Reply on Story to compete 🔥</Text>
          </View>
        </View>

        {/* Branded Footer Watermark */}
        <View style={styles.footerRow}>
          <Image
            source={require('@/assets/momo_logo.png')}
            style={styles.footerLogo}
            resizeMode="contain"
          />
          <View style={styles.footerTextBox}>
            <Text style={styles.footerBrand}>Momo • AI Study Platform</Text>
            <Text style={styles.footerUrl}>momo.study</Text>
          </View>
        </View>
      </View>
    );
  }
);

AcademicWeaponStoryCard.displayName = 'AcademicWeaponStoryCard';

const styles = StyleSheet.create({
  cardContainer: {
    width: 360,
    height: 640,
    backgroundColor: '#09071A',
    borderRadius: 28,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'space-between',
    alignSelf: 'center',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.22,
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  badgeTag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  headerDate: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  headlineWrapper: {
    marginTop: 8,
    zIndex: 2,
  },
  headlineText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  subtitleText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '600',
    marginTop: 4,
  },
  mascotAndStatsContainer: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
    zIndex: 3,
  },
  mascotSpotlight: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    zIndex: 1,
    elevation: 1,
    marginBottom: 0,
  },
  mascotBackdropCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    opacity: 0.3,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    top: 6,
  },
  mascotImage: {
    width: 155,
    height: 155,
  },
  statsBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 0,
    zIndex: 2,
    elevation: 2,
  },
  statBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  statValueContainer: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  fireEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  statTopicValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 17,
  },
  statXpValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.0,
    marginTop: 4,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignSelf: 'center',
  },
  stickerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 2,
  },
  stickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  stickerHeaderLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  stickerChallengeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 19,
  },
  stickerFooter: {
    marginTop: 4,
  },
  stickerFooterHint: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 2,
  },
  footerLogo: {
    width: 24,
    height: 24,
  },
  footerTextBox: {
    alignItems: 'flex-end',
  },
  footerBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  footerUrl: {
    fontSize: 9,
    color: '#94A3B8',
  },
});
