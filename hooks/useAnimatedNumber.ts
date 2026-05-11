import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Animates from the previous value to `target` over `duration` ms.
 * When `resetKey` changes (e.g. the selected date changes), the value jumps
 * instantly to `target` — and the *next* update after the key change is also
 * instant, to handle the async totals-reload that follows a date switch.
 * On mount the initial value is returned immediately with no animation.
 */
export function useAnimatedNumber(
  target: number,
  resetKey: string,
  duration = 300,
): number {
  const animValue = useRef(new Animated.Value(target)).current;
  const [displayed, setDisplayed] = useState(target);
  const isFirst = useRef(true);
  const lastResetKey = useRef(resetKey);
  const pendingInstant = useRef(false);

  useEffect(() => {
    const id = animValue.addListener(({ value }) => setDisplayed(value));
    return () => animValue.removeListener(id);
  }, []);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      lastResetKey.current = resetKey;
      return;
    }

    const keyChanged = lastResetKey.current !== resetKey;
    lastResetKey.current = resetKey;

    if (keyChanged) {
      // Date switched → instant, and mark next update as instant too (async reload)
      pendingInstant.current = true;
      animValue.stopAnimation();
      animValue.setValue(target);
      setDisplayed(target);
      return;
    }

    if (pendingInstant.current) {
      // First totals update after a date switch → still instant
      pendingInstant.current = false;
      animValue.stopAnimation();
      animValue.setValue(target);
      setDisplayed(target);
      return;
    }

    Animated.timing(animValue, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // required — animating layout (width) props
    }).start();
  }, [target, resetKey]);

  return displayed;
}
