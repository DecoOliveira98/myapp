import React, { useState, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TAB_WIDTH = 70;

// Paleta Premium: Tons de Grafite, Dourado e Cinza Sedoso
const Colors = {
    primary: '#E2B042', // Dourado Premium
    background: '#121212', // Preto profundo
    card: '#1E1E1E', // Cinza do card
    textInactive: '#555555',
    indicatorBorder: '#0c0c0c',
};

const menuItems = [
    { icon: 'grid-outline', activeIcon: 'grid' },
    { icon: 'person-outline', activeIcon: 'person' },
    { icon: 'add-circle-outline', activeIcon: 'add-circle' },
    { icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
    { icon: 'settings-outline', activeIcon: 'settings' },
];

interface NavBarProps {
    onTabChange?: (index: number) => void;
}

export default function NavBar({ onTabChange }: NavBarProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const translateX = useRef(new Animated.Value(0)).current;

    const handlePress = (index: number) => {
        setActiveIndex(index);
        onTabChange?.(index);

        // Animação com mola mais "pesada" e elegante
        Animated.spring(translateX, {
            toValue: index * TAB_WIDTH,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
        }).start();
    };

    return (
        <View style={styles.navigation}>
            <View style={styles.list}>
                {/* Indicador Luxuoso */}
                <Animated.View
                    style={[
                        styles.indicator,
                        { transform: [{ translateX }] }
                    ]}
                />

                {menuItems.map((item, index) => {
                    const isActive = activeIndex === index;

                    return (
                        <TouchableOpacity
                            key={index}
                            style={styles.tabItem}
                            onPress={() => handlePress(index)}
                            activeOpacity={0.7}
                        >
                            <Animated.View style={[
                                styles.iconBox,
                                isActive && {
                                    backgroundColor: Colors.primary,
                                    transform: [{ translateY: -28 }],
                                    // Sombra no ícone ativo para brilho
                                    shadowColor: Colors.primary,
                                    shadowOffset: { width: 0, height: 10 },
                                    shadowOpacity: 0.5,
                                    shadowRadius: 10,
                                }
                            ]}>
                                <Ionicons
                                    name={(isActive ? item.activeIcon : item.icon) as any}
                                    size={26}
                                    color={isActive ? '#000' : Colors.textInactive}
                                />
                            </Animated.View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    navigation: {
        position: 'absolute',
        bottom: 30,
        width: 350 + 20,
        height: 70,
        backgroundColor: Colors.card,
        borderRadius: 25, // Bordas mais arredondadas para ar moderno
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        // Sombra do Menu
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.4,
        shadowRadius: 30,
        elevation: 15,
    },
    list: {
        flexDirection: 'row',
        width: 350,
        height: 70,
    },
    tabItem: {
        width: TAB_WIDTH,
        height: 70,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    iconBox: {
        width: 55,
        height: 55,
        borderRadius: 20, // Squircle (quadrado arredondado) em vez de círculo
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    indicator: {
        position: 'absolute',
        top: -35,
        width: TAB_WIDTH,
        height: 70,
        backgroundColor: Colors.card,
        borderRadius: 35,
        borderWidth: 8,
        borderColor: Colors.indicatorBorder,
        zIndex: 1,
    }
});