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

function buildPrompt(route, communityNotes = [], conditions = []) {
  const pts = route.points || [];
  const speeds = pts.map((p) => (p.speed || 0) * 3.6);
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
  const avgSpeed = route.avg_speed_kmh || 0;
  const notesText = (communityNotes || []).slice(0, 15).map(n => `• [${n.category}] ${n.text}`).join('\n') || 'none';
  const conditionsText = (conditions || []).slice(0, 15).map(c => `• [${c.type}] ${c.text}`).join('\n') || 'none';

  return `You are Raasta's AI. Raasta is a route recommendation app. Positioning: "Google Maps gives directions. Raasta gives recommendations." Tagline: Navigate Like A Local.

Route:
- Name: ${route.name}
- Type: ${route.route_type || 'unknown'}
- Tags: ${(route.tags || []).join(', ') || 'none'}
- Distance: ${(route.distance_km || 0).toFixed(2)} km
- Duration: ${Math.round((route.duration_sec || 0) / 60)} minutes
- Avg speed: ${avgSpeed.toFixed(1)} km/h
- Max speed: ${maxSpeed.toFixed(1)} km/h
- Creator description: ${route.description || 'none'}
- Creator notes: ${route.notes || 'none'}
- Community notes along route:
${notesText}
- Recent road condition reports:
${conditionsText}

Write a warm, local-friend recommendation summary. Focus on WHY locals prefer this route (scenic value, safety, avoiding traffic, cultural spots), not just directions.

Reply ONLY with valid JSON in this exact shape:
{
  "summary": "2-3 sentence local-flavored recommendation. Start with why locals like this route.",
  "story": "4-6 sentence narrative version, the fuller backstory of why this route matters, told like a local friend explaining it over chai. Weave in the road condition reports and community notes above where relevant (e.g. rough patches, food stops, best time to visit). Distinct from summary: summary is a punchy pitch, story is the longer narrative.",
  "difficulty": 1-5 integer,
  "fuel_note": "one-sentence fuel efficiency estimate vs typical alternative",
  "vibe": "1-3 word vibe like 'chill village route' or 'monsoon-safe scenic'",
  "best_for": "one short line: who this route is best for",
  "why_locals_prefer": ["3-5 short bullets, each under 6 words, e.g. 'Better road conditions', 'Avoids traffic signals', 'Safer at night' — base these on what the tags/conditions/notes above actually indicate, not a generic list"]
}
No code fences, no extra text.`;
}

export async function summarizeRoute(route, communityNotes = [], conditions = []) {
  const c = getClient();
  const resp = await c.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a local-flavored route recommender. Reply only with valid JSON.' },
      { role: 'user', content: buildPrompt(route, communityNotes, conditions) },
    ],
    temperature: 0.7,
    max_tokens: 700,
  });
  let content = resp.choices?.[0]?.message?.content?.trim() || '';
  content = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) data = JSON.parse(m[0]);
    else throw new Error('Could not parse AI response');
  }
  const difficulty = Math.min(5, Math.max(1, parseInt(data.difficulty, 10) || 3));
  return {
    summary: String(data.summary || '').trim(),
    story: String(data.story || '').trim(),
    difficulty,
    fuel_note: String(data.fuel_note || '').trim(),
    vibe: String(data.vibe || '').trim(),
    best_for: String(data.best_for || '').trim(),
    why_locals_prefer: Array.isArray(data.why_locals_prefer) ? data.why_locals_prefer.map(String).slice(0, 5) : [],
    generated_at: new Date().toISOString(),
  };
}
