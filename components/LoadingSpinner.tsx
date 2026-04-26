import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props {
  size?: number;
  darkBackground?: boolean;
}

export default function LoadingSpinner({ size = 128, darkBackground = false }: Props) {
  const dashOffset = useRef(new Animated.Value(10)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const s = size / 128;
    const easing = Easing.bezier(0.42, 0.17, 0.75, 0.83);
    const lin = Easing.linear;

    const bx = (v: number) => [
      Animated.timing(translateX, { toValue: v * s, duration: 60, easing: lin, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 60, easing: lin, useNativeDriver: true }),
    ];
    const by = (v: number) => [
      Animated.timing(translateY, { toValue: v * s, duration: 60, easing: lin, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 60, easing: lin, useNativeDriver: true }),
    ];

    const xAnim = Animated.loop(Animated.sequence([
      Animated.delay(1260),
      ...bx(1.70),
      Animated.delay(150),
      ...bx(-21.34),
      Animated.delay(120),
      ...bx(4.68),
      Animated.delay(120),
      ...bx(-0.76),
      Animated.delay(90),
      ...bx(-2.46),
      Animated.delay(90),
      ...bx(12.0),
      Animated.delay(90),
      ...bx(-5.82),
      Animated.delay(240),
    ]));

    const yAnim = Animated.loop(Animated.sequence([
      Animated.delay(1260),
      ...by(8.64),
      Animated.delay(150),
      ...by(-0.69),
      Animated.delay(120),
      ...by(-3.15),
      Animated.delay(120),
      ...by(19.55),
      Animated.delay(90),
      ...by(-5.99),
      Animated.delay(90),
      ...by(1.23),
      Animated.delay(90),
      ...by(2.53),
      Animated.delay(240),
    ]));

    const wormAnim = Animated.loop(Animated.sequence([
      Animated.timing(dashOffset, { toValue: 10, duration: 0, useNativeDriver: false }),
      Animated.timing(dashOffset, { toValue: 295, duration: 750, easing, useNativeDriver: false }),
      Animated.timing(dashOffset, { toValue: 1165, duration: 2250, easing, useNativeDriver: false }),
    ]));

    xAnim.start();
    yAnim.start();
    wormAnim.start();

    return () => {
      xAnim.stop();
      yAnim.stop();
      wormAnim.stop();
    };
  }, [size]);

  const ringStroke = darkBackground
    ? 'hsla(0,10%,90%,0.1)'
    : 'hsla(0,10%,10%,0.1)';

  return (
    <Animated.View style={{ transform: [{ translateX }, { translateY }] }}>
      <Svg viewBox="0 0 128 128" width={size} height={size}>
        <Defs>
          <LinearGradient id="pl-grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="hsl(193,90%,55%)" />
            <Stop offset="100%" stopColor="hsl(223,90%,55%)" />
          </LinearGradient>
        </Defs>
        <Circle
          r="56" cx="64" cy="64"
          fill="none"
          stroke={ringStroke}
          strokeWidth="16"
          strokeLinecap="round"
        />
        <AnimatedPath
          d="M92,15.492S78.194,4.967,66.743,16.887c-17.231,17.938-28.26,96.974-28.26,96.974L119.85,59.892l-99-31.588,57.528,89.832L97.8,19.349,13.636,88.51l89.012,16.015S81.908,38.332,66.1,22.337C50.114,6.156,36,15.492,36,15.492a56,56,0,1,0,56,0Z"
          fill="none"
          stroke="url(#pl-grad)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="44 1111"
          strokeDashoffset={dashOffset}
        />
      </Svg>
    </Animated.View>
  );
}
