import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ routes: [] });
  }

  const db = await getDb();
  const routes = await db.collection('routes').find({ is_public: true }).sort({ created_at: -1 }).limit(50).toArray();

  return NextResponse.json({ routes: routes.map((route) => ({
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
    created_at: route.created_at,
  })) });
}
