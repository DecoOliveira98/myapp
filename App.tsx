import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

// Telas e Componentes
import AuthScreen from './screens/auth/AuthScreen';
import LoadingPage from './components/LoadingPage/LoadingPage';
import HomeScreen from './screens/HomeScreen';
import Onboarding from './screens/auth/Onboarding'; // <--- Crie este arquivo

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // 1. Monitora a sessão e verifica o perfil
    const initializeAuth = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      setSession(initialSession);

      if (initialSession) {
        await checkUserProfile(initialSession.user.id);
      }

      setInitializing(false);
    };

    initializeAuth();

    // 2. Escuta mudanças de Auth
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s) {
        await checkUserProfile(s.user.id);
      } else {
        setNeedsOnboarding(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Função para checar se o perfil já foi preenchido
  async function checkUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    // Se não encontrar dados na tabela 'profiles', ele precisa de onboarding
    if (error || !data) {
      setNeedsOnboarding(true);
    } else {
      setNeedsOnboarding(false);
    }
  }

  if (initializing) {
    return <LoadingPage />;
  }

  // FLUXO DE TELAS:
  // 1. Não logado -> AuthScreen
  if (!session) {
    return <AuthScreen />;
  }

  // 2. Logado mas sem dados -> Onboarding
  if (needsOnboarding) {
    return <Onboarding onComplete={() => setNeedsOnboarding(false)} />;
  }

  // 3. Logado e com dados -> HomeScreen
  return <HomeScreen session={session} />;
}