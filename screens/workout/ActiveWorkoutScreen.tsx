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
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import exercisesData from '../../data/exercises.json';
import { calculateCaloriesBurned, getMetValue } from '../../data/metValues';
import { useProfile } from '../../hooks/useProfile';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import { Exercise } from '../../types/exercise';
import PressableButton from '../../components/ui/PressableButton';
import ExerciseLibraryScreen from './ExerciseLibraryScreen';

type Props = {
  session: Session;
  routineId: string | null;
  onClose: () => void;
  onWorkoutSaved: () => void;
};

type WorkoutExercise = {
  exerciseId: string;
  name: string;
  targetSets: number;
  targetReps: number | null;
  restSeconds: number | null;
};

type LoggedSet = {
  exerciseId: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  completed: boolean;
};

const exercises: Exercise[] = exercisesData as Exercise[];
const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function createSetsForExercise(
  exerciseId: string,
  count: number,
  defaultReps: number | null,
): LoggedSet[] {
  return Array.from({ length: count }, (_, index) => ({
    exerciseId,
    setNumber: index + 1,
    reps: defaultReps,
    weightKg: null,
    completed: false,
  }));
}

function calculateTotalCalories(
  elapsedSeconds: number,
  loggedSets: LoggedSet[],
  weightKg: number | null,
): number {
  const durationMin = Math.max(1, Math.round(elapsedSeconds / 60));
  const userWeightKg = weightKg ?? 70;
  const exercisesDone = [
    ...new Set(loggedSets.filter((set) => set.completed).map((set) => set.exerciseId)),
  ];

  if (exercisesDone.length === 0) return 0;

  let totalCalories = 0;
  for (const exerciseId of exercisesDone) {
    const exercise = exerciseById.get(exerciseId);
    const met = getMetValue(exerciseId, exercise?.category ?? 'strength');
    const exerciseDuration = durationMin / exercisesDone.length;
    totalCalories += calculateCaloriesBurned(met, userWeightKg, exerciseDuration);
  }
  return totalCalories;
}

