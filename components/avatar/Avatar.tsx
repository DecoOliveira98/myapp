import { useMemo, useState } from 'react';
import { Image, ImageStyle, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';

type AvatarSize = 'sm' | 'md' | 'lg';

type Props = {
    src?: string;
    name: string;
    size?: AvatarSize;
};

const SIZE_MAP: Record<AvatarSize, number> = {
    sm: 24,
    md: 32,
    lg: 40,
};

function getInitials(name: string): string {
    const clean = name.trim();
    if (!clean) return 'U';

    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export default function Avatar({ src, name, size = 'md' }: Props) {
    const { T } = useTheme();
    const styles = useMemo(() => makeStyles(T), [T]);
    const [hasImageError, setHasImageError] = useState(false);
    const dimension = SIZE_MAP[size];
    const initials = useMemo(() => getInitials(name), [name]);

    const circleStyle: ViewStyle = {
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
    };

    const imageStyle: ImageStyle = {
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
    };

    const textSize = size === 'sm' ? T.textXs : size === 'md' ? T.textSm : T.textBase;

    const shouldShowImage = Boolean(src) && !hasImageError;

    if (shouldShowImage) {
        return (
            <Image
                source={{ uri: src }}
                style={[styles.image, imageStyle]}
                onError={() => setHasImageError(true)}
                accessibilityRole="image"
                accessibilityLabel={`Avatar de ${name}`}
            />
        );
    }

    return (
        <View style={[styles.fallback, circleStyle]} accessibilityRole="image" accessibilityLabel={`Avatar de ${name}`}>
            <Text style={[styles.initials, { fontSize: textSize }]}>{initials}</Text>
        </View>
    );
}

function makeStyles(T: TokenSet) {
    return StyleSheet.create({
        image: {
            backgroundColor: T.surface1,
        },
        fallback: {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: T.accent,
        },
        initials: {
            fontFamily: T.fontBodyMedium,
            color: T.onAccent,
            letterSpacing: 0.2,
            textTransform: 'uppercase',
        },
    });
}
