import { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signUp() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) Alert.alert('Erro', error.message);
    else Alert.alert('Sucesso', 'Conta criada! Verifica teu email.');
  }

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Erro', error.message);
  }

  if (session) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Olá!</Text>
        <Text style={styles.text}>{session.user.email}</Text>
        <View style={{ marginTop: 30 }}>
          <Button title="Sair" onPress={() => supabase.auth.signOut()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entrar</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button
        title={loading ? 'Carregando...' : 'Entrar'}
        onPress={signIn}
        disabled={loading}
      />
      <View style={{ marginTop: 12 }}>
        <Button title="Criar conta" onPress={signUp} disabled={loading} color="#888" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 80, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 30, textAlign: 'center' },
  text: { fontSize: 18, textAlign: 'center', color: '#444' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
});