import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';
import { AVATARS } from '@/lib/avatars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Signed-in-only. Anonymous users keep the equivalent fields in
// localStorage via lib/preferences.js, same pattern as every other
// anon-user preference in this app.
export async function PATCH(request) {
  if (!process.env.MONGO_URL) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const update = {};
    if ('dob' in body) update.dob = body.dob || null;
    if ('gender' in body) update.gender = body.gender || null;
    if ('home_city' in body) update.home_city = (body.home_city || '').trim().slice(0, 80) || null;
    if ('interest_tags' in body) update.interest_tags = Array.isArray(body.interest_tags) ? body.interest_tags.slice(0, 20) : [];
    if ('avatar_id' in body && AVATARS.some((a) => a.id === body.avatar_id)) update.avatar_id = body.avatar_id;

    const db = await getDb();
    await db.collection('users').updateOne({ google_id: authUser.googleId }, { $set: update });
    return NextResponse.json({ ok: true, ...update });
  } catch (error) {
    console.error('PATCH /api/auth/profile failed:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
