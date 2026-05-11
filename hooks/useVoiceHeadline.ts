import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

export type VoiceHeadlineContext = {
  totalsKcal: number;
  targetKcal: number;
  mealsCountToday: number;
  streakDays: number;
  daysSinceLastLog: number;
  currentHour: number;
  isToday: boolean;
};

type VoiceTrigger =
  | 'returnAfterAbsence'
  | 'streak30'
  | 'streak14'
  | 'streak7'
  | 'streak3'
  | 'goalHit'
  | 'firstLog'
  | 'emptyMorning'
  | 'emptyAfternoon'
  | 'emptyEvening'
  | 'emptyNight';

const STREAK_TRIGGERS = new Set<VoiceTrigger>(['streak30', 'streak14', 'streak7', 'streak3']);

function resolveEmptyTrigger(hour: number): Extract<
  VoiceTrigger,
  'emptyMorning' | 'emptyAfternoon' | 'emptyEvening' | 'emptyNight'
> {
  if (hour >= 5 && hour < 11) return 'emptyMorning';
  if (hour >= 11 && hour < 17) return 'emptyAfternoon';
  if (hour >= 17 && hour < 21) return 'emptyEvening';
  return 'emptyNight';
}

function resolveTrigger(ctx: VoiceHeadlineContext): VoiceTrigger {
  if (ctx.isToday && ctx.daysSinceLastLog >= 2) return 'returnAfterAbsence';

  if (ctx.isToday && ctx.streakDays >= 30) return 'streak30';
  if (ctx.isToday && ctx.streakDays >= 14) return 'streak14';
  if (ctx.isToday && ctx.streakDays >= 7) return 'streak7';
  if (ctx.isToday && ctx.streakDays >= 3) return 'streak3';

  if (ctx.targetKcal > 0 && ctx.totalsKcal >= ctx.targetKcal) return 'goalHit';
  if (ctx.mealsCountToday === 1) return 'firstLog';
  return resolveEmptyTrigger(ctx.currentHour);
}

function pickVariant(variants: string[]): string {
  return variants[Math.floor(Math.random() * variants.length)] ?? variants[0] ?? '';
}

export function pickVoiceFrase(triggerKey: string, t: TFunction): string {
  if (STREAK_TRIGGERS.has(triggerKey as VoiceTrigger)) {
    return t(`voice.${triggerKey}`);
  }

  const variants = t(`voice.${triggerKey}`, { returnObjects: true });
  if (Array.isArray(variants)) {
    return pickVariant(variants.filter((item): item is string => typeof item === 'string'));
  }
  return typeof variants === 'string' ? variants : '';
}

export function useVoiceHeadline(ctx: VoiceHeadlineContext): string {
  const { t } = useTranslation();
  const trigger = resolveTrigger(ctx);
  return pickVoiceFrase(trigger, t);
}
