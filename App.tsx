import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase'; // Caminho correto conforme sua imagem

// Importações ajustadas para sua nova estrutura de pastas
import AuthScreen from './screens/auth/AuthScreen';
import LoadingPage from './components/LoadingPage/LoadingPage';

// Nota: Se você ainda não criou o HomeScreen, crie um arquivo básico 
// em ./screens/HomeScreen.tsx ou comente a linha abaixo.
// import HomeScreen from './screens/HomeScreen'; 

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Busca a sessão inicial
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    // Escuta mudanças na autenticação (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Usando o seu componente de Loading que está na pasta components
  if (initializing) {
    return <LoadingPage />;
  }

  // Se houver sessão, mostra Home (precisa criar o arquivo), senão mostra Auth
  return session ? (
    /* Substitua por <HomeScreen session={session} /> quando criar o arquivo */
    <AuthScreen />
  ) : (
    <AuthScreen />
  );
}