export default function ActiveWorkoutScreen({
  session,
  routineId,
  onClose,
  onWorkoutSaved,
}: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const { profile } = useProfile(session);
  const [startedAt] = useState(() => new Date());
  const [elapsed, setElapsed] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false);
  const [notes, setNotes] = useState('');
  const [estimatedCalories, setEstimatedCalories] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingRoutine, setLoadingRoutine] = useState(routineId !== null);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const loadRoutineExercises = useCallback(async () => {
    if (!routineId) {
      setLoadingRoutine(false);
      return;
    }

    setLoadingRoutine(true);
    const { data: items, error } = await supabase
      .from('routine_exercises')
      .select('exercise_id, target_sets, target_reps, rest_seconds')
      .eq('routine_id', routineId)
      .order('position', { ascending: true });

    if (error || !items) {
      setLoadingRoutine(false);
      return;
    }

    const mapped = items.map((item) => {
      const exercise = exerciseById.get(item.exercise_id);
      return {
        exerciseId: item.exercise_id,
        name: exercise?.name ?? item.exercise_id,
        targetSets: item.target_sets ?? 3,
        targetReps: item.target_reps,
        restSeconds: item.rest_seconds,
      };
    });

    setExercises(mapped);
    setLoggedSets(
      mapped.flatMap((exercise) =>
        createSetsForExercise(exercise.exerciseId, exercise.targetSets, exercise.targetReps),
      ),
    );
    setLoadingRoutine(false);
  }, [routineId]);

  useEffect(() => {
    void loadRoutineExercises();
  }, [loadRoutineExercises]);

  const completedSets = loggedSets.filter((set) => set.completed);
  const exercisesDoneCount = new Set(completedSets.map((set) => set.exerciseId)).size;

  function updateSet(
    exerciseId: string,
    setNumber: number,
    patch: Partial<Pick<LoggedSet, 'reps' | 'weightKg' | 'completed'>>,
  ) {
    setLoggedSets((current) =>
      current.map((set) =>
        set.exerciseId === exerciseId && set.setNumber === setNumber
          ? { ...set, ...patch }
          : set,
      ),
    );
  }

  function toggleSetComplete(exerciseId: string, setNumber: number) {
    setLoggedSets((current) =>
      current.map((set) => {
        if (set.exerciseId !== exerciseId || set.setNumber !== setNumber) return set;
        const nextCompleted = !set.completed;
        if (nextCompleted) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        return { ...set, completed: nextCompleted };
      }),
    );
  }

  function addSet(exerciseId: string) {
    const maxSet = loggedSets
      .filter((set) => set.exerciseId === exerciseId)
      .reduce((max, set) => Math.max(max, set.setNumber), 0);
    setLoggedSets((current) => [
      ...current,
      {
        exerciseId,
        setNumber: maxSet + 1,
        reps: null,
        weightKg: null,
        completed: false,
      },
    ]);
  }

  function handleAddExercise(exerciseId: string) {
    if (exercises.some((exercise) => exercise.exerciseId === exerciseId)) {
      setShowExerciseLibrary(false);
      return;
    }

    const exercise = exerciseById.get(exerciseId);
    if (!exercise) return;

    setExercises((current) => [
      ...current,
      {
        exerciseId,
        name: exercise.name,
        targetSets: 3,
        targetReps: null,
        restSeconds: 60,
      },
    ]);
    setLoggedSets((current) => [...current, ...createSetsForExercise(exerciseId, 3, null)]);
    setShowExerciseLibrary(false);
  }

  function confirmDiscard() {
    Alert.alert(t('workout.discardWorkout'), t('workout.discardWorkoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('workout.discard'), style: 'destructive', onPress: onClose },
    ]);
  }

  function handleFinish() {
    setEstimatedCalories(calculateTotalCalories(elapsed, loggedSets, profile?.weight_kg ?? null));
    setIsFinished(true);
  }

  async function handleSaveWorkout() {
    setSaving(true);
    const totalCalories = calculateTotalCalories(elapsed, loggedSets, profile?.weight_kg ?? null);

    try {
      const { data: sessionRow, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: session.user.id,
          routine_id: routineId,
          started_at: startedAt.toISOString(),
          ended_at: new Date().toISOString(),
          duration_min: Math.max(1, Math.round(elapsed / 60)),
          calories_burned: totalCalories,
          source: 'manual',
          notes: notes.trim() || null,
        })
        .select('id')
        .single();

      if (sessionError || !sessionRow) throw sessionError;

      if (completedSets.length > 0) {
        const { error: setsError } = await supabase.from('workout_sets').insert(
          completedSets.map((set) => ({
            session_id: sessionRow.id,
            exercise_id: set.exerciseId,
            set_number: set.setNumber,
            reps: set.reps,
            weight_kg: set.weightKg,
            completed: true,
          })),
        );
        if (setsError) throw setsError;
      }

      setSaving(false);
      onWorkoutSaved();
    } catch {
      setSaving(false);
      Alert.alert(t('common.error'), t('common.error'));
    }
  }

  if (showExerciseLibrary) {
    return (
      <ExerciseLibraryScreen
        onClose={() => setShowExerciseLibrary(false)}
        onSelectExercise={handleAddExercise}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={confirmDiscard} hitSlop={8} style={styles.headerAction}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.timer}>{formatTime(elapsed)}</Text>
        <TouchableOpacity onPress={handleFinish} hitSlop={8} style={styles.headerAction}>
          <Text style={styles.finishText}>{t('workout.finishWorkout')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loadingRoutine ? (
          <Text style={styles.loadingText}>{t('common.loading')}...</Text>
        ) : (
          exercises.map((exercise) => {
            const exerciseSets = loggedSets
              .filter((set) => set.exerciseId === exercise.exerciseId)
              .sort((a, b) => a.setNumber - b.setNumber);

            return (
              <View key={exercise.exerciseId} style={styles.exerciseBlock}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseMeta}>
                    {exerciseSets.length} {t('workout.sets').toLowerCase()}
                  </Text>
                </View>

                {exerciseSets.map((set) => (
                  <View
                    key={`${set.exerciseId}-${set.setNumber}`}
                    style={[styles.setRow, set.completed && styles.setRowCompleted]}
                  >
                    <Text style={styles.setNumber}>{set.setNumber}</Text>
                    <View style={styles.setField}>
                      <Text style={styles.fieldLabel}>{t('workout.weight')}</Text>
                      <TextInput
                        value={set.weightKg == null ? '' : String(set.weightKg)}
                        onChangeText={(value) =>
                          updateSet(exercise.exerciseId, set.setNumber, {
                            weightKg: parseOptionalNumber(value),
                          })
                        }
                        keyboardType="decimal-pad"
                        style={styles.weightInput}
                        placeholder="—"
                        placeholderTextColor={T.textTertiary}
                      />
                    </View>
                    <View style={styles.setField}>
                      <Text style={styles.fieldLabel}>{t('workout.reps')}</Text>
                      <TextInput
                        value={set.reps == null ? '' : String(set.reps)}
                        onChangeText={(value) =>
                          updateSet(exercise.exerciseId, set.setNumber, {
                            reps: parseOptionalNumber(value),
                          })
                        }
                        keyboardType="number-pad"
                        style={styles.repsInput}
                        placeholder="—"
                        placeholderTextColor={T.textTertiary}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => toggleSetComplete(exercise.exerciseId, set.setNumber)}
                      style={[
                        styles.checkButton,
                        set.completed && styles.checkButtonCompleted,
                      ]}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={set.completed ? T.onAccent : T.textTertiary}
                      />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  onPress={() => addSet(exercise.exerciseId)}
                  style={styles.addSetButton}
                  activeOpacity={0.75}
                >
                  <Text style={styles.addSetText}>{t('workout.addSet')}</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <PressableButton style={styles.addExerciseButton} onPress={() => setShowExerciseLibrary(true)}>
          <Text style={styles.addExerciseText}>{t('workout.addExercise')}</Text>
        </PressableButton>
      </ScrollView>

      {isFinished ? (
        <View style={styles.footer}>
          <Text style={styles.summaryTitle}>{t('workout.summary')}</Text>
          <Text style={styles.summaryLine}>
            {t('workout.duration')}: {formatTime(elapsed)}
          </Text>
          <Text style={styles.summaryLine}>
            {t('workout.exercisesDone')}: {exercisesDoneCount}
          </Text>
          <Text style={styles.summaryLine}>
            {t('workout.setsCompleted')}: {completedSets.length}
          </Text>
          <Text style={styles.summaryLine}>
            {t('workout.caloriesBurned')}: {estimatedCalories} kcal
          </Text>

          <Text style={styles.notesLabel}>{t('workout.notes')}</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t('workout.notes')}
            placeholderTextColor={T.textTertiary}
            style={styles.notesInput}
            multiline
          />

          <PressableButton
            style={styles.saveButton}
            onPress={() => void handleSaveWorkout()}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{t('workout.saveWorkout')}</Text>
          </PressableButton>
        </View>
      ) : null}
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
      paddingTop: 56,
      paddingHorizontal: T.sp5,
      paddingBottom: T.sp4,
      borderBottomWidth: 1,
      borderBottomColor: T.borderSoft,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: T.sp3,
    },
    headerAction: {
      minWidth: 72,
    },
    closeText: {
      fontFamily: T.fontBody,
      fontSize: T.textLg,
      color: T.textSecondary,
    },
    timer: {
      flex: 1,
      textAlign: 'center',
      fontFamily: T.fontMono,
      fontSize: T.text2xl,
      color: T.accent,
      letterSpacing: 1.2,
    },
    finishText: {
      fontFamily: T.fontMonoMedium,
      fontSize: T.textXs,
      color: T.accentText,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      textAlign: 'right',
    },
    body: {
      flex: 1,
    },
    bodyContent: {
      padding: T.sp5,
      paddingBottom: T.sp8,
      gap: T.sp5,
    },
    loadingText: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textSecondary,
      textAlign: 'center',
    },
    exerciseBlock: {
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rLg,
      backgroundColor: T.surface1,
      padding: T.sp4,
      gap: T.sp3,
    },
    exerciseHeader: {
      gap: T.sp1,
    },
    exerciseName: {
      fontFamily: T.fontBodySemiBold,
      fontSize: T.textBase,
      color: T.textPrimary,
    },
    exerciseMeta: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 1.2,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: T.sp2,
    },
    setRowCompleted: {
      opacity: 0.5,
    },
    setNumber: {
      width: 24,
      paddingBottom: T.sp3,
      fontFamily: T.fontMono,
      fontSize: T.textSm,
      color: T.textTertiary,
    },
    setField: {
      gap: T.sp1,
    },
    fieldLabel: {
      fontFamily: T.fontMono,
      fontSize: 10,
      color: T.textTertiary,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    weightInput: {
      width: 80,
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rLg,
      backgroundColor: T.bgBase,
      paddingHorizontal: T.sp2,
      paddingVertical: T.sp2,
      fontFamily: T.fontMono,
      fontSize: T.textSm,
      color: T.textPrimary,
    },
    repsInput: {
      width: 60,
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rLg,
      backgroundColor: T.bgBase,
      paddingHorizontal: T.sp2,
      paddingVertical: T.sp2,
      fontFamily: T.fontMono,
      fontSize: T.textSm,
      color: T.textPrimary,
    },
    checkButton: {
      width: 36,
      height: 36,
      borderRadius: T.rLg,
      borderWidth: 1,
      borderColor: T.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    checkButtonCompleted: {
      backgroundColor: T.success,
      borderColor: T.success,
    },
    addSetButton: {
      alignSelf: 'flex-start',
      paddingVertical: T.sp1,
    },
    addSetText: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.accentText,
      letterSpacing: 1.2,
    },
    addExerciseButton: {
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: T.sp5,
      borderWidth: 1,
      borderColor: T.borderStrong,
      backgroundColor: 'transparent',
    },
    addExerciseText: {
      fontFamily: T.fontMonoMedium,
      fontSize: T.textXs,
      letterSpacing: 2,
      color: T.textPrimary,
      textTransform: 'uppercase',
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: T.borderSoft,
      paddingHorizontal: T.sp5,
      paddingTop: T.sp4,
      paddingBottom: T.sp6,
      backgroundColor: T.bgBase,
      gap: T.sp2,
    },
    summaryTitle: {
      fontFamily: T.fontDisplayItalic,
      fontSize: T.textMd,
      color: T.textPrimary,
      marginBottom: T.sp2,
    },
    summaryLine: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textSecondary,
    },
    notesLabel: {
      marginTop: T.sp3,
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    notesInput: {
      minHeight: 72,
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rLg,
      backgroundColor: T.surface1,
      paddingHorizontal: T.sp4,
      paddingVertical: T.sp3,
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textPrimary,
      textAlignVertical: 'top',
    },
    saveButton: {
      marginTop: T.sp3,
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: T.sp5,
      backgroundColor: T.accent,
      borderWidth: 1,
      borderColor: T.accent,
    },
    saveButtonText: {
      fontFamily: T.fontMonoMedium,
      fontSize: T.textXs,
      letterSpacing: 2,
      color: T.bgBase,
      textTransform: 'uppercase',
    },
  });
}
