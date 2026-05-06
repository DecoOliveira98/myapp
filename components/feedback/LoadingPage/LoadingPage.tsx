import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { type TokenSet } from '../../../theme/tokens';
import { useTranslation } from 'react-i18next';

export default function LoadingPage() {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{t('loadingPage.eyebrow')}</Text>
      <ActivityIndicator size="large" color={T.accent} />
      <Text style={styles.text}>{t('loadingPage.text')}</Text>
    </View>
  );
}

function makeStyles(T: TokenSet) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: T.bgBase,
      gap: T.sp3,
    },
    eyebrow: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    text: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textSecondary,
    },
  });
}
