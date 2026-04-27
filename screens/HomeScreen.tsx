import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Props = {
  session: Session;
};

// HomeScreen é a tela principal pós-login e pós-onboarding.
// Recebe session para saber quem está logado e exibir o e-mail.
export default function HomeScreen({ session }: Props) {
  async function handleSignOut() {
    // signOut limpa a sessão local; o listener em App.tsx detecta a mudança
    // e redireciona automaticamente para AuthScreen
    await supabase.auth.signOut();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Olá!</Text>
      <Text style={styles.email}>{session.user.email}</Text>

      {/* Placeholder descritivo das features que ainda virão */}
      <Text style={styles.placeholder}>
        Em breve você poderá registrar suas refeições, acompanhar suas calorias
        diárias e escanear alimentos com a câmera.
      </Text>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  greeting: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: '#555',
    marginBottom: 24,
  },
  placeholder: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 48,
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 15,
    color: '#555',
  },
});
