import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import RecipeEditScreen from './RecipeEditScreen';

type Props = { session: Session; onClose: () => void };

type RecipeRow = {
  id: string;
  name: string;
  is_favorite: boolean;
  total_kcal: number;
  item_count: number;
};

export default function RecipesListScreen({ session, onClose }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const ss = useMemo(() => makeStyles(T), [T]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [editing, setEditing] = useState<{ recipeId: string | null } | null>(null);

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

  async function toggleFavorite(item: RecipeRow) {
    await supabase
      .from('recipes')
      .update({ is_favorite: !item.is_favorite, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    loadRecipes();
  }

  if (editing !== null) {
    return (
      <RecipeEditScreen
        session={session}
        recipeId={editing.recipeId}
        onClose={() => { setEditing(null); loadRecipes(); }}
      />
    );
  }

  return (
    <View style={ss.root}>

      {/* ── Header ── */}
      <View style={ss.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={ss.backBtn}>
          <Text style={ss.backText}>{t('recipes.common.back')}</Text>
        </TouchableOpacity>
        <Text style={ss.headerTitle}>{t('recipes.list.title')}</Text>
        <View style={ss.headerRight} />
      </View>

      {/* ── Content ── */}
      {state === 'loading' && (
        <View style={ss.centered}>
          <ActivityIndicator color={T.accent} />
        </View>
      )}

      {state === 'error' && (
        <View style={ss.centered}>
          <Text style={ss.errorText}>{t('recipes.common.error')}</Text>
          <TouchableOpacity onPress={loadRecipes} style={ss.retryBtn}>
            <Text style={ss.retryText}>{t('recipes.common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'ready' && (
        <FlatList
          data={recipes}
          keyExtractor={item => item.id}
          style={ss.list}
          contentContainerStyle={ss.listContent}
          ListEmptyComponent={
            <View style={ss.emptyState}>
              <Text style={ss.emptyText}>{t('recipes.list.empty')}</Text>
              <Text style={ss.emptyText}>{t('recipes.list.emptyCreate')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={ss.card}
              onPress={() => setEditing({ recipeId: item.id })}
              activeOpacity={0.75}
            >
              <View style={ss.cardRow}>
                <Text style={ss.cardName} numberOfLines={1}>{item.name}</Text>
                <TouchableOpacity
                  onPress={() => toggleFavorite(item)}
                  hitSlop={10}
                  style={ss.starBtn}
                >
                  <Text style={ss.star}>{item.is_favorite ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={ss.cardMeta}>
                {t('recipes.common.itemCount', { count: item.item_count })} · {Math.round(item.total_kcal)} kcal
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Fixed bottom button ── */}
      <TouchableOpacity
        style={ss.newBtn}
        onPress={() => setEditing({ recipeId: null })}
        activeOpacity={0.85}
      >
        <Text style={ss.newBtnText}>{t('recipes.list.newRecipe')}</Text>
      </TouchableOpacity>

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
  backBtn: {
    width: 80,
  },
  backText: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textSecondary,
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontFamily: T.fontDisplayItalic,
    fontSize: T.textXl,
    color: T.textPrimary,
    letterSpacing: -0.5,
  },
  headerRight: {
    width: 80,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: T.sp3,
  },
  errorText: {
    fontFamily: T.fontBody,
    fontSize: T.textBase,
    color: T.textSecondary,
    textAlign: 'center',
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
  list: {
    flex: 1,
  },
  listContent: {
    padding: T.sp5,
    paddingBottom: T.sp3,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
    gap: T.sp2,
  },
  emptyText: {
    fontFamily: T.fontBody,
    fontSize: T.textBase,
    color: T.textTertiary,
    textAlign: 'center',
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
    justifyContent: 'space-between',
    marginBottom: T.sp1,
  },
  cardName: {
    fontFamily: T.fontBodySemiBold,
    fontSize: T.textMd,
    color: T.textPrimary,
    flex: 1,
    marginRight: T.sp3,
  },
  starBtn: {
    padding: T.sp1,
  },
  star: {
    fontSize: 18,
  },
  cardMeta: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textTertiary,
    letterSpacing: 1.2,
  },
  newBtn: {
    backgroundColor: T.accent,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: T.sp5,
    marginBottom: T.sp6,
    marginTop: T.sp3,
  },
  newBtnText: {
    fontFamily: T.fontMonoMedium,
    fontSize: T.textXs,
    color: T.onAccent,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  });
}
