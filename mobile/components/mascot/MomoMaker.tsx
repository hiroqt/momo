import React, { useEffect, useRef } from 'react';
import { mascotColors, typography } from '@/constants/theme';
import { StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Rect, G, Ellipse, Text as SvgText } from 'react-native-svg';

interface MomoMakerProps {
  size?: number;
}

/**
 * High-fidelity Vector SVG & Animation of Momo in "Maker / Chef / Crafting" mode.
 * Momo is busily cooking up study cards, questions, and high-yield notes.
 * Features:
 * - Animated stirring/crafting whisk/pencil
 * - Floating study item badges: [?], [A], [✓]
 * - Twinkling magical craft sparkles & steam puffs
 * - Playful bouncy ear wiggles & breathing
 */
export const MomoMaker: React.FC<MomoMakerProps> = ({ size = 130 }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const stirAnim = useRef(new Animated.Value(0)).current;
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;
  const card3Anim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // 1. Gentle body bounce & float
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Playful stirring / crafting arm wobble
    const stirLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(stirAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(stirAnim, {
          toValue: -1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Card 1 [?] floating up
    const card1Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(card1Anim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(card1Anim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 4. Card 2 [✓] floating up (offset)
    const card2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(card2Anim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(card2Anim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 5. Card 3 [A] floating up
    const card3Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(card3Anim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(card3Anim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 6. Sparkles pulsing
    const sparkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0.3,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    stirLoop.start();
    card1Loop.start();
    card2Loop.start();
    card3Loop.start();
    sparkleLoop.start();

    return () => {
      floatLoop.stop();
      stirLoop.stop();
      card1Loop.stop();
      card2Loop.stop();
      card3Loop.stop();
      sparkleLoop.stop();
    };
  }, [floatAnim, stirAnim, card1Anim, card2Anim, card3Anim, sparkleAnim]);

  const stirRotate = stirAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-12deg', '12deg'],
  });

  const card1TranslateY = card1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const card2TranslateY = card2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  const card3TranslateY = card3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [{ translateY: floatAnim }],
        },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 300 300">
        {/* Glow Halo behind Momo's craft station */}
        <Circle cx="150" cy="165" r="100" fill={mascotColors.aura} opacity="0.65" />
        <Circle cx="150" cy="165" r="75" fill={mascotColors.auraStrong} opacity="0.4" />

        {/* Twinkling Magical Recipe Sparkles */}
        <Circle cx="48" cy="70" r="5" fill={mascotColors.goldLight} opacity="0.85" />
        <Circle cx="64" cy="52" r="3.5" fill={mascotColors.goldLight} opacity="0.9" />
        <Circle cx="240" cy="65" r="5.5" fill={mascotColors.tear} opacity="0.85" />
        <Circle cx="260" cy="90" r="3.5" fill={mascotColors.brandLight} opacity="0.8" />
        <Circle cx="50" cy="180" r="4.5" fill={mascotColors.pink} opacity="0.8" />
        <Circle cx="245" cy="190" r="4" fill={mascotColors.green} opacity="0.85" />

        {/* Floating Item 1: Question Card [ ? ] */}
        <G transform="translate(35, 95)">
          <Rect x="0" y="0" width="34" height="26" rx="6" fill={mascotColors.brand} />
          <Rect x="2" y="2" width="30" height="22" rx="4" fill={mascotColors.brandLight} />
          <SvgText
            x="17"
            y="17"
            fill={mascotColors.white}
            fontSize={typography.fontSize[14]}
            fontFamily={typography.fontFamily.bold}
            textAnchor="middle"
          >
            ?
          </SvgText>
        </G>

        {/* Floating Item 2: Verified Correct Answer Card [ ✓ ] */}
        <G transform="translate(230, 115)">
          <Rect x="0" y="0" width="34" height="26" rx="6" fill={mascotColors.green} />
          <Rect x="2" y="2" width="30" height="22" rx="4" fill={mascotColors.green} />
          <SvgText
            x="17"
            y="17"
            fill={mascotColors.white}
            fontSize={typography.fontSize[13]}
            fontFamily={typography.fontFamily.bold}
            textAnchor="middle"
          >
            ✓
          </SvgText>
        </G>

        {/* Floating Item 3: Option Badge [ A ] */}
        <G transform="translate(210, 42)">
          <Rect x="0" y="0" width="28" height="22" rx="5" fill={mascotColors.gold} />
          <Rect x="2" y="2" width="24" height="18" rx="3.5" fill={mascotColors.gold} />
          <SvgText
            x="14"
            y="15"
            fill={mascotColors.white}
            fontSize={typography.fontSize[11]}
            fontFamily={typography.fontFamily.bold}
            textAnchor="middle"
          >
            A
          </SvgText>
        </G>

        {/* Playful Swishy Tail Behind */}
        <Path
          d="M 105 235 C 60 250, 40 195, 62 172 C 72 162, 82 172, 72 182"
          fill="none"
          stroke={mascotColors.fur}
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* Left Ear */}
        <Circle cx="82" cy="138" r="28" fill={mascotColors.fur} />
        <Circle cx="84" cy="138" r="17" fill={mascotColors.peach} />

        {/* Right Ear */}
        <Circle cx="218" cy="138" r="28" fill={mascotColors.fur} />
        <Circle cx="216" cy="138" r="17" fill={mascotColors.peach} />

        {/* Body & Tummy */}
        <Circle cx="150" cy="216" r="46" fill={mascotColors.fur} />
        <Circle cx="150" cy="220" r="30" fill={mascotColors.peach} />

        {/* Chibi Round Head */}
        <Circle cx="150" cy="135" r="66" fill={mascotColors.fur} />

        {/* Peach Face Mask */}
        <Circle cx="124" cy="128" r="35" fill={mascotColors.face} />
        <Circle cx="176" cy="128" r="35" fill={mascotColors.face} />
        <Circle cx="150" cy="150" r="38" fill={mascotColors.face} />

        {/* Rosy Blush Cheeks */}
        <Circle cx="110" cy="154" r="12" fill={mascotColors.blush} opacity="0.8" />
        <Circle cx="190" cy="154" r="12" fill={mascotColors.blush} opacity="0.8" />

        {/* Button Nose */}
        <Circle cx="150" cy="144" r="5" fill={mascotColors.furDark} />

        {/* Joyful Making/Crafting Smile */}
        <Path
          d="M 142 160 Q 150 167 158 160"
          fill="none"
          stroke={mascotColors.furDark}
          strokeWidth="3.4"
          strokeLinecap="round"
        />

        {/* Focused & Happy Eyes (Looking forward and slightly down at his creations) */}
        <G>
          {/* Left Eye */}
          <Ellipse cx="124" cy="128" rx="15" ry="19" fill={mascotColors.eyes} />
          <Circle cx="121" cy="122" r="5.6" fill={mascotColors.white} />
          <Circle cx="127" cy="135" r="3" fill={mascotColors.white} />
          <Circle cx="117" cy="130" r="1.8" fill={mascotColors.tear} />

          {/* Right Eye */}
          <Ellipse cx="176" cy="128" rx="15" ry="19" fill={mascotColors.eyes} />
          <Circle cx="173" cy="122" r="5.6" fill={mascotColors.white} />
          <Circle cx="179" cy="135" r="3" fill={mascotColors.white} />
          <Circle cx="169" cy="130" r="1.8" fill={mascotColors.tear} />
        </G>

        {/* Chef / Creator Scholar Toque (Hat) */}
        <G transform="translate(112, 42)">
          {/* White Chef Puffs */}
          <Circle cx="26" cy="26" r="18" fill={mascotColors.white} />
          <Circle cx="44" cy="20" r="21" fill={mascotColors.white} />
          <Circle cx="62" cy="26" r="18" fill={mascotColors.white} />
          <Rect x="16" y="28" width="56" height="22" rx="4" fill={mascotColors.white} />
          {/* Indigo Hat Band */}
          <Rect x="14" y="44" width="60" height="10" rx="3" fill={mascotColors.brand} />
          {/* Golden Star/Badge on Hat */}
          <Circle cx="44" cy="49" r="3.2" fill={mascotColors.goldLight} />
        </G>

        {/* Maker Study Desk / Cauldron Bowl */}
        <G transform="translate(85, 204)">
          {/* Desk Base / Cauldron */}
          <Path
            d="M 15 28 C 15 56, 115 56, 115 28 C 115 16, 15 16, 15 28 Z"
            fill={mascotColors.brandDark}
          />
          {/* Inner Glowing Study Liquid / Knowledge Sparkle */}
          <Ellipse cx="65" cy="26" rx="46" ry="11" fill={mascotColors.brand} />
          <Ellipse cx="65" cy="26" rx="40" ry="8" fill={mascotColors.brandLight} opacity="0.8" />
          <Ellipse cx="65" cy="26" rx="28" ry="5" fill={mascotColors.aura} opacity="0.9" />

          {/* Steam / Knowledge Puffs */}
          <Circle cx="48" cy="12" r="5" fill={mascotColors.auraStrong} opacity="0.75" />
          <Circle cx="76" cy="8" r="6" fill={mascotColors.brandBorder} opacity="0.8" />
          <Circle cx="64" cy="-2" r="4" fill={mascotColors.aura} opacity="0.65" />
        </G>

        {/* Left Paw holding the bowl/desk */}
        <Circle cx="98" cy="226" r="10" fill={mascotColors.peach} stroke={mascotColors.fur} strokeWidth="2.5" />

        {/* Right Paw holding the Maker Stirring Whisk / Golden Stylus */}
        <G transform="translate(186, 195) rotate(-18)">
          {/* Whisk / Stylus Wand */}
          <Rect x="-3" y="-32" width="6" height="42" rx="3" fill={mascotColors.gold} />
          <Circle cx="0" cy="-34" r="6" fill={mascotColors.goldLight} />
          {/* Paw */}
          <Circle cx="0" cy="0" r="10" fill={mascotColors.peach} stroke={mascotColors.fur} strokeWidth="2.5" />
        </G>
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
