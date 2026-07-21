import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { haversine } from '@/lib/geo';
import { jaccard } from '@/lib/scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROXIMITY_CUTOFF_KM = 50;
const RESULT_LIMIT = 5;

export async function GET(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ routes: [] });
  }

  try {
    const db = await getDb();
    const target = await db.collection('routes').findOne(
      { id: params.id },
      { projection: { start: 1, tags: 1, city: 1 } }
    );
    if (!target?.start) {
      return NextResponse.json({ routes: [] });
    }

    const leanProjection = { projection: { id: 1, start: 1, tags: 1 } };
    let candidates = target.city
      ? await db.collection('routes')
          .find({ id: { $ne: params.id }, is_public: true, city: target.city }, leanProjection)
          .limit(300).toArray()
      : [];
    if (candidates.length < RESULT_LIMIT) {
      candidates = await db.collection('routes')
        .find({ id: { $ne: params.id }, is_public: true }, leanProjection)
        .limit(300).toArray();
    }

    const scored = candidates
      .filter((c) => c.start)
      .map((c) => {
        const distanceKm = haversine(target.start, c.start);
        const proximity = 1 - Math.min(distanceKm, PROXIMITY_CUTOFF_KM) / PROXIMITY_CUTOFF_KM;
        const tagScore = jaccard(target.tags, c.tags);
        return { id: c.id, distanceKm, score: 0.7 * proximity + 0.3 * tagScore };
      })
      .filter((c) => c.distanceKm <= PROXIMITY_CUTOFF_KM)
      .sort((a, b) => b.score - a.score)
      .slice(0, RESULT_LIMIT);

    if (scored.length === 0) {
      return NextResponse.json({ routes: [] });
    }

    const fullDocs = await db.collection('routes')
      .find({ id: { $in: scored.map((s) => s.id) } })
      .toArray();
    const byId = new Map(fullDocs.map((d) => [d.id, d]));
    const routes = scored
      .map((s) => byId.get(s.id))
      .filter(Boolean)
      .map((route) => ({
        id: route.id,
        name: route.name,
        creator_name: route.creator_name,
        route_type: route.route_type || 'General',
        points: route.points || [],
        tags: route.tags || [],
        distance_km: route.distance_km || 0,
        duration_sec: route.duration_sec || 0,
        views: route.views || 0,
        likes: route.likes || 0,
        rating_avg: route.rating_avg || 0,
        rating_count: route.rating_count || 0,
        verified_count: route.verified_count || 0,
        ai_summary: route.ai_summary || null,
        share_code: route.share_code,
      }));

    return NextResponse.json({ routes });
  } catch (error) {
    console.error(`GET /api/routes/${params.id}/nearby failed:`, error);
    return NextResponse.json({ routes: [] }, { status: 503 });
  }
}
