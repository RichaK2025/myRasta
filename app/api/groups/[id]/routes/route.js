import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { isShareExpired } from '@/lib/visibility';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// "See routes shared by group members" — membership-checked, only routes
// explicitly shared to this specific group.
export async function GET(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json([]);
  }
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    const group = await db.collection('groups').findOne({ id: params.id }, { projection: { member_ids: 1 } });
    if (!group?.member_ids?.includes(userId)) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    const docs = await db.collection('routes')
      .find({ visibility: 'group', visible_group_ids: params.id })
      .project({
        _id: 0, id: 1, name: 1, creator_name: 1, route_type: 1, points: 1, tags: 1, city: 1,
        distance_km: 1, duration_sec: 1, views: 1, likes: 1, rating_avg: 1, rating_count: 1,
        verified_count: 1, ai_summary: 1, share_code: 1, share_expires_at: 1, created_at: 1,
      })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json(docs.filter((d) => !isShareExpired(d)));
  } catch (error) {
    console.error(`GET /api/groups/${params.id}/routes failed:`, error);
    return NextResponse.json([], { status: 503 });
  }
}
