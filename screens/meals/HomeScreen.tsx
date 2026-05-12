import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
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
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { useUserVoiceContext } from '../../hooks/useUserVoiceContext';
import { useVoiceHeadline } from '../../hooks/useVoiceHeadline';
import ProfileScreen from '../profile/ProfileScreen';
import MealsTabContent from './MealsTabContent';
import RoutinesListScreen from '../workout/RoutinesListScreen';
import ActiveWorkoutScreen from '../workout/ActiveWorkoutScreen';
import GenerateWorkoutScreen from '../workout/GenerateWorkoutScreen';
import { rescheduleAllNotifications } from '../../lib/notifications/scheduler';
import { useTranslation } from 'react-i18next';
import PressableButton from '../../components/ui/PressableButton';

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

type MealEntry = { type: 'breakfast' | 'lunch' | 'dinner' | 'snack'; labelKey: string };

type WeightSummary = {
  current: number | null;
  currentDate: string | null;
  firstDate: string | null;
  diff: number | null;
};

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

function formatDateShort(iso: string, locale: string): string {
  const d = isoToDate(iso);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d);
}

function formatKcal(n: number): string {
  const r = Math.round(n);
  if (r >= 1000) {
    return `${Math.floor(r / 1000)}.${String(r % 1000).padStart(3, '0')}`;
  }
  return String(r);
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ session }: Props) {
  const { T } = useTheme();
  const { t, i18n } = useTranslation();
  const ss = useMemo(() => makeStyles(T), [T]);

  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'pt-BR';
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
  const [activeTab, setActiveTab] = useState(0);
  const [showRoutinesList, setShowRoutinesList] = useState(false);
  const [activeWorkoutRoutineId, setActiveWorkoutRoutineId] = useState<string | null | undefined>(
    undefined,
  );
  const [showGenerateWorkout, setShowGenerateWorkout] = useState(false);

  const { profile, loading, error: profileError, refetch: refetchProfile } = useProfile(session);
  const {
    streakDays,
    daysSinceLastLog,
    refresh: refreshVoiceContext,
  } = useUserVoiceContext(session, profile?.daily_calorie_target ?? null);
  const [activeFasting, setActiveFasting] = useState<ActiveFasting | null>(null);
  const [fastingNow, setFastingNow] = useState(new Date());
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
    t('common.noEmail');

  const scrollViewRef = useRef<ScrollView>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  // ── Goal-reached celebration state ───────────────────────────────────────
  const goalPulseAnim = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(1)).current;
  // Keyed by date: true once the pulse has fired for that day
  const goalPulsedRef = useRef<Record<string, boolean>>({});
  // Keyed by date: true after loadTotals resolves for that date (distinguishes initial useState 0 from real data)
  const firstRealLoadRef = useRef<Record<string, boolean>>({});
  // Keyed by date: last real kcal value seen, for transition detection
  const prevKcalRef = useRef<Record<string, number>>({});

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
    // Signal that real data (not the initial useState zero) has loaded for this date
    firstRealLoadRef.current[selectedDateISO] = true;
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
    if (selectedMeal === null) {
      void Promise.all([loadTotals(), loadWeekData(), refreshVoiceContext()]);
    }
  }, [selectedMeal, loadTotals, loadWeekData, refreshVoiceContext]);

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

  // ── Goal-reached detection ─────────────────────────────────────────────────
  useEffect(() => {
    if (!targets || !firstRealLoadRef.current[selectedDateISO]) return;

    const target = targets.daily_calorie_target;
    const prev = prevKcalRef.current[selectedDateISO];
    prevKcalRef.current[selectedDateISO] = totals.kcal;

    if (prev === undefined) return; // first real data for this date → baseline only

    if (
      prev < target &&
      totals.kcal >= target &&
      !goalPulsedRef.current[selectedDateISO]
    ) {
      goalPulsedRef.current[selectedDateISO] = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Delay matches the 300ms bar animation + 50ms breath
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(goalPulseAnim, {
            toValue: 0.6,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(goalPulseAnim, {
            toValue: 0,
            duration: 250,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }, 350);
    }
  }, [totals.kcal, selectedDateISO, targets]);

  async function handleSignOut() { await supabase.auth.signOut(); }

  function animateDayChange(direction: 'next' | 'prev') {
    if (direction === 'next' && selectedDateISO === todayISO) return;
    const sign = direction === 'next' ? -1 : 1;
    const newDate = addDaysIso(selectedDateISO, direction === 'next' ? 1 : -1);
    Animated.parallel([
      Animated.timing(slideX, { toValue: sign * 24, duration: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideOpacity, { toValue: 0, duration: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      setSelectedDateISO(newDate);
      slideX.setValue(-sign * 24);
      Animated.parallel([
        Animated.timing(slideX, { toValue: 0, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(slideOpacity, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  }

  // ── Animation hooks (must be before early returns) ────────────────────────
  // Raw values use safe fallbacks so hooks are always called unconditionally.
  const _animTarget = targets?.daily_calorie_target ?? 1;
  const _progressPctRaw = Math.min((totals.kcal / _animTarget) * 100, 100);
  const _remainingRaw = Math.max(_animTarget - totals.kcal, 0);

  const animKcal = useAnimatedNumber(totals.kcal, selectedDateISO);
  const animPct = useAnimatedNumber(_progressPctRaw, selectedDateISO);
  const animRemaining = useAnimatedNumber(_remainingRaw, selectedDateISO);
  const animProtein = useAnimatedNumber(totals.protein_g, selectedDateISO);
  const animCarbs = useAnimatedNumber(totals.carbs_g, selectedDateISO);
  const animFat = useAnimatedNumber(totals.fat_g, selectedDateISO);

  const isToday = selectedDateISO === todayISO;
  const mealsCountToday = useMemo(
    () => Object.values(totals.byMeal).filter(kcal => kcal > 0).length,
    [totals.byMeal],
  );
  const headline = useVoiceHeadline({
    totalsKcal: totals.kcal,
    targetKcal: targets?.daily_calorie_target ?? 0,
    mealsCountToday,
    streakDays,
    daysSinceLastLog,
    currentHour: new Date().getHours(),
    isToday,
  });

  const rescheduleNotifications = useCallback(async () => {
    if (!targets) return;
    await rescheduleAllNotifications(
      {
        streakDays,
        totalsKcal: totals.kcal,
        targetKcal: targets.daily_calorie_target,
        hasLoggedToday: totals.kcal > 0,
        lastLogDate: totals.kcal > 0 ? todayISO : null,
        currentHour: new Date().getHours(),
      },
      i18n.language ?? 'pt',
    );
  }, [i18n.language, streakDays, targets, todayISO, totals.kcal]);

  useEffect(() => {
    if (loading || !targets) return;
    void rescheduleNotifications();
  }, [loading, rescheduleNotifications, targets]);

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={ss.centered}>
        <Text style={[ss.eyebrow, { marginBottom: 0 }]}>{t('common.loading')}...</Text>
      </View>
    );
  }
  if (profileError) {
    return (
      <View style={ss.centered}>
        <Text style={ss.bodyText}>{t('home.errors.loadProfile')}</Text>
      </View>
    );
  }
  if (!targets || targets.daily_calorie_target == null) {
    return (
      <View style={ss.centered}>
        <Text style={ss.bodyText}>{t('home.errors.completeOnboarding')}</Text>
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
        onRescheduleNotifications={rescheduleNotifications}
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
        mealLabel={t(selectedMeal.labelKey)}
        date={selectedDateISO}
        onClose={() => setSelectedMeal(null)}
        onMealSaved={
          selectedDateISO === todayISO
            ? async () => {
                await refreshVoiceContext();
                await loadTotals();
                await rescheduleNotifications();
              }
            : undefined
        }
      />
    );
  }
  if (showWeight) return <WeightScreen session={session} onClose={() => setShowWeight(false)} />;
  if (showGenerateWorkout) {
    return (
      <GenerateWorkoutScreen
        session={session}
        onClose={() => setShowGenerateWorkout(false)}
        onPlanSaved={() => setShowGenerateWorkout(false)}
      />
    );
  }
  if (activeWorkoutRoutineId !== undefined) {
    return (
      <ActiveWorkoutScreen
        session={session}
        routineId={activeWorkoutRoutineId}
        onClose={() => setActiveWorkoutRoutineId(undefined)}
        onWorkoutSaved={() => setActiveWorkoutRoutineId(undefined)}
      />
    );
  }
  if (showRoutinesList) {
    return (
      <RoutinesListScreen
        session={session}
        onClose={() => {
          setShowRoutinesList(false);
          setActiveTab(0);
        }}
        onStartWorkout={(routineId) => setActiveWorkoutRoutineId(routineId)}
        onGenerateWorkout={() => setShowGenerateWorkout(true)}
      />
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const mealsTotals = {
    kcal: totals.kcal,
    protein: totals.protein_g,
    carbs: totals.carbs_g,
    fat: totals.fat_g,
    byMeal: totals.byMeal,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: T.bgBase }}>
      <ScrollView
        ref={scrollViewRef}
        style={ss.scroll}
        contentContainerStyle={ss.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={ss.topRow}>
          <View style={ss.topRowMain}>
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
            <Text style={ss.streakText}>{t('home.streakDays', { count: streak })}</Text>
          </View>
        </View>

        {activeTab === 0 && (
          <>
            <View style={ss.dashboardSummary}>
              <Text style={ss.dashboardEyebrow}>{t('home.dailyTarget').toUpperCase()}</Text>
              <Text style={ss.dashboardKcal}>{formatKcal(totals.kcal)}</Text>
              <Text style={ss.dashboardSub}>
                {t('home.kcalRemaining', { value: formatKcal(Math.max(targets.daily_calorie_target - totals.kcal, 0)) })}
              </Text>
              <Text style={ss.dashboardPlaceholder}>Dashboard em construção</Text>
            </View>

            <PressableButton style={ss.auxCard} onPress={() => setShowWeight(true)}>
              <Text style={ss.auxCardLabel}>{t('home.cards.weight')}</Text>
              {weight.current === null ? (
                <>
                  <Text style={ss.auxCardValueEmpty}>—</Text>
                  <Text style={ss.auxCardSub}>{t('home.cards.tapToRegister')}</Text>
                </>
              ) : (
                <>
                  <Text style={ss.auxCardValue}>
                    {weight.current}
                    <Text style={ss.auxCardUnit}> kg</Text>
                  </Text>
                  <Text style={ss.auxCardSub}>
                    {weight.diff === null
                      ? t('home.weight.firstWeighIn', { date: formatDateShort(weight.currentDate!, locale) })
                      : weight.diff === 0
                        ? t('home.weight.noChangeSince', { date: formatDateShort(weight.firstDate!, locale) })
                        : t('home.weight.changeSince', {
                          direction: weight.diff < 0 ? '↓' : '↑',
                          value: Math.abs(weight.diff),
                          date: formatDateShort(weight.firstDate!, locale),
                        })}
                  </Text>
                </>
              )}
            </PressableButton>

            <TouchableOpacity style={ss.signOutBtn} onPress={handleSignOut} activeOpacity={0.6}>
              <Text style={ss.signOutText}>{t('common.signOut')}</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === 1 && (
          <MealsTabContent
            session={session}
            targets={targets}
            totals={mealsTotals}
            selectedDateISO={selectedDateISO}
            todayISO={todayISO}
            onDateChange={animateDayChange}
            onMealSelect={(meal) => setSelectedMeal(meal as MealEntry)}
            onShowRecipes={() => setShowRecipes(true)}
            onShowRecipeSearch={() => setShowRecipeSearch(true)}
            onShowFasting={() => setShowFasting(true)}
            headline={headline}
            weekData={weekData}
            activeFasting={activeFasting}
            animKcal={animKcal}
            animPct={animPct}
            animRemaining={animRemaining}
            animProtein={animProtein}
            animCarbs={animCarbs}
            animFat={animFat}
            slideX={slideX}
            slideOpacity={slideOpacity}
            goalPulseAnim={goalPulseAnim}
            scrollViewRef={scrollViewRef}
            fastingNow={fastingNow}
          />
        )}

      </ScrollView>

      <NavBar
        onTabChange={(index) => {
          setActiveTab(index);
          setShowChat(false);
          setShowWeight(false);
          setShowRecipes(false);
          setShowRecipeSearch(false);
          setShowReport(false);
          setShowProfile(false);
          setShowFasting(false);
          setShowRoutinesList(false);
          setActiveWorkoutRoutineId(undefined);
          setShowGenerateWorkout(false);

          if (index === 2) setShowChat(true);
          if (index === 3) setShowRoutinesList(true);
          if (index === 4) setShowWeight(true);
        }}
      />
    </View>
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
    eyebrow: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textXs,
      letterSpacing: 2.4,
      color: tokens.textTertiary,
    },

    // ── Top row ────────────────────────────────
    topRow: {
      marginBottom: tokens.sp5,
      gap: tokens.sp3,
    },
    topRowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: tokens.sp3,
    },
    dashboardSummary: {
      marginBottom: tokens.sp6,
      gap: tokens.sp2,
    },
    dashboardEyebrow: {
      fontFamily: tokens.fontMono,
      fontSize: tokens.textXs,
      letterSpacing: 1.6,
      color: tokens.textTertiary,
    },
    dashboardKcal: {
      fontFamily: tokens.fontDisplay,
      fontSize: tokens.textXl,
      color: tokens.textPrimary,
      letterSpacing: -0.5,
    },
    dashboardSub: {
      fontFamily: tokens.fontBody,
      fontSize: tokens.textSm,
      color: tokens.textSecondary,
    },
    dashboardPlaceholder: {
      fontFamily: tokens.fontBody,
      fontSize: tokens.textBase,
      color: tokens.textTertiary,
      marginTop: tokens.sp4,
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
  });
}
