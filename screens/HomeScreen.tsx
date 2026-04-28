import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import MealDetailScreen from './MealDetailScreen';

type Props = {
  session: Session;
  // TODO: remover na Parte B
  onTestScanner?: () => void;
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

const MEALS: MealEntry[] = [
  { type: 'breakfast', label: 'Café da manhã' },
  { type: 'lunch',     label: 'Almoço' },
  { type: 'dinner',    label: 'Jantar' },
  { type: 'snack',     label: 'Lanche' },
];

function formatDatePT(date: Date): string {
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  return `${date.getDate()} de ${months[date.getMonth()]}`;
}

export default function HomeScreen({ session, onTestScanner }: Props) {
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const today = formatDatePT(now);

  const [targets, setTargets] = useState<DailyTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealEntry | null>(null);
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
      .eq('meals.date', todayISO);

    if (error) {
      console.warn('loadTotals error:', error.message);
      return;
    }

    let kcal = 0, protein_g = 0, carbs_g = 0, fat_g = 0;
    const byMeal = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };

    for (const item of data ?? []) {
      kcal      += item.calories   ?? 0;
      protein_g += item.protein_g  ?? 0;
      carbs_g   += item.carbs_g    ?? 0;
      fat_g     += item.fat_g      ?? 0;
      const mealType = (item.meals as { meal_type: string }).meal_type as keyof typeof byMeal;
      if (mealType in byMeal) byMeal[mealType] += item.calories ?? 0;
    }

    const round = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;
    setTotals({
      kcal:      round(kcal),
      protein_g: round(protein_g),
      carbs_g:   round(carbs_g),
      fat_g:     round(fat_g),
      byMeal: {
        breakfast: round(byMeal.breakfast),
        lunch:     round(byMeal.lunch),
        dinner:    round(byMeal.dinner),
        snack:     round(byMeal.snack),
      },
    });
  }, [session.user.id, todayISO]);

  useEffect(() => {
    if (selectedMeal === null) loadTotals();
  }, [selectedMeal, loadTotals]);

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

  if (selectedMeal) {
    return (
      <MealDetailScreen
        session={session}
        mealType={selectedMeal.type}
        mealLabel={selectedMeal.label}
        date={todayISO}
        onClose={() => setSelectedMeal(null)}
      />
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>

      {/* ── Cabeçalho ───────────────────────────────────────────────── */}
      <Text style={styles.title}>Hoje</Text>
      <Text style={styles.date}>{today}</Text>

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
        <MacroCard label="Carbo"    consumed={totals.carbs_g}   target={targets.daily_carbs_g} />
        <MacroCard label="Gordura"  consumed={totals.fat_g}     target={targets.daily_fat_g} />
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

      {/* TODO: remover na Parte B */}
      {onTestScanner && (
        <TouchableOpacity style={styles.testScannerButton} onPress={onTestScanner}>
          <Text style={styles.testScannerText}>🧪 Testar Scanner</Text>
        </TouchableOpacity>
      )}

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
    marginBottom: 20,
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

  // TODO: remover na Parte B
  testScannerButton: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  testScannerText: {
    fontSize: 14,
    color: '#555',
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
