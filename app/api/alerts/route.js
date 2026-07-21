import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { ALERT_TYPES, ALERT_EXPIRY_HOURS, resolveAlertType } from '@/lib/alertTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Small bounding-box filter around a point — cheap approximation of a radius
// query without needing a 2dsphere index, fine at this dataset size.
function boundingBox(lat, lng, radiusKm) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return {
    lat: { $gte: lat - latDelta, $lte: lat + latDelta },
    lng: { $gte: lng - lngDelta, $lte: lng + lngDelta },
  };
}

export async function GET(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json([], { status: 200 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const radiusKm = Math.min(50, parseFloat(searchParams.get('radiusKm')) || 5);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
    }

    const db = await getDb();
    const box = boundingBox(lat, lng, radiusKm);
    const docs = await db.collection('community_alerts')
      .find({ ...box, expires_at: { $gt: new Date() } })
      .project({ _id: 0 })
      .limit(50)
      .toArray();

    return NextResponse.json(docs);
  } catch (error) {
    console.error('GET /api/alerts failed:', error);
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const body = await request.json().catch(() => ({}));
    const type = resolveAlertType(body.type);
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);
    if (!type) {
      return NextResponse.json({ error: `type must be one of ${ALERT_TYPES.map((t) => t.key).join(', ')}` }, { status: 400 });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
    }

    const now = new Date();
    const doc = {
      id: uuidv4(),
      type: type.key,
      lat, lng,
      // Kept only for the "Safety Reporter" badge/leaderboard count — bounded
      // by the same TTL as the rest of the doc, not a permanent log.
      reporter_id: body.user_id || 'anon',
      created_at: now.toISOString(),
      // Must stay a real Date (not an ISO string) for the TTL index to expire it.
      expires_at: new Date(now.getTime() + ALERT_EXPIRY_HOURS * 3600 * 1000),
      confirm_count: 0,
      deny_count: 0,
    };
    await db.collection('community_alerts').insertOne(doc);
    const { _id, ...rest } = doc;
    return NextResponse.json(rest);
  } catch (error) {
    console.error('POST /api/alerts failed:', error);
    return NextResponse.json({ error: 'Failed to report alert' }, { status: 500 });
  }
}
