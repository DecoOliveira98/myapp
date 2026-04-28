import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export type PrefillData = {
  name: string;
  cal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

type Props = {
  onCancel: () => void;
  onProductFound: (data: PrefillData) => void;
  onProductNotFound: (barcode: string) => void;
};

export default function BarcodeScanScreen({ onCancel, onProductFound, onProductNotFound }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<'scanning' | 'fetching'>('scanning');
  const scannedRef = useRef<boolean>(false);

  async function handleScan({ data: barcode }: { data: string }) {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setStatus('fetching');

    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const json = await res.json();

      const product = json.product;
      const nutriments = product?.nutriments;

      if (json.status !== 1 || nutriments?.['energy-kcal_100g'] == null) {
        onProductNotFound(barcode);
        return;
      }

      onProductFound({
        name: product.product_name_pt || product.product_name || 'Produto sem nome',
        cal_per_100g:     nutriments['energy-kcal_100g'],
        protein_per_100g: nutriments.proteins_100g       ?? 0,
        carbs_per_100g:   nutriments.carbohydrates_100g  ?? 0,
        fat_per_100g:     nutriments.fat_100g            ?? 0,
      });
    } catch {
      onProductNotFound(barcode);
    }
  }

  if (permission === null) {
    return <View style={{ flex: 1 }} />;
  }

  if (!permission.granted && permission.canAskAgain) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>Permitir acesso à câmera</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Permitir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
          <Text style={styles.secondaryButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission.granted && !permission.canAskAgain) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>Permissão negada. Habilite em Configurações.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={onCancel}>
          <Text style={styles.primaryButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={handleScan}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onCancel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Escanear código</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Centro */}
        <View style={styles.infoBox}>
          {status === 'scanning' ? (
            <Text style={styles.infoText}>Aponte para o código de barras</Text>
          ) : (
            <>
              <Text style={styles.infoText}>Buscando...</Text>
              <ActivityIndicator style={{ marginTop: 8 }} color="#222" />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 32,
    gap: 12,
  },
  permissionText: {
    fontSize: 16,
    color: '#222',
    textAlign: 'center',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#444',
    fontSize: 15,
  },

  // Camera overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    width: 60,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    marginHorizontal: 40,
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 15,
    color: '#222',
    textAlign: 'center',
  },
});
