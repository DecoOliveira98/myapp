// MET values por categoria de exercício
// Fonte: Compendium of Physical Activities (Ainsworth et al.)
// Fórmula: Calorias = MET × peso_kg × duração_horas

export const MET_BY_CATEGORY: Record<string, number> = {
  // Musculação geral
  strength: 6.0,
  powerlifting: 6.0,
  'olympic weightlifting': 6.0,
  strongman: 6.0,
  // Cardio
  cardio: 7.0,
  // Alongamento
  stretching: 2.5,
  // Pliometria
  plyometrics: 8.0,
};

// MET values mais específicos por tipo de exercício (override do genérico)
// Estes são usados quando o exercício é identificável
export const MET_OVERRIDES: Record<string, number> = {
  // Cardio específico
  running: 9.8,
  jogging: 7.0,
  cycling: 7.5,
  swimming: 8.0,
  rowing: 7.0,
  jump_rope: 12.3,
  elliptical: 5.0,
  stair_climbing: 9.0,
  walking: 3.5,
  hiking: 6.0,

  // Musculação por intensidade
  bench_press: 6.0,
  squat: 6.0,
  deadlift: 6.0,
  pull_ups: 8.0,
  push_ups: 8.0,
  burpees: 8.0,
  plank: 3.8,
  crunches: 3.8,
  lunges: 6.0,
  kettlebell: 6.0,
};

/**
 * Retorna o MET value pra um exercício.
 * Tenta override específico primeiro, depois fallback pra categoria.
 */
export function getMetValue(exerciseId: string, category: string): number {
  const idLower = exerciseId.toLowerCase();
  for (const [key, met] of Object.entries(MET_OVERRIDES)) {
    if (idLower.includes(key)) return met;
  }
  return MET_BY_CATEGORY[category] ?? 5.0;
}

/**
 * Calcula calorias queimadas.
 * @param met - MET value do exercício
 * @param weightKg - peso do user em kg
 * @param durationMinutes - duração em minutos
 * @returns calorias estimadas (arredondado)
 */
export function calculateCaloriesBurned(
  met: number,
  weightKg: number,
  durationMinutes: number
): number {
  return Math.round(met * weightKg * (durationMinutes / 60));
}
