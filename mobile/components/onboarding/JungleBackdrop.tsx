import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  ImageBackground,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Individual Floating Firefly Particle
interface FireflyProps {
  initialX: number;
  initialY: number;
  size: number;
  delay: number;
  duration: number;
}

function Firefly({ initialX, initialY, size, delay, duration }: FireflyProps) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0.15);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-35, { duration: duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(20, { duration: duration * 1.2, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: duration * 0.9, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );

    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(25, { duration: duration * 1.1, easing: Easing.inOut(Easing.quad) }),
          withTiming(-20, { duration: duration * 1.3, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: duration, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      )
    );

    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.9, { duration: duration * 0.7, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: duration * 0.8, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.3, { duration: duration * 0.6 }),
          withTiming(0.8, { duration: duration * 0.6 })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.firefly,
        {
          left: initialX,
          top: initialY,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.fireflyGlow,
          {
            width: size * 2.8,
            height: size * 2.8,
            borderRadius: (size * 2.8) / 2,
            left: -size * 0.9,
            top: -size * 0.9,
          },
        ]}
      />
    </Animated.View>
  );
}

// Drifting Animated Jungle Leaf
interface DriftingLeafProps {
  startX: number;
  startY: number;
  delay: number;
  duration: number;
  leafScale: number;
}

function DriftingLeaf({ startX, startY, delay, duration, leafScale }: DriftingLeafProps) {
  const transX = useSharedValue(0);
  const transY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const leafOpacity = useSharedValue(0);

  useEffect(() => {
    transY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(SCREEN_HEIGHT * 0.6, { duration, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      )
    );

    transX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(40, { duration: duration * 0.35, easing: Easing.inOut(Easing.sin) }),
          withTiming(-35, { duration: duration * 0.45, easing: Easing.inOut(Easing.sin) }),
          withTiming(15, { duration: duration * 0.2, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );

    rotation.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(35, { duration: duration * 0.5, easing: Easing.inOut(Easing.ease) }),
          withTiming(-40, { duration: duration * 0.5, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    leafOpacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.85, { duration: duration * 0.15 }),
          withTiming(0.7, { duration: duration * 0.65 }),
          withTiming(0, { duration: duration * 0.2 })
        ),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: transX.value },
      { translateY: transY.value },
      { rotateZ: `${rotation.value}deg` },
      { scale: leafScale },
    ],
    opacity: leafOpacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.leafContainer,
        { left: startX, top: startY },
        animatedStyle,
      ]}
    >
      <Svg width={30} height={30} viewBox="0 0 30 30">
        <Path
          d="M 5,15 C 5,5 20,2 25,5 C 28,15 22,25 15,25 C 10,25 5,20 5,15 Z"
          fill="#4ADE80"
          opacity={0.85}
        />
        <Path
          d="M 5,15 Q 15,15 25,5"
          stroke="#166534"
          strokeWidth={1.5}
          fill="none"
          opacity={0.6}
        />
      </Svg>
    </Animated.View>
  );
}

// Swaying Hanging Vine Accent at Top Canopy
function SwayingVine({ left, rotateAnchor }: { left: number; rotateAnchor: number }) {
  const swayAngle = useSharedValue(0);

  useEffect(() => {
    swayAngle.value = withRepeat(
      withSequence(
        withTiming(rotateAnchor + 4, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(rotateAnchor - 4, { duration: 3200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const vineStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${swayAngle.value}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.vineContainer,
        { left },
        vineStyle,
      ]}
    >
      <Svg width={40} height={120} viewBox="0 0 40 120">
        <Path
          d="M 20,0 Q 30,30 18,60 T 22,120"
          stroke="#15803D"
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
        />
        {/* Little leaves branching from vine */}
        <Path d="M 24,25 Q 35,22 34,32 Q 25,32 24,25 Z" fill="#22C55E" />
        <Path d="M 18,50 Q 8,46 9,56 Q 17,56 18,50 Z" fill="#4ADE80" />
        <Path d="M 21,85 Q 32,80 30,90 Q 22,90 21,85 Z" fill="#16A34A" />
      </Svg>
    </Animated.View>
  );
}

interface JungleBackdropProps {
  children?: React.ReactNode;
}

export const JungleBackdrop: React.FC<JungleBackdropProps> = ({ children }) => {
  return (
    <View style={styles.container}>
      {/* 3D Pixar Jungle Background Artwork */}
      <ImageBackground
        source={require('@/assets/jungle_bg.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Soft atmospheric gradient/tint for high text contrast */}
        <View style={styles.atmosphereOverlay} />

        {/* Ambient Top Swaying Canopy Vines */}
        <SwayingVine left={SCREEN_WIDTH * 0.08} rotateAnchor={-2} />
        <SwayingVine left={SCREEN_WIDTH * 0.82} rotateAnchor={3} />

        {/* Floating Golden Fireflies / Sunlight Motes */}
        <Firefly initialX={SCREEN_WIDTH * 0.15} initialY={SCREEN_HEIGHT * 0.22} size={7} delay={0} duration={3200} />
        <Firefly initialX={SCREEN_WIDTH * 0.75} initialY={SCREEN_HEIGHT * 0.18} size={9} delay={700} duration={3600} />
        <Firefly initialX={SCREEN_WIDTH * 0.35} initialY={SCREEN_HEIGHT * 0.45} size={6} delay={1400} duration={2900} />
        <Firefly initialX={SCREEN_WIDTH * 0.85} initialY={SCREEN_HEIGHT * 0.52} size={8} delay={400} duration={3400} />
        <Firefly initialX={SCREEN_WIDTH * 0.2} initialY={SCREEN_HEIGHT * 0.68} size={7} delay={1200} duration={3100} />
        <Firefly initialX={SCREEN_WIDTH * 0.65} initialY={SCREEN_HEIGHT * 0.75} size={9} delay={800} duration={3500} />

        {/* Drifting Leaves */}
        <DriftingLeaf startX={SCREEN_WIDTH * 0.2} startY={SCREEN_HEIGHT * 0.05} delay={200} duration={7200} leafScale={0.9} />
        <DriftingLeaf startX={SCREEN_WIDTH * 0.7} startY={SCREEN_HEIGHT * 0.12} delay={2600} duration={8000} leafScale={1.1} />

        {/* Main Content (UI Cards, Buttons, and Momo) */}
        <View style={styles.contentLayer}>
          {children}
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071811',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  atmosphereOverlay: {
    ...StyleSheet.absoluteFill,
    // Tint with soft deep jungle gradient for readable text over 3D art
    backgroundColor: 'rgba(7, 24, 17, 0.42)',
  },
  contentLayer: {
    flex: 1,
  },
  firefly: {
    position: 'absolute',
    backgroundColor: '#FEF08A',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 2,
  },
  fireflyGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(250, 204, 21, 0.35)',
  },
  leafContainer: {
    position: 'absolute',
    zIndex: 2,
  },
  vineContainer: {
    position: 'absolute',
    top: -10,
    zIndex: 3,
    transformOrigin: 'top center',
  },
});
