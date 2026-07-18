import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function POST(request) {
  try {
    const { idToken, anonUserId } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Missing Google token' }, { status: 400 });
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      return NextResponse.json({ error: 'Invalid or unverified Google account' }, { status: 401 });
    }

    const db = await getDb();
    const existing = await db.collection('users').findOne({ google_id: payload.sub });

    const userDoc = existing || await db.collection('users').insertOne({
      google_id: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture || null,
      created_at: new Date().toISOString(),
    });

    const user = existing || await db.collection('users').findOne({ _id: userDoc.insertedId });
    const googleUserId = `g_${user.google_id}`;

    // Claim any routes/folders recorded anonymously on this device before the
    // user signed in, so they don't get orphaned under the old device-local id.
    if (anonUserId && anonUserId !== googleUserId) {
      await db.collection('routes').updateMany(
        { user_id: anonUserId },
        { $set: { user_id: googleUserId } }
      );
      await db.collection('folders').updateMany(
        { user_id: anonUserId },
        { $set: { user_id: googleUserId } }
      );
    }

    const token = jwt.sign({ sub: user.google_id, email: user.email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });

    const response = NextResponse.json({ ok: true, user: { id: user.google_id, email: user.email, name: user.name, picture: user.picture } });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      // Without an explicit path, browsers scope the cookie to the request's
      // own path (/api/auth), so it would never be sent to /api/routes etc.
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
