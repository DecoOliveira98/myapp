import React, { useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, StatusBar } from 'react-native';
import NavBar from '../components/NavBar'; // Verifique se o caminho está correto

export default function HomeScreen({ session }: { session: any }) {
    const [currentTab, setCurrentTab] = useState(0);

    // Função para renderizar o conteúdo baseado na aba selecionada
    const renderContent = () => {
        switch (currentTab) {
            case 0:
                return <Text style={styles.contentTitle}>Home - Bem vindo!</Text>;
            case 1:
                return <Text style={styles.contentTitle}>Perfil de {session?.user?.email?.split('@')[0]}</Text>;
            case 2:
                return <Text style={styles.contentTitle}>Mensagens / Chat</Text>;
            case 3:
                return <Text style={styles.contentTitle}>Câmara / Fotos</Text>;
            case 4:
                return <Text style={styles.contentTitle}>Configurações</Text>;
            default:
                return <Text style={styles.contentTitle}>Home</Text>;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <Text style={styles.headerText}>Meu App</Text>
            </View>

            <View style={styles.main}>
                {renderContent()}
                <Text style={styles.subtitle}>
                    Teste a sua nova NavBar cá em baixo
                </Text>
            </View>

            {/* Passamos o estado para a NavBar saber onde está */}
            <NavBar onTabChange={(index) => setCurrentTab(index)} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0c0c0c', // Fundo escuro para combinar com a NavBar
    },
    header: {
        padding: 20,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    headerText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    main: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100, // Espaço para não cobrir a NavBar
    },
    contentTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 10,
    },
    subtitle: {
        color: '#666',
        fontSize: 16,
    },
});