import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Live Trip Sharing: a status pointer only — current position, never a
// track/history. "Rahul is currently travelling," not a second GPS log.
export async function POST(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const body = await request.json().catch(() => ({}));
    const userId = body.user_id;
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);
    if (!userId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'user_id, lat, lng are required' }, { status: 400 });
    }

    const now = new Date();
    const existing = await db.collection('live_trips').findOne({ user_id: userId });
    const update = {
      user_id: userId,
      name: body.name || 'A traveller',
      lat, lng,
      updated_at: now, // real Date, required for the TTL index
      visible_group_ids: Array.isArray(body.group_ids) ? body.group_ids : (existing?.visible_group_ids || []),
      visible_user_ids: Array.isArray(body.user_ids) ? body.user_ids : (existing?.visible_user_ids || []),
    };
    if (existing) {
      await db.collection('live_trips').updateOne({ user_id: userId }, { $set: update });
    } else {
      await db.collection('live_trips').insertOne({ id: uuidv4(), ...update, started_at: now.toISOString() });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/live-trips failed:', error);
    return NextResponse.json({ error: 'Failed to update live trip' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    await db.collection('live_trips').deleteOne({ user_id: userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/live-trips failed:', error);
    return NextResponse.json({ error: 'Failed to stop sharing' }, { status: 500 });
  }
}

export async function GET(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json([]);
  }
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const viewerId = searchParams.get('viewer_id');
    if (!viewerId) return NextResponse.json([]);

    // Lets the Record screen show its own "Stop sharing" control.
    if (searchParams.get('mine') === 'true') {
      const mine = await db.collection('live_trips').findOne({ user_id: viewerId }, { projection: { _id: 0 } });
      return NextResponse.json(mine ? [mine] : []);
    }

    // Membership is looked up server-side, never trusted from the caller —
    // a client-supplied group_ids list would let anyone claim membership in
    // any group to see its members' live trips.
    const myGroups = await db.collection('groups').find({ member_ids: viewerId }, { projection: { id: 1 } }).toArray();
    const viewerGroupIds = myGroups.map((g) => g.id);

    const trips = await db.collection('live_trips')
      .find({
        user_id: { $ne: viewerId },
        $or: [
          { visible_user_ids: viewerId },
          ...(viewerGroupIds.length ? [{ visible_group_ids: { $in: viewerGroupIds } }] : []),
        ],
      })
      .project({ _id: 0 })
      .toArray();
    return NextResponse.json(trips);
  } catch (error) {
    console.error('GET /api/live-trips failed:', error);
    return NextResponse.json([], { status: 503 });
  }
}
