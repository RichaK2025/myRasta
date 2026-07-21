import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { fuzzyIncludes } from '@/lib/fuzzy';
import { applyPolylineFormat } from '@/lib/polyline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_DIRECT_RESULTS = 5;
const FUZZY_CANDIDATE_LIMIT = 300;

function toCard(route) {
  return {
    id: route.id,
    name: route.name,
    creator_name: route.creator_name,
    route_type: route.route_type || 'General',
    points: route.points || [],
    tags: route.tags || [],
    city: route.city || null,
    distance_km: route.distance_km || 0,
    duration_sec: route.duration_sec || 0,
    views: route.views || 0,
    likes: route.likes || 0,
    rating_avg: route.rating_avg || 0,
    rating_count: route.rating_count || 0,
    verified_count: route.verified_count || 0,
    ai_summary: route.ai_summary || null,
    share_code: route.share_code,
    created_at: route.created_at,
  };
}

export async function GET(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json([]);
  }
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const format = searchParams.get('format');
    if (!q) return NextResponse.json([]);

    const db = await getDb();
    // Case-insensitive partial match, language-agnostic (Unicode substring
    // matching, not a Latin-only tokenizer) across every field a route's
    // "story" might actually be findable by.
    const regex = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex metachars in user input
    const or = [
      { name: { $regex: regex, $options: 'i' } },
      { city: { $regex: regex, $options: 'i' } },
      { creator_name: { $regex: regex, $options: 'i' } },
      { route_type: { $regex: regex, $options: 'i' } },
      { tags: { $regex: regex, $options: 'i' } },
      { story: { $regex: regex, $options: 'i' } },
      { notes: { $regex: regex, $options: 'i' } },
      { 'ai_summary.summary': { $regex: regex, $options: 'i' } },
      { 'ai_summary.story': { $regex: regex, $options: 'i' } },
    ];

    let docs = await db.collection('routes')
      .find({ is_public: true, $or: or })
      .sort({ popularity_score: -1 })
      .limit(50)
      .toArray();

    if (docs.length < MIN_DIRECT_RESULTS) {
      // Typo-tolerant fallback: score a bounded candidate set by edit
      // distance against name/city/tags — only runs when the direct match
      // came up short, and only over a capped candidate pool, so it stays
      // cheap regardless of collection size.
      const candidates = await db.collection('routes')
        .find({ is_public: true })
        .project({ id: 1, name: 1, city: 1, tags: 1 })
        .limit(FUZZY_CANDIDATE_LIMIT)
        .toArray();
      const alreadyFound = new Set(docs.map((d) => d.id));
      const fuzzyIds = candidates
        .filter((c) => !alreadyFound.has(c.id))
        .filter((c) => fuzzyIncludes(c.name, q) || fuzzyIncludes(c.city, q) || (c.tags || []).some((t) => fuzzyIncludes(t, q)))
        .map((c) => c.id);
      if (fuzzyIds.length > 0) {
        const fuzzyDocs = await db.collection('routes').find({ id: { $in: fuzzyIds } }).toArray();
        docs = [...docs, ...fuzzyDocs];
      }
    }

    return NextResponse.json(docs.map((d) => applyPolylineFormat(toCard(d), format)));
  } catch (error) {
    console.error('GET /api/search failed:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
