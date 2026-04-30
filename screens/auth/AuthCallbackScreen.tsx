import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { T } from '../../theme/tokens';

type Props = {
    onResolved: () => void;
};

export default function AuthCallbackScreen({ onResolved }: Props) {
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

const styles = StyleSheet.create({
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
