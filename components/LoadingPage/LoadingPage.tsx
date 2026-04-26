import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

// Criamos uma versão animada do componente Path
const AnimatedPath = Animated.createAnimatedComponent(Path);

const LoadingPage = () => {
  // Referência para a animação do strokeDashoffset
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Configura a animação infinita (loop)
    Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 3000, // Mesma duração do seu CSS original
        easing: Easing.bezier(0.42, 0.17, 0.75, 0.83),
        useNativeDriver: true,
      })
    ).start();
  }, [animValue]);

  // Mapeia o valor da animação para o deslocamento do traço (strokeDashoffset)
  // Valores baseados no seu CSS: from 10, 25% 295, to 1165
  const strokeDashoffset = animValue.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [10, -295, -1165],
  });

  return (
    <View style={styles.container}>
      <Svg width="128" height="128" viewBox="0 0 128 128">
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#4fc3f7" />
            <Stop offset="100%" stopColor="#2979ff" />
          </LinearGradient>
        </Defs>

        {/* Círculo de fundo (o anel estático) */}
        <Circle
          cx="64"
          cy="64"
          r="56"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="16"
          fill="none"
        />

        {/* A "Minhoca" Animada */}
        <AnimatedPath
          d="M92,15.492S78.194,4.967,66.743,16.887c-17.231,17.938-28.26,96.974-28.26,96.974L119.85,59.892l-99-31.588,57.528,89.832L97.8,19.349,13.636,88.51l89.012,16.015S81.908,38.332,66.1,22.337C50.114,6.156,36,15.492,36,15.492a56,56,0,1,0,56,0Z"
          fill="none"
          stroke="url(#grad)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="44 1111"
          strokeDashoffset={strokeDashoffset}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f2029', // Cor do fundo do seu app
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LoadingPage;