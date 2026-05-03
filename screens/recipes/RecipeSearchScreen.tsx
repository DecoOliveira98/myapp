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
import { supabase } from '../../lib/supabase';

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
            if (!r || r.length === 0) { setError('Nenhuma receita encontrada. Tente outros termos.'); return; }
            setResults(r);
        } catch (e: any) {
            setError(e?.message ?? 'Erro na busca');
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

            Alert.alert('Receita adicionada', 'Você pode editá-la em "Receitas" no início.', [
                { text: 'OK', onPress: onClose }
            ]);
        } catch (e: any) {
            setError(e?.message ?? 'Erro ao salvar');
            setAdding(false);
        }
    }

    if (selected === null) {
        return (
            <View style={ss.root}>
                <View style={ss.header}>
                    <TouchableOpacity onPress={onClose} hitSlop={12} style={ss.backBtn}>
                        <Text style={ss.backText}>← Voltar</Text>
                    </TouchableOpacity>
                    <Text style={ss.headerTitle}>Explorar receitas</Text>
                    <View style={ss.headerRight} />
                </View>

                <View style={ss.searchWrap}>
                    <TextInput
                        style={ss.input}
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Ex: chicken salad, pasta, smoothie..."
                        placeholderTextColor="#999"
                        keyboardType="default"
                        returnKeyType="search"
                        onSubmitEditing={runSearch}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    <Text style={ss.subtle}>Receitas vêm em inglês (Spoonacular).</Text>

                    <TouchableOpacity
                        style={[ss.primaryBtn, !canSearch && ss.btnDisabled]}
                        onPress={runSearch}
                        disabled={!canSearch}
                        activeOpacity={0.85}
                    >
                        <Text style={ss.primaryBtnText}>{searching ? 'Buscando...' : '🔎 Buscar'}</Text>
                    </TouchableOpacity>

                    {error ? <Text style={ss.error}>{error}</Text> : null}
                </View>

                {searching && results.length === 0 ? (
                    <View style={ss.centered}>
                        <ActivityIndicator color="#222" />
                    </View>
                ) : (
                    <FlatList
                        data={results}
                        keyExtractor={(item) => String(item.spoonacular_id)}
                        contentContainerStyle={ss.listContent}
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
                                        <Text style={ss.resultMeta}>{mins}min · {item.servings} porções</Text>
                                        <Text style={ss.resultMacro}>
                                            {Math.round(safeNum(item.per_serving?.kcal))} kcal · {Math.round(safeNum(item.per_serving?.protein_g))}p · {Math.round(safeNum(item.per_serving?.carbs_g))}c · {Math.round(safeNum(item.per_serving?.fat_g))}g por porção
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
                    <Text style={ss.backText}>← Voltar</Text>
                </TouchableOpacity>
                <Text style={ss.headerTitle} numberOfLines={1}>{selected.title}</Text>
                <View style={ss.headerRight} />
            </View>

            <ScrollView style={ss.scroll} contentContainerStyle={ss.detailContent}>
                <Image source={{ uri: selected.image }} style={ss.heroImage} resizeMode="cover" />

                <Text style={ss.detailMeta}>
                    {selected.ready_in_minutes == null ? '—' : selected.ready_in_minutes}min · {selected.servings} porções
                </Text>

                <View style={ss.summaryCard}>
                    <Text style={ss.summaryText}>
                        Por porção: {Math.round(safeNum(selected.per_serving?.kcal))} kcal · {Math.round(safeNum(selected.per_serving?.protein_g))}g P · {Math.round(safeNum(selected.per_serving?.carbs_g))}g C · {Math.round(safeNum(selected.per_serving?.fat_g))}g G
                    </Text>
                </View>

                <Text style={ss.sectionTitle}>Ingredientes</Text>
                <View style={ss.sectionCard}>
                    {selected.ingredients.map((ingredient, idx) => (
                        <Text key={`${ingredient.name}-${idx}`} style={ss.bulletLine}>
                            • {ingredient.original}
                        </Text>
                    ))}
                </View>

                <Text style={ss.sectionTitle}>Modo de preparo</Text>
                <View style={ss.sectionCard}>
                    {selected.instructions.length === 0 ? (
                        <Text style={ss.bulletLine}>Sem instruções detalhadas.</Text>
                    ) : (
                        selected.instructions.map((step, i) => (
                            <Text key={`${i}-${step.slice(0, 12)}`} style={ss.bulletLine}>
                                {i + 1}. {step}
                            </Text>
                        ))
                    )}
                </View>

                {error ? <Text style={ss.error}>{error}</Text> : null}

                <TouchableOpacity
                    style={[ss.primaryBtn, adding && ss.btnDisabled, { marginTop: 8 }]}
                    onPress={addAsRecipe}
                    disabled={adding}
                    activeOpacity={0.85}
                >
                    <Text style={ss.primaryBtnText}>
                        {adding ? 'Adicionando...' : '+ Adicionar como minha receita'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const ss = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 56,
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backBtn: {
        width: 84,
    },
    backText: {
        color: '#111',
        fontSize: 12,
        letterSpacing: 0.6,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        color: '#111',
        fontSize: 22,
        fontWeight: '600',
        marginHorizontal: 8,
    },
    headerRight: {
        width: 84,
    },
    searchWrap: {
        padding: 16,
        gap: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
        fontSize: 16,
        color: '#111',
        backgroundColor: '#fff',
    },
    subtle: {
        color: '#666',
        fontSize: 12,
    },
    primaryBtn: {
        backgroundColor: '#222',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    btnDisabled: {
        opacity: 0.5,
    },
    error: {
        color: '#c0392b',
        fontSize: 14,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    resultCard: {
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        flexDirection: 'row',
        gap: 12,
        backgroundColor: '#fff',
    },
    thumb: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
    },
    resultInfo: {
        flex: 1,
    },
    resultTitle: {
        color: '#111',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    resultMeta: {
        color: '#666',
        fontSize: 13,
        marginBottom: 4,
    },
    resultMacro: {
        color: '#111',
        fontSize: 13,
        fontWeight: '700',
    },
    scroll: {
        flex: 1,
    },
    detailContent: {
        padding: 16,
        paddingBottom: 28,
    },
    heroImage: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        backgroundColor: '#f4f4f4',
        marginBottom: 12,
    },
    detailMeta: {
        color: '#666',
        fontSize: 14,
        marginBottom: 10,
    },
    summaryCard: {
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
        backgroundColor: '#fff',
    },
    summaryText: {
        color: '#111',
        fontSize: 14,
        fontWeight: '600',
    },
    sectionTitle: {
        color: '#111',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 10,
        marginBottom: 8,
    },
    sectionCard: {
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 12,
        padding: 16,
        backgroundColor: '#fff',
    },
    bulletLine: {
        color: '#111',
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 6,
    },
});
