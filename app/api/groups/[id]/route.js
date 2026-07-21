import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { resolveUserId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const group = await db.collection('groups').findOne({ id: params.id }, { projection: { _id: 0 } });
    if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!group.member_ids?.includes(userId)) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }
    return NextResponse.json(group);
  } catch (error) {
    console.error(`GET /api/groups/${params.id} failed:`, error);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}

export async function DELETE(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const url = new URL(request.url);
    const requesterId = resolveUserId(request, url.searchParams.get('user_id'));
    const group = await db.collection('groups').findOne({ id: params.id });
    if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (group.owner_id !== requesterId) {
      return NextResponse.json({ error: 'Only the group owner can delete it' }, { status: 403 });
    }
    await db.collection('groups').deleteOne({ id: params.id });
    await db.collection('group_collections').deleteMany({ group_id: params.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/groups/${params.id} failed:`, error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
