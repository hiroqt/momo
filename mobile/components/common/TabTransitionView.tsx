import React, { useRef, useCallback } from 'react';
import { Animated, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';

interface TabTransitionViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps tab screens with a lightweight, native-driven cross-fade and subtle lift
 * animation whenever the tab is brought into focus.
 */
export const TabTransitionView: React.FC<TabTransitionViewProps> = ({
  children,
  style,
}) => {
  const fadeAnim = useRef(new Animated.Value(0.4)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0.4);
      translateY.setValue(6);

      const anim = Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]);

      anim.start();

      return () => {
        anim.stop();
      };
    }, [fadeAnim, translateY])
  );

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
