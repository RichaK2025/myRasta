import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function shortCode(len = 6) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function GET(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json([]);
  }

  const db = await getDb();
  const url = new URL(request.url);
  const mine = url.searchParams.get('user_id');
  const sort = url.searchParams.get('sort') || 'recent';
  const q = mine ? { user_id: mine } : {};
  let sortSpec = { created_at: -1 };
  if (sort === 'popular') sortSpec = { likes: -1, views: -1 };
  if (sort === 'trending') sortSpec = { views: -1, created_at: -1 };

  const docs = await db.collection('routes').find(q).sort(sortSpec).limit(100).toArray();
  return NextResponse.json(docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    creator_name: doc.creator_name,
    description: doc.description,
    distance_km: doc.distance_km || 0,
    duration_sec: doc.duration_sec || 0,
    avg_speed_kmh: doc.avg_speed_kmh || 0,
    max_speed_kmh: doc.max_speed_kmh || 0,
    points: doc.points || [],
    share_code: doc.share_code,
    tags: doc.tags || [],
    views: doc.views || 0,
    likes: doc.likes || 0,
    verified_count: doc.verified_count || 0,
    created_at: doc.created_at,
    route_type: doc.route_type || 'General',
  })));
}

export async function POST(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const db = await getDb();
  const body = await request.json();
  const id = uuidv4();
  let shareCode = shortCode(6);
  while (await db.collection('routes').findOne({ share_code: shareCode })) {
    shareCode = shortCode(6);
  }

  const doc = {
    id,
    share_code: shareCode,
    name: body.name || 'Untitled Route',
    description: body.description || '',
    route_type: body.route_type || 'General',
    tags: Array.isArray(body.tags) ? body.tags : [],
    notes: body.notes || '',
    creator_name: body.creator_name || 'Anonymous',
    user_id: body.user_id || 'anon',
    points: Array.isArray(body.points) ? body.points : [],
    distance_km: body.distance_km || 0,
    duration_sec: body.duration_sec || 0,
    avg_speed_kmh: body.avg_speed_kmh || 0,
    max_speed_kmh: body.max_speed_kmh || 0,
    start: body.start || null,
    end: body.end || null,
    waypoints: Array.isArray(body.waypoints) ? body.waypoints : [],
    route_stats: body.route_stats || null,
    tracking_settings: body.tracking_settings || {},
    is_public: false,
    views: 0,
    likes: 0,
    rating_avg: 0,
    rating_count: 0,
    verified_count: 0,
    ai_summary: null,
    created_at: new Date().toISOString(),
  };

  await db.collection('routes').insertOne(doc);
  return NextResponse.json(doc);
}
