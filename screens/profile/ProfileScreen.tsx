import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Session } from '@supabase/supabase-js';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../lib/supabase';
import { useTheme, type ThemePreference } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import { type Profile } from '../../hooks/useProfile';
import Avatar from '../../components/avatar/Avatar';
import { useTranslation } from 'react-i18next';
import {
  getStoredLanguagePreference,
  setLanguagePreference,
  type LanguagePreference,
} from '../../i18n';
import PressableButton from '../../components/ui/PressableButton';
import {
  ActivityLevel,
  calculateAge,
  calculateBMR,
  calculateCalorieTarget,
  calculateMacroGrams,
  calculateTDEE,
  Goal,
  Sex,
} from '../../lib/calculations/nutrition';

type Props = {
  session: Session;
  profile: Profile | null;
  onClose: () => void;
  refetchProfile: () => Promise<void>;
};

type FormState = {
  display_name: string;
  date_of_birth: string;
  gender: string;
  height_cm: string;
  weight_kg: string;
  activity_level: string;
  goal: string;
  daily_calorie_target: string;
  daily_protein_g: string;
  daily_carbs_g: string;
  daily_fat_g: string;
};

function profileToForm(p: Profile | null): FormState {
  return {
    display_name: p?.display_name ?? '',
    date_of_birth: p?.date_of_birth ?? '',
    gender: p?.gender ?? '',
    height_cm: p?.height_cm != null ? String(p.height_cm) : '',
    weight_kg: p?.weight_kg != null ? String(p.weight_kg) : '',
    activity_level: p?.activity_level ?? '',
    goal: p?.goal ?? '',
    daily_calorie_target: p?.daily_calorie_target != null ? String(p.daily_calorie_target) : '',
    daily_protein_g: p?.daily_protein_g != null ? String(p.daily_protein_g) : '',
    daily_carbs_g: p?.daily_carbs_g != null ? String(p.daily_carbs_g) : '',
    daily_fat_g: p?.daily_fat_g != null ? String(p.daily_fat_g) : '',
  };
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function getStoragePath(avatarUrl: string): string {
  const url = avatarUrl.split('?')[0];
  const marker = '/avatars/';
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length) : '';
}

