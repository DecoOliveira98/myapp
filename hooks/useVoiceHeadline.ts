import { useTranslation } from 'react-i18next';

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
  | 'morning';

function resolveTrigger(ctx: VoiceHeadlineContext): VoiceTrigger {
  if (ctx.isToday && ctx.daysSinceLastLog >= 2) return 'returnAfterAbsence';

  if (ctx.isToday && ctx.streakDays >= 30) return 'streak30';
  if (ctx.isToday && ctx.streakDays >= 14) return 'streak14';
  if (ctx.isToday && ctx.streakDays >= 7) return 'streak7';
  if (ctx.isToday && ctx.streakDays >= 3) return 'streak3';

  if (ctx.targetKcal > 0 && ctx.totalsKcal >= ctx.targetKcal) return 'goalHit';
  if (ctx.mealsCountToday === 1) return 'firstLog';
  return 'morning';
}

function pickVariant(variants: string[]): string {
  return variants[Math.floor(Math.random() * variants.length)] ?? variants[0] ?? '';
}

export function useVoiceHeadline(ctx: VoiceHeadlineContext): string {
  const { t } = useTranslation();
  const trigger = resolveTrigger(ctx);

  if (trigger === 'streak30') return t('voice.streak30');
  if (trigger === 'streak14') return t('voice.streak14');
  if (trigger === 'streak7') return t('voice.streak7');
  if (trigger === 'streak3') return t('voice.streak3');

  const variants = t(`voice.${trigger}`, { returnObjects: true });
  if (Array.isArray(variants)) {
    return pickVariant(variants.filter((item): item is string => typeof item === 'string'));
  }
  return typeof variants === 'string' ? variants : '';
}
