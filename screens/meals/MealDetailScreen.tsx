import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import AddFoodScreen from './AddFoodScreen';
import BarcodeScanScreen, { PrefillData } from '../scanner/BarcodeScanScreen';
import DescribeMealScreen from './DescribeMealScreen';
import PhotoMealScreen from './PhotoMealScreen';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type Props = {
  session: Session;
  mealType: MealType;
  mealLabel: string;
  date: string;
  onClose: () => void;
};

type FoodItem = {
  id: string;
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type FormMode =
  | { kind: 'add'; prefill?: PrefillData; infoMessage?: string }
  | { kind: 'edit'; food: FoodItem }
  | { kind: 'scan' }
  | { kind: 'describe' }
  | { kind: 'photo' }
  | null;

type ScreenState = 'loading' | 'error' | 'ready';

export default function MealDetailScreen({ session, mealType, mealLabel, date, onClose }: Props) {
  const [state, setState] = useState<ScreenState>('loading');
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadFoods = useCallback(async () => {
    setState('loading');

    const { data: mealData, error: mealError } = await supabase
      .from('meals')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('date', date)
      .eq('meal_type', mealType)
      .maybeSingle();

    if (mealError) {
      setState('error');
      return;
    }

    if (!mealData) {
      setFoods([]);
      setState('ready');
      return;
    }

    const { data: foodData, error: foodError } = await supabase
      .from('meal_foods')
      .select('id, name, quantity_g, calories, protein_g, carbs_g, fat_g')
      .eq('meal_id', mealData.id)
      .order('created_at');

    if (foodError) {
      setState('error');
      return;
    }

    setFoods(foodData as FoodItem[]);
    setState('ready');
  }, [session.user.id, date, mealType]);

  useEffect(() => {
    loadFoods();
  }, [loadFoods]);

  const onFormDone = () => {
    setFormMode(null);
    loadFoods();
  };

  if (formMode?.kind === 'scan') {
    return (
      <BarcodeScanScreen
        onCancel={() => setFormMode(null)}
        onProductFound={(data) => setFormMode({ kind: 'add', prefill: data })}
        onProductNotFound={(barcode) =>
          setFormMode({ kind: 'add', infoMessage: `Produto ${barcode} não encontrado. Adicione manualmente.` })
        }
      />
    );
  }

  if (formMode?.kind === 'describe') {
    return (
      <DescribeMealScreen
        session={session}
        mealType={mealType}
        date={date}
        onCancel={() => setFormMode(null)}
        onSaved={onFormDone}
      />
    );
  }

  if (formMode?.kind === 'photo') {
    return (
      <PhotoMealScreen
        session={session}
        mealType={mealType}
        date={date}
        onCancel={() => setFormMode(null)}
        onSaved={onFormDone}
      />
    );
  }

  if (formMode !== null) {
    return (
      <AddFoodScreen
        session={session}
        mealType={mealType}
        date={date}
        editingFood={formMode.kind === 'edit' ? formMode.food : undefined}
        prefill={formMode.kind === 'add' ? formMode.prefill : undefined}
        infoMessage={formMode.kind === 'add' ? formMode.infoMessage : undefined}
        onCancel={() => setFormMode(null)}
        onSaved={onFormDone}
        onDeleted={onFormDone}
      />
    );
  }

  if (state === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#222" />
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.secondaryText}>Erro ao carregar</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{mealLabel}</Text>
      </View>

      <FlatList
        data={foods}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum item ainda</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setFormMode({ kind: 'edit', food: item })}>
            <View style={styles.foodCard}>
              <Text style={styles.foodName}>{item.name}</Text>
              <Text style={styles.foodMeta}>
                {item.quantity_g}g · {item.calories} kcal
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => setMenuOpen(true)}
        >
          <Text style={styles.registerButtonText}>Registrar</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        >
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle}>Como registrar?</Text>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => { setMenuOpen(false); setFormMode({ kind: 'add' }); }}
            >
              <Text style={styles.sheetOptionLabel}>+ Manual</Text>
              <Text style={styles.sheetOptionDesc}>Digite os nutrientes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => { setMenuOpen(false); setFormMode({ kind: 'scan' }); }}
            >
              <Text style={styles.sheetOptionLabel}>📷 Escanear código</Text>
              <Text style={styles.sheetOptionDesc}>Lê o barcode e busca os nutrientes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => { setMenuOpen(false); setFormMode({ kind: 'photo' }); }}
            >
              <Text style={styles.sheetOptionLabel}>📸 Foto</Text>
              <Text style={styles.sheetOptionDesc}>Tire ou escolha foto, IA estima</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => { setMenuOpen(false); setFormMode({ kind: 'describe' }); }}
            >
              <Text style={styles.sheetOptionLabel}>✨ Descrever</Text>
              <Text style={styles.sheetOptionDesc}>Escreva o que comeu, IA estrutura</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setMenuOpen(false)}
            >
              <Text style={styles.sheetCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
  },
  listContent: {
    padding: 20,
    paddingBottom: 0,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
  },
  secondaryText: {
    fontSize: 15,
    color: '#666',
  },
  foodCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  foodName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  foodMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  footer: {
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  registerButton: {
    backgroundColor: '#222',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  registerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  sheetOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sheetOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  sheetOptionDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  sheetCancel: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: 15,
    color: '#666',
  },
});
