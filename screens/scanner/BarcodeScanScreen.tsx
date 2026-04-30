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
import { T } from '../../theme/tokens';

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
        cal_per_100g: nutriments['energy-kcal_100g'],
        protein_per_100g: nutriments.proteins_100g ?? 0,
        carbs_per_100g: nutriments.carbohydrates_100g ?? 0,
        fat_per_100g: nutriments.fat_100g ?? 0,
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
              <ActivityIndicator style={{ marginTop: 8 }} color={T.accent} />
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
    backgroundColor: T.bgBase,
    padding: T.sp6,
    gap: T.sp3,
  },
  permissionText: {
    fontSize: T.textBase,
    color: T.textPrimary,
    textAlign: 'center',
    marginBottom: T.sp2,
    fontFamily: T.fontBody,
  },
  primaryButton: {
    backgroundColor: T.accent,
    borderWidth: 1,
    borderColor: T.accent,
    paddingVertical: 12,
    paddingHorizontal: T.sp6,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: T.bgBase,
    fontSize: T.textXs,
    fontFamily: T.fontMonoMedium,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: T.borderStrong,
    paddingVertical: 12,
    paddingHorizontal: T.sp6,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: T.textSecondary,
    fontSize: T.textXs,
    fontFamily: T.fontMono,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
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
    paddingHorizontal: T.sp5,
    paddingTop: 56,
    paddingBottom: T.sp3,
  },
  cancelText: {
    color: T.textPrimary,
    fontSize: T.textSm,
    fontFamily: T.fontMono,
    letterSpacing: 1.2,
    width: 70,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: T.textPrimary,
    fontSize: T.textSm,
    fontFamily: T.fontMonoMedium,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  infoBox: {
    marginHorizontal: 40,
    backgroundColor: 'rgba(14,14,16,0.92)',
    borderWidth: 1,
    borderColor: T.borderSoft,
    padding: T.sp4,
    alignItems: 'center',
  },
  infoText: {
    fontSize: T.textSm,
    color: T.textPrimary,
    textAlign: 'center',
    fontFamily: T.fontBody,
  },
});
