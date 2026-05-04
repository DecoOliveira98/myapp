import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { T } from '../../theme/tokens';
import MealDetailScreen from './MealDetailScreen';
import WeightScreen from '../weight/WeightScreen';
import ChatScreen from '../chat/ChatScreen';
import RecipesListScreen from '../recipes/RecipesListScreen';
import RecipeSearchScreen from '../recipes/RecipeSearchScreen';
import NavBar from '../../components/navigation/NavBar';
import FastingScreen from '../fasting/FastingScreen';
import ReportScreen from '../reports/ReportScreen';
import AvatarMenu from '../../components/avatar/AvatarMenu';
import { useProfile } from '../../hooks/useProfile';
import ProfileScreen from '../profile/ProfileScreen';

type Props = { session: Session };

type ActiveFasting = { started_at: string; goal_hours: number | null };

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
  byMeal: { breakfast: number; lunch: number; dinner: number; snack: number };
};

type MealEntry = { type: 'breakfast' | 'lunch' | 'dinner' | 'snack'; label: string };

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

const BAR_MAX_H = 80;

// ── Date helpers ─────────────────────────────────────────────────────────────

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
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[isoToDate(iso).getDay()];
}

function dayOfWeekShortPT(iso: string): string {
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][isoToDate(iso).getDay()];
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

function formatKcal(n: number): string {
  const r = Math.round(n);
  if (r >= 1000) {
    return `${Math.floor(r / 1000)}.${String(r % 1000).padStart(3, '0')}`;
  }
  return String(r);
}

