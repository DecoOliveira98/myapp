import { useCallback, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const LOOKBACK_DAYS = 35;

export type UserVoiceContext = {
  streakDays: number;
  daysSinceLastLog: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

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

function calendarDaysBetween(fromIso: string, toIso: string): number {
  const from = isoToDate(fromIso);
  const to = isoToDate(toIso);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function computeGoalStreak(dailyKcal: Record<string, number>, target: number, todayISO: string): number {
  if (target <= 0) return 0;

  let checkDate = todayISO;
  if ((dailyKcal[todayISO] ?? 0) < target) {
    checkDate = addDaysIso(todayISO, -1);
  }

  let count = 0;
  for (let i = 0; i < LOOKBACK_DAYS; i++) {
    if ((dailyKcal[checkDate] ?? 0) >= target) {
      count++;
      checkDate = addDaysIso(checkDate, -1);
    } else {
      break;
    }
  }
  return count;
}

export function useUserVoiceContext(
  session: Session,
  calorieTarget: number | null,
): UserVoiceContext {
  const [streakDays, setStreakDays] = useState(0);
  const [daysSinceLastLog, setDaysSinceLastLog] = useState(0);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) {
      await inFlightRef.current;
      return;
    }

    const userId = session.user.id;
    const todayISO = isoToday();

    setLoading(true);

    const run = async () => {
      const oldest = addDaysIso(todayISO, -(LOOKBACK_DAYS - 1));
      const [foodsRes, lastMealRes] = await Promise.all([
        supabase
          .from('meal_foods')
          .select('calories, meals!inner(user_id, date)')
          .eq('meals.user_id', userId)
          .gte('meals.date', oldest)
          .lte('meals.date', todayISO),
        supabase
          .from('meals')
          .select('date')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const dailyKcal: Record<string, number> = {};
      if (!foodsRes.error) {
        for (const item of foodsRes.data ?? []) {
          const mf = item.meals as { date: string } | { date: string }[] | null | undefined;
          const meal = Array.isArray(mf) ? mf[0] : mf;
          const date = meal?.date;
          if (!date) continue;
          dailyKcal[date] = (dailyKcal[date] ?? 0) + (item.calories ?? 0);
        }
      }

      const target = calorieTarget ?? 0;
      setStreakDays(computeGoalStreak(dailyKcal, target, todayISO));

      if (lastMealRes.error || !lastMealRes.data?.date) {
        setDaysSinceLastLog(Number.POSITIVE_INFINITY);
      } else {
        setDaysSinceLastLog(Math.max(0, calendarDaysBetween(lastMealRes.data.date as string, todayISO)));
      }

      setLoading(false);
    };

    inFlightRef.current = run();
    try {
      await inFlightRef.current;
    } finally {
      inFlightRef.current = null;
    }
  }, [session.user.id, calorieTarget]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { streakDays, daysSinceLastLog, loading, refresh };
}
