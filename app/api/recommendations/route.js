import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { forwardGeocode } from '@/lib/geocode';
import { haversine } from '@/lib/geo';
import { applyPolylineFormat } from '@/lib/polyline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DESTINATION_RADIUS_KM = 15;

// Raasta recommends *existing community-recorded routes* near a destination,
// grouped by mode — not a live turn-by-turn routing engine. Matches the
// product's own positioning ("Google Maps gives directions, Raasta gives
// recommendations") and reuses data that already exists rather than
// integrating a routing/directions API.
const MODES = [
  { key: 'car', icon: '🚗', label: 'Best Car Route', match: (r) => ['Commute', 'Road Trip'].includes(r.route_type) },
  { key: 'bike', icon: '🏍', label: 'Recommended Bike Route', match: (r) => r.route_type === 'Bike Ride' || (r.tags || []).includes('Bike Route') },
  { key: 'walk', icon: '🚶', label: 'Walking Route', match: (r) => r.route_type === 'Walk' },
  { key: 'truck', icon: '🚚', label: 'Truck Friendly Route', match: (r) => (r.tags || []).includes('Truck Friendly') },
  { key: 'family', icon: '👨‍👩‍👧', label: 'Family Friendly Route', match: (r) => (r.tags || []).includes('Family Friendly') },
  { key: 'rain_safe', icon: '🌧', label: 'Rain Safe Route', match: (r) => (r.tags || []).some((t) => ['Rain Safe', 'Monsoon Safe'].includes(t)) },
  { key: 'scenic', icon: '🌄', label: 'Scenic Route', match: (r) => (r.tags || []).includes('Scenic') },
];

function boundingBox(lat, lng, radiusKm) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return {
    'end.lat': { $gte: lat - latDelta, $lte: lat + latDelta },
    'end.lng': { $gte: lng - lngDelta, $lte: lng + lngDelta },
  };
}

// Higher is better: prefers verified, community-approved routes, not just
// whichever happens to be nearest.
function scoreRoute(r) {
  return (r.confidence_score || 0) + (r.verified_count || 0) * 5 + (r.rating_count || 0) * 3;
}

export async function GET(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const format = searchParams.get('format');
    if (!q?.trim()) return NextResponse.json({ error: 'q (destination) is required' }, { status: 400 });

    const destination = await forwardGeocode(q.trim());
    if (!destination) return NextResponse.json({ error: `Could not find "${q}"` }, { status: 404 });

    const db = await getDb();
    const box = boundingBox(destination.lat, destination.lng, DESTINATION_RADIUS_KM);
    const candidates = await db.collection('routes')
      .find({ is_public: true, end: { $exists: true }, ...box })
      .project({ id: 1, end: 1, route_type: 1, tags: 1, confidence_score: 1, verified_count: 1, rating_count: 1 })
      .limit(300)
      .toArray();

    const inRadius = candidates.filter((r) => haversine(r.end, destination) <= DESTINATION_RADIUS_KM);

    const winnerIdByMode = {};
    for (const mode of MODES) {
      const matches = inRadius.filter(mode.match);
      if (matches.length === 0) continue;
      matches.sort((a, b) => scoreRoute(b) - scoreRoute(a));
      winnerIdByMode[mode.key] = matches[0].id;
    }

    const winnerIds = Object.values(winnerIdByMode);
    const fullDocs = winnerIds.length
      ? await db.collection('routes').find({ id: { $in: winnerIds } }).project({
          _id: 0, id: 1, name: 1, creator_name: 1, route_type: 1, points: 1, tags: 1,
          distance_km: 1, duration_sec: 1, views: 1, likes: 1, rating_avg: 1, rating_count: 1,
          verified_count: 1, confidence_score: 1, ai_summary: 1, share_code: 1,
        }).toArray()
      : [];
    const docsById = Object.fromEntries(fullDocs.map((d) => [d.id, d]));

    const cards = MODES
      .filter((mode) => winnerIdByMode[mode.key])
      .map((mode) => ({ mode: mode.key, icon: mode.icon, label: mode.label, route: docsById[winnerIdByMode[mode.key]] }))
      .filter((card) => card.route)
      .map((card) => ({ ...card, route: applyPolylineFormat(card.route, format) }));

    return NextResponse.json({ destination, cards });
  } catch (error) {
    console.error('GET /api/recommendations failed:', error);
    return NextResponse.json({ error: 'Failed to load recommendations' }, { status: 500 });
  }
}
