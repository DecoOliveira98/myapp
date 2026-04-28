import { TextInput, StyleSheet, View } from 'react-native';
import { Colors } from '../../theme/colors';

interface Props {
    placeholder: string;
    value: string;
    onChangeText: (t: string) => void;
    secureTextEntry?: boolean;
}

export const CustomInput = ({ ...props }: Props) => (
    <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor="#666"
    />
);

const styles = StyleSheet.create({
    input: {
        backgroundColor: Colors.background,
        color: Colors.text,
        padding: 15,
        borderRadius: 4,
        marginBottom: 15,
    },
});