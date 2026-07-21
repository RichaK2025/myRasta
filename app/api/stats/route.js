import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE_WINDOW_DAYS = 7;

export async function GET() {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ active_users: 0, routes_saved: 0, routes_shared: 0 });
  }
  try {
    const db = await getDb();
    const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();

    const [routesSaved, routesShared, activeAgg] = await Promise.all([
      db.collection('routes').countDocuments({}),
      db.collection('routes').countDocuments({ is_public: true }),
      // Distinct users who did *something* in the last 7 days — a cheap proxy
      // for "active" from data already being written, no presence/heartbeat
      // infrastructure required.
      db.collection('routes').aggregate([
        { $match: { created_at: { $gte: since } } },
        { $project: { user_id: 1 } },
        { $unionWith: { coll: 'comments', pipeline: [{ $match: { created_at: { $gte: since } } }, { $project: { user_id: 1 } }] } },
        { $unionWith: { coll: 'verifications', pipeline: [{ $match: { updated_at: { $gte: since } } }, { $project: { user_id: 1 } }] } },
        { $unionWith: { coll: 'ratings', pipeline: [{ $match: { created_at: { $gte: since } } }, { $project: { user_id: 1 } }] } },
        { $group: { _id: '$user_id' } },
        { $count: 'total' },
      ]).toArray(),
    ]);

    return NextResponse.json({
      active_users: activeAgg[0]?.total || 0,
      routes_saved: routesSaved,
      routes_shared: routesShared,
    });
  } catch (error) {
    console.error('GET /api/stats failed:', error);
    return NextResponse.json({ active_users: 0, routes_saved: 0, routes_shared: 0 }, { status: 503 });
  }
}
