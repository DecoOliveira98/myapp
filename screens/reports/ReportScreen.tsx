import { useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../lib/supabase';
import { T } from '../../theme/tokens';

type Props = { session: Session; onClose: () => void };

type Period = number | 'all';

type MealFoodJoinedRow = {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    meals:
    | { date: string; user_id: string }
    | { date: string; user_id: string }[]
    | null;
};

type WeightRow = { date: string; weight_kg: number };
type FastingRow = { started_at: string; ended_at: string | null; goal_hours: number | null };

type DailyAgg = {
    kcal: number;
    p: number;
    c: number;
    g: number;
};

function isoLocalDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysLocal(date: Date, days: number): Date {
    const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    out.setDate(out.getDate() + days);
    return out;
}

function escapeHtml(input: string): string {
    return input
        .replaceAll('&', '&amp;')
        .replaceAll('<', '<')
        .replaceAll('>', '>')
        .replaceAll('"', '"')
        .replaceAll("'", '&#39;');
}

function num(n: number | null | undefined, digits = 1): string {
    return Number(n ?? 0).toFixed(digits);
}

function pct(value: number, target: number): string {
    if (target <= 0) return '—';
    return `${Math.round((value / target) * 100)}%`;
}

function svgLineChart(
    points: Array<{ x: number; y: number }>,
    width: number,
    height: number,
    padding: number
): string {
    const chartW = Math.max(1, width - padding * 2);
    const chartH = Math.max(1, height - padding * 2);

    const minX = Math.min(...points.map((p) => p.x), 0);
    const maxX = Math.max(...points.map((p) => p.x), 1);
    const minY = Math.min(...points.map((p) => p.y), 0);
    const maxY = Math.max(...points.map((p) => p.y), 1);

    const spanX = Math.max(1e-6, maxX - minX);
    const spanY = Math.max(1e-6, maxY - minY);

    const mapped = points.map((p) => {
        const x = padding + ((p.x - minX) / spanX) * chartW;
        const y = padding + (1 - (p.y - minY) / spanY) * chartH;
        return { x, y };
    });

    const polyline = mapped.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const circles = mapped
        .map(
            (p) =>
                `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3" fill="#111" />`
        )
        .join('');

    return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#ddd" stroke-width="1" />
      <polyline fill="none" stroke="#111" stroke-width="2" points="${polyline}" />
      ${circles}
    </svg>
  `;
}

function svgBarChart(
    values: Array<{ label: string; value: number }>,
    max: number,
    width: number,
    height: number,
    threshold?: number
): string {
    const padding = 24;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;
    const n = Math.max(1, values.length);
    const gap = 8;
    const barW = Math.max(6, (chartW - gap * (n - 1)) / n);
    const upper = Math.max(1, max);

    const bars = values
        .map((v, i) => {
            const h = (Math.max(0, v.value) / upper) * chartH;
            const x = padding + i * (barW + gap);
            const y = padding + (chartH - h);
            const labelX = x + barW / 2;
            return `
        <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" fill="#333" />
        <text x="${labelX.toFixed(2)}" y="${(height - 6).toFixed(2)}" text-anchor="middle" font-size="10" fill="#666">${escapeHtml(v.label)}</text>
      `;
        })
        .join('');

    let thresholdLine = '';
    if (typeof threshold === 'number' && threshold > 0) {
        const y = padding + (1 - Math.min(threshold / upper, 1)) * chartH;
        thresholdLine = `<line x1="${padding}" y1="${y.toFixed(2)}" x2="${(width - padding).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#888" stroke-dasharray="5 4" stroke-width="1" />`;
    }

    return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#ddd" stroke-width="1" />
      ${thresholdLine}
      ${bars}
    </svg>
  `;
}

export default function ReportScreen({ session, onClose }: Props) {
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function generateReport(period: Period) {
        setGenerating(true);
        setError(null);

        try {
            const today = new Date();
            const endDate = isoLocalDate(today);
            const startDate =
                period === 'all' ? null : isoLocalDate(addDaysLocal(today, -(period - 1)));

            const profileQ = supabase
                .from('profiles')
                .select('display_name, daily_calorie_target, daily_protein_g, daily_carbs_g, daily_fat_g')
                .eq('id', session.user.id)
                .maybeSingle();

            let mealQ = supabase
                .from('meal_foods')
                .select('calories, protein_g, carbs_g, fat_g, meals!inner(date, user_id)')
                .eq('meals.user_id', session.user.id)
                .lte('meals.date', endDate);

            let weightQ = supabase
                .from('weight_log')
                .select('date, weight_kg')
                .eq('user_id', session.user.id)
                .lte('date', endDate)
                .order('date', { ascending: true });

            let fastingQ = supabase
                .from('fasting_sessions')
                .select('started_at, ended_at, goal_hours')
                .eq('user_id', session.user.id)
                .lte('started_at', `${endDate}T23:59:59.999`)
                .order('started_at', { ascending: true });

            if (startDate) {
                mealQ = mealQ.gte('meals.date', startDate);
                weightQ = weightQ.gte('date', startDate);
                fastingQ = fastingQ.gte('started_at', `${startDate}T00:00:00.000`);
            }

            const [profileRes, mealsRes, weightRes, fastingRes] = await Promise.all([
                profileQ,
                mealQ,
                weightQ,
                fastingQ,
            ]);

            if (profileRes.error) throw profileRes.error;
            if (mealsRes.error) throw mealsRes.error;
            if (weightRes.error) throw weightRes.error;
            if (fastingRes.error) throw fastingRes.error;

            const profile = profileRes.data;
            const mealRows = (mealsRes.data ?? []) as MealFoodJoinedRow[];
            const weightRows = (weightRes.data ?? []) as WeightRow[];
            const fastingRows = (fastingRes.data ?? []) as FastingRow[];

            const byDate: Record<string, DailyAgg> = {};
            for (const row of mealRows) {
                const m = Array.isArray(row.meals) ? row.meals[0] : row.meals;
                const date = m?.date;
                if (!date) continue;
                if (!byDate[date]) byDate[date] = { kcal: 0, p: 0, c: 0, g: 0 };
                byDate[date].kcal += row.calories ?? 0;
                byDate[date].p += row.protein_g ?? 0;
                byDate[date].c += row.carbs_g ?? 0;
                byDate[date].g += row.fat_g ?? 0;
            }

            const dailyDates = Object.keys(byDate).sort((a, b) => a.localeCompare(b));
            const daysWithMeals = dailyDates.length;

            const totalKcal = dailyDates.reduce((acc, d) => acc + byDate[d].kcal, 0);
            const totalP = dailyDates.reduce((acc, d) => acc + byDate[d].p, 0);
            const totalC = dailyDates.reduce((acc, d) => acc + byDate[d].c, 0);
            const totalG = dailyDates.reduce((acc, d) => acc + byDate[d].g, 0);

            const avgKcal = daysWithMeals > 0 ? totalKcal / daysWithMeals : 0;
            const avgP = daysWithMeals > 0 ? totalP / daysWithMeals : 0;
            const avgC = daysWithMeals > 0 ? totalC / daysWithMeals : 0;
            const avgG = daysWithMeals > 0 ? totalG / daysWithMeals : 0;

            const kcalTarget = profile?.daily_calorie_target ?? 0;
            const pTarget = profile?.daily_protein_g ?? 0;
            const cTarget = profile?.daily_carbs_g ?? 0;
            const gTarget = profile?.daily_fat_g ?? 0;

            const weightStart = weightRows.length ? weightRows[0].weight_kg : null;
            const weightEnd = weightRows.length ? weightRows[weightRows.length - 1].weight_kg : null;
            const weightDelta =
                weightStart !== null && weightEnd !== null ? weightEnd - weightStart : null;

            const fastingDurations = fastingRows.map((s) => {
                const start = new Date(s.started_at).getTime();
                const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
                return Math.max(0, (end - start) / 36e5);
            });
            const fastingTotalHours = fastingDurations.reduce((a, b) => a + b, 0);
            const fastingAvgHours = fastingDurations.length
                ? fastingTotalHours / fastingDurations.length
                : 0;

            const ptDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });
            const ptDateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

            const periodLabel =
                period === 'all'
                    ? `Todo histórico até ${ptDate.format(new Date(`${endDate}T12:00:00`))}`
                    : `${ptDate.format(new Date(`${startDate}T12:00:00`))} → ${ptDate.format(
                        new Date(`${endDate}T12:00:00`)
                    )}`;

            const nutritionRowsHtml = dailyDates
                .map((d) => {
                    const v = byDate[d];
                    const dt = ptDate.format(new Date(`${d}T12:00:00`));
                    return `<tr><td>${dt}</td><td>${num(v.kcal, 0)}</td><td>${num(v.p)}</td><td>${num(v.c)}</td><td>${num(v.g)}</td></tr>`;
                })
                .join('');

            const weightRowsHtml = weightRows
                .map(
                    (w) =>
                        `<tr><td>${ptDate.format(new Date(`${w.date}T12:00:00`))}</td><td>${num(w.weight_kg, 1)} kg</td></tr>`
                )
                .join('');

            const fastingRowsHtml = fastingRows
                .map((s, idx) => {
                    const start = new Date(s.started_at);
                    const hours = fastingDurations[idx];
                    const goal = s.goal_hours == null ? '—' : `${num(s.goal_hours, 1)} h`;
                    return `<tr><td>${ptDate.format(start)}</td><td>${num(hours, 1)} h</td><td>${goal}</td></tr>`;
                })
                .join('');

            const kcalValues = dailyDates.map((d) => ({
                label: new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                value: byDate[d].kcal,
            }));

            const maxKcal = Math.max(
                1,
                ...kcalValues.map((v) => v.value),
                kcalTarget || 0
            );
            const kcalChartSvg = svgBarChart(kcalValues, maxKcal, 680, 220, kcalTarget || undefined);

            const weightPoints = weightRows.map((w, i) => ({ x: i, y: w.weight_kg }));
            const weightChartSvg =
                weightPoints.length >= 2
                    ? svgLineChart(weightPoints, 680, 220, 24)
                    : `<div style="color:#666;font-size:12px;">Dados insuficientes para gráfico de peso.</div>`;

            const displayName = escapeHtml(profile?.display_name?.trim() || session.user.email || 'Usuário');

            const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Relatório MyApp</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; padding: 32px; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #222; }
  .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  th, td { border: 1px solid #eee; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  .summary { background: #fafafa; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
  .summary p { margin: 4px 0; font-size: 13px; }
  .footer { margin-top: 48px; font-size: 11px; color: #999; text-align: center; }
  .chart { margin: 16px 0 24px; }
</style>
</head>
<body>
  <h1>Relatório MyApp</h1>
  <div class="meta">
    <div><strong>${displayName}</strong></div>
    <div>Período: ${escapeHtml(periodLabel)}</div>
  </div>

  <h2>Resumo nutricional</h2>
  <div class="summary">
    <p>Dias com registro: <strong>${daysWithMeals}</strong></p>
    <p>Médias diárias: <strong>${num(avgKcal, 0)} kcal</strong> · P ${num(avgP)}g · C ${num(avgC)}g · G ${num(avgG)}g</p>
    <p>Atingimento vs metas: kcal ${pct(avgKcal, kcalTarget)} · P ${pct(avgP, pTarget)} · C ${pct(avgC, cTarget)} · G ${pct(avgG, gTarget)}</p>
  </div>

  <h2>Nutrição por dia</h2>
  <table>
    <thead>
      <tr><th>Data</th><th>kcal</th><th>P</th><th>C</th><th>G</th></tr>
    </thead>
    <tbody>
      ${nutritionRowsHtml || '<tr><td colspan="5">Sem dados no período.</td></tr>'}
    </tbody>
  </table>
  <div class="chart">${kcalChartSvg}</div>

  <h2>Peso</h2>
  <div class="summary">
    <p>Início: <strong>${weightStart == null ? '—' : `${num(weightStart, 1)} kg`}</strong></p>
    <p>Fim: <strong>${weightEnd == null ? '—' : `${num(weightEnd, 1)} kg`}</strong></p>
    <p>Delta: <strong>${weightDelta == null ? '—' : `${num(weightDelta, 1)} kg`}</strong></p>
  </div>
  <table>
    <thead>
      <tr><th>Data</th><th>Peso</th></tr>
    </thead>
    <tbody>
      ${weightRowsHtml || '<tr><td colspan="2">Sem pesagens no período.</td></tr>'}
    </tbody>
  </table>
  <div class="chart">${weightChartSvg}</div>

  <h2>Jejum</h2>
  <div class="summary">
    <p>Total de horas: <strong>${num(fastingTotalHours, 1)} h</strong></p>
    <p>Média por sessão: <strong>${num(fastingAvgHours, 1)} h</strong></p>
    <p>Sessões: <strong>${fastingRows.length}</strong></p>
  </div>
  <table>
    <thead>
      <tr><th>Data início</th><th>Duração</th><th>Meta</th></tr>
    </thead>
    <tbody>
      ${fastingRowsHtml || '<tr><td colspan="3">Sem sessões no período.</td></tr>'}
    </tbody>
  </table>

  <div class="footer">Gerado em ${ptDateTime.format(new Date())}</div>
</body>
</html>
      `.trim();

            const { uri } = await Print.printToFileAsync({ html, base64: false });

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Compartilhar relatório',
                });
            } else {
                setError('Compartilhamento não disponível neste dispositivo.');
            }
        } catch (e: any) {
            setError(e?.message ?? 'Falha ao gerar relatório.');
        } finally {
            setGenerating(false);
        }
    }

    return (
        <View style={ss.screen}>
            <View style={ss.header}>
                <TouchableOpacity onPress={onClose} disabled={generating} hitSlop={10}>
                    <Text style={ss.back}>← Voltar</Text>
                </TouchableOpacity>
                <Text style={ss.title}>Relatório</Text>
            </View>

            <ScrollView contentContainerStyle={ss.content} showsVerticalScrollIndicator={false}>
                <Text style={ss.subtitle}>
                    Gere um PDF com seu histórico nutricional, peso e jejum.
                </Text>

                <TouchableOpacity
                    style={[ss.btn, generating && ss.btnDisabled]}
                    disabled={generating}
                    onPress={() => generateReport(7)}
                    activeOpacity={0.8}
                >
                    <Text style={ss.btnText}>{generating ? 'Gerando...' : '📅 Últimos 7 dias'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[ss.btn, generating && ss.btnDisabled]}
                    disabled={generating}
                    onPress={() => generateReport(30)}
                    activeOpacity={0.8}
                >
                    <Text style={ss.btnText}>{generating ? 'Gerando...' : '📅 Últimos 30 dias'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[ss.btn, generating && ss.btnDisabled]}
                    disabled={generating}
                    onPress={() => generateReport('all')}
                    activeOpacity={0.8}
                >
                    <Text style={ss.btnText}>{generating ? 'Gerando...' : '📅 Tudo'}</Text>
                </TouchableOpacity>

                {generating && (
                    <View style={ss.loadingRow}>
                        <ActivityIndicator />
                        <Text style={ss.loadingText}>Preparando PDF...</Text>
                    </View>
                )}

                {error ? <Text style={ss.error}>{error}</Text> : null}
            </ScrollView>
        </View>
    );
}

const ss = StyleSheet.create({
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
        gap: T.sp2,
    },
    back: {
        fontFamily: T.fontMono,
        fontSize: T.textSm,
        color: T.textSecondary,
        letterSpacing: 0.8,
    },
    title: {
        fontFamily: T.fontDisplay,
        fontSize: T.textXl,
        color: T.textPrimary,
    },
    content: {
        padding: T.sp5,
        gap: T.sp3,
    },
    subtitle: {
        fontFamily: T.fontBody,
        fontSize: T.textSm,
        color: T.textTertiary,
        marginBottom: T.sp2,
    },
    btn: {
        borderWidth: 1,
        borderColor: T.borderSoft,
        backgroundColor: T.surface1,
        paddingVertical: T.sp4,
        paddingHorizontal: T.sp4,
    },
    btnDisabled: {
        opacity: 0.5,
    },
    btnText: {
        fontFamily: T.fontMonoMedium,
        fontSize: T.textSm,
        color: T.textPrimary,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: T.sp2,
        marginTop: T.sp2,
    },
    loadingText: {
        fontFamily: T.fontBody,
        fontSize: T.textSm,
        color: T.textTertiary,
    },
    error: {
        marginTop: T.sp2,
        color: '#cc2b2b',
        fontFamily: T.fontBody,
        fontSize: T.textSm,
    },
});
