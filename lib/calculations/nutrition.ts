export type Sex = 'male' | 'female' | 'other' | 'prefer_not';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';

type BMRInput = {
    sex: Sex;
    weight_kg: number;
    height_cm: number;
    age: number;
};

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
};

function assertFinitePositive(value: number, field: string): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid ${field}`);
    }
}

function roundToNearest10(value: number): number {
    return Math.round(value / 10) * 10;
}

export function calculateBMR({ sex, weight_kg, height_cm, age }: BMRInput): number {
    assertFinitePositive(weight_kg, 'weight_kg');
    assertFinitePositive(height_cm, 'height_cm');
    assertFinitePositive(age, 'age');

    const male = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
    const female = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;

    if (sex === 'male') return male;
    if (sex === 'female') return female;
    return (male + female) / 2;
}

export function calculateTDEE(bmr: number, activity_level: ActivityLevel): number {
    assertFinitePositive(bmr, 'bmr');
    const multiplier = ACTIVITY_MULTIPLIERS[activity_level];
    if (!multiplier) {
        throw new Error('Invalid activity_level');
    }
    return bmr * multiplier;
}

export function calculateCalorieTarget(tdee: number, goal: Goal): number {
    assertFinitePositive(tdee, 'tdee');

    let target = tdee;
    if (goal === 'lose') {
        target = Math.max(1200, tdee - 500);
    } else if (goal === 'gain') {
        target = tdee + 500;
    } else if (goal !== 'maintain') {
        throw new Error('Invalid goal');
    }

    return roundToNearest10(target);
}

export function calculateMacroGrams(calories: number, goal: Goal): {
    protein_g: number;
    carbs_g: number;
    fat_g: number;
} {
    assertFinitePositive(calories, 'calories');

    let proteinPct = 0;
    let carbsPct = 0;
    let fatPct = 0;

    if (goal === 'lose') {
        proteinPct = 0.35;
        carbsPct = 0.35;
        fatPct = 0.3;
    } else if (goal === 'maintain') {
        proteinPct = 0.3;
        carbsPct = 0.4;
        fatPct = 0.3;
    } else if (goal === 'gain') {
        proteinPct = 0.25;
        carbsPct = 0.5;
        fatPct = 0.25;
    } else {
        throw new Error('Invalid goal');
    }

    const protein_g = Math.round((calories * proteinPct) / 4);
    const carbs_g = Math.round((calories * carbsPct) / 4);
    const fat_g = Math.round((calories * fatPct) / 9);

    return { protein_g, carbs_g, fat_g };
}

/**
 * Calculates completed years of age from a date of birth.
 *
 * Algorithm:
 * - Normalizes the birth date into year/month/day components.
 * - Computes raw year difference: today.year - birth.year.
 * - Subtracts 1 if today's month/day is before the birthday in the current year.
 *
 * Notes:
 * - Accepts either:
 *   - ISO date string in `YYYY-MM-DD` format, or
 *   - `Date` object.
 * - Uses calendar components (year/month/day), avoiding millisecond-based
 *   approximations (e.g. 365/365.25 day divisions) and timezone-sensitive
 *   parsing pitfalls for plain ISO dates.
 */
export function calculateAge(date_of_birth: string | Date): number {
    let birthYear: number;
    let birthMonth: number;
    let birthDay: number;

    if (date_of_birth instanceof Date) {
        if (Number.isNaN(date_of_birth.getTime())) {
            throw new Error('Invalid date_of_birth');
        }
        birthYear = date_of_birth.getFullYear();
        birthMonth = date_of_birth.getMonth() + 1;
        birthDay = date_of_birth.getDate();
    } else if (typeof date_of_birth === 'string') {
        const trimmed = date_of_birth.trim();
        const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
        const dateTimeMatch =
            /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+\-]\d{2}:\d{2})?$/.exec(trimmed);

        if (dateOnlyMatch) {
            birthYear = Number(dateOnlyMatch[1]);
            birthMonth = Number(dateOnlyMatch[2]);
            birthDay = Number(dateOnlyMatch[3]);

            const valid = new Date(birthYear, birthMonth - 1, birthDay);
            if (
                Number.isNaN(valid.getTime()) ||
                valid.getFullYear() !== birthYear ||
                valid.getMonth() + 1 !== birthMonth ||
                valid.getDate() !== birthDay
            ) {
                throw new Error('Invalid date_of_birth');
            }
        } else if (dateTimeMatch) {
            const parsed = new Date(trimmed);
            if (Number.isNaN(parsed.getTime())) {
                throw new Error('Invalid date_of_birth');
            }
            birthYear = parsed.getFullYear();
            birthMonth = parsed.getMonth() + 1;
            birthDay = parsed.getDate();
        } else {
            throw new Error('Invalid date_of_birth');
        }
    } else {
        throw new Error('Invalid date_of_birth');
    }

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    let age = todayYear - birthYear;

    if (todayMonth < birthMonth || (todayMonth === birthMonth && todayDay < birthDay)) {
        age -= 1;
    }

    return age;
}
