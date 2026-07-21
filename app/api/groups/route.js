import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { shortCode } from '@/lib/shortCode';
import { resolveUserId } from '@/lib/auth';
import { containsProfanity, MODERATION_MESSAGE } from '@/lib/moderation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GROUP_CATEGORIES = ['Family', 'Bike Riders', 'Trek Group', 'Cycling Group', 'Other'];

export async function GET(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json([]);
  }
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json([]);

    const groups = await db.collection('groups')
      .find({ member_ids: userId })
      .project({ _id: 0 })
      .sort({ created_at: -1 })
      .toArray();
    return NextResponse.json(groups.map((g) => ({ ...g, member_count: (g.member_ids || []).length })));
  } catch (error) {
    console.error('GET /api/groups failed:', error);
    return NextResponse.json([], { status: 503 });
  }
}

export async function POST(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const body = await request.json().catch(() => ({}));
    const name = (body.name || '').trim().slice(0, 60);
    if (!name) return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    if (containsProfanity(name)) return NextResponse.json({ error: MODERATION_MESSAGE }, { status: 400 });

    const ownerId = resolveUserId(request, body.user_id);
    const category = GROUP_CATEGORIES.includes(body.category) ? body.category : 'Other';

    let invite_code = shortCode(6);
    while (await db.collection('groups').findOne({ invite_code })) {
      invite_code = shortCode(6);
    }

    const doc = {
      id: uuidv4(),
      name,
      category,
      owner_id: ownerId,
      member_ids: [ownerId],
      invite_code,
      created_at: new Date().toISOString(),
    };
    await db.collection('groups').insertOne(doc);
    const { _id, ...rest } = doc;
    return NextResponse.json(rest);
  } catch (error) {
    console.error('POST /api/groups failed:', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}
