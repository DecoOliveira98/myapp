import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';

const TAB_WIDTH = 70;

const menuItems = [
    { icon: 'grid-outline', activeIcon: 'grid', label: 'Home' },
    { icon: 'person-outline', activeIcon: 'person', label: 'Profile' },
    { icon: 'sparkles-outline', activeIcon: 'sparkles', label: 'AI', isAI: true },
    { icon: 'barcode-outline', activeIcon: 'barcode', label: 'Scanner' },
    { icon: 'trending-up-outline', activeIcon: 'trending-up', label: 'Weight' },
];

interface NavBarProps {
    onTabChange?: (index: number) => void;
}

export default function NavBar({ onTabChange }: NavBarProps) {
    const { T } = useTheme();
    const styles = useMemo(() => makeStyles(T), [T]);

    const [activeIndex, setActiveIndex] = useState(2);
    const translateX = useRef(new Animated.Value(2 * TAB_WIDTH)).current;
    const aiScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (activeIndex === 2) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(aiScale, { toValue: 1.1, duration: 800, useNativeDriver: true }),
                    Animated.timing(aiScale, { toValue: 1, duration: 800, useNativeDriver: true }),
                ])
            ).start();
        } else {
            aiScale.setValue(1);
        }
    }, [activeIndex]);

    const handlePress = (index: number) => {
        setActiveIndex(index);
        onTabChange?.(index);
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
                <Animated.View style={[styles.indicator, { transform: [{ translateX }] }]} />

                {menuItems.map((item, index) => {
                    const isActive = activeIndex === index;
                    const activeTransform = item.isAI && isActive
                        ? [{ translateY: -28 }, { scale: aiScale }]
                        : isActive
                            ? [{ translateY: -28 }]
                            : undefined;

                    return (
                        <TouchableOpacity
                            key={index}
                            style={styles.tabItem}
                            onPress={() => handlePress(index)}
                            activeOpacity={0.7}
                        >
                            <Animated.View style={[
                                styles.iconBox,
                                isActive && styles.iconBoxActive,
                                item.isAI && isActive && styles.iconBoxAI,
                                activeTransform && { transform: activeTransform },
                            ]}>
                                <Ionicons
                                    name={(isActive ? item.activeIcon : item.icon) as any}
                                    size={item.isAI ? (isActive ? 32 : 28) : 26}
                                    color={isActive ? T.bgBase : T.textTertiary}
                                />
                            </Animated.View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

function makeStyles(T: TokenSet) {
    return StyleSheet.create({
        navigation: {
            position: 'absolute',
            bottom: 30,
            width: 350 + 20,
            height: 70,
            backgroundColor: T.surface3,
            borderRadius: 25,
            justifyContent: 'center',
            alignItems: 'center',
            alignSelf: 'center',
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
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'transparent',
        },
        iconBoxActive: {
            backgroundColor: T.accent,
            shadowColor: T.accent,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.5,
            shadowRadius: 10,
        },
        iconBoxAI: {
            borderWidth: 2,
            borderColor: T.accent,
            shadowColor: T.accent,
            shadowOpacity: 0.8,
        },
        indicator: {
            position: 'absolute',
            top: -35,
            width: TAB_WIDTH,
            height: 70,
            backgroundColor: T.surface3,
            borderRadius: 35,
            borderWidth: 8,
            borderColor: T.bgBase,
            zIndex: 1,
        },
    });
}
