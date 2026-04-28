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
              <ActivityIndicator color="#fff" size="small" />
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
              placeholderTextColor="#aaa"
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
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelText: {
    fontSize: 15,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  body: {
    padding: 20,
    paddingBottom: 48,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
    lineHeight: 20,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  micContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  micButtonActive: {
    backgroundColor: '#c0392b',
  },
  micButtonDisabled: {
    backgroundColor: '#ccc',
  },
  micIcon: {
    fontSize: 36,
  },
  micLabel: {
    fontSize: 14,
    color: '#666',
  },
  transcriptBox: {
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  transcriptLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  transcriptHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fafafa',
    fontSize: 15,
    color: '#111',
    minHeight: 100,
    alignSelf: 'stretch',
  },
  errorText: {
    color: '#c0392b',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  actionBtn: {
    marginTop: 20,
    backgroundColor: '#222',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  actionBtnDisabled: {
    backgroundColor: '#ccc',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    alignSelf: 'stretch',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  itemMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  itemMacros: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  lowConfidence: {
    fontSize: 12,
    color: '#b07d2c',
    marginTop: 6,
  },
});
