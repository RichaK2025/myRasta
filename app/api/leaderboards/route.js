import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT = 20;

// Joins a per-event collection (route_notes/comments/ratings/verifications)
// back to `routes` so a city filter can apply to activity that doesn't carry
// its own city field.
function joinedPipeline(city) {
  return [
    { $lookup: { from: 'routes', localField: 'route_id', foreignField: 'id', as: 'route' } },
    { $unwind: '$route' },
    ...(city ? [{ $match: { 'route.city': city } }] : []),
    { $project: { user_id: 1 } },
  ];
}

export async function GET(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json([]);
  }
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric') || 'explorers';
    const city = searchParams.get('city') || null;
    const cityMatch = city ? { city } : {};

    const db = await getDb();
    let rows;

    if (metric === 'explorers') {
      rows = await db.collection('routes').aggregate([
        { $match: { is_public: true, ...cityMatch } },
        { $group: { _id: '$user_id', value: { $sum: '$distance_km' }, name: { $last: '$creator_name' } } },
        { $sort: { value: -1 } },
        { $limit: LIMIT },
      ]).toArray();
    } else if (metric === 'contributors') {
      rows = await db.collection('routes').aggregate([
        { $match: { is_public: true, ...cityMatch } },
        { $project: { user_id: 1, name: '$creator_name' } },
        { $unionWith: { coll: 'route_notes', pipeline: joinedPipeline(city) } },
        { $unionWith: { coll: 'comments', pipeline: joinedPipeline(city) } },
        { $group: { _id: '$user_id', value: { $sum: 1 }, name: { $last: '$name' } } },
        { $sort: { value: -1 } },
        { $limit: LIMIT },
      ]).toArray();
    } else if (metric === 'reviewers') {
      rows = await db.collection('comments').aggregate([
        ...joinedPipeline(city),
        { $unionWith: { coll: 'ratings', pipeline: joinedPipeline(city) } },
        { $unionWith: { coll: 'verifications', pipeline: joinedPipeline(city) } },
        { $group: { _id: '$user_id', value: { $sum: 1 } } },
        { $sort: { value: -1 } },
        { $limit: LIMIT },
      ]).toArray();
    } else {
      return NextResponse.json({ error: 'metric must be explorers, contributors, or reviewers' }, { status: 400 });
    }

    const userIds = rows.map((r) => r._id).filter(Boolean);
    const followerAgg = userIds.length
      ? await db.collection('routes').aggregate([
          { $match: { user_id: { $in: userIds } } },
          { $group: { _id: '$user_id', followers: { $sum: '$follower_count' } } },
        ]).toArray()
      : [];
    const followersByUser = Object.fromEntries(followerAgg.map((f) => [f._id, f.followers || 0]));

    return NextResponse.json(rows.map((r) => ({
      user_id: r._id,
      name: r.name || 'A local',
      value: Math.round((r.value || 0) * 10) / 10,
      followers: followersByUser[r._id] || 0,
    })));
  } catch (error) {
    console.error('GET /api/leaderboards failed:', error);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
