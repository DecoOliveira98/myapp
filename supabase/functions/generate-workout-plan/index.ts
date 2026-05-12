import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let payload: {
    fitness_level?: string;
    goal?: string;
    available_equipment?: string[];
    days_per_week?: number;
    focus_muscles?: string[];
  };

  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const fitness_level = payload?.fitness_level ?? 'moderate';
  const goal = payload?.goal ?? 'hypertrophy';
  const equipment = payload?.available_equipment ?? ['body only'];
  const days = payload?.days_per_week ?? 3;
  const focusMuscles = payload?.focus_muscles ?? [];

  const validLevels = ['beginner', 'moderate', 'advanced'];
  const validGoals = ['strength', 'hypertrophy', 'endurance', 'weight_loss'];
  if (!validLevels.includes(fitness_level)) return json({ error: 'invalid_fitness_level' }, 400);
  if (!validGoals.includes(goal)) return json({ error: 'invalid_goal' }, 400);
  if (days < 2 || days > 7) return json({ error: 'invalid_days_per_week', min: 2, max: 7 }, 400);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'missing_anthropic_key' }, 500);

  const tool = {
    name: 'generate_plans',
    description: 'Gera planos de treino personalizados com exercícios reais do banco de dados.',
    input_schema: {
      type: 'object',
      properties: {
        plans: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nome do plano (ex: "Plano A — Push/Pull/Legs")' },
              description: { type: 'string', description: 'Descrição curta do plano (1-2 frases)' },
              routines: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Nome do dia de treino (ex: "Dia 1 — Peito e Tríceps")' },
                    exercises: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          exercise_id: { type: 'string', description: 'ID exato do exercício no banco (formato Snake_Case com hífens)' },
                          name: { type: 'string', description: 'Nome do exercício' },
                          target_sets: { type: 'number', description: 'Número de sets recomendados' },
                          target_reps: { type: 'number', description: 'Reps por set (null se for tempo/isométrico)' },
                          rest_seconds: { type: 'number', description: 'Descanso entre sets em segundos' },
                          notes: { type: 'string', description: 'Dica técnica curta (opcional)' },
                        },
                        required: ['exercise_id', 'name', 'target_sets', 'target_reps', 'rest_seconds'],
                      },
                    },
                  },
                  required: ['name', 'exercises'],
                },
              },
            },
            required: ['name', 'description', 'routines'],
          },
        },
      },
      required: ['plans'],
    },
  };

  const system = `Você é um personal trainer experiente e certificado. Gera planos de treino personalizados usando APENAS exercícios do banco de dados free-exercise-db.

REGRAS CRÍTICAS para exercise_id:
- Os IDs seguem o padrão: nome do exercício com espaços substituídos por "_" e caracteres especiais preservados.
- Exemplos de IDs válidos: "Barbell_Bench_Press_-_Medium_Grip", "Dumbbell_Bicep_Curl", "Pullups", "Barbell_Squat", "Barbell_Deadlift", "Dumbbell_Shoulder_Press", "Lat_Pulldown", "Cable_Crossover", "Push-Up_-_Close_Grip", "Leg_Press"
- NUNCA invente IDs — use apenas exercícios comuns que existem no banco.
- Se um equipamento não está disponível, substitua por variação com equipamento disponível.

Diretrizes por nível:
- beginner: 3-4 exercícios por dia, 3 sets, 10-12 reps, compostos prioritários, descanso 90-120s
- moderate: 5-6 exercícios por dia, 3-4 sets, 8-12 reps, mix composto+isolado, descanso 60-90s
- advanced: 6-8 exercícios por dia, 4-5 sets, 6-12 reps (periodizado), técnicas avançadas, descanso 45-90s

Diretrizes por goal:
- strength: sets 4-5, reps 3-6, descanso longo (120-180s), foco em compostos pesados
- hypertrophy: sets 3-4, reps 8-12, descanso moderado (60-90s), volume alto
- endurance: sets 2-3, reps 15-20, descanso curto (30-45s), supersets
- weight_loss: circuito, reps 12-15, descanso mínimo (30s), compostos + cardio

Gerar EXATAMENTE 3 planos com abordagens diferentes (ex: PPL, Upper/Lower, Full Body, Bro Split, etc.) conforme o número de dias por semana.

Responda em português.`;

  const userMessage = `Gere 3 planos de treino para:
- Nível: ${fitness_level}
- Objetivo: ${goal}
- Equipamento disponível: ${equipment.join(', ')}
- Dias por semana: ${days}${focusMuscles.length > 0 ? `\n- Foco: ${focusMuscles.join(', ')}` : ''}`;

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'generate_plans' },
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!claudeRes.ok) {
    const detail = await claudeRes.text();
    return json({ error: 'claude_error', status: claudeRes.status, detail }, 502);
  }

  const data = await claudeRes.json();
  const toolUse = (data?.content ?? []).find((c: { type?: string }) => c?.type === 'tool_use');
  if (!toolUse?.input?.plans || !Array.isArray(toolUse.input.plans)) {
    return json({ error: 'invalid_claude_output', raw: data }, 502);
  }

  return json({ plans: toolUse.input.plans });
});
