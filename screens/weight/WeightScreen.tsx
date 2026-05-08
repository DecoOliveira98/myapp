import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import PressableButton from '../../components/ui/PressableButton';

type Props = { session: Session; onClose: () => void };

type WeightEntry = { id: string; date: string; weight_kg: number };

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]}`;
}

export default function WeightScreen({ session, onClose }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [weight, setWeight] = useState('');
  const [editing, setEditing] = useState<{ id: string; date: string } | null>(null);
  const [list, setList] = useState<WeightEntry[]>([]);
  const [chartData, setChartData] = useState<Array<{ date: string; weight: number }>>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setState('loading');
    const { data, error } = await supabase
      .from('weight_log')
      .select('id, date, weight_kg')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false })
      .limit(30);

    if (error) {
      setState('error');
      return;
    }
    setList(data ?? []);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const thirtyAgoIso = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;

    const { data: chartRows, error: chartErr } = await supabase
      .from('weight_log')
      .select('date, weight_kg')
      .eq('user_id', session.user.id)
      .gte('date', thirtyAgoIso)
      .order('date', { ascending: true });

    if (!chartErr && chartRows) {
      setChartData(chartRows.map(r => ({ date: r.date, weight: Number(r.weight_kg) })));
    }

    setState('ready');
  }, [session.user.id]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function handleSave() {
    const parsed = parseFloat(weight.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) return;

    setSaving(true);
    setSaveError(null);

    try {
      if (editing) {
        const { error } = await supabase
          .from('weight_log')
          .update({ weight_kg: parsed, updated_at: new Date().toISOString() })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const todayISO = isoToday();
        const { error } = await supabase
          .from('weight_log')
          .upsert(
            { user_id: session.user.id, date: todayISO, weight_kg: parsed, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,date' },
          );
        if (error) throw error;
      }

      setEditing(null);
      setWeight('');
      setSaving(false);
      void loadList();
    } catch (e: any) {
      setSaveError(e?.message ?? t('weight.errors.save'));
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!editing) return;
    Alert.alert(
      t('weight.deleteTitle'),
      t('weight.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('weight.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setSaveError(null);
            const { error } = await supabase
              .from('weight_log')
              .delete()
              .eq('id', editing.id);
            if (error) {
              setSaveError(error.message ?? t('weight.errors.delete'));
              setDeleting(false);
            } else {
              setEditing(null);
              setWeight('');
              setDeleting(false);
              void loadList();
            }
          },
        },
      ],
    );
  }

  function startEdit(item: WeightEntry) {
    setEditing({ id: item.id, date: item.date });
    setWeight(String(item.weight_kg));
    setSaveError(null);
  }

  const parsed = parseFloat(weight.replace(',', '.'));
  const weightValid = !isNaN(parsed) && parsed > 0;
  const busy = saving || deleting;
  const canSave = weightValid && !busy;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Text style={styles.backText}>{`← ${t('common.back')}`}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('weight.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {editing && (
          <Text style={styles.editingSubtitle}>
            {t('weight.editingEntry', { date: formatShortDate(editing.date) })}
          </Text>
        )}

        <Text style={styles.label}>{t('weight.inputLabel')}</Text>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          placeholder={t('weight.placeholder')}
          placeholderTextColor={T.textTertiary}
          keyboardType="decimal-pad"
        />

        {saveError !== null && (
          <Text style={styles.errorText}>{saveError}</Text>
        )}

        <PressableButton
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>
            {saving ? t('weight.saving') : editing ? t('weight.update') : t('common.save')}
          </Text>
        </PressableButton>

        {editing && (
          <TouchableOpacity
            style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={busy}
          >
            <Text style={styles.deleteBtnText}>{deleting ? t('weight.deleting') : t('weight.delete')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.separator} />

        <Text style={styles.sectionTitle}>{t('weight.history')}</Text>

        <WeightChart data={chartData} />

        {state === 'loading' && (
          <ActivityIndicator size="small" color={T.accent} style={styles.loader} />
        )}

        {state === 'error' && (
          <Text style={styles.errorText}>{t('weight.errors.loadHistory')}</Text>
        )}

        {state === 'ready' && (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.listItem} onPress={() => startEdit(item)}>
                <Text style={styles.listDate}>{formatShortDate(item.date)}</Text>
                <Text style={styles.listWeight}>{item.weight_kg} kg</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>{t('weight.empty')}</Text>
            }
          />
        )}
      </ScrollView>
    </View>
  );
}

function WeightChart({ data }: { data: Array<{ date: string; weight: number }> }) {
  const { T } = useTheme();
  const { t } = useTranslation();
  if (data.length < 2) return null;

  const screenWidth = Dimensions.get('window').width;
  const PADDING_H = 20;
  const PADDING_V = 16;
  const HEIGHT = 150;
  const width = screenWidth - PADDING_H * 2 - 40;

  const weights = data.map(d => d.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = Math.max(maxW - minW, 0.5);
  const yMin = minW - range * 0.1;
  const yMax = maxW + range * 0.1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = HEIGHT - PADDING_V - ((d.weight - yMin) / (yMax - yMin)) * (HEIGHT - 2 * PADDING_V);
    return { x, y };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <View style={{ marginVertical: 12 }}>
      <Svg width={width} height={HEIGHT}>
        <Line x1={0} y1={HEIGHT - PADDING_V} x2={width} y2={HEIGHT - PADDING_V} stroke={T.borderSoft} strokeWidth={1} />
        <Polyline points={polylinePoints} fill="none" stroke={T.accent} strokeWidth={2} />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={T.accent} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: T.textTertiary, fontFamily: T.fontMono }}>{t('weight.chart.thirtyDaysAgo')}</Text>
        <Text style={{ fontSize: 11, color: T.textTertiary, fontFamily: T.fontMono }}>{t('weight.chart.today')}</Text>
      </View>
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
    backText: {
      fontSize: T.textSm,
      color: T.textSecondary,
      fontFamily: T.fontMono,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    headerTitle: {
      fontSize: T.textMd,
      color: T.textPrimary,
      fontFamily: T.fontDisplay,
      letterSpacing: -0.2,
    },
    body: {
      padding: T.sp5,
      paddingBottom: T.sp8,
    },
    editingSubtitle: {
      fontSize: T.textXs,
      color: T.textSecondary,
      marginBottom: T.sp1,
      fontFamily: T.fontBody,
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
      paddingHorizontal: T.sp4,
      paddingVertical: T.sp3,
      fontSize: T.textBase,
      color: T.textPrimary,
      backgroundColor: T.surface1,
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
    separator: {
      height: 1,
      backgroundColor: T.borderSoft,
      marginVertical: T.sp4,
    },
    sectionTitle: {
      fontSize: T.textLg,
      color: T.textPrimary,
      marginBottom: T.sp3,
      fontFamily: T.fontDisplayItalic,
    },
    loader: {
      marginTop: T.sp4,
    },
    listItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: T.sp3,
      borderBottomWidth: 1,
      borderBottomColor: T.borderSoft,
    },
    listDate: {
      fontSize: T.textBase,
      color: T.textPrimary,
      fontFamily: T.fontBody,
    },
    listWeight: {
      fontSize: T.textBase,
      color: T.textSecondary,
      fontFamily: T.fontMono,
    },
    emptyText: {
      fontSize: T.textSm,
      color: T.textSecondary,
      textAlign: 'center',
      marginTop: T.sp5,
      fontFamily: T.fontBody,
    },
  });
}
