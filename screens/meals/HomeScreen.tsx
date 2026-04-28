import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import MealDetailScreen from './MealDetailScreen';
import WeightScreen from '../weight/WeightScreen';
import ChatScreen from '../chat/ChatScreen';

type Props = {
  session: Session;
};

type DailyTargets = {
  daily_calorie_target: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
};

type DailyTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  byMeal: {
    breakfast: number;
    lunch: number;
    dinner: number;
    snack: number;
  };
};

type MealEntry = {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  label: string;
};

type WeightSummary = {
  current: number | null;
  currentDate: string | null;
  firstDate: string | null;
  diff: number | null;
};

const MEALS: MealEntry[] = [
  { type: 'breakfast', label: 'Café da manhã' },
  { type: 'lunch', label: 'Almoço' },
  { type: 'dinner', label: 'Jantar' },
  { type: 'snack', label: 'Lanche' },
];

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayOfWeekPT(iso: string): string {
  const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  return days[isoToDate(iso).getDay()];
}

function formatDatePT(date: Date): string {
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  return `${date.getDate()} de ${months[date.getMonth()]}`;
}

function formatDateShort(iso: string): string {
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${months[m - 1]}`;
}

export default function HomeScreen({ session }: Props) {
  const todayISO = useMemo(() => isoToday(), []);
  const [selectedDateISO, setSelectedDateISO] = useState<string>(todayISO);

  const [targets, setTargets] = useState<DailyTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealEntry | null>(null);
  const [showWeight, setShowWeight] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [weight, setWeight] = useState<WeightSummary>({
    current: null,
    currentDate: null,
    firstDate: null,
    diff: null,
  });
  const [totals, setTotals] = useState<DailyTotals>({
    kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
    byMeal: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
  });

  useEffect(() => {
    async function fetchProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('daily_calorie_target, daily_protein_g, daily_carbs_g, daily_fat_g')
        .eq('id', session.user.id)
        .single();

      if (error || !data) {
        setFetchError(true);
      } else {
        setTargets(data as DailyTargets);
      }
      setLoading(false);
    }

    fetchProfile();
  }, [session.user.id]);

  const loadTotals = useCallback(async () => {
    const { data, error } = await supabase
      .from('meal_foods')
      .select('calories, protein_g, carbs_g, fat_g, meals!inner(meal_type, user_id, date)')
      .eq('meals.user_id', session.user.id)
      .eq('meals.date', selectedDateISO);

    if (error) {
      console.warn('loadTotals error:', error.message);
      return;
    }

    let kcal = 0, protein_g = 0, carbs_g = 0, fat_g = 0;
    const byMeal = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };

    for (const item of data ?? []) {
      kcal += item.calories ?? 0;
      protein_g += item.protein_g ?? 0;
      carbs_g += item.carbs_g ?? 0;
      fat_g += item.fat_g ?? 0;
      const mealsField = item.meals as { meal_type: string } | { meal_type: string }[] | null | undefined;
      const mealsObj = Array.isArray(mealsField) ? mealsField[0] : mealsField;
      const mealType = mealsObj?.meal_type as keyof typeof byMeal | undefined;
      if (mealType && mealType in byMeal) byMeal[mealType] += item.calories ?? 0;
    }

    const round = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;
    setTotals({
      kcal: round(kcal),
      protein_g: round(protein_g),
      carbs_g: round(carbs_g),
      fat_g: round(fat_g),
      byMeal: {
        breakfast: round(byMeal.breakfast),
        lunch: round(byMeal.lunch),
        dinner: round(byMeal.dinner),
        snack: round(byMeal.snack),
      },
    });
  }, [session.user.id, selectedDateISO]);

  const loadWeightSummary = useCallback(async () => {
    const [latestRes, oldestRes] = await Promise.all([
      supabase
        .from('weight_log')
        .select('date, weight_kg')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('weight_log')
        .select('date, weight_kg')
        .eq('user_id', session.user.id)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (latestRes.error || oldestRes.error) {
      console.warn('loadWeightSummary error');
      return;
    }

    if (!latestRes.data) {
      setWeight({ current: null, currentDate: null, firstDate: null, diff: null });
      return;
    }

    const current = Number(latestRes.data.weight_kg);
    const currentDate = latestRes.data.date;
    const oldest = oldestRes.data ? Number(oldestRes.data.weight_kg) : null;
    const firstDate = oldestRes.data ? oldestRes.data.date : null;

    const diff = oldest !== null && firstDate !== currentDate
      ? Math.round((current - oldest + Number.EPSILON) * 10) / 10
      : null;

    setWeight({ current, currentDate, firstDate, diff });
  }, [session.user.id]);

  useEffect(() => {
    if (selectedMeal === null) loadTotals();
  }, [selectedMeal, loadTotals]);

  useEffect(() => {
    if (!showWeight) loadWeightSummary();
  }, [showWeight, loadWeightSummary]);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#222" />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Erro ao carregar perfil</Text>
      </View>
    );
  }

  if (!targets || targets.daily_calorie_target == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Completa o onboarding primeiro</Text>
      </View>
    );
  }

  if (showChat) {
    return <ChatScreen session={session} onClose={() => setShowChat(false)} />;
  }

  if (selectedMeal) {
    return (
      <MealDetailScreen
        session={session}
        mealType={selectedMeal.type}
        mealLabel={selectedMeal.label}
        date={selectedDateISO}
        onClose={() => setSelectedMeal(null)}
      />
    );
  }

  if (showWeight) {
    return <WeightScreen session={session} onClose={() => setShowWeight(false)} />;
  }

  const yesterdayISO = addDaysIso(todayISO, -1);
  const canGoForward = selectedDateISO !== todayISO;

  let titleLabel: string;
  let subtitleLabel: string;
  const dateFmt = formatDatePT(isoToDate(selectedDateISO));

  if (selectedDateISO === todayISO) {
    titleLabel = 'Hoje';
    subtitleLabel = `${dateFmt} (${dayOfWeekPT(selectedDateISO)})`;
  } else if (selectedDateISO === yesterdayISO) {
    titleLabel = 'Ontem';
    subtitleLabel = `${dateFmt} (${dayOfWeekPT(selectedDateISO)})`;
  } else {
    titleLabel = dateFmt;
    subtitleLabel = dayOfWeekPT(selectedDateISO);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>

      {/* ── Cabeçalho navegável ─────────────────────────────────────── */}
      <View style={styles.dateHeader}>
        <TouchableOpacity
          style={styles.arrowBtn}
          onPress={() => setSelectedDateISO(addDaysIso(selectedDateISO, -1))}
          hitSlop={8}
        >
          <Text style={styles.arrowText}>←</Text>
        </TouchableOpacity>

        <View style={styles.dateCenter}>
          <Text style={styles.title}>{titleLabel}</Text>
          <Text style={styles.date}>{subtitleLabel}</Text>
        </View>

        <TouchableOpacity
          style={[styles.arrowBtn, !canGoForward && styles.arrowBtnDisabled]}
          onPress={() => canGoForward && setSelectedDateISO(addDaysIso(selectedDateISO, 1))}
          hitSlop={8}
          disabled={!canGoForward}
        >
          <Text style={[styles.arrowText, !canGoForward && styles.arrowTextDisabled]}>→</Text>
        </TouchableOpacity>
      </View>

      {/* ── Card de calorias em destaque ────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.calorieLabel}>Calorias</Text>
        <Text style={styles.calorieNumber}>
          {totals.kcal}{' '}
          <Text style={styles.calorieTarget}>/ {targets.daily_calorie_target} kcal</Text>
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min((totals.kcal / targets.daily_calorie_target) * 100, 100)}%` }]} />
        </View>
      </View>

      {/* ── Linha de macros ─────────────────────────────────────────── */}
      <View style={styles.macroRow}>
        <MacroCard label="Proteína" consumed={totals.protein_g} target={targets.daily_protein_g} />
        <MacroCard label="Carbo" consumed={totals.carbs_g} target={targets.daily_carbs_g} />
        <MacroCard label="Gordura" consumed={totals.fat_g} target={targets.daily_fat_g} />
      </View>

      {/* ── Cards de refeição ───────────────────────────────────────── */}
      {MEALS.map((meal) => (
        <View key={meal.type} style={styles.card}>
          <View style={styles.mealRow}>
            <View>
              <Text style={styles.mealName}>{meal.label}</Text>
              <Text style={styles.mealKcal}>{totals.byMeal[meal.type]} kcal</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setSelectedMeal(meal)}
            >
              <Text style={styles.addButtonText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* ── Card de peso ────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.weightCard} onPress={() => setShowWeight(true)} activeOpacity={0.7}>
        <Text style={styles.weightLabel}>Peso</Text>

        {weight.current === null ? (
          <>
            <Text style={styles.weightValueEmpty}>—</Text>
            <Text style={styles.weightSubtitle}>Toque para adicionar tua primeira pesagem</Text>
          </>
        ) : (
          <>
            <Text style={styles.weightValue}>
              {weight.current}
              <Text style={styles.weightUnit}> kg</Text>
            </Text>
            <Text style={styles.weightSubtitle}>
              {weight.diff === null
                ? `Primeira pesagem em ${formatDateShort(weight.currentDate!)}`
                : weight.diff === 0
                  ? `Sem mudança desde ${formatDateShort(weight.firstDate!)}`
                  : `${weight.diff < 0 ? '↓' : '↑'} ${Math.abs(weight.diff)} kg desde ${formatDateShort(weight.firstDate!)}`
              }
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* ── Card de chat ────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.weightCard} onPress={() => setShowChat(true)} activeOpacity={0.7}>
        <Text style={styles.weightLabel}>💬 Conversar com IA</Text>
        <Text style={styles.weightSubtitle}>Pergunte sobre suas refeições, peso ou metas</Text>
      </TouchableOpacity>

      {/* ── Botão Sair ──────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sair</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

// ── Componente interno MacroCard ───────────────────────────────────────────
type MacroCardProps = { label: string; consumed: number; target: number };

function MacroCard({ label, consumed, target }: MacroCardProps) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;

  return (
    <View style={[styles.card, styles.macroCard]}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>
        {consumed}
        <Text style={styles.macroTarget}> / {target}g</Text>
      </Text>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },

  // Cabeçalho
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },

  // Cabeçalho navegável
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
  },
  arrowBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  arrowBtnDisabled: {
    opacity: 0.3,
  },
  arrowText: {
    fontSize: 22,
    color: '#222',
    fontWeight: '600',
  },
  arrowTextDisabled: {
    color: '#ccc',
  },

  // Card base reutilizado em todos os blocos
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },

  // Calories card
  calorieLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  calorieNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#222',
  },
  calorieTarget: {
    fontSize: 18,
    fontWeight: '400',
    color: '#666',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#222',
    borderRadius: 4,
  },

  // Linha de macros
  macroRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 0,
  },
  macroCard: {
    flex: 1,
    marginBottom: 12,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginBottom: 2,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
  },
  macroTarget: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666',
  },
  macroTrack: {
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    backgroundColor: '#222',
    borderRadius: 2,
  },

  // Cards de refeição
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  mealKcal: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
  },

  // Card de peso
  weightCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  weightLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  weightValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#222',
  },
  weightValueEmpty: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ccc',
  },
  weightUnit: {
    fontSize: 18,
    fontWeight: '400',
    color: '#666',
  },
  weightSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },

  // Botão Sair
  signOutButton: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: {
    fontSize: 15,
    color: '#666',
  },
});
