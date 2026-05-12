import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import exercisesData from '../../data/exercises.json';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import PressableButton from '../../components/ui/PressableButton';

type Props = {
  session: Session;
  onClose: () => void;
  onPlanSaved: () => void;
};

type GeneratedPlan = {
  name: string;
  description: string;
  routines: {
    name: string;
    exercises: {
      exercise_id: string;
      name: string;
      target_sets: number;
      target_reps: number | null;
      rest_seconds: number;
      notes?: string;
    }[];
  }[];
};

type FitnessLevel = 'beginner' | 'moderate' | 'advanced';
type TrainingGoal = 'strength' | 'hypertrophy' | 'endurance' | 'weight_loss';

const validIds = new Set(exercisesData.map((exercise) => exercise.id));
const DAY_OPTIONS = [2, 3, 4, 5, 6] as const;

function validatePlans(plans: GeneratedPlan[]): GeneratedPlan[] {
  return plans.map((plan) => ({
    ...plan,
    routines: plan.routines.map((routine) => ({
      ...routine,
      exercises: routine.exercises.filter((exercise) => validIds.has(exercise.exercise_id)),
    })),
  }));
}

export default function GenerateWorkoutScreen({ session, onClose, onPlanSaved }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel>('moderate');
  const [goal, setGoal] = useState<TrainingGoal>('hypertrophy');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [equipment, setEquipment] = useState<string[]>(['body only']);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<GeneratedPlan[] | null>(null);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const equipmentOptions = useMemo(
    () => [
      { label: t('workout.bodyOnly'), value: 'body only' },
      { label: t('workout.dumbbell'), value: 'dumbbell' },
      { label: t('workout.barbell'), value: 'barbell' },
      { label: t('workout.cable'), value: 'cable' },
      { label: t('workout.machine'), value: 'machine' },
      { label: t('workout.kettlebells'), value: 'kettlebells' },
      { label: t('workout.bands'), value: 'bands' },
    ],
    [t],
  );

  const levelOptions: { key: FitnessLevel; label: string }[] = [
    { key: 'beginner', label: t('workout.levelBeginner') },
    { key: 'moderate', label: t('workout.levelModerate') },
    { key: 'advanced', label: t('workout.levelAdvanced') },
  ];

  const goalOptions: { key: TrainingGoal; label: string }[] = [
    { key: 'strength', label: t('workout.goalStrength') },
    { key: 'hypertrophy', label: t('workout.goalHypertrophy') },
    { key: 'endurance', label: t('workout.goalEndurance') },
    { key: 'weight_loss', label: t('workout.goalWeightLoss') },
  ];

  function toggleEquipment(value: string) {
    setEquipment((current) => {
      if (current.includes(value)) {
        const next = current.filter((item) => item !== value);
        return next.length > 0 ? next : ['body only'];
      }
      return [...current, value];
    });
  }

  async function handleGenerate() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('generate-workout-plan', {
      body: {
        fitness_level: fitnessLevel,
        goal,
        available_equipment: equipment,
        days_per_week: daysPerWeek,
      },
    });

    if (error || data?.error || !Array.isArray(data?.plans)) {
      Alert.alert(t('common.error'), t('workout.generateError'));
      setLoading(false);
      return;
    }

    setPlans(validatePlans(data.plans as GeneratedPlan[]));
    setSelectedPlanIndex(0);
    setLoading(false);
  }

  async function handleSavePlan() {
    if (!plans) return;
    setSaving(true);

    const plan = plans[selectedPlanIndex];

    for (const routine of plan.routines) {
      const { data: routineRow, error: routineError } = await supabase
        .from('workout_routines')
        .insert({
          user_id: session.user.id,
          name: routine.name,
          description: plan.name,
          is_favorite: false,
        })
        .select('id')
        .single();

      if (routineError || !routineRow) continue;

      if (routine.exercises.length > 0) {
        await supabase.from('routine_exercises').insert(
          routine.exercises.map((exercise, index) => ({
            routine_id: routineRow.id,
            exercise_id: exercise.exercise_id,
            position: index,
            target_sets: exercise.target_sets,
            target_reps: exercise.target_reps,
            rest_seconds: exercise.rest_seconds,
            notes: exercise.notes || null,
          })),
        );
      }
    }

    await supabase
      .from('profiles')
      .update({ fitness_level: fitnessLevel })
      .eq('id', session.user.id);

    setSaving(false);
    Alert.alert(
      t('workout.planSaved'),
      t('workout.planSavedMessage', { count: plan.routines.length }),
      [{ text: 'OK', onPress: () => { onPlanSaved(); onClose(); } }],
    );
  }

  function handleBack() {
    if (plans) {
      setPlans(null);
      return;
    }
    onClose();
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
          <ActivityIndicator color={T.accent} size="large" />
          <Text style={styles.loadingText}>{t('workout.generating')}</Text>
        </View>
      </View>
    );
  }

  const selectedPlan = plans?.[selectedPlanIndex];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={8} style={styles.headerSide}>
          <Text style={styles.backText}>{`← ${t('common.back')}`}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {plans ? t('workout.choosePlan') : t('workout.generatePlan')}
        </Text>
        <View style={styles.headerSide} />
      </View>

      {!plans ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>{t('workout.fitnessLevel')}</Text>
          <View style={styles.chipRow}>
            {levelOptions.map((option) => {
              const active = fitnessLevel === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setFitnessLevel(option.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>{t('workout.trainingGoal')}</Text>
          <View style={styles.chipRow}>
            {goalOptions.map((option) => {
              const active = goal === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setGoal(option.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>{t('workout.daysPerWeek')}</Text>
          <View style={styles.chipRow}>
            {DAY_OPTIONS.map((day) => {
              const active = daysPerWeek === day;
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, active && styles.chipActive]}
                  onPress={() => setDaysPerWeek(day)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dayChipText, active && styles.chipTextActive]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>{t('workout.availableEquipment')}</Text>
          <View style={styles.chipRow}>
            {equipmentOptions.map((option) => {
              const active = equipment.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleEquipment(option.value)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <PressableButton style={styles.primaryButton} onPress={() => void handleGenerate()}>
            <Text style={styles.primaryButtonText}>{t('workout.generate')}</Text>
          </PressableButton>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {plans.map((plan, index) => {
              const active = selectedPlanIndex === index;
              return (
                <TouchableOpacity
                  key={`${plan.name}-${index}`}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setSelectedPlanIndex(index)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {plan.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedPlan ? (
              <>
                <Text style={styles.planDescription}>{selectedPlan.description}</Text>
                {selectedPlan.routines.map((routine) => (
                  <View key={routine.name} style={styles.routineBlock}>
                    <Text style={styles.routineName}>{routine.name}</Text>
                    {routine.exercises.map((exercise) => (
                      <View key={`${routine.name}-${exercise.exercise_id}`} style={styles.exerciseRow}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Text style={styles.exerciseMeta}>
                          {t('workout.setsRepsFormat', {
                            sets: exercise.target_sets,
                            reps: exercise.target_reps ?? '—',
                            rest: exercise.rest_seconds,
                          })}
                        </Text>
                        {exercise.notes ? (
                          <Text style={styles.exerciseNote}>{exercise.notes}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <PressableButton
              style={styles.primaryButton}
              onPress={() => void handleSavePlan()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={T.bgBase} />
              ) : (
                <Text style={styles.primaryButtonText}>{t('workout.savePlan')}</Text>
              )}
            </PressableButton>
            <PressableButton
              style={styles.secondaryButton}
              onPress={() => setPlans(null)}
              disabled={saving}
            >
              <Text style={styles.secondaryButtonText}>{t('workout.regenerate')}</Text>
            </PressableButton>
          </View>
        </>
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
      gap: T.sp4,
      paddingHorizontal: T.sp5,
    },
    loadingText: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textSecondary,
      textAlign: 'center',
    },
    body: {
      flex: 1,
    },
    bodyContent: {
      padding: T.sp5,
      paddingBottom: T.sp8,
      gap: T.sp4,
    },
    sectionLabel: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: T.sp2,
    },
    chip: {
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp2,
      borderRadius: T.rLg,
      backgroundColor: T.surface2,
    },
    chipActive: {
      backgroundColor: T.accent,
    },
    chipText: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textSecondary,
    },
    chipTextActive: {
      color: T.onAccent,
    },
    dayChip: {
      minWidth: 40,
      alignItems: 'center',
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp2,
      borderRadius: T.rLg,
      backgroundColor: T.surface2,
    },
    dayChipText: {
      fontFamily: T.fontMono,
      fontSize: T.textSm,
      color: T.textSecondary,
    },
    primaryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      paddingHorizontal: T.sp5,
      backgroundColor: T.accent,
      borderWidth: 1,
      borderColor: T.accent,
      marginTop: T.sp2,
    },
    primaryButtonText: {
      fontFamily: T.fontMonoMedium,
      fontSize: T.textXs,
      letterSpacing: 2,
      color: T.bgBase,
      textTransform: 'uppercase',
    },
    tabsRow: {
      paddingHorizontal: T.sp5,
      paddingTop: T.sp4,
      gap: T.sp4,
    },
    tab: {
      paddingBottom: T.sp2,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: T.accent,
    },
    tabText: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textTertiary,
    },
    tabTextActive: {
      color: T.textPrimary,
    },
    planDescription: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textSecondary,
      lineHeight: T.textBase * 1.45,
    },
    routineBlock: {
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rLg,
      backgroundColor: T.surface1,
      padding: T.sp4,
      gap: T.sp3,
    },
    routineName: {
      fontFamily: T.fontBodySemiBold,
      fontSize: T.textBase,
      color: T.textPrimary,
    },
    exerciseRow: {
      gap: T.sp1,
    },
    exerciseName: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textPrimary,
    },
    exerciseMeta: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 1.2,
    },
    exerciseNote: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textTertiary,
      fontStyle: 'italic',
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: T.borderSoft,
      paddingHorizontal: T.sp5,
      paddingTop: T.sp4,
      paddingBottom: T.sp6,
      gap: T.sp3,
      backgroundColor: T.bgBase,
    },
    secondaryButton: {
      alignItems: 'center',
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
  });
}
