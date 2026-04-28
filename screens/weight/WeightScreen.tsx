import { useCallback, useEffect, useState } from 'react';
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
      setSaveError(e?.message ?? 'Erro ao salvar.');
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!editing) return;
    Alert.alert(
      'Apagar pesagem',
      'Tem certeza? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setSaveError(null);
            const { error } = await supabase
              .from('weight_log')
              .delete()
              .eq('id', editing.id);
            if (error) {
              setSaveError(error.message ?? 'Erro ao apagar.');
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
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Peso</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {editing && (
          <Text style={styles.editingSubtitle}>
            Editando pesagem de {formatShortDate(editing.date)}
          </Text>
        )}

        <Text style={styles.label}>Peso (kg)</Text>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          placeholder="Ex: 75.4"
          placeholderTextColor="#aaa"
          keyboardType="decimal-pad"
        />

        {saveError !== null && (
          <Text style={styles.errorText}>{saveError}</Text>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Salvar'}
          </Text>
        </TouchableOpacity>

        {editing && (
          <TouchableOpacity
            style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={busy}
          >
            <Text style={styles.deleteBtnText}>{deleting ? 'Apagando...' : 'Apagar'}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.separator} />

        <Text style={styles.sectionTitle}>Histórico</Text>

        <WeightChart data={chartData} />

        {state === 'loading' && (
          <ActivityIndicator size="small" color="#222" style={styles.loader} />
        )}

        {state === 'error' && (
          <Text style={styles.errorText}>Erro ao carregar histórico</Text>
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
              <Text style={styles.emptyText}>Nenhuma pesagem ainda</Text>
            }
          />
        )}
      </ScrollView>
    </View>
  );
}

function WeightChart({ data }: { data: Array<{ date: string; weight: number }> }) {
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
        <Line x1={0} y1={HEIGHT - PADDING_V} x2={width} y2={HEIGHT - PADDING_V} stroke="#eee" strokeWidth={1} />
        <Polyline points={polylinePoints} fill="none" stroke="#222" strokeWidth={2} />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill="#222" />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: '#999' }}>30 dias atrás</Text>
        <Text style={{ fontSize: 11, color: '#999' }}>hoje</Text>
      </View>
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
  backText: {
    fontSize: 15,
    color: '#666',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  body: {
    padding: 20,
    paddingBottom: 48,
  },
  editingSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
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
  errorText: {
    color: '#c0392b',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  saveBtn: {
    marginTop: 20,
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
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  loader: {
    marginTop: 16,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  listDate: {
    fontSize: 15,
    color: '#111',
  },
  listWeight: {
    fontSize: 15,
    color: '#666',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
  },
});
