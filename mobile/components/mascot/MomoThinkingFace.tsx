import React, { useEffect, useRef } from 'react';
import { mascotColors } from '@/constants/theme';
import { StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Rect, G, Ellipse } from 'react-native-svg';

interface MomoThinkingFaceProps {
  size?: number;
}

/**
 * High-fidelity Vector SVG of Momo in a cute "thinking / guessing" pose.
 * Features Momo with his paw on his chin, head slightly tilted,
 * inquisitive gaze, and animated floating thought bubbles with a glowing question mark.
 */
export const MomoThinkingFace: React.FC<MomoThinkingFaceProps> = ({ size = 96 }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const thoughtAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Gentle thinking bob & float
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Thought bubbles gentle pulse & drift
    const thoughtLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(thoughtAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(thoughtAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    thoughtLoop.start();

    return () => {
      floatLoop.stop();
      thoughtLoop.stop();
    };
  }, [floatAnim, thoughtAnim]);

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
        {/* Playful Thinking Sparkles */}
        <Circle cx="45" cy="65" r="5" fill={mascotColors.goldLight} opacity="0.8" />
        <Circle cx="60" cy="85" r="3" fill={mascotColors.goldLight} opacity="0.7" />
        <Circle cx="50" cy="205" r="4.5" fill={mascotColors.brandLight} opacity="0.75" />

        {/* Tail Behind */}
        <Path
          d="M 110 230 C 65 245, 45 190, 65 170 C 75 160, 85 170, 75 180"
          fill="none"
          stroke={mascotColors.fur}
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* Left Ear */}
        <Circle cx="82" cy="140" r="28" fill={mascotColors.fur} />
        <Circle cx="84" cy="140" r="17" fill={mascotColors.peach} />

        {/* Right Ear */}
        <Circle cx="218" cy="136" r="28" fill={mascotColors.fur} />
        <Circle cx="216" cy="136" r="17" fill={mascotColors.peach} />

        {/* Body & Tummy */}
        <Circle cx="150" cy="220" r="44" fill={mascotColors.fur} />
        <Circle cx="150" cy="224" r="28" fill={mascotColors.peach} />

        {/* Right Paw Resting on Belly/Hip */}
        <Circle cx="180" cy="212" r="11" fill={mascotColors.peach} stroke={mascotColors.fur} strokeWidth="2.5" />

        {/* Pondering Head Group (Tilted slightly in thought) */}
        <G transform="rotate(-4 150 140)">
          {/* Chibi Round Head */}
          <Circle cx="150" cy="138" r="66" fill={mascotColors.fur} />

          {/* Peach Face Mask */}
          <Circle cx="124" cy="130" r="35" fill={mascotColors.face} />
          <Circle cx="176" cy="130" r="35" fill={mascotColors.face} />
          <Circle cx="150" cy="152" r="38" fill={mascotColors.face} />

          {/* Rosy Blush Cheeks */}
          <Circle cx="110" cy="158" r="12" fill={mascotColors.blush} opacity="0.8" />
          <Circle cx="190" cy="158" r="12" fill={mascotColors.blush} opacity="0.8" />

          {/* Button Nose */}
          <Circle cx="150" cy="146" r="5" fill={mascotColors.furDark} />

          {/* INQUISITIVE / GUESSING MOUTH (Small curious 'o' smile) */}
          <Path
            d="M 143 165 Q 150 160 157 165"
            fill="none"
            stroke={mascotColors.furDark}
            strokeWidth="3.4"
            strokeLinecap="round"
          />

          {/* THOUGHTFUL EYES (Looking up and to the right towards thought cloud) */}
          <G>
            {/* Left Eye */}
            <Ellipse cx="124" cy="130" rx="14" ry="19" fill={mascotColors.eyes} />
            <Circle cx="122" cy="123" r="6" fill={mascotColors.white} />
            <Circle cx="128" cy="136" r="3" fill={mascotColors.white} />

            {/* Right Eye */}
            <Ellipse cx="176" cy="130" rx="14" ry="19" fill={mascotColors.eyes} />
            <Circle cx="174" cy="123" r="6" fill={mascotColors.white} />
            <Circle cx="180" cy="136" r="3" fill={mascotColors.white} />
          </G>

          {/* Arm Reaching Up to Chin ("The Thinker" pose) */}
          <Path
            d="M 118 214 C 112 192, 122 176, 134 167"
            fill="none"
            stroke={mascotColors.fur}
            strokeWidth="11"
            strokeLinecap="round"
          />
          {/* Left Paw Pondering on Chin */}
          <Circle cx="134" cy="167" r="11" fill={mascotColors.peach} stroke={mascotColors.fur} strokeWidth="2.5" />

          {/* Scholar Cap (Tilted) */}
          <G transform="rotate(-5 150 78)">
            <Rect x="128" y="76" width="44" height="14" rx="4" fill={mascotColors.brandDark} />
            <Path d="M 150 56 L 196 74 L 150 92 L 104 74 Z" fill={mascotColors.brandDeep} />
            <Circle cx="150" cy="74" r="5" fill={mascotColors.gold} />
            {/* Gold Tassel */}
            <Path
              d="M 150 74 Q 172 82 180 96"
              fill="none"
              stroke={mascotColors.gold}
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <Circle cx="180" cy="98" r="4" fill={mascotColors.gold} />
            <Rect x="178" y="100" width="5" height="9" rx="2" fill={mascotColors.gold} />
          </G>
        </G>

        {/* THOUGHT BUBBLES & GLOWING QUESTION MARK (Pondering / Guessing) */}
        {/* Smallest Bubble */}
        <Circle cx="212" cy="94" r="5.5" fill={mascotColors.brandBorder} opacity="0.9" />

        {/* Medium Bubble */}
        <Circle cx="228" cy="76" r="8.5" fill={mascotColors.brandLight} opacity="0.95" />

        {/* Thought Cloud with Question Mark */}
        <G transform="translate(195, 12)">
          {/* Cloud Base */}
          <Path
            d="M 38 48 C 30 48, 24 41, 27 34 C 24 26, 33 20, 42 22 C 48 14, 62 14, 68 22 C 77 20, 84 29, 80 38 C 86 45, 79 53, 70 51 C 64 56, 44 55, 38 48 Z"
            fill={mascotColors.aura}
            stroke={mascotColors.brandBorder}
            strokeWidth="2"
          />
          {/* Glowing Question Mark Inside Thought Cloud */}
          <Path
            d="M 50 30 C 50 25, 54 22, 59 22 C 63 22, 66 25, 65 29 C 64 34, 59 36, 59 40"
            fill="none"
            stroke={mascotColors.brand}
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <Circle cx="59.2" cy="45" r="2.2" fill={mascotColors.brand} />
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
