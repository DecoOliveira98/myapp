import { useCallback, useEffect, useMemo, useState } from 'react';
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
import VoiceMealScreen from './VoiceMealScreen';
import ApplyRecipeScreen from '../recipes/ApplyRecipeScreen';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import PressableButton from '../../components/ui/PressableButton';

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
  | { kind: 'voice' }
  | { kind: 'apply_recipe' }
  | null;

type ScreenState = 'loading' | 'error' | 'ready';

export default function MealDetailScreen({ session, mealType, mealLabel, date, onClose }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
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
          setFormMode({ kind: 'add', infoMessage: t('meals.add.productNotFound', { barcode }) })
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

  if (formMode?.kind === 'voice') {
    return (
      <VoiceMealScreen
        session={session}
        mealType={mealType}
        date={date}
        onCancel={() => setFormMode(null)}
        onSaved={onFormDone}
      />
    );
  }

  if (formMode?.kind === 'apply_recipe') {
    return (
      <ApplyRecipeScreen
        session={session}
        mealType={mealType}
        date={date}
        onCancel={() => setFormMode(null)}
        onApplied={onFormDone}
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
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.secondaryText}>{t('meals.detail.error')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Text style={styles.backText}>{t('meals.common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{mealLabel}</Text>
      </View>

      <FlatList
        data={foods}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('meals.detail.empty')}</Text>
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
        <PressableButton
          style={styles.registerButton}
          onPress={() => setMenuOpen(true)}
        >
          <Text style={styles.registerButtonText}>{t('meals.detail.register')}</Text>
        </PressableButton>
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
            <Text style={styles.sheetTitle}>{t('meals.detail.howToRegister')}</Text>

            <PressableButton
              style={styles.sheetOption}
              onPress={() => { setMenuOpen(false); setFormMode({ kind: 'add' }); }}
            >
              <Text style={styles.sheetOptionLabel}>{t('meals.detail.manual')}</Text>
              <Text style={styles.sheetOptionDesc}>{t('meals.detail.manualDesc')}</Text>
            </PressableButton>

            <PressableButton
              style={styles.sheetOption}
              onPress={() => { setMenuOpen(false); setFormMode({ kind: 'scan' }); }}
            >
              <Text style={styles.sheetOptionLabel}>{t('meals.detail.scan')}</Text>
              <Text style={styles.sheetOptionDesc}>{t('meals.detail.scanDesc')}</Text>
            </PressableButton>

            <PressableButton
              style={styles.sheetOption}
              onPress={() => { setMenuOpen(false); setFormMode({ kind: 'photo' }); }}
            >
              <Text style={styles.sheetOptionLabel}>{t('meals.detail.photo')}</Text>
              <Text style={styles.sheetOptionDesc}>{t('meals.detail.photoDesc')}</Text>
            </PressableButton>

            <PressableButton
              style={styles.sheetOption}
              onPress={() => { setMenuOpen(false); setFormMode({ kind: 'describe' }); }}
            >
              <Text style={styles.sheetOptionLabel}>{t('meals.detail.describe')}</Text>
              <Text style={styles.sheetOptionDesc}>{t('meals.detail.describeDesc')}</Text>
            </PressableButton>

            <PressableButton
              style={styles.sheetOption}
              onPress={() => { setMenuOpen(false); setFormMode({ kind: 'voice' }); }}
            >
              <Text style={styles.sheetOptionLabel}>{t('meals.detail.voice')}</Text>
              <Text style={styles.sheetOptionDesc}>{t('meals.detail.voiceDesc')}</Text>
            </PressableButton>

            <PressableButton
              style={styles.sheetOption}
              onPress={() => { setMenuOpen(false); setFormMode({ kind: 'apply_recipe' }); }}
            >
              <Text style={styles.sheetOptionLabel}>{t('meals.detail.fromRecipe')}</Text>
              <Text style={styles.sheetOptionDesc}>{t('meals.detail.fromRecipeDesc')}</Text>
            </PressableButton>

            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setMenuOpen(false)}
            >
              <Text style={styles.sheetCancelText}>{t('meals.common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function makeStyles(T: TokenSet) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.bgBase,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.bgBase,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: T.sp5,
    paddingBottom: T.sp4,
    borderBottomWidth: 1,
    borderBottomColor: T.borderSoft,
  },
  backText: {
    fontSize: T.textXs,
    color: T.textSecondary,
    marginBottom: T.sp2,
    fontFamily: T.fontMono,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: T.textXl,
    color: T.textPrimary,
    fontFamily: T.fontDisplay,
    letterSpacing: -0.5,
  },
  listContent: {
    padding: T.sp5,
    paddingBottom: 0,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: T.sp7,
  },
  emptyText: {
    fontSize: T.textBase,
    color: T.textSecondary,
    fontFamily: T.fontBody,
  },
  secondaryText: {
    fontSize: T.textBase,
    color: T.textSecondary,
    fontFamily: T.fontBody,
  },
  foodCard: {
    borderWidth: 1,
    borderColor: T.borderSoft,
    padding: T.sp4,
    marginBottom: T.sp3,
    backgroundColor: T.surface1,
  },
  foodName: {
    fontSize: T.textBase,
    color: T.textPrimary,
    fontFamily: T.fontBodySemiBold,
  },
  foodMeta: {
    fontSize: T.textSm,
    color: T.textSecondary,
    marginTop: 2,
    fontFamily: T.fontBody,
  },
  footer: {
    padding: T.sp5,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: T.borderSoft,
  },
  registerButton: {
    backgroundColor: T.accent,
    borderWidth: 1,
    borderColor: T.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  registerButtonText: {
    fontSize: T.textXs,
    color: T.bgBase,
    fontFamily: T.fontMonoMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.bgWarm,
    borderTopWidth: 1,
    borderTopColor: T.borderSoft,
    padding: T.sp5,
    paddingBottom: 36,
  },
  sheetTitle: {
    fontSize: T.textXs,
    color: T.textTertiary,
    textAlign: 'center',
    marginBottom: T.sp4,
    fontFamily: T.fontMono,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sheetOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.borderSoft,
  },
  sheetOptionLabel: {
    fontSize: T.textBase,
    color: T.textPrimary,
    fontFamily: T.fontBodySemiBold,
  },
  sheetOptionDesc: {
    fontSize: T.textSm,
    color: T.textSecondary,
    marginTop: 2,
    fontFamily: T.fontBody,
  },
  sheetCancel: {
    marginTop: T.sp4,
    paddingVertical: T.sp3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.borderStrong,
  },
  sheetCancelText: {
    fontSize: T.textXs,
    color: T.textSecondary,
    fontFamily: T.fontMono,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  });
}
