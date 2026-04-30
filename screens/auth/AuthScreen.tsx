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
import Svg, { Circle, Path } from 'react-native-svg';
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

  async function handleGoogleSignIn() {
    setLoading(true);
    const redirectTo =
      typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/auth/callback`
        : 'myapp://auth/callback';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    if (error) {
      Alert.alert('Erro ao entrar', 'Não foi possível entrar com o Google. Tente novamente.');
      setLoading(false);
      return;
    }
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

        <TouchableOpacity
          style={[styles.button, styles.googleButton, loading && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <View style={styles.googleContent}>
            <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
              <Path d="M17.64 9.2045C17.64 8.56632 17.5827 7.95268 17.4764 7.36359H9V10.8454H13.8436C13.635 11.9704 12.9973 12.9232 12.0445 13.5613V15.8195H14.9564C16.6591 14.2513 17.64 11.9363 17.64 9.2045Z" fill="#4285F4" />
              <Path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0445 13.5614C11.2386 14.1014 10.2095 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.954529V13.0418C2.43545 15.9827 5.47773 18 9 18Z" fill="#34A853" />
              <Path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.82999 3.96409 7.28999V4.95817H0.954527C0.347727 6.16726 0 7.53317 0 9C0 10.4668 0.347727 11.8327 0.954527 13.0418L3.96409 10.71Z" fill="#FBBC05" />
              <Path d="M9 3.57955C10.3195 3.57955 11.5041 4.03364 12.435 4.92545L15.0218 2.33864C13.4632 0.871364 11.4259 0 9 0C5.47773 0 2.43545 2.01727 0.954529 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335" />
              <Circle cx="9" cy="9" r="8.5" stroke={T.borderStrong} />
            </Svg>
            <Text style={styles.googleButtonText}>Continuar com Google</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

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
  googleButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: T.borderStrong,
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: T.sp3,
  },
  googleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.sp2,
  },
  googleButtonText: {
    color: T.textPrimary,
    fontSize: T.textXs,
    fontFamily: T.fontMonoMedium,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: T.sp3,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: T.borderSoft,
  },
  dividerText: {
    color: T.textTertiary,
    fontFamily: T.fontBody,
    fontSize: T.textSm,
    marginHorizontal: T.sp3,
    textTransform: 'lowercase',
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
