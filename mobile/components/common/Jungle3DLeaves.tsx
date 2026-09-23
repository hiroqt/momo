import React, { useEffect } from 'react';
import {
  StyleSheet,
  Dimensions,
  StyleProp,
  ImageStyle,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LEAF_ASSETS = {
  topLeft: require('@/assets/leaves/leaf_top_left.png'),
  topRight: require('@/assets/leaves/leaf_top_right.png'),
  left: require('@/assets/leaves/leaf_left.png'),
  right: require('@/assets/leaves/leaf_right.png'),
  bottomLeft: require('@/assets/leaves/leaf_bottom_left.png'),
};

interface SingleLeafProps {
  source: any;
  positionStyle: StyleProp<ImageStyle>;
  initialOffset: { x: number; y: number; rotateZ: number; rotateY?: number; rotateX?: number; scale?: number };
  settleDelay: number;
  swayConfig?: {
    rotateZRange?: [number, number];
    rotateYRange?: [number, number];
    translateYRange?: [number, number];
    duration?: number;
  };
  zIndex?: number;
}

function SingleLeaf({
  source,
  positionStyle,
  initialOffset,
  settleDelay,
  swayConfig = {},
  zIndex = 10,
}: SingleLeafProps) {
  // 3D Transform shared values
  const transX = useSharedValue(initialOffset.x);
  const transY = useSharedValue(initialOffset.y);
  const rotZ = useSharedValue(initialOffset.rotateZ);
  const rotY = useSharedValue(initialOffset.rotateY ?? 0);
  const rotX = useSharedValue(initialOffset.rotateX ?? 0);
  const scale = useSharedValue(initialOffset.scale ?? 1.15);
  const opacity = useSharedValue(0);

  // Ambient sway shared values
  const swayZ = useSharedValue(0);
  const swayY = useSharedValue(0);
  const swayBob = useSharedValue(0);

  useEffect(() => {
    // 1. Position-based 3D slide-in entrance
    const springConfig = {
      damping: 15,
      stiffness: 70,
      mass: 0.9,
    };

    opacity.value = withDelay(settleDelay, withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }));
    transX.value = withDelay(settleDelay, withSpring(0, springConfig));
    transY.value = withDelay(settleDelay, withSpring(0, springConfig));
    rotZ.value = withDelay(settleDelay, withSpring(0, springConfig));
    rotY.value = withDelay(settleDelay, withSpring(0, springConfig));
    rotX.value = withDelay(settleDelay, withSpring(0, springConfig));
    scale.value = withDelay(settleDelay, withSpring(1, springConfig));

    // 2. Ambient jungle breeze sway loop after entrance settles
    const duration = swayConfig.duration ?? 3200;
    const zRange = swayConfig.rotateZRange ?? [-2.5, 2.5];
    const yRange = swayConfig.rotateYRange ?? [-3, 3];
    const bobRange = swayConfig.translateYRange ?? [-4, 4];

    swayZ.value = withDelay(
      settleDelay + 700,
      withRepeat(
        withSequence(
          withTiming(zRange[1], { duration: duration * 0.5, easing: Easing.inOut(Easing.sin) }),
          withTiming(zRange[0], { duration: duration * 0.5, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );

    swayY.value = withDelay(
      settleDelay + 800,
      withRepeat(
        withSequence(
          withTiming(yRange[1], { duration: duration * 0.55, easing: Easing.inOut(Easing.quad) }),
          withTiming(yRange[0], { duration: duration * 0.55, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      )
    );

    swayBob.value = withDelay(
      settleDelay + 900,
      withRepeat(
        withSequence(
          withTiming(bobRange[1], { duration: duration * 0.6, easing: Easing.inOut(Easing.sin) }),
          withTiming(bobRange[0], { duration: duration * 0.6, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { perspective: 900 },
      { translateX: transX.value },
      { translateY: transY.value + swayBob.value },
      { rotateX: `${rotX.value}deg` },
      { rotateY: `${rotY.value + swayY.value}deg` },
      { rotateZ: `${rotZ.value + swayZ.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.Image
      source={source}
      style={[styles.leafBase, positionStyle, { zIndex }, animatedStyle]}
      resizeMode="contain"
    />
  );
}

export interface Jungle3DLeavesProps {
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Jungle3DLeaves({ active = true, style }: Jungle3DLeavesProps) {
  if (!active) return null;

  // Responsive sizes based on screen dimensions
  const topLeafWidth = Math.min(SCREEN_WIDTH * 0.62, 260);
  const topLeafHeight = topLeafWidth * (480 / 420);

  const topRightWidth = Math.min(SCREEN_WIDTH * 0.55, 230);
  const topRightHeight = topRightWidth * (500 / 348);

  const midLeftWidth = Math.min(SCREEN_WIDTH * 0.38, 160);
  const midLeftHeight = midLeftWidth * (520 / 260);

  const midRightWidth = Math.min(SCREEN_WIDTH * 0.36, 150);
  const midRightHeight = midRightWidth * (540 / 228);

  const bottomLeafWidth = Math.min(SCREEN_WIDTH * 0.58, 230);
  const bottomLeafHeight = bottomLeafWidth * (256 / 360);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, style]} pointerEvents="none">
      {/* 1. TOP-LEFT Palm Canopy (slides in from top-left diagonal) */}
      <SingleLeaf
        source={LEAF_ASSETS.topLeft}
        positionStyle={{
          position: 'absolute',
          top: -15,
          left: -15,
          width: topLeafWidth,
          height: topLeafHeight,
        }}
        initialOffset={{
          x: -topLeafWidth * 1.1,
          y: -topLeafHeight * 0.7,
          rotateZ: -32,
          rotateY: 28,
          rotateX: 20,
          scale: 1.25,
        }}
        settleDelay={60}
        swayConfig={{
          rotateZRange: [-2.5, 3],
          rotateYRange: [-3.5, 2.5],
          translateYRange: [-3, 4],
          duration: 3400,
        }}
        zIndex={12}
      />

      {/* 2. TOP-RIGHT Palm Fronds & Vine (slides in from top-right diagonal) */}
      <SingleLeaf
        source={LEAF_ASSETS.topRight}
        positionStyle={{
          position: 'absolute',
          top: -20,
          right: -15,
          width: topRightWidth,
          height: topRightHeight,
        }}
        initialOffset={{
          x: topRightWidth * 1.1,
          y: -topRightHeight * 0.7,
          rotateZ: 30,
          rotateY: -28,
          rotateX: 20,
          scale: 1.25,
        }}
        settleDelay={140}
        swayConfig={{
          rotateZRange: [-3, 3],
          rotateYRange: [-2.5, 3.5],
          translateYRange: [-4, 3],
          duration: 3800,
        }}
        zIndex={11}
      />

      {/* 3. MID-LEFT Fern & Branch (slides in from left screen edge) */}
      <SingleLeaf
        source={LEAF_ASSETS.left}
        positionStyle={{
          position: 'absolute',
          top: SCREEN_HEIGHT * 0.28,
          left: -10,
          width: midLeftWidth,
          height: midLeftHeight,
        }}
        initialOffset={{
          x: -midLeftWidth * 1.3,
          y: 20,
          rotateZ: -18,
          rotateY: 25,
          rotateX: 5,
          scale: 1.15,
        }}
        settleDelay={220}
        swayConfig={{
          rotateZRange: [-2, 2],
          rotateYRange: [-2, 3],
          translateYRange: [-3, 3],
          duration: 3100,
        }}
        zIndex={8}
      />

      {/* 4. MID-RIGHT Tropical Leaves & Flowers (slides in from right edge) */}
      <SingleLeaf
        source={LEAF_ASSETS.right}
        positionStyle={{
          position: 'absolute',
          top: SCREEN_HEIGHT * 0.24,
          right: -10,
          width: midRightWidth,
          height: midRightHeight,
        }}
        initialOffset={{
          x: midRightWidth * 1.3,
          y: -10,
          rotateZ: 20,
          rotateY: -25,
          rotateX: 5,
          scale: 1.15,
        }}
        settleDelay={280}
        swayConfig={{
          rotateZRange: [-2.5, 2.5],
          rotateYRange: [-3, 2],
          translateYRange: [-3, 3],
          duration: 3600,
        }}
        zIndex={9}
      />

      {/* 5. BOTTOM-LEFT Foreground Ferns & Bromeliads (slides up from bottom-left) */}
      <SingleLeaf
        source={LEAF_ASSETS.bottomLeft}
        positionStyle={{
          position: 'absolute',
          bottom: -10,
          left: -10,
          width: bottomLeafWidth,
          height: bottomLeafHeight,
        }}
        initialOffset={{
          x: -bottomLeafWidth * 1.1,
          y: bottomLeafHeight * 0.8,
          rotateZ: 22,
          rotateY: 20,
          rotateX: -22,
          scale: 1.2,
        }}
        settleDelay={340}
        swayConfig={{
          rotateZRange: [-1.8, 2],
          rotateYRange: [-2, 2],
          translateYRange: [-2, 3],
          duration: 3300,
        }}
        zIndex={13}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  leafBase: {
    // 3D depth shadow so leaves cast shadows over background/content
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 10,
  },
});
