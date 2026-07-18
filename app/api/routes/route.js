import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { haversine } from '@/lib/geo';
import { resolveUserId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function shortCode(len = 6) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Authoritative speed calculation, derived server-side from the raw coordinate
// track (lat/lng/timestamp[/speed]) rather than trusting client-reported stats,
// which a client could send incorrect or spoofed values for.
function computeSpeedStats(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return { maxSpeedKmh: 0, avgSpeedKmh: 0 };
  }

  const deviceSpeeds = points
    .map((p) => (typeof p.speed === 'number' && p.speed >= 0 ? p.speed * 3.6 : null))
    .filter((v) => v != null);

  let maxSpeedKmh = deviceSpeeds.length ? Math.max(...deviceSpeeds) : 0;
  let totalDistanceKm = 0;
  let totalDurationSec = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const segmentKm = haversine(prev, curr);
    const segmentSec = ((curr.timestamp || 0) - (prev.timestamp || 0)) / 1000;
    if (segmentSec <= 0) continue;

    totalDistanceKm += segmentKm;
    totalDurationSec += segmentSec;

    const segmentSpeedKmh = (segmentKm / segmentSec) * 3600;
    if (Number.isFinite(segmentSpeedKmh)) {
      maxSpeedKmh = Math.max(maxSpeedKmh, segmentSpeedKmh);
    }
  }

  const avgSpeedKmh = totalDurationSec > 0 ? (totalDistanceKm / (totalDurationSec / 3600)) : 0;
  return {
    maxSpeedKmh: Number.isFinite(maxSpeedKmh) ? Math.round(maxSpeedKmh * 10) / 10 : 0,
    avgSpeedKmh: Number.isFinite(avgSpeedKmh) ? Math.round(avgSpeedKmh * 10) / 10 : 0,
  };
}

export async function GET(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json([]);
  }

  try {
    const db = await getDb();
    const url = new URL(request.url);
    const mine = url.searchParams.get('user_id');
    const folderId = url.searchParams.get('folder_id');
    const sort = url.searchParams.get('sort') || 'recent';
    const q = {};
    if (mine) q.user_id = mine;
    if (folderId) q.folder_id = folderId;
    let sortSpec = { created_at: -1 };
    if (sort === 'popular') sortSpec = { likes: -1, views: -1 };
    if (sort === 'trending') sortSpec = { views: -1, created_at: -1 };

    const docs = await db.collection('routes').find(q).sort(sortSpec).limit(100).toArray();
    return NextResponse.json(docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      creator_name: doc.creator_name,
      description: doc.description,
      user_id: doc.user_id,
      folder_id: doc.folder_id || null,
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
  } catch (error) {
    console.error('GET /api/routes failed:', error);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}

export async function POST(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.points) || body.points.length < 2) {
    return NextResponse.json({ error: 'A route needs at least two tracked points' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const id = uuidv4();
    let shareCode = shortCode(6);
    while (await db.collection('routes').findOne({ share_code: shareCode })) {
      shareCode = shortCode(6);
    }

    const { maxSpeedKmh, avgSpeedKmh } = computeSpeedStats(body.points);
    const userId = resolveUserId(request, body.user_id);

    const doc = {
      id,
      share_code: shareCode,
      name: body.name || 'Untitled Route',
      description: body.description || '',
      route_type: body.route_type || 'General',
      tags: Array.isArray(body.tags) ? body.tags : [],
      notes: body.notes || '',
      creator_name: body.creator_name || 'Anonymous',
      user_id: userId,
      folder_id: body.folder_id || null,
      points: body.points,
      distance_km: body.distance_km || 0,
      duration_sec: body.duration_sec || 0,
      // Authoritative, server-computed values — not the client-reported ones.
      avg_speed_kmh: avgSpeedKmh,
      max_speed_kmh: maxSpeedKmh,
      start: body.start || body.points[0],
      end: body.end || body.points[body.points.length - 1],
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
    // doc always has `id` and `share_code` at this point — insertOne throws on
    // failure rather than returning a partial document.
    return NextResponse.json(doc);
  } catch (error) {
    console.error('POST /api/routes failed:', error);
    return NextResponse.json({ error: 'Failed to save route. Please try again.' }, { status: 500 });
  }
}
