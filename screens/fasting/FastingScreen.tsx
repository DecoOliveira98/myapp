import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import PressableButton from '../../components/ui/PressableButton';

type Props = { session: Session; onClose: () => void };

type ActiveSession = { id: string; started_at: string; goal_hours: number | null };
type HistorySession = {
  id: string;
  started_at: string;
  ended_at: string;
  goal_hours: number | null;
  duration_h: number;
};

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}min ${s}s`;
}

function formatDurationShort(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}min`;
}

export default function FastingScreen({ session, onClose }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const ss = useMemo(() => makeStyles(T), [T]);
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [screenState, setScreenState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [now, setNow] = useState(new Date());
  const [goalInput, setGoalInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const loadAll = useCallback(async () => {
    try {
      const [activeRes, histRes] = await Promise.all([
        supabase
          .from('fasting_sessions')
          .select('id, started_at, goal_hours')
          .eq('user_id', session.user.id)
          .is('ended_at', null)
          .maybeSingle(),
        supabase
          .from('fasting_sessions')
          .select('id, started_at, ended_at, goal_hours')
          .eq('user_id', session.user.id)
          .not('ended_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(30),
      ]);
      if (activeRes.error) throw activeRes.error;
      if (histRes.error) throw histRes.error;
      setActive(activeRes.data ?? null);
      setHistory(
        (histRes.data ?? []).map(s => ({
          id: s.id,
          started_at: s.started_at,
          ended_at: s.ended_at,
          goal_hours: s.goal_hours,
          duration_h:
            Math.round(
              ((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000) * 10,
            ) / 10,
        })),
      );
      setScreenState('ready');
    } catch {
      setScreenState('error');
    }
  }, [session.user.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function startFasting() {
    setError(null); setBusy(true);
    try {
      const goal = goalInput.trim() ? Number(goalInput.replace(',', '.')) : null;
      if (goalInput.trim() && (isNaN(goal!) || goal! <= 0)) {
        setError(t('fasting.errors.invalidGoal')); return;
      }
      const { data, error: insErr } = await supabase
        .from('fasting_sessions')
        .insert({ user_id: session.user.id, started_at: new Date().toISOString(), goal_hours: goal })
        .select('id, started_at, goal_hours')
        .single();
      if (insErr) throw insErr;
      setActive({ id: data.id, started_at: data.started_at, goal_hours: data.goal_hours });
      setGoalInput('');
    } catch (e: any) {
      setError(e?.message ?? t('fasting.errors.start'));
    } finally { setBusy(false); }
  }

  async function endFasting() {
    if (!active) return;
    setError(null); setBusy(true);
    try {
      const { error: updErr } = await supabase
        .from('fasting_sessions')
        .update({ ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', active.id);
      if (updErr) throw updErr;
      setActive(null);
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? t('fasting.errors.end'));
    } finally { setBusy(false); }
  }

  async function deleteSession(id: string) {
    Alert.alert(t('fasting.deleteTitle'), t('fasting.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('fasting.delete'),
        style: 'destructive',
        onPress: async () => {
          await supabase.from('fasting_sessions').delete().eq('id', id);
          await loadAll();
        },
      },
    ]);
  }

  function formatHistoryEntry(s: HistorySession): string {
    const d = new Date(s.started_at);
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} · ${formatDurationShort(s.duration_h)}`;
  }

  if (screenState === 'loading') {
    return (
      <View style={ss.centered}>
        <Text style={ss.secondaryText}>{t('common.loading')}...</Text>
      </View>
    );
  }

  if (screenState === 'error') {
    return (
      <View style={ss.centered}>
        <Text style={ss.secondaryText}>{t('fasting.errors.loadData')}</Text>
        <TouchableOpacity onPress={loadAll} style={{ marginTop: 12 }}>
          <Text style={[ss.secondaryText, { color: T.accent }]}>{t('fasting.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const elapsed = active ? now.getTime() - new Date(active.started_at).getTime() : 0;
  const progressPct = active?.goal_hours
    ? Math.min(elapsed / (active.goal_hours * 3_600_000), 1)
    : 0;
  const startedAtTime = active
    ? new Date(active.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';
  const avgHours =
    history.length > 0
      ? Math.round((history.reduce((a, s) => a + s.duration_h, 0) / history.length) * 10) / 10
      : null;

  return (
    <View style={ss.root}>
      {/* Header */}
      <View style={ss.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={ss.backText}>{`← ${t('common.back')}`}</Text>
        </TouchableOpacity>
        <Text style={ss.headerTitle}>{t('fasting.title')}</Text>
      </View>

      <ScrollView
        style={ss.scroll}
        contentContainerStyle={ss.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Active session */}
        {active !== null ? (
          <View style={ss.sessionCard}>
            <Text style={ss.sessionLabel}>{t('fasting.fastingFor')}</Text>
            <Text style={ss.timerText}>{formatDuration(elapsed)}</Text>
            <Text style={ss.sessionSub}>{t('fasting.startedAt', { time: startedAtTime })}</Text>

            {active.goal_hours != null && (
              <>
                <Text style={ss.goalLine}>{t('fasting.goalHours', { value: active.goal_hours })}</Text>
                <View style={ss.progressTrack}>
                  <View
                    style={[ss.progressFill, { width: `${Math.round(progressPct * 100)}%` as any }]}
                  />
                </View>
              </>
            )}

            <PressableButton
              style={[ss.actionBtn, ss.endBtn, busy && ss.btnDisabled]}
              onPress={endFasting}
              disabled={busy}
            >
              <Text style={ss.actionBtnText}>{busy ? t('fasting.ending') : t('fasting.end')}</Text>
            </PressableButton>
          </View>
        ) : (
          <View style={ss.sessionCard}>
            <Text style={ss.idleText}>{t('fasting.noneActive')}</Text>

            <View style={ss.inputRow}>
              <TextInput
                style={ss.goalInput}
                value={goalInput}
                onChangeText={setGoalInput}
                placeholder="16"
                placeholderTextColor={T.textFaint}
                keyboardType="decimal-pad"
                maxLength={5}
              />
              <Text style={ss.inputRowLabel}>{t('fasting.goalInput')}</Text>
            </View>
            <Text style={ss.inputHint}>{t('fasting.inputHint')}</Text>

            <PressableButton
              style={[ss.actionBtn, ss.startBtn, busy && ss.btnDisabled]}
              onPress={startFasting}
              disabled={busy}
            >
              <Text style={ss.actionBtnText}>{busy ? t('fasting.starting') : t('fasting.start')}</Text>
            </PressableButton>
          </View>
        )}

        {error != null && <Text style={ss.errorText}>{error}</Text>}

        <View style={ss.divider} />

        {/* History */}
        <View style={ss.historyHeader}>
          <Text style={ss.historyTitle}>{t('fasting.history')}</Text>
          {avgHours !== null && (
            <Text style={ss.historyMeta}>
              {t('fasting.avgSessions', { duration: formatDurationShort(avgHours), count: history.length })}
            </Text>
          )}
        </View>

        {history.length === 0 ? (
          <Text style={ss.emptyText}>{t('fasting.empty')}</Text>
        ) : (
          history.map(s => (
            <TouchableOpacity
              key={s.id}
              style={ss.historyRow}
              onLongPress={() => deleteSession(s.id)}
              activeOpacity={0.7}
            >
              <Text style={ss.historyRowText}>{formatHistoryEntry(s)}</Text>
              {s.goal_hours != null && <GoalBadge durationH={s.duration_h} goalH={s.goal_hours} />}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function GoalBadge({ durationH, goalH }: { durationH: number; goalH: number }) {
  const { T } = useTheme();
  const ss = useMemo(() => makeStyles(T), [T]);
  const pct = durationH / goalH;
  let color: string;
  let label: string;
  const { t } = useTranslation();
  if (pct >= 1) { color = T.success; label = t('fasting.goalBadge.hit'); }
  else if (pct >= 0.8) { color = T.accent; label = t('fasting.goalBadge.almost'); }
  else { color = T.danger; label = t('fasting.goalBadge.missed'); }
  return (
    <View style={[ss.goalBadge, { borderColor: color }]}>
      <Text style={[ss.goalBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

function makeStyles(T: TokenSet) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: T.bgBase,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: T.bgBase,
    },
    secondaryText: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textSecondary,
    },

    // ── Header ─────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: T.sp4,
      paddingHorizontal: T.sp5,
      paddingTop: 56,
      paddingBottom: T.sp4,
      borderBottomWidth: 1,
      borderBottomColor: T.borderSoft,
    },
    backText: {
      fontFamily: T.fontMono,
      fontSize: T.textSm,
      color: T.textSecondary,
      letterSpacing: 0.4,
    },
    headerTitle: {
      fontFamily: T.fontDisplay,
      fontSize: T.textXl,
      color: T.textPrimary,
      letterSpacing: -0.5,
    },

    // ── Scroll ─────────────────────────────────
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: T.sp5,
      paddingTop: T.sp5,
      paddingBottom: 80,
    },

    // ── Session card ───────────────────────────
    sessionCard: {
      borderWidth: 1,
      borderColor: T.borderSoft,
      backgroundColor: T.surface1,
      padding: T.sp5,
      marginBottom: T.sp4,
      alignItems: 'center',
    },
    sessionLabel: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: T.sp2,
    },
    timerText: {
      fontFamily: T.fontDisplay,
      fontSize: 32,
      color: T.textPrimary,
      letterSpacing: -1,
      marginBottom: T.sp2,
      textAlign: 'center',
    },
    sessionSub: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textTertiary,
      marginBottom: T.sp3,
    },
    goalLine: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textSecondary,
      letterSpacing: 1.2,
      marginBottom: T.sp2,
    },
    progressTrack: {
      width: '100%',
      height: 3,
      backgroundColor: T.trackBg,
      marginBottom: T.sp4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: T.accent,
    },
    idleText: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textTertiary,
      marginBottom: T.sp5,
      textAlign: 'center',
    },

    // ── Input ──────────────────────────────────
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: T.sp3,
      marginBottom: T.sp2,
    },
    goalInput: {
      borderWidth: 1,
      borderColor: T.borderStrong,
      backgroundColor: T.surface2,
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp2,
      fontFamily: T.fontMono,
      fontSize: T.textBase,
      color: T.textPrimary,
      width: 80,
      textAlign: 'center',
    },
    inputRowLabel: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textSecondary,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    inputHint: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textTertiary,
      marginBottom: T.sp4,
      textAlign: 'center',
    },

    // ── Buttons ────────────────────────────────
    actionBtn: {
      width: '100%',
      paddingVertical: 14,
      alignItems: 'center',
    },
    startBtn: {
      backgroundColor: T.surface3,
    },
    endBtn: {
      backgroundColor: T.danger,
    },
    btnDisabled: {
      opacity: 0.5,
    },
    actionBtnText: {
      fontFamily: T.fontMonoMedium,
      fontSize: T.textXs,
      letterSpacing: 2,
      color: T.textPrimary,
      textTransform: 'uppercase',
    },

    // ── Error ──────────────────────────────────
    errorText: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.danger,
      textAlign: 'center',
      marginBottom: T.sp3,
    },

    // ── Divider ────────────────────────────────
    divider: {
      height: 1,
      backgroundColor: T.borderSoft,
      marginVertical: T.sp5,
    },

    // ── History ────────────────────────────────
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: T.sp4,
    },
    historyTitle: {
      fontFamily: T.fontDisplayItalic,
      fontSize: T.textXl,
      color: T.textPrimary,
      letterSpacing: -0.5,
      fontWeight: '400',
    },
    historyMeta: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 1.2,
    },
    historyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: T.sp3,
      borderBottomWidth: 1,
      borderBottomColor: T.borderFaint,
    },
    historyRowText: {
      fontFamily: T.fontMono,
      fontSize: T.textSm,
      color: T.textSecondary,
      letterSpacing: 0.4,
    },
    goalBadge: {
      borderWidth: 1,
      paddingHorizontal: T.sp2,
      paddingVertical: 2,
    },
    goalBadgeText: {
      fontFamily: T.fontMono,
      fontSize: 10,
      letterSpacing: 0.8,
    },
    emptyText: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textTertiary,
      paddingVertical: T.sp4,
    },
  });
}
