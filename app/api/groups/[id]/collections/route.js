import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { resolveUserId } from '@/lib/auth';
import { containsProfanity, MODERATION_MESSAGE } from '@/lib/moderation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireMember(db, groupId, userId) {
  const group = await db.collection('groups').findOne({ id: groupId }, { projection: { member_ids: 1 } });
  return !!group?.member_ids?.includes(userId);
}

export async function GET(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json([]);
  }
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!(await requireMember(db, params.id, userId))) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }
    const collections = await db.collection('group_collections')
      .find({ group_id: params.id })
      .project({ _id: 0 })
      .sort({ created_at: -1 })
      .toArray();
    return NextResponse.json(collections);
  } catch (error) {
    console.error(`GET /api/groups/${params.id}/collections failed:`, error);
    return NextResponse.json([], { status: 503 });
  }
}

export async function POST(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const body = await request.json().catch(() => ({}));
    const userId = resolveUserId(request, body.user_id);
    if (!(await requireMember(db, params.id, userId))) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }
    const name = (body.name || '').trim().slice(0, 60);
    if (!name) return NextResponse.json({ error: 'Collection name is required' }, { status: 400 });
    if (containsProfanity(name)) return NextResponse.json({ error: MODERATION_MESSAGE }, { status: 400 });

    const doc = {
      id: uuidv4(), group_id: params.id, name,
      route_ids: [], created_by: userId, created_at: new Date().toISOString(),
    };
    await db.collection('group_collections').insertOne(doc);
    const { _id, ...rest } = doc;
    return NextResponse.json(rest);
  } catch (error) {
    console.error(`POST /api/groups/${params.id}/collections failed:`, error);
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 });
  }
}
