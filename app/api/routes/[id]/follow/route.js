import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ follower_count: 0, following_by_me: false });
  }
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const [count, mine] = await Promise.all([
      db.collection('route_follows').countDocuments({ route_id: params.id }),
      userId ? db.collection('route_follows').findOne({ route_id: params.id, user_id: userId }) : null,
    ]);
    return NextResponse.json({ follower_count: count, following_by_me: !!mine });
  } catch (error) {
    console.error(`GET /api/routes/${params.id}/follow failed:`, error);
    return NextResponse.json({ follower_count: 0, following_by_me: false }, { status: 503 });
  }
}

export async function POST(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const body = await request.json().catch(() => ({}));
    const user_id = body.user_id || 'anon';
    const routeId = params.id;

    const existing = await db.collection('route_follows').findOne({ route_id: routeId, user_id });
    if (existing) {
      await db.collection('route_follows').deleteOne({ route_id: routeId, user_id });
    } else {
      await db.collection('route_follows').insertOne({ id: uuidv4(), route_id: routeId, user_id, created_at: new Date().toISOString() });
    }

    const follower_count = await db.collection('route_follows').countDocuments({ route_id: routeId });
    await db.collection('routes').updateOne({ id: routeId }, { $set: { follower_count } });

    return NextResponse.json({ follower_count, following_by_me: !existing });
  } catch (error) {
    console.error(`POST /api/routes/${params.id}/follow failed:`, error);
    return NextResponse.json({ error: 'Failed to follow route' }, { status: 500 });
  }
}
