import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Challenge *definitions* are a small static rotating list (cycles by ISO
// week number) — zero storage. Progress is computed live against existing
// collections filtered to this week, never stored.
const CHALLENGE_SETS = [
  [
    { key: 'share_routes', label: 'Share 3 routes', target: 3 },
    { key: 'verify_routes', label: 'Verify 5 routes', target: 5 },
    { key: 'hidden_gems', label: 'Discover 2 hidden places', target: 2 },
  ],
  [
    { key: 'share_routes', label: 'Share 2 routes', target: 2 },
    { key: 'verify_routes', label: 'Verify 8 routes', target: 8 },
    { key: 'hidden_gems', label: 'Discover 3 hidden places', target: 3 },
  ],
];

function isoWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function startOfIsoWeek(d) {
  const date = new Date(d);
  const day = date.getDay() || 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day + 1);
  return date;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const week = CHALLENGE_SETS[isoWeekNumber(new Date()) % CHALLENGE_SETS.length];

  if (!process.env.MONGO_URL || !userId) {
    return NextResponse.json(week.map((c) => ({ ...c, progress: 0 })));
  }
  try {
    const db = await getDb();
    const since = startOfIsoWeek(new Date()).toISOString();

    const [sharedCount, verifiedCount, hiddenGemFollows] = await Promise.all([
      db.collection('routes').countDocuments({ user_id: userId, is_public: true, created_at: { $gte: since } }),
      db.collection('verifications').countDocuments({ user_id: userId, updated_at: { $gte: since } }),
      db.collection('route_follows').aggregate([
        { $match: { user_id: userId, created_at: { $gte: since } } },
        { $lookup: { from: 'routes', localField: 'route_id', foreignField: 'id', as: 'route' } },
        { $unwind: '$route' },
        { $match: { 'route.tags': 'Hidden Gems' } },
        { $count: 'total' },
      ]).toArray(),
    ]);

    const progressByKey = {
      share_routes: sharedCount,
      verify_routes: verifiedCount,
      hidden_gems: hiddenGemFollows[0]?.total || 0,
    };

    return NextResponse.json(week.map((c) => ({ ...c, progress: Math.min(c.target, progressByKey[c.key] || 0) })));
  } catch (error) {
    console.error('GET /api/challenges failed:', error);
    return NextResponse.json(week.map((c) => ({ ...c, progress: 0 })), { status: 503 });
  }
}
