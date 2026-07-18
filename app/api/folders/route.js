import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { resolveUserId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/folders?user_id=... -> list a user's folders, each with a route count
export async function GET(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json([]);
  }

  try {
    const db = await getDb();
    const url = new URL(request.url);
    const userId = resolveUserId(request, url.searchParams.get('user_id'));

    const folders = await db.collection('folders').find({ user_id: userId }).sort({ created_at: -1 }).toArray();
    const counts = await db.collection('routes').aggregate([
      { $match: { user_id: userId, folder_id: { $ne: null } } },
      { $group: { _id: '$folder_id', count: { $sum: 1 } } },
    ]).toArray();
    const countByFolder = Object.fromEntries(counts.map((c) => [c._id, c.count]));

    return NextResponse.json(folders.map((f) => ({
      id: f.id,
      name: f.name,
      created_at: f.created_at,
      route_count: countByFolder[f.id] || 0,
    })));
  } catch (error) {
    console.error('GET /api/folders failed:', error);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}

// POST /api/folders { name, user_id } -> create a folder for the current user
export async function POST(request) {
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
    const userId = resolveUserId(request, body.user_id);
    const doc = {
      id: uuidv4(),
      user_id: userId,
      name: name.slice(0, 60),
      created_at: new Date().toISOString(),
    };
    await db.collection('folders').insertOne(doc);
    return NextResponse.json({ id: doc.id, name: doc.name, created_at: doc.created_at, route_count: 0 });
  } catch (error) {
    console.error('POST /api/folders failed:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}