function parseISODate(dateISO: string): Date | null {
  if (!dateISO) return null;
  const d = new Date(`${dateISO}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISODateOnly(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocaleDate(dateISO: string, locale: string, fallback: string): string {
  const d = parseISODate(dateISO);
  if (!d) return fallback;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function SegmentedField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const { T } = useTheme();
  const seg = useMemo(() => makeSegmentedStyles(T), [T]);

  return (
    <View style={seg.row}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[seg.btn, value === opt.value && seg.btnActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === opt.value }}
        >
          <Text style={[seg.btnText, value === opt.value && seg.btnTextActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function makeSegmentedStyles(T: TokenSet) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: T.sp1,
    },
    btn: {
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp2,
      borderRadius: T.rMd,
      borderWidth: 1,
      borderColor: T.borderSoft,
      backgroundColor: T.surface2,
    },
    btnActive: {
      backgroundColor: T.accentBg,
      borderColor: T.accentLine,
    },
    btnText: {
      fontFamily: T.fontBodyMedium,
      fontSize: T.textSm,
      color: T.textTertiary,
    },
    btnTextActive: {
      color: T.accent,
    },
  });
}

type OptionItem = { value: string; label: string; description?: string };

function OptionList({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: OptionItem[];
}) {
  const { T } = useTheme();
  const ol = useMemo(() => makeOptionListStyles(T), [T]);

  return (
    <View style={ol.container}>
      {options.map((opt, i) => (
        <TouchableOpacity
          key={opt.value}
          style={[ol.item, i < options.length - 1 && ol.itemBorder, value === opt.value && ol.itemActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === opt.value }}
        >
          <View style={ol.row}>
            <View style={{ flex: 1 }}>
              <Text style={[ol.label, value === opt.value && ol.labelActive]}>{opt.label}</Text>
              {opt.description != null && <Text style={ol.desc}>{opt.description}</Text>}
            </View>
            {value === opt.value && <Feather name="check" size={15} color={T.accent} />}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function makeOptionListStyles(T: TokenSet) {
  return StyleSheet.create({
    container: {
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rLg,
      overflow: 'hidden',
    },
    item: {
      paddingHorizontal: T.sp4,
      paddingVertical: T.sp3,
      backgroundColor: T.surface2,
    },
    itemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: T.borderFaint,
    },
    itemActive: {
      backgroundColor: T.accentBg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: T.sp2,
    },
    label: {
      fontFamily: T.fontBodyMedium,
      fontSize: T.textBase,
      color: T.textSecondary,
    },
    labelActive: {
      color: T.accent,
    },
    desc: {
      fontFamily: T.fontBody,
      fontSize: T.textSm,
      color: T.textTertiary,
      marginTop: 2,
    },
  });
}

const MIN_DOB = new Date('1900-01-01T00:00:00');
const DEFAULT_DOB = new Date('1990-01-01T00:00:00');

export default function ProfileScreen({ session, profile, onClose, refetchProfile }: Props) {
  const { T, themePreference, setThemePreference } = useTheme();
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'pt-BR';
  const ps = useMemo(() => makeStyles(T), [T]);
  const [form, setForm] = useState<FormState>(profileToForm(profile));
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [iosPickerDate, setIosPickerDate] = useState<Date>(parseISODate(profile?.date_of_birth ?? '') ?? DEFAULT_DOB);
  const [avatarSrc, setAvatarSrc] = useState<string | undefined>(
    profile?.avatar_url ??
    (session.user.user_metadata?.avatar_url as string | undefined) ??
    (session.user.user_metadata?.picture as string | undefined) ??
    undefined,
  );
  const [languagePreference, setLanguagePreferenceState] = useState<LanguagePreference>('auto');

  useEffect(() => {
    setForm(profileToForm(profile));
    setAvatarSrc(
      profile?.avatar_url ??
      (session.user.user_metadata?.avatar_url as string | undefined) ??
      (session.user.user_metadata?.picture as string | undefined) ??
      undefined,
    );
    setIosPickerDate(parseISODate(profile?.date_of_birth ?? '') ?? DEFAULT_DOB);
  }, [profile, session.user.user_metadata]);

  useEffect(() => {
    getStoredLanguagePreference().then(setLanguagePreferenceState);
  }, []);

  const displayName = useMemo(
    () => form.display_name || (session.user.user_metadata?.name as string | undefined) || session.user.email || 'User',
    [form.display_name, session.user.user_metadata, session.user.email],
  );

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const today = new Date();
  const selectedDobDate = parseISODate(form.date_of_birth) ?? DEFAULT_DOB;

  const openDatePicker = () => {
    const initial = parseISODate(form.date_of_birth) ?? DEFAULT_DOB;
    if (Platform.OS === 'ios') setIosPickerDate(initial);
    setShowDatePicker(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && date) {
        setField('date_of_birth', toISODateOnly(date));
      }
      return;
    }

    if (date) {
      setIosPickerDate(date);
    }
  };

  const confirmIOSDate = () => {
    setField('date_of_birth', toISODateOnly(iosPickerDate));
    setShowDatePicker(false);
  };

  const clearDob = () => {
    setField('date_of_birth', '');
  };

  const handleCalculateSuggestion = () => {
    const missing: string[] = [];
    if (!form.gender) missing.push(t('profile.calcFields.gender'));
    if (!form.height_cm) missing.push(t('profile.calcFields.height'));
    if (!form.weight_kg) missing.push(t('profile.calcFields.weight'));
    if (!form.date_of_birth) missing.push(t('profile.calcFields.dob'));
    if (!form.activity_level) missing.push(t('profile.calcFields.activity'));
    if (!form.goal) missing.push(t('profile.calcFields.goal'));

    if (missing.length > 0) {
      Alert.alert(t('profile.errors.incompleteTitle'), t('profile.errors.incompleteMessage', { fields: missing.join(', ') }));
      return;
    }

    try {
      const age = calculateAge(form.date_of_birth);
      if (age < 0) {
        Alert.alert(t('profile.errors.invalidDobTitle'), t('profile.errors.invalidDobMessage'));
        return;
      }

      if (age < 13 || age > 100) {
        Alert.alert(t('profile.errors.ageWarningTitle'), t('profile.errors.ageWarningMessage', { age }));
      }

      const bmr = calculateBMR({
        sex: form.gender as Sex,
        weight_kg: Number(form.weight_kg),
        height_cm: Number(form.height_cm),
        age,
      });

      const tdee = calculateTDEE(bmr, form.activity_level as ActivityLevel);
      const target = calculateCalorieTarget(tdee, form.goal as Goal);
      const macros = calculateMacroGrams(target, form.goal as Goal);

      setForm((prev) => ({
        ...prev,
        daily_calorie_target: String(target),
        daily_protein_g: String(macros.protein_g),
        daily_carbs_g: String(macros.carbs_g),
        daily_fat_g: String(macros.fat_g),
      }));

      Alert.alert(
        t('profile.calcResultTitle'),
        t('profile.calcResult', { bmr: Math.round(bmr), tdee: Math.round(tdee), target, protein: macros.protein_g, carbs: macros.carbs_g, fat: macros.fat_g }),
      );
    } catch (error: any) {
      Alert.alert(t('profile.errors.calcErrorTitle'), error?.message ?? t('profile.errors.calcErrorDefault'));
    }
  };

  async function handleSave() {
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: form.display_name || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        activity_level: form.activity_level || null,
        goal: form.goal || null,
        daily_calorie_target: form.daily_calorie_target ? Number(form.daily_calorie_target) : null,
        daily_protein_g: form.daily_protein_g ? Number(form.daily_protein_g) : null,
        daily_carbs_g: form.daily_carbs_g ? Number(form.daily_carbs_g) : null,
        daily_fat_g: form.daily_fat_g ? Number(form.daily_fat_g) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);

    setSaving(false);

    if (error) {
      Alert.alert(t('profile.errors.saveErrorTitle'), error.message);
      return;
    }

    await refetchProfile();
    Alert.alert(t('profile.errors.saveSuccess'), t('profile.errors.saveSuccessMessage'));
  }

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile.errors.photoPermissionTitle'), t('profile.errors.photoPermissionMessage'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const path = `${session.user.id}/avatar.${ext}`;

    setUploadingPhoto(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = base64ToArrayBuffer(base64);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType: mimeType, upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', session.user.id);
      if (updateError) throw updateError;

      setAvatarSrc(publicUrl);
      await refetchProfile();
    } catch (err: any) {
      const msg: string = err?.message ?? t('profile.errors.photoErrorDefault');
      if (msg.includes('2097152') || msg.includes('size')) {
        Alert.alert(t('profile.errors.photoTooLargeTitle'), t('profile.errors.photoTooLargeMessage'));
      } else {
        Alert.alert(t('profile.errors.photoErrorTitle'), msg);
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto() {
    if (!profile?.avatar_url) return;
    Alert.alert(t('profile.removePhotoTitle'), t('profile.removePhotoMessage'), [
      { text: t('profile.datePickerCancel'), style: 'cancel' },
      {
        text: t('profile.removePhoto'),
        style: 'destructive',
        onPress: async () => {
          setUploadingPhoto(true);
          try {
            const storagePath = getStoragePath(profile.avatar_url!);
            if (storagePath) {
              await supabase.storage.from('avatars').remove([storagePath]);
            }
            const { error } = await supabase
              .from('profiles')
              .update({ avatar_url: null, updated_at: new Date().toISOString() })
              .eq('id', session.user.id);
            if (error) throw error;

            setAvatarSrc(
              (session.user.user_metadata?.avatar_url as string | undefined) ??
              (session.user.user_metadata?.picture as string | undefined) ??
              undefined,
            );
            await refetchProfile();
          } catch (err: any) {
            Alert.alert(t('profile.errors.photoErrorTitle'), err?.message ?? t('profile.errors.removePhotoError'));
          } finally {
            setUploadingPhoto(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={ps.root}>
      <View style={ps.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={ps.backBtn}>
          <Feather name="arrow-left" size={22} color={T.textPrimary} />
        </TouchableOpacity>
        <Text style={ps.headerTitle}>{t('profile.title')}</Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={ps.scroll}
          contentContainerStyle={ps.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={ps.card}>
            <Text style={ps.sectionLabel}>{t('profile.photoSection')}</Text>
            <View style={ps.photoRow}>
              <View style={ps.avatarWrap}>
                {uploadingPhoto ? (
                  <ActivityIndicator color={T.accent} size="small" />
                ) : (
                  <Avatar src={avatarSrc} name={displayName ?? 'User'} size="lg" />
                )}
              </View>
              <View style={ps.photoActions}>
                <TouchableOpacity
                  style={ps.btnOutline}
                  onPress={handlePickPhoto}
                  disabled={uploadingPhoto}
                  activeOpacity={0.75}
                >
                  <Feather name="camera" size={14} color={T.accent} />
                  <Text style={ps.btnOutlineText}>{t('profile.changePhoto')}</Text>
                </TouchableOpacity>
                {profile?.avatar_url != null && (
                  <TouchableOpacity
                    style={ps.btnDanger}
                    onPress={handleRemovePhoto}
                    disabled={uploadingPhoto}
                    activeOpacity={0.75}
                  >
                    <Feather name="trash-2" size={14} color={T.danger} />
                    <Text style={ps.btnDangerText}>{t('profile.removePhoto')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <View style={ps.card}>
            <Text style={ps.sectionLabel}>{t('profile.identitySection')}</Text>

            <Text style={ps.fieldLabel}>{t('profile.nameLabel')}</Text>
            <TextInput
              style={ps.input}
              value={form.display_name}
              onChangeText={(v) => setField('display_name', v)}
              placeholder={t('profile.namePlaceholder')}
              placeholderTextColor={T.textFaint}
              accessibilityLabel={t('profile.nameLabel')}
            />

            <View style={ps.divider} />

            <Text style={ps.fieldLabel}>{t('profile.dobLabel')}</Text>
            <Pressable
              style={ps.inputPressable}
              onPress={openDatePicker}
              accessibilityRole="button"
              accessibilityLabel={t('profile.dobLabel')}
            >
              <Text style={[ps.inputPressableText, !form.date_of_birth && ps.inputPlaceholder]}>
                {formatLocaleDate(form.date_of_birth, locale, t('profile.dobPlaceholder'))}
              </Text>
              <Feather name="calendar" size={16} color={T.textTertiary} />
            </Pressable>
            <TouchableOpacity
              style={ps.btnGhostSmall}
              onPress={clearDob}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t('profile.clearDob')}
            >
              <Text style={ps.btnGhostSmallText}>{t('profile.clearDob')}</Text>
            </TouchableOpacity>
          </View>

          <View style={ps.card}>
            <Text style={ps.sectionLabel}>{t('profile.physicalSection')}</Text>

            <Text style={ps.fieldLabel}>{t('profile.genderLabel')}</Text>
            <OptionList
              value={form.gender}
              onChange={(v) => setField('gender', v)}
              options={[
                { value: 'male', label: t('profile.genderMale') },
                { value: 'female', label: t('profile.genderFemale') },
                { value: 'other', label: t('profile.genderOther') },
                { value: 'prefer_not', label: t('profile.genderPreferNot') },
              ]}
            />

            <View style={ps.divider} />

            <View style={ps.twoCol}>
              <View style={ps.colItem}>
                <Text style={ps.fieldLabel}>{t('profile.heightLabel')}</Text>
                <TextInput
                  style={ps.input}
                  value={form.height_cm}
                  onChangeText={(v) => setField('height_cm', v)}
                  placeholder={t('profile.heightPlaceholder')}
                  placeholderTextColor={T.textFaint}
                  keyboardType="numeric"
                  accessibilityLabel={t('profile.heightLabel')}
                />
              </View>
              <View style={ps.colItem}>
                <Text style={ps.fieldLabel}>{t('profile.weightLabel')}</Text>
                <TextInput
                  style={ps.input}
                  value={form.weight_kg}
                  onChangeText={(v) => setField('weight_kg', v)}
                  placeholder={t('profile.weightPlaceholder')}
                  placeholderTextColor={T.textFaint}
                  keyboardType="numeric"
                  accessibilityLabel={t('profile.weightLabel')}
                />
              </View>
            </View>

            <View style={ps.divider} />

            <Text style={ps.fieldLabel}>{t('profile.activityLabel')}</Text>
            <OptionList
              value={form.activity_level}
              onChange={(v) => setField('activity_level', v)}
              options={[
                { value: 'sedentary', label: t('profile.activitySedentary'), description: t('profile.activitySedentaryDesc') },
                { value: 'light', label: t('profile.activityLight'), description: t('profile.activityLightDesc') },
                { value: 'moderate', label: t('profile.activityModerate'), description: t('profile.activityModerateDesc') },
                { value: 'active', label: t('profile.activityActive'), description: t('profile.activityActiveDesc') },
                { value: 'very_active', label: t('profile.activityVeryActive'), description: t('profile.activityVeryActiveDesc') },
              ]}
            />

            <View style={ps.divider} />

            <Text style={ps.fieldLabel}>{t('profile.goalLabel')}</Text>
            <SegmentedField
              value={form.goal}
              onChange={(v) => setField('goal', v)}
              options={[
                { value: 'lose', label: t('profile.goalLose') },
                { value: 'maintain', label: t('profile.goalMaintain') },
                { value: 'gain', label: t('profile.goalGain') },
              ]}
            />
          </View>

          <View style={ps.card}>
            <Text style={ps.sectionLabel}>{t('profile.caloriesSection')}</Text>

            <TouchableOpacity
              style={ps.btnGhost}
              onPress={handleCalculateSuggestion}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t('profile.calcSuggestion')}
            >
              <Feather name="zap" size={14} color={T.accent} />
              <Text style={ps.btnGhostText}>{t('profile.calcSuggestion')}</Text>
            </TouchableOpacity>
            <Text style={ps.microcopy}>{t('profile.calcNote')}</Text>

            <Text style={ps.fieldLabel}>{t('profile.caloriesLabel')}</Text>
            <TextInput
              style={ps.input}
              value={form.daily_calorie_target}
              onChangeText={(v) => setField('daily_calorie_target', v)}
              placeholder={t('profile.caloriesPlaceholder')}
              placeholderTextColor={T.textFaint}
              keyboardType="numeric"
              accessibilityLabel={t('profile.caloriesLabel')}
            />

            <View style={ps.divider} />

            <View style={ps.threeCol}>
              <View style={ps.colItem}>
                <Text style={ps.fieldLabel}>{t('profile.proteinLabel')}</Text>
                <TextInput
                  style={ps.input}
                  value={form.daily_protein_g}
                  onChangeText={(v) => setField('daily_protein_g', v)}
                  placeholder={t('profile.proteinPlaceholder')}
                  placeholderTextColor={T.textFaint}
                  keyboardType="numeric"
                  accessibilityLabel={t('profile.proteinLabel')}
                />
              </View>
              <View style={ps.colItem}>
                <Text style={ps.fieldLabel}>{t('profile.carbsLabel')}</Text>
                <TextInput
                  style={ps.input}
                  value={form.daily_carbs_g}
                  onChangeText={(v) => setField('daily_carbs_g', v)}
                  placeholder={t('profile.carbsPlaceholder')}
                  placeholderTextColor={T.textFaint}
                  keyboardType="numeric"
                  accessibilityLabel={t('profile.carbsLabel')}
                />
              </View>
              <View style={ps.colItem}>
                <Text style={ps.fieldLabel}>{t('profile.fatLabel')}</Text>
                <TextInput
                  style={ps.input}
                  value={form.daily_fat_g}
                  onChangeText={(v) => setField('daily_fat_g', v)}
                  placeholder={t('profile.fatPlaceholder')}
                  placeholderTextColor={T.textFaint}
                  keyboardType="numeric"
                  accessibilityLabel={t('profile.fatLabel')}
                />
              </View>
            </View>
          </View>

          <View style={ps.card}>
            <Text style={ps.sectionLabel}>{t('profile.appearanceSection')}</Text>
            <SegmentedField
              value={themePreference}
              onChange={(v) => setThemePreference(v as ThemePreference)}
              options={[
                { value: 'system', label: t('profile.themeSystem') },
                { value: 'light', label: t('profile.themeLight') },
                { value: 'dark', label: t('profile.themeDark') },
              ]}
            />
          </View>

          <View style={ps.card}>
            <Text style={ps.sectionLabel}>{t('common.language')}</Text>
            <SegmentedField
              value={languagePreference}
              onChange={async (v) => {
                const next = v as LanguagePreference;
                setLanguagePreferenceState(next);
                await setLanguagePreference(next);
              }}
              options={[
                { value: 'auto', label: t('common.auto') },
                { value: 'pt', label: t('common.portuguese') },
                { value: 'en', label: t('common.english') },
              ]}
            />
          </View>

          <PressableButton
            style={[ps.btnSave, saving && ps.btnSaveDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color={T.onAccent} size="small" /> : <Text style={ps.btnSaveText}>{t('profile.saveBtn')}</Text>}
          </PressableButton>
        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedDobDate}
          mode="date"
          display="calendar"
          maximumDate={today}
          minimumDate={MIN_DOB}
          onChange={handleDateChange}
        />
      )}

      <Modal visible={showDatePicker && Platform.OS === 'ios'} transparent animationType="slide">
        <View style={ps.modalBackdrop}>
          <View style={ps.modalCard}>
            <View style={ps.modalHeader}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} accessibilityLabel={t('profile.datePickerCancel')}>
                <Text style={ps.modalHeaderBtn}>{t('profile.datePickerCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmIOSDate} accessibilityLabel={t('profile.datePickerConfirm')}>
                <Text style={ps.modalHeaderBtn}>{t('profile.datePickerConfirm')}</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={iosPickerDate}
              mode="date"
              display="spinner"
              maximumDate={today}
              minimumDate={MIN_DOB}
              onChange={handleDateChange}
              locale={locale}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(T: TokenSet) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: T.bgBase,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: T.sp5,
      paddingVertical: T.sp3,
      borderBottomWidth: 1,
      borderBottomColor: T.borderFaint,
    },
    backBtn: {
      padding: T.sp1,
    },
    headerTitle: {
      fontFamily: T.fontBodySemiBold,
      fontSize: T.textMd,
      color: T.textPrimary,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: T.sp5,
      gap: T.sp4,
      paddingBottom: 48,
    },
    card: {
      backgroundColor: T.surface1,
      borderRadius: T.rLg,
      borderWidth: 1,
      borderColor: T.borderSoft,
      padding: T.sp4,
      gap: T.sp3,
    },
    sectionLabel: {
      fontFamily: T.fontMono,
      fontSize: T.textXs,
      letterSpacing: 2,
      color: T.textTertiary,
    },
    fieldLabel: {
      fontFamily: T.fontBodyMedium,
      fontSize: T.textSm,
      color: T.textSecondary,
    },
    input: {
      backgroundColor: T.surface2,
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rMd,
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp2,
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textPrimary,
    },
    inputPressable: {
      backgroundColor: T.surface2,
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rMd,
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    inputPressableText: {
      fontFamily: T.fontBody,
      fontSize: T.textBase,
      color: T.textPrimary,
    },
    inputPlaceholder: {
      color: T.textFaint,
    },
    divider: {
      height: 1,
      backgroundColor: T.borderFaint,
    },
    twoCol: {
      flexDirection: 'row',
      gap: T.sp3,
    },
    threeCol: {
      flexDirection: 'row',
      gap: T.sp2,
    },
    colItem: {
      flex: 1,
      gap: T.sp2,
    },
    photoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: T.sp4,
    },
    avatarWrap: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoActions: {
      flex: 1,
      gap: T.sp2,
    },
    btnOutline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: T.sp2,
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp2,
      borderWidth: 1,
      borderColor: T.accentLine,
      borderRadius: T.rMd,
      backgroundColor: T.accentBg,
      alignSelf: 'flex-start',
    },
    btnOutlineText: {
      fontFamily: T.fontBodyMedium,
      fontSize: T.textSm,
      color: T.accent,
    },
    btnDanger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: T.sp2,
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp2,
      borderWidth: 1,
      borderColor: 'rgba(232, 131, 111, 0.25)',
      borderRadius: T.rMd,
      backgroundColor: 'rgba(232, 131, 111, 0.08)',
      alignSelf: 'flex-start',
    },
    btnDangerText: {
      fontFamily: T.fontBodyMedium,
      fontSize: T.textSm,
      color: T.danger,
    },
    btnGhost: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: T.sp2,
      paddingHorizontal: T.sp3,
      paddingVertical: T.sp2,
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderRadius: T.rMd,
      backgroundColor: T.surface2,
      alignSelf: 'flex-start',
    },
    btnGhostText: {
      fontFamily: T.fontBodyMedium,
      fontSize: T.textSm,
      color: T.accent,
    },
    btnGhostSmall: {
      alignSelf: 'flex-start',
      paddingVertical: T.sp1,
    },
    btnGhostSmallText: {
      fontFamily: T.fontBodyMedium,
      fontSize: T.textSm,
      color: T.textTertiary,
    },
    microcopy: {
      fontFamily: T.fontBody,
      fontSize: T.textXs,
      color: T.textTertiary,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    modalCard: {
      backgroundColor: T.surface1,
      borderTopLeftRadius: T.rLg,
      borderTopRightRadius: T.rLg,
      borderWidth: 1,
      borderColor: T.borderSoft,
      borderBottomWidth: 0,
      paddingBottom: T.sp4,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: T.sp4,
      paddingVertical: T.sp3,
      borderBottomWidth: 1,
      borderBottomColor: T.borderFaint,
    },
    modalHeaderBtn: {
      fontFamily: T.fontBodyMedium,
      fontSize: T.textBase,
      color: T.accent,
    },
    btnSave: {
      backgroundColor: T.accent,
      borderRadius: T.rMd,
      paddingVertical: T.sp3,
      alignItems: 'center',
    },
    btnSaveDisabled: {
      opacity: 0.6,
    },
    btnSaveText: {
      fontFamily: T.fontBodySemiBold,
      fontSize: T.textBase,
      color: T.onAccent,
      letterSpacing: 1.5,
    },
  });
}
