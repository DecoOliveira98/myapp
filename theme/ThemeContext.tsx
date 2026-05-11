import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { tokensDark, tokensLight, type TokenSet } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeCtx = {
  T: TokenSet;
  themePreference: ThemePreference;
  setThemePreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeCtx>({
  T: tokensDark,
  themePreference: 'system',
  setThemePreference: () => {},
});

const PREF_KEY = 'themePreference';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [pref, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY).then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
    });
  }, []);

  const resolved = pref === 'system' ? (systemScheme ?? 'dark') : pref;
  const tokens = resolved === 'light' ? tokensLight : tokensDark;

  function setThemePreference(p: ThemePreference) {
    setPref(p);
    AsyncStorage.setItem(PREF_KEY, p);
  }

  return (
    <ThemeContext.Provider value={{ T: tokens, themePreference: pref, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
