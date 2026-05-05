import { useMemo } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';

interface Props {
    placeholder: string;
    value: string;
    onChangeText: (t: string) => void;
    secureTextEntry?: boolean;
}

export const CustomInput = ({ ...props }: Props) => {
    const { T } = useTheme();
    const styles = useMemo(() => makeStyles(T), [T]);

    return (
        <TextInput
            {...props}
            style={styles.input}
            placeholderTextColor={T.textTertiary}
        />
    );
};

function makeStyles(T: TokenSet) {
    return StyleSheet.create({
        input: {
            backgroundColor: T.bgBase,
            color: T.textPrimary,
            padding: 15,
            borderRadius: 4,
            marginBottom: 15,
        },
    });
}
