import { ActivityIndicator, StyleSheet, View } from 'react-native';

// Tela exibida enquanto o App.tsx verifica a sessão e o perfil do usuário.
// Não recebe props porque é puramente visual e temporária.
export default function LoadingPage() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#000" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
