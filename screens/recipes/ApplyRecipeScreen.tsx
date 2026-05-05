import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';

type Props = {
  session: Session;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: string;
  onCancel: () => void;
  onApplied: () => void;
};

type RecipeRow = {
  id: string;
  name: string;
  is_favorite: boolean;
  total_kcal: number;
  item_count: number;
};

type RecipeItem = {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

export default function ApplyRecipeScreen({ session, mealType, date, onCancel, onApplied }: Props) {
  const { T } = useTheme();
  const ss = useMemo(() => makeStyles(T), [T]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [selected, setSelected] = useState<{ recipe: RecipeRow; items: RecipeItem[] } | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecipes = useCallback(async () => {
    setState('loading');

    const { data: recipeRows, error: recErr } = await supabase
      .from('recipes')
      .select('id, name, is_favorite')
      .eq('user_id', session.user.id)
      .order('is_favorite', { ascending: false })
      .order('name', { ascending: true });

    if (recErr) { setState('error'); return; }

    const rows = recipeRows ?? [];
    if (rows.length === 0) { setRecipes([]); setState('ready'); return; }

    const ids = rows.map(r => r.id);
    const { data: itemRows, error: itemErr } = await supabase
      .from('recipe_items')
      .select('recipe_id, calories')
      .in('recipe_id', ids);

    if (itemErr) { setState('error'); return; }

    const agg: Record<string, { total_kcal: number; item_count: number }> = {};
    for (const item of itemRows ?? []) {
      if (!agg[item.recipe_id]) agg[item.recipe_id] = { total_kcal: 0, item_count: 0 };
      agg[item.recipe_id].total_kcal += item.calories ?? 0;
      agg[item.recipe_id].item_count += 1;
    }

    setRecipes(rows.map(r => ({
      id: r.id,
      name: r.name,
      is_favorite: r.is_favorite,
      total_kcal: agg[r.id]?.total_kcal ?? 0,
      item_count: agg[r.id]?.item_count ?? 0,
    })));
    setState('ready');
  }, [session.user.id]);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  async function selectRecipe(recipe: RecipeRow) {
    setError(null);
    const { data, error: itemErr } = await supabase
      .from('recipe_items')
      .select('name, quantity_g, calories, protein_g, carbs_g, fat_g')
      .eq('recipe_id', recipe.id)
      .order('position');
    if (itemErr) { setError('Erro ao carregar itens da receita.'); return; }
    setSelected({
      recipe,
      items: (data ?? []).map((r: any) => ({
        name: r.name,
        quantity_g: Number(r.quantity_g),
        calories: Number(r.calories),
        protein_g: Number(r.protein_g),
        carbs_g: Number(r.carbs_g),
        fat_g: Number(r.fat_g),
      })),
    });
  }

  async function apply() {
    if (!selected || applying) return;
    setError(null);
    setApplying(true);
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

      const rows = selected.items.map(it => ({
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
      onApplied();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao aplicar receita');
      setApplying(false);
    }
  }

  // ── Modo confirmação ────────────────────────────────────────────────────────

  if (selected !== null) {
    const totalKcal = selected.items.reduce((s, i) => s + i.calories, 0);

    return (
      <View style={ss.root}>
        <View style={ss.header}>
          <TouchableOpacity onPress={() => setSelected(null)} hitSlop={12} style={ss.headerSide}>
            <Text style={ss.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={ss.headerTitle} numberOfLines={1}>{selected.recipe.name}</Text>
          <View style={ss.headerSide} />
        </View>

        <ScrollView
          style={ss.scroll}
          contentContainerStyle={ss.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={ss.confirmSubtitle}>
            Vou adicionar {selected.items.length} {selected.items.length === 1 ? 'item' : 'itens'} à sua refeição.{'\n'}
            Você pode editar individualmente depois.
          </Text>

          <Text style={ss.totalLine}>
            Total: <Text style={ss.totalAccent}>{Math.round(totalKcal)} kcal</Text>
          </Text>

          {selected.items.map((item, idx) => (
            <View key={idx} style={ss.previewCard}>
              <Text style={ss.previewName}>{item.name}</Text>
              <Text style={ss.previewMeta}>
                {item.quantity_g}g · {Math.round(item.calories)} kcal
              </Text>
              <Text style={ss.previewMacros}>
                {round1(item.protein_g)}p · {round1(item.carbs_g)}c · {round1(item.fat_g)}g
              </Text>
            </View>
          ))}

          {error != null && <Text style={ss.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[ss.applyBtn, applying && ss.applyBtnDisabled]}
            onPress={apply}
            disabled={applying}
            activeOpacity={0.85}
          >
            <Text style={ss.applyBtnText}>
              {applying ? 'Aplicando...' : 'Aplicar à refeição'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Modo lista ──────────────────────────────────────────────────────────────

  return (
    <View style={ss.root}>
      <View style={ss.header}>
        <TouchableOpacity onPress={onCancel} hitSlop={12} style={ss.headerSide}>
          <Text style={ss.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={ss.headerTitle}>Aplicar receita</Text>
        <View style={ss.headerSide} />
      </View>

      {state === 'loading' && (
        <View style={ss.centered}>
          <ActivityIndicator color={T.accent} />
        </View>
      )}

      {state === 'error' && (
        <View style={ss.centered}>
          <Text style={ss.bodyText}>Erro ao carregar receitas.</Text>
          <TouchableOpacity onPress={loadRecipes} style={ss.retryBtn}>
            <Text style={ss.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'ready' && recipes.length === 0 && (
        <View style={ss.centered}>
          <Text style={ss.emptyText}>
            Você ainda não criou nenhuma receita.{'\n'}
            Crie pelo HomeScreen → 📖 Receitas.
          </Text>
        </View>
      )}

      {state === 'ready' && recipes.length > 0 && (
        <FlatList
          data={recipes}
          keyExtractor={item => item.id}
          contentContainerStyle={ss.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={ss.card}
              onPress={() => selectRecipe(item)}
              activeOpacity={0.75}
            >
              <View style={ss.cardRow}>
                <Text style={ss.cardName} numberOfLines={1}>{item.name}</Text>
                {item.is_favorite && <Text style={ss.star}>⭐</Text>}
              </View>
              <Text style={ss.cardMeta}>
                {item.item_count} {item.item_count === 1 ? 'item' : 'itens'} · {Math.round(item.total_kcal)} kcal
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(T: TokenSet) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bgBase,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: T.sp5,
    paddingBottom: T.sp4,
    borderBottomWidth: 1,
    borderBottomColor: T.borderSoft,
  },
  headerSide: {
    width: 72,
  },
  headerTitle: {
    fontFamily: T.fontDisplayItalic,
    fontSize: T.textXl,
    color: T.textPrimary,
    letterSpacing: -0.5,
    flex: 1,
    textAlign: 'center',
  },
  backText: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textSecondary,
    letterSpacing: 1.2,
  },
  cancelText: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textSecondary,
    letterSpacing: 1.2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: T.sp6,
    gap: T.sp3,
  },
  bodyText: {
    fontFamily: T.fontBody,
    fontSize: T.textBase,
    color: T.textSecondary,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: T.fontBody,
    fontSize: T.textBase,
    color: T.textTertiary,
    textAlign: 'center',
    lineHeight: T.textBase * 1.65,
  },
  retryBtn: {
    paddingHorizontal: T.sp4,
    paddingVertical: T.sp2,
    borderWidth: 1,
    borderColor: T.borderStrong,
  },
  retryText: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textSecondary,
    letterSpacing: 1.2,
  },
  listContent: {
    padding: T.sp5,
  },
  card: {
    backgroundColor: T.surface1,
    borderWidth: 1,
    borderColor: T.borderSoft,
    padding: T.sp4,
    marginBottom: T.sp3,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sp2,
    marginBottom: T.sp1,
  },
  cardName: {
    fontFamily: T.fontBodySemiBold,
    fontSize: T.textMd,
    color: T.textPrimary,
    flex: 1,
  },
  star: {
    fontSize: 14,
  },
  cardMeta: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textTertiary,
    letterSpacing: 1.2,
  },

  // ── Confirmation mode ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: T.sp5,
    paddingBottom: 60,
  },
  confirmSubtitle: {
    fontFamily: T.fontBody,
    fontSize: T.textBase,
    color: T.textSecondary,
    lineHeight: T.textBase * 1.6,
    marginBottom: T.sp4,
  },
  totalLine: {
    fontFamily: T.fontMono,
    fontSize: T.textSm,
    color: T.textSecondary,
    letterSpacing: 0.8,
    marginBottom: T.sp5,
  },
  totalAccent: {
    color: T.accentText,
    fontFamily: T.fontMonoMedium,
  },
  previewCard: {
    borderWidth: 1,
    borderColor: T.borderSoft,
    backgroundColor: T.surface1,
    padding: T.sp4,
    marginBottom: T.sp2,
  },
  previewName: {
    fontFamily: T.fontBodyMedium,
    fontSize: T.textBase,
    color: T.textPrimary,
    marginBottom: 3,
  },
  previewMeta: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  previewMacros: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textTertiary,
    letterSpacing: 0.8,
  },
  errorText: {
    fontFamily: T.fontBody,
    fontSize: T.textSm,
    color: T.danger,
    textAlign: 'center',
    marginVertical: T.sp4,
  },
  applyBtn: {
    backgroundColor: T.accent,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: T.sp6,
  },
  applyBtnDisabled: {
    opacity: 0.4,
  },
  applyBtnText: {
    fontFamily: T.fontMonoMedium,
    fontSize: T.textXs,
    color: T.onAccent,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  });
}
