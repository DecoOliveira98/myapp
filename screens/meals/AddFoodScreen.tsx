import { useMemo, useState } from 'react';
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
import { PrefillData } from '../scanner/BarcodeScanScreen';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';

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
  prefill?: PrefillData;
  infoMessage?: string;
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
  prefill,
  infoMessage,
}: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const isEditing = editingFood !== undefined;

  const [mode, setMode] = useState<Mode>(() => {
    if (isEditing) return 'totals';
    if (prefill) return 'per100';
    return 'per100';
  });
  const [name, setName] = useState(() => {
    if (isEditing) return editingFood!.name;
    if (prefill) return prefill.name;
    return '';
  });
  const [quantity, setQuantity] = useState(() => {
    if (isEditing) return String(editingFood!.quantity_g);
    if (prefill) return '100';
    return '';
  });
  const [cal, setCal] = useState(() => {
    if (isEditing) return String(editingFood!.calories);
    if (prefill) return String(prefill.cal_per_100g);
    return '';
  });
  const [protein, setProtein] = useState(() => {
    if (isEditing) return String(editingFood!.protein_g);
    if (prefill) return String(prefill.protein_per_100g);
    return '';
  });
  const [carbs, setCarbs] = useState(() => {
    if (isEditing) return String(editingFood!.carbs_g);
    if (prefill) return String(prefill.carbs_per_100g);
    return '';
  });
  const [fat, setFat] = useState(() => {
    if (isEditing) return String(editingFood!.fat_g);
    if (prefill) return String(prefill.fat_per_100g);
    return '';
  });
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
      setError(e?.message ?? t('meals.common.errorSaveFallback'));
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      t('meals.add.deleteTitle'),
      t('meals.add.deleteMessage'),
      [
        { text: t('meals.common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);
            const { error: deleteErr } = await supabase
              .from('meal_foods')
              .delete()
              .eq('id', editingFood!.id);
            if (deleteErr) {
              setError(deleteErr.message ?? t('meals.add.errorDelete'));
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
          <Text style={styles.cancelText}>{t('meals.common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? t('meals.add.titleEdit') : t('meals.add.titleNew')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {infoMessage && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{infoMessage}</Text>
          </View>
        )}

        {!isEditing && (
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'per100' && styles.toggleBtnActive]}
              onPress={() => switchMode('per100')}
            >
              <Text style={[styles.toggleText, mode === 'per100' && styles.toggleTextActive]}>
                {t('meals.add.modePer100')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'totals' && styles.toggleBtnActive]}
              onPress={() => switchMode('totals')}
            >
              <Text style={[styles.toggleText, mode === 'totals' && styles.toggleTextActive]}>
                {t('meals.add.modeTotals')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>{t('meals.add.nameLabel')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('meals.add.namePlaceholder')}
          placeholderTextColor={T.textTertiary}
          returnKeyType="next"
        />

        <Text style={styles.label}>{t('meals.add.quantityLabel')}</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder={t('meals.add.quantityPlaceholder')}
          placeholderTextColor={T.textTertiary}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>
          {mode === 'per100' ? t('meals.add.calPer100') : t('meals.add.calTotal')}
        </Text>
        <TextInput
          style={styles.input}
          value={cal}
          onChangeText={setCal}
          placeholder="0"
          placeholderTextColor={T.textTertiary}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>
          {mode === 'per100' ? t('meals.add.proteinPer100') : t('meals.add.proteinTotal')}
        </Text>
        <TextInput
          style={styles.input}
          value={protein}
          onChangeText={setProtein}
          placeholder="0"
          placeholderTextColor={T.textTertiary}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>
          {mode === 'per100' ? t('meals.add.carbsPer100') : t('meals.add.carbsTotal')}
        </Text>
        <TextInput
          style={styles.input}
          value={carbs}
          onChangeText={setCarbs}
          placeholder="0"
          placeholderTextColor={T.textTertiary}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>
          {mode === 'per100' ? t('meals.add.fatPer100') : t('meals.add.fatTotal')}
        </Text>
        <TextInput
          style={styles.input}
          value={fat}
          onChangeText={setFat}
          placeholder="Ex: 0,3"
          placeholderTextColor={T.textTertiary}
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
          <Text style={styles.saveBtnText}>{saving ? t('meals.common.saving') : t('meals.add.save')}</Text>
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity
            style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={busy}
          >
            <Text style={styles.deleteBtnText}>{deleting ? t('recipes.common.deleting') : t('common.delete')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(T: TokenSet) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.bgBase,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: T.sp5,
    paddingBottom: T.sp4,
    borderBottomWidth: 1,
    borderBottomColor: T.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sp3,
  },
  cancelText: {
    fontSize: T.textSm,
    color: T.textSecondary,
    fontFamily: T.fontMono,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: T.textMd,
    color: T.textPrimary,
    fontFamily: T.fontDisplay,
    letterSpacing: -0.2,
  },
  body: {
    padding: T.sp5,
    paddingBottom: T.sp8,
  },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: T.borderSoft,
    overflow: 'hidden',
    marginBottom: T.sp5,
    backgroundColor: T.surface1,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: T.sp3,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: T.accent,
  },
  toggleText: {
    fontSize: T.textXs,
    color: T.textSecondary,
    fontFamily: T.fontMono,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  toggleTextActive: {
    color: T.bgBase,
    fontFamily: T.fontMonoMedium,
  },
  label: {
    fontSize: T.textXs,
    color: T.textTertiary,
    marginBottom: T.sp2,
    marginTop: T.sp4,
    fontFamily: T.fontMono,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: T.borderSoft,
    backgroundColor: T.surface1,
    paddingHorizontal: T.sp4,
    paddingVertical: T.sp3,
    fontSize: T.textBase,
    color: T.textPrimary,
    fontFamily: T.fontBody,
  },
  preview: {
    marginTop: T.sp4,
    padding: T.sp4,
    borderWidth: 1,
    borderColor: T.accentLine,
    backgroundColor: T.accentBg,
  },
  previewText: {
    fontSize: T.textSm,
    color: T.textSecondary,
    textAlign: 'center',
    fontFamily: T.fontMono,
  },
  errorText: {
    color: T.danger,
    fontSize: T.textXs,
    marginTop: T.sp4,
    textAlign: 'center',
    fontFamily: T.fontBody,
  },
  saveBtn: {
    marginTop: T.sp6,
    backgroundColor: T.accent,
    borderWidth: 1,
    borderColor: T.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: T.surface3,
    borderColor: T.surface3,
  },
  saveBtnText: {
    fontSize: T.textXs,
    color: T.bgBase,
    fontFamily: T.fontMonoMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  deleteBtn: {
    marginTop: T.sp3,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: T.danger,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnDisabled: {
    opacity: 0.45,
  },
  deleteBtnText: {
    fontSize: T.textXs,
    color: T.danger,
    fontFamily: T.fontMonoMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  infoBox: {
    padding: T.sp3,
    backgroundColor: T.surface1,
    borderWidth: 1,
    borderColor: T.borderSoft,
    marginBottom: T.sp4,
  },
  infoText: {
    fontSize: T.textSm,
    color: T.textSecondary,
    fontFamily: T.fontBody,
  },
  });
}
