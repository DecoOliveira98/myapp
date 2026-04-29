import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { T } from '../../theme/tokens';

// AuthScreen não recebe props: o App.tsx escuta onAuthStateChange e
// troca de tela automaticamente quando o login/cadastro tem sucesso.
export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Bloqueia os botões durante chamadas assíncronas para evitar duplo-clique
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert('Atenção', 'Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Erro ao entrar', error.message);
    setLoading(false);
    // Em caso de sucesso o listener em App.tsx detecta a nova sessão e navega
  }

  async function handleSignUp() {
    if (!email || !password) {
      Alert.alert('Atenção', 'Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      Alert.alert('Erro ao criar conta', error.message);
    } else {
      // Supabase envia e-mail de confirmação por padrão; avisamos o usuário
      Alert.alert('Conta criada!', 'Verifique seu e-mail para confirmar o cadastro.');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.eyebrow}>BEM-VINDO</Text>
        <Text style={styles.title}>
          Faça login para continuar no{' '}
          <Text style={styles.titleAccent}>Calorie Tracker</Text>
        </Text>

        <TextInput
          style={styles.input}
          placeholder="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            {loading ? 'Aguarde...' : 'Criar conta'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bgBase,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: T.sp5,
  },
  eyebrow: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    letterSpacing: 2,
    color: T.textTertiary,
    marginBottom: T.sp3,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: T.fontDisplay,
    fontSize: T.textXl,
    color: T.textPrimary,
    marginBottom: T.sp6,
    lineHeight: 36,
  },
  titleAccent: {
    color: T.accent,
    fontFamily: T.fontDisplayItalic,
  },
  input: {
    borderWidth: 1,
    borderColor: T.borderSoft,
    backgroundColor: T.surface1,
    paddingHorizontal: T.sp4,
    paddingVertical: 13,
    fontSize: T.textBase,
    marginBottom: T.sp3,
    color: T.textPrimary,
    fontFamily: T.fontBody,
  },
  button: {
    backgroundColor: T.accent,
    borderWidth: 1,
    borderColor: T.accent,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: T.sp2,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: T.borderStrong,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: T.bgBase,
    fontSize: T.textXs,
    fontFamily: T.fontMonoMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  buttonTextSecondary: {
    color: T.textPrimary,
  },
});
