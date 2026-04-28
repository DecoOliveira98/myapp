import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import AddFoodScreen from './AddFoodScreen';
import BarcodeScanScreen, { PrefillData } from '../scanner/BarcodeScanScreen';

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
  | null;

type ScreenState = 'loading' | 'error' | 'ready';

export default function MealDetailScreen({ session, mealType, mealLabel, date, onClose }: Props) {
  const [state, setState] = useState<ScreenState>('loading');
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [formMode, setFormMode] = useState<FormMode>(null);

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

  if (formMode !== null) {
    const onFormDone = () => {
      setFormMode(null);
      loadFoods();
    };
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
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.addButton, styles.footerBtnFlex]}
            onPress={() => setFormMode({ kind: 'add' })}
          >
            <Text style={styles.addButtonText}>+ Adicionar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scanButton, styles.footerBtnFlex]}
            onPress={() => setFormMode({ kind: 'scan' })}
          >
            <Text style={styles.scanButtonText}>📷 Escanear</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  addButton: {
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  footerBtnFlex: {
    flex: 1,
  },
  scanButton: {
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#222',
  },
  scanButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
