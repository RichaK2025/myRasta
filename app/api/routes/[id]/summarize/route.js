import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { summarizeRoute } from '@/lib/emergent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const doc = await db.collection('routes').findOne({ id: params.id });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [notes, conditions] = await Promise.all([
      db.collection('route_notes').find({ route_id: params.id }).limit(20).toArray(),
      db.collection('conditions').find({ route_id: params.id }).sort({ created_at: -1 }).limit(15).toArray(),
    ]);

    const summary = await summarizeRoute(doc, notes, conditions);
    await db.collection('routes').updateOne({ id: params.id }, { $set: { ai_summary: summary } });
    return NextResponse.json(summary);
  } catch (error) {
    console.error(`POST /api/routes/${params.id}/summarize failed:`, error);
    return NextResponse.json({ error: 'Failed to summarize route' }, { status: 500 });
  }
}
