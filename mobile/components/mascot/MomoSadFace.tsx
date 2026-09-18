import React, { useEffect, useRef } from 'react';
import { mascotColors } from '@/constants/theme';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Rect, G, Ellipse } from 'react-native-svg';

interface MomoSadFaceProps {
  size?: number;
}

/**
 * High-fidelity Vector SVG of Momo with a cute, sad, tearful expression.
 * Used for deletion and confirmation dialogs to provide an emotional,
 * delightful touch when removing study materials.
 */
export const MomoSadFace: React.FC<MomoSadFaceProps> = ({ size = 88 }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const tearAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle trembling / breathing float
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -3,
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

    // Glistening tear loop
    const tearLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tearAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(tearAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    tearLoop.start();

    return () => {
      floatLoop.stop();
      tearLoop.stop();
    };
  }, [floatAnim, tearAnim]);

  const tearScale = tearAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.15],
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
        {/* Sad Sparkle Stars */}
        <Circle cx="40" cy="70" r="5" fill={mascotColors.tearLight} opacity="0.6" />
        <Circle cx="260" cy="65" r="6" fill={mascotColors.tearLight} opacity="0.6" />

        {/* Drooping Tail Behind */}
        <Path
          d="M 110 230 C 70 240, 50 210, 60 190 C 65 180, 75 185, 70 195"
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

        {/* Chibi Body & Tummy */}
        <Circle cx="150" cy="220" r="44" fill={mascotColors.fur} />
        <Circle cx="150" cy="224" r="28" fill={mascotColors.peach} />

        {/* Chibi Round Head */}
        <Circle cx="150" cy="138" r="66" fill={mascotColors.fur} />

        {/* Peach Face Mask */}
        <Circle cx="124" cy="130" r="35" fill={mascotColors.face} />
        <Circle cx="176" cy="130" r="35" fill={mascotColors.face} />
        <Circle cx="150" cy="152" r="38" fill={mascotColors.face} />

        {/* Rosy Blush Cheeks */}
        <Circle cx="110" cy="158" r="12" fill={mascotColors.blush} opacity="0.8" />
        <Circle cx="190" cy="158" r="12" fill={mascotColors.blush} opacity="0.8" />

        {/* Tiny Button Nose */}
        <Circle cx="150" cy="146" r="5" fill={mascotColors.furDark} />

        {/* SAD POUTY FROWN MOUTH */}
        <Path
          d="M 137 166 Q 150 154 163 166"
          fill="none"
          stroke={mascotColors.furDark}
          strokeWidth="3.6"
          strokeLinecap="round"
        />

        {/* BIG TEARFUL PUPPY-DOG EYES */}
        <G>
          {/* Left Eye */}
          <Ellipse cx="124" cy="133" rx="15" ry="20" fill={mascotColors.eyes} />
          <Circle cx="121" cy="126" r="6.2" fill={mascotColors.white} />
          <Circle cx="127" cy="140" r="3.2" fill={mascotColors.white} />

          {/* Right Eye */}
          <Ellipse cx="176" cy="133" rx="15" ry="20" fill={mascotColors.eyes} />
          <Circle cx="173" cy="126" r="6.2" fill={mascotColors.white} />
          <Circle cx="179" cy="140" r="3.2" fill={mascotColors.white} />
        </G>

        {/* GLISTENING TEARS */}
        {/* Left Tear */}
        <Path
          d="M 112 144 C 107 152, 109 162, 114 161 C 119 160, 117 150, 112 144 Z"
          fill={mascotColors.tear}
          opacity="0.9"
        />
        <Circle cx="112" cy="168" r="3" fill={mascotColors.tearLight} opacity="0.85" />

        {/* Right Tear */}
        <Path
          d="M 188 144 C 193 152, 191 162, 186 161 C 181 160, 183 150, 188 144 Z"
          fill={mascotColors.tear}
          opacity="0.9"
        />
        <Circle cx="188" cy="168" r="3" fill={mascotColors.tearLight} opacity="0.85" />

        {/* Cute Worried Little Paws Held Up to Chin */}
        <Circle cx="132" cy="188" r="11" fill={mascotColors.peach} stroke={mascotColors.fur} strokeWidth="2.5" />
        <Circle cx="168" cy="188" r="11" fill={mascotColors.peach} stroke={mascotColors.fur} strokeWidth="2.5" />

        {/* Scholar Cap Slightly Tilted */}
        <G transform="rotate(4 150 78)">
          <Rect x="128" y="76" width="44" height="14" rx="4" fill={mascotColors.brandDark} />
          {/* Diamond top */}
          <Path d="M 150 56 L 196 74 L 150 92 L 104 74 Z" fill={mascotColors.brandDeep} />
          <Circle cx="150" cy="74" r="5" fill={mascotColors.gold} />
          {/* Gold Tassel drooping */}
          <Path
            d="M 150 74 Q 172 84 180 98"
            fill="none"
            stroke={mascotColors.gold}
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <Circle cx="180" cy="100" r="4" fill={mascotColors.gold} />
          <Rect x="178" y="102" width="5" height="10" rx="2" fill={mascotColors.gold} />
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
