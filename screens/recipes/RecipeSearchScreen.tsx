import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { type TokenSet } from '../../theme/tokens';
import PressableButton from '../../components/ui/PressableButton';

type Props = { session: Session; onClose: () => void };

type SearchResult = {
    spoonacular_id: number;
    title: string;
    image: string;
    ready_in_minutes: number | null;
    servings: number;
    per_serving: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
    ingredients: Array<{ name: string; amount: number; unit: string; original: string }>;
    instructions: string[];
    source_url: string;
};

function safeNum(n: number | null | undefined): number {
    return Number.isFinite(Number(n)) ? Number(n) : 0;
}

export default function RecipeSearchScreen({ session, onClose }: Props) {
    const { T } = useTheme();
    const { t } = useTranslation();
    const ss = useMemo(() => makeStyles(T), [T]);
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selected, setSelected] = useState<SearchResult | null>(null);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSearch = useMemo(() => query.trim().length > 0 && !searching, [query, searching]);

    async function runSearch() {
        setError(null); setSearching(true); setResults([]);
        try {
            const { data, error: invokeErr } = await supabase.functions.invoke('search-recipes', {
                body: { query: query.trim(), number: 12 }
            });
            if (invokeErr) throw new Error(invokeErr.message);
            if ((data as any).error) throw new Error((data as any).error);
            const r = (data as any).results as SearchResult[];
            if (!r || r.length === 0) { setError(t('recipes.search.noResults')); return; }
            setResults(r);
        } catch (e: any) {
            setError(e?.message ?? t('recipes.search.errorSearch'));
        } finally { setSearching(false); }
    }

    async function addAsRecipe() {
        if (!selected || adding) return;
        setError(null); setAdding(true);
        try {
            const { data: newRecipe, error: insErr } = await supabase.from('recipes')
                .insert({ user_id: session.user.id, name: selected.title, is_favorite: false })
                .select('id').single();
            if (insErr) throw insErr;

            const { error: itemErr } = await supabase.from('recipe_items').insert({
                recipe_id: newRecipe.id,
                name: selected.title,
                quantity_g: 100,
                calories: safeNum(selected.per_serving?.kcal),
                protein_g: safeNum(selected.per_serving?.protein_g),
                carbs_g: safeNum(selected.per_serving?.carbs_g),
                fat_g: safeNum(selected.per_serving?.fat_g),
                position: 0,
            });
            if (itemErr) throw itemErr;

            Alert.alert(t('recipes.search.addedTitle'), t('recipes.search.addedMessage'), [
                { text: 'OK', onPress: onClose }
            ]);
        } catch (e: any) {
            setError(e?.message ?? t('recipes.search.errorSave'));
            setAdding(false);
        }
    }

    if (selected === null) {
        return (
            <View style={ss.root}>
                <View style={ss.header}>
                    <TouchableOpacity onPress={onClose} hitSlop={12} style={ss.backBtn}>
                        <Text style={ss.backText}>{t('recipes.common.back')}</Text>
                    </TouchableOpacity>
                    <Text style={ss.headerTitle}>{t('recipes.search.title')}</Text>
                    <View style={ss.headerRight} />
                </View>

                <View style={ss.searchWrap}>
                    <TextInput
                        style={ss.input}
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Ex: chicken salad, pasta, smoothie..."
                        placeholderTextColor={T.textTertiary}
                        keyboardType="default"
                        returnKeyType="search"
                        onSubmitEditing={runSearch}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    <Text style={ss.subtle}>{t('recipes.search.hint')}</Text>

                    <PressableButton
                        style={[ss.searchBtn, !canSearch && ss.btnDisabled]}
                        onPress={runSearch}
                        disabled={!canSearch}
                    >
                        <Text style={ss.searchBtnText}>{searching ? t('recipes.search.searching') : t('recipes.search.searchBtn')}</Text>
                    </PressableButton>

                    {error ? <Text style={ss.error}>{error}</Text> : null}
                </View>

                {searching && results.length === 0 ? (
                    <View style={ss.centered}>
                        <ActivityIndicator color={T.accent} />
                    </View>
                ) : (
                    <FlatList
                        data={results}
                        keyExtractor={(item) => String(item.spoonacular_id)}
                        contentContainerStyle={ss.listContent}
                        ItemSeparatorComponent={() => <View style={ss.separator} />}
                        renderItem={({ item }) => {
                            const mins = item.ready_in_minutes == null ? '—' : `${item.ready_in_minutes}`;
                            return (
                                <TouchableOpacity
                                    style={ss.resultCard}
                                    onPress={() => setSelected(item)}
                                    activeOpacity={0.75}
                                >
                                    <Image
                                        source={{ uri: item.image }}
                                        style={ss.thumb}
                                        resizeMode="cover"
                                    />
                                    <View style={ss.resultInfo}>
                                        <Text style={ss.resultTitle} numberOfLines={2}>{item.title}</Text>
                                        <Text style={ss.resultMeta}>{t('recipes.search.servings', { mins, count: item.servings })}</Text>
                                        <Text style={ss.resultMacro}>
                                            {Math.round(safeNum(item.per_serving?.kcal))} kcal · {Math.round(safeNum(item.per_serving?.protein_g))}p · {Math.round(safeNum(item.per_serving?.carbs_g))}c · {t('recipes.search.gramsPerServingShort', { grams: Math.round(safeNum(item.per_serving?.fat_g)) })}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}
            </View>
        );
    }

    return (
        <View style={ss.root}>
            <View style={ss.header}>
                <TouchableOpacity onPress={() => setSelected(null)} hitSlop={12} style={ss.backBtn}>
                    <Text style={ss.backText}>{t('recipes.common.back')}</Text>
                </TouchableOpacity>
                <Text style={ss.headerTitle} numberOfLines={1}>{selected.title}</Text>
                <View style={ss.headerRight} />
            </View>

            <ScrollView style={ss.scroll} contentContainerStyle={ss.detailContent}>
                <Image source={{ uri: selected.image }} style={ss.heroImage} resizeMode="cover" />

                <View style={ss.detailHead}>
                    <Text style={ss.detailTitle}>{selected.title}</Text>
                    <Text style={ss.detailMeta}>
                        {t('recipes.search.servings', { mins: selected.ready_in_minutes == null ? '—' : selected.ready_in_minutes, count: selected.servings })}
                    </Text>
                </View>

                <View style={ss.macroStrip}>
                    <View style={ss.macroStat}>
                        <Text style={ss.macroLabel}>kcal</Text>
                        <Text style={ss.macroValue}>{Math.round(safeNum(selected.per_serving?.kcal))}</Text>
                    </View>
                    <View style={ss.macroStat}>
                        <Text style={ss.macroLabel}>P</Text>
                        <Text style={ss.macroValue}>{Math.round(safeNum(selected.per_serving?.protein_g))}</Text>
                    </View>
                    <View style={ss.macroStat}>
                        <Text style={ss.macroLabel}>C</Text>
                        <Text style={ss.macroValue}>{Math.round(safeNum(selected.per_serving?.carbs_g))}</Text>
                    </View>
                    <View style={[ss.macroStat, ss.macroStatLast]}>
                        <Text style={ss.macroLabel}>G</Text>
                        <Text style={ss.macroValue}>{Math.round(safeNum(selected.per_serving?.fat_g))}</Text>
                    </View>
                </View>

                <View style={ss.sectionWrap}>
                    <Text style={ss.sectionTitle}>{t('recipes.search.ingredients')}</Text>
                    {selected.ingredients.map((ingredient, idx) => (
                        <Text key={`${ingredient.name}-${idx}`} style={ss.bulletLine}>
                            • {ingredient.original}
                        </Text>
                    ))}
                </View>

                <View style={ss.sectionWrap}>
                    <Text style={ss.sectionTitle}>{t('recipes.search.instructions')}</Text>
                    {selected.instructions.length === 0 ? (
                        <Text style={ss.bulletLine}>{t('recipes.search.noInstructions')}</Text>
                    ) : (
                        selected.instructions.map((step, i) => (
                            <View key={`${i}-${step.slice(0, 12)}`} style={ss.stepRow}>
                                <Text style={ss.stepNum}>{i + 1}</Text>
                                <Text style={ss.stepText}>{step}</Text>
                            </View>
                        ))
                    )}
                </View>

                {error ? <Text style={[ss.error, ss.detailActions]}>{error}</Text> : null}

                <View style={ss.detailActions}>
                    <PressableButton
                        style={[ss.primaryBtn, adding && ss.btnDisabled]}
                        onPress={addAsRecipe}
                        disabled={adding}
                    >
                        <Text style={ss.primaryBtnText}>
                            {adding ? t('recipes.search.adding') : t('recipes.search.addBtn')}
                        </Text>
                    </PressableButton>
                </View>
            </ScrollView>
        </View>
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
            paddingTop: 56,
            paddingHorizontal: T.sp5,
            paddingBottom: T.sp3,
            borderBottomWidth: 1,
            borderBottomColor: T.borderSoft,
        },
        backBtn: {
            width: 84,
            justifyContent: 'center',
        },
        backText: {
            color: T.textSecondary,
            fontSize: T.textXs,
            letterSpacing: 1.2,
            fontFamily: T.fontMono,
            textTransform: 'uppercase',
        },
        headerTitle: {
            flex: 1,
            textAlign: 'center',
            color: T.textPrimary,
            fontSize: T.textXl,
            fontFamily: T.fontDisplayItalic,
            marginHorizontal: T.sp2,
            lineHeight: T.textXl * 1.2,
        },
        headerRight: {
            width: 84,
        },
        searchWrap: {
            paddingHorizontal: T.sp5,
            paddingTop: T.sp4,
            paddingBottom: T.sp3,
            gap: T.sp3,
        },
        input: {
            borderBottomWidth: 1,
            borderBottomColor: T.borderSoft,
            paddingHorizontal: 0,
            paddingVertical: T.sp3,
            fontSize: T.textMd,
            color: T.textPrimary,
            fontFamily: T.fontBody,
            backgroundColor: 'transparent',
        },
        subtle: {
            color: T.textTertiary,
            fontSize: 11,
            fontFamily: T.fontMono,
            letterSpacing: 0.8,
            textAlign: 'right',
        },
        searchBtn: {
            borderWidth: 1,
            borderColor: T.borderStrong,
            borderRadius: 6,
            paddingVertical: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
        },
        searchBtnText: {
            color: T.textPrimary,
            fontSize: T.textXs,
            fontFamily: T.fontMonoMedium,
            letterSpacing: 2,
            textTransform: 'uppercase',
        },
        primaryBtn: {
            backgroundColor: T.accent,
            borderRadius: 6,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: T.accent,
        },
        primaryBtnText: {
            color: T.onAccent,
            fontSize: T.textXs,
            fontFamily: T.fontMonoMedium,
            letterSpacing: 2,
            textTransform: 'uppercase',
        },
        btnDisabled: {
            opacity: 0.45,
        },
        error: {
            color: T.danger,
            fontSize: T.textSm,
            fontFamily: T.fontBody,
            lineHeight: T.textSm * 1.35,
        },
        centered: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        listContent: {
            paddingHorizontal: T.sp5,
            paddingBottom: T.sp6,
        },
        separator: {
            height: 1,
            backgroundColor: T.borderFaint,
        },
        resultCard: {
            paddingVertical: T.sp5,
            flexDirection: 'row',
            gap: T.sp4,
            backgroundColor: 'transparent',
        },
        thumb: {
            width: 80,
            height: 100,
            borderRadius: 4,
            backgroundColor: T.surface2,
        },
        resultInfo: {
            flex: 1,
            justifyContent: 'center',
            gap: T.sp1,
        },
        resultTitle: {
            color: T.textPrimary,
            fontSize: 20,
            fontFamily: T.fontDisplay,
            lineHeight: 24,
            letterSpacing: -0.2,
        },
        resultMeta: {
            color: T.textTertiary,
            fontSize: 11,
            fontFamily: T.fontMono,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            lineHeight: 14,
        },
        resultMacro: {
            color: T.textSecondary,
            fontSize: 11,
            fontFamily: T.fontMono,
            letterSpacing: 0.35,
            lineHeight: 14,
        },
        scroll: {
            flex: 1,
        },
        detailContent: {
            paddingBottom: T.sp7,
        },
        heroImage: {
            width: '100%',
            aspectRatio: 16 / 9,
            borderRadius: 0,
            backgroundColor: T.surface2,
            marginBottom: T.sp5,
        },
        detailHead: {
            paddingHorizontal: T.sp5,
            marginBottom: T.sp5,
        },
        detailTitle: {
            color: T.textPrimary,
            fontSize: 28,
            fontFamily: T.fontDisplay,
            lineHeight: 34,
            letterSpacing: -0.4,
            marginBottom: T.sp2,
        },
        detailMeta: {
            color: T.textTertiary,
            fontSize: 11,
            fontFamily: T.fontMono,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
        },
        macroStrip: {
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: T.borderSoft,
            borderBottomWidth: 1,
            borderBottomColor: T.borderSoft,
            marginHorizontal: T.sp5,
            marginBottom: T.sp6,
        },
        macroStat: {
            flex: 1,
            paddingVertical: T.sp3,
            alignItems: 'center',
            borderRightWidth: 1,
            borderRightColor: T.borderFaint,
        },
        macroStatLast: {
            borderRightWidth: 0,
        },
        macroLabel: {
            color: T.textTertiary,
            fontSize: 10,
            fontFamily: T.fontMono,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 2,
        },
        macroValue: {
            color: T.textPrimary,
            fontSize: T.textLg,
            fontFamily: T.fontDisplay,
            lineHeight: T.textLg * 1.2,
        },
        sectionWrap: {
            paddingHorizontal: T.sp5,
            marginBottom: T.sp5,
        },
        sectionTitle: {
            color: T.textSecondary,
            fontSize: T.textXs,
            fontFamily: T.fontMono,
            letterSpacing: 1.8,
            textTransform: 'uppercase',
            marginBottom: T.sp3,
        },
        bulletLine: {
            color: T.textPrimary,
            fontSize: T.textBase,
            fontFamily: T.fontBody,
            lineHeight: T.textBase * 1.45,
            marginBottom: T.sp2,
        },
        stepRow: {
            flexDirection: 'row',
            gap: T.sp3,
            marginBottom: T.sp3,
            alignItems: 'flex-start',
        },
        stepNum: {
            color: T.textPrimary,
            fontSize: 24,
            fontFamily: T.fontDisplayItalic,
            lineHeight: 28,
            width: 24,
            textAlign: 'left',
        },
        stepText: {
            flex: 1,
            color: T.textPrimary,
            fontSize: T.textBase,
            fontFamily: T.fontBody,
            lineHeight: T.textBase * 1.5,
        },
        detailActions: {
            paddingHorizontal: T.sp5,
            marginTop: T.sp2,
        },
    });
}