function getHeadline(
  kcal: number,
  target: number,
  isToday: boolean,
): { pre: string; italic: string; post: string } {
  if (!isToday) {
    const pct = target > 0 ? Math.round((kcal / target) * 100) : 0;
    return { pre: 'Você atingiu', italic: `${pct}%`, post: ' da meta neste dia.' };
  }
  if (kcal === 0) {
    return { pre: 'Como foi', italic: ' o dia', post: ' por aí?' };
  }
  const pct = kcal / target;
  if (pct > 1.05) return { pre: 'Você', italic: ' passou da meta', post: ' hoje.' };
  if (pct >= 0.8) return { pre: 'Você está', italic: ' no caminho.', post: '' };
  if (pct >= 0.5) return { pre: 'Bom', italic: ' começo de dia.', post: '' };
  return { pre: 'O dia ainda', italic: ' começa.', post: '' };
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ session }: Props) {
  const todayISO = useMemo(() => isoToday(), []);
  const [selectedDateISO, setSelectedDateISO] = useState(todayISO);
  const [selectedMeal, setSelectedMeal] = useState<MealEntry | null>(null);
  const [showWeight, setShowWeight] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [showRecipeSearch, setShowRecipeSearch] = useState(false);
  const [showFasting, setShowFasting] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const { profile, loading, error: profileError, refetch: refetchProfile } = useProfile(session);
  const [activeFasting, setActiveFasting] = useState<ActiveFasting | null>(null);
  const [fastingNow, setFastingNow] = useState(new Date());
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [weight, setWeight] = useState<WeightSummary>({
    current: null, currentDate: null, firstDate: null, diff: null,
  });
  const [totals, setTotals] = useState<DailyTotals>({
    kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
    byMeal: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
  });
  const [weekData, setWeekData] = useState<Record<string, number>>({});
  const [streak, setStreak] = useState(0);

  const userAvatarSrc =
    profile?.avatar_url ??
    session.user.user_metadata?.avatar_url ??
    session.user.user_metadata?.picture ??
    undefined;
  const userDisplayName =
    profile?.display_name ??
    session.user.user_metadata?.name ??
    session.user.user_metadata?.full_name ??
    session.user.email ??
    'User';

  const scrollViewRef = useRef<ScrollView>(null);
  const [mealsY, setMealsY] = useState(600);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const targets: DailyTargets | null =
    profile && profile.daily_calorie_target != null
      ? {
        daily_calorie_target: profile.daily_calorie_target,
        daily_protein_g: profile.daily_protein_g ?? 0,
        daily_carbs_g: profile.daily_carbs_g ?? 0,
        daily_fat_g: profile.daily_fat_g ?? 0,
      }
      : null;

  const loadTotals = useCallback(async () => {
    const { data, error } = await supabase
      .from('meal_foods')
      .select('calories, protein_g, carbs_g, fat_g, meals!inner(meal_type, user_id, date)')
      .eq('meals.user_id', session.user.id)
      .eq('meals.date', selectedDateISO);

    if (error) { console.warn('loadTotals:', error.message); return; }

    let kcal = 0, protein_g = 0, carbs_g = 0, fat_g = 0;
    const byMeal = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    for (const item of data ?? []) {
      kcal += item.calories ?? 0;
      protein_g += item.protein_g ?? 0;
      carbs_g += item.carbs_g ?? 0;
      fat_g += item.fat_g ?? 0;
      const mf = item.meals as { meal_type: string } | { meal_type: string }[] | null | undefined;
      const mo = Array.isArray(mf) ? mf[0] : mf;
      const mt = mo?.meal_type as keyof typeof byMeal | undefined;
      if (mt && mt in byMeal) byMeal[mt] += item.calories ?? 0;
    }
    const round = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;
    setTotals({
      kcal: round(kcal), protein_g: round(protein_g),
      carbs_g: round(carbs_g), fat_g: round(fat_g),
      byMeal: {
        breakfast: round(byMeal.breakfast), lunch: round(byMeal.lunch),
        dinner: round(byMeal.dinner), snack: round(byMeal.snack),
      },
    });
  }, [session.user.id, selectedDateISO]);

  const loadActiveFasting = useCallback(async () => {
    const { data } = await supabase
      .from('fasting_sessions')
      .select('started_at, goal_hours')
      .eq('user_id', session.user.id)
      .is('ended_at', null)
      .maybeSingle();
    setActiveFasting(data ?? null);
  }, [session.user.id]);

  const loadWeightSummary = useCallback(async () => {
    const [latestRes, oldestRes] = await Promise.all([
      supabase.from('weight_log').select('date, weight_kg')
        .eq('user_id', session.user.id).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('weight_log').select('date, weight_kg')
        .eq('user_id', session.user.id).order('date', { ascending: true }).limit(1).maybeSingle(),
    ]);
    if (latestRes.error || oldestRes.error) { console.warn('loadWeightSummary error'); return; }
    if (!latestRes.data) { setWeight({ current: null, currentDate: null, firstDate: null, diff: null }); return; }
    const current = Number(latestRes.data.weight_kg);
    const currentDate = latestRes.data.date;
    const oldest = oldestRes.data ? Number(oldestRes.data.weight_kg) : null;
    const firstDate = oldestRes.data ? oldestRes.data.date : null;
    const diff = oldest !== null && firstDate !== currentDate
      ? Math.round((current - oldest + Number.EPSILON) * 10) / 10
      : null;
    setWeight({ current, currentDate, firstDate, diff });
  }, [session.user.id]);

  const loadWeekData = useCallback(async () => {
    const dates = Array.from({ length: 7 }, (_, i) => addDaysIso(todayISO, -(6 - i)));
    const oldest = dates[0];
    const { data, error } = await supabase
      .from('meal_foods')
      .select('calories, meals!inner(user_id, date)')
      .eq('meals.user_id', session.user.id)
      .gte('meals.date', oldest)
      .lte('meals.date', todayISO);
    if (error) { console.warn('loadWeekData:', error.message); return; }
    const map: Record<string, number> = {};
    dates.forEach(d => { map[d] = 0; });
    for (const item of data ?? []) {
      const mf = item.meals as { date: string } | { date: string }[] | null | undefined;
      const mo = Array.isArray(mf) ? mf[0] : mf;
      const date = mo?.date;
      if (date && date in map) map[date] = (map[date] ?? 0) + (item.calories ?? 0);
    }
    setWeekData(map);
  }, [session.user.id, todayISO]);

  const loadStreak = useCallback(async () => {
    const { data, error } = await supabase
      .from('meals')
      .select('date')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false })
      .limit(200);
    if (error || !data || data.length === 0) { setStreak(0); return; }
    const unique = [...new Set(data.map(m => m.date as string))].sort().reverse();
    let count = 0;
    let check = todayISO;
    if (!unique.includes(todayISO)) check = addDaysIso(todayISO, -1);
    for (const d of unique) {
      if (d === check) { count++; check = addDaysIso(check, -1); }
      else if (d < check) break;
    }
    setStreak(count);
  }, [session.user.id, todayISO]);

  useEffect(() => {
    if (selectedMeal === null) { loadTotals(); loadWeekData(); }
  }, [selectedMeal, loadTotals, loadWeekData]);

  useEffect(() => {
    if (!showWeight) loadWeightSummary();
  }, [showWeight, loadWeightSummary]);

  useEffect(() => {
    if (!showFasting) loadActiveFasting();
  }, [showFasting, loadActiveFasting]);

  useEffect(() => {
    if (!activeFasting) return;
    const id = setInterval(() => setFastingNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [activeFasting]);

  useEffect(() => { loadStreak(); }, [loadStreak]);

  async function handleSignOut() { await supabase.auth.signOut(); }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={ss.centered}>
        <Text style={[ss.eyebrow, { marginBottom: 0 }]}>Carregando...</Text>
      </View>
    );
  }
  if (profileError) {
    return (
      <View style={ss.centered}>
        <Text style={ss.bodyText}>Erro ao carregar perfil</Text>
      </View>
    );
  }
  if (!targets || targets.daily_calorie_target == null) {
    return (
      <View style={ss.centered}>
        <Text style={ss.bodyText}>Completa o onboarding primeiro</Text>
      </View>
    );
  }
  if (showProfile) {
    return (
      <ProfileScreen
        session={session}
        profile={profile}
        onClose={() => setShowProfile(false)}
        refetchProfile={refetchProfile}
      />
    );
  }
  if (showRecipeSearch) return <RecipeSearchScreen session={session} onClose={() => setShowRecipeSearch(false)} />;
  if (showReport) return <ReportScreen session={session} onClose={() => setShowReport(false)} />;
  if (showFasting) return <FastingScreen session={session} onClose={() => setShowFasting(false)} />;
  if (showRecipes) return <RecipesListScreen session={session} onClose={() => setShowRecipes(false)} />;
  if (showChat) return <ChatScreen session={session} onClose={() => setShowChat(false)} />;
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
  if (showWeight) return <WeightScreen session={session} onClose={() => setShowWeight(false)} />;

  // ── Derived values ────────────────────────────────────────────────────────

  const yesterdayISO = addDaysIso(todayISO, -1);
  const canGoForward = selectedDateISO !== todayISO;
  const isToday = selectedDateISO === todayISO;

  const progressPct = Math.min((totals.kcal / targets.daily_calorie_target) * 100, 100);
  const remaining = Math.max(targets.daily_calorie_target - totals.kcal, 0);
  const headline = getHeadline(totals.kcal, targets.daily_calorie_target, isToday);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(todayISO, -(6 - i)));
  const maxWeekKcal = Math.max(
    ...weekDates.map(d => weekData[d] ?? 0),
    targets.daily_calorie_target,
    1,
  );
  const weekAvgKcal = (() => {
    const vals = weekDates.map(d => weekData[d] ?? 0).filter(v => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  })();

  const fastingElapsed = activeFasting
    ? fastingNow.getTime() - new Date(activeFasting.started_at).getTime()
    : 0;
  const fastingH = Math.floor(fastingElapsed / 3_600_000);
  const fastingM = Math.floor((fastingElapsed % 3_600_000) / 60_000);

  const proteinPct = Math.round((targets.daily_protein_g * 4 / targets.daily_calorie_target) * 100);
  const carbsPct = Math.round((targets.daily_carbs_g * 4 / targets.daily_calorie_target) * 100);
  const fatPct = Math.round((targets.daily_fat_g * 9 / targets.daily_calorie_target) * 100);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollViewRef}
        style={ss.scroll}
        contentContainerStyle={ss.container}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Top row: date nav + streak ─────────────────────────────── */}
        <View style={ss.topRow}>
          <View style={ss.topRowMain}>
            <View style={ss.dateNav}>
              <TouchableOpacity onPress={() => setSelectedDateISO(addDaysIso(selectedDateISO, -1))} hitSlop={14}>
                <Text style={ss.navArrow}>←</Text>
              </TouchableOpacity>
              <Text style={ss.eyebrow} numberOfLines={1}>
                {dayOfWeekPT(selectedDateISO).toUpperCase()} · {formatDatePT(isoToDate(selectedDateISO)).toUpperCase()}
              </Text>
              <TouchableOpacity
                onPress={() => canGoForward && setSelectedDateISO(addDaysIso(selectedDateISO, 1))}
                disabled={!canGoForward}
                hitSlop={14}
              >
                <Text style={[ss.navArrow, !canGoForward && ss.navArrowDisabled]}>→</Text>
              </TouchableOpacity>
            </View>

            <AvatarMenu
              src={userAvatarSrc}
              name={userDisplayName}
              email={session.user.email}
              onSignOut={handleSignOut}
              onNavigateProfile={() => setShowProfile(true)}
            />
          </View>

          <View style={ss.streakPill}>
            <Animated.View style={[ss.pulseDot, { opacity: pulseAnim }]} />
            <Text style={ss.streakText}>{streak} dia{streak !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <View style={ss.hero}>
          <Text style={ss.heroHeadline}>
            {headline.pre}
            <Text style={ss.heroHeadlineItalic}>{headline.italic}</Text>
            {headline.post}
          </Text>

          <View style={ss.calorieRow}>
            <Text style={ss.calorieNum} adjustsFontSizeToFit numberOfLines={1}>
              {formatKcal(totals.kcal)}
            </Text>
            <View style={ss.calorieTarget}>
              <Text style={ss.calorieTargetLabel}>META DIÁRIA</Text>
              <Text style={ss.calorieTargetNum}>{formatKcal(targets.daily_calorie_target)} kcal</Text>
            </View>
          </View>

          <View style={ss.progressTrack}>
            <View style={[ss.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
          <View style={ss.progressMeta}>
            <Text style={ss.progressMetaText}>
              <Text style={ss.progressMetaBold}>{Math.round(progressPct)}%</Text> consumido
            </Text>
            <Text style={ss.progressMetaText}>{formatKcal(remaining)} kcal restantes</Text>
          </View>

          <View style={ss.actions}>
            <TouchableOpacity
              style={ss.btnPrimary}
              onPress={() => setShowMealPicker(v => !v)}
              activeOpacity={0.85}
            >
              <Text style={ss.btnPrimaryText}>REGISTRAR  ↗</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ss.btnGhost}
              onPress={() => scrollViewRef.current?.scrollTo({ y: mealsY, animated: true })}
              activeOpacity={0.75}
            >
              <Text style={ss.btnGhostText}>VER DETALHES</Text>
            </TouchableOpacity>
          </View>

          {showMealPicker && (
            <View style={ss.mealPicker}>
              {MEALS.map(meal => (
                <TouchableOpacity
                  key={meal.type}
                  style={ss.mealPickerBtn}
                  onPress={() => { setSelectedMeal(meal); setShowMealPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={ss.mealPickerBtnText}>{meal.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Macros ─────────────────────────────────────────────────── */}
        <View style={ss.macrosCard}>
          <View style={ss.macrosHeader}>
            <Text style={ss.macrosTitle}>Macros</Text>
            <Text style={ss.macrosRatio}>{proteinPct}P · {carbsPct}C · {fatPct}G</Text>
          </View>
          <MacroRow label="Proteína" consumed={totals.protein_g} target={targets.daily_protein_g} fillColor={T.accent} />
          <MacroRow label="Carbo" consumed={totals.carbs_g} target={targets.daily_carbs_g} fillColor="#C9A878" />
          <MacroRow label="Gordura" consumed={totals.fat_g} target={targets.daily_fat_g} fillColor="#6E5B43" />
        </View>

        {/* ── Refeições ──────────────────────────────────────────────── */}
        <View
          style={ss.sectionHeader}
          onLayout={e => setMealsY(e.nativeEvent.layout.y)}
        >
          <Text style={ss.sectionTitle}>Refeições de hoje</Text>
          <Text style={ss.sectionMeta}>{MEALS.length} refeições</Text>
        </View>

        <View style={ss.mealsGrid}>
          {MEALS.map(meal => (
            <MealCard
              key={meal.type}
              label={meal.label}
              kcal={totals.byMeal[meal.type]}
              onPress={() => setSelectedMeal(meal)}
            />
          ))}
        </View>

        {/* ── Últimos 7 dias ─────────────────────────────────────────── */}
        <View style={ss.sectionHeader}>
          <Text style={ss.sectionTitle}>Últimos sete dias</Text>
          {weekAvgKcal > 0 && (
            <Text style={ss.sectionMeta}>
              média{' '}
              <Text style={{ color: T.accent }}>{formatKcal(weekAvgKcal)}</Text>
              {' '}kcal
            </Text>
          )}
        </View>

        <View style={ss.weekChart}>
          {weekDates.map(date => {
            const dayKcal = weekData[date] ?? 0;
            const barH = dayKcal === 0 ? 0 : Math.max((dayKcal / maxWeekKcal) * BAR_MAX_H, 6);
            const isThisToday = date === todayISO;
            return (
              <View key={date} style={ss.weekDay}>
                <View style={ss.weekBarTrack}>
                  <View
                    style={[
                      ss.weekBar,
                      isThisToday ? ss.weekBarToday : ss.weekBarDefault,
                      { height: barH },
                    ]}
                  />
                </View>
                <Text style={[ss.weekDayLabel, isThisToday && ss.weekDayLabelToday]}>
                  {dayOfWeekShortPT(date)}
                </Text>
                <Text style={[ss.weekDayNum, isThisToday && ss.weekDayNumToday]}>
                  {dayKcal > 0 ? String(Math.round(dayKcal)) : '—'}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Peso ───────────────────────────────────────────────────── */}
        <TouchableOpacity style={ss.auxCard} onPress={() => setShowWeight(true)} activeOpacity={0.7}>
          <Text style={ss.auxCardLabel}>Peso</Text>
          {weight.current === null ? (
            <>
              <Text style={ss.auxCardValueEmpty}>—</Text>
              <Text style={ss.auxCardSub}>Toque para registrar</Text>
            </>
          ) : (
            <>
              <Text style={ss.auxCardValue}>
                {weight.current}
                <Text style={ss.auxCardUnit}> kg</Text>
              </Text>
              <Text style={ss.auxCardSub}>
                {weight.diff === null
                  ? `Primeira pesagem em ${formatDateShort(weight.currentDate!)}`
                  : weight.diff === 0
                    ? `Sem mudança desde ${formatDateShort(weight.firstDate!)}`
                    : `${weight.diff < 0 ? '↓' : '↑'} ${Math.abs(weight.diff)} kg desde ${formatDateShort(weight.firstDate!)}`}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Chat ───────────────────────────────────────────────────── */}
        <TouchableOpacity style={ss.auxCard} onPress={() => setShowChat(true)} activeOpacity={0.7}>
          <Text style={ss.auxCardLabel}>Assistente IA</Text>
          <Text style={ss.auxCardSub}>Pergunte sobre refeições, peso ou metas</Text>
        </TouchableOpacity>

        {/* ── Receitas ───────────────────────────────────────────────── */}
        <TouchableOpacity style={ss.auxCard} onPress={() => setShowRecipes(true)} activeOpacity={0.7}>
          <Text style={ss.auxCardLabel}>Receitas</Text>
          <Text style={ss.auxCardSub}>Crie atalhos pras suas comidas frequentes</Text>
        </TouchableOpacity>

        {/* ── Explorar receitas ─────────────────────────────────────── */}
        <TouchableOpacity style={ss.auxCard} onPress={() => setShowRecipeSearch(true)} activeOpacity={0.7}>
          <Text style={ss.auxCardLabel}>🔎 Explorar receitas</Text>
          <Text style={ss.auxCardSub}>Buscar receitas no Spoonacular</Text>
        </TouchableOpacity>

        {/* ── Jejum ──────────────────────────────────────────────────── */}
        <TouchableOpacity style={ss.auxCard} onPress={() => setShowFasting(true)} activeOpacity={0.7}>
          <Text style={ss.auxCardLabel}>⏱ Jejum</Text>
          {activeFasting !== null ? (
            <>
              <Text style={ss.auxCardValue}>
                Jejuando há {fastingH}h {fastingM}min
              </Text>
              <Text style={ss.auxCardSub}>Toque para encerrar ou ver detalhes</Text>
            </>
          ) : (
            <Text style={ss.auxCardSub}>Toque para iniciar</Text>
          )}
        </TouchableOpacity>

        {/* ── Relatório ──────────────────────────────────────────────── */}
        <TouchableOpacity style={ss.auxCard} onPress={() => setShowReport(true)} activeOpacity={0.7}>
          <Text style={ss.auxCardLabel}>📊 Relatório</Text>
          <Text style={ss.auxCardSub}>Exportar histórico em PDF</Text>
        </TouchableOpacity>

        {/* ── Sair ───────────────────────────────────────────────────── */}
        <TouchableOpacity style={ss.signOutBtn} onPress={handleSignOut} activeOpacity={0.6}>
          <Text style={ss.signOutText}>Sair</Text>
        </TouchableOpacity>

      </ScrollView>

      <NavBar
        onTabChange={(index) => {
          if (index === 0) {
            setShowChat(false);
            setShowWeight(false);
            setShowRecipes(false);
            setShowRecipeSearch(false);
            setShowReport(false);
            setShowProfile(false);
          } else if (index === 1) {
            setShowProfile(true);
          } else if (index === 2) {
            setShowChat(true);
          } else if (index === 3) {
            // placeholder future: scanner
          } else if (index === 4) {
            setShowWeight(true);
          }
        }}
      />
    </View>
  );
}

// ── MacroRow ──────────────────────────────────────────────────────────────────

type MacroRowProps = { label: string; consumed: number; target: number; fillColor: string };

function MacroRow({ label, consumed, target, fillColor }: MacroRowProps) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  return (
    <View style={ss.macroRow}>
      <Text style={ss.macroLabel}>{label}</Text>
      <View style={ss.macroBarTrack}>
        <View style={[ss.macroBarFill, { width: `${pct}%` as any, backgroundColor: fillColor }]} />
      </View>
      <Text style={ss.macroValue}>
        {Math.round(consumed)}
        <Text style={ss.macroOf}> / {target}g</Text>
      </Text>
    </View>
  );
}

// ── MealCard ──────────────────────────────────────────────────────────────────

type MealCardProps = { label: string; kcal: number; onPress: () => void };

function MealCard({ label, kcal, onPress }: MealCardProps) {
  return (
    <TouchableOpacity style={ss.mealCard} onPress={onPress} activeOpacity={0.75}>
      <View style={ss.mealCardInner}>
        <View>
          <Text style={ss.mealCardName}>{label}</Text>
          <Text style={ss.mealCardKcal}>
            {kcal > 0 ? (
              <>
                <Text style={{ color: T.accent }}>{formatKcal(kcal)}</Text>
                <Text> kcal</Text>
              </>
            ) : (
              'Vazio'
            )}
          </Text>
        </View>
        <View style={ss.addBtn}>
          <Text style={ss.addBtnText}>+</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: T.bgBase,
  },
  container: {
    paddingHorizontal: T.sp5,
    paddingTop: 56,
    paddingBottom: 80,
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

  // ── Top row ────────────────────────────────
  topRow: {
    marginBottom: T.sp5,
    gap: T.sp3,
  },
  topRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: T.sp3,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sp3,
    flex: 1,
  },
  eyebrow: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    letterSpacing: 2.4,
    color: T.textTertiary,
    flex: 1,
    textAlign: 'center',
  },
  navArrow: {
    fontFamily: T.fontBody,
    fontSize: T.textMd,
    color: T.textSecondary,
  },
  navArrowDisabled: {
    color: T.textFaint,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sp2,
    paddingHorizontal: T.sp3,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: T.accentLine,
    borderRadius: T.rPill,
    backgroundColor: T.accentBg,
  },
  pulseDot: {
    width: 5,
    height: 5,
    borderRadius: T.rPill,
    backgroundColor: T.accent,
  },
  streakText: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textSecondary,
    letterSpacing: 1.2,
  },

  // ── Hero ───────────────────────────────────
  hero: {
    marginBottom: T.sp6,
  },
  heroHeadline: {
    fontFamily: T.fontDisplay,
    fontSize: T.textLg,
    lineHeight: T.textLg * 1.32,
    color: T.textSecondary,
    letterSpacing: -0.2,
    marginBottom: T.sp6,
  },
  heroHeadlineItalic: {
    fontFamily: T.fontDisplayItalic,
    fontSize: T.textLg,
    color: T.textPrimary,
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: T.sp3,
    marginBottom: T.sp5,
  },
  calorieNum: {
    fontFamily: T.fontDisplay,
    fontSize: 92,
    lineHeight: 92,
    height: 100,
    color: T.textPrimary,
    letterSpacing: -2.2,
    flexShrink: 1,
    minWidth: 210,
  },
  calorieTarget: {
    flexDirection: 'column',
    gap: 3,
    paddingBottom: 6,
  },
  calorieTargetLabel: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    letterSpacing: 1.6,
    color: T.textTertiary,
  },
  calorieTargetNum: {
    fontFamily: T.fontMono,
    fontSize: T.textSm,
    color: T.accent,
    letterSpacing: 0.4,
    fontWeight: '500',
  },
  progressTrack: {
    height: 1,
    backgroundColor: T.borderSoft,
    marginBottom: T.sp2,
  },
  progressFill: {
    height: 1,
    backgroundColor: T.accent,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: T.sp5,
  },
  progressMetaText: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textTertiary,
    letterSpacing: 1.6,
  },
  progressMetaBold: {
    color: T.textSecondary,
    fontFamily: T.fontMonoMedium,
  },
  actions: {
    flexDirection: 'row',
    gap: T.sp3,
    flexWrap: 'wrap',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: T.sp5,
    backgroundColor: T.accent,
    borderWidth: 1,
    borderColor: T.accent,
  },
  btnPrimaryText: {
    fontFamily: T.fontMonoMedium,
    fontSize: T.textXs,
    letterSpacing: 2,
    color: T.bgBase,
  },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: T.sp5,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: T.borderStrong,
  },
  btnGhostText: {
    fontFamily: T.fontMonoMedium,
    fontSize: T.textXs,
    letterSpacing: 2,
    color: T.textPrimary,
  },
  mealPicker: {
    marginTop: T.sp4,
    borderWidth: 1,
    borderColor: T.borderSoft,
    backgroundColor: T.surface1,
  },
  mealPickerBtn: {
    paddingVertical: T.sp3,
    paddingHorizontal: T.sp4,
    borderBottomWidth: 1,
    borderBottomColor: T.borderFaint,
  },
  mealPickerBtnText: {
    fontFamily: T.fontBody,
    fontSize: T.textBase,
    color: T.textPrimary,
  },

  // ── Macros ─────────────────────────────────
  macrosCard: {
    borderTopWidth: 1,
    borderTopColor: T.borderSoft,
    paddingTop: T.sp5,
    marginBottom: T.sp9,
  },
  macrosHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: T.sp3,
    marginBottom: T.sp5,
  },
  macrosTitle: {
    fontFamily: T.fontDisplay,
    fontSize: T.textMd,
    color: T.textPrimary,
    letterSpacing: -0.1,
  },
  macrosRatio: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textTertiary,
    letterSpacing: 1.6,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sp3,
    paddingVertical: T.sp3,
    borderBottomWidth: 1,
    borderBottomColor: T.borderFaint,
  },
  macroLabel: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textSecondary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    width: 70,
  },
  macroBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: T.surface1,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
  },
  macroValue: {
    fontFamily: T.fontMono,
    fontSize: T.textSm,
    color: T.textPrimary,
    textAlign: 'right',
    minWidth: 80,
  },
  macroOf: {
    color: T.textTertiary,
  },

  // ── Section header ──────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: T.sp4,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: T.borderSoft,
  },
  sectionTitle: {
    fontFamily: T.fontDisplayItalic,
    fontSize: T.textXl,
    color: T.textPrimary,
    letterSpacing: -0.5,
    fontWeight: '400',
  },
  sectionMeta: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textTertiary,
    letterSpacing: 1.6,
  },

  // ── Meals grid ─────────────────────────────
  mealsGrid: {
    borderLeftWidth: 1,
    borderLeftColor: T.borderSoft,
    marginBottom: T.sp9,
  },
  mealCard: {
    borderRightWidth: 1,
    borderRightColor: T.borderSoft,
    borderBottomWidth: 1,
    borderBottomColor: T.borderSoft,
  },
  mealCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: T.sp5,
    paddingVertical: T.sp5,
  },
  mealCardName: {
    fontFamily: T.fontDisplay,
    fontSize: T.textLg,
    color: T.textPrimary,
    letterSpacing: -0.3,
    marginBottom: T.sp1,
  },
  mealCardKcal: {
    fontFamily: T.fontMono,
    fontSize: T.textSm,
    color: T.textSecondary,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: T.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: T.fontBody,
    fontSize: T.textMd,
    color: T.textPrimary,
    lineHeight: T.textMd,
  },

  // ── Week chart ─────────────────────────────
  weekChart: {
    flexDirection: 'row',
    gap: T.sp2,
    marginTop: T.sp5,
    marginBottom: T.sp9,
    alignItems: 'flex-end',
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    gap: T.sp2,
  },
  weekBarTrack: {
    width: '100%',
    height: BAR_MAX_H,
    justifyContent: 'flex-end',
  },
  weekBar: {
    width: '100%',
  },
  weekBarDefault: {
    backgroundColor: T.surface2,
  },
  weekBarToday: {
    backgroundColor: T.accentBg,
    borderBottomWidth: 2,
    borderBottomColor: T.accent,
  },
  weekDayLabel: {
    fontFamily: T.fontMono,
    fontSize: 10,
    color: T.textTertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  weekDayLabelToday: {
    color: T.accent,
  },
  weekDayNum: {
    fontFamily: T.fontMono,
    fontSize: 9,
    color: T.textTertiary,
    letterSpacing: 0.4,
  },
  weekDayNumToday: {
    color: T.textSecondary,
  },

  // ── Aux cards (peso / chat) ─────────────────
  auxCard: {
    borderWidth: 1,
    borderColor: T.borderSoft,
    backgroundColor: T.surface1,
    padding: T.sp4,
    marginBottom: T.sp3,
  },
  auxCardLabel: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textSecondary,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: T.sp1,
  },
  auxCardValue: {
    fontFamily: T.fontDisplay,
    fontSize: T.textXl,
    color: T.textPrimary,
    letterSpacing: -0.5,
  },
  auxCardValueEmpty: {
    fontFamily: T.fontDisplay,
    fontSize: T.textXl,
    color: T.textFaint,
  },
  auxCardUnit: {
    fontFamily: T.fontBody,
    fontSize: T.textMd,
    color: T.textSecondary,
  },
  auxCardSub: {
    fontFamily: T.fontBody,
    fontSize: T.textSm,
    color: T.textTertiary,
    marginTop: T.sp1,
  },

  // ── Sign out ───────────────────────────────
  signOutBtn: {
    borderWidth: 1,
    borderColor: T.borderFaint,
    paddingVertical: T.sp3,
    alignItems: 'center',
    marginTop: T.sp5,
  },
  signOutText: {
    fontFamily: T.fontMono,
    fontSize: T.textXs,
    color: T.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
