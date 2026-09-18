import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Rect, G, Ellipse, Text as SvgText } from 'react-native-svg';

interface MomoMoneyProps {
  size?: number;
}

/**
 * Momo in "Cash / Worried" mode.
 */
export const MomoMoney: React.FC<MomoMoneyProps> = ({ size = 130 }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const sweatAnim = useRef(new Animated.Value(0)).current;
  const eyeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Gentle float
    Animated.loop(
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
    ).start();

    // Sweat drop animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(sweatAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sweatAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Eye pulsing (money eyes)
    Animated.loop(
      Animated.sequence([
        Animated.timing(eyeScale, {
          toValue: 1.1,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(eyeScale, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim, sweatAnim, eyeScale]);

  const sweatTranslateY = sweatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
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
        {/* Left Ear */}
        <Circle cx="82" cy="138" r="28" fill="#8D5B4C" />
        <Circle cx="84" cy="138" r="17" fill="#FED7AA" />

        {/* Right Ear */}
        <Circle cx="218" cy="138" r="28" fill="#8D5B4C" />
        <Circle cx="216" cy="138" r="17" fill="#FED7AA" />

        {/* Body & Tummy */}
        <Circle cx="150" cy="216" r="46" fill="#8D5B4C" />
        <Circle cx="150" cy="220" r="30" fill="#FED7AA" />

        {/* Chibi Round Head */}
        <Circle cx="150" cy="135" r="66" fill="#8D5B4C" />

        {/* Peach Face Mask */}
        <Circle cx="124" cy="128" r="35" fill="#FEF3C7" />
        <Circle cx="176" cy="128" r="35" fill="#FEF3C7" />
        <Circle cx="150" cy="150" r="38" fill="#FEF3C7" />

        {/* Worried Cheeks */}
        <Circle cx="110" cy="154" r="12" fill="#FCA5A5" opacity="0.6" />
        <Circle cx="190" cy="154" r="12" fill="#FCA5A5" opacity="0.6" />

        {/* Button Nose */}
        <Circle cx="150" cy="144" r="5" fill="#451A03" />

        {/* Worried Mouth */}
        <Path
          d="M 142 165 Q 150 157 158 165"
          fill="none"
          stroke="#451A03"
          strokeWidth="3.4"
          strokeLinecap="round"
        />

        {/* Worried Eyebrows */}
        <Path
          d="M 110 110 L 132 102"
          fill="none"
          stroke="#451A03"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <Path
          d="M 190 110 L 168 102"
          fill="none"
          stroke="#451A03"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Money Eyes (Dollar signs instead of pupils) */}
        <G>
          {/* Left Eye */}
          <Ellipse cx="124" cy="128" rx="15" ry="19" fill="#0F172A" />
          <SvgText
            x="124"
            y="134"
            fill="#10B981"
            fontSize="20"
            fontWeight="bold"
            textAnchor="middle"
          >
            $
          </SvgText>

          {/* Right Eye */}
          <Ellipse cx="176" cy="128" rx="15" ry="19" fill="#0F172A" />
          <SvgText
            x="176"
            y="134"
            fill="#10B981"
            fontSize="20"
            fontWeight="bold"
            textAnchor="middle"
          >
            $
          </SvgText>
        </G>

        {/* Sweat Drop */}
        <G transform="translate(195, 95)">
            <Path
              d="M0,8 C0,13 4,16 8,16 C12,16 16,13 16,8 C16,4 8,0 8,0 C8,0 0,4 0,8 Z"
              fill="#60A5FA"
              opacity="0.8"
            />
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
