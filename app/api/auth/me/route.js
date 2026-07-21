import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDb } from '@/lib/mongodb';

export async function GET(request) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.json({ user: null });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const db = await getDb();
    const user = await db.collection('users').findOne({ google_id: payload.sub });
    return NextResponse.json({ user: user ? {
      id: user.google_id, email: user.email, name: user.name, picture: user.picture,
      dob: user.dob || null, gender: user.gender || null, home_city: user.home_city || null,
      interest_tags: user.interest_tags || [], avatar_id: user.avatar_id || null,
    } : null });
  } catch {
    return NextResponse.json({ user: null });
  }
}
