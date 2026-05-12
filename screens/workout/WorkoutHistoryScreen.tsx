import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import exercisesData from '../../data/exercises.json';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import { Exercise } from '../../types/exercise';

type Props = {
  session: Session;
  onClose: () => void;
};

type WorkoutSessionRow = {
  id: string;
  routine_id: string | null;
  started_at: string;
  duration_min: number | null;
  calories_burned: number | null;
  notes: string | null;
  source: string | null;
};

type WorkoutSetRow = {
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
};

type HistoryItem = WorkoutSessionRow & {
  routineName: string | null;
  exerciseCount: number;
  sets: WorkoutSetRow[];
};

const exercises: Exercise[] = exercisesData as Exercise[];
const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

function formatSessionDate(iso: string, locale: string): string {
  const date = new Date(iso);
  const datePart = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
  const timePart = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return `${datePart} · ${timePart}`;
}

export default function WorkoutHistoryScreen({ session, onClose }: Props) {
  const { T } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'pt-BR';
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setState('loading');

    const { data: sessions, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select('id, routine_id, started_at, duration_min, calories_burned, notes, source')
      .eq('user_id', session.user.id)
      .order('started_at', { ascending: false })
      .limit(50);

    if (sessionsError || !sessions) {
      setState('error');
      return;
    }

    if (sessions.length === 0) {
      setItems([]);
      setState('ready');
      return;
    }

    const sessionIds = sessions.map((row) => row.id);
    const routineIds = sessions
      .map((row) => row.routine_id)
      .filter((routineId): routineId is string => Boolean(routineId));

    const [{ data: routines }, { data: sets, error: setsError }] = await Promise.all([
      routineIds.length > 0
        ? supabase.from('workout_routines').select('id, name').in('id', routineIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('workout_sets')
        .select('session_id, exercise_id, set_number, reps, weight_kg')
        .in('session_id', sessionIds)
        .order('set_number', { ascending: true }),
    ]);

    if (setsError) {
      setState('error');
      return;
    }

    const routineNames = new Map((routines ?? []).map((routine) => [routine.id, routine.name]));
    const setsBySession = (sets ?? []).reduce<Record<string, WorkoutSetRow[]>>((acc, row) => {
      if (!acc[row.session_id]) acc[row.session_id] = [];
      acc[row.session_id].push(row);
      return acc;
    }, {});

    setItems(
      sessions.map((row) => {
        const sessionSets = setsBySession[row.id] ?? [];
        const exerciseCount = new Set(sessionSets.map((set) => set.exercise_id)).size;
        return {
          ...row,
          routineName: row.routine_id ? routineNames.get(row.routine_id) ?? null : null,
          exerciseCount,
          sets: sessionSets,
        };
      }),
    );
    setState('ready');
  }, [session.user.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function renderSetLine(set: WorkoutSetRow) {
    const reps = set.reps ?? '—';
    const weight = set.weight_kg ?? '—';
    return `Set ${set.set_number}: ${reps} reps × ${weight}kg`;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.headerSide}>
          <Text style={styles.backText}>{`← ${t('common.back')}`}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('workout.history')}</Text>
        <View style={styles.headerSide} />
      </View>

      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator color={T.accent} />
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centered}>
          <Text style={styles.bodyText}>{t('common.error')}</Text>
        </View>
      )}

      {state === 'ready' && (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('workout.noWorkouts')}</Text>
              <Text style={styles.emptySubtitle}>{t('workout.noWorkoutsMotivation')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const expanded = expandedSessionId === item.id;
            const groupedSets = item.sets.reduce<Record<string, WorkoutSetRow[]>>((acc, set) => {
              if (!acc[set.exercise_id]) acc[set.exercise_id] = [];
              acc[set.exercise_id].push(set);
              return acc;
            }, {});

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setExpandedSessionId(expanded ? null : item.id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardMain}>
                    <Text style={styles.cardDate}>
                      {formatSessionDate(item.started_at, locale)}
                    </Text>
                    <Text style={styles.cardRoutine}>
                      {item.routineName ?? t('workout.freeWorkout')}
                    </Text>
                    <Text style={styles.cardStats}>
                      {t('workout.minutesShort', { value: item.duration_min ?? 0 })}
                      {' · '}
                      {t('workout.exerciseCount', { count: item.exerciseCount })}
                      {' · '}
                      {item.calories_burned ?? 0} kcal
                    </Text>
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-down' : 'chevron-forward'}
                    size={18}
                    color={T.textTertiary}
                  />
                </View>

                {expanded ? (
                  <View style={styles.expandedContent}>
                    {Object.entries(groupedSets).map(([exerciseId, exerciseSets]) => (
                      <View key={exerciseId} style={styles.exerciseGroup}>
                        <Text style={styles.exerciseName}>
                          {exerciseById.get(exerciseId)?.name ?? exerciseId}
                        </Text>
                        {exerciseSets
                          .sort((a, b) => a.set_number - b.set_number)
                          .map((set) => (
                            <Text key={`${set.exercise_id}-${set.set_number}`} style={styles.setLine}>
                              {renderSetLine(set)}
                            </Text>
                          ))}
                      </View>
                    ))}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

function makeStyles(T: TokenSet) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: T.bgBase,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 56,
      paddingHorizontal: T.sp5,
      paddingBottom: T.sp4,
      borderBottomWidth: 1,
      borderBottomColor: T.borderSoft,
    },
    headerSide: {
      width: 80,
    },
    backText: {
      fontFamily: T.fontMono,
      fontSize: T.textSm,
      color: T.textSecondary,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontFamily: T.fontDisplayItalic,
      fontSize: T.textMd,
      color: T.textPrimary,
      letterSpacing: -0.2,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bodyText: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textSecondary,
    },
    listContent: {
      padding: T.sp5,
      paddingBottom: T.sp8,
      gap: T.sp3,
    },
    emptyState: {
      paddingTop: T.sp8,
      alignItems: 'center',
      gap: T.sp2,
    },
    emptyTitle: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textSecondary,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textTertiary,
      textAlign: 'center',
    },
    card: {
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rLg,
      backgroundColor: T.surface1,
      padding: T.sp4,
      gap: T.sp3,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: T.sp3,
    },
    cardMain: {
      flex: 1,
      gap: T.sp1,
    },
    cardDate: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 1.2,
    },
    cardRoutine: {
      fontFamily: T.fontDisplayItalic,
      fontSize: T.textBase,
      color: T.textPrimary,
    },
    cardStats: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textSecondary,
    },
    expandedContent: {
      borderTopWidth: 1,
      borderTopColor: T.borderFaint,
      paddingTop: T.sp3,
      gap: T.sp3,
    },
    exerciseGroup: {
      gap: T.sp1,
    },
    exerciseName: {
      fontFamily: T.fontBodySemiBold,
      fontSize: T.textSm,
      color: T.textPrimary,
    },
    setLine: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textSecondary,
    },
  });
}
