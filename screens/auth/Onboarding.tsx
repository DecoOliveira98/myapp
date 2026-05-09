import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import PressableButton from '../../components/ui/PressableButton';

// Tipos auxiliares para deixar as opções de chip fortemente tipadas
type Gender = 'male' | 'female';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type Goal = 'lose' | 'maintain' | 'gain';

type Props = {
  // Chamado após salvar com sucesso; App.tsx usa para sair do fluxo de onboarding
  onComplete: () => void;
};

// Multiplicadores de atividade para o cálculo do TDEE (Total Daily Energy Expenditure)
const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Ajuste calórico diário conforme o objetivo do usuário
const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: +500,
};

export default function Onboarding({ onComplete }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  // Bloqueia o botão enquanto o upsert está em andamento
  const [saving, setSaving] = useState(false);

  // Calcula os macros usando Mifflin-St Jeor e retorna os valores para persistir no banco.
  function calculateTargets(
    kg: number,
    cm: number,
    ageNum: number,
    g: Gender,
    act: ActivityLevel,
    gl: Goal,
  ) {
    const bmr =
      g === 'male'
        ? 10 * kg + 6.25 * cm - 5 * ageNum + 5
        : 10 * kg + 6.25 * cm - 5 * ageNum - 161;

    const tdee = bmr * ACTIVITY_MULTIPLIER[act];
    const calories = Math.round(tdee + GOAL_ADJUSTMENT[gl]);

    // 1,6 g de proteína por kg é referência comum para preservação de massa muscular
    const proteinG = Math.round(kg * 1.6);
    // 25% das calorias vindas de gordura (9 kcal/g)
    const fatG = Math.round((calories * 0.25) / 9);
    // O restante das calorias vem dos carboidratos (4 kcal/g)
    const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

    return { calories, proteinG, fatG, carbsG };
  }

  async function handleSave() {
    // Validação básica antes de qualquer chamada de rede
    if (!age || !heightCm || !weightKg) {
      Alert.alert(t('onboarding.validation.requiredFieldsTitle'), t('onboarding.validation.requiredFieldsMessage'));
      return;
    }
    if (!gender) {
      Alert.alert(t('onboarding.validation.selectGenderTitle'), t('onboarding.validation.selectGenderMessage'));
      return;
    }
    if (!activity) {
      Alert.alert(t('onboarding.validation.selectActivityTitle'), t('onboarding.validation.selectActivityMessage'));
      return;
    }
    if (!goal) {
      Alert.alert(t('onboarding.validation.selectGoalTitle'), t('onboarding.validation.selectGoalMessage'));
      return;
    }

    const ageNum = parseInt(age, 10);
    const kg = parseFloat(weightKg);
    const cm = parseFloat(heightCm);

    if (isNaN(ageNum) || isNaN(kg) || isNaN(cm)) {
      Alert.alert(t('onboarding.validation.invalidValuesTitle'), t('onboarding.validation.invalidValuesMessage'));
      return;
    }

    // Calcula os targets para persistir junto com o perfil
    const targets = calculateTargets(kg, cm, ageNum, gender, activity, goal);

    setSaving(true);

    // Busca o usuário autenticado para usar o UUID correto como PK do perfil
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      Alert.alert(t('common.error'), t('onboarding.validation.userFetchError'));
      setSaving(false);
      return;
    }

    // date_of_birth é aproximado: apenas o ano importa para o cálculo de idade.
    // Dia e mês são fixos em 01-01 para simplificar enquanto não temos um date picker.
    const currentYear = new Date().getFullYear();
    const dateOfBirth = `${currentYear - ageNum}-01-01`;

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      gender,
      height_cm: cm,
      weight_kg: kg,
      date_of_birth: dateOfBirth,
      activity_level: activity,
      goal,
      daily_calorie_target: targets.calories,
      daily_protein_g: targets.proteinG,
      daily_carbs_g: targets.carbsG,
      daily_fat_g: targets.fatG,
    });

    if (upsertError) {
      Alert.alert(t('onboarding.validation.saveErrorTitle'), upsertError.message);
      setSaving(false);
      return;
    }

    // Sinaliza ao App.tsx que o onboarding foi concluído com sucesso
    onComplete();
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>{t('onboarding.titleEyebrow')}</Text>
      <Text style={styles.title}>{t('onboarding.title')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>

      {/* ── Idade ─────────────────────────────────────────────────── */}
      <Text style={styles.label}>{t('onboarding.age')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('onboarding.placeholders.age')}
        placeholderTextColor={T.textTertiary}
        value={age}
        onChangeText={setAge}
        keyboardType="numeric"
      />

      {/* ── Sexo ──────────────────────────────────────────────────── */}
      <Text style={styles.label}>{t('onboarding.gender')}</Text>
      <View style={styles.chipRow}>
        <Chip
          label={t('onboarding.male')}
          selected={gender === 'male'}
          onPress={() => setGender('male')}
        />
        <Chip
          label={t('onboarding.female')}
          selected={gender === 'female'}
          onPress={() => setGender('female')}
        />
      </View>

      {/* ── Altura ────────────────────────────────────────────────── */}
      <Text style={styles.label}>{t('onboarding.height')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('onboarding.placeholders.height')}
        placeholderTextColor={T.textTertiary}
        value={heightCm}
        onChangeText={setHeightCm}
        keyboardType="numeric"
      />

      {/* ── Peso ──────────────────────────────────────────────────── */}
      <Text style={styles.label}>{t('onboarding.weight')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('onboarding.placeholders.weight')}
        placeholderTextColor={T.textTertiary}
        value={weightKg}
        onChangeText={setWeightKg}
        keyboardType="numeric"
      />

      {/* ── Nível de atividade ────────────────────────────────────── */}
      <Text style={styles.label}>{t('onboarding.activityLevel')}</Text>
      <View style={styles.chipRow}>
        <Chip label={t('onboarding.sedentary')} selected={activity === 'sedentary'} onPress={() => setActivity('sedentary')} />
        <Chip label={t('onboarding.light')} selected={activity === 'light'} onPress={() => setActivity('light')} />
        <Chip label={t('onboarding.moderate')} selected={activity === 'moderate'} onPress={() => setActivity('moderate')} />
        <Chip label={t('onboarding.active')} selected={activity === 'active'} onPress={() => setActivity('active')} />
        <Chip label={t('onboarding.veryActive')} selected={activity === 'very_active'} onPress={() => setActivity('very_active')} />
      </View>

      {/* ── Meta ──────────────────────────────────────────────────── */}
      <Text style={styles.label}>{t('onboarding.goal')}</Text>
      <View style={styles.chipRow}>
        <Chip label={t('onboarding.loseWeight')} selected={goal === 'lose'} onPress={() => setGoal('lose')} />
        <Chip label={t('onboarding.maintain')} selected={goal === 'maintain'} onPress={() => setGoal('maintain')} />
        <Chip label={t('onboarding.gainWeight')} selected={goal === 'gain'} onPress={() => setGoal('gain')} />
      </View>

      <PressableButton
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? t('onboarding.saving') : t('onboarding.saveAndContinue')}
        </Text>
      </PressableButton>
    </ScrollView>
  );
}

