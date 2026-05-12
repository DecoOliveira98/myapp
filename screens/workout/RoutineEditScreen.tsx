import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import exercisesData from '../../data/exercises.json';
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
  onSaved: () => void;
};

type RoutineExerciseDraft = {
  localId: string;
  exerciseId: string;
  sets: number;
  reps: number | null;
  rest: number | null;
};

const exercises: Exercise[] = exercisesData as Exercise[];
const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseSets(value: string): number {
  const parsed = parseOptionalInt(value);
  return parsed && parsed > 0 ? parsed : 3;
}

export default function RoutineEditScreen({ session, routineId, onClose, onSaved }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [items, setItems] = useState<RoutineExerciseDraft[]>([]);
  const [loading, setLoading] = useState(routineId !== null);
  const [saving, setSaving] = useState(false);
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoutine = useCallback(async () => {
    if (!routineId) return;

    setLoading(true);
    const [{ data: routine, error: routineError }, { data: routineItems, error: itemsError }] =
      await Promise.all([
        supabase.from('workout_routines').select('*').eq('id', routineId).single(),
        supabase
          .from('routine_exercises')
          .select('*')
          .eq('routine_id', routineId)
          .order('position', { ascending: true }),
      ]);

    if (routineError || itemsError || !routine) {
      setError(t('common.error'));
      setLoading(false);
      return;
    }

    setName(routine.name);
    setDescription(routine.description ?? '');
    setIsFavorite(routine.is_favorite);
    setItems(
      (routineItems ?? []).map((item) => ({
        localId: item.id,
        exerciseId: item.exercise_id,
        sets: item.target_sets ?? 3,
        reps: item.target_reps,
        rest: item.rest_seconds,
      })),
    );
    setLoading(false);
  }, [routineId, t]);

  useEffect(() => {
    if (routineId) {
      void loadRoutine();
    }
  }, [loadRoutine, routineId]);

  function openExerciseLibrary() {
    setShowExerciseLibrary(true);
  }

  function handleSelectExercise(exerciseId: string) {
    setItems((current) => {
      if (current.some((item) => item.exerciseId === exerciseId)) {
        return current;
      }
      return [
        ...current,
        {
          localId: `temp-${exerciseId}-${Date.now()}`,
          exerciseId,
          sets: 3,
          reps: null,
          rest: 60,
        },
      ];
    });
    setShowExerciseLibrary(false);
  }

  function removeExercise(localId: string) {
    setItems((current) => current.filter((item) => item.localId !== localId));
  }

  function updateExercise(localId: string, patch: Partial<RoutineExerciseDraft>) {
    setItems((current) =>
      current.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    );
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    setError(null);

    try {
      if (routineId) {
        const { error: updateError } = await supabase
          .from('workout_routines')
          .update({
            name: trimmedName,
            description: description.trim() || null,
            is_favorite: isFavorite,
            updated_at: new Date().toISOString(),
          })
          .eq('id', routineId);

        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('routine_exercises')
          .delete()
          .eq('routine_id', routineId);

        if (deleteError) throw deleteError;

        if (items.length > 0) {
          const { error: insertError } = await supabase.from('routine_exercises').insert(
            items.map((item, index) => ({
              routine_id: routineId,
              exercise_id: item.exerciseId,
              position: index,
              target_sets: item.sets,
              target_reps: item.reps,
              rest_seconds: item.rest,
            })),
          );
          if (insertError) throw insertError;
        }
      } else {
        const { data: routine, error: insertRoutineError } = await supabase
          .from('workout_routines')
          .insert({
            user_id: session.user.id,
            name: trimmedName,
            description: description.trim() || null,
            is_favorite: isFavorite,
          })
          .select('id')
          .single();

        if (insertRoutineError || !routine) throw insertRoutineError;

        if (items.length > 0) {
          const { error: insertItemsError } = await supabase.from('routine_exercises').insert(
            items.map((item, index) => ({
              routine_id: routine.id,
              exercise_id: item.exerciseId,
              position: index,
              target_sets: item.sets,
              target_reps: item.reps,
              rest_seconds: item.rest,
            })),
          );
          if (insertItemsError) throw insertItemsError;
        }
      }

      setSaving(false);
      onSaved();
    } catch {
      setSaving(false);
      setError(t('common.error'));
    }
  }

  if (showExerciseLibrary) {
    return (
      <ExerciseLibraryScreen
        onClose={() => setShowExerciseLibrary(false)}
        onSelectExercise={handleSelectExercise}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.backText}>{`← ${t('common.back')}`}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={T.accent} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.headerSide}>
          <Text style={styles.backText}>{`← ${t('common.back')}`}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {routineId ? t('workout.editRoutine') : t('workout.newRoutine')}
        </Text>
        <TouchableOpacity
          onPress={() => void handleSave()}
          hitSlop={8}
          style={styles.headerSide}
          disabled={saving}
        >
          <Text style={[styles.saveText, saving && styles.saveTextDisabled]}>
            {t('workout.save')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>{t('workout.routineName')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('workout.routineNamePlaceholder')}
          placeholderTextColor={T.textTertiary}
          style={styles.input}
        />

        <Text style={styles.label}>{t('workout.routineDescription')}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('workout.routineDescription')}
          placeholderTextColor={T.textTertiary}
          style={[styles.input, styles.textArea]}
          multiline
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('workout.favorite')}</Text>
          <Switch
            value={isFavorite}
            onValueChange={setIsFavorite}
            trackColor={{ false: T.borderSoft, true: T.accentLine }}
            thumbColor={isFavorite ? T.accent : T.surface2}
          />
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('workout.noExercisesAdded')}</Text>
            <PressableButton style={styles.secondaryButton} onPress={openExerciseLibrary}>
              <Text style={styles.secondaryButtonText}>{t('workout.searchExercises')}</Text>
            </PressableButton>
          </View>
        ) : (
          <View style={styles.exerciseList}>
            {items.map((item, index) => {
              const exercise = exerciseById.get(item.exerciseId);
              return (
                <View key={item.localId} style={styles.exerciseCard}>
                  <View style={styles.exerciseTop}>
                    <Text style={styles.position}>{index + 1}</Text>
                    <Text style={styles.exerciseName} numberOfLines={2}>
                      {exercise?.name ?? item.exerciseId}
                    </Text>
                    <TouchableOpacity onPress={() => removeExercise(item.localId)} hitSlop={8}>
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>{t('workout.sets')}</Text>
                      <TextInput
                        value={String(item.sets)}
                        onChangeText={(value) =>
                          updateExercise(item.localId, { sets: parseSets(value) })
                        }
                        keyboardType="number-pad"
                        style={styles.fieldInput}
                      />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>{t('workout.reps')}</Text>
                      <TextInput
                        value={item.reps == null ? '' : String(item.reps)}
                        onChangeText={(value) =>
                          updateExercise(item.localId, { reps: parseOptionalInt(value) })
                        }
                        keyboardType="number-pad"
                        placeholder="—"
                        placeholderTextColor={T.textTertiary}
                        style={styles.fieldInput}
                      />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>{t('workout.restSeconds')}</Text>
                      <TextInput
                        value={item.rest == null ? '' : String(item.rest)}
                        onChangeText={(value) =>
                          updateExercise(item.localId, { rest: parseOptionalInt(value) })
                        }
                        keyboardType="number-pad"
                        placeholder="60"
                        placeholderTextColor={T.textTertiary}
                        style={styles.fieldInput}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <PressableButton style={styles.primaryButton} onPress={openExerciseLibrary}>
          <Text style={styles.primaryButtonText}>{t('workout.addExercise')}</Text>
        </PressableButton>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
    saveText: {
      fontFamily: T.fontMonoMedium,
      fontSize: T.textXs,
      color: T.accentText,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      textAlign: 'right',
    },
    saveTextDisabled: {
      color: T.textTertiary,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    body: {
      flex: 1,
    },
    bodyContent: {
      padding: T.sp5,
      paddingBottom: T.sp8,
      gap: T.sp3,
    },
    label: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    input: {
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rLg,
      backgroundColor: T.surface1,
      paddingHorizontal: T.sp4,
      paddingVertical: T.sp3,
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textPrimary,
    },
    textArea: {
      minHeight: 96,
      textAlignVertical: 'top',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: T.sp2,
    },
    switchLabel: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textPrimary,
    },
    emptyState: {
      alignItems: 'center',
      gap: T.sp4,
      paddingVertical: T.sp6,
    },
    emptyText: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textSecondary,
      textAlign: 'center',
    },
    exerciseList: {
      gap: T.sp3,
    },
    exerciseCard: {
      borderWidth: 1,
      borderColor: T.borderSoft,
      backgroundColor: T.surface1,
      borderRadius: T.rLg,
      padding: T.sp4,
      gap: T.sp3,
    },
    exerciseTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: T.sp3,
    },
    position: {
      width: 20,
      fontFamily: T.fontMono,
      fontSize: T.textSm,
      color: T.accentText,
    },
    exerciseName: {
      flex: 1,
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textPrimary,
    },
    removeText: {
      fontFamily: T.fontBody,
      fontSize: T.textMd,
      color: T.textTertiary,
    },
    fieldRow: {
      flexDirection: 'row',
      gap: T.sp3,
    },
    field: {
      flex: 1,
      gap: T.sp1,
    },
    fieldLabel: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 1.2,
    },
    fieldInput: {
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rLg,
      backgroundColor: T.bgBase,
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp2,
      fontFamily: T.fontMono,
      fontSize: T.textSm,
      color: T.textPrimary,
    },
    secondaryButton: {
      paddingVertical: 13,
      paddingHorizontal: T.sp5,
      borderWidth: 1,
      borderColor: T.borderStrong,
      backgroundColor: 'transparent',
    },
    secondaryButtonText: {
      fontFamily: T.fontMonoMedium,
      fontSize: T.textXs,
      letterSpacing: 2,
      color: T.textPrimary,
      textTransform: 'uppercase',
    },
    primaryButton: {
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: T.sp5,
      backgroundColor: T.accent,
      borderWidth: 1,
      borderColor: T.accent,
    },
    primaryButtonText: {
      fontFamily: T.fontMonoMedium,
      fontSize: T.textXs,
      letterSpacing: 2,
      color: T.bgBase,
      textTransform: 'uppercase',
    },
    errorText: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.danger,
      textAlign: 'center',
    },
  });
}
