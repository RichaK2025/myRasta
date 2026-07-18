import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { resolveUserId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/folders/:id { name, user_id } -> rename a folder you own
export async function PATCH(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = (body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const db = await getDb();
    const folder = await db.collection('folders').findOne({ id: params.id });
    if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const requesterId = resolveUserId(request, body.user_id);
    if (folder.user_id !== requesterId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await db.collection('folders').updateOne({ id: params.id }, { $set: { name: name.slice(0, 60) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`PATCH /api/folders/${params.id} failed:`, error);
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}

// DELETE /api/folders/:id?user_id=... -> delete a folder you own; routes inside
// it are unfiled (folder_id -> null), not deleted.
export async function DELETE(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const db = await getDb();
    const folder = await db.collection('folders').findOne({ id: params.id });
    if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const url = new URL(request.url);
    const requesterId = resolveUserId(request, url.searchParams.get('user_id'));
    if (folder.user_id !== requesterId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await db.collection('folders').deleteOne({ id: params.id });
    await db.collection('routes').updateMany({ folder_id: params.id }, { $set: { folder_id: null } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/folders/${params.id} failed:`, error);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
