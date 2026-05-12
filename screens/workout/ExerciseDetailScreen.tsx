import { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import exercisesData from '../../data/exercises.json';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import PressableButton from '../../components/ui/PressableButton';
import { getExerciseImageUrl } from '../../lib/exerciseImages';
import { Exercise } from '../../types/exercise';

type Props = {
  exerciseId: string;
  onClose: () => void;
  onAddToRoutine?: (exerciseId: string) => void;
};

const exercises: Exercise[] = exercisesData as Exercise[];

function DetailImage({ imagePath, styles }: { imagePath: string; styles: ReturnType<typeof makeStyles> }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <View style={styles.imageCard}>
      {!loaded && <View style={styles.imagePlaceholder} />}
      <Image
        source={{ uri: getExerciseImageUrl(imagePath) }}
        style={styles.image}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
}

export default function ExerciseDetailScreen({ exerciseId, onClose, onAddToRoutine }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const exercise = exercises.find((item) => item.id === exerciseId);

  if (!exercise) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.backText}>{`← ${t('common.back')}`}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.missingState}>
          <Text style={styles.missingText}>{t('workout.noResults')}</Text>
        </View>
      </View>
    );
  }

  const levelColor =
    exercise.level === 'beginner'
      ? T.success
      : exercise.level === 'intermediate'
        ? T.accent
        : T.danger;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Text style={styles.backText}>{`← ${t('common.back')}`}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {exercise.name}
        </Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imageRow}
        >
          {exercise.images.map((imagePath) => (
            <DetailImage key={imagePath} imagePath={imagePath} styles={styles} />
          ))}
        </ScrollView>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: levelColor }]}>
            <Text style={styles.badgeOnColor}>{t(`workout.level.${exercise.level}`)}</Text>
          </View>
          {exercise.equipment ? (
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>{exercise.equipment}</Text>
            </View>
          ) : null}
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>{exercise.category}</Text>
          </View>
          {exercise.force ? (
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>{exercise.force}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>{t('workout.primaryMuscles')}</Text>
        <View style={styles.chipRow}>
          {exercise.primaryMuscles.map((muscle) => (
            <View key={muscle} style={styles.primaryChip}>
              <Text style={styles.primaryChipText}>{muscle}</Text>
            </View>
          ))}
        </View>

        {exercise.secondaryMuscles.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{t('workout.secondaryMuscles')}</Text>
            <View style={styles.chipRow}>
              {exercise.secondaryMuscles.map((muscle) => (
                <View key={muscle} style={styles.ghostChip}>
                  <Text style={styles.ghostChipText}>{muscle}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>{t('workout.instructions')}</Text>
        {exercise.instructions.map((step, index) => (
          <View key={`${exercise.id}-step-${index}`} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <PressableButton
          style={styles.primaryButton}
          onPress={() => onAddToRoutine?.(exercise.id)}
        >
          <Text style={styles.primaryButtonText}>{t('workout.addToRoutine')}</Text>
        </PressableButton>
      </View>
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
      gap: T.sp3,
    },
    backText: {
      fontSize: T.textSm,
      color: T.textSecondary,
      fontFamily: T.fontMono,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    headerTitle: {
      flex: 1,
      fontSize: T.textMd,
      color: T.textPrimary,
      fontFamily: T.fontDisplayItalic,
      letterSpacing: -0.2,
    },
    body: {
      flex: 1,
    },
    bodyContent: {
      padding: T.sp5,
      paddingBottom: T.sp8,
    },
    imageRow: {
      gap: T.sp3,
      paddingBottom: T.sp5,
    },
    imageCard: {
      width: 300,
      height: 220,
      borderRadius: T.rLg,
      overflow: 'hidden',
    },
    image: {
      width: 300,
      height: 220,
    },
    imagePlaceholder: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: T.surface2,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: T.sp2,
      marginBottom: T.sp5,
    },
    badge: {
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp1,
      borderRadius: T.rLg,
    },
    badgeOnColor: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.onAccent,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    metaBadge: {
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp1,
      borderRadius: T.rLg,
      backgroundColor: T.surface2,
    },
    metaBadgeText: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      textTransform: 'capitalize',
    },
    sectionLabel: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginBottom: T.sp3,
      marginTop: T.sp2,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: T.sp2,
      marginBottom: T.sp4,
    },
    primaryChip: {
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp2,
      borderRadius: T.rLg,
      backgroundColor: T.accent,
    },
    primaryChipText: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.onAccent,
      textTransform: 'capitalize',
    },
    ghostChip: {
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp2,
      borderRadius: T.rLg,
      borderWidth: 1,
      borderColor: T.borderSoft,
      backgroundColor: 'transparent',
    },
    ghostChipText: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textSecondary,
      textTransform: 'capitalize',
    },
    stepRow: {
      flexDirection: 'row',
      gap: T.sp3,
      marginBottom: T.sp3,
    },
    stepNumber: {
      width: 24,
      fontFamily: T.fontMono,
      fontSize: T.textSm,
      color: T.accentText,
    },
    stepText: {
      flex: 1,
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textPrimary,
      lineHeight: T.textBase * 1.45,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: T.borderSoft,
      paddingHorizontal: T.sp5,
      paddingTop: T.sp4,
      paddingBottom: T.sp6,
      backgroundColor: T.bgBase,
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
    missingState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: T.sp5,
    },
    missingText: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textSecondary,
      textAlign: 'center',
    },
  });
}
