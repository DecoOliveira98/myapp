import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { type TokenSet } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import PressableButton from '../../components/ui/PressableButton';
import MacroRow from '../../components/meals/MacroRow';
import MealCard from '../../components/meals/MealCard';
import { useTranslation } from 'react-i18next';

const MEALS = [
  { type: 'breakfast' as const, labelKey: 'home.meals.breakfast' },
  { type: 'lunch' as const, labelKey: 'home.meals.lunch' },
  { type: 'dinner' as const, labelKey: 'home.meals.dinner' },
  { type: 'snack' as const, labelKey: 'home.meals.snack' },
];

const BAR_MAX_H = 80;

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function formatDateLong(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

function dayOfWeekShort(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(isoToDate(iso));
}

function formatKcal(n: number): string {
  const r = Math.round(n);
  if (r >= 1000) {
    return `${Math.floor(r / 1000)}.${String(r % 1000).padStart(3, '0')}`;
  }
  return String(r);
}

export interface MealsTabContentProps {
  session: Session;
  targets: {
    daily_calorie_target: number;
    daily_protein_g: number;
    daily_carbs_g: number;
    daily_fat_g: number;
  };
  totals: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    byMeal: Record<string, number>;
  };
  selectedDateISO: string;
  todayISO: string;
  onDateChange: (direction: 'prev' | 'next') => void;
  onMealSelect: (meal: { type: string; labelKey: string }) => void;
  onShowRecipes: () => void;
  onShowRecipeSearch: () => void;
  onShowFasting: () => void;
  headline: string;
  weekData: Record<string, number>;
  activeFasting: { started_at: string; goal_hours?: number | null } | null;
  animKcal: number;
  animPct: number;
  animRemaining: number;
  animProtein: number;
  animCarbs: number;
  animFat: number;
  slideX: Animated.Value;
  slideOpacity: Animated.Value;
  goalPulseAnim: Animated.Value;
  scrollViewRef: RefObject<ScrollView | null>;
  fastingNow: Date;
}

