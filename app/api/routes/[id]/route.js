import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { resolveUserId } from '@/lib/auth';
import { containsProfanity, MODERATION_MESSAGE } from '@/lib/moderation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const db = await getDb();
    const route = await db.collection('routes').findOne({ id: params.id });
    if (!route) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: route.id,
      name: route.name,
      description: route.description,
      route_type: route.route_type || 'General',
      creator_name: route.creator_name,
      user_id: route.user_id,
      folder_id: route.folder_id || null,
      points: route.points || [],
      distance_km: route.distance_km || 0,
      duration_sec: route.duration_sec || 0,
      avg_speed_kmh: route.avg_speed_kmh || 0,
      max_speed_kmh: route.max_speed_kmh || 0,
      start: route.start || null,
      end: route.end || null,
      city: route.city || null,
      waypoints: route.waypoints || [],
      route_stats: route.route_stats || null,
      share_code: route.share_code,
      is_public: !!route.is_public,
      visibility: route.visibility || (route.is_public ? 'public' : 'private'),
      visible_group_ids: route.visible_group_ids || [],
      visible_user_ids: route.visible_user_ids || [],
      share_expires_at: route.share_expires_at || null,
      tags: route.tags || [],
      notes: route.notes || '',
      story: route.story || null,
      ai_summary: route.ai_summary || null,
      views: route.views || 0,
      likes: route.likes || 0,
      rating_avg: route.rating_avg || 0,
      rating_count: route.rating_count || 0,
      verified_count: route.verified_count || 0,
      popularity_score: route.popularity_score || 0,
      confidence_score: route.confidence_score ?? null,
      axis_scores: route.axis_scores ?? null,
      follower_count: route.follower_count || 0,
      created_at: route.created_at,
    });
  } catch (error) {
    console.error(`GET /api/routes/${params.id} failed:`, error);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}

// Move a route into (or out of) a folder. Only the route's owner may do this.
export async function PATCH(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const db = await getDb();
    const route = await db.collection('routes').findOne({ id: params.id });
    if (!route) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const requesterId = resolveUserId(request, body.user_id);
    if (route.user_id !== requesterId) {
      return NextResponse.json({ error: 'Not authorized to modify this route' }, { status: 403 });
    }

    const update = { updated_at: new Date().toISOString() };
    if ('folder_id' in body) update.folder_id = body.folder_id || null;
    if ('name' in body && body.name.trim()) update.name = body.name.trim();
    // Empty/whitespace-only clears the override, re-enabling the AI-generated story.
    if ('story' in body) {
      if (containsProfanity(body.story)) return NextResponse.json({ error: MODERATION_MESSAGE }, { status: 400 });
      update.story = (body.story || '').trim().slice(0, 2000) || null;
    }

    await db.collection('routes').updateOne({ id: params.id }, { $set: update });
    return NextResponse.json({ ok: true, folder_id: update.folder_id ?? route.folder_id ?? null, story: update.story });
  } catch (error) {
    console.error(`PATCH /api/routes/${params.id} failed:`, error);
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 });
  }
}

// Delete a route you own. Once this file matches /api/routes/:id, the
// catch-all's DELETE handler for the same path is unreachable — Next.js
// resolves to the most specific route file regardless of which HTTP methods
// it exports, so the delete logic has to live here, not in the catch-all.
export async function DELETE(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const db = await getDb();
    const route = await db.collection('routes').findOne({ id: params.id });
    if (!route) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const requesterId = resolveUserId(request, url.searchParams.get('user_id'));
    if (route.user_id !== requesterId) {
      return NextResponse.json({ error: 'Not authorized to delete this route' }, { status: 403 });
    }

    await db.collection('routes').deleteOne({ id: params.id });
    await db.collection('comments').deleteMany({ route_id: params.id });
    await db.collection('ratings').deleteMany({ route_id: params.id });
    await db.collection('conditions').deleteMany({ route_id: params.id });
    await db.collection('route_notes').deleteMany({ route_id: params.id });
    await db.collection('verifications').deleteMany({ route_id: params.id });
    await db.collection('route_follows').deleteMany({ route_id: params.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/routes/${params.id} failed:`, error);
    return NextResponse.json({ error: 'Failed to delete route' }, { status: 500 });
  }
}