// ── Componente interno Chip ────────────────────────────────────────────────
// Separado para manter o JSX do formulário limpo e reutilizar o estilo visual.
type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function Chip({ label, selected, onPress }: ChipProps) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────
function makeStyles(T: TokenSet) {
  return StyleSheet.create({
    container: {
      padding: T.sp5,
      paddingTop: 60,
      backgroundColor: T.bgBase,
    },
    eyebrow: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      letterSpacing: 2,
      color: T.textTertiary,
      marginBottom: T.sp2,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: T.textXl,
      color: T.textPrimary,
      marginBottom: T.sp1,
      fontFamily: T.fontDisplay,
    },
    subtitle: {
      fontSize: T.textSm,
      color: T.textSecondary,
      marginBottom: T.sp6,
      fontFamily: T.fontBody,
    },
    label: {
      fontSize: T.textXs,
      color: T.textTertiary,
      marginBottom: T.sp2,
      marginTop: T.sp4,
      fontFamily: T.fontMono,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    input: {
      borderWidth: 1,
      borderColor: T.borderSoft,
      paddingHorizontal: T.sp4,
      paddingVertical: T.sp3,
      fontSize: T.textBase,
      color: T.textPrimary,
      backgroundColor: T.surface1,
      fontFamily: T.fontBody,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: T.sp2,
    },
    chip: {
      borderWidth: 1,
      borderColor: T.borderStrong,
      paddingHorizontal: T.sp4,
      paddingVertical: T.sp2,
      backgroundColor: 'transparent',
    },
    chipSelected: {
      backgroundColor: T.accentBg,
      borderColor: T.accent,
    },
    chipText: {
      fontSize: T.textSm,
      color: T.textSecondary,
      fontFamily: T.fontBody,
    },
    chipTextSelected: {
      color: T.accent,
      fontFamily: T.fontBodySemiBold,
    },
    saveButton: {
      backgroundColor: T.accent,
      borderWidth: 1,
      borderColor: T.accent,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: T.sp7,
      marginBottom: T.sp5,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: T.onAccent,
      fontSize: T.textXs,
      fontFamily: T.fontMonoMedium,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
  });
}
