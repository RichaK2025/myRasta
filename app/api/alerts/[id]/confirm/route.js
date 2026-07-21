import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// If enough people say the report is gone, remove it immediately rather than
// waiting out the full expiry window — mirrors how these reports work in the
// real world (stale the moment the checkpoint clears).
const EARLY_REMOVAL_NET_DENY = 2;

export async function POST(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    const db = await getDb();
    const body = await request.json().catch(() => ({}));
    const action = body.action === 'gone' ? 'gone' : 'active';
    const inc = action === 'gone' ? { deny_count: 1 } : { confirm_count: 1 };

    const updated = await db.collection('community_alerts').findOneAndUpdate(
      { id: params.id },
      { $inc: inc },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
    const alert = updated?.value || updated;
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found (may have expired)' }, { status: 404 });
    }

    if (alert.deny_count - alert.confirm_count >= EARLY_REMOVAL_NET_DENY) {
      await db.collection('community_alerts').deleteOne({ id: params.id });
      return NextResponse.json({ removed: true });
    }

    return NextResponse.json(alert);
  } catch (error) {
    console.error(`POST /api/alerts/${params.id}/confirm failed:`, error);
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}
