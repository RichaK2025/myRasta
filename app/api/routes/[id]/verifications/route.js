import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { withDefaultedAxes } from '@/lib/verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ count: 0, confidence_score: null, axis_scores: null, users: [] });
  }

  try {
    const db = await getDb();
    const docs = await db.collection('verifications').find({ route_id: params.id }).toArray();
    const route = await db.collection('routes').findOne({ id: params.id }, { projection: { confidence_score: 1, axis_scores: 1 } });
    return NextResponse.json({
      count: docs.length,
      confidence_score: route?.confidence_score ?? null,
      axis_scores: route?.axis_scores ?? null,
      users: docs.map((d) => ({
        user_id: d.user_id,
        author: d.author,
        created_at: d.created_at,
        ...withDefaultedAxes(d),
      })),
    });
  } catch (error) {
    console.error(`GET /api/routes/${params.id}/verifications failed:`, error);
    return NextResponse.json({ count: 0, confidence_score: null, axis_scores: null, users: [] }, { status: 503 });
  }
}
