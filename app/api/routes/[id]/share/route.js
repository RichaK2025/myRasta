import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { resolveUserId } from '@/lib/auth';
import { VISIBILITY_OPTIONS, resolveShareExpiry } from '@/lib/visibility';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const db = await getDb();
  const body = await request.json().catch(() => ({}));

  const route = await db.collection('routes').findOne({ id: params.id });
  if (!route) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const requesterId = resolveUserId(request, body.user_id);
  if (route.user_id !== requesterId) {
    return NextResponse.json({ error: 'Not authorized to modify this route' }, { status: 403 });
  }

  const update = { updated_at: new Date().toISOString() };

  if (body.visibility) {
    if (!VISIBILITY_OPTIONS.includes(body.visibility)) {
      return NextResponse.json({ error: `visibility must be one of ${VISIBILITY_OPTIONS.join(', ')}` }, { status: 400 });
    }
    update.visibility = body.visibility;
    update.is_public = body.visibility === 'public'; // kept in sync for every existing public-feed query
    update.visible_group_ids = body.visibility === 'group' ? (Array.isArray(body.group_ids) ? body.group_ids : []) : [];
    update.visible_user_ids = body.visibility === 'selected' ? (Array.isArray(body.user_ids) ? body.user_ids : []) : [];
    update.share_expires_at = resolveShareExpiry(body.expires_in);
  } else {
    // Legacy path — the original {isPublic} shape, still fully supported.
    const isPublic = !!body.isPublic;
    update.is_public = isPublic;
    update.visibility = isPublic ? 'public' : 'private';
  }

  await db.collection('routes').updateOne({ id: params.id }, { $set: update });

  const updated = await db.collection('routes').findOne({ id: params.id });
  return NextResponse.json({
    ok: true,
    route: updated ? {
      id: updated.id, is_public: updated.is_public, share_code: updated.share_code,
      visibility: updated.visibility, visible_group_ids: updated.visible_group_ids || [],
      visible_user_ids: updated.visible_user_ids || [], share_expires_at: updated.share_expires_at || null,
    } : null,
  });
}
