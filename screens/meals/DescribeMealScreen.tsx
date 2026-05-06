import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type Props = {
  session: Session;
  mealType: MealType;
  date: string;
  onCancel: () => void;
  onSaved: () => void;
};

type ParsedItem = {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: 'high' | 'medium' | 'low';
};

function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

export default function DescribeMealScreen({ session, mealType, date, onCancel, onSaved }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ParsedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    setError(null);
    setParsing(true);

    const { data, error: invokeErr } = await supabase.functions.invoke('structure-meal', {
      body: { text: text.trim() },
    });

    if (invokeErr) {
      setError(t('meals.common.errorConnection'));
      setParsing(false);
      return;
    }
    if ((data as any).error) {
      setError(t('meals.describe.errorAI'));
      setParsing(false);
      return;
    }
    const parsed = (data as any).items as ParsedItem[];
    if (!parsed || parsed.length === 0) {
      setError(t('meals.common.errorNoFood'));
      setParsing(false);
      return;
    }

    setItems(parsed);
    setParsing(false);
  }

  async function handleSave() {
    if (!items) return;
    setError(null);
    setSaving(true);

    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('meals')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('date', date)
        .eq('meal_type', mealType)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      let mealId: string;
      if (existing) {
        mealId = existing.id;
      } else {
        const { data: newMeal, error: insErr } = await supabase
          .from('meals')
          .insert({ user_id: session.user.id, date, meal_type: mealType })
          .select('id')
          .single();
        if (insErr) throw insErr;
        mealId = newMeal.id;
      }

      const rows = items.map(it => ({
        meal_id: mealId,
        name: it.name,
        quantity_g: round1(it.quantity_g),
        calories: round1(it.calories),
        protein_g: round1(it.protein_g),
        carbs_g: round1(it.carbs_g),
        fat_g: round1(it.fat_g),
      }));

      const { error: bulkErr } = await supabase.from('meal_foods').insert(rows);
      if (bulkErr) throw bulkErr;

      onSaved();
    } catch (e: any) {
      setError(e?.message ?? t('meals.common.errorSave'));
      setSaving(false);
    }
  }

  // ── Modo preview ────────────────────────────────────────────────────────
  if (items !== null) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setItems(null)} hitSlop={8}>
            <Text style={styles.cancelText}>{t('meals.common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('meals.common.confirmTitle')}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>
            {t('meals.common.confirmSubtitle', { count: items.length })}
          </Text>

          {items.map((item, i) => (
            <View key={i} style={styles.itemCard}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>{item.quantity_g}g · {item.calories} kcal</Text>
              <Text style={styles.itemMacros}>{item.protein_g}p · {item.carbs_g}c · {item.fat_g}g</Text>
              {item.confidence === 'low' && (
                <Text style={styles.lowConfidence}>{t('meals.common.lowConfidence')}</Text>
              )}
            </View>
          ))}

          {error !== null && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? t('meals.common.saving') : t('meals.common.saveAll')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Modo input ──────────────────────────────────────────────────────────
  const canParse = text.trim().length > 0 && !parsing;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancelText}>{t('meals.common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('meals.describe.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t('meals.describe.subtitle')}</Text>

        <TextInput
          style={styles.textArea}
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={6}
          placeholder={t('meals.describe.placeholder')}
          placeholderTextColor={T.textTertiary}
          autoFocus
          textAlignVertical="top"
        />

        {error !== null && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.saveBtn, !canParse && styles.saveBtnDisabled]}
          onPress={handleParse}
          disabled={!canParse}
        >
          <Text style={styles.saveBtnText}>{parsing ? t('meals.common.structuring') : t('meals.common.structureAI')}</Text>
        </TouchableOpacity>
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
  subtitle: {
    fontSize: T.textSm,
    color: T.textSecondary,
    marginBottom: T.sp4,
    lineHeight: 20,
    fontFamily: T.fontBody,
  },
  textArea: {
    borderWidth: 1,
    borderColor: T.borderSoft,
    padding: T.sp4,
    backgroundColor: T.surface1,
    fontSize: T.textBase,
    color: T.textPrimary,
    minHeight: 120,
    fontFamily: T.fontBody,
  },
  errorText: {
    color: T.danger,
    fontSize: T.textXs,
    marginTop: T.sp3,
    textAlign: 'center',
    fontFamily: T.fontBody,
  },
  saveBtn: {
    marginTop: T.sp5,
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
  itemCard: {
    borderWidth: 1,
    borderColor: T.borderSoft,
    padding: T.sp4,
    marginBottom: T.sp3,
    backgroundColor: T.surface1,
  },
  itemName: {
    fontSize: T.textBase,
    color: T.textPrimary,
    fontFamily: T.fontBodySemiBold,
  },
  itemMeta: {
    fontSize: T.textSm,
    color: T.textSecondary,
    marginTop: T.sp1,
    fontFamily: T.fontBody,
  },
  itemMacros: {
    fontSize: T.textXs,
    color: T.textTertiary,
    marginTop: 2,
    fontFamily: T.fontMono,
    letterSpacing: 1,
  },
  lowConfidence: {
    fontSize: T.textXs,
    color: T.accentSoft,
    marginTop: T.sp2,
    fontFamily: T.fontBody,
  },
  });
}
