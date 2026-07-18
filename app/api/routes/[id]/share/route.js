import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const db = await getDb();
  const body = await request.json().catch(() => ({}));
  const { isPublic = false } = body;

  await db.collection('routes').updateOne(
    { id: params.id },
    { $set: { is_public: isPublic, updated_at: new Date().toISOString() } }
  );

  const route = await db.collection('routes').findOne({ id: params.id });
  return NextResponse.json({ ok: true, route: route ? { id: route.id, is_public: route.is_public, share_code: route.share_code } : null });
}
