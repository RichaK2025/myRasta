import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { resolveUserId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const db = await getDb();
  const body = await request.json().catch(() => ({}));
  const { isPublic = false } = body;

  const route = await db.collection('routes').findOne({ id: params.id });
  if (!route) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const requesterId = resolveUserId(request, body.user_id);
  if (route.user_id !== requesterId) {
    return NextResponse.json({ error: 'Not authorized to modify this route' }, { status: 403 });
  }

  await db.collection('routes').updateOne(
    { id: params.id },
    { $set: { is_public: isPublic, updated_at: new Date().toISOString() } }
  );

  const updated = await db.collection('routes').findOne({ id: params.id });
  return NextResponse.json({ ok: true, route: updated ? { id: updated.id, is_public: updated.is_public, share_code: updated.share_code } : null });
}
