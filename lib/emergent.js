import OpenAI from 'openai';

const apiKey = process.env.EMERGENT_LLM_KEY;

let client = null;
function getClient() {
  if (!apiKey) throw new Error('Missing EMERGENT_LLM_KEY');
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: 'https://integrations.emergentagent.com/llm/v1',
    });
  }
  return client;
}

function buildPrompt(route) {
  const pts = route.points || [];
  const speeds = pts.map((p) => (p.speed || 0) * 3.6);
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
  const avgSpeed = route.avg_speed_kmh || 0;
  const speedVariance = speeds.length > 1
    ? (speeds.reduce((a, s) => a + Math.abs(s - avgSpeed / 3.6 * 3.6), 0) / speeds.length).toFixed(1)
    : 0;

  return `You are analyzing a driving/riding route recorded by a human.

Route details:
- Name: ${route.name}
- Type: ${route.route_type || 'unknown'}
- Tags: ${(route.tags || []).join(', ') || 'none'}
- Distance: ${(route.distance_km || 0).toFixed(2)} km
- Duration: ${Math.round((route.duration_sec || 0) / 60)} minutes
- Avg speed: ${avgSpeed.toFixed(1)} km/h
- Max speed: ${maxSpeed.toFixed(1)} km/h
- Speed variance: ${speedVariance}
- GPS points recorded: ${pts.length}
- Description: ${route.description || 'none'}
- Notes from creator: ${route.notes || 'none'}

Write in warm, friendly, human tone. Reply ONLY with valid JSON in this exact shape:
{
  "summary": "2-3 sentence engaging summary of the route character, what to expect and who it's best for",
  "difficulty": 1-5 integer (1=very easy, 5=demanding),
  "fuel_note": "one-sentence estimate of fuel efficiency vs typical alternative, mentioning why",
  "vibe": "1-3 word vibe like 'chill scenic drive' or 'quick urban dash'"
}
No code fences, no extra text.`;
}

export async function summarizeRoute(route) {
  const c = getClient();
  const resp = await c.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a concise route analyst. Reply only with valid JSON.' },
      { role: 'user', content: buildPrompt(route) },
    ],
    temperature: 0.7,
    max_tokens: 400,
  });
  let content = resp.choices?.[0]?.message?.content?.trim() || '';
  // strip fences if present
  content = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    // try to extract JSON
    const m = content.match(/\{[\s\S]*\}/);
    if (m) data = JSON.parse(m[0]);
    else throw new Error('Could not parse AI response');
  }
  const difficulty = Math.min(5, Math.max(1, parseInt(data.difficulty, 10) || 3));
  return {
    summary: String(data.summary || '').trim(),
    difficulty,
    fuel_note: String(data.fuel_note || '').trim(),
    vibe: String(data.vibe || '').trim(),
    generated_at: new Date().toISOString(),
  };
}
