import { useEffect, useState } from 'react';
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
};

// Campos de meta diária vindos da tabela profiles
type DailyTargets = {
  daily_calorie_target: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
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

// Formata a data de hoje em português sem precisar de biblioteca externa
function formatDatePT(date: Date): string {
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  return `${date.getDate()} de ${months[date.getMonth()]}`;
}

export default function HomeScreen({ session }: Props) {
  const [targets, setTargets] = useState<DailyTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealEntry | null>(null);

  // Busca as metas diárias do perfil ao montar a tela.
  // Só seleciona os 4 campos necessários para não trazer dados desnecessários.
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

  async function handleSignOut() {
    // signOut limpa a sessão local; o listener em App.tsx redireciona para AuthScreen
    await supabase.auth.signOut();
  }

  // ── Estados de carregamento e erro ────────────────────────────────────────

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

  // Targets nulos significam que o onboarding não foi concluído corretamente
  if (!targets || targets.daily_calorie_target == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Completa o onboarding primeiro</Text>
      </View>
    );
  }

  const today = formatDatePT(new Date());

  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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
      {/* Consumido está fixo em 0 até a tabela de refeições existir */}
      <View style={styles.card}>
        <Text style={styles.calorieLabel}>Calorias</Text>
        <Text style={styles.calorieNumber}>
          0{' '}
          <Text style={styles.calorieTarget}>/ {targets.daily_calorie_target} kcal</Text>
        </Text>
        {/* Barra de progresso: width em % do consumido/meta — sempre 0 por ora */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '0%' }]} />
        </View>
      </View>

      {/* ── Linha de macros ─────────────────────────────────────────── */}
      {/* Três cards menores lado a lado para proteína, carboidrato e gordura */}
      <View style={styles.macroRow}>
        <MacroCard label="Proteína" consumed={0} target={targets.daily_protein_g} />
        <MacroCard label="Carbo"    consumed={0} target={targets.daily_carbs_g} />
        <MacroCard label="Gordura"  consumed={0} target={targets.daily_fat_g} />
      </View>

      {/* ── Cards de refeição ───────────────────────────────────────── */}
      {MEALS.map((meal) => (
        <View key={meal.type} style={styles.card}>
          <View style={styles.mealRow}>
            <View>
              <Text style={styles.mealName}>{meal.label}</Text>
              <Text style={styles.mealKcal}>0 kcal</Text>
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

      {/* ── Botão Sair ──────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sair</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

// ── Componente interno MacroCard ───────────────────────────────────────────
// Exibe label, "consumido / meta g" e uma barra de progresso fina.
// Separado para evitar repetição nos três macros.
type MacroCardProps = { label: string; consumed: number; target: number };

function MacroCard({ label, consumed, target }: MacroCardProps) {
  // Garante que a barra nunca ultrapasse 100% mesmo com dados futuros incorretos
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
