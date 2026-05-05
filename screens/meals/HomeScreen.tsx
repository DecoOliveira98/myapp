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
import { type TokenSet } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
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
  const { T } = useTheme();
  const ss = useMemo(() => makeStyles(T), [T]);

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
    <View style={{ flex: 1, backgroundColor: T.bgBase }}>
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
          <MacroRow label="Proteína" consumed={totals.protein_g} target={targets.daily_protein_g} fillColor={T.accent} ss={ss} />
          <MacroRow label="Carbo" consumed={totals.carbs_g} target={targets.daily_carbs_g} fillColor={T.macroCarbs} ss={ss} />
          <MacroRow label="Gordura" consumed={totals.fat_g} target={targets.daily_fat_g} fillColor={T.macroFat} ss={ss} />
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
              ss={ss}
            />
          ))}
        </View>

        {/* ── Últimos 7 dias ─────────────────────────────────────────── */}
        <View style={ss.sectionHeader}>
          <Text style={ss.sectionTitle}>Últimos sete dias</Text>
          {weekAvgKcal > 0 && (
            <Text style={ss.sectionMeta}>
              média{' '}
              <Text style={ss.accentText}>{formatKcal(weekAvgKcal)}</Text>
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

type MacroRowProps = { label: string; consumed: number; target: number; fillColor: string; ss: Styles };

function MacroRow({ label, consumed, target, fillColor, ss }: MacroRowProps) {
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

type MealCardProps = { label: string; kcal: number; onPress: () => void; ss: Styles };

function MealCard({ label, kcal, onPress, ss }: MealCardProps) {
  return (
    <TouchableOpacity style={ss.mealCard} onPress={onPress} activeOpacity={0.75}>
      <View style={ss.mealCardInner}>
        <View>
          <Text style={ss.mealCardName}>{label}</Text>
          <Text style={ss.mealCardKcal}>
            {kcal > 0 ? (
              <>
                <Text style={ss.accentText}>{formatKcal(kcal)}</Text>
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

function makeStyles(tokens: TokenSet) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: tokens.bgBase,
    },
    container: {
      paddingHorizontal: tokens.sp5,
      paddingTop: 56,
      paddingBottom: 80,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: tokens.bgBase,
    },
    bodyText: {
      fontFamily: tokens.fontBody,
      fontSize: tokens.textBase,
      color: tokens.textSecondary,
    },

    // ── Top row ────────────────────────────────
    topRow: {
      marginBottom: tokens.sp5,
      gap: tokens.sp3,
    },
    topRowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: tokens.sp3,
    },
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.sp3,
      flex: 1,
    },
    eyebrow: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textXs,
      letterSpacing: 2.4,
      color: tokens.textTertiary,
      flex: 1,
      textAlign: 'center',
    },
    navArrow: {
      fontFamily: tokens.fontBody,
      fontSize: tokens.textMd,
      color: tokens.textSecondary,
    },
    navArrowDisabled: {
      color: tokens.textFaint,
    },
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.sp2,
      paddingHorizontal: tokens.sp3,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: tokens.accentLine,
      borderRadius: tokens.rPill,
      backgroundColor: tokens.accentBg,
    },
    pulseDot: {
      width: 5,
      height: 5,
      borderRadius: tokens.rPill,
      backgroundColor: tokens.accent,
    },
    streakText: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textXs,
      color: tokens.textSecondary,
      letterSpacing: 1.2,
    },

    // ── Hero ───────────────────────────────────
    hero: {
      marginBottom: tokens.sp6,
    },
    heroHeadline: {
      fontFamily: tokens.fontDisplay,
      fontSize: tokens.textLg,
      lineHeight: tokens.textLg * 1.32,
      color: tokens.textSecondary,
      letterSpacing: -0.2,
      marginBottom: tokens.sp6,
    },
    heroHeadlineItalic: {
      fontFamily: tokens.fontDisplayItalic,
      fontSize: tokens.textLg,
      color: tokens.textPrimary,
    },
    calorieRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: tokens.sp3,
      marginBottom: tokens.sp5,
    },
    calorieNum: {
      fontFamily: tokens.fontDisplay,
      fontSize: 92,
      lineHeight: 92,
      height: 100,
      color: tokens.textPrimary,
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
      fontFamily: tokens.fontMono,
      fontSize: tokens.textXs,
      letterSpacing: 1.6,
      color: tokens.textTertiary,
    },
    calorieTargetNum: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textSm,
      color: tokens.accentText,
      letterSpacing: 0.4,
      fontWeight: '500',
    },
    progressTrack: {
      height: 1,
      backgroundColor: tokens.borderSoft,
      marginBottom: tokens.sp2,
    },
    progressFill: {
      height: 1,
      backgroundColor: tokens.accent,
    },
    progressMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: tokens.sp5,
    },
    progressMetaText: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textXs,
      color: tokens.textTertiary,
      letterSpacing: 1.6,
    },
    progressMetaBold: {
      color: tokens.textSecondary,
      fontFamily: tokens.fontMonoMedium,
    },
    actions: {
      flexDirection: 'row',
      gap: tokens.sp3,
      flexWrap: 'wrap',
    },
    btnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: tokens.sp5,
      backgroundColor: tokens.accent,
      borderWidth: 1,
      borderColor: tokens.accent,
    },
    btnPrimaryText: {
      fontFamily: tokens.fontMonoMedium,
      fontSize: tokens.textXs,
      letterSpacing: 2,
      color: tokens.bgBase,
    },
    btnGhost: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: tokens.sp5,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: tokens.borderStrong,
    },
    btnGhostText: {
      fontFamily: tokens.fontMonoMedium,
      fontSize: tokens.textXs,
      letterSpacing: 2,
      color: tokens.textPrimary,
    },
    mealPicker: {
      marginTop: tokens.sp4,
      borderWidth: 1,
      borderColor: tokens.borderSoft,
      backgroundColor: tokens.surface1,
    },
    mealPickerBtn: {
      paddingVertical: tokens.sp3,
      paddingHorizontal: tokens.sp4,
      borderBottomWidth: 1,
      borderBottomColor: tokens.borderFaint,
    },
    mealPickerBtnText: {
      fontFamily: tokens.fontBody,
      fontSize: tokens.textBase,
      color: tokens.textPrimary,
    },

    // ── Macros ─────────────────────────────────
    macrosCard: {
      borderTopWidth: 1,
      borderTopColor: tokens.borderSoft,
      paddingTop: tokens.sp5,
      marginBottom: tokens.sp9,
    },
    macrosHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: tokens.sp3,
      marginBottom: tokens.sp5,
    },
    macrosTitle: {
      fontFamily: tokens.fontDisplay,
      fontSize: tokens.textMd,
      color: tokens.textPrimary,
      letterSpacing: -0.1,
    },
    macrosRatio: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textXs,
      color: tokens.textTertiary,
      letterSpacing: 1.6,
    },
    macroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.sp3,
      paddingVertical: tokens.sp3,
      borderBottomWidth: 1,
      borderBottomColor: tokens.borderFaint,
    },
    macroLabel: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textXs,
      color: tokens.textSecondary,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      width: 70,
    },
    macroBarTrack: {
      flex: 1,
      height: 4,
      backgroundColor: tokens.trackBg,
      overflow: 'hidden',
    },
    macroBarFill: {
      height: '100%',
    },
    macroValue: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textSm,
      color: tokens.textPrimary,
      textAlign: 'right',
      minWidth: 80,
    },
    macroOf: {
      color: tokens.textTertiary,
    },

    // ── Section header ──────────────────────────
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingBottom: tokens.sp4,
      marginBottom: 0,
      borderBottomWidth: 1,
      borderBottomColor: tokens.borderSoft,
    },
    sectionTitle: {
      fontFamily: tokens.fontDisplayItalic,
      fontSize: tokens.textXl,
      color: tokens.textPrimary,
      letterSpacing: -0.5,
      fontWeight: '400',
    },
    sectionMeta: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textXs,
      color: tokens.textTertiary,
      letterSpacing: 1.6,
    },

    // ── Meals grid ─────────────────────────────
    mealsGrid: {
      borderLeftWidth: 1,
      borderLeftColor: tokens.borderSoft,
      marginBottom: tokens.sp9,
    },
    mealCard: {
      borderRightWidth: 1,
      borderRightColor: tokens.borderSoft,
      borderBottomWidth: 1,
      borderBottomColor: tokens.borderSoft,
    },
    mealCardInner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: tokens.sp5,
      paddingVertical: tokens.sp5,
    },
    mealCardName: {
      fontFamily: tokens.fontDisplay,
      fontSize: tokens.textLg,
      color: tokens.textPrimary,
      letterSpacing: -0.3,
      marginBottom: tokens.sp1,
    },
    mealCardKcal: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textSm,
      color: tokens.textSecondary,
    },
    addBtn: {
      width: 34,
      height: 34,
      borderWidth: 1,
      borderColor: tokens.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnText: {
      fontFamily: tokens.fontBody,
      fontSize: tokens.textMd,
      color: tokens.textPrimary,
      lineHeight: tokens.textMd,
    },

    // ── Week chart ─────────────────────────────
    weekChart: {
      flexDirection: 'row',
      gap: tokens.sp2,
      marginTop: tokens.sp5,
      marginBottom: tokens.sp9,
      alignItems: 'flex-end',
    },
    weekDay: {
      flex: 1,
      alignItems: 'center',
      gap: tokens.sp2,
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
      backgroundColor: tokens.surface2,
    },
    weekBarToday: {
      backgroundColor: tokens.accentBg,
      borderBottomWidth: 2,
      borderBottomColor: tokens.accent,
    },
    weekDayLabel: {
      fontFamily: tokens.fontMono,
      fontSize: 10,
      color: tokens.textTertiary,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    weekDayLabelToday: {
      color: tokens.accent,
    },
    weekDayNum: {
      fontFamily: tokens.fontMono,
      fontSize: 9,
      color: tokens.textTertiary,
      letterSpacing: 0.4,
    },
    weekDayNumToday: {
      color: tokens.textSecondary,
    },

    // ── Aux cards ──────────────────────────────
    auxCard: {
      borderWidth: 1,
      borderColor: tokens.borderSoft,
      backgroundColor: tokens.surface1,
      padding: tokens.sp4,
      marginBottom: tokens.sp3,
    },
    auxCardLabel: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textXs,
      color: tokens.textSecondary,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      marginBottom: tokens.sp1,
    },
    auxCardValue: {
      fontFamily: tokens.fontDisplay,
      fontSize: tokens.textXl,
      color: tokens.textPrimary,
      letterSpacing: -0.5,
    },
    auxCardValueEmpty: {
      fontFamily: tokens.fontDisplay,
      fontSize: tokens.textXl,
      color: tokens.textFaint,
    },
    auxCardUnit: {
      fontFamily: tokens.fontBody,
      fontSize: tokens.textMd,
      color: tokens.textSecondary,
    },
    auxCardSub: {
      fontFamily: tokens.fontBody,
      fontSize: tokens.textSm,
      color: tokens.textTertiary,
      marginTop: tokens.sp1,
    },

    // ── Sign out ───────────────────────────────
    signOutBtn: {
      borderWidth: 1,
      borderColor: tokens.borderFaint,
      paddingVertical: tokens.sp3,
      alignItems: 'center',
      marginTop: tokens.sp5,
    },
    signOutText: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textXs,
      color: tokens.textTertiary,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },

    // ── Utility ────────────────────────────────
    accentText: {
      color: tokens.accentText,
    },
  });
}

type Styles = ReturnType<typeof makeStyles>;
