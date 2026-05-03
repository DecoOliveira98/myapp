import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { useFonts } from 'expo-font';
import {
  Fraunces_300Light,
  Fraunces_300Light_Italic,
  Fraunces_400Regular,
} from '@expo-google-fonts/fraunces';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';

import AuthScreen from './screens/auth/AuthScreen';
import AuthCallbackScreen from './screens/auth/AuthCallbackScreen';
import LoadingPage from './components/feedback/LoadingPage/LoadingPage';
import HomeScreen from './screens/meals/HomeScreen';
import Onboarding from './screens/auth/Onboarding';

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isHandlingAuthCallback, setIsHandlingAuthCallback] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Fraunces_300Light,
    Fraunces_300Light_Italic,
    Fraunces_400Regular,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });

  useEffect(() => {
    const initializeAuth = async () => {
      if (typeof window !== 'undefined' && window.location?.pathname === '/auth/callback') {
        setIsHandlingAuthCallback(true);
      }

      const { data: { session: initialSession } } = await supabase.auth.getSession();
      setSession(initialSession);
      if (initialSession) await checkUserProfile(initialSession.user.id);
      setInitializing(false);
    };

    initializeAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s) {
        setIsHandlingAuthCallback(false);
        await checkUserProfile(s.user.id);
      } else {
        setNeedsOnboarding(false);
      }
    });

    const handlePathChange = () => {
      if (typeof window !== 'undefined' && window.location?.pathname === '/auth/callback') {
        setIsHandlingAuthCallback(true);
      }
    };

    const canListenWindowEvents =
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function' &&
      typeof window.removeEventListener === 'function';

    if (canListenWindowEvents) {
      window.addEventListener('popstate', handlePathChange);
      window.addEventListener('hashchange', handlePathChange);
    }

    return () => {
      listener.subscription.unsubscribe();
      if (canListenWindowEvents) {
        window.removeEventListener('popstate', handlePathChange);
        window.removeEventListener('hashchange', handlePathChange);
      }
    };
  }, []);

  async function checkUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (error || !data) {
      setNeedsOnboarding(true);
    } else {
      setNeedsOnboarding(false);
    }
  }

  if (initializing || (!fontsLoaded && !fontError)) {
    return <LoadingPage />;
  }

  if (!session && isHandlingAuthCallback) {
    return <AuthCallbackScreen onResolved={() => setIsHandlingAuthCallback(false)} />;
  }
  if (!session) return <AuthScreen />;
  if (needsOnboarding) return <Onboarding onComplete={() => setNeedsOnboarding(false)} />;
  return <HomeScreen session={session} />;
}
