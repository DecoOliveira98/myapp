import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { TFunction } from 'i18next';
import i18n from '../../i18n';
import { pickVoiceFrase } from '../../hooks/useVoiceHeadline';
import { getLastAppOpenedAt, getNotificationsEnabled } from './preferences';

export type UserVoiceContext = {
  streakDays: number;
  totalsKcal: number;
  targetKcal: number;
  hasLoggedToday: boolean;
  lastLogDate: string | null;
  currentHour: number;
};

const TRIGGER_MORNING_EMPTY = 'voice-morning-empty';
const TRIGGER_ABSENCE = 'voice-absence';
const TRIGGER_STREAK_WARNING = 'voice-streak-warning';
const TRIGGER_WEEKLY_WEIGH_IN = 'voice-weekly-weigh-in';

function isQuietHour(hour: number): boolean {
  return hour >= 22 || hour < 7;
}

function withTime(base: Date, hour: number, minute: number): Date {
  const next = new Date(base);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function shiftOutOfQuietHours(date: Date, morningHour: 7 | 8): Date {
  if (!isQuietHour(date.getHours())) return date;
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + (date.getHours() >= 22 ? 1 : 0));
  shifted.setHours(morningHour, 0, 0, 0);
  return shifted;
}

function nextOccurrence(hour: number, minute: number, now = new Date()): Date {
  const candidate = withTime(now, hour, minute);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

function nextSundayAt18(now = new Date()): Date {
  const candidate = withTime(now, 18, 0);
  const daysUntilSunday = (7 - candidate.getDay()) % 7;
  candidate.setDate(candidate.getDate() + daysUntilSunday);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: undefined,
  });
}

function resolveTranslator(locale: string): TFunction {
  const lng = locale.startsWith('en') ? 'en' : 'pt';
  return i18n.getFixedT(lng);
}

async function scheduleAt(
  identifier: string,
  triggerKey: string,
  date: Date,
  t: TFunction,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: '',
      body: pickVoiceFrase(triggerKey, t),
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
}

export async function rescheduleAllNotifications(ctx: UserVoiceContext, locale: string): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const enabled = await getNotificationsEnabled();
  if (!enabled) return;

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  await ensureAndroidChannel();

  const now = new Date();
  const t = resolveTranslator(locale);

  if (!ctx.hasLoggedToday) {
    await scheduleAt(TRIGGER_MORNING_EMPTY, 'emptyMorning', nextOccurrence(9, 30, now), t);
  }

  const lastOpened = (await getLastAppOpenedAt()) ?? now;
  const absenceAt = shiftOutOfQuietHours(new Date(lastOpened.getTime() + 48 * 60 * 60 * 1000), 8);
  if (absenceAt.getTime() > now.getTime()) {
    await scheduleAt(TRIGGER_ABSENCE, 'pushAbsence', absenceAt, t);
  }

  if (ctx.streakDays >= 3 && !ctx.hasLoggedToday) {
    const streakAt = withTime(now, 21, 0);
    if (streakAt.getTime() > now.getTime()) {
      await scheduleAt(TRIGGER_STREAK_WARNING, 'pushStreakWarning', streakAt, t);
    }
  }

  const weeklyAt = shiftOutOfQuietHours(nextSundayAt18(now), 7);
  await scheduleAt(TRIGGER_WEEKLY_WEIGH_IN, 'pushWeeklyWeighIn', weeklyAt, t);
}
