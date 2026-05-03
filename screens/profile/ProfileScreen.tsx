import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../lib/supabase';
import { T } from '../../theme/tokens';
import { type Profile } from '../../hooks/useProfile';
import Avatar from '../../components/avatar/Avatar';

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

// Converts base64 to ArrayBuffer without external dependencies (atob is globally available in RN)
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

// ── Segmented control ─────────────────────────────────────────────────────────

function SegmentedField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
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
          <Text style={[seg.btnText, value === opt.value && seg.btnTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const seg = StyleSheet.create({
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

// ── Option list (used for activity_level) ─────────────────────────────────────

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
              {opt.description != null && (
                <Text style={ol.desc}>{opt.description}</Text>
              )}
            </View>
            {value === opt.value && <Feather name="check" size={15} color={T.accent} />}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const ol = StyleSheet.create({
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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen({ session, profile, onClose, refetchProfile }: Props) {
  const [form, setForm] = useState<FormState>(profileToForm(profile));
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | undefined>(
    profile?.avatar_url ??
    (session.user.user_metadata?.avatar_url as string | undefined) ??
    (session.user.user_metadata?.picture as string | undefined) ??
    undefined,
  );

  useEffect(() => {
    setForm(profileToForm(profile));
    setAvatarSrc(
      profile?.avatar_url ??
      (session.user.user_metadata?.avatar_url as string | undefined) ??
      (session.user.user_metadata?.picture as string | undefined) ??
      undefined,
    );
  }, [profile]);

  function setField(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const displayName =
    form.display_name ||
    (session.user.user_metadata?.name as string | undefined) ||
    (session.user.user_metadata?.full_name as string | undefined) ||
    session.user.email ||
    'User';

  // ── Save ──────────────────────────────────────────────────────────────────

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
      Alert.alert('Erro', error.message);
    } else {
      await refetchProfile();
      Alert.alert('Salvo', 'Perfil atualizado com sucesso.');
    }
  }

  // ── Photo upload ──────────────────────────────────────────────────────────

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'Precisamos de acesso à galeria para trocar a foto.');
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
      const msg: string = err?.message ?? 'Falha ao enviar foto.';
      if (msg.includes('2097152') || msg.includes('size')) {
        Alert.alert('Foto muito grande', 'O limite é 2 MB. Escolha uma foto menor.');
      } else {
        Alert.alert('Erro', msg);
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto() {
    if (!profile?.avatar_url) return;
    Alert.alert(
      'Remover foto',
      'Tem certeza que deseja remover a foto de perfil?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
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
              Alert.alert('Erro', err?.message ?? 'Falha ao remover foto.');
            } finally {
              setUploadingPhoto(false);
            }
          },
        },
      ],
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={ps.root}>
      {/* Header */}
      <View style={ps.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={ps.backBtn}>
          <Feather name="arrow-left" size={22} color={T.textPrimary} />
        </TouchableOpacity>
        <Text style={ps.headerTitle}>Perfil</Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={ps.scroll}
          contentContainerStyle={ps.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Foto de perfil ─────────────────────────────────────────── */}
          <View style={ps.card}>
            <Text style={ps.sectionLabel}>FOTO DE PERFIL</Text>
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
                  <Text style={ps.btnOutlineText}>Trocar foto</Text>
                </TouchableOpacity>
                {profile?.avatar_url != null && (
                  <TouchableOpacity
                    style={ps.btnDanger}
                    onPress={handleRemovePhoto}
                    disabled={uploadingPhoto}
                    activeOpacity={0.75}
                  >
                    <Feather name="trash-2" size={14} color={T.danger} />
                    <Text style={ps.btnDangerText}>Remover</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* ── Identidade ─────────────────────────────────────────────── */}
          <View style={ps.card}>
            <Text style={ps.sectionLabel}>IDENTIDADE</Text>

            <Text style={ps.fieldLabel}>Nome</Text>
            <TextInput
              style={ps.input}
              value={form.display_name}
              onChangeText={v => setField('display_name', v)}
              placeholder="Seu nome"
              placeholderTextColor={T.textFaint}
              accessibilityLabel="Nome"
            />

            <View style={ps.divider} />

            <Text style={ps.fieldLabel}>Data de nascimento</Text>
            <TextInput
              style={ps.input}
              value={form.date_of_birth}
              onChangeText={v => setField('date_of_birth', v)}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={T.textFaint}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Data de nascimento"
            />
          </View>

          {/* ── Físico ─────────────────────────────────────────────────── */}
          <View style={ps.card}>
            <Text style={ps.sectionLabel}>FÍSICO</Text>

            <Text style={ps.fieldLabel}>Gênero</Text>
            <OptionList
              value={form.gender}
              onChange={v => setField('gender', v)}
              options={[
                { value: 'male', label: 'Masculino' },
                { value: 'female', label: 'Feminino' },
                { value: 'other', label: 'Outro' },
                { value: 'prefer_not', label: 'Prefiro não informar' },
              ]}
            />

            <View style={ps.divider} />

            <View style={ps.twoCol}>
              <View style={ps.colItem}>
                <Text style={ps.fieldLabel}>Altura (cm)</Text>
                <TextInput
                  style={ps.input}
                  value={form.height_cm}
                  onChangeText={v => setField('height_cm', v)}
                  placeholder="170"
                  placeholderTextColor={T.textFaint}
                  keyboardType="numeric"
                  accessibilityLabel="Altura em centímetros"
                />
              </View>
              <View style={ps.colItem}>
                <Text style={ps.fieldLabel}>Peso (kg)</Text>
                <TextInput
                  style={ps.input}
                  value={form.weight_kg}
                  onChangeText={v => setField('weight_kg', v)}
                  placeholder="70"
                  placeholderTextColor={T.textFaint}
                  keyboardType="numeric"
                  accessibilityLabel="Peso em quilogramas"
                />
              </View>
            </View>

            <View style={ps.divider} />

            <Text style={ps.fieldLabel}>Nível de atividade</Text>
            <OptionList
              value={form.activity_level}
              onChange={v => setField('activity_level', v)}
              options={[
                { value: 'sedentary', label: 'Sedentário', description: 'Pouco ou nenhum exercício' },
                { value: 'light', label: 'Leve', description: '1–3 dias por semana' },
                { value: 'moderate', label: 'Moderado', description: '3–5 dias por semana' },
                { value: 'active', label: 'Ativo', description: '6–7 dias por semana' },
                { value: 'very_active', label: 'Muito ativo', description: '2× por dia ou trabalho físico' },
              ]}
            />

            <View style={ps.divider} />

            <Text style={ps.fieldLabel}>Objetivo</Text>
            <SegmentedField
              value={form.goal}
              onChange={v => setField('goal', v)}
              options={[
                { value: 'lose', label: 'Perder' },
                { value: 'maintain', label: 'Manter' },
                { value: 'gain', label: 'Ganhar' },
              ]}
            />
          </View>

          {/* ── Metas calóricas ────────────────────────────────────────── */}
          <View style={ps.card}>
            <Text style={ps.sectionLabel}>METAS CALÓRICAS</Text>

            <Text style={ps.fieldLabel}>Calorias diárias (kcal)</Text>
            <TextInput
              style={ps.input}
              value={form.daily_calorie_target}
              onChangeText={v => setField('daily_calorie_target', v)}
              placeholder="2000"
              placeholderTextColor={T.textFaint}
              keyboardType="numeric"
              accessibilityLabel="Meta de calorias diárias"
            />

            <View style={ps.divider} />

            <View style={ps.threeCol}>
              <View style={ps.colItem}>
                <Text style={ps.fieldLabel}>Proteína (g)</Text>
                <TextInput
                  style={ps.input}
                  value={form.daily_protein_g}
                  onChangeText={v => setField('daily_protein_g', v)}
                  placeholder="150"
                  placeholderTextColor={T.textFaint}
                  keyboardType="numeric"
                  accessibilityLabel="Meta de proteína em gramas"
                />
              </View>
              <View style={ps.colItem}>
                <Text style={ps.fieldLabel}>Carboidratos (g)</Text>
                <TextInput
                  style={ps.input}
                  value={form.daily_carbs_g}
                  onChangeText={v => setField('daily_carbs_g', v)}
                  placeholder="200"
                  placeholderTextColor={T.textFaint}
                  keyboardType="numeric"
                  accessibilityLabel="Meta de carboidratos em gramas"
                />
              </View>
              <View style={ps.colItem}>
                <Text style={ps.fieldLabel}>Gordura (g)</Text>
                <TextInput
                  style={ps.input}
                  value={form.daily_fat_g}
                  onChangeText={v => setField('daily_fat_g', v)}
                  placeholder="65"
                  placeholderTextColor={T.textFaint}
                  keyboardType="numeric"
                  accessibilityLabel="Meta de gordura em gramas"
                />
              </View>
            </View>
          </View>

          {/* ── Salvar ─────────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[ps.btnSave, saving && ps.btnSaveDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={T.bgBase} size="small" />
            ) : (
              <Text style={ps.btnSaveText}>SALVAR ALTERAÇÕES</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ps = StyleSheet.create({
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
    color: T.bgBase,
    letterSpacing: 1.5,
  },
});
