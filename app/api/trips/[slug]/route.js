import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const db = await getDb();
  const route = await db.collection('routes').findOne({ share_code: params.slug });
  if (!route) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: route.id,
    name: route.name,
    description: route.description,
    creator_name: route.creator_name,
    points: route.points || [],
    distance_km: route.distance_km || 0,
    duration_sec: route.duration_sec || 0,
    avg_speed_kmh: route.avg_speed_kmh || 0,
    max_speed_kmh: route.max_speed_kmh || 0,
    share_code: route.share_code,
    is_public: !!route.is_public,
    tags: route.tags || [],
    notes: route.notes || '',
    views: route.views || 0,
    created_at: route.created_at,
  });
}
