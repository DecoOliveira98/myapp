import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type EditingFood = {
  id: string;
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type Props = {
  session: Session;
  mealType: MealType;
  date: string;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  editingFood?: EditingFood;
};

type Mode = 'per100' | 'totals';

function parseNum(val: string): number | null {
  const n = parseFloat(val.replace(',', '.'));
  return isNaN(n) ? null : n;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export default function AddFoodScreen({
  session,
  mealType,
  date,
  onCancel,
  onSaved,
  onDeleted,
  editingFood,
}: Props) {
  const isEditing = editingFood !== undefined;

  const [mode, setMode] = useState<Mode>(isEditing ? 'totals' : 'per100');
  const [name, setName] = useState(isEditing ? editingFood!.name : '');
  const [quantity, setQuantity] = useState(isEditing ? String(editingFood!.quantity_g) : '');
  const [cal, setCal] = useState(isEditing ? String(editingFood!.calories) : '');
  const [protein, setProtein] = useState(isEditing ? String(editingFood!.protein_g) : '');
  const [carbs, setCarbs] = useState(isEditing ? String(editingFood!.carbs_g) : '');
  const [fat, setFat] = useState(isEditing ? String(editingFood!.fat_g) : '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setCal('');
    setProtein('');
    setCarbs('');
    setFat('');
    setMode(next);
  }

  const nameValid = name.trim().length > 0;
  const qNum = parseNum(quantity);
  const quantityValid = qNum !== null && qNum > 0;
  const calNum = parseNum(cal);
  const proteinNum = parseNum(protein);
  const carbsNum = parseNum(carbs);
  const fatNum = parseNum(fat);
  const nutrientsValid =
    calNum !== null && calNum >= 0 &&
    proteinNum !== null && proteinNum >= 0 &&
    carbsNum !== null && carbsNum >= 0 &&
    fatNum !== null && fatNum >= 0;
  const busy = saving || deleting;
  const canSave = nameValid && quantityValid && nutrientsValid && !busy;

  let preview: string | null = null;
  if (mode === 'per100' && quantityValid && nutrientsValid) {
    const q = qNum!;
    preview =
      `Total: ${round1((calNum! * q) / 100)} kcal · ` +
      `${round1((proteinNum! * q) / 100)}p · ` +
      `${round1((carbsNum! * q) / 100)}c · ` +
      `${round1((fatNum! * q) / 100)}g`;
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      const q = qNum!;

      if (isEditing) {
        const { error: updateErr } = await supabase
          .from('meal_foods')
          .update({
            name: name.trim(),
            quantity_g: q,
            calories: round1(calNum!),
            protein_g: round1(proteinNum!),
            carbs_g: round1(carbsNum!),
            fat_g: round1(fatNum!),
          })
          .eq('id', editingFood!.id);
        if (updateErr) throw updateErr;
        onSaved();
        return;
      }

      const { data: existingMeal, error: mealFetchErr } = await supabase
        .from('meals')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('date', date)
        .eq('meal_type', mealType)
        .maybeSingle();

      if (mealFetchErr) throw mealFetchErr;

      let mealId: string;
      if (existingMeal) {
        mealId = existingMeal.id;
      } else {
        const { data: newMeal, error: insertMealErr } = await supabase
          .from('meals')
          .insert({ user_id: session.user.id, date, meal_type: mealType })
          .select('id')
          .single();
        if (insertMealErr) throw insertMealErr;
        mealId = newMeal.id;
      }

      let finalCal: number, finalProtein: number, finalCarbs: number, finalFat: number;
      if (mode === 'per100') {
        finalCal = round1((calNum! * q) / 100);
        finalProtein = round1((proteinNum! * q) / 100);
        finalCarbs = round1((carbsNum! * q) / 100);
        finalFat = round1((fatNum! * q) / 100);
      } else {
        finalCal = round1(calNum!);
        finalProtein = round1(proteinNum!);
        finalCarbs = round1(carbsNum!);
        finalFat = round1(fatNum!);
      }

      const { error: foodErr } = await supabase.from('meal_foods').insert({
        meal_id: mealId,
        name: name.trim(),
        quantity_g: q,
        calories: finalCal,
        protein_g: finalProtein,
        carbs_g: finalCarbs,
        fat_g: finalFat,
      });
      if (foodErr) throw foodErr;

      onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar. Tente novamente.');
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      'Apagar item',
      'Tem certeza? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);
            const { error: deleteErr } = await supabase
              .from('meal_foods')
              .delete()
              .eq('id', editingFood!.id);
            if (deleteErr) {
              setError(deleteErr.message ?? 'Erro ao apagar. Tente novamente.');
              setDeleting(false);
            } else {
              onDeleted();
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Editar item' : 'Adicionar item'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!isEditing && (
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'per100' && styles.toggleBtnActive]}
              onPress={() => switchMode('per100')}
            >
              <Text style={[styles.toggleText, mode === 'per100' && styles.toggleTextActive]}>
                Por 100g
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'totals' && styles.toggleBtnActive]}
              onPress={() => switchMode('totals')}
            >
              <Text style={[styles.toggleText, mode === 'totals' && styles.toggleTextActive]}>
                Totais diretos
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>Nome do alimento</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex: Arroz branco"
          placeholderTextColor="#aaa"
          returnKeyType="next"
        />

        <Text style={styles.label}>Quantidade (g)</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder="Ex: 150"
          placeholderTextColor="#aaa"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>
          {mode === 'per100' ? 'Calorias / 100g' : 'Calorias (total)'}
        </Text>
        <TextInput
          style={styles.input}
          value={cal}
          onChangeText={setCal}
          placeholder="Ex: 130"
          placeholderTextColor="#aaa"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>
          {mode === 'per100' ? 'Proteína / 100g' : 'Proteína (g total)'}
        </Text>
        <TextInput
          style={styles.input}
          value={protein}
          onChangeText={setProtein}
          placeholder="Ex: 2,7"
          placeholderTextColor="#aaa"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>
          {mode === 'per100' ? 'Carbo / 100g' : 'Carbo (g total)'}
        </Text>
        <TextInput
          style={styles.input}
          value={carbs}
          onChangeText={setCarbs}
          placeholder="Ex: 28"
          placeholderTextColor="#aaa"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>
          {mode === 'per100' ? 'Gordura / 100g' : 'Gordura (g total)'}
        </Text>
        <TextInput
          style={styles.input}
          value={fat}
          onChangeText={setFat}
          placeholder="Ex: 0,3"
          placeholderTextColor="#aaa"
          keyboardType="decimal-pad"
        />

        {mode === 'per100' && (
          <View style={styles.preview}>
            <Text style={styles.previewText}>{preview ?? '—'}</Text>
          </View>
        )}

        {error !== null && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity
            style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={busy}
          >
            <Text style={styles.deleteBtnText}>{deleting ? 'Apagando...' : 'Apagar'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelText: {
    fontSize: 15,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  body: {
    padding: 20,
    paddingBottom: 48,
  },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#222',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
  },
  preview: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
  },
  previewText: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
  },
  errorText: {
    color: '#c0392b',
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },
  saveBtn: {
    marginTop: 28,
    backgroundColor: '#222',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#ccc',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  deleteBtn: {
    marginTop: 12,
    backgroundColor: '#c0392b',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  deleteBtnDisabled: {
    backgroundColor: '#ccc',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
