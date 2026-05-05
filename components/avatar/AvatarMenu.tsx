import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Avatar from './Avatar';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';

type Props = {
    src?: string;
    name: string;
    email?: string | null;
    onSignOut: () => void | Promise<void>;
    onNavigateProfile: () => void;
};

export default function AvatarMenu({ src, name, email, onSignOut, onNavigateProfile }: Props) {
    const { T } = useTheme();
    const styles = useMemo(() => makeStyles(T), [T]);
    const [isOpen, setIsOpen] = useState(false);
    const profileItemRef = useRef<any>(null);

    useEffect(() => {
        if (!isOpen) return;
        const id = setTimeout(() => {
            profileItemRef.current?.focus?.();
        }, 30);
        return () => clearTimeout(id);
    }, [isOpen]);

    function openMenu() {
        setIsOpen(true);
    }

    function closeMenu() {
        setIsOpen(false);
    }

    function toggleMenu() {
        setIsOpen(v => !v);
    }

    function handleProfilePress() {
        closeMenu();
        onNavigateProfile();
    }

    async function handleSignOutPress() {
        closeMenu();
        await onSignOut();
    }

    return (
        <View style={styles.anchor}>
            <TouchableOpacity
                onPress={toggleMenu}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Abrir menu do perfil"
                accessibilityState={{ expanded: isOpen }}
            >
                <Avatar src={src} name={name} size="md" />
            </TouchableOpacity>

            <Modal
                visible={isOpen}
                transparent
                animationType="none"
                onRequestClose={closeMenu}
            >
                <Pressable style={styles.backdrop} onPress={closeMenu}>
                    <View style={styles.dropdownWrap} pointerEvents="box-none">
                        <Pressable style={styles.menu} onPress={openMenu}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.nameText} numberOfLines={1}>
                                    {name}
                                </Text>
                                <Text style={styles.emailText} numberOfLines={1}>
                                    {email ?? 'Sem email'}
                                </Text>
                            </View>

                            <View style={styles.divider} />

                            <TouchableOpacity
                                ref={profileItemRef}
                                style={styles.menuItem}
                                onPress={handleProfilePress}
                                activeOpacity={0.75}
                                accessibilityRole="menuitem"
                            >
                                <Feather name="user" size={16} color={T.textSecondary} style={styles.menuIcon} />
                                <Text style={styles.menuItemText}>Perfil</Text>
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={handleSignOutPress}
                                activeOpacity={0.75}
                                accessibilityRole="menuitem"
                            >
                                <Feather name="log-out" size={16} color={T.danger} style={styles.menuIcon} />
                                <Text style={styles.signOutText}>Sair</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

function makeStyles(T: TokenSet) {
    return StyleSheet.create({
        anchor: {
            position: 'relative',
        },
        backdrop: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        dropdownWrap: {
            position: 'absolute',
            top: 56,
            right: 24,
            left: 24,
            alignItems: 'flex-end',
        },
        menu: {
            minWidth: 220,
            maxWidth: 320,
            borderRadius: T.rLg,
            backgroundColor: T.surface1,
            borderWidth: 1,
            borderColor: T.borderSoft,
            paddingVertical: T.sp2,
            shadowColor: T.bgBase,
            shadowOpacity: 0.35,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
        },
        sectionHeader: {
            paddingHorizontal: T.sp4,
            paddingTop: T.sp2,
            paddingBottom: T.sp3,
            gap: 2,
        },
        nameText: {
            fontFamily: T.fontBodyMedium,
            fontSize: T.textBase,
            color: T.textPrimary,
        },
        emailText: {
            fontFamily: T.fontBody,
            fontSize: T.textSm,
            color: T.textTertiary,
        },
        divider: {
            height: 1,
            backgroundColor: T.borderFaint,
            marginVertical: T.sp1,
        },
        menuItem: {
            minHeight: 40,
            paddingHorizontal: T.sp4,
            paddingVertical: T.sp2,
            flexDirection: 'row',
            alignItems: 'center',
            gap: T.sp2,
        },
        menuIcon: {
            width: 18,
            textAlign: 'center',
        },
        menuItemText: {
            fontFamily: T.fontBody,
            fontSize: T.textBase,
            color: T.textPrimary,
        },
        signOutText: {
            fontFamily: T.fontBody,
            fontSize: T.textBase,
            color: T.danger,
        },
    });
}
