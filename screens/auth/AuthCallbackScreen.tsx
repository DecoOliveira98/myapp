import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';

type Props = {
    onResolved: () => void;
};

export default function AuthCallbackScreen({ onResolved }: Props) {
    const { T } = useTheme();
    const styles = useMemo(() => makeStyles(T), [T]);

    useEffect(() => {
        let mounted = true;

        const resolveSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (!mounted) return;

            if (data.session) {
                onResolved();
                return;
            }

            setTimeout(() => {
                if (mounted) onResolved();
            }, 1200);
        };

        resolveSession();

        return () => {
            mounted = false;
        };
    }, [onResolved]);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="small" color={T.accent} />
            <Text style={styles.text}>Entrando...</Text>
        </View>
    );
}

function makeStyles(T: TokenSet) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: T.bgBase,
            alignItems: 'center',
            justifyContent: 'center',
            gap: T.sp3,
        },
        text: {
            color: T.textPrimary,
            fontFamily: T.fontBody,
            fontSize: T.textBase,
        },
    });
}
