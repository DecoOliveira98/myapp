import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import { useExerciseSearch } from '../../hooks/useExerciseSearch';
import { getExerciseImageUrl } from '../../lib/exerciseImages';
import { Exercise } from '../../types/exercise';

type Props = {
  onClose: () => void;
  onSelectExercise?: (exerciseId: string) => void;
};

type FilterChip = {
  key: string;
  labelKey: string;
  muscle?: string;
  category?: string;
};

const FILTER_CHIPS: FilterChip[] = [
  { key: 'chest', labelKey: 'workout.muscles.chest', muscle: 'chest' },
  { key: 'back', labelKey: 'workout.muscles.back', muscle: 'middle back' },
  { key: 'shoulders', labelKey: 'workout.muscles.shoulders', muscle: 'shoulders' },
  { key: 'biceps', labelKey: 'workout.muscles.biceps', muscle: 'biceps' },
  { key: 'triceps', labelKey: 'workout.muscles.triceps', muscle: 'triceps' },
  { key: 'legs', labelKey: 'workout.muscles.legs', muscle: 'quadriceps' },
  { key: 'glutes', labelKey: 'workout.muscles.glutes', muscle: 'glutes' },
  { key: 'abs', labelKey: 'workout.muscles.abs', muscle: 'abdominals' },
  { key: 'cardio', labelKey: 'workout.muscles.cardio', category: 'cardio' },
];

function ExerciseListItem({
  exercise,
  styles,
  onPress,
}: {
  exercise: Exercise;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const [imageLoaded, setImageLoaded] = useState(false);
  const imagePath = exercise.images[0];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.thumbWrap}>
        {!imageLoaded && <View style={styles.thumbPlaceholder} />}
        {imagePath ? (
          <Image
            source={{ uri: getExerciseImageUrl(imagePath) }}
            style={styles.thumb}
            resizeMode="cover"
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <View style={styles.thumbPlaceholder} />
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {exercise.name}
        </Text>
        <View style={styles.badgeRow}>
          {exercise.equipment ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{exercise.equipment}</Text>
            </View>
          ) : null}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t(`workout.level.${exercise.level}`)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ExerciseLibraryScreen({ onClose, onSelectExercise }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const { query, setQuery, filters, setFilters, results } = useExerciseSearch();

  function isChipActive(chip: FilterChip) {
    if (chip.category) return filters.category === chip.category;
    return filters.muscle === chip.muscle;
  }

  function handleChipPress(chip: FilterChip) {
    if (chip.category) {
      if (filters.category === chip.category) {
        setFilters({ ...filters, category: undefined });
        return;
      }
      setFilters({ ...filters, muscle: undefined, category: chip.category });
      return;
    }

    if (filters.muscle === chip.muscle) {
      setFilters({ ...filters, muscle: undefined });
      return;
    }
    setFilters({ ...filters, muscle: chip.muscle, category: undefined });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Text style={styles.backText}>{`← ${t('common.back')}`}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('workout.exercises')}</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={T.textTertiary} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('workout.searchPlaceholder')}
          placeholderTextColor={T.textTertiary}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {FILTER_CHIPS.map((chip) => {
          const active = isChipActive(chip);
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => handleChipPress(chip)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t(chip.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.countText}>
        {t('workout.exerciseCount', { count: results.length })}
      </Text>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('workout.noResults')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ExerciseListItem
            exercise={item}
            styles={styles}
            onPress={() => onSelectExercise?.(item.id)}
          />
        )}
      />
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
      fontSize: T.textMd,
      color: T.textPrimary,
      fontFamily: T.fontDisplayItalic,
      letterSpacing: -0.2,
    },
    searchWrap: {
      marginHorizontal: T.sp5,
      marginTop: T.sp4,
      marginBottom: T.sp3,
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rLg,
      backgroundColor: T.surface1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: T.sp3,
    },
    searchIcon: {
      marginRight: T.sp2,
    },
    searchInput: {
      flex: 1,
      paddingVertical: T.sp3,
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textPrimary,
    },
    chipsRow: {
      paddingHorizontal: T.sp5,
      gap: T.sp2,
      paddingBottom: T.sp3,
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
    countText: {
      paddingHorizontal: T.sp5,
      paddingBottom: T.sp3,
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
      letterSpacing: 1.2,
    },
    listContent: {
      paddingHorizontal: T.sp5,
      paddingBottom: T.sp8,
      gap: T.sp3,
    },
    card: {
      flexDirection: 'row',
      gap: T.sp3,
      borderWidth: 1,
      borderColor: T.borderSoft,
      backgroundColor: T.surface1,
      borderRadius: T.rLg,
      padding: T.sp3,
    },
    thumbWrap: {
      width: 60,
      height: 60,
      borderRadius: T.rLg,
      overflow: 'hidden',
    },
    thumb: {
      width: 60,
      height: 60,
    },
    thumbPlaceholder: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: T.surface2,
    },
    cardBody: {
      flex: 1,
      justifyContent: 'center',
      gap: T.sp2,
    },
    cardTitle: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textPrimary,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: T.sp2,
    },
    badge: {
      backgroundColor: T.surface2,
      paddingHorizontal: T.sp2,
      paddingVertical: 2,
      borderRadius: T.rLg,
    },
    badgeText: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      color: T.textTertiary,
    },
    emptyState: {
      paddingVertical: T.sp8,
      alignItems: 'center',
    },
    emptyText: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textSecondary,
      textAlign: 'center',
    },
  });
}
