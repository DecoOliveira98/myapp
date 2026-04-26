import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ImageBackground
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AuthScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLogin, setIsLogin] = useState(true); // Alterna entre Login e Cadastro

    async function handleAuth() {
        if (!email || !password) {
            Alert.alert('Atenção', 'Preencha todos os campos.');
            return;
        }

        setLoading(true);
        if (isLogin) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) Alert.alert('Erro no Login', error.message);
        } else {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) Alert.alert('Erro no Cadastro', error.message);
            else Alert.alert('Sucesso', 'Conta criada! Verifique seu e-mail.');
        }
        setLoading(false);
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.card}>
                {/* Toggle para trocar entre Login e Sign Up */}
                <View style={styles.toggleContainer}>
                    <TouchableOpacity onPress={() => setIsLogin(true)}>
                        <Text style={[styles.toggleText, isLogin && styles.toggleActive]}>LOG IN</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsLogin(false)}>
                        <Text style={[styles.toggleText, !isLogin && styles.toggleActive]}>SIGN UP</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.title}>{isLogin ? 'Bem-vindo de volta' : 'Criar Conta'}</Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Seu E-mail"
                        placeholderTextColor="#666"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Sua Senha"
                        placeholderTextColor="#666"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleAuth}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>
                        {loading ? 'CARREGANDO...' : 'ENVIAR'}
                    </Text>
                </TouchableOpacity>

                {isLogin && (
                    <TouchableOpacity>
                        <Text style={styles.forgotText}>Esqueceu a senha?</Text>
                    </TouchableOpacity>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1f2029', // Cor escura do seu CSS original
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        backgroundColor: '#2a2b38', // Cor do card do seu CSS original
        borderRadius: 15,
        padding: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 30,
        marginBottom: 40,
    },
    toggleText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        opacity: 0.4,
    },
    toggleActive: {
        opacity: 1,
        borderBottomWidth: 2,
        borderBottomColor: '#ffeba7', // Amarelo do seu CSS
        paddingBottom: 5,
    },
    title: {
        fontSize: 24,
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 30,
    },
    inputContainer: {
        gap: 15,
    },
    input: {
        backgroundColor: '#1f2029',
        color: '#c4c3ca',
        padding: 15,
        borderRadius: 8,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#ffeba7',
        padding: 15,
        borderRadius: 8,
        marginTop: 30,
        alignItems: 'center',
    },
    buttonText: {
        color: '#102770',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    forgotText: {
        color: '#c4c3ca',
        textAlign: 'center',
        marginTop: 20,
        fontSize: 14,
    }
});