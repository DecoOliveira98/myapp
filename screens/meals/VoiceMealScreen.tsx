import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../lib/supabase';
import { T } from '../../theme/tokens';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type Props = {
  session: Session;
  mealType: MealType;
  date: string;
  onCancel: () => void;
  onSaved: () => void;
};

type ParsedItem = {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: 'high' | 'medium' | 'low';
};

function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

export default function VoiceMealScreen({ session, mealType, date, onCancel, onSaved }: Props) {
  const [recordingObj, setRecordingObj] = useState<Audio.Recording | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ParsedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startRecording() {
    setError(null);
    setText('');
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setError('Permissão de microfone negada');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecordingObj(recording);
      setRecording(true);
    } catch {
      setError('Não foi possível iniciar a gravação');
    }
  }

  async function stopRecording() {
    if (!recordingObj) return;
    setRecording(false);
    try {
      await recordingObj.stopAndUnloadAsync();
      const uri = recordingObj.getURI();
      setRecordingObj(null);
      if (!uri) {
        setError('Áudio não foi salvo');
        return;
      }
      await transcribe(uri);
    } catch {
      setError('Erro ao finalizar gravação');
    }
  }

  async function transcribe(uri: string) {
    setTranscribing(true);
    setError(null);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const { data, error: invokeErr } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio_base64: base64, mime_type: 'audio/m4a', language: 'pt' },
      });
      if (invokeErr) {
        setError('Erro de conexão na transcrição');
        return;
      }
      if ((data as any).error) {
        setError('A transcrição falhou. Tente de novo.');
        return;
      }
      const transcribed = (data as any).text as string;
      if (!transcribed?.trim()) {
        setError('Não consegui entender o áudio. Fale mais alto e claro.');
        return;
      }
      setText(transcribed.trim());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao transcrever');
    } finally {
      setTranscribing(false);
    }
  }

  async function handleStructure() {
    setError(null);
    setParsing(true);

    const { data, error: invokeErr } = await supabase.functions.invoke('structure-meal', {
      body: { text: text.trim() },
    });

    if (invokeErr) {
      setError('Erro de conexão. Tente de novo.');
      setParsing(false);
      return;
    }
    if ((data as any).error) {
      setError('A IA não conseguiu estruturar. Tente reescrever.');
      setParsing(false);
      return;
    }
    const parsed = (data as any).items as ParsedItem[];
    if (!parsed || parsed.length === 0) {
      setError('Nenhum alimento identificado. Reescreva a descrição.');
      setParsing(false);
      return;
    }

    setItems(parsed);
    setParsing(false);
  }

  async function handleSave() {
    if (!items) return;
    setError(null);
    setSaving(true);

    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('meals')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('date', date)
        .eq('meal_type', mealType)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      let mealId: string;
      if (existing) {
        mealId = existing.id;
      } else {
        const { data: newMeal, error: insErr } = await supabase
          .from('meals')
          .insert({ user_id: session.user.id, date, meal_type: mealType })
          .select('id')
          .single();
        if (insErr) throw insErr;
        mealId = newMeal.id;
      }

      const rows = items.map((it) => ({
        meal_id: mealId,
        name: it.name,
        quantity_g: round1(it.quantity_g),
        calories: round1(it.calories),
        protein_g: round1(it.protein_g),
        carbs_g: round1(it.carbs_g),
        fat_g: round1(it.fat_g),
      }));

      const { error: bulkErr } = await supabase.from('meal_foods').insert(rows);
      if (bulkErr) throw bulkErr;

      onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar.');
      setSaving(false);
    }
  }

  // ── Modo preview ──────────────────────────────────────────────────────────
  if (items !== null) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setItems(null)} hitSlop={8}>
            <Text style={styles.cancelText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Confira antes de salvar</Text>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>
            Vou adicionar {items.length} {items.length === 1 ? 'item' : 'itens'}. Você pode ajustar valores depois tocando em cada item da lista.
          </Text>

          {items.map((item, i) => (
            <View key={i} style={styles.itemCard}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>{item.quantity_g}g · {item.calories} kcal</Text>
              <Text style={styles.itemMacros}>{item.protein_g}p · {item.carbs_g}c · {item.fat_g}g</Text>
              {item.confidence === 'low' && (
                <Text style={styles.lowConfidence}>⚠ Estimativa imprecisa — descreva com mais detalhe se preferir</Text>
              )}
            </View>
          ))}

          {error !== null && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.actionBtn, saving && styles.actionBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.actionBtnText}>{saving ? 'Salvando...' : 'Salvar todos'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Modo gravação ─────────────────────────────────────────────────────────
  const micDisabled = transcribing;
  const canStructure = text.trim().length > 0 && !parsing && !transcribing;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Falar refeição</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          Aperte e fale o que comeu. Solte quando terminar.
        </Text>

        <View style={styles.micContainer}>
          <TouchableOpacity
            style={[
              styles.micButton,
              recording && styles.micButtonActive,
              micDisabled && styles.micButtonDisabled,
            ]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
            disabled={micDisabled}
            activeOpacity={0.8}
          >
            {transcribing ? (
              <ActivityIndicator color={T.bgBase} size="small" />
            ) : (
              <Text style={styles.micIcon}>{recording ? '⏹' : '🎤'}</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.micLabel}>
            {transcribing ? 'Transcrevendo...' : recording ? 'Soltar' : 'Pressionar'}
          </Text>
        </View>

        {text !== '' && (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptLabel}>Texto transcrito</Text>
            <Text style={styles.transcriptHint}>Você pode editar antes de estruturar.</Text>
            <TextInput
              style={styles.textArea}
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              placeholderTextColor={T.textTertiary}
            />
          </View>
        )}

        {error !== null && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.actionBtn, !canStructure && styles.actionBtnDisabled]}
          onPress={handleStructure}
          disabled={!canStructure}
        >
          <Text style={styles.actionBtnText}>{parsing ? 'Estruturando...' : 'Estruturar com IA'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  cancelText: {
    fontSize: T.textSm,
    color: T.textSecondary,
    fontFamily: T.fontMono,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: T.textMd,
    color: T.textPrimary,
    fontFamily: T.fontDisplay,
    letterSpacing: -0.2,
  },
  body: {
    padding: T.sp5,
    paddingBottom: T.sp8,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: T.textSm,
    color: T.textSecondary,
    marginBottom: T.sp6,
    lineHeight: 20,
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: T.fontBody,
  },
  micContainer: {
    alignItems: 'center',
    marginBottom: T.sp6,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: T.accent,
    borderWidth: 1,
    borderColor: T.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: T.sp3,
  },
  micButtonActive: {
    backgroundColor: T.danger,
    borderColor: T.danger,
  },
  micButtonDisabled: {
    backgroundColor: T.surface3,
    borderColor: T.surface3,
  },
  micIcon: {
    fontSize: 36,
  },
  micLabel: {
    fontSize: T.textSm,
    color: T.textSecondary,
    fontFamily: T.fontMono,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  transcriptBox: {
    alignSelf: 'stretch',
    marginBottom: T.sp2,
  },
  transcriptLabel: {
    fontSize: T.textXs,
    color: T.textPrimary,
    marginBottom: 2,
    fontFamily: T.fontMonoMedium,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  transcriptHint: {
    fontSize: T.textXs,
    color: T.textTertiary,
    marginBottom: T.sp3,
    fontFamily: T.fontBody,
  },
  textArea: {
    borderWidth: 1,
    borderColor: T.borderSoft,
    padding: T.sp4,
    backgroundColor: T.surface1,
    fontSize: T.textBase,
    color: T.textPrimary,
    minHeight: 100,
    alignSelf: 'stretch',
    fontFamily: T.fontBody,
  },
  errorText: {
    color: T.danger,
    fontSize: T.textXs,
    marginTop: T.sp3,
    textAlign: 'center',
    alignSelf: 'stretch',
    fontFamily: T.fontBody,
  },
  actionBtn: {
    marginTop: T.sp5,
    backgroundColor: T.accent,
    borderWidth: 1,
    borderColor: T.accent,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  actionBtnDisabled: {
    backgroundColor: T.surface3,
    borderColor: T.surface3,
  },
  actionBtnText: {
    fontSize: T.textXs,
    color: T.bgBase,
    fontFamily: T.fontMonoMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: T.borderSoft,
    padding: T.sp4,
    marginBottom: T.sp3,
    backgroundColor: T.surface1,
    alignSelf: 'stretch',
  },
  itemName: {
    fontSize: T.textBase,
    color: T.textPrimary,
    fontFamily: T.fontBodySemiBold,
  },
  itemMeta: {
    fontSize: T.textSm,
    color: T.textSecondary,
    marginTop: T.sp1,
    fontFamily: T.fontBody,
  },
  itemMacros: {
    fontSize: T.textXs,
    color: T.textTertiary,
    marginTop: 2,
    fontFamily: T.fontMono,
    letterSpacing: 1,
  },
  lowConfidence: {
    fontSize: T.textXs,
    color: T.accentSoft,
    marginTop: T.sp2,
    fontFamily: T.fontBody,
  },
});
