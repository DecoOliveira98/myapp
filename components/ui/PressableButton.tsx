import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableButtonProps = Omit<PressableProps, 'style'> & {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function PressableButton({
  children,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  style,
  hitSlop,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  ...rest
}: PressableButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      if (!disabled) {
        Animated.timing(scale, {
          toValue: 0.97,
          duration: 80,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 80,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPressIn?.(e);
    },
    [disabled, scale, opacity, onPressIn],
  );

  const handlePressOut = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      Animated.timing(scale, {
        toValue: 1,
        duration: 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      Animated.timing(opacity, {
        toValue: 1,
        duration: 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      onPressOut?.(e);
    },
    [scale, opacity, onPressOut],
  );

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityHint={accessibilityHint}
      style={StyleSheet.flatten([style, { transform: [{ scale }], opacity }]) as any}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
