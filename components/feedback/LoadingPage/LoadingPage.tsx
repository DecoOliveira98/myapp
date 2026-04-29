import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function LoadingPage() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#F5B544" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0E0E10',
  },
});
