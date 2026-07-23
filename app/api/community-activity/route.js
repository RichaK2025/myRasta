import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { resolveCategoryConfig } from '@/lib/noteCategories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT_PER_SOURCE = 5;
const RESULT_LIMIT = 8;

function pickTag(route) {
  return route?.tags?.[0] || route?.route_type || 'new';
}

// Read-only feed synthesized from data that already exists on `verifications`,
// `routes`, and `route_notes` — no new collection, no extra writes.
export async function GET() {
  if (!process.env.MONGO_URL) {
    return NextResponse.json([]);
  }
  try {
    const db = await getDb();

    const recentVerifications = await db.collection('verifications')
      .find({}, { projection: { _id: 0, author: 1, user_id: 1, route_id: 1, created_at: 1 } })
      .sort({ created_at: -1 })
      .limit(LIMIT_PER_SOURCE)
      .toArray();
    const verifiedRouteIds = recentVerifications.map((v) => v.route_id);
    const verifiedRoutes = verifiedRouteIds.length
      ? await db.collection('routes')
          .find({ id: { $in: verifiedRouteIds } }, { projection: { _id: 0, id: 1, tags: 1, route_type: 1 } })
          .toArray()
      : [];
    const routeById = Object.fromEntries(verifiedRoutes.map((r) => [r.id, r]));
    const verificationEvents = recentVerifications
      .filter((v) => v.author && routeById[v.route_id])
      .map((v) => ({
        text: `${v.author} verified a ${pickTag(routeById[v.route_id])} route.`,
        created_at: v.created_at,
        user_id: v.user_id,
      }));

    const recentSharedRoutes = await db.collection('routes')
      .find({ is_public: true }, { projection: { _id: 0, user_id: 1, creator_name: 1, tags: 1, route_type: 1, created_at: 1 } })
      .sort({ created_at: -1 })
      .limit(LIMIT_PER_SOURCE)
      .toArray();
    const shareEvents = recentSharedRoutes
      .filter((r) => r.creator_name)
      .map((r) => ({
        text: `${r.creator_name} shared a ${pickTag(r)} route.`,
        created_at: r.created_at,
        user_id: r.user_id,
      }));

    const recentNotes = await db.collection('route_notes')
      .find({}, { projection: { _id: 0, author: 1, user_id: 1, category: 1, created_at: 1 } })
      .sort({ created_at: -1 })
      .limit(LIMIT_PER_SOURCE)
      .toArray();
    const noteEvents = recentNotes
      .filter((n) => n.author)
      .map((n) => ({
        text: `${n.author} discovered a ${resolveCategoryConfig(n.category).label}.`,
        created_at: n.created_at,
        user_id: n.user_id,
      }));

    let events = [...verificationEvents, ...shareEvents, ...noteEvents]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, RESULT_LIMIT);

    // Best-effort avatar resolution — only signed-in users (real google_id)
    // have a profile with an avatar_id; anonymous/test actors fall back to
    // null, which the UI renders as a neutral initial-letter avatar.
    const actorIds = [...new Set(events.map((e) => e.user_id).filter(Boolean))];
    const profiles = actorIds.length
      ? await db.collection('users')
          .find({ google_id: { $in: actorIds } }, { projection: { _id: 0, google_id: 1, avatar_id: 1 } })
          .toArray()
      : [];
    const avatarByUserId = Object.fromEntries(profiles.map((p) => [p.google_id, p.avatar_id || null]));

    events = events.map(({ text, created_at, user_id }) => ({
      text, created_at, avatar_id: avatarByUserId[user_id] || null,
    }));

    return NextResponse.json(events);
  } catch (error) {
    console.error('GET /api/community-activity failed:', error);
    return NextResponse.json([], { status: 503 });
  }
}
