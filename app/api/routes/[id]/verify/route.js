import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { VERIFY_AXES, computeConfidence, computeAxisScores } from '@/lib/verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const db = await getDb();
    const body = await request.json().catch(() => ({}));
    const user_id = body.user_id || 'anon';
    const routeId = params.id;

    const existing = await db.collection('verifications').findOne({ route_id: routeId, user_id });
    if (body.unverify) {
      if (existing) await db.collection('verifications').deleteOne({ route_id: routeId, user_id });
    } else {
      const answers = {
        ...Object.fromEntries(VERIFY_AXES.map((key) => [key, body[key] !== false])),
        author: body.author || 'Anonymous',
        updated_at: new Date().toISOString(),
      };
      if (existing) {
        await db.collection('verifications').updateOne({ route_id: routeId, user_id }, { $set: answers });
      } else {
        await db.collection('verifications').insertOne({
          id: uuidv4(), route_id: routeId, user_id, created_at: answers.updated_at, ...answers,
        });
      }
    }

    const all = await db.collection('verifications').find({ route_id: routeId }).toArray();
    const confidence_score = computeConfidence(all);
    const axis_scores = computeAxisScores(all);
    await db.collection('routes').updateOne(
      { id: routeId },
      { $set: { verified_count: all.length, confidence_score, axis_scores } }
    );

    return NextResponse.json({
      verified_count: all.length,
      confidence_score,
      axis_scores,
      verified_by_me: !body.unverify,
    });
  } catch (error) {
    console.error(`POST /api/routes/${params.id}/verify failed:`, error);
    return NextResponse.json({ error: 'Failed to verify route' }, { status: 500 });
  }
}
