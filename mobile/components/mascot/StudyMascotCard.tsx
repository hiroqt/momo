import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { SparklesIcon } from '@hugeicons/core-free-icons';
import Svg, { Circle, Path, Rect, G, Ellipse } from 'react-native-svg';
import {
  getDailyStudyQuote,
  getRandomStudyQuote,
  StudyQuote,
} from '../../lib/data/studyQuotes';

// Import the Lottie JSON mascot animation
const mascotAnimation = require('../../assets/animations/mascot_monkey.json');

/**
 * High-fidelity Vector SVG Chibi Monkey component with dynamic animations that
 * change based on the active study quote (Focus bounce for Lock In, Sassy wobble for Real Talk,
 * Ethereal float for Manifesting, Studious nod for Scholar Era, Neural pulse for Brain Gains, etc.).
 *
 * Momo's eyes are modeled directly after the delete & end confirmation modal:
 * large obsidian pupils with pure-white upper catchlight reflections, secondary sparkles,
 * bottom iris highlights, and zero eyebrows for a pure cute chibi look.
 */
interface DynamicChibiMomoProps {
  quote: StudyQuote;
  isBouncing: boolean;
}

function DynamicChibiMomo({ quote, isBouncing }: DynamicChibiMomoProps) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Dynamic animation parameters tuned to the quote's vibe and category
    let floatTarget = -5;
    let floatSpeed = 1400;
    let hasTilt = false;
    let hasSparkle = false;
    let hasBreath = false;

    switch (quote.category) {
      case 'lock_in':
        // Fast, determined focus rhythm
        floatTarget = -7;
        floatSpeed = 800;
        hasSparkle = true;
        break;

      case 'real_talk':
        // Sassy, playful head-tilt wobble & wagging rhythm
        floatTarget = -5;
        floatSpeed = 1200;
        hasTilt = true;
        break;

      case 'manifesting':
        // High ethereal float with glowing magical stars
        floatTarget = -9;
        floatSpeed = 1800;
        hasSparkle = true;
        break;

      case 'scholar_era':
        // Studious reading nod with rhythmic focus
        floatTarget = -4.5;
        floatSpeed = 1300;
        break;

      case 'brain_gains':
        // Deep rhythmic neural breathing
        floatTarget = -5;
        floatSpeed = 1400;
        hasBreath = true;
        break;

      case 'boss_energy':
        // Proud celebratory bounce
        floatTarget = -8;
        floatSpeed = 950;
        hasSparkle = true;
        break;

      case 'dopamine_check':
        // Calming, gentle, peaceful zen float
        floatTarget = -3.5;
        floatSpeed = 2200;
        break;

      default:
        floatTarget = -5;
        floatSpeed = 1400;
    }

    // 1. Floating loop
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: floatTarget,
          duration: floatSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: floatSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Head tilt wobble loop (active for Real Talk)
    let tiltLoop: Animated.CompositeAnimation | null = null;
    if (hasTilt) {
      tiltLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(tiltAnim, {
            toValue: 1,
            duration: 1050,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(tiltAnim, {
            toValue: -1,
            duration: 1050,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      tiltLoop.start();
    } else {
      Animated.timing(tiltAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }

    // 3. Magic Sparkles Pulse loop (active for Manifesting / Lock In / Boss Energy)
    let sparkleLoop: Animated.CompositeAnimation | null = null;
    if (hasSparkle) {
      sparkleLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnim, {
            toValue: 1,
            duration: 850,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(sparkleAnim, {
            toValue: 0.5,
            duration: 850,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      sparkleLoop.start();
    } else {
      Animated.timing(sparkleAnim, { toValue: 0.8, duration: 250, useNativeDriver: true }).start();
    }

    // 4. Breathing scale loop (active for Brain Gains)
    let breathLoop: Animated.CompositeAnimation | null = null;
    if (hasBreath) {
      breathLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, {
            toValue: 1.04,
            duration: 1300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breathAnim, {
            toValue: 0.98,
            duration: 1300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      breathLoop.start();
    } else {
      Animated.timing(breathAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }

    floatLoop.start();

    return () => {
      floatLoop.stop();
      tiltLoop?.stop();
      sparkleLoop?.stop();
      breathLoop?.stop();
    };
  }, [quote.id, quote.category]);

  const tiltRotate = tiltAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-5.5deg', '0deg', '5.5deg'],
  });

  return (
    <Animated.View
      style={[
        styles.svgContainer,
        {
          transform: [
            { translateY: floatAnim },
            { rotate: tiltRotate },
            { scale: breathAnim },
          ],
        },
      ]}
    >
      <Svg width={92} height={92} viewBox="16 38 268 224">
        {/* Magic Background Sparkles */}
        <Circle cx="35" cy="55" r="7" fill="#F59E0B" opacity={quote.category === 'manifesting' ? 0.95 : 0.8} />
        <Circle cx="265" cy="50" r="8" fill="#FBBF24" opacity={quote.category === 'manifesting' ? 0.95 : 0.8} />
        <Circle cx="25" cy="225" r="6" fill="#FCD34D" opacity={0.75} />
        <Circle cx="270" cy="220" r="7" fill="#F59E0B" opacity={0.85} />

        {/* Long Playful Curly Monkey Tail */}
        <Path
          d="M 115 225 C 70 245, 35 175, 75 145 C 95 130, 115 150, 95 175"
          fill="none"
          stroke="#8D5B4C"
          strokeWidth="13"
          strokeLinecap="round"
        />

        {/* Big Rounded Monkey Ears */}
        <Circle cx="66" cy="136" r="34" fill="#8D5B4C" />
        <Circle cx="69" cy="136" r="22" fill="#FED7AA" />
        <Circle cx="234" cy="136" r="34" fill="#8D5B4C" />
        <Circle cx="231" cy="136" r="22" fill="#FED7AA" />

        {/* Chibi Body & Peach Tummy */}
        <Circle cx="150" cy="222" r="46" fill="#8D5B4C" />
        <Circle cx="150" cy="226" r="30" fill="#FED7AA" />

        {/* Cute Monkey Hair Tufts on Top */}
        <Path d="M 144 76 Q 148 54 150 56 Q 152 54 156 76" fill="#8D5B4C" />
        <Circle cx="150" cy="62" r="7" fill="#8D5B4C" />

        {/* Chibi Round Head */}
        <Circle cx="150" cy="138" r="68" fill="#8D5B4C" />

        {/* Heart-Shaped Monkey Face Mask */}
        <Circle cx="122" cy="126" r="36" fill="#FEF3C7" />
        <Circle cx="178" cy="126" r="36" fill="#FEF3C7" />
        <Ellipse cx="150" cy="154" rx="46" ry="34" fill="#FEF3C7" />

        {/* Rosy Blush Cheeks & Cheek Accents (Reactive to quote) */}
        {quote.category === 'real_talk' ? (
          <G>
            <Ellipse cx="106" cy="152" rx="15" ry="9" fill="#FDA4AF" opacity={0.95} />
            <Ellipse cx="194" cy="152" rx="15" ry="9" fill="#FDA4AF" opacity={0.95} />
            <Path d="M 102 150 L 105 154 M 106 150 L 109 154" stroke="#FB7185" strokeWidth="1.8" strokeLinecap="round" />
            <Path d="M 191 150 L 194 154 M 195 150 L 198 154" stroke="#FB7185" strokeWidth="1.8" strokeLinecap="round" />
          </G>
        ) : quote.category === 'brain_gains' ? (
          <G>
            <Ellipse cx="106" cy="152" rx="15" ry="9" fill="#F43F5E" opacity={0.85} />
            <Ellipse cx="194" cy="152" rx="15" ry="9" fill="#F43F5E" opacity={0.85} />
            <Path d="M 101 150 L 104 154 M 106 150 L 109 154" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <Path d="M 191 150 L 194 154 M 196 150 L 199 154" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </G>
        ) : quote.category === 'manifesting' ? (
          <G>
            <Ellipse cx="106" cy="152" rx="15" ry="10" fill="#F472B6" opacity={0.8} />
            <Ellipse cx="194" cy="152" rx="15" ry="10" fill="#F472B6" opacity={0.8} />
            <Path d="M 92 144 L 94 139 L 96 144 L 101 146 L 96 148 L 94 153 L 92 148 L 87 146 Z" fill="#F59E0B" />
            <Path d="M 204 144 L 206 139 L 208 144 L 213 146 L 208 148 L 206 153 L 204 148 L 199 146 Z" fill="#F59E0B" />
          </G>
        ) : quote.category === 'dopamine_check' ? (
          <G>
            <Ellipse cx="106" cy="152" rx="14" ry="9" fill="#FBCFE8" opacity={0.85} />
            <Ellipse cx="194" cy="152" rx="14" ry="9" fill="#FBCFE8" opacity={0.85} />
          </G>
        ) : (
          <G>
            <Ellipse cx="106" cy="152" rx="14" ry="9" fill="#FDA4AF" opacity={0.85} />
            <Ellipse cx="194" cy="152" rx="14" ry="9" fill="#FDA4AF" opacity={0.85} />
          </G>
        )}

        {/* DISTINCTIVE MONKEY NOSTRILS (Two cute dark dots) */}
        <Circle cx="145" cy="146" r="3.2" fill="#451A03" />
        <Circle cx="155" cy="146" r="3.2" fill="#451A03" />

        {/* DYNAMIC MOUTH EXPRESSION (Changes with Quote) */}
        {quote.category === 'real_talk' ? (
          /* Sassy Anime :3 Cat Smirk */
          <Path
            d="M 134 157 Q 142 165 150 159 Q 158 165 166 157"
            fill="none"
            stroke="#451A03"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
        ) : quote.category === 'brain_gains' ? (
          /* Big Proud Toothy Open Grin */
          <G>
            <Path
              d="M 132 153 Q 150 178 168 153 Z"
              fill="#F43F5E"
              stroke="#451A03"
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            <Path
              d="M 136 154 Q 150 160 164 154"
              stroke="#FFFFFF"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
            />
            <Path d="M 141 168 Q 150 161 159 168" fill="#FDA4AF" />
          </G>
        ) : quote.category === 'boss_energy' ? (
          /* Confident Boss Smirk Tucked at Corner */
          <G>
            <Path
              d="M 137 159 Q 148 164 163 154"
              fill="none"
              stroke="#451A03"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            <Path
              d="M 163 154 L 166 151"
              fill="none"
              stroke="#451A03"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </G>
        ) : quote.category === 'lock_in' ? (
          /* Determined Resolute Smirk */
          <Path
            d="M 137 159 Q 150 167 163 159"
            fill="none"
            stroke="#451A03"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
        ) : quote.category === 'scholar_era' ? (
          /* Studious Knowing Little Smile */
          <Path
            d="M 138 158 Q 150 167 162 158"
            fill="none"
            stroke="#451A03"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        ) : quote.category === 'dopamine_check' ? (
          /* Calm Zen Gentle Smile */
          <Path
            d="M 139 157 Q 150 166 161 157"
            fill="none"
            stroke="#451A03"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        ) : (
          /* Cheerful Open Monkey Smile with Tongue (Default / Manifesting) */
          <G>
            <Path
              d="M 134 156 Q 150 174 166 156"
              fill="#F43F5E"
              stroke="#451A03"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <Path
              d="M 142 166 Q 150 160 158 166 Q 150 173 142 166"
              fill="#FDA4AF"
            />
          </G>
        )}

        {/* DYNAMIC EYES & ACCESSORIES (NO EYEBROWS, CHANGES WITH QUOTE) */}
        {quote.category === 'real_talk' ? (
          /* Sassy Wink: Left eye wide puppy eye, Right eye playful wink with star */
          <G>
            {/* Left Eye */}
            <Ellipse cx="124" cy="132" rx="16" ry="21" fill="#0F172A" />
            <Ellipse cx="124" cy="142" rx="10" ry="7" fill="#4338CA" opacity={0.35} />
            <Circle cx="120" cy="125" r="6.4" fill="#FFFFFF" />
            <Circle cx="128" cy="139" r="3.4" fill="#FFFFFF" />
            <Circle cx="118" cy="135" r="1.8" fill="#FFFFFF" opacity={0.9} />

            {/* Right Eye: Playful Wink */}
            <Path
              d="M 162 134 Q 176 146 190 134"
              fill="none"
              stroke="#0F172A"
              strokeWidth="4.8"
              strokeLinecap="round"
            />
            <Path
              d="M 189 133 L 196 128"
              fill="none"
              stroke="#0F172A"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            {/* Sassy Sparkle */}
            <Path
              d="M 198 120 L 200 114 L 202 120 L 208 122 L 202 124 L 200 130 L 198 124 L 192 122 Z"
              fill="#F59E0B"
            />
          </G>
        ) : quote.category === 'manifesting' ? (
          /* Manifesting: Radiant Golden Star Eyes */
          <G>
            {/* Left Eye */}
            <Ellipse cx="124" cy="132" rx="17" ry="22" fill="#0F172A" />
            <Path
              d="M 124 117 L 126.5 127 L 137 132 L 126.5 137 L 124 147 L 121.5 137 L 111 132 L 121.5 127 Z"
              fill="#FBBF24"
            />
            <Path
              d="M 124 125 L 125.5 130 L 130 132 L 125.5 134 L 124 139 L 122.5 134 L 118 132 L 122.5 130 Z"
              fill="#FFFFFF"
            />
            <Circle cx="118" cy="123" r="3.2" fill="#FFFFFF" />
            <Circle cx="130" cy="141" r="2.2" fill="#FFFFFF" />

            {/* Right Eye */}
            <Ellipse cx="176" cy="132" rx="17" ry="22" fill="#0F172A" />
            <Path
              d="M 176 117 L 178.5 127 L 189 132 L 178.5 137 L 176 147 L 173.5 137 L 163 132 L 173.5 127 Z"
              fill="#FBBF24"
            />
            <Path
              d="M 176 125 L 177.5 130 L 182 132 L 177.5 134 L 176 139 L 174.5 134 L 170 132 L 174.5 130 Z"
              fill="#FFFFFF"
            />
            <Circle cx="170" cy="123" r="3.2" fill="#FFFFFF" />
            <Circle cx="182" cy="141" r="2.2" fill="#FFFFFF" />
          </G>
        ) : quote.category === 'scholar_era' ? (
          /* Scholar Era: Modal Glistening Eyes + Stylish Round Scholar Spectacles */
          <G>
            {/* Left Eye */}
            <Ellipse cx="124" cy="132" rx="16" ry="21" fill="#0F172A" />
            <Ellipse cx="124" cy="142" rx="10" ry="7" fill="#4338CA" opacity={0.35} />
            <Circle cx="120" cy="125" r="6.4" fill="#FFFFFF" />
            <Circle cx="128" cy="139" r="3.4" fill="#FFFFFF" />
            <Circle cx="118" cy="135" r="1.8" fill="#FFFFFF" opacity={0.9} />

            {/* Right Eye */}
            <Ellipse cx="176" cy="132" rx="16" ry="21" fill="#0F172A" />
            <Ellipse cx="176" cy="142" rx="10" ry="7" fill="#4338CA" opacity={0.35} />
            <Circle cx="172" cy="125" r="6.4" fill="#FFFFFF" />
            <Circle cx="180" cy="139" r="3.4" fill="#FFFFFF" />
            <Circle cx="170" cy="135" r="1.8" fill="#FFFFFF" opacity={0.9} />

            {/* Cute Gold Scholar Spectacles */}
            <Circle cx="124" cy="132" r="23" fill="#FFFFFF" fillOpacity={0.12} stroke="#D97706" strokeWidth={3.2} />
            <Path d="M 112 119 L 122 114" stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" opacity={0.85} />
            <Circle cx="176" cy="132" r="23" fill="#FFFFFF" fillOpacity={0.12} stroke="#D97706" strokeWidth={3.2} />
            <Path d="M 164 119 L 174 114" stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" opacity={0.85} />
            <Path d="M 147 131 Q 150 126 153 131" fill="none" stroke="#D97706" strokeWidth={3.2} strokeLinecap="round" />
            <Path d="M 101 131 L 87 128" fill="none" stroke="#D97706" strokeWidth={2.6} strokeLinecap="round" />
            <Path d="M 199 131 L 213 128" fill="none" stroke="#D97706" strokeWidth={2.6} strokeLinecap="round" />
          </G>
        ) : quote.category === 'brain_gains' ? (
          /* Brain Gains: Ecstatic ^ ^ Happy Closed Crescent Curves */
          <G>
            <Path
              d="M 108 136 Q 124 118 140 136"
              fill="none"
              stroke="#0F172A"
              strokeWidth={4.8}
              strokeLinecap="round"
            />
            <Path
              d="M 115 142 Q 124 146 133 142"
              fill="none"
              stroke="#FDA4AF"
              strokeWidth={2.6}
              strokeLinecap="round"
            />
            <Path
              d="M 160 136 Q 176 118 192 136"
              fill="none"
              stroke="#0F172A"
              strokeWidth={4.8}
              strokeLinecap="round"
            />
            <Path
              d="M 167 142 Q 176 146 185 142"
              fill="none"
              stroke="#FDA4AF"
              strokeWidth={2.6}
              strokeLinecap="round"
            />
            {/* Spark of Genius */}
            <Path
              d="M 150 48 L 152 42 L 154 48 L 160 50 L 154 52 L 152 58 L 150 52 L 144 50 Z"
              fill="#FBBF24"
            />
          </G>
        ) : quote.category === 'boss_energy' ? (
          /* Boss Energy: Stylish Boss Shades with Lens Streaks & Glint */
          <G>
            {/* Left Lens */}
            <Path
              d="M 104 122 Q 124 116 145 122 L 143 145 Q 124 151 107 144 Z"
              fill="#0F172A"
              stroke="#312E81"
              strokeWidth={2.5}
            />
            {/* Right Lens */}
            <Path
              d="M 155 122 Q 176 116 196 122 L 193 144 Q 176 151 157 145 Z"
              fill="#0F172A"
              stroke="#312E81"
              strokeWidth={2.5}
            />
            {/* Bridge */}
            <Path
              d="M 144 126 Q 150 122 156 126"
              stroke="#0F172A"
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
            />
            {/* Lens Reflection Streaks */}
            <Path
              d="M 112 125 L 126 139"
              stroke="#FFFFFF"
              strokeWidth={3.2}
              strokeLinecap="round"
              opacity={0.9}
            />
            <Path
              d="M 121 125 L 133 137"
              stroke="#FFFFFF"
              strokeWidth={1.8}
              strokeLinecap="round"
              opacity={0.6}
            />
            <Path
              d="M 163 125 L 177 139"
              stroke="#FFFFFF"
              strokeWidth={3.2}
              strokeLinecap="round"
              opacity={0.9}
            />
            <Path
              d="M 172 125 L 184 137"
              stroke="#FFFFFF"
              strokeWidth={1.8}
              strokeLinecap="round"
              opacity={0.6}
            />
            {/* Star Glint */}
            <Path
              d="M 197 122 L 199 116 L 201 122 L 207 124 L 201 126 L 199 132 L 197 126 L 191 124 Z"
              fill="#FBBF24"
            />
          </G>
        ) : quote.category === 'dopamine_check' ? (
          /* Dopamine Check: Peaceful Serene u u Arches */
          <G>
            <Path
              d="M 110 128 Q 124 143 138 128"
              fill="none"
              stroke="#0F172A"
              strokeWidth={4.4}
              strokeLinecap="round"
            />
            <Path
              d="M 162 128 Q 176 143 190 128"
              fill="none"
              stroke="#0F172A"
              strokeWidth={4.4}
              strokeLinecap="round"
            />
            <Circle cx="98" cy="136" r={3} fill="#A7F3D0" opacity={0.75} />
            <Circle cx="202" cy="136" r={3} fill="#A7F3D0" opacity={0.75} />
          </G>
        ) : quote.category === 'lock_in' ? (
          /* Lock In: Laser Focus Glistening Eyes with Cyan Spark & Effort Sweat Drop */
          <G>
            {/* Left Eye */}
            <Ellipse cx="124" cy="132" rx="15" ry="19" fill="#0F172A" />
            <Ellipse cx="124" cy="141" rx="9" ry="6" fill="#4338CA" opacity={0.45} />
            <Circle cx="121" cy="125" r={5.6} fill="#FFFFFF" />
            <Circle cx="128" cy="138" r={3.0} fill="#FFFFFF" />
            <Circle cx="118" cy="132" r={1.8} fill="#38BDF8" />

            {/* Right Eye */}
            <Ellipse cx="176" cy="132" rx="15" ry="19" fill="#0F172A" />
            <Ellipse cx="176" cy="141" rx="9" ry="6" fill="#4338CA" opacity={0.45} />
            <Circle cx="173" cy="125" r={5.6} fill="#FFFFFF" />
            <Circle cx="180" cy="138" r={3.0} fill="#FFFFFF" />
            <Circle cx="170" cy="132" r={1.8} fill="#38BDF8" />

            {/* Focus Effort Sweat Drop on Temple */}
            <Path
              d="M 194 116 C 197 110, 203 118, 199 124 C 196 128, 191 126, 191 122 C 191 119, 193 117, 194 116 Z"
              fill="#38BDF8"
              opacity={0.9}
            />
            <Circle cx="196" cy="119" r={1.2} fill="#FFFFFF" />
          </G>
        ) : (
          /* Default: Full Modal Glistening Eyes (Puppy catchlights, zero eyebrows) */
          <G>
            {/* Left Eye */}
            <Ellipse cx="124" cy="132" rx="16" ry="21" fill="#0F172A" />
            <Ellipse cx="124" cy="142" rx="10" ry="7" fill="#4338CA" opacity={0.35} />
            <Circle cx="120" cy="125" r={6.4} fill="#FFFFFF" />
            <Circle cx="128" cy="139" r={3.4} fill="#FFFFFF" />
            <Circle cx="118" cy="135" r={1.8} fill="#FFFFFF" opacity={0.9} />

            {/* Right Eye */}
            <Ellipse cx="176" cy="132" rx="16" ry="21" fill="#0F172A" />
            <Ellipse cx="176" cy="142" rx="10" ry="7" fill="#4338CA" opacity={0.35} />
            <Circle cx="172" cy="125" r={6.4} fill="#FFFFFF" />
            <Circle cx="180" cy="139" r={3.4} fill="#FFFFFF" />
            <Circle cx="170" cy="135" r={1.8} fill="#FFFFFF" opacity={0.9} />
          </G>
        )}

        {/* Study Book with Yellow Banana Bookmark */}
        <Rect x="118" y="212" width="64" height="36" rx="6" fill="#4F46E5" />
        <Rect x="122" y="214" width="26" height="32" rx="3" fill="#FFFFFF" />
        <Rect x="152" y="214" width="26" height="32" rx="3" fill="#FFFFFF" />
        {/* Banana Bookmark poking out */}
        <Path d="M 152 205 Q 160 207 162 215 Q 156 213 150 209 Z" fill="#FBBF24" />
        {/* Paws on book */}
        <Circle cx="120" cy="226" r="10" fill="#FED7AA" />
        <Circle cx="180" cy="226" r="10" fill="#FED7AA" />
        <Circle cx="150" cy="228" r="4.5" fill="#F59E0B" />

        {/* Scholar Mortarboard Cap */}
        <G transform="rotate(-5 150 78)">
          <Rect x="128" y="76" width="44" height="14" rx="4" fill="#312E81" />
          {/* Diamond top */}
          <Path d="M 150 56 L 196 74 L 150 92 L 104 74 Z" fill="#1E1B4B" />
          <Circle cx="150" cy="74" r="5" fill="#F59E0B" />
          {/* Gold Tassel */}
          <Path
            d="M 150 74 Q 170 82 178 92"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <Circle cx="178" cy="94" r="4" fill="#F59E0B" />
          <Rect x="176" y="96" width="5" height="10" rx="2" fill="#F59E0B" />
        </G>
      </Svg>
    </Animated.View>
  );
}

interface StudyMascotCardProps {
  onPressAction?: () => void;
}

export function StudyMascotCard({ onPressAction }: StudyMascotCardProps) {
  const [currentQuote, setCurrentQuote] = useState<StudyQuote>(() =>
    getDailyStudyQuote()
  );
  const [isBouncing, setIsBouncing] = useState(false);

  // Animation values for interactive tap feedback & quote transition
  const mascotScale = useRef(new Animated.Value(1)).current;
  const mascotRotate = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(1)).current;
  const bubbleTranslateY = useRef(new Animated.Value(0)).current;

  const handleNextQuote = () => {
    // Spring bounce and playful wiggle on mascot
    setIsBouncing(true);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(mascotScale, {
          toValue: 0.88,
          duration: 80,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(mascotScale, {
          toValue: 1.12,
          friction: 4,
          tension: 180,
          useNativeDriver: true,
        }),
        Animated.spring(mascotScale, {
          toValue: 1,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(mascotRotate, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(mascotRotate, {
          toValue: -1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(mascotRotate, {
          toValue: 0.5,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(mascotRotate, {
          toValue: 0,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setIsBouncing(false);
    });

    // Smooth transition of the quote text
    Animated.sequence([
      Animated.parallel([
        Animated.timing(bubbleOpacity, {
          toValue: 0.08,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(bubbleTranslateY, {
          toValue: -3,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      const nextQuote = getRandomStudyQuote(currentQuote.id);
      setCurrentQuote(nextQuote);

      Animated.parallel([
        Animated.spring(bubbleOpacity, {
          toValue: 1,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(bubbleTranslateY, {
          toValue: 0,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const isFunny = currentQuote.vibe === 'funny';

  const rotateDeg = mascotRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-5deg', '0deg', '5deg'],
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handleNextQuote}
      activeOpacity={0.92}
      accessibilityLabel="Momo study quotes card, tap for a new vibe"
    >
      {/* Top Header Row: Mascot, Names, Gen Z Badges */}
      <View style={styles.topRow}>
        <View style={styles.mascotInfo}>
          {/* Enhanced Mascot Avatar Box */}
          <Animated.View
            style={[
              styles.mascotBox,
              {
                transform: [{ scale: mascotScale }, { rotate: rotateDeg }],
              },
            ]}
          >
            <View style={styles.mascotAura} />
            <DynamicChibiMomo quote={currentQuote} isBouncing={isBouncing} />
          </Animated.View>

          {/* Title and Category Tag Column */}
          <View style={styles.headerTextCol}>
            <View style={styles.nameRow}>
              <Text style={styles.mascotName}>Momo 🐵</Text>
              <View style={styles.buddyBadge}>
                <HugeiconsIcon
                  icon={SparklesIcon}
                  size={11}
                  color="#B45309"
                  strokeWidth={2.4}
                />
                <Text style={styles.buddyBadgeText}>STUDY BUDDY</Text>
              </View>
            </View>

            {/* Subtitle / Status Line */}
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.statusText}>AI Companion • Ready</Text>
            </View>

            {/* Gen Z Category Tags Row */}
            <View style={styles.tagRow}>
              <View style={[styles.categoryChip, isFunny ? styles.funnyChip : styles.seriousChip]}>
                <Text style={styles.categoryEmoji}>{currentQuote.emoji}</Text>
                <Text style={[styles.categoryText, isFunny ? styles.funnyText : styles.seriousText]}>
                  {currentQuote.categoryLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Enhanced Quote Speech Container (Full Width, Zero Overlapping) */}
      <View style={styles.speechContainerWrapper}>
        <View style={styles.speechArrow} />
        <Animated.View
          style={[
            styles.speechContainer,
            {
              opacity: bubbleOpacity,
              transform: [{ translateY: bubbleTranslateY }],
            },
          ]}
        >
          <Text style={styles.quoteText}>
            “{currentQuote.quote}”
          </Text>
          <View style={styles.quoteDivider} />
          <View style={styles.quoteFooter}>
            <View style={styles.authorBadge}>
              <Text style={styles.authorSparkle}>✦</Text>
              <Text style={styles.quoteAuthor}>
                {currentQuote.author}
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    ...Platform.select({
      ios: {
        shadowColor: '#4338CA',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mascotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  mascotBox: {
    width: 98,
    height: 98,
    borderRadius: 26,
    backgroundColor: '#F5F3FF',
    borderWidth: 2,
    borderColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  mascotAura: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EDE9FE',
    opacity: 0.85,
  },
  lottieView: {
    width: 94,
    height: 94,
  },
  svgContainer: {
    width: 94,
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  mascotName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  buddyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3.5,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  buddyBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  onlineDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: -0.1,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
  },
  funnyChip: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  seriousChip: {
    backgroundColor: '#EEF2FF',
    borderColor: '#E0E7FF',
  },
  categoryEmoji: {
    fontSize: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  funnyText: {
    color: '#DC2626',
  },
  seriousText: {
    color: '#4338CA',
  },
  speechContainerWrapper: {
    position: 'relative',
    marginTop: 2,
  },
  speechArrow: {
    position: 'absolute',
    top: -5,
    left: 43.5,
    width: 11,
    height: 11,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#E2E8F0',
    transform: [{ rotate: '45deg' }],
    zIndex: 2,
  },
  speechContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 3.5,
    borderLeftColor: '#6366F1',
  },
  quoteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 21.5,
    letterSpacing: -0.15,
  },
  quoteDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 11,
    marginBottom: 8,
    opacity: 0.8,
  },
  quoteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorSparkle: {
    fontSize: 9.5,
    color: '#6366F1',
  },
  quoteAuthor: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.1,
  },
});
