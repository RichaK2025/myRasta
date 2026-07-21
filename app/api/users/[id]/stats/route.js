import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getLevel, getBadges } from '@/lib/communityLevels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One small set of counts per profile view (not cached/stored) — cheap at
// this scale, and only computed when a profile is actually opened.
export async function GET(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ level: getLevel({}), badges: [] });
  }
  try {
    const db = await getDb();
    const userId = params.id;

    const [
      routesShared, verificationsGiven, follows,
      scenicRoutes, pilgrimageRoutes, monsoonRoutes,
      foodNotes, alertsReported,
    ] = await Promise.all([
      db.collection('routes').countDocuments({ user_id: userId, is_public: true }),
      db.collection('verifications').countDocuments({ user_id: userId }),
      db.collection('route_follows').countDocuments({ user_id: userId }),
      db.collection('routes').countDocuments({ user_id: userId, tags: 'Scenic' }),
      db.collection('routes').countDocuments({ user_id: userId, tags: 'Pilgrimage' }),
      db.collection('routes').countDocuments({ user_id: userId, tags: { $in: ['Rain Safe', 'Monsoon Safe'] } }),
      db.collection('route_notes').countDocuments({ user_id: userId, category: { $in: ['tea', 'food'] } }),
      // Alerts auto-expire (TTL) — this reflects currently-active reports,
      // not lifetime history, by the same storage-minimization design as
      // everything else here.
      db.collection('community_alerts').countDocuments({ reporter_id: userId }),
    ]);

    const stats = { routesShared, verificationsGiven, follows, scenicRoutes, pilgrimageRoutes, monsoonRoutes, foodNotes, alertsReported };
    return NextResponse.json({ stats, level: getLevel(stats), badges: getBadges(stats) });
  } catch (error) {
    console.error(`GET /api/users/${params.id}/stats failed:`, error);
    return NextResponse.json({ level: getLevel({}), badges: [] }, { status: 503 });
  }
}