export default function MealsTabContent({
  targets,
  totals,
  selectedDateISO,
  todayISO,
  onDateChange,
  onMealSelect,
  onShowRecipes,
  onShowRecipeSearch,
  onShowFasting,
  headline,
  weekData,
  activeFasting,
  animKcal,
  animPct,
  animRemaining,
  animProtein,
  animCarbs,
  animFat,
  slideX,
  slideOpacity,
  goalPulseAnim,
  scrollViewRef,
  fastingNow,
}: MealsTabContentProps) {
  const { T } = useTheme();
  const { t, i18n } = useTranslation();
  const ss = useMemo(() => makeStyles(T), [T]);
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'pt-BR';
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [mealsY, setMealsY] = useState(600);

  const canGoForward = selectedDateISO !== todayISO;
  const proteinPct = Math.round((targets.daily_protein_g * 4 / targets.daily_calorie_target) * 100);
  const carbsPct = Math.round((targets.daily_carbs_g * 4 / targets.daily_calorie_target) * 100);
  const fatPct = Math.round((targets.daily_fat_g * 9 / targets.daily_calorie_target) * 100);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(todayISO, -(6 - i)));
  const maxWeekKcal = Math.max(
    ...weekDates.map((d) => weekData[d] ?? 0),
    targets.daily_calorie_target,
    1,
  );
  const weekAvgKcal = (() => {
    const vals = weekDates.map((d) => weekData[d] ?? 0).filter((v) => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  })();
  const fastingElapsed = activeFasting
    ? fastingNow.getTime() - new Date(activeFasting.started_at).getTime()
    : 0;
  const fastingH = Math.floor(fastingElapsed / 3_600_000);
  const fastingM = Math.floor((fastingElapsed % 3_600_000) / 60_000);

  return (
    <>
      <View style={ss.dateNav}>
        <TouchableOpacity onPress={() => onDateChange('prev')} hitSlop={14}>
          <Text style={ss.navArrow}>←</Text>
        </TouchableOpacity>
        <Text style={ss.eyebrow} numberOfLines={1}>
          {formatDateLong(isoToDate(selectedDateISO), locale).toUpperCase()}
        </Text>
        <TouchableOpacity
          onPress={() => onDateChange('next')}
          disabled={!canGoForward}
          hitSlop={14}
        >
          <Text style={[ss.navArrow, !canGoForward && ss.navArrowDisabled]}>→</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ transform: [{ translateX: slideX }], opacity: slideOpacity }}>
        <View style={ss.hero}>
          <Text style={ss.heroHeadlineItalic}>{headline}</Text>

          <View style={ss.calorieRow}>
            <Text style={ss.calorieNum} adjustsFontSizeToFit numberOfLines={1}>
              {formatKcal(animKcal)}
            </Text>
            <View style={ss.calorieTarget}>
              <Text style={ss.calorieTargetLabel}>{t('home.dailyTarget').toUpperCase()}</Text>
              <Text style={ss.calorieTargetNum}>{formatKcal(targets.daily_calorie_target)} kcal</Text>
            </View>
          </View>

          <View style={ss.progressBarContainer}>
            <View style={ss.progressTrack}>
              <View style={[ss.progressFill, { width: `${animPct}%` as `${number}%` }]} />
            </View>
            <Animated.View
              pointerEvents="none"
              style={[ss.goalPulseOverlay, { opacity: goalPulseAnim }]}
            />
          </View>
          <View style={ss.progressMeta}>
            <Text style={ss.progressMetaText}>
              <Text style={ss.progressMetaBold}>{Math.round(animPct)}%</Text> {t('home.consumed')}
            </Text>
            <Text style={ss.progressMetaText}>{t('home.kcalRemaining', { value: formatKcal(animRemaining) })}</Text>
          </View>

          <View style={ss.actions}>
            <PressableButton
              style={ss.btnPrimary}
              onPress={() => setShowMealPicker((v) => !v)}
            >
              <Text style={ss.btnPrimaryText}>{`${t('home.register').toUpperCase()}  ↗`}</Text>
            </PressableButton>
            <PressableButton
              style={ss.btnGhost}
              onPress={() => scrollViewRef.current?.scrollTo({ y: mealsY, animated: true })}
            >
              <Text style={ss.btnGhostText}>{t('home.viewDetails').toUpperCase()}</Text>
            </PressableButton>
          </View>

          {showMealPicker && (
            <View style={ss.mealPicker}>
              {MEALS.map((meal) => (
                <TouchableOpacity
                  key={meal.type}
                  style={ss.mealPickerBtn}
                  onPress={() => {
                    onMealSelect(meal);
                    setShowMealPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={ss.mealPickerBtnText}>{t(meal.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={ss.macrosCard}>
          <View style={ss.macrosHeader}>
            <Text style={ss.macrosTitle}>{t('home.macros')}</Text>
            <Text style={ss.macrosRatio}>{proteinPct}P · {carbsPct}C · {fatPct}G</Text>
          </View>
          <MacroRow label={t('home.macrosProtein')} consumed={animProtein} target={targets.daily_protein_g} fillColor={T.accent} ss={ss} />
          <MacroRow label={t('home.macrosCarbs')} consumed={animCarbs} target={targets.daily_carbs_g} fillColor={T.macroCarbs} ss={ss} />
          <MacroRow label={t('home.macrosFat')} consumed={animFat} target={targets.daily_fat_g} fillColor={T.macroFat} ss={ss} />
        </View>

        <View
          style={ss.sectionHeader}
          onLayout={(e) => setMealsY(e.nativeEvent.layout.y)}
        >
          <Text style={ss.sectionTitle}>{t('home.todayMeals')}</Text>
          <Text style={ss.sectionMeta}>{t('home.mealsCount', { count: MEALS.length })}</Text>
        </View>

        <View style={ss.mealsGrid}>
          {MEALS.map((meal) => (
            <MealCard
              key={meal.type}
              label={t(meal.labelKey)}
              kcal={totals.byMeal[meal.type] ?? 0}
              onPress={() => onMealSelect(meal)}
              ss={ss}
            />
          ))}
        </View>

        <View style={ss.sectionHeader}>
          <Text style={ss.sectionTitle}>{t('home.lastSevenDays')}</Text>
          {weekAvgKcal > 0 && (
            <Text style={ss.sectionMeta}>{t('home.weekAverageKcal', { value: formatKcal(weekAvgKcal) })}</Text>
          )}
        </View>

        <View style={ss.weekChart}>
          {weekDates.map((date) => {
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
                  {dayOfWeekShort(date, locale)}
                </Text>
                <Text style={[ss.weekDayNum, isThisToday && ss.weekDayNumToday]}>
                  {dayKcal > 0 ? String(Math.round(dayKcal)) : '—'}
                </Text>
              </View>
            );
          })}
        </View>

        <PressableButton style={ss.auxCard} onPress={onShowRecipes}>
          <Text style={ss.auxCardLabel}>{t('home.cards.recipes')}</Text>
          <Text style={ss.auxCardSub}>{t('home.cards.frequentFoodShortcuts')}</Text>
        </PressableButton>

        <PressableButton style={ss.auxCard} onPress={onShowRecipeSearch}>
          <Text style={ss.auxCardLabel}>{t('home.cards.exploreRecipes')}</Text>
          <Text style={ss.auxCardSub}>{t('home.cards.searchSpoonacular')}</Text>
        </PressableButton>

        <PressableButton style={ss.auxCard} onPress={onShowFasting}>
          <Text style={ss.auxCardLabel}>{t('home.cards.fasting')}</Text>
          {activeFasting !== null ? (
            <>
              <Text style={ss.auxCardValue}>
                {t('home.fasting.activeFor', { h: fastingH, m: fastingM })}
              </Text>
              <Text style={ss.auxCardSub}>{t('home.cards.tapToEndOrDetails')}</Text>
            </>
          ) : (
            <Text style={ss.auxCardSub}>{t('home.cards.tapToStart')}</Text>
          )}
        </PressableButton>
      </Animated.View>
    </>
  );
}

function makeStyles(tokens: TokenSet) {
  return StyleSheet.create({
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.sp3,
      marginBottom: tokens.sp5,
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
    hero: {
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
    progressBarContainer: {
      marginBottom: tokens.sp2,
      position: 'relative',
    },
    progressTrack: {
      height: 1,
      backgroundColor: tokens.borderSoft,
    },
    progressFill: {
      height: 1,
      backgroundColor: tokens.accent,
    },
    goalPulseOverlay: {
      position: 'absolute',
      top: -6,
      left: 0,
      right: 0,
      bottom: -6,
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
    auxCardSub: {
      fontFamily: tokens.fontBody,
      fontSize: tokens.textSm,
      color: tokens.textTertiary,
      marginTop: tokens.sp1,
    },
    accentText: {
      color: tokens.accentText,
    },
  });
}
