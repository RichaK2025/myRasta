import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { resolveUserId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Add or remove a route reference — never duplicates route data, just the id.
export async function PATCH(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const body = await request.json().catch(() => ({}));
    const userId = resolveUserId(request, body.user_id);
    const group = await db.collection('groups').findOne({ id: params.id }, { projection: { member_ids: 1 } });
    if (!group?.member_ids?.includes(userId)) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }
    if (!body.route_id) return NextResponse.json({ error: 'route_id is required' }, { status: 400 });

    const op = body.remove ? { $pull: { route_ids: body.route_id } } : { $addToSet: { route_ids: body.route_id } };
    await db.collection('group_collections').updateOne({ id: params.collectionId, group_id: params.id }, op);

    const updated = await db.collection('group_collections').findOne({ id: params.collectionId }, { projection: { _id: 0 } });
    return NextResponse.json(updated || { error: 'Not found' });
  } catch (error) {
    console.error(`PATCH /api/groups/${params.id}/collections/${params.collectionId} failed:`, error);
    return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 });
  }
}
