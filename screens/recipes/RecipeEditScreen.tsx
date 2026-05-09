import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import PressableButton from '../../components/ui/PressableButton';

type Props = { session: Session; recipeId: string | null; onClose: () => void };

type RecipeItem = {
  localId: string;
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

function parseNum(val: string): number | null {
  const n = parseFloat(val.replace(',', '.'));
  return isNaN(n) ? null : n;
}

function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

export default function RecipeEditScreen({ session, recipeId, onClose }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const ss = useMemo(() => makeStyles(T), [T]);
  const [name, setName] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(recipeId !== null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingItem, setEditingItem] = useState<RecipeItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state for item modal
  const [formName, setFormName] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formCal, setFormCal] = useState('');
  const [formProtein, setFormProtein] = useState('');
  const [formCarbs, setFormCarbs] = useState('');
  const [formFat, setFormFat] = useState('');

  useEffect(() => {
    if (!recipeId) return;
    async function load() {
      const [{ data: recipe }, { data: itemRows }] = await Promise.all([
        supabase.from('recipes').select('name, is_favorite').eq('id', recipeId).maybeSingle(),
        supabase.from('recipe_items')
          .select('id, name, quantity_g, calories, protein_g, carbs_g, fat_g, position')
          .eq('recipe_id', recipeId)
          .order('position'),
      ]);
      if (recipe) {
        setName(recipe.name);
        setIsFavorite(recipe.is_favorite);
      }
      if (itemRows) {
        setItems(itemRows.map((r: any) => ({
          localId: r.id,
          name: r.name,
          quantity_g: Number(r.quantity_g),
          calories: Number(r.calories),
          protein_g: Number(r.protein_g),
          carbs_g: Number(r.carbs_g),
          fat_g: Number(r.fat_g),
        })));
      }
      setLoading(false);
    }
    load();
  }, [recipeId]);

  // Sync item modal form when editingItem opens
  useEffect(() => {
    if (editingItem) {
      setFormName(editingItem.name);
      setFormQty(editingItem.quantity_g > 0 ? String(editingItem.quantity_g) : '');
      setFormCal(editingItem.calories > 0 ? String(editingItem.calories) : '');
      setFormProtein(editingItem.protein_g > 0 ? String(editingItem.protein_g) : '');
      setFormCarbs(editingItem.carbs_g > 0 ? String(editingItem.carbs_g) : '');
      setFormFat(editingItem.fat_g > 0 ? String(editingItem.fat_g) : '');
    }
  }, [editingItem]);

  function openNewItem() {
    setEditingItem({
      localId: `temp-${Date.now()}`,
      name: '', quantity_g: 0, calories: 0,
      protein_g: 0, carbs_g: 0, fat_g: 0,
    });
  }

  function removeItem(localId: string) {
    setItems(prev => prev.filter(i => i.localId !== localId));
  }

  function saveItem() {
    if (!editingItem) return;
    const qNum = parseNum(formQty);
    if (!formName.trim() || !qNum || qNum <= 0) return;

    const newItem: RecipeItem = {
      localId: editingItem.localId,
      name: formName.trim(),
      quantity_g: qNum,
      calories: parseNum(formCal) ?? 0,
      protein_g: parseNum(formProtein) ?? 0,
      carbs_g: parseNum(formCarbs) ?? 0,
      fat_g: parseNum(formFat) ?? 0,
    };

    setItems(prev => {
      const idx = prev.findIndex(i => i.localId === editingItem.localId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newItem;
        return next;
      }
      return [...prev, newItem];
    });
    setEditingItem(null);
  }

  async function save() {
    if (!name.trim() || items.length === 0 || saving) return;
    setError(null);
    setSaving(true);
    try {
      let id = recipeId;
      if (id === null) {
        const { data, error: insErr } = await supabase
          .from('recipes')
          .insert({ user_id: session.user.id, name: name.trim(), is_favorite: isFavorite })
          .select('id')
          .single();
        if (insErr) throw insErr;
        id = data.id;
      } else {
        const { error: updErr } = await supabase
          .from('recipes')
          .update({ name: name.trim(), is_favorite: isFavorite, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (updErr) throw updErr;
        const { error: delErr } = await supabase.from('recipe_items').delete().eq('recipe_id', id);
        if (delErr) throw delErr;
      }
      const rows = items.map((it, idx) => ({
        recipe_id: id,
        name: it.name.trim(),
        quantity_g: round1(it.quantity_g),
        calories: round1(it.calories),
        protein_g: round1(it.protein_g),
        carbs_g: round1(it.carbs_g),
        fat_g: round1(it.fat_g),
        position: idx,
      }));
      const { error: bulkErr } = await supabase.from('recipe_items').insert(rows);
      if (bulkErr) throw bulkErr;
      onClose();
    } catch (e: any) {
      setError(e?.message ?? t('recipes.common.errorSave'));
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!recipeId) return;
    Alert.alert(
      t('recipes.edit.deleteTitle'),
      t('recipes.edit.deleteMessage'),
      [
        { text: t('recipes.common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error: delErr } = await supabase.from('recipes').delete().eq('id', recipeId);
            if (delErr) { setError(delErr.message); setDeleting(false); return; }
            onClose();
          },
        },
      ]
    );
  }

  const totalKcal = items.reduce((s, i) => s + i.calories, 0);
  const canSave = name.trim().length > 0 && items.length > 0 && !saving && !deleting;
  const itemFormValid = formName.trim().length > 0 && (parseNum(formQty) ?? 0) > 0;

  if (loading) {
    return (
      <View style={ss.centered}>
        <Text style={ss.bodyText}>{t('recipes.edit.loading')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={ss.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Header ── */}
      <View style={ss.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={ss.cancelBtn}>
          <Text style={ss.cancelText}>{t('recipes.common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={ss.headerTitle}>
          {recipeId ? t('recipes.edit.titleEdit') : t('recipes.edit.titleNew')}
        </Text>
        <View style={ss.headerRight} />
      </View>

      <ScrollView
        style={ss.scroll}
        contentContainerStyle={ss.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Nome ── */}
        <Text style={ss.fieldLabel}>{t('recipes.edit.nameLabel')}</Text>
        <TextInput
          style={ss.nameInput}
          value={name}
          onChangeText={setName}
          placeholder={t('recipes.edit.namePlaceholder')}
          placeholderTextColor={T.textFaint}
          autoCorrect={false}
        />

        {/* ── Favorita ── */}
        <TouchableOpacity
          style={ss.favoriteRow}
          onPress={() => setIsFavorite(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={ss.favoriteStar}>{isFavorite ? '⭐' : '☆'}</Text>
          <Text style={ss.favoriteLabel}>{t('recipes.edit.favorite')}</Text>
        </TouchableOpacity>

        <View style={ss.divider} />

        {/* ── Itens ── */}
        <View style={ss.itemsHeader}>
          <Text style={ss.sectionTitle}>{t('recipes.edit.itemsTitle')}</Text>
          <Text style={ss.itemsMeta}>
            {t('recipes.common.itemCount', { count: items.length })} · {Math.round(totalKcal)} kcal
          </Text>
        </View>

        {items.length === 0 ? (
          <Text style={ss.emptyText}>{t('recipes.edit.empty')}</Text>
        ) : (
          items.map(item => (
            <TouchableOpacity
              key={item.localId}
              style={ss.itemCard}
              onPress={() => setEditingItem(item)}
              activeOpacity={0.75}
            >
              <View style={ss.itemCardInner}>
                <View style={ss.itemCardInfo}>
                  <Text style={ss.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={ss.itemMeta}>
                    {item.quantity_g}g · {Math.round(item.calories)} kcal
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeItem(item.localId)}
                  hitSlop={10}
                  style={ss.removeBtn}
                >
                  <Text style={ss.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}

        <PressableButton style={ss.addItemBtn} onPress={openNewItem}>
          <Text style={ss.addItemBtnText}>{t('recipes.edit.addItem')}</Text>
        </PressableButton>

        {error != null && <Text style={ss.errorText}>{error}</Text>}

        {/* ── Salvar ── */}
        <PressableButton
          style={[ss.saveBtn, !canSave && ss.saveBtnDisabled]}
          onPress={save}
          disabled={!canSave}
        >
          <Text style={ss.saveBtnText}>
            {saving ? t('recipes.common.saving') : t('recipes.edit.save')}
          </Text>
        </PressableButton>

        {/* ── Apagar (só no modo edição) ── */}
        {recipeId !== null && (
          <PressableButton
            style={[ss.deleteBtn, deleting && ss.saveBtnDisabled]}
            onPress={handleDelete}
            disabled={deleting}
          >
            <Text style={ss.deleteBtnText}>
              {deleting ? t('recipes.common.deleting') : t('recipes.edit.delete')}
            </Text>
          </PressableButton>
        )}

      </ScrollView>

      {/* ── Modal de edição de item ── */}
      <Modal
        visible={editingItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingItem(null)}
      >
        <View style={ss.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={ss.modalKav}
          >
            <View style={ss.modalPanel}>
              <Text style={ss.modalTitle}>
                {editingItem && items.some(i => i.localId === editingItem.localId)
                  ? t('recipes.edit.item.titleEdit')
                  : t('recipes.edit.item.titleNew')}
              </Text>

              <Text style={ss.fieldLabel}>{t('recipes.edit.item.nameLabel')}</Text>
              <TextInput
                style={ss.input}
                value={formName}
                onChangeText={setFormName}
                placeholder={t('recipes.edit.item.namePlaceholder')}
                placeholderTextColor={T.textFaint}
                autoCorrect={false}
              />

              <View style={ss.inputRow}>
                <View style={ss.inputHalf}>
                  <Text style={ss.fieldLabel}>{t('recipes.edit.item.qtyLabel')}</Text>
                  <TextInput
                    style={ss.input}
                    value={formQty}
                    onChangeText={setFormQty}
                    placeholder="0"
                    placeholderTextColor={T.textFaint}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={ss.inputHalf}>
                  <Text style={ss.fieldLabel}>{t('recipes.edit.item.calLabel')}</Text>
                  <TextInput
                    style={ss.input}
                    value={formCal}
                    onChangeText={setFormCal}
                    placeholder="0"
                    placeholderTextColor={T.textFaint}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={ss.inputRow}>
                <View style={ss.inputThird}>
                  <Text style={ss.fieldLabel}>{t('recipes.edit.item.proteinLabel')}</Text>
                  <TextInput
                    style={ss.input}
                    value={formProtein}
                    onChangeText={setFormProtein}
                    placeholder="0"
                    placeholderTextColor={T.textFaint}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={ss.inputThird}>
                  <Text style={ss.fieldLabel}>{t('recipes.edit.item.carbsLabel')}</Text>
                  <TextInput
                    style={ss.input}
                    value={formCarbs}
                    onChangeText={setFormCarbs}
                    placeholder="0"
                    placeholderTextColor={T.textFaint}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={ss.inputThird}>
                  <Text style={ss.fieldLabel}>{t('recipes.edit.item.fatLabel')}</Text>
                  <TextInput
                    style={ss.input}
                    value={formFat}
                    onChangeText={setFormFat}
                    placeholder="0"
                    placeholderTextColor={T.textFaint}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={ss.modalActions}>
                <TouchableOpacity
                  style={ss.modalCancelBtn}
                  onPress={() => setEditingItem(null)}
                  activeOpacity={0.7}
                >
                  <Text style={ss.modalCancelText}>{t('recipes.common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ss.modalSaveBtn, !itemFormValid && ss.saveBtnDisabled]}
                  onPress={saveItem}
                  disabled={!itemFormValid}
                  activeOpacity={0.85}
                >
                  <Text style={ss.modalSaveText}>{t('recipes.edit.item.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function makeStyles(T: TokenSet) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bgBase,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.bgBase,
  },
  bodyText: {
    fontFamily: T.fontBody,
    fontSize: T.textBase,
    color: T.textSecondary,
  },

  // ── Header ──
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
  cancelBtn: {
    width: 80,
  },
  cancelText: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textSecondary,
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontFamily: T.fontDisplayItalic,
    fontSize: T.textLg,
    color: T.textPrimary,
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 80,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: T.sp5,
    paddingBottom: 60,
  },

  // ── Fields ──
  fieldLabel: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textTertiary,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: T.sp2,
    marginTop: T.sp4,
  },
  nameInput: {
    backgroundColor: T.surface1,
    borderWidth: 1,
    borderColor: T.borderSoft,
    color: T.textPrimary,
    fontFamily: T.fontBody,
    fontSize: T.textMd,
    padding: T.sp4,
  },
  input: {
    backgroundColor: T.surface1,
    borderWidth: 1,
    borderColor: T.borderSoft,
    color: T.textPrimary,
    fontFamily: T.fontMono,
    fontSize: T.textBase,
    padding: T.sp3,
  },
  inputRow: {
    flexDirection: 'row',
    gap: T.sp2,
  },
  inputHalf: {
    flex: 1,
  },
  inputThird: {
    flex: 1,
  },

  // ── Favorite ──
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sp3,
    marginTop: T.sp5,
    paddingVertical: T.sp3,
  },
  favoriteStar: {
    fontSize: 20,
  },
  favoriteLabel: {
    fontFamily: T.fontBody,
    fontSize: T.textBase,
    color: T.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: T.borderSoft,
    marginVertical: T.sp5,
  },

  // ── Items section ──
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: T.sp4,
  },
  sectionTitle: {
    fontFamily: T.fontDisplayItalic,
    fontSize: T.textXl,
    color: T.textPrimary,
    letterSpacing: -0.4,
  },
  itemsMeta: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textTertiary,
    letterSpacing: 1.2,
  },
  emptyText: {
    fontFamily: T.fontBody,
    fontSize: T.textBase,
    color: T.textTertiary,
    textAlign: 'center',
    marginVertical: T.sp5,
    lineHeight: T.textBase * 1.6,
  },
  itemCard: {
    backgroundColor: T.surface1,
    borderWidth: 1,
    borderColor: T.borderSoft,
    marginBottom: T.sp2,
  },
  itemCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: T.sp3,
    paddingHorizontal: T.sp4,
  },
  itemCardInfo: {
    flex: 1,
    marginRight: T.sp3,
  },
  itemName: {
    fontFamily: T.fontBodyMedium,
    fontSize: T.textBase,
    color: T.textPrimary,
    marginBottom: 2,
  },
  itemMeta: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textTertiary,
    letterSpacing: 1,
  },
  removeBtn: {
    padding: T.sp2,
  },
  removeBtnText: {
    fontFamily: T.fontMono,
    fontSize: T.textSm,
    color: T.textTertiary,
  },
  addItemBtn: {
    borderWidth: 1,
    borderColor: T.borderStrong,
    paddingVertical: T.sp3,
    alignItems: 'center',
    marginTop: T.sp3,
    marginBottom: T.sp6,
  },
  addItemBtnText: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textSecondary,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  errorText: {
    fontFamily: T.fontBody,
    fontSize: T.textSm,
    color: T.danger,
    textAlign: 'center',
    marginBottom: T.sp4,
  },
  saveBtn: {
    backgroundColor: T.accent,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: T.sp3,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: T.fontMonoMedium,
    fontSize: T.textXs,
    color: T.onAccent,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  deleteBtn: {
    backgroundColor: T.danger,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: T.sp3,
  },
  deleteBtnText: {
    fontFamily: T.fontMonoMedium,
    fontSize: T.textXs,
    color: T.textPrimary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalKav: {
    width: '100%',
  },
  modalPanel: {
    backgroundColor: T.surface2,
    borderTopWidth: 1,
    borderTopColor: T.borderSoft,
    padding: T.sp5,
    paddingBottom: 40,
  },
  modalTitle: {
    fontFamily: T.fontDisplayItalic,
    fontSize: T.textXl,
    color: T.textPrimary,
    letterSpacing: -0.4,
    marginBottom: T.sp3,
  },
  modalActions: {
    flexDirection: 'row',
    gap: T.sp3,
    marginTop: T.sp6,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: T.borderStrong,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textSecondary,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: T.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveText: {
    fontFamily: T.fontMonoMedium,
    fontSize: T.textXs,
    color: T.onAccent,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  });
}
