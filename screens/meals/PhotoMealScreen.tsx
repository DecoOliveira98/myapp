import { useMemo, useState } from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';

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

export default function PhotoMealScreen({ session, mealType, date, onCancel, onSaved }: Props) {
    const { T } = useTheme();
    const styles = useMemo(() => makeStyles(T), [T]);
    const [photo, setPhoto] = useState<{ base64: string; mediaType: string; uri: string } | null>(null);
    const [hint, setHint] = useState('');
    const [pickingImage, setPickingImage] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [items, setItems] = useState<ParsedItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function pickImage(source: 'camera' | 'gallery') {
        setError(null);
        setPickingImage(true);
        try {
            const perm = source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                setError(source === 'camera' ? 'Permissão de câmera negada' : 'Permissão de galeria negada');
                return;
            }
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync({ quality: 0.9, exif: false, mediaTypes: ['images'] })
                : await ImagePicker.launchImageLibraryAsync({
                    quality: 0.9,
                    exif: false,
                    mediaTypes: ['images'],
                });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];
            const compressed = await ImageManipulator.manipulateAsync(
                asset.uri,
                [
                    {
                        resize: {
                            width: asset.width > asset.height ? 1024 : undefined,
                            height: asset.height > asset.width ? 1024 : undefined,
                        },
                    },
                ],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );
            if (!compressed.base64) {
                setError('Erro ao processar imagem');
                return;
            }
            setPhoto({ base64: compressed.base64, mediaType: 'image/jpeg', uri: compressed.uri });
        } catch (e: any) {
            setError(e?.message ?? 'Erro ao escolher foto');
        } finally {
            setPickingImage(false);
        }
    }

    async function handleParse() {
        if (!photo) return;
        setError(null);
        setParsing(true);

        const { data, error: invokeErr } = await supabase.functions.invoke('analyze-meal-photo', {
            body: {
                image_base64: photo.base64,
                media_type: photo.mediaType,
                hint: hint.trim() || undefined,
            },
        });

        if (invokeErr) {
            setError('Erro de conexão. Tente de novo.');
            setParsing(false);
            return;
        }
        if ((data as any).error) {
            setError('A IA não conseguiu analisar a foto.');
            setParsing(false);
            return;
        }
        const parsed = (data as any).items as ParsedItem[];
        if (!parsed || parsed.length === 0) {
            setError('Nenhum alimento identificado. Tente outra foto ou adicione manual.');
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

            const rows = items.map(it => ({
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

    // ── Modo preview ────────────────────────────────────────────────────────
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
                                <Text style={styles.lowConfidence}>⚠ Estimativa imprecisa — tire outra foto ou ajuste depois</Text>
                            )}
                        </View>
                    ))}

                    {error !== null && <Text style={styles.errorText}>{error}</Text>}

                    <TouchableOpacity
                        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Salvar todos'}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    // ── Modo foto-tirada ────────────────────────────────────────────────────
    if (photo !== null) {
        return (
            <View style={styles.screen}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            setPhoto(null);
                            setHint('');
                            setError(null);
                        }}
                        hitSlop={8}
                    >
                        <Text style={styles.cancelText}>← Voltar</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Confirmar foto</Text>
                </View>

                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                    <Image
                        source={{ uri: photo.uri }}
                        style={{ width: '100%', aspectRatio: 1, borderRadius: 12, marginBottom: 12 }}
                        resizeMode="cover"
                    />

                    <Text style={styles.label}>Dica (opcional)</Text>
                    <TextInput
                        style={styles.input}
                        value={hint}
                        onChangeText={setHint}
                        placeholder="Ex: prato de almoço com arroz e feijão"
                        placeholderTextColor={T.textTertiary}
                    />

                    {error !== null && <Text style={styles.errorText}>{error}</Text>}

                    <TouchableOpacity
                        style={[styles.saveBtn, parsing && styles.saveBtnDisabled]}
                        onPress={handleParse}
                        disabled={parsing}
                    >
                        <Text style={styles.saveBtnText}>{parsing ? 'Estruturando...' : 'Estruturar com IA'}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    // ── Modo escolher foto ──────────────────────────────────────────────────
    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onCancel} hitSlop={8}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Foto da refeição</Text>
            </View>

            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                <Text style={styles.subtitle}>
                    Tire uma foto ou escolha da galeria. A IA vai estimar os alimentos.
                </Text>

                <View style={styles.pickRow}>
                    <TouchableOpacity
                        style={[styles.pickBtn, pickingImage && styles.saveBtnDisabled]}
                        onPress={() => pickImage('camera')}
                        disabled={pickingImage}
                    >
                        <Text style={styles.pickBtnText}>📷 Tirar foto</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.pickBtn, pickingImage && styles.saveBtnDisabled]}
                        onPress={() => pickImage('gallery')}
                        disabled={pickingImage}
                    >
                        <Text style={styles.pickBtnText}>🖼 Galeria</Text>
                    </TouchableOpacity>
                </View>

                {error !== null && <Text style={styles.errorText}>{error}</Text>}
            </ScrollView>
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
    },
    subtitle: {
        fontSize: T.textSm,
        color: T.textSecondary,
        marginBottom: T.sp5,
        lineHeight: 20,
        fontFamily: T.fontBody,
    },
    label: {
        fontSize: T.textXs,
        color: T.textTertiary,
        marginBottom: T.sp2,
        fontFamily: T.fontMono,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
    },
    input: {
        borderWidth: 1,
        borderColor: T.borderSoft,
        paddingHorizontal: T.sp4,
        paddingVertical: T.sp3,
        backgroundColor: T.surface1,
        fontSize: T.textBase,
        color: T.textPrimary,
        fontFamily: T.fontBody,
    },
    pickRow: {
        flexDirection: 'row',
        gap: T.sp3,
    },
    pickBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: T.borderSoft,
        paddingVertical: T.sp7,
        alignItems: 'center',
        backgroundColor: T.surface1,
    },
    pickBtnText: {
        fontSize: T.textSm,
        color: T.textPrimary,
        fontFamily: T.fontMonoMedium,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    errorText: {
        color: T.danger,
        fontSize: T.textXs,
        marginTop: T.sp3,
        textAlign: 'center',
        fontFamily: T.fontBody,
    },
    saveBtn: {
        marginTop: T.sp5,
        backgroundColor: T.accent,
        borderWidth: 1,
        borderColor: T.accent,
        paddingVertical: 14,
        alignItems: 'center',
    },
    saveBtnDisabled: {
        backgroundColor: T.surface3,
        borderColor: T.surface3,
    },
    saveBtnText: {
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
}
