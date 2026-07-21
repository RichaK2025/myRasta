import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { resolveUserId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Link/code-based joining only — no invite notifications, no messaging.
export async function POST(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const body = await request.json().catch(() => ({}));
    const code = (body.invite_code || '').trim().toUpperCase();
    if (!code) return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });

    const userId = resolveUserId(request, body.user_id);
    const group = await db.collection('groups').findOne({ invite_code: code });
    if (!group) return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });

    await db.collection('groups').updateOne({ id: group.id }, { $addToSet: { member_ids: userId } });
    const { _id, ...rest } = { ...group, member_ids: [...new Set([...(group.member_ids || []), userId])] };
    return NextResponse.json(rest);
  } catch (error) {
    console.error('POST /api/groups/join failed:', error);
    return NextResponse.json({ error: 'Failed to join group' }, { status: 500 });
  }
}
