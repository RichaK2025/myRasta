import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { resolveUserId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const body = await request.json().catch(() => ({}));
    const userId = resolveUserId(request, body.user_id);
    const group = await db.collection('groups').findOne({ id: params.id });
    if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (group.owner_id === userId) {
      return NextResponse.json({ error: 'The owner can\'t leave — delete the group instead' }, { status: 400 });
    }
    await db.collection('groups').updateOne({ id: params.id }, { $pull: { member_ids: userId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`POST /api/groups/${params.id}/leave failed:`, error);
    return NextResponse.json({ error: 'Failed to leave group' }, { status: 500 });
  }
}
