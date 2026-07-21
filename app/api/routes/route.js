import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { haversine } from '@/lib/geo';
import { resolveUserId } from '@/lib/auth';
import { reverseGeocode } from '@/lib/geocode';
import { simplifyRoute } from '@/lib/simplify';
import { applyPolylineFormat } from '@/lib/polyline';
import { containsProfanity, MODERATION_MESSAGE } from '@/lib/moderation';

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
    const cityFilter = url.searchParams.get('city');
    const routeTypeFilter = url.searchParams.get('route_type');
    const minDistance = parseFloat(url.searchParams.get('minDistance'));
    const maxDistance = parseFloat(url.searchParams.get('maxDistance'));
    const near = url.searchParams.get('near'); // "lat,lng"
    const radiusKm = Math.min(200, parseFloat(url.searchParams.get('radiusKm')) || 25);

    const q = {};
    // Without a user_id, this is a public listing (Explore/Community) — only
    // ever return routes their owner chose to publish. With a user_id, the
    // caller is asking for their own library, which must include their
    // private routes too.
    if (mine) q.user_id = mine;
    else q.is_public = true;
    if (folderId) q.folder_id = folderId;
    if (cityFilter) q.city = cityFilter;
    if (routeTypeFilter) q.route_type = routeTypeFilter;
    if (Number.isFinite(minDistance) || Number.isFinite(maxDistance)) {
      q.distance_km = {};
      if (Number.isFinite(minDistance)) q.distance_km.$gte = minDistance;
      if (Number.isFinite(maxDistance)) q.distance_km.$lte = maxDistance;
    }
    let nearPoint = null;
    if (near) {
      const [lat, lng] = near.split(',').map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        nearPoint = { lat, lng };
        const latDelta = radiusKm / 111;
        const lngDelta = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
        q['start.lat'] = { $gte: lat - latDelta, $lte: lat + latDelta };
        q['start.lng'] = { $gte: lng - lngDelta, $lte: lng + lngDelta };
      }
    }

    let sortSpec = { created_at: -1 };
    if (sort === 'popular') sortSpec = { popularity_score: -1, views: -1 };
    if (sort === 'trending') sortSpec = { views: -1, created_at: -1 };

    let docs = await db.collection('routes').find(q).sort(sortSpec).limit(nearPoint ? 300 : 100).toArray();
    if (nearPoint) {
      docs = docs
        .filter((d) => d.start)
        .filter((d) => haversine(d.start, nearPoint) <= radiusKm)
        .slice(0, 100);
    }

    const format = url.searchParams.get('format');
    return NextResponse.json(docs.map((doc) => applyPolylineFormat({
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
      city: doc.city || null,
      story: doc.story || null,
      ai_summary: doc.ai_summary || null,
      views: doc.views || 0,
      likes: doc.likes || 0,
      rating_avg: doc.rating_avg || 0,
      rating_count: doc.rating_count || 0,
      verified_count: doc.verified_count || 0,
      follower_count: doc.follower_count || 0,
      popularity_score: doc.popularity_score || 0,
      created_at: doc.created_at,
      route_type: doc.route_type || 'General',
    }, format)));
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

  if (containsProfanity(body.name) || containsProfanity(body.description) || containsProfanity(body.notes)) {
    return NextResponse.json({ error: MODERATION_MESSAGE }, { status: 400 });
  }

  try {
    const db = await getDb();
    const id = uuidv4();
    let shareCode = shortCode(6);
    while (await db.collection('routes').findOne({ share_code: shareCode })) {
      shareCode = shortCode(6);
    }

    // Stats are computed from the full recorded track (accuracy), storage
    // uses the simplified one (size) — kept deliberately separate.
    const { maxSpeedKmh, avgSpeedKmh } = computeSpeedStats(body.points);
    const simplifiedPoints = simplifyRoute(body.points);
    const userId = resolveUserId(request, body.user_id);
    const start = body.start || body.points[0];
    // Best-effort — a geocoding outage must never block saving a route.
    const city = await reverseGeocode(start.lat, start.lng).catch(() => null);

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
      points: simplifiedPoints,
      distance_km: body.distance_km || 0,
      duration_sec: body.duration_sec || 0,
      // Authoritative, server-computed values — not the client-reported ones.
      avg_speed_kmh: avgSpeedKmh,
      max_speed_kmh: maxSpeedKmh,
      start,
      end: body.end || body.points[body.points.length - 1],
      city,
      waypoints: Array.isArray(body.waypoints) ? body.waypoints : [],
      route_stats: body.route_stats || null,
      tracking_settings: body.tracking_settings || {},
      is_public: false,
      visibility: 'private',
      visible_group_ids: [],
      visible_user_ids: [],
      share_expires_at: null,
      views: 0,
      likes: 0,
      rating_avg: 0,
      rating_count: 0,
      verified_count: 0,
      follower_count: 0,
      popularity_score: 0,
      confidence_score: null,
      ai_summary: null,
      story: null,
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
