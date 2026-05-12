import { useMemo, useState } from 'react';
import exercisesData from '../data/exercises.json';
import { Exercise } from '../types/exercise';

const exercises: Exercise[] = exercisesData as Exercise[];

export const ALL_MUSCLES = [...new Set(exercises.flatMap((e) => e.primaryMuscles))].sort();
export const ALL_EQUIPMENT = [...new Set(exercises.map((e) => e.equipment).filter(Boolean))].sort() as string[];
export const ALL_CATEGORIES = [...new Set(exercises.map((e) => e.category))].sort();
export const ALL_LEVELS = ['beginner', 'intermediate', 'expert'] as const;

interface Filters {
  muscle?: string;
  equipment?: string;
  category?: string;
  level?: string;
}

export function useExerciseSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({});

  const results = useMemo(() => {
    let filtered = exercises;

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      filtered = filtered.filter((e) => e.name.toLowerCase().includes(q));
    }

    if (filters.muscle) {
      filtered = filtered.filter(
        (e) =>
          e.primaryMuscles.includes(filters.muscle!) ||
          e.secondaryMuscles.includes(filters.muscle!)
      );
    }

    if (filters.equipment) {
      filtered = filtered.filter((e) => e.equipment === filters.equipment);
    }

    if (filters.category) {
      filtered = filtered.filter((e) => e.category === filters.category);
    }

    if (filters.level) {
      filtered = filtered.filter((e) => e.level === filters.level);
    }

    return filtered;
  }, [query, filters]);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    results,
    totalCount: exercises.length,
  };
}
