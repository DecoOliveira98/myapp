import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import PressableButton from '../../components/ui/PressableButton';
import RoutineEditScreen from './RoutineEditScreen';
import WorkoutHistoryScreen from './WorkoutHistoryScreen';

type Props = {
  session: Session;
  onClose: () => void;
  onStartWorkout: (routineId: string) => void;
  onGenerateWorkout?: () => void;
};

type RoutineRow = {
  id: string;
  name: string;
  description: string | null;
  is_favorite: boolean;
  exercise_count: number;
};

export default function RoutinesListScreen({
  session,
  onClose,
  onStartWorkout,
  onGenerateWorkout,
}: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [editing, setEditing] = useState<{ routineId: string | null } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadRoutines = useCallback(async () => {
    setState('loading');

    const { data: routineRows, error: routineError } = await supabase
      .from('workout_routines')
      .select('id, name, description, is_favorite')
      .eq('user_id', session.user.id)
      .order('is_favorite', { ascending: false })
      .order('name', { ascending: true });

    if (routineError) {
      setState('error');
      return;
    }

    const rows = routineRows ?? [];
    if (rows.length === 0) {
      setRoutines([]);
      setState('ready');
      return;
    }

    const routineIds = rows.map((row) => row.id);
    const { data: countRows, error: countError } = await supabase
      .from('routine_exercises')
      .select('routine_id')
      .in('routine_id', routineIds);

    if (countError) {
      setState('error');
      return;
    }

    const counts: Record<string, number> = {};
    for (const row of countRows ?? []) {
      counts[row.routine_id] = (counts[row.routine_id] ?? 0) + 1;
    }

    setRoutines(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        is_favorite: row.is_favorite,
        exercise_count: counts[row.id] ?? 0,
      })),
    );
    setState('ready');
  }, [session.user.id]);

  useEffect(() => {
    void loadRoutines();
  }, [loadRoutines]);

  async function toggleFavorite(item: RoutineRow) {
    await supabase
      .from('workout_routines')
      .update({
        is_favorite: !item.is_favorite,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    void loadRoutines();
  }

  function openCreate() {
    setEditing({ routineId: null });
  }

  function confirmDelete(routineId: string) {
    Alert.alert(t('workout.deleteRoutine'), t('workout.deleteRoutineConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await supabase.from('workout_routines').delete().eq('id', routineId);
            void loadRoutines();
          })();
        },
      },
    ]);
  }

  function handleLongPress(item: RoutineRow) {
    Alert.alert(item.name, undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('workout.startWorkout'),
        onPress: () => onStartWorkout(item.id),
      },
      {
        text: t('workout.deleteRoutine'),
        style: 'destructive',
        onPress: () => confirmDelete(item.id),
      },
    ]);
  }

  if (showHistory) {
    return (
      <WorkoutHistoryScreen
        session={session}
        onClose={() => setShowHistory(false)}
      />
    );
  }

  if (editing !== null) {
    return (
      <RoutineEditScreen
        session={session}
        routineId={editing.routineId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void loadRoutines();
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.headerSideLeft}>
          <Text style={styles.backText}>{`← ${t('common.back')}`}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('workout.myRoutines')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowHistory(true)} hitSlop={8}>
            <Ionicons name="time-outline" size={22} color={T.textPrimary} />
          </TouchableOpacity>
          {onGenerateWorkout ? (
            <TouchableOpacity onPress={onGenerateWorkout} hitSlop={8}>
              <Ionicons name="sparkles-outline" size={22} color={T.accent} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={openCreate} hitSlop={8}>
            <Ionicons name="add" size={24} color={T.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator color={T.accent} />
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centered}>
          <Text style={styles.bodyText}>{t('common.error')}</Text>
          <TouchableOpacity onPress={() => void loadRoutines()} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('recipes.common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'ready' && (
        <FlatList
          data={routines}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('workout.noRoutines')}</Text>
              <PressableButton style={styles.emptyButton} onPress={openCreate}>
                <Text style={styles.emptyButtonText}>{t('workout.createFirstRoutine')}</Text>
              </PressableButton>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setEditing({ routineId: item.id })}
              onLongPress={() => handleLongPress(item)}
              activeOpacity={0.75}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <TouchableOpacity
                  onPress={() => void toggleFavorite(item)}
                  hitSlop={10}
                  style={styles.starBtn}
                >
                  <Ionicons
                    name={item.is_favorite ? 'star' : 'star-outline'}
                    size={20}
                    color={item.is_favorite ? T.accent : T.textTertiary}
                  />
                </TouchableOpacity>
              </View>
              {item.description ? (
                <Text style={styles.cardDescription} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
              <Text style={styles.cardMeta}>
                {t('workout.exerciseCount', { count: item.exercise_count })}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={T.onAccent} />
      </TouchableOpacity>
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
    headerSideLeft: {
      width: 80,
    },
    headerSideRight: {
      width: 80,
      alignItems: 'flex-end',
    },
    headerActions: {
      width: 104,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: T.sp2,
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
      gap: T.sp3,
      paddingHorizontal: T.sp5,
    },
    bodyText: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textSecondary,
      textAlign: 'center',
    },
    retryBtn: {
      paddingHorizontal: T.sp4,
      paddingVertical: T.sp2,
      borderWidth: 1,
      borderColor: T.borderStrong,
    },
    retryText: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textSecondary,
      letterSpacing: 1.2,
    },
    list: {
      flex: 1,
    },
    listContent: {
      padding: T.sp5,
      paddingBottom: T.sp10,
      gap: T.sp3,
    },
    emptyState: {
      paddingTop: T.sp8,
      alignItems: 'center',
      gap: T.sp4,
    },
    emptyText: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textSecondary,
      textAlign: 'center',
    },
    emptyButton: {
      paddingVertical: 13,
      paddingHorizontal: T.sp5,
      backgroundColor: T.accent,
      borderWidth: 1,
      borderColor: T.accent,
    },
    emptyButtonText: {
      fontFamily: T.fontMonoMedium,
      fontSize: T.textXs,
      letterSpacing: 2,
      color: T.bgBase,
      textTransform: 'uppercase',
    },
    card: {
      borderWidth: 1,
      borderColor: T.borderSoft,
      backgroundColor: T.surface1,
      borderRadius: T.rLg,
      padding: T.sp4,
      gap: T.sp2,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: T.sp3,
    },
    cardName: {
      flex: 1,
      fontFamily: T.fontBodySemiBold,
      fontSize: T.textBase,
      color: T.textPrimary,
    },
    starBtn: {
      padding: T.sp1,
    },
    cardDescription: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textTertiary,
    },
    cardMeta: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 1.2,
    },
    fab: {
      position: 'absolute',
      right: T.sp5,
      bottom: T.sp6,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: T.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